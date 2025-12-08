/**
 * Module Registry
 *
 * Central registry for managing available module definitions.
 * Handles registration, validation, and lookup of modules.
 */

/**
 * Module Registry class
 */
class ModuleRegistry {
    constructor() {
        /** @type {Map<string, ModuleDefinition>} */
        this.modules = new Map();

        /** @type {Map<string, string[]>} */
        this.categories = new Map();
    }

    /**
     * Register a module definition
     * @param {Object} definition - Module definition object
     * @returns {ModuleRegistry} this (for chaining)
     * @throws {Error} If definition is invalid
     */
    register(definition) {
        // Validate required fields
        this.validate(definition);

        // Store module
        this.modules.set(definition.id, definition);

        // Track by category
        const category = definition.category || 'other';
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(definition.id);

        return this;
    }

    /**
     * Validate a module definition
     * @param {Object} def - Module definition
     * @throws {Error} If validation fails
     */
    validate(def) {
        const required = ['id', 'name', 'hp', 'color', 'createDSP'];

        for (const field of required) {
            if (def[field] === undefined || def[field] === null) {
                throw new Error(`Module "${def.id || 'unknown'}" missing required field: ${field}`);
            }
        }

        // Validate hp is a valid size
        if (![2, 3, 4, 6, 8, 10, 12, 14, 16].includes(def.hp)) {
            throw new Error(`Module "${def.id}" has invalid hp: ${def.hp}. Must be 2, 3, 4, 6, 8, 10, 12, 14, or 16.`);
        }

        // Must have either ui definition or render function
        if (!def.ui && !def.render) {
            throw new Error(`Module "${def.id}" must have either "ui" or "render" defined`);
        }

        // Validate ui structure if present
        if (def.ui) {
            this.validateUI(def.id, def.ui);
        }

        // Validate createDSP is a function
        if (typeof def.createDSP !== 'function') {
            throw new Error(`Module "${def.id}" createDSP must be a function`);
        }
    }

    /**
     * Validate UI definition structure
     * @param {string} moduleId - Module ID for error messages
     * @param {Object} ui - UI definition object
     */
    validateUI(moduleId, ui) {
        // Validate knobs
        if (ui.knobs) {
            ui.knobs.forEach((knob, i) => {
                if (!knob.id) throw new Error(`Module "${moduleId}" knob[${i}] missing id`);
                if (!knob.param) throw new Error(`Module "${moduleId}" knob "${knob.id}" missing param`);
                if (knob.min === undefined) throw new Error(`Module "${moduleId}" knob "${knob.id}" missing min`);
                if (knob.max === undefined) throw new Error(`Module "${moduleId}" knob "${knob.id}" missing max`);
            });
        }

        // Validate inputs
        if (ui.inputs) {
            ui.inputs.forEach((input, i) => {
                if (!input.id) throw new Error(`Module "${moduleId}" input[${i}] missing id`);
                if (!input.port) throw new Error(`Module "${moduleId}" input "${input.id}" missing port`);
            });
        }

        // Validate outputs
        if (ui.outputs) {
            ui.outputs.forEach((output, i) => {
                if (!output.id) throw new Error(`Module "${moduleId}" output[${i}] missing id`);
                if (!output.port) throw new Error(`Module "${moduleId}" output "${output.id}" missing port`);
            });
        }
    }

    /**
     * Get a module definition by ID
     * @param {string} id - Module ID
     * @returns {Object|undefined} Module definition or undefined
     */
    get(id) {
        return this.modules.get(id);
    }

    /**
     * Check if a module is registered
     * @param {string} id - Module ID
     * @returns {boolean}
     */
    has(id) {
        return this.modules.has(id);
    }

    /**
     * Get all registered module IDs
     * @returns {string[]} Array of module IDs
     */
    getAll() {
        return [...this.modules.keys()];
    }

    /**
     * Get all module definitions
     * @returns {Object[]} Array of module definitions
     */
    getAllDefinitions() {
        return [...this.modules.values()];
    }

