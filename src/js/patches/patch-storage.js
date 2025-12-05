/**
 * Patch Storage - Manage patch persistence with localStorage
 *
 * Handles saving, loading, and managing patches in browser storage.
 */

import { PATCH_STORAGE_KEY } from '../config/constants.js';
import { FACTORY_PATCHES } from '../config/factory-patches.js';

/**
 * Create a patch storage manager
 * @param {string} storageKey - localStorage key (default from constants)
 * @returns {Object} Patch storage manager
 */
export function createPatchStorage(storageKey = PATCH_STORAGE_KEY) {
    /**
     * Get user patches from localStorage
     * @returns {Object} User patches
     */
    function getUserPatches() {
        try {
            const data = localStorage.getItem(storageKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error loading user patches:', e);
            return {};
        }
    }

    /**
     * Save user patches to localStorage
     * @param {Object} patches - Patches to save
     */
    function saveUserPatches(patches) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(patches));
        } catch (e) {
            console.error('Error saving patches:', e);
        }
    }

    return {
        /**
         * Get all patches (factory + user)
         * @returns {Object} All patches
         */
        getAllPatches() {
            const userPatches = getUserPatches();
            return { ...FACTORY_PATCHES, ...userPatches };
        },

        /**
         * Get factory patches only
         * @returns {Object} Factory patches
         */
        getFactoryPatches() {
            return { ...FACTORY_PATCHES };
        },

        /**
         * Get user patches only
         * @returns {Object} User patches
         */
        getUserPatches() {
            return getUserPatches();
        },

        /**
         * Get a specific patch by name
         * @param {string} name - Patch name
         * @returns {Object|null} Patch or null
         */
        getPatch(name) {
            const patches = this.getAllPatches();
            return patches[name] || null;
        },

        /**
         * Check if a patch exists
         * @param {string} name - Patch name
         * @returns {boolean}
         */
        hasPatch(name) {
            const patches = this.getAllPatches();
            return name in patches;
        },

        /**
         * Check if a patch is a factory patch
         * @param {string} name - Patch name
         * @returns {boolean}
         */
        isFactoryPatch(name) {
            return name in FACTORY_PATCHES;
        },

        /**
         * Save a user patch
         * @param {string} name - Patch name
         * @param {Object} state - Patch state
         * @returns {boolean} Success
         */
        savePatch(name, state) {
            if (!name || !name.trim()) {
                console.error('Patch name required');
                return false;
            }

            name = name.trim();

            const patches = getUserPatches();
            patches[name] = {
                name,
                factory: false,
                created: new Date().toISOString(),
                state
            };

            saveUserPatches(patches);
            return true;
        },

        /**
         * Delete a user patch
         * @param {string} name - Patch name
         * @returns {boolean} Success
         */
        deletePatch(name) {
            if (this.isFactoryPatch(name)) {
                console.error('Cannot delete factory patch');
                return false;
            }

            const patches = getUserPatches();
            if (!(name in patches)) {
                return false;
            }

            delete patches[name];
            saveUserPatches(patches);
            return true;
        },

        /**
         * Rename a user patch
         * @param {string} oldName - Current name
         * @param {string} newName - New name
         * @returns {boolean} Success
         */
        renamePatch(oldName, newName) {
            if (this.isFactoryPatch(oldName)) {
                console.error('Cannot rename factory patch');
                return false;
            }

            if (!newName || !newName.trim()) {
                return false;
            }

            newName = newName.trim();
            const patches = getUserPatches();

            if (!(oldName in patches)) {
                return false;
            }

            const patch = patches[oldName];
            patch.name = newName;
            delete patches[oldName];
            patches[newName] = patch;

            saveUserPatches(patches);
            return true;
        },

        /**
         * Get list of patch names
         * @returns {Array} Patch names
         */
        getPatchNames() {
            return Object.keys(this.getAllPatches());
        },

        /**
         * Get list of factory patch names
         * @returns {Array} Factory patch names
         */
        getFactoryPatchNames() {
            return Object.keys(FACTORY_PATCHES);
        },

        /**
         * Get list of user patch names
         * @returns {Array} User patch names
         */
        getUserPatchNames() {
            return Object.keys(getUserPatches());
        },

        /**
         * Clear all user patches
         */
        clearUserPatches() {
            saveUserPatches({});
        },

        /**
         * Export all user patches as JSON string
         * @returns {string} JSON string
         */
        exportPatches() {
            return JSON.stringify(getUserPatches(), null, 2);
        },

        /**
         * Import patches from JSON string
         * @param {string} json - JSON string
         * @param {boolean} merge - Merge with existing (true) or replace (false)
         * @returns {number} Number of patches imported
         */
        importPatches(json, merge = true) {
            try {
                const imported = JSON.parse(json);
                if (typeof imported !== 'object') {
                    throw new Error('Invalid patch data');
                }

                const existing = merge ? getUserPatches() : {};
                const merged = { ...existing, ...imported };
                saveUserPatches(merged);

                return Object.keys(imported).length;
            } catch (e) {
                console.error('Error importing patches:', e);
                return 0;
            }
        }
    };
}
