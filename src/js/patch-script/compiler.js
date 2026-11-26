import { compileGraph } from '../audio/graph.js';
import { normalizePatch } from '../app/patch-format.js';
import { RackState } from '../app/rack-state.js';
import { PATCH_LIMITS } from '../patches/limits.js';
import { getControlDomain } from '../rack/control-domain.js';
import { analyseRackConnections } from '../rack/diagnostics.js';
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

function collectWarnings(patch, registry) {
    const warnings = [];
    patch.modules.forEach(module => {
        const definition = registry.get(module.type);
        (definition.ui.actions || []).forEach(control => {
            if (['momentary', 'trigger'].includes(control.mode) && patch.params[module.id]?.[control.param] === 1) {
                warnings.push(`${module.id}.${control.param} is a ${control.mode} action and will return to idle when applied`);
            }
        });
    });
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
        if (!getControlDomain(registry.get(module.type), mapping.paramId)) {
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
        const row = placement.row ?? state.findFirstFittingRow(definition, registry, declaration.params) ?? state.addRow();
        if (row > PATCH_LIMITS.rows) {
            throw Object.assign(new Error(`The patch must fit within ${PATCH_LIMITS.rows} rows.`), {code: 'patch-limit'});
        }
        state.addModule(declaration.type, registry, {
            id: declaration.id,
            row,
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
            if (definition.role === 'spacer') return;
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

    const connections = analyseRackConnections(patch, registry);
    return {
        patch,
        diagnostics: {
            ...connections,
            processOrder: [...graph.processOrder],
            feedbackRoutes: graph.routes
                .filter(route => route.delayedBuffer)
                .map(route => `${route.fromModule}.${route.fromPort} -> ${route.toModule}.${route.toPort}`),
            warnings: [
                ...collectWarnings(patch, registry),
                ...connections.issues.map(issue => issue.moduleIds.length
                    ? `${issue.moduleIds.join(', ')}: ${issue.message}`
                    : issue.message)
            ]
        }
    };
}
