/**
 * Audio Engine - Core signal processing and routing
 *
 * Handles the main audio processing loop, module routing,
 * and signal flow between modules via virtual patch cables.
 */

import { BUFFER, SAMPLE_RATE } from '../config/constants.js';
import { MODULE_ORDER } from '../config/module-defs.js';
import { getNestedValue, setNestedValue } from '../utils/nested-access.js';

/**
 * Compute optimal module processing order based on cable connections.
 * Uses topological sort to ensure sources process before destinations.
 * Falls back to MODULE_ORDER for cycles or unconnected modules.
 *
 * @param {Object} modules - Map of module id to {instance, type} objects
 * @param {Array} cables - Array of cable connection objects
 * @returns {string[]} Ordered array of module IDs
 */
export function computeProcessOrder(modules, cables) {
    const moduleIds = Object.keys(modules);
    if (moduleIds.length === 0) return [];

    // Build adjacency list and in-degree count
    // Edge: fromModule → toModule (source must process before destination)
    const graph = new Map();      // moduleId → Set of modules that depend on it
    const inDegree = new Map();   // moduleId → number of dependencies

    // Initialize all modules
    moduleIds.forEach(id => {
        graph.set(id, new Set());
        inDegree.set(id, 0);
    });

    // Add edges from cables
    cables.forEach(cable => {
        const from = cable.fromModule;
        const to = cable.toModule;

        // Only add edge if both modules exist and it's not a self-loop
        if (graph.has(from) && graph.has(to) && from !== to) {
            // Avoid duplicate edges
            if (!graph.get(from).has(to)) {
                graph.get(from).add(to);
                inDegree.set(to, inDegree.get(to) + 1);
            }
        }
    });

    // Kahn's algorithm for topological sort
    // Use MODULE_ORDER as priority when multiple modules have in-degree 0
    const moduleOrderIndex = new Map(MODULE_ORDER.map((id, i) => [id, i]));
    const getOrderIndex = (id) => moduleOrderIndex.get(id) ?? 999;

    // Priority queue: modules with in-degree 0, sorted by MODULE_ORDER
    const queue = moduleIds
        .filter(id => inDegree.get(id) === 0)
        .sort((a, b) => getOrderIndex(a) - getOrderIndex(b));

    const result = [];
    const visited = new Set();

    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;

        visited.add(current);
        result.push(current);

        // Process neighbors
        const neighbors = [...graph.get(current)].sort((a, b) => getOrderIndex(a) - getOrderIndex(b));
        for (const neighbor of neighbors) {
            inDegree.set(neighbor, inDegree.get(neighbor) - 1);
            if (inDegree.get(neighbor) === 0 && !visited.has(neighbor)) {
                // Insert in sorted position based on MODULE_ORDER
                const idx = queue.findIndex(id => getOrderIndex(id) > getOrderIndex(neighbor));
                if (idx === -1) {
                    queue.push(neighbor);
                } else {
                    queue.splice(idx, 0, neighbor);
                }
            }
        }
    }

    // Handle cycles: any unvisited modules are in cycles
    // Add them in MODULE_ORDER sequence
    const cyclic = moduleIds
        .filter(id => !visited.has(id))
        .sort((a, b) => getOrderIndex(a) - getOrderIndex(b));

    result.push(...cyclic);

    return result;
}

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
    let processOrder = computeProcessOrder(modules, cables);

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
        processOrder.forEach(id => {
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
            processOrder = computeProcessOrder(modules, cables);
        },

        /**
         * Update cables reference
         * @param {Array} newCables
         */
        setCables(newCables) {
            // Find modules with audio inputs that were connected but now aren't
            const oldByModule = new Map();
            cables.forEach(c => {
                if (!oldByModule.has(c.toModule)) oldByModule.set(c.toModule, new Set());
                oldByModule.get(c.toModule).add(c.toPort);
            });
            const newByModule = new Map();
            newCables.forEach(c => {
                if (!newByModule.has(c.toModule)) newByModule.set(c.toModule, new Set());
                newByModule.get(c.toModule).add(c.toPort);
            });

            // For modules that lost audio connections, clear their audio inputs
            for (const [modId, oldPorts] of oldByModule) {
                const newPorts = newByModule.get(modId) || new Set();
                const lostPorts = [...oldPorts].filter(p => !newPorts.has(p));
                if (lostPorts.length > 0) {
                    const mod = modules[modId]?.instance;
                    if (mod?.clearAudioInputs) {
                        mod.clearAudioInputs();
                    }
                }
            }

            cables = newCables;
            processOrder = computeProcessOrder(modules, cables);
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
        routeSignals,

        /**
         * Get current processing order (for debugging/testing)
         */
        get processOrder() {
            return [...processOrder];
        }
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
