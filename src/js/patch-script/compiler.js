import { compileGraph } from '../audio/graph.js';
import { normalizePatch } from '../app/patch-format.js';
import { RackState } from '../app/rack-state.js';
import { getModuleParamPaths } from '../rack/module-contract.js';
import { setNestedValue } from '../utils/nested-access.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function parseEndpoint(endpoint, label) {
    if (typeof endpoint === 'string') {
        const separator = endpoint.lastIndexOf('.');
        if (separator <= 0 || separator === endpoint.length - 1) {
            throw new Error(`${label} endpoint "${endpoint}" must use "module.port"`);
        }
        return { module: endpoint.slice(0, separator), port: endpoint.slice(separator + 1) };
    }
    if (endpoint && typeof endpoint === 'object' && !Array.isArray(endpoint)) {
        if (typeof endpoint.module === 'string' && endpoint.module && typeof endpoint.port === 'string' && endpoint.port) {
            return { module: endpoint.module, port: endpoint.port };
        }
    }
    throw new Error(`${label} endpoint must be a "module.port" string or { module, port } object`);
}

function getControls(definition) {
    const ui = definition?.ui || {};
    return [
        ...(ui.knobs || []).map(control => ({ ...control, kind: 'knob' })),
        ...(ui.switches || []).map(control => ({ ...control, kind: 'switch' })),
        ...(ui.buttons || []).map(control => ({ ...control, kind: 'button' })),
        ...(ui.actions || []).map(control => ({ ...control, kind: 'action' })),
        ...(ui.state || []).map(control => ({ ...control, kind: 'state' }))
    ];
}

function collectWarnings(patch, registry) {
    const warnings = [];
    patch.modules.forEach(module => {
        const definition = registry.get(module.type);
        const controls = new Map(getControls(definition).map(control => [control.param, control]));
        Object.entries(patch.params[module.id] || {}).forEach(([param, value]) => {
            const control = controls.get(param);
            if (!control || typeof value !== 'number') return;
            if (Number.isFinite(control.min) && value < control.min || Number.isFinite(control.max) && value > control.max) {
                warnings.push(`${module.id}.${param}=${value} is outside ${control.min}..${control.max}`);
            }
            if (Array.isArray(control.positions) && !Number.isInteger(value) ||
                Array.isArray(control.positions) && (value < 0 || value >= control.positions.length)) {
                warnings.push(`${module.id}.${param}=${value} is not a declared switch position`);
            }
            if (Array.isArray(control.values) && !control.values.includes(value)) {
                warnings.push(`${module.id}.${param}=${value} is not one of ${control.values.join(', ')}`);
            }
            if (control.kind === 'action' && ['momentary', 'trigger'].includes(control.mode) && value !== 0) {
                warnings.push(`${module.id}.${param} is a ${control.mode} action and will be active when applied`);
            }
        });
    });
    if (!patch.modules.some(module => registry.get(module.type)?.role === 'audio-output')) {
        warnings.push('Patch has no audio-output module');
    }
    return warnings;
}

function validateMidiMappings(mappings, state, registry) {
    Object.entries(mappings || {}).forEach(([key, mapping]) => {
        if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
            throw new Error(`MIDI mapping "${key}" must be an object`);
        }
        if (!mapping.moduleId && !mapping.paramId) return;
        const module = state.getModule(mapping.moduleId);
        if (!module) throw new Error(`MIDI mapping "${key}" references missing module "${mapping.moduleId}"`);
        if (!getModuleParamPaths(registry.get(module.type)).has(mapping.paramId)) {
            throw new Error(`MIDI mapping "${key}" references unknown parameter "${mapping.moduleId}.${mapping.paramId}"`);
        }
    });
}

export function compilePatchDescription(description, {
    registry,
    sampleRate = 44100,
    blockSize = 512
} = {}) {
    if (!registry) throw new Error('Patch compilation requires a module registry');
    const declarations = description?.modules || [];
    const explicitRows = declarations.map(item => item.placement?.row).filter(Number.isInteger);
    const state = new RackState({ rowCount: Math.max(2, ...explicitRows, 0) });

    declarations.forEach(declaration => {
        const placement = declaration.placement || {};
        if (placement.row !== undefined && (!Number.isInteger(placement.row) || placement.row < 1)) {
            throw new Error(`Module "${declaration.id}" row must be a positive integer`);
        }
        if (placement.index !== undefined && (!Number.isInteger(placement.index) || placement.index < 0)) {
            throw new Error(`Module "${declaration.id}" index must be a non-negative integer`);
        }
        if (placement.row) state.ensureRowCount(placement.row);
        const definition = registry.get(declaration.type);
        if (!definition) throw new Error(`Module type "${declaration.type}" not found`);
        if (!placement.row && !state.findFirstFittingRow(definition, registry)) state.addRow();
        state.addModule(declaration.type, registry, {
            id: declaration.id,
            row: placement.row || null,
            index: placement.index ?? null,
            params: declaration.params || {}
        });
    });

    (description?.connections || []).forEach((connection, index) => {
        const from = parseEndpoint(connection.from, `Connection ${index + 1} source`);
        const to = parseEndpoint(connection.to, `Connection ${index + 1} destination`);
        if (state.hasInputConnection(to.module, to.port)) {
            throw new Error(`Input "${to.module}.${to.port}" has more than one source`);
        }
        const cable = state.connect({
            fromModule: from.module,
            fromPort: from.port,
            toModule: to.module,
            toPort: to.port
        }, { registry });
        if (!cable) throw new Error(`Connection ${index + 1} references a missing module`);
    });

    validateMidiMappings(description?.midiMappings || {}, state, registry);
    state.midiMappings = clone(description?.midiMappings || {});
    const patch = normalizePatch(state.serializePatch(registry), { registry });
    const runtimeModules = {};
    const created = [];
    let graph;

    try {
        patch.modules.forEach((module, rackOrder) => {
            const definition = registry.get(module.type);
            const instance = definition.createDSP({ sampleRate, bufferSize: blockSize, blockSize, audioCtx: null, services: {} });
            Object.entries(patch.params[module.id] || {}).forEach(([param, value]) => setNestedValue(instance.params, param, value));
            created.push(instance);
            runtimeModules[module.id] = {
                def: definition,
                instance,
                order: registry.getModuleOrder(module.type),
                rackOrder
            };
        });
        graph = compileGraph({ modules: runtimeModules, cables: patch.cables, blockSize });
    } finally {
        created.forEach(instance => instance.dispose?.());
    }

    return {
        patch,
        diagnostics: {
            moduleCount: patch.modules.length,
            cableCount: patch.cables.length,
            processOrder: [...graph.processOrder],
            feedbackRoutes: graph.routes
                .filter(route => route.delayedBuffer)
                .map(route => `${route.fromModule}.${route.fromPort} -> ${route.toModule}.${route.toPort}`),
            warnings: collectWarnings(patch, registry)
        }
    };
}
