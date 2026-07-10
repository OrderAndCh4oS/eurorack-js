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
    createActionButton,
    updateKnobRotation,
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

const injectedModuleCSS = new Set();
const CLEANUPS_KEY = '__eurorackCleanups';
const PARAM_CONTROLS_KEY = '__eurorackParamControls';

export function injectModuleCSS(moduleType, css) {
    if (!css || injectedModuleCSS.has(moduleType)) return;
    const style = document.createElement('style');
    style.id = `module-css-${moduleType}`;
    style.textContent = css;
    document.head.appendChild(style);
    injectedModuleCSS.add(moduleType);
}

function createBoundToolkit(moduleId, onParamChange, onCleanup, registerParamControl) {
    const toolkit = createModuleToolkit();
    return {
        ...toolkit,
        createKnob(options) {
            const param = options.param || options.id;
            return toolkit.createKnob({
                ...options,
                moduleId,
                param,
                onChange: options.onChange || ((value) => onParamChange?.(param, value))
            });
        },
        createSwitch(options) {
            const param = options.param || options.id;
            return toolkit.createSwitch({
                ...options,
                moduleId,
                param,
                onChange: options.onChange || ((value) => onParamChange?.(param, value))
            });
        },
        createJack(options) {
            return toolkit.createJack({ ...options, moduleId });
        },
        createLED(options) {
            return toolkit.createLED({ ...options, moduleId });
        },
        createButtonBank(options) {
            const param = options.param || options.id;
            return toolkit.createButtonBank({
                ...options,
                moduleId,
                param,
                onChange: options.onChange || ((value) => onParamChange?.(param, value))
            });
        },
        createActionButton(options) {
            const param = options.param || options.id;
            return toolkit.createActionButton({
                ...options,
                moduleId,
                param,
                onChange: options.onChange || ((value) => onParamChange?.(param, value))
            });
        },
        registerParamControl(param, element, sync) {
            if (element) {
                element.dataset.module = element.dataset.module || moduleId;
                element.dataset.param = element.dataset.param || param;
            }
            registerParamControl?.(param, element, sync);
            return element;
        },
        animate(draw) {
            let frameId = null;
            let running = true;
            const tick = () => {
                if (!running) return;
                draw();
                frameId = requestAnimationFrame(tick);
            };

            frameId = requestAnimationFrame(tick);

            const stop = () => {
                running = false;
                if (frameId !== null) cancelAnimationFrame(frameId);
                frameId = null;
            };

            onCleanup?.(stop);
            return stop;
        }
    };
}

export function cleanupRenderedModule(panel) {
    const cleanups = panel?.[CLEANUPS_KEY] || [];
    while (cleanups.length) {
        const cleanup = cleanups.pop();
        cleanup?.();
    }
}

function syncParamElement(element, value) {
    const knob = element.matches?.('.knob') ? element : element.querySelector?.('.knob');
    if (knob) {
        knob.dataset.value = value;
        updateKnobRotation(knob);
    }

    const sw = element.matches?.('.switch') ? element : element.querySelector?.('.switch');
    if (sw) {
        sw.classList.toggle('on', value === 1 || value === true);
    }

    const bank = element.matches?.('.button-bank') ? element : element.querySelector?.('.button-bank');
    if (bank) {
        bank.querySelectorAll('.octave-btn').forEach(btn => {
            btn.classList.toggle('active', Number(btn.dataset.value) === value);
        });
    }

    const toggle = element.matches?.('.toggle-btn, .action-btn') ? element : element.querySelector?.('.toggle-btn, .action-btn');
    if (toggle) {
        toggle.classList.toggle('active', value === 1 || value === true);
    }
}

