/**
 * Module Renderer - Creates DOM elements for synth modules
 *
 * Generates HTML for module panels including knobs, switches,
 * buttons, jacks, and LEDs based on module definitions.
 */

import { adjustColor } from '../utils/color.js';

/**
 * Render a module panel as a DOM element
 * @param {string} type - Module type key
 * @param {string} id - Unique module instance ID
 * @param {Object} moduleDef - Module definition object
 * @returns {HTMLElement} Module panel element
 */
export function renderModule(type, id, moduleDef) {
    const def = moduleDef;
    const el = document.createElement('div');
    el.className = `module module-${def.hp}hp`;
    el.id = `module-${id}`;
    el.style.background = `linear-gradient(to bottom, ${def.color}, ${adjustColor(def.color, -30)})`;

    let html = `<div class="module-label">${def.name}</div><div class="module-content">`;

    // LEDs
    if (def.leds) {
        html += '<div class="jack-row">';
        def.leds.forEach(led => {
            html += `<div class="led green" id="led-${id}-${led}"></div>`;
        });
        html += '</div>';
    }

    // Knobs - render in a row if more than 2
    if (def.knobs && def.knobs.length > 0) {
        if (def.knobs.length > 2) {
            html += '<div class="jack-row">';
        }
        def.knobs.forEach(knob => {
            html += `
                <div class="knob-container">
                    <div class="knob" id="knob-${id}-${knob.id}"
                         data-module="${id}" data-param="${knob.param}"
                         data-min="${knob.min}" data-max="${knob.max}"
                         data-value="${knob.default}" data-step="${knob.step || 0}"></div>
                    <div class="knob-label">${knob.label}</div>
                </div>`;
        });
        if (def.knobs.length > 2) {
            html += '</div>';
        }
    }

    // Switches - render in a row
    if (def.switches && def.switches.length > 0) {
        html += '<div class="jack-row">';
        def.switches.forEach(sw => {
            html += `
                <div class="knob-container">
                    <div class="switch ${sw.default ? 'on' : ''}" id="switch-${id}-${sw.id}"
                         data-module="${id}" data-param="${sw.param}"></div>
                    <div class="knob-label">${sw.label}</div>
                </div>`;
        });
        html += '</div>';
    }

    // Button banks (octave select)
    if (def.buttons && def.buttons.length > 0) {
        def.buttons.forEach(btnGroup => {
            html += `<div class="section-label">${btnGroup.label}</div><div class="button-bank" data-module="${id}" data-param="${btnGroup.param}">`;
            btnGroup.values.forEach((val) => {
                const isActive = val === btnGroup.default;
                html += `<button class="octave-btn${isActive ? ' active' : ''}" data-value="${val}">${val > 0 ? '+' + val : val}</button>`;
            });
            html += '</div>';
        });
    }

    html += '<div class="spacer"></div>';

    // Outputs
    if (def.outputs && def.outputs.length > 0) {
        html += '<div class="section-label">Out</div><div class="jack-row">';
        def.outputs.forEach(out => {
            html += `
                <div class="jack-container">
                    <div class="jack output" id="jack-${id}-${out.id}"
                         data-module="${id}" data-port="${out.output}" data-dir="output" data-type="${out.type}"></div>
                    <div class="jack-label">${out.label}</div>
                </div>`;
        });
        html += '</div>';
    }

    // Inputs - group by type for larger modules
    if (def.inputs && def.inputs.length > 0) {
        html += renderInputs(def.inputs, id);
    }

    html += '</div>';
    el.innerHTML = html;
    return el;
}

/**
 * Render input jacks, grouping by type for larger modules
 * @param {Array} inputs - Input definitions
 * @param {string} id - Module ID
 * @returns {string} HTML string
 */
function renderInputs(inputs, id) {
    let html = '';

    if (inputs.length > 4) {
        // Split inputs into groups (CV and triggers)
        const cvInputs = inputs.filter(i => i.id.startsWith('cv'));
        const trigInputs = inputs.filter(i => i.id.startsWith('trig'));
        const otherInputs = inputs.filter(i => !i.id.startsWith('cv') && !i.id.startsWith('trig'));

        if (cvInputs.length > 0) {
            html += '<div class="section-label">CV In</div><div class="jack-row">';
            html += renderJackGroup(cvInputs, id);
            html += '</div>';
        }
        if (trigInputs.length > 0) {
            html += '<div class="section-label">Trig In</div><div class="jack-row">';
            html += renderJackGroup(trigInputs, id);
            html += '</div>';
        }
        if (otherInputs.length > 0) {
            html += '<div class="section-label">In</div><div class="jack-row">';
            html += renderJackGroup(otherInputs, id);
            html += '</div>';
        }
    } else {
        html += '<div class="section-label">In</div><div class="jack-row">';
        html += renderJackGroup(inputs, id);
        html += '</div>';
    }

    return html;
}

/**
 * Render a group of input jacks
 * @param {Array} inputs - Input definitions
 * @param {string} id - Module ID
 * @returns {string} HTML string
 */
function renderJackGroup(inputs, id) {
    return inputs.map(inp => `
        <div class="jack-container">
            <div class="jack input" id="jack-${id}-${inp.id}"
                 data-module="${id}" data-port="${inp.input}" data-dir="input" data-type="${inp.type}"></div>
            <div class="jack-label">${inp.label}</div>
        </div>`
    ).join('');
}

/**
 * Update a knob element's visual rotation
 * @param {HTMLElement} knobEl - Knob DOM element
 */
export function updateKnobRotation(knobEl) {
    const min = parseFloat(knobEl.dataset.min);
    const max = parseFloat(knobEl.dataset.max);
    const value = parseFloat(knobEl.dataset.value);
    const rotation = -135 + ((value - min) / (max - min)) * 270;
    knobEl.style.transform = `rotate(${rotation}deg)`;
}

/**
 * Update LED element state
 * @param {string} moduleId - Module ID
 * @param {string} ledId - LED identifier
 * @param {boolean} active - Whether LED should be active
 */
export function updateLed(moduleId, ledId, active) {
    const ledEl = document.getElementById(`led-${moduleId}-${ledId}`);
    if (ledEl) {
        ledEl.classList.toggle('active', active);
    }
}

/**
 * Update all LEDs for a module based on LED states
 * @param {string} moduleId - Module ID
 * @param {Object} ledStates - Object mapping LED IDs to values
 * @param {Object} thresholds - Optional thresholds for each LED (default 0.1)
 */
export function updateModuleLeds(moduleId, ledStates, thresholds = {}) {
    Object.entries(ledStates).forEach(([ledId, value]) => {
        const threshold = thresholds[ledId] || 0.1;
        updateLed(moduleId, ledId, value > threshold);
    });
}
