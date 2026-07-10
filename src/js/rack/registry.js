import { CATEGORY_ORDER, CORE_PLUGIN_MANIFEST } from './module-manifest.js';
import { isModuleColorToken } from '../utils/color.js';
import { validateModuleDefinition } from './module-contract.js';

export const PLUGIN_API_VERSION = 1;

function assertManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') throw new Error('Plugin manifest must be an object');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id || '')) throw new Error('Plugin manifest has an invalid id');
    if (!manifest.name || typeof manifest.name !== 'string') throw new Error(`Plugin "${manifest.id}" has an invalid name`);
    if (!manifest.version || typeof manifest.version !== 'string') throw new Error(`Plugin "${manifest.id}" has an invalid version`);
    if (manifest.apiVersion !== PLUGIN_API_VERSION) {
        throw new Error(`Plugin "${manifest.id}" requires API ${manifest.apiVersion}; host provides ${PLUGIN_API_VERSION}`);
    }
    if (!Number.isInteger(manifest.patchVersion) || manifest.patchVersion < 1) {
        throw new Error(`Plugin "${manifest.id}" has an invalid patchVersion`);
    }
    if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) {
        throw new Error(`Plugin "${manifest.id}" must provide modules`);
    }
    if ('migratePatch' in manifest) {
        throw new Error(`Plugin "${manifest.id}" cannot declare migratePatch; patch migrations are not supported`);
    }
    if (manifest.id !== 'core' && typeof manifest.workletUrl !== 'string') {
        throw new Error(`Plugin "${manifest.id}" must provide a workletUrl`);
    }
}

async function loadModuleDefinition(entry) {
    if (entry.definition) return entry.definition;
    if (typeof entry.load !== 'function') throw new Error(`Module entry "${entry.id || 'unknown'}" is missing a loader`);
    const imported = await entry.load();
    return imported.default || imported;
}

function manifestsEqual(a, b) {
    return a.id === b.id && a.version === b.version && a.apiVersion === b.apiVersion && a.patchVersion === b.patchVersion;
}

export class PluginRegistry {
    constructor({ sampleRate = 44100, blockSize = 512 } = {}) {
        this.sampleRate = sampleRate;
        this.blockSize = blockSize;
        this.modules = new Map();
        this.plugins = new Map();
        this.moduleOwners = new Map();
        this.moduleOrder = new Map();
        this.listeners = new Set();
        this.usageResolvers = new Set();
        this.nextOrder = 0;
    }

    async registerPlugin(manifest) {
        assertManifest(manifest);
        const existing = this.plugins.get(manifest.id);
        if (existing) {
            if (manifestsEqual(existing.manifest, manifest)) return existing;
            throw new Error(`Plugin "${manifest.id}" is already registered`);
        }

        const definitions = await Promise.all(manifest.modules.map(loadModuleDefinition));
        definitions.forEach((definition, index) => {
            const entry = manifest.modules[index];
            if (entry.id && entry.id !== definition.id) {
                throw new Error(`Plugin "${manifest.id}" entry "${entry.id}" loaded module "${definition.id}"`);
            }
            if (this.modules.has(definition.id)) {
                throw new Error(`Module "${definition.id}" is already registered by plugin "${this.moduleOwners.get(definition.id)}"`);
            }
            this.validate(definition);
        });

        const record = { manifest, definitions: [...definitions] };
        this.plugins.set(manifest.id, record);
        definitions.forEach(definition => {
            this.modules.set(definition.id, definition);
            this.moduleOwners.set(definition.id, manifest.id);
            this.moduleOrder.set(definition.id, this.nextOrder++);
        });
        this.emit({ type: 'registered', pluginId: manifest.id, moduleIds: definitions.map(definition => definition.id) });
        return record;
    }

    unregisterPlugin(pluginId, { activeModuleTypes = [] } = {}) {
        const record = this.plugins.get(pluginId);
        if (!record) return false;
        const ownedTypes = new Set(record.definitions.map(definition => definition.id));
        const allActiveTypes = [
            ...activeModuleTypes,
            ...[...this.usageResolvers].flatMap(resolve => resolve() || [])
        ];
        const active = allActiveTypes.find(type => ownedTypes.has(type));
        if (active) throw new Error(`Cannot unregister plugin "${pluginId}" while module type "${active}" is in use`);

        record.definitions.forEach(definition => {
            this.modules.delete(definition.id);
            this.moduleOwners.delete(definition.id);
            this.moduleOrder.delete(definition.id);
        });
        this.plugins.delete(pluginId);
        this.emit({ type: 'unregistered', pluginId, moduleIds: [...ownedTypes] });
        return true;
    }

    validate(definition) {
        if (![2, 3, 4, 6, 8, 10, 12, 14, 16].includes(definition.hp)) {
            throw new Error(`Module "${definition.id}" has invalid hp: ${definition.hp}`);
        }
        if (!CATEGORY_ORDER.includes(definition.category)) {
            throw new Error(`Module "${definition.id}" has invalid category: ${definition.category}`);
        }
        if (!isModuleColorToken(definition.color)) {
            throw new Error(`Module "${definition.id}" has invalid color: ${definition.color}`);
        }
        if (!definition.ui || (!definition.render && typeof definition.ui !== 'object')) {
            throw new Error(`Module "${definition.id}" must declare a ui contract`);
        }
        validateModuleDefinition(definition, {
            sampleRate: this.sampleRate,
            blockSize: this.blockSize
        });
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    addUsageResolver(resolve) {
        this.usageResolvers.add(resolve);
        return () => this.usageResolvers.delete(resolve);
    }

    emit(event) {
        this.listeners.forEach(listener => listener(event));
    }

    get(id) {
        return this.modules.get(id);
    }

    has(id) {
        return this.modules.has(id);
    }

    getAll() {
        return [...this.modules.keys()];
    }

    getAllDefinitions() {
        return [...this.modules.values()];
    }

    getByCategory(category) {
        return this.getAllDefinitions().filter(definition => definition.category === category);
    }

    getCategories() {
        return CATEGORY_ORDER.filter(category => this.getByCategory(category).length > 0);
    }

    getModuleOrder(id) {
        return this.moduleOrder.get(id) ?? Number.MAX_SAFE_INTEGER;
    }

    getPlugin(id) {
        return this.plugins.get(id) || null;
    }

    getPluginForModule(moduleId) {
        return this.moduleOwners.get(moduleId) || null;
    }

    getPatchDependencies(moduleTypes = this.getAll()) {
        const dependencies = {};
        moduleTypes.forEach(type => {
            const pluginId = this.getPluginForModule(type);
            const plugin = pluginId ? this.plugins.get(pluginId) : null;
            if (plugin) dependencies[pluginId] = plugin.manifest.patchVersion;
        });
        return dependencies;
    }

    get count() {
        return this.modules.size;
    }
}

export const pluginRegistry = new PluginRegistry();
let coreLoadPromise = null;

export function loadCorePlugin() {
    if (!coreLoadPromise) {
        coreLoadPromise = pluginRegistry.registerPlugin(CORE_PLUGIN_MANIFEST).catch(error => {
            coreLoadPromise = null;
            throw error;
        });
    }
    return coreLoadPromise.then(() => pluginRegistry);
}

export function registerPlugin(manifest) {
    return pluginRegistry.registerPlugin(manifest);
}

export function unregisterPlugin(pluginId, options) {
    return pluginRegistry.unregisterPlugin(pluginId, options);
}
