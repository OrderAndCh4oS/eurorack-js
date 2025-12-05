/**
 * Patch Serializer - Serialize and deserialize patch state
 *
 * Converts synth state (knobs, switches, buttons, cables) to/from
 * a serializable format for saving and loading patches.
 */

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

/**
 * Serialize complete patch state
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Array} options.cables - Cable connections
 * @returns {Object} Complete patch state
 */
export function serializePatchState({ container = document, cables = [] } = {}) {
    return {
        knobs: serializeKnobs(container),
        switches: serializeSwitches(container),
        buttons: serializeButtons(container),
        cables: serializeCables(cables)
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
        state
    };
}

/**
 * Validate a patch state object
 * @param {Object} state - State to validate
 * @returns {boolean} True if valid
 */
export function isValidPatchState(state) {
    if (!state || typeof state !== 'object') return false;

    // Must have at least knobs and cables
    if (!state.knobs || typeof state.knobs !== 'object') return false;
    if (!state.cables || !Array.isArray(state.cables)) return false;

    // Validate cables have required fields
    for (const cable of state.cables) {
        if (!cable.fromModule || !cable.fromPort) return false;
        if (!cable.toModule || !cable.toPort) return false;
    }

    return true;
}