export function syncParamToModuleUI(panel, moduleId, param, value) {
    const controls = panel?.[PARAM_CONTROLS_KEY]?.get(param) || [];
    controls.forEach(({ element, sync }) => {
        if (sync) sync(value, element);
        else if (element) syncParamElement(element, value);
    });

    const knob = panel?.querySelector?.(`.knob[data-module="${moduleId}"][data-param="${param}"]`);
    if (knob) {
        knob.dataset.value = value;
        updateKnobRotation(knob);
    }
    const sw = panel?.querySelector?.(`.switch[data-module="${moduleId}"][data-param="${param}"]`);
    if (sw) sw.classList.toggle('on', value === 1 || value === true);
    const bank = panel?.querySelector?.(`.button-bank[data-module="${moduleId}"][data-param="${param}"]`);
    if (bank) {
        bank.querySelectorAll('.octave-btn').forEach(btn => {
            btn.classList.toggle('active', Number(btn.dataset.value) === value);
        });
    }
    const toggle = panel?.querySelector?.(`.toggle-btn[data-module="${moduleId}"][data-param="${param}"], .action-btn[data-module="${moduleId}"][data-param="${param}"]`);
    if (toggle) toggle.classList.toggle('active', value === 1 || value === true);
}

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
    const handleParamChange = (param, value) => {
        if (context.dsp?.params) context.dsp.params[param] = value;
        context.onParamChange?.(moduleId, param, value);
    };
    injectModuleCSS(definition.id, definition.css);
    const cleanups = [];
    const paramControls = new Map();
    const onCleanup = cleanup => {
        if (typeof cleanup === 'function') cleanups.push(cleanup);
    };
    const registerParamControl = (param, element, sync) => {
        if (!param) return;
        if (!paramControls.has(param)) paramControls.set(param, []);
        paramControls.get(param).push({ element, sync });
    };
    const toolkit = createBoundToolkit(moduleId, handleParamChange, onCleanup, registerParamControl);

    // Create module panel
    const panel = createPanel({
        id: moduleId,
        hp: definition.hp,
        color: definition.color,
        type: definition.id
    });
    panel[CLEANUPS_KEY] = cleanups;
    panel[PARAM_CONTROLS_KEY] = paramControls;

    // Add module label
    panel.appendChild(createModuleLabel(definition.name));

    // Create content container
    const content = createContent();

    if (definition.render) {
        // Custom render mode - pass control to module's render function
        const renderInstance = {
            id: moduleId,
            type: definition.id,
            def: definition,
            dsp: context.dsp,
            element: panel,
            getModule: context.getModule
        };

        definition.render(content, {
            instance: renderInstance,
            toolkit,
            onParamChange: handleParamChange,
            onCleanup
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
                param: knobDef.param,
                small: knobDef.small || false,
                onChange: (value) => {
                    if (dsp?.params) dsp.params[knobDef.param] = value;
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
                param: swDef.param,
                onChange: (value) => {
                    if (dsp?.params) dsp.params[swDef.param] = value;
                    onParamChange?.(moduleId, swDef.param, value);
                }
            });
            switchRow.appendChild(swEl);
        });
        container.appendChild(switchRow);
    }

    // Button banks
    if (ui.buttons?.length) {
        if (ui.buttons[0]?.values) {
            ui.buttons.forEach(btnDef => {
                const bankEl = createButtonBank({
                    id: btnDef.id,
                    label: btnDef.label,
                    moduleId,
                    values: btnDef.values,
                    defaultValue: btnDef.default,
                    param: btnDef.param,
                    onChange: (value) => {
                        if (dsp?.params) dsp.params[btnDef.param] = value;
                        onParamChange?.(moduleId, btnDef.param, value);
                    }
                });
                container.appendChild(bankEl);
            });
        } else {
            container.appendChild(createSection('Gates'));
            const row = createRow('toggle-row');
            ui.buttons.forEach(btnDef => {
                const btn = document.createElement('button');
                btn.className = `toggle-btn${btnDef.default ? ' active' : ''}`;
                btn.dataset.module = moduleId;
                btn.dataset.param = btnDef.param;
                btn.dataset.rendererManaged = 'true';
                btn.title = btnDef.label;
                btn.addEventListener('click', () => {
                    const value = btn.classList.toggle('active') ? 1 : 0;
                    if (dsp?.params) dsp.params[btnDef.param] = value;
                    onParamChange?.(moduleId, btnDef.param, value);
                });
                row.appendChild(btn);
            });
            container.appendChild(row);
        }
    }

    if (ui.actions?.length) {
        const row = createRow('action-row');
        ui.actions.forEach(actionDef => {
            const btn = createActionButton({
                id: actionDef.id,
                label: actionDef.label,
                moduleId,
                value: actionDef.default || 0,
                mode: actionDef.mode || 'toggle',
                param: actionDef.param,
                onChange: (value) => {
                    if (dsp?.params) dsp.params[actionDef.param] = value;
                    onParamChange?.(moduleId, actionDef.param, value);
                }
            });
            row.appendChild(btn);
        });
        container.appendChild(row);
    }

    // Spacer
    container.appendChild(createSpacer());

    if (ui.socketLayout) {
        renderSocketLayout(container, ui, moduleId);
        return;
    }

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
                signal: outDef.signal || 'any'
            }));
        });
        container.appendChild(outRow);
    }

    // Inputs - group by type for larger modules
    if (ui.inputs?.length) {
        if (ui.inputs.length > 4) {
            // Group inputs by type prefix
            const cvInputs = ui.inputs.filter(i => i.id.startsWith('cv') || i.signal === 'cv');
            const trigInputs = ui.inputs.filter(i => i.id.startsWith('trig') || i.signal === 'trigger');
            const otherInputs = ui.inputs.filter(i =>
                !i.id.startsWith('cv') && !i.id.startsWith('trig') &&
                i.signal !== 'cv' && i.signal !== 'trigger'
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
                        signal: inDef.signal || 'cv'
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
                        signal: inDef.signal || 'trigger'
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
                        signal: inDef.signal || 'any'
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
                    signal: inDef.signal || 'any'
                }));
            });
            container.appendChild(inRow);
        }
    }
}