    /**
     * Get modules by category
     * @param {string} category - Category name
     * @returns {Object[]} Array of module definitions in category
     */
    getByCategory(category) {
        const ids = this.categories.get(category) || [];
        return ids.map(id => this.modules.get(id));
    }

    /**
     * Get all categories
     * @returns {string[]} Array of category names
     */
    getCategories() {
        return [...this.categories.keys()];
    }

    /**
     * Unregister a module
     * @param {string} id - Module ID to remove
     * @returns {boolean} True if module was removed
     */
    unregister(id) {
        const def = this.modules.get(id);
        if (!def) return false;

        this.modules.delete(id);

        // Remove from category
        const category = def.category || 'other';
        const categoryList = this.categories.get(category);
        if (categoryList) {
            const idx = categoryList.indexOf(id);
            if (idx >= 0) {
                categoryList.splice(idx, 1);
            }
            // Remove empty category
            if (categoryList.length === 0) {
                this.categories.delete(category);
            }
        }

        return true;
    }

    /**
     * Clear all registered modules
     */
    clear() {
        this.modules.clear();
        this.categories.clear();
    }

    /**
     * Get count of registered modules
     * @returns {number}
     */
    get count() {
        return this.modules.size;
    }
}

// Singleton instance
export const moduleRegistry = new ModuleRegistry();

/**
 * Load modules from module folders
 * This function imports all module definitions and registers them
 * @returns {Promise<ModuleRegistry>}
 */
export async function loadModules() {
    // Import all module definitions
    const moduleImports = await Promise.all([
        import('../modules/clk/index.js'),
        import('../modules/div/index.js'),
        import('../modules/lfo/index.js'),
        import('../modules/nse/index.js'),
        import('../modules/sh/index.js'),
        import('../modules/quant/index.js'),
        import('../modules/arp/index.js'),
        import('../modules/seq/index.js'),
        import('../modules/euclid/index.js'),
        import('../modules/logic/index.js'),
        import('../modules/mult/index.js'),
        import('../modules/vco/index.js'),
        import('../modules/vcf/index.js'),
        import('../modules/fold/index.js'),
        import('../modules/ring/index.js'),
        import('../modules/rnd/index.js'),
        import('../modules/envf/index.js'),
        import('../modules/func/index.js'),
        import('../modules/adsr/index.js'),
        import('../modules/vca/index.js'),
        import('../modules/atten/index.js'),
        import('../modules/slew/index.js'),
        import('../modules/mix/index.js'),
        import('../modules/dly/index.js'),
        import('../modules/verb/index.js'),
        import('../modules/chorus/index.js'),
        import('../modules/phaser/index.js'),
        import('../modules/flanger/index.js'),
        import('../modules/crush/index.js'),
        import('../modules/db/index.js'),
        import('../modules/pwm/index.js'),
        import('../modules/turing/index.js'),
        import('../modules/ochd/index.js'),
        import('../modules/cmp2/index.js'),
        import('../modules/kick/index.js'),
        import('../modules/snare/index.js'),
        import('../modules/hat/index.js'),
        import('../modules/scope/index.js'),
        import('../modules/out/index.js'),
    ]);

    // Register each module
    moduleImports.forEach(mod => {
        moduleRegistry.register(mod.default);
    });

    return moduleRegistry;
}

/**
 * Register a single module (for dynamic loading or custom modules)
 * @param {Object} definition - Module definition
 * @returns {ModuleRegistry}
 */
export function registerModule(definition) {
    return moduleRegistry.register(definition);
}

/**
 * Hot-reload a module (for development)
 * @param {string} id - Module ID
 * @returns {Promise<Object>} Reloaded module definition
 */
export async function hotReloadModule(id) {
    // Note: Cache busting for development
    const timestamp = Date.now();
    const modulePath = `../modules/${id}/index.js?t=${timestamp}`;

    try {
        const module = await import(modulePath);
        moduleRegistry.unregister(id);
        moduleRegistry.register(module.default);
        return module.default;
    } catch (error) {
        console.error(`Failed to hot-reload module "${id}":`, error);
        throw error;
    }
}
