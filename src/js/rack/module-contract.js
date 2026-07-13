import { getNestedValue } from '../utils/nested-access.js';

export const SIGNAL_TYPES = Object.freeze(['audio', 'cv', 'gate', 'trigger', 'any']);

const DEFAULT_VOLTAGE = Object.freeze({
    audio: Object.freeze({ min: -5, max: 5, normal: 0 }),
    cv: Object.freeze({ min: -5, max: 5, normal: 0 }),
    gate: Object.freeze({ min: 0, max: 10, normal: 0 }),
    trigger: Object.freeze({ min: 0, max: 10, normal: 0 }),
    any: Object.freeze({ min: -10, max: 10, normal: 0 })
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertUnique(items, getKey, label, moduleId) {
    const seen = new Set();
    items.forEach((item, index) => {
        const key = getKey(item);
        assert(key, `Module "${moduleId}" ${label}[${index}] is missing ${label === 'LED' ? 'an id' : 'id/param/port'}`);
        assert(!seen.has(key), `Module "${moduleId}" has duplicate ${label.toLowerCase()} "${key}"`);
        seen.add(key);
    });
}

export function normalizePortDefinition(port, direction) {
    const signal = port.signal || (port.type === 'buffer' ? 'any' : port.type);
    const defaults = DEFAULT_VOLTAGE[signal];
    const voltage = {
        min: port.voltage?.min ?? defaults?.min,
        max: port.voltage?.max ?? defaults?.max
    };

    if (direction === 'input') {
        voltage.normal = port.voltage?.normal ?? defaults?.normal;
    }

    return {
        ...port,
        signal,
        voltage
    };
}

export function getModulePorts(definition, direction) {
    const ports = direction === 'input' ? definition.ui?.inputs : definition.ui?.outputs;
    return (ports || []).map(port => normalizePortDefinition(port, direction));
}

export function getModulePort(definition, direction, portName) {
    return getModulePorts(definition, direction).find(port => port.port === portName) || null;
}

export function getModuleParamPaths(definition) {
    const ui = definition.ui || {};
    return new Set([
        ...(ui.knobs || []),
        ...(ui.switches || []),
        ...(ui.buttons || []),
        ...(ui.actions || []),
        ...(ui.state || [])
    ].map(control => control.param));
}

function hasOnlyFiniteLeaves(value) {
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(hasOnlyFiniteLeaves);
    if (value && typeof value === 'object') return Object.values(value).every(hasOnlyFiniteLeaves);
    return true;
}

export function assertModuleParam(definition, param, value) {
    const moduleId = definition?.id || 'unknown';
    assert(getModuleParamPaths(definition).has(param), `Module "${moduleId}" has no parameter "${param}"`);
    assert(hasOnlyFiniteLeaves(value), `Module "${moduleId}" parameter "${param}" contains a non-finite value`);
}

export function validateModuleDefinition(definition, {
    sampleRate = 44100,
    blockSize = 512,
    instantiate = true
} = {}) {
    assert(definition && typeof definition === 'object', 'Module definition must be an object');
    const moduleId = definition.id || 'unknown';
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id), `Module "${moduleId}" has an invalid id`);
    assert(typeof definition.name === 'string' && definition.name.trim(), `Module "${moduleId}" has an invalid name`);
    assert(typeof definition.createDSP === 'function', `Module "${moduleId}" createDSP must be a function`);
    assert(definition.ui && typeof definition.ui === 'object', `Module "${moduleId}" must declare a ui contract`);
    if (definition.render) {
        assert(definition.telemetry && typeof definition.telemetry === 'object',
            `Custom-rendered module "${moduleId}" must declare a telemetry contract`);
    }

    if (definition.telemetry !== undefined) {
        assert(definition.telemetry && typeof definition.telemetry === 'object', `Module "${moduleId}" has an invalid telemetry contract`);
        assert(Array.isArray(definition.telemetry.fields || []), `Module "${moduleId}" telemetry.fields must be an array`);
        assert(Array.isArray(definition.telemetry.methods || []), `Module "${moduleId}" telemetry.methods must be an array`);
        if (definition.telemetry.history) {
            assert(typeof definition.telemetry.history.field === 'string', `Module "${moduleId}" telemetry history is missing a field`);
            assert(Number.isInteger(definition.telemetry.history.maxEntries) && definition.telemetry.history.maxEntries > 0,
                `Module "${moduleId}" telemetry history has an invalid maxEntries`);
        }
    }

    const ui = definition.ui;
    const controls = [
        ...(ui.knobs || []),
        ...(ui.switches || []),
        ...(ui.buttons || []),
        ...(ui.actions || [])
    ];
    const state = ui.state || [];
    const parameters = [...controls, ...state];
    assertUnique(parameters, control => control.param, 'control parameter', moduleId);
    assertUnique(ui.inputs || [], port => port.port, 'input port', moduleId);
    assertUnique(ui.outputs || [], port => port.port, 'output port', moduleId);
    assertUnique((ui.leds || []).map(id => ({ id })), led => led.id, 'LED', moduleId);

    const inputs = getModulePorts(definition, 'input');
    const outputs = getModulePorts(definition, 'output');
    [...inputs, ...outputs].forEach(port => {
        assert(port.id, `Module "${moduleId}" port "${port.port || 'unknown'}" is missing id`);
        assert(port.port, `Module "${moduleId}" port "${port.id}" is missing port`);
        assert(SIGNAL_TYPES.includes(port.signal), `Module "${moduleId}" port "${port.port}" has invalid signal: ${port.signal}`);
        assert(Number.isFinite(port.voltage.min) && Number.isFinite(port.voltage.max), `Module "${moduleId}" port "${port.port}" has invalid voltage range`);
        assert(port.voltage.min <= port.voltage.max, `Module "${moduleId}" port "${port.port}" has reversed voltage range`);
        if ('normal' in port.voltage) {
            assert(Number.isFinite(port.voltage.normal), `Module "${moduleId}" input "${port.port}" has invalid normal voltage`);
        }
    });

    if (!instantiate) return definition;

    const dsp = definition.createDSP({ sampleRate, bufferSize: blockSize, blockSize, audioCtx: null });
    assert(dsp && typeof dsp === 'object', `Module "${moduleId}" createDSP must return an object`);
    assert(dsp.params && typeof dsp.params === 'object', `Module "${moduleId}" DSP is missing params`);
    assert(dsp.inputs && typeof dsp.inputs === 'object', `Module "${moduleId}" DSP is missing inputs`);
    assert(dsp.outputs && typeof dsp.outputs === 'object', `Module "${moduleId}" DSP is missing outputs`);
    assert(typeof dsp.process === 'function', `Module "${moduleId}" DSP is missing process()`);

    (definition.telemetry?.fields || []).forEach(field => {
        assert(dsp[field] !== undefined, `Module "${moduleId}" telemetry field "${field}" is missing from its DSP`);
    });
    (definition.telemetry?.methods || []).forEach(method => {
        assert(typeof dsp[method] === 'function', `Module "${moduleId}" telemetry method "${method}" is missing from its DSP`);
    });
    if (definition.telemetry?.history) {
        const history = dsp[definition.telemetry.history.field];
        assert(Array.isArray(history), `Module "${moduleId}" telemetry history must be an array`);
    }

    parameters.forEach(control => {
        assert(getNestedValue(dsp.params, control.param) !== undefined, `Module "${moduleId}" is missing params.${control.param}`);
    });
    inputs.forEach(port => {
        const value = getNestedValue(dsp.inputs, port.port);
        assert(value instanceof Float32Array, `Module "${moduleId}" input "${port.port}" must be a Float32Array`);
        assert(value.length === blockSize, `Module "${moduleId}" input "${port.port}" has length ${value.length}; expected ${blockSize}`);
    });
    outputs.forEach(port => {
        const value = getNestedValue(dsp.outputs, port.port);
        assert(value instanceof Float32Array, `Module "${moduleId}" output "${port.port}" must be a Float32Array`);
        assert(value.length === blockSize, `Module "${moduleId}" output "${port.port}" has length ${value.length}; expected ${blockSize}`);
    });

    dsp.dispose?.();
    return definition;
}