function findSocketDefinition(ui, socketRef) {
    const port = typeof socketRef === 'string' ? socketRef : socketRef.port;
    const input = ui.inputs?.find(item => item.port === port);
    const output = ui.outputs?.find(item => item.port === port);
    const definition = input || output;

    if (!definition) return null;

    return {
        ...definition,
        label: socketRef.label || definition.label,
        direction: output ? 'output' : 'input'
    };
}

function createSocketJack(ui, socketRef, moduleId) {
    const definition = findSocketDefinition(ui, socketRef);
    if (!definition) return null;

    return createJack({
        id: definition.port,
        label: definition.label,
        moduleId,
        direction: definition.direction,
        signal: definition.signal || 'any'
    });
}

function renderSocketLayout(container, ui, moduleId) {
    const layout = ui.socketLayout;
    const sectionLabel = layout.label || layout.section;

    if (sectionLabel) {
        container.appendChild(createSection(sectionLabel));
    }

    const split = document.createElement('div');
    split.className = ['socket-split', layout.className].filter(Boolean).join(' ');

    layout.columns.forEach(column => {
        const columnEl = document.createElement('div');
        columnEl.className = ['socket-column', column.className].filter(Boolean).join(' ');

        if (column.label) {
            const label = document.createElement('div');
            label.className = 'socket-column-label';
            label.textContent = column.label;
            columnEl.appendChild(label);
        }

        const grid = document.createElement('div');
        grid.className = ['socket-grid', column.gridClassName].filter(Boolean).join(' ');
        if (column.columns) {
            grid.style.gridTemplateColumns = `repeat(${column.columns}, minmax(0, 1fr))`;
        }

        column.ports.forEach(socketRef => {
            const jack = createSocketJack(ui, socketRef, moduleId);
            if (jack) grid.appendChild(jack);
        });

        columnEl.appendChild(grid);
        split.appendChild(columnEl);
    });

    container.appendChild(split);
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
    const panel = document.getElementById(`module-${moduleId}`);
    Object.entries(params).forEach(([param, value]) => {
        if (panel) {
            syncParamToModuleUI(panel, moduleId, param, value);
            return;
        }

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
            return;
        }

        const toggle = document.querySelector(`.toggle-btn[data-module="${moduleId}"][data-param="${param}"], .action-btn[data-module="${moduleId}"][data-param="${param}"]`);
        if (toggle) toggle.classList.toggle('active', value === 1 || value === true);
    });
}
