const REGISTRY_KEY = '__eurorackWorkletPlugins';
const registry = globalThis[REGISTRY_KEY] || new Map();
globalThis[REGISTRY_KEY] = registry;

export function registerWorkletPlugin(plugin) {
    if (!plugin?.id || plugin.apiVersion !== 1 || !Number.isInteger(plugin.patchVersion) || !(plugin.modules instanceof Map)) {
        throw new Error('Invalid Eurorack worklet plugin');
    }
    const existing = registry.get(plugin.id);
    if (existing) {
        if (existing === plugin) return existing;
        throw new Error(`Worklet plugin "${plugin.id}" is already registered`);
    }
    for (const moduleId of plugin.modules.keys()) {
        const owner = getWorkletModule(moduleId)?.plugin.id;
        if (owner) throw new Error(`Worklet module "${moduleId}" is already registered by plugin "${owner}"`);
    }
    registry.set(plugin.id, plugin);
    return plugin;
}

globalThis.registerEurorackWorkletPlugin = registerWorkletPlugin;

export function getWorkletPlugin(pluginId) {
    return registry.get(pluginId) || null;
}

export function getWorkletModule(type) {
    for (const plugin of registry.values()) {
        const definition = plugin.modules.get(type);
        if (definition) return { plugin, definition };
    }
    return null;
}
