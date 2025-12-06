/**
 * Rack Orchestrator
 *
 * Manages the collection of modules in the rack, handling:
 * - Module instantiation and rendering
 * - DSP instance lifecycle
 * - Parameter synchronization
 * - LED updates
 */

import { moduleRegistry } from './registry.js';
import { renderModule, updateModuleLEDs } from '../ui/renderer.js';
import { SAMPLE_RATE, BUFFER } from '../config/constants.js';

/**
 * Create a rack instance
 * @param {Object} options
 * @param {HTMLElement} options.container - DOM container for the rack
 * @param {string[]} options.modules - Array of module IDs to instantiate
 * @param {AudioContext} options.audioCtx - Audio context (optional, can be set later)
 * @returns {Object} Rack controller
 */
export function createRack({
    container,
    modules: moduleIds,
    audioCtx = null
}) {
    /** @type {Map<string, ModuleInstance>} */
    const instances = new Map();

    /** @type {string[]} */
    let moduleOrder = [...moduleIds];

    /** @type {AudioContext|null} */
    let currentAudioCtx = audioCtx;

    /**
     * Create a DSP instance for a module
     */
    function createDSPInstance(definition) {
        return definition.createDSP({
            sampleRate: currentAudioCtx?.sampleRate || SAMPLE_RATE,
            bufferSize: BUFFER,
            audioCtx: currentAudioCtx
        });
    }

    /**
     * Handle parameter change from UI
     */
    function onParamChange(moduleId, param, value) {
        // Parameter is already set on DSP instance by the component
        // This callback is for external listeners (e.g., patch autosave)
    }

    return {
        /**
         * Render all modules to the container
         */
        render() {
            container.innerHTML = '';
            instances.clear();

            moduleOrder.forEach(moduleId => {
                const definition = moduleRegistry.get(moduleId);
                if (!definition) {
                    console.warn(`Module "${moduleId}" not found in registry`);
                    return;
                }

                // Create DSP instance
                const dsp = createDSPInstance(definition);

                // Create instance object
                const instance = {
                    id: moduleId,
                    type: definition.id,
                    def: definition,
                    dsp,
                    element: null
                };

                // Render to DOM
                instance.element = renderModule(definition, moduleId, {
                    dsp,
                    onParamChange
                });

                container.appendChild(instance.element);
                instances.set(moduleId, instance);

                // Call lifecycle hook
                definition.onInit?.(instance);
            });
        },

        /**
         * Get all module instances for the audio engine
         * @returns {Object} Map of moduleId to {instance, type}
         */
        getModules() {
            const result = {};
            instances.forEach((inst, id) => {
                result[id] = {
                    instance: inst.dsp,
                    type: inst.type,
                    def: inst.def
                };
            });
            return result;
        },

        /**
         * Get a specific module instance
         * @param {string} moduleId
         * @returns {Object|undefined}
         */
        getInstance(moduleId) {
            return instances.get(moduleId);
        },

        /**
         * Get the module processing order
         * @returns {string[]}
         */
        getOrder() {
            return [...moduleOrder];
        },

        /**
         * Update LED states for all modules
         * @param {Object} ledStates - Map of moduleId to led state objects
         */
        updateLEDs(ledStates) {
            Object.entries(ledStates).forEach(([moduleId, leds]) => {
                updateModuleLEDs(moduleId, leds);
            });
        },

        /**
         * Set the audio context (call before render or when audio starts)
         * @param {AudioContext} ctx
         */
        setAudioContext(ctx) {
            currentAudioCtx = ctx;
        },

        /**
         * Reinitialize all DSP instances (e.g., when audio restarts)
         */
        reinitializeDSP() {
            instances.forEach((instance, moduleId) => {
                // Destroy old instance
                instance.def.onDestroy?.(instance);

                // Create new DSP instance
                instance.dsp = createDSPInstance(instance.def);

                // Sync UI state to new DSP instance
                syncUIToDSP(instance);

                // Call init hook
                instance.def.onInit?.(instance);
            });
        },

        /**
         * Apply patch state to modules
         * @param {Object} patchState - Patch state object
         */
        applyPatch(patchState) {
            // Apply knob values
            if (patchState.knobs) {
                Object.entries(patchState.knobs).forEach(([moduleId, params]) => {
                    const instance = instances.get(moduleId);
                    if (instance) {
                        Object.entries(params).forEach(([param, value]) => {
                            instance.dsp.params[param] = value;
                            // Update UI
                            const knob = document.querySelector(
                                `.knob[data-module="${moduleId}"][data-param="${param}"]`
                            );
                            if (knob) {
                                knob.dataset.value = value;
                                // Import dynamically to avoid circular deps
                                import('../ui/toolkit/components.js').then(({ updateKnobRotation }) => {
                                    updateKnobRotation(knob);
                                });
                            }
                        });
                    }
                });
            }

            // Apply switch values
            if (patchState.switches) {
                Object.entries(patchState.switches).forEach(([moduleId, params]) => {
                    const instance = instances.get(moduleId);
                    if (instance) {
                        Object.entries(params).forEach(([param, value]) => {
                            instance.dsp.params[param] = value ? 1 : 0;
                            // Update UI
                            const sw = document.querySelector(
                                `.switch[data-module="${moduleId}"][data-param="${param}"]`
                            );
                            if (sw) {
                                sw.classList.toggle('on', !!value);
                            }
                        });
                    }
                });
            }

            // Apply button values
            if (patchState.buttons) {
                Object.entries(patchState.buttons).forEach(([moduleId, params]) => {
                    const instance = instances.get(moduleId);
                    if (instance) {
                        Object.entries(params).forEach(([param, value]) => {
                            instance.dsp.params[param] = value;
                            // Update UI
                            const bank = document.querySelector(
                                `.button-bank[data-module="${moduleId}"][data-param="${param}"]`
                            );
                            if (bank) {
                                bank.querySelectorAll('.octave-btn').forEach(btn => {
                                    btn.classList.toggle('active', parseInt(btn.dataset.value) === value);
                                });
                            }
                        });
                    }
                });
            }
        },

        /**
         * Serialize current state to patch format
         * @returns {Object} Patch state object
         */
        serializeState() {
            const state = {
                knobs: {},
                switches: {},
                buttons: {}
            };

            // Serialize all knob values
            document.querySelectorAll('.knob').forEach(knob => {
                const moduleId = knob.dataset.module;
                const param = knob.dataset.param;
                const value = parseFloat(knob.dataset.value);

                if (!state.knobs[moduleId]) state.knobs[moduleId] = {};
                state.knobs[moduleId][param] = value;
            });

            // Serialize all switch states
            document.querySelectorAll('.switch').forEach(sw => {
                const moduleId = sw.dataset.module;
                const param = sw.dataset.param;
                const isOn = sw.classList.contains('on');

                if (!state.switches[moduleId]) state.switches[moduleId] = {};
                state.switches[moduleId][param] = isOn;
            });

            // Serialize all button bank states
            document.querySelectorAll('.button-bank').forEach(bank => {
                const moduleId = bank.dataset.module;
                const param = bank.dataset.param;
                const activeBtn = bank.querySelector('.octave-btn.active');
                const value = activeBtn ? parseInt(activeBtn.dataset.value) : 0;

                if (!state.buttons[moduleId]) state.buttons[moduleId] = {};
                state.buttons[moduleId][param] = value;
            });

            return state;
        },

        /**
         * Destroy all module instances
         */
        destroy() {
            instances.forEach((instance, moduleId) => {
                instance.def.onDestroy?.(instance);
            });
            instances.clear();
            container.innerHTML = '';
        },

        /**
         * Add a module to the rack
         * @param {string} moduleId - Module ID to add
         * @param {number} position - Position in order (default: end)
         */
        addModule(moduleId, position = moduleOrder.length) {
            if (instances.has(moduleId)) {
                console.warn(`Module "${moduleId}" already in rack`);
                return;
            }

            moduleOrder.splice(position, 0, moduleId);
            // Re-render to update positions
            this.render();
        },

        /**
         * Remove a module from the rack
         * @param {string} moduleId - Module ID to remove
         */
        removeModule(moduleId) {
            const instance = instances.get(moduleId);
            if (!instance) return;

            instance.def.onDestroy?.(instance);
            instance.element?.remove();
            instances.delete(moduleId);
            moduleOrder = moduleOrder.filter(id => id !== moduleId);
        }
    };
}

/**
 * Sync UI state to DSP instance
 * @param {Object} instance - Module instance
 */
function syncUIToDSP(instance) {
    const moduleId = instance.id;

    // Sync knobs
    document.querySelectorAll(`.knob[data-module="${moduleId}"]`).forEach(knob => {
        const param = knob.dataset.param;
        const value = parseFloat(knob.dataset.value);
        instance.dsp.params[param] = value;
    });

    // Sync switches
    document.querySelectorAll(`.switch[data-module="${moduleId}"]`).forEach(sw => {
        const param = sw.dataset.param;
        const isOn = sw.classList.contains('on');
        instance.dsp.params[param] = isOn ? 1 : 0;
    });

    // Sync button banks
    document.querySelectorAll(`.button-bank[data-module="${moduleId}"]`).forEach(bank => {
        const param = bank.dataset.param;
        const activeBtn = bank.querySelector('.octave-btn.active');
        if (activeBtn) {
            instance.dsp.params[param] = parseInt(activeBtn.dataset.value);
        }
    });
}
