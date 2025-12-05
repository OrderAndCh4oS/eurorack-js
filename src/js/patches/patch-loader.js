/**
 * Patch Loader - Load and apply patch state to the synth
 *
 * Applies saved patch state to UI elements and module instances.
 */

import { updateKnobRotation } from '../ui/module-renderer.js';

/**
 * Apply knob values to DOM and module instances
 * @param {Object} knobs - Knob values keyed by module then param
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Object} options.modules - Module instances keyed by ID
 */
export function applyKnobs(knobs, { container = document, modules = {} } = {}) {
    if (!knobs) return;

    Object.entries(knobs).forEach(([moduleId, params]) => {
        Object.entries(params).forEach(([param, value]) => {
            const knob = container.querySelector(
                `.knob[data-module="${moduleId}"][data-param="${param}"]`
            );

            if (knob) {
                knob.dataset.value = value;
                updateKnobRotation(knob);
            }

            // Update module instance param
            if (modules[moduleId]?.instance) {
                modules[moduleId].instance.params[param] = value;
            }
        });
    });
}

/**
 * Apply switch states to DOM and module instances
 * @param {Object} switches - Switch states keyed by module then param
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Object} options.modules - Module instances keyed by ID
 */
export function applySwitches(switches, { container = document, modules = {} } = {}) {
    if (!switches) return;

    Object.entries(switches).forEach(([moduleId, params]) => {
        Object.entries(params).forEach(([param, isOn]) => {
            const sw = container.querySelector(
                `.switch[data-module="${moduleId}"][data-param="${param}"]`
            );

            if (sw) {
                sw.classList.toggle('on', isOn);
            }

            // Update module instance param
            if (modules[moduleId]?.instance) {
                if (param.includes('[')) {
                    // Array param like "continuous[0]"
                    const match = param.match(/(\w+)\[(\d+)\]/);
                    if (match) {
                        const [, arrayName, index] = match;
                        modules[moduleId].instance.params[arrayName][parseInt(index)] = isOn;
                    }
                } else {
                    modules[moduleId].instance.params[param] = isOn ? 1 : 0;
                }
            }
        });
    });
}

/**
 * Apply button bank states to DOM and module instances
 * @param {Object} buttons - Button values keyed by module then param
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Object} options.modules - Module instances keyed by ID
 */
export function applyButtons(buttons, { container = document, modules = {} } = {}) {
    if (!buttons) return;

    Object.entries(buttons).forEach(([moduleId, params]) => {
        Object.entries(params).forEach(([param, value]) => {
            const bank = container.querySelector(
                `.button-bank[data-module="${moduleId}"][data-param="${param}"]`
            );

            if (bank) {
                bank.querySelectorAll('.octave-btn').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.value) === value);
                });
            }

            // Update module instance param
            if (modules[moduleId]?.instance) {
                modules[moduleId].instance.params[param] = value;
            }
        });
    });
}

/**
 * Apply cable connections
 * @param {Array} cables - Serialized cable connections
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Function} options.addCable - Function to add a cable (fromJack, toJack) -> cable
 * @returns {Array} Created cables
 */
export function applyCables(cables, { container = document, addCable } = {}) {
    if (!cables || !addCable) return [];

    const created = [];

    cables.forEach(conn => {
        const fromJack = container.querySelector(
            `.jack[data-module="${conn.fromModule}"][data-port="${conn.fromPort}"]`
        );
        const toJack = container.querySelector(
            `.jack[data-module="${conn.toModule}"][data-port="${conn.toPort}"]`
        );

        if (fromJack && toJack) {
            const cable = addCable(fromJack, toJack);
            if (cable) created.push(cable);
        }
    });

    return created;
}

/**
 * Apply complete patch state
 * @param {Object} state - Patch state object
 * @param {Object} options
 * @param {Document|HTMLElement} options.container - DOM container
 * @param {Object} options.modules - Module instances keyed by ID
 * @param {Function} options.clearCables - Function to clear existing cables
 * @param {Function} options.addCable - Function to add a cable
 * @returns {Object} Applied state info
 */
export function applyPatchState(state, {
    container = document,
    modules = {},
    clearCables = () => {},
    addCable = () => null
} = {}) {
    // Clear existing cables first
    clearCables();

    // Apply state in order
    applyKnobs(state.knobs, { container, modules });
    applySwitches(state.switches, { container, modules });
    applyButtons(state.buttons, { container, modules });
    const cables = applyCables(state.cables, { container, addCable });

    return {
        knobsApplied: state.knobs ? Object.keys(state.knobs).length : 0,
        switchesApplied: state.switches ? Object.keys(state.switches).length : 0,
        buttonsApplied: state.buttons ? Object.keys(state.buttons).length : 0,
        cablesCreated: cables.length
    };
}
