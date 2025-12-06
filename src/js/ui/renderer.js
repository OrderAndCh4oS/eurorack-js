/**
 * Module Renderer
 *
 * Unified renderer that supports both declarative UI definitions
 * and custom render functions.
 */

import { createModuleToolkit } from './toolkit/index.js';
import {
    createKnob,
    createJack,
    createSwitch,
    createLED,
    createButtonBank,
    updateLED
} from './toolkit/components.js';
import {
    createRow,
    createSection,
    createSpacer,
    createContent,
    createModuleLabel,
    createPanel,
    groupInRow
} from './toolkit/layout.js';

/**
 * Render a module to DOM
 * @param {Object} definition - Module definition
 * @param {string} moduleId - Instance ID for this module
 * @param {Object} context - Rendering context
 * @param {Object} context.dsp - DSP instance
 * @param {Function} context.onParamChange - Callback for parameter changes
 * @returns {HTMLElement} Rendered module element
 */
export function renderModule(definition, moduleId, context) {
    const toolkit = createModuleToolkit();

    // Create module panel
    const panel = createPanel({
        id: moduleId,
        hp: definition.hp,
        color: definition.color
    });

    // Add module label
    panel.appendChild(createModuleLabel(definition.name));

    // Create content container
    const content = createContent();

    if (definition.render) {
        // Custom render mode - pass control to module's render function
        definition.render(content, {
            instance: {
                id: moduleId,
                type: definition.id,
                def: definition,
                dsp: context.dsp,
                element: panel
            },
            toolkit,
            onParamChange: (param, value) => {
                context.dsp.params[param] = value;
                context.onParamChange?.(moduleId, param, value);
            }
        });
    } else if (definition.ui) {
        // Declarative mode - render from UI definition
        renderDeclarativeUI(content, definition.ui, moduleId, context, toolkit);
    }

    panel.appendChild(content);

    return panel;
}

/**
 * Render declarative UI definition
 * @param {HTMLElement} container - Content container
 * @param {Object} ui - UI definition
 * @param {string} moduleId - Module ID
 * @param {Object} context - Rendering context
 * @param {Object} toolkit - Toolkit instance
 */
