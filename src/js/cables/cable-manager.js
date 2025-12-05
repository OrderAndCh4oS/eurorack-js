/**
 * Cable Manager - Manages patch cable connections
 *
 * Handles adding, removing, and querying patch cables
 * that connect module outputs to inputs.
 */

import { CABLE_COLORS } from '../config/constants.js';

/**
 * Create a cable manager instance
 * @returns {Object} Cable manager
 */
export function createCableManager() {
    let cables = [];
    let colorIndex = 0;

    return {
        /**
         * Add a new cable connection
         * @param {Object} connection
         * @param {string} connection.fromModule - Source module ID
         * @param {string} connection.fromPort - Source port name
         * @param {string} connection.toModule - Destination module ID
         * @param {string} connection.toPort - Destination port name
         * @param {string} connection.type - Signal type ('buffer', 'cv', 'trigger')
         * @returns {Object} The created cable object
         */
        addCable({ fromModule, fromPort, toModule, toPort, type = 'buffer' }) {
            // Remove any existing cable to this input
            this.removeCableTo(toModule, toPort);

            const cable = {
                id: `cable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fromModule,
                fromPort,
                toModule,
                toPort,
                type,
                color: CABLE_COLORS[colorIndex++ % CABLE_COLORS.length]
            };

            cables.push(cable);
            return cable;
        },

        /**
         * Remove a cable by ID
         * @param {string} cableId - Cable ID
         * @returns {Object|null} Removed cable or null
         */
        removeCable(cableId) {
            const index = cables.findIndex(c => c.id === cableId);
            if (index >= 0) {
                const [removed] = cables.splice(index, 1);
                return removed;
            }
            return null;
        },

        /**
         * Remove cable connected to a specific input
         * @param {string} moduleId - Module ID
         * @param {string} port - Port name
         * @returns {Object|null} Removed cable or null
         */
        removeCableTo(moduleId, port) {
            const index = cables.findIndex(c => c.toModule === moduleId && c.toPort === port);
            if (index >= 0) {
                const [removed] = cables.splice(index, 1);
                return removed;
            }
            return null;
        },

        /**
         * Remove all cables connected to a module
         * @param {string} moduleId - Module ID
         * @returns {Array} Removed cables
         */
        removeCablesForModule(moduleId) {
            const removed = cables.filter(c => c.fromModule === moduleId || c.toModule === moduleId);
            cables = cables.filter(c => c.fromModule !== moduleId && c.toModule !== moduleId);
            return removed;
        },

        /**
         * Get all cables
         * @returns {Array} All cables
         */
        getCables() {
            return [...cables];
        },

        /**
         * Get cables from a specific output
         * @param {string} moduleId - Module ID
         * @param {string} port - Port name
         * @returns {Array} Matching cables
         */
        getCablesFrom(moduleId, port) {
            return cables.filter(c => c.fromModule === moduleId && c.fromPort === port);
        },

        /**
         * Get cable to a specific input
         * @param {string} moduleId - Module ID
         * @param {string} port - Port name
         * @returns {Object|null} Cable or null
         */
        getCableTo(moduleId, port) {
            return cables.find(c => c.toModule === moduleId && c.toPort === port) || null;
        },

        /**
         * Check if an input is connected
         * @param {string} moduleId - Module ID
         * @param {string} port - Port name
         * @returns {boolean}
         */
        isInputConnected(moduleId, port) {
            return cables.some(c => c.toModule === moduleId && c.toPort === port);
        },

        /**
         * Clear all cables
         */
        clear() {
            cables = [];
        },

        /**
         * Load cables from serialized state
         * @param {Array} serializedCables - Array of cable objects
         */
        loadCables(serializedCables) {
            cables = [];
            serializedCables.forEach(c => {
                this.addCable(c);
            });
        },

        /**
         * Serialize cables for saving
         * @returns {Array} Serializable cable array
         */
        serialize() {
            return cables.map(c => ({
                fromModule: c.fromModule,
                fromPort: c.fromPort,
                toModule: c.toModule,
                toPort: c.toPort
            }));
        },

        /**
         * Get cable count
         * @returns {number}
         */
        get count() {
            return cables.length;
        }
    };
}

/**
 * Create an SVG path for a cable
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @returns {string} SVG path d attribute
 */
export function createCablePath(x1, y1, x2, y2) {
    const sag = Math.min(100, Math.abs(x2 - x1) * 0.3 + 30);
    const cp1y = y1 + sag;
    const cp2y = y2 + sag;
    return `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
}

/**
 * Get the center point of a jack element
 * @param {HTMLElement} jackEl - Jack DOM element
 * @returns {Object} {x, y} coordinates
 */
export function getJackCenter(jackEl) {
    const rect = jackEl.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}
