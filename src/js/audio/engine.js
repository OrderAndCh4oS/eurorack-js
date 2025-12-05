/**
 * Audio Engine - Core signal processing and routing
 *
 * Handles the main audio processing loop, module routing,
 * and signal flow between modules via virtual patch cables.
 */

import { BUFFER, SAMPLE_RATE } from '../config/constants.js';
import { MODULE_ORDER } from '../config/module-defs.js';
import { getNestedValue, setNestedValue } from '../utils/nested-access.js';

/** Buffer duration in seconds */
const BUFFER_DURATION = BUFFER / SAMPLE_RATE;

/**
 * Create an audio engine instance
 * @param {Object} options
 * @param {Object} options.modules - Map of module id to {instance, type} objects
 * @param {Array} options.cables - Array of cable connection objects
 * @param {AudioContext} options.audioCtx - Web Audio context
 * @param {Function} options.onLedUpdate - Callback for LED state changes
 * @returns {Object} Audio engine controller
 */
export function createAudioEngine({
    modules = {},
    cables = [],
    audioCtx = null,
    onLedUpdate = null
} = {}) {
    let isRunning = false;
    let nextTime = 0;
    let animationId = null;
    let timeoutId = null;

    /**
     * Route signals from source modules to destination inputs
     * @param {string} moduleId - Target module ID
     */
    function routeSignals(moduleId) {
        const mod = modules[moduleId]?.instance;
        if (!mod) return;

        cables.forEach(cable => {
            if (cable.toModule === moduleId) {
                const srcMod = modules[cable.fromModule]?.instance;
                if (!srcMod) return;

                const srcValue = getNestedValue(srcMod.outputs, cable.fromPort);
                setNestedValue(mod.inputs, cable.toPort, srcValue);
            }
        });
    }

    /**
     * Process a single audio buffer cycle
     */
    function processBuffer() {
        MODULE_ORDER.forEach(id => {
            if (!modules[id]?.instance) return;

            // Route incoming signals
            routeSignals(id);

            // Process the module
            const mod = modules[id].instance;
            if (id === 'out') {
                mod.process(nextTime);
            } else {
                mod.process();
            }
        });

        nextTime += BUFFER_DURATION;
    }

    /**
     * Collect LED states from all modules
     * @returns {Object} LED states keyed by module ID
     */
    function collectLedStates() {
        const ledStates = {};

        Object.entries(modules).forEach(([id, mod]) => {
            if (mod.instance?.leds) {
                ledStates[id] = { ...mod.instance.leds };
            } else if (mod.instance?.led) {
                // Output module uses 'led' instead of 'leds'
                ledStates[id] = { ...mod.instance.led };
            }
        });

        return ledStates;
    }

    /**
     * Main audio processing loop
     */
    function processAudio() {
        if (!isRunning || !audioCtx) return;

        // Process buffers to stay ahead of playback
        while (nextTime < audioCtx.currentTime + 0.1) {
            processBuffer();
        }

        // Update LEDs
        if (onLedUpdate) {
            onLedUpdate(collectLedStates());
        }

        // Schedule next iteration
        timeoutId = setTimeout(processAudio, 20);
    }

    return {
        /**
         * Start the audio engine
         */
        start() {
            if (isRunning) return;

            if (!audioCtx) {
                throw new Error('AudioContext required to start engine');
            }

            isRunning = true;
            nextTime = audioCtx.currentTime;
            processAudio();
        },

        /**
         * Stop the audio engine
         */
        stop() {
            isRunning = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        },

        /**
         * Check if engine is running
         * @returns {boolean}
         */
        get running() {
            return isRunning;
        },

        /**
         * Update modules reference
         * @param {Object} newModules
         */
        setModules(newModules) {
            modules = newModules;
        },

        /**
         * Update cables reference
         * @param {Array} newCables
         */
        setCables(newCables) {
            cables = newCables;
        },

        /**
         * Update AudioContext
         * @param {AudioContext} ctx
         */
        setAudioContext(ctx) {
            audioCtx = ctx;
        },

        /**
         * Process a single buffer (for testing)
         */
        tick() {
            if (audioCtx) {
                nextTime = audioCtx.currentTime;
            }
            processBuffer();
            return collectLedStates();
        },

        /**
         * Route signals for a specific module (exposed for testing)
         */
        routeSignals
    };
}

/**
 * Create a simple mock audio context for testing
 * @returns {Object} Mock AudioContext
 */
export function createMockAudioContext() {
    let time = 0;
    return {
        get currentTime() {
            return time;
        },
        advanceTime(seconds) {
            time += seconds;
        },
        sampleRate: SAMPLE_RATE,
        destination: {}
    };
}
