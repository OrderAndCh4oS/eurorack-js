/**
 * Patch Serializer - Serialize and deserialize patch state
 *
 * Converts synth state to/from canonical v3 patch state.
 */
import { normalizePatch } from '../app/patch-format.js';

/**
 * Serialize knob values from DOM elements
 * @param {Document|HTMLElement} container - Container with knob elements
 * @returns {Object} Knob values keyed by module then param
 */
export function serializeKnobs(container = document) {
    const knobs = {};

    container.querySelectorAll('.knob').forEach(knob => {
        const moduleId = knob.dataset.module;
        const param = knob.dataset.param;
        const value = parseFloat(knob.dataset.value);

        if (!knobs[moduleId]) knobs[moduleId] = {};
        knobs[moduleId][param] = value;
    });

    return knobs;
}

/**
 * Serialize switch states from DOM elements
 * @param {Document|HTMLElement} container - Container with switch elements
 * @returns {Object} Switch states keyed by module then param
 */
export function serializeSwitches(container = document) {
    const switches = {};

    container.querySelectorAll('.switch').forEach(sw => {
        const moduleId = sw.dataset.module;
        const param = sw.dataset.param;
        const isOn = sw.classList.contains('on');

        if (!switches[moduleId]) switches[moduleId] = {};
        switches[moduleId][param] = isOn;
    });

    return switches;
}

/**
 * Serialize button bank states from DOM elements
 * @param {Document|HTMLElement} container - Container with button bank elements
 * @returns {Object} Button values keyed by module then param
 */
export function serializeButtons(container = document) {
    const buttons = {};

    container.querySelectorAll('.button-bank').forEach(bank => {
        const moduleId = bank.dataset.module;
        const param = bank.dataset.param;
        const activeBtn = bank.querySelector('.octave-btn.active');
        const value = activeBtn ? parseInt(activeBtn.dataset.value) : 0;

        if (!buttons[moduleId]) buttons[moduleId] = {};
        buttons[moduleId][param] = value;
    });

    return buttons;
}

function mergeParams(target, source, transform = value => value) {
    Object.entries(source || {}).forEach(([moduleId, params]) => {
        if (!target[moduleId]) target[moduleId] = {};
        Object.entries(params || {}).forEach(([param, value]) => {
            target[moduleId][param] = transform(value);
        });
    });
}

export function serializeParams(container = document) {
    const params = {};
    mergeParams(params, serializeKnobs(container));
    mergeParams(params, serializeSwitches(container), value => value ? 1 : 0);
    mergeParams(params, serializeButtons(container));
    return params;
}

/**
 * Serialize cable connections
 * @param {Array} cables - Array of cable objects from cable manager
 * @returns {Array} Serialized cable connections
 */
export function serializeCables(cables) {
    return cables.map(cable => ({
        fromModule: cable.fromModule,
        fromPort: cable.fromPort,
        toModule: cable.toModule,
        toPort: cable.toPort
    }));
}

export function serializeModules(container = document, params = serializeParams(container)) {
    const seen = new Set();
    const modules = [];

    container.querySelectorAll('[data-module][data-type], [data-instance-id][data-type]').forEach(element => {
        const id = element.dataset.module || element.dataset.instanceId;
        const type = element.dataset.type;
        if (!id || !type || seen.has(id)) return;
        seen.add(id);
        modules.push({
            id,
            type,
            row: parseInt(element.dataset.row || '1', 10),
            index: parseInt(element.dataset.index || String(modules.length), 10)
        });
    });

    Object.keys(params).forEach(moduleId => {
        if (seen.has(moduleId)) return;
        seen.add(moduleId);
        modules.push({ id: moduleId, type: moduleId, row: 1, index: modules.length });
    });

    return modules;
}

/**
 * Serialize complete patch state
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Array} options.cables - Cable connections
 * @returns {Object} Complete patch state
 */
export function serializePatchState({
    container = document,
    cables = [],
    modules = null,
    midiMappings = {},
    plugins = { core: 1 }
} = {}) {
    const params = serializeParams(container);
    return {
        version: 3,
        plugins: { ...plugins },
        modules: modules || serializeModules(container, params),
        params,
        cables: serializeCables(cables),
        midiMappings: { ...midiMappings }
    };
}

/**
 * Create a named patch object
 * @param {string} name - Patch name
 * @param {Object} state - Patch state
 * @param {boolean} factory - Whether this is a factory patch
 * @returns {Object} Patch object
 */
export function createPatch(name, state, factory = false) {
    return {
        name,
        factory,
        created: new Date().toISOString(),
        state: normalizePatch(state)
    };
}

/**
 * Validate a patch state object
 * @param {Object} state - State to validate
 * @returns {boolean} True if valid
 */
export function isValidPatchState(state) {
    try {
        normalizePatch(state);
        return true;
    } catch {
        return false;
    }
}