function renderDeclarativeUI(container, ui, moduleId, context, toolkit) {
    const { dsp, onParamChange } = context;

    // LEDs at top
    if (ui.leds?.length) {
        const ledRow = createRow();
        ui.leds.forEach(ledId => {
            ledRow.appendChild(createLED({
                id: ledId,
                moduleId,
                color: 'green'
            }));
        });
        container.appendChild(ledRow);
    }

    // Knobs - row if more than 2
    if (ui.knobs?.length) {
        const needsRow = ui.knobs.length > 2;
        const knobContainer = needsRow ? createRow() : container;

        ui.knobs.forEach(knobDef => {
            const knobEl = createKnob({
                id: knobDef.id,
                label: knobDef.label,
                moduleId,
                value: knobDef.default,
                min: knobDef.min,
                max: knobDef.max,
                step: knobDef.step || 0,
                onChange: (value) => {
                    dsp.params[knobDef.param] = value;
                    onParamChange?.(moduleId, knobDef.param, value);
                }
            });
            knobContainer.appendChild(knobEl);
        });

        if (needsRow) {
            container.appendChild(knobContainer);
        }
    }

    // Switches - in a row
    if (ui.switches?.length) {
        const switchRow = createRow();
        ui.switches.forEach(swDef => {
            const swEl = createSwitch({
                id: swDef.id,
                label: swDef.label,
                moduleId,
                value: swDef.default || 0,
                onChange: (value) => {
                    dsp.params[swDef.param] = value;
                    onParamChange?.(moduleId, swDef.param, value);
                }
            });
            switchRow.appendChild(swEl);
        });
        container.appendChild(switchRow);
    }

    // Button banks
    if (ui.buttons?.length) {
        ui.buttons.forEach(btnDef => {
            const bankEl = createButtonBank({
                id: btnDef.id,
                label: btnDef.label,
                moduleId,
                values: btnDef.values,
                defaultValue: btnDef.default,
                onChange: (value) => {
                    dsp.params[btnDef.param] = value;
                    onParamChange?.(moduleId, btnDef.param, value);
                }
            });
            container.appendChild(bankEl);
        });
    }

    // Spacer
    container.appendChild(createSpacer());

    // Outputs
    if (ui.outputs?.length) {
        container.appendChild(createSection('Out'));
        const outRow = createRow();
        ui.outputs.forEach(outDef => {
            outRow.appendChild(createJack({
                id: outDef.port,
                label: outDef.label,
                moduleId,
                direction: 'output',
                type: outDef.type || 'buffer'
            }));
        });
        container.appendChild(outRow);
    }

    // Inputs - group by type for larger modules
    if (ui.inputs?.length) {
        if (ui.inputs.length > 4) {
            // Group inputs by type prefix
            const cvInputs = ui.inputs.filter(i => i.id.startsWith('cv') || i.type === 'cv');
            const trigInputs = ui.inputs.filter(i => i.id.startsWith('trig') || i.type === 'trigger');
            const otherInputs = ui.inputs.filter(i =>
                !i.id.startsWith('cv') && !i.id.startsWith('trig') &&
                i.type !== 'cv' && i.type !== 'trigger'
            );

            if (cvInputs.length > 0) {
                container.appendChild(createSection('CV In'));
                const cvRow = createRow();
                cvInputs.forEach(inDef => {
                    cvRow.appendChild(createJack({
                        id: inDef.port,
                        label: inDef.label,
                        moduleId,
                        direction: 'input',
                        type: inDef.type || 'cv'
                    }));
                });
                container.appendChild(cvRow);
            }

            if (trigInputs.length > 0) {
                container.appendChild(createSection('Trig In'));
                const trigRow = createRow();
                trigInputs.forEach(inDef => {
                    trigRow.appendChild(createJack({
                        id: inDef.port,
                        label: inDef.label,
                        moduleId,
                        direction: 'input',
                        type: inDef.type || 'trigger'
                    }));
                });
                container.appendChild(trigRow);
            }

            if (otherInputs.length > 0) {
                container.appendChild(createSection('In'));
                const otherRow = createRow();
                otherInputs.forEach(inDef => {
                    otherRow.appendChild(createJack({
                        id: inDef.port,
                        label: inDef.label,
                        moduleId,
                        direction: 'input',
                        type: inDef.type || 'buffer'
                    }));
                });
                container.appendChild(otherRow);
            }
        } else {
            // Simple single row for inputs
            container.appendChild(createSection('In'));
            const inRow = createRow();
            ui.inputs.forEach(inDef => {
                inRow.appendChild(createJack({
                    id: inDef.port,
                    label: inDef.label,
                    moduleId,
                    direction: 'input',
                    type: inDef.type || 'buffer'
                }));
            });
            container.appendChild(inRow);
        }
    }
}

/**
 * Update all LEDs for a module based on DSP state
 * @param {string} moduleId - Module ID
 * @param {Object} leds - LED state object from DSP
 * @param {Object} thresholds - Optional threshold overrides per LED
 */
export function updateModuleLEDs(moduleId, leds, thresholds = {}) {
    Object.entries(leds).forEach(([ledId, value]) => {
        const ledEl = document.getElementById(`led-${moduleId}-${ledId}`);
        if (ledEl) {
            const threshold = thresholds[ledId] || 0.1;
            updateLED(ledEl, value, threshold);
        }
    });
}

/**
 * Apply parameter values to module UI (e.g., when loading a patch)
 * @param {string} moduleId - Module ID
 * @param {Object} params - Parameter values to apply
 */
export function applyParamsToUI(moduleId, params) {
    Object.entries(params).forEach(([param, value]) => {
        // Try to find a knob
        const knob = document.querySelector(`#knob-${moduleId}-${param}, .knob[data-module="${moduleId}"][data-param="${param}"]`);
        if (knob) {
            knob.dataset.value = value;
            // Trigger rotation update
            import('./toolkit/components.js').then(({ updateKnobRotation }) => {
                updateKnobRotation(knob);
            });
            return;
        }

        // Try to find a switch
        const sw = document.querySelector(`#switch-${moduleId}-${param}, .switch[data-module="${moduleId}"][data-param="${param}"]`);
        if (sw) {
            sw.classList.toggle('on', !!value);
            return;
        }

        // Try to find a button bank
        const bank = document.querySelector(`.button-bank[data-module="${moduleId}"][data-param="${param}"]`);
        if (bank) {
            bank.querySelectorAll('.octave-btn').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.value) === value);
            });
        }
    });
}
