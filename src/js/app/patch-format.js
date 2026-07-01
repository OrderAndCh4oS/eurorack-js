export const PATCH_VERSION = 2;

function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function mergeParamGroups(state) {
    const params = {};

    function merge(group, transform = value => value) {
        Object.entries(group || {}).forEach(([moduleId, moduleParams]) => {
            if (!params[moduleId]) params[moduleId] = {};
            Object.entries(moduleParams || {}).forEach(([param, value]) => {
                params[moduleId][param] = transform(value);
            });
        });
    }

    merge(state.knobs);
    merge(state.switches, value => value === true ? 1 : value === false ? 0 : value);
    merge(state.buttons);

    return params;
}

function collectReferencedModuleIds(state) {
    const ids = new Set();

    Object.keys(state.knobs || {}).forEach(id => ids.add(id));
    Object.keys(state.switches || {}).forEach(id => ids.add(id));
    Object.keys(state.buttons || {}).forEach(id => ids.add(id));

    (state.cables || []).forEach(cable => {
        ids.add(cable.fromModule);
        ids.add(cable.toModule);
    });

    return [...ids];
}

function normalizeModules(state, moduleOrder) {
    if (Array.isArray(state.modules) && state.modules.length > 0) {
        return state.modules.map((mod, index) => ({
            id: mod.id || mod.instanceId || mod.type,
            legacyId: mod.instanceId,
            type: mod.type,
            row: mod.row || 1,
            index: mod.index ?? index
        }));
    }

    const referenced = collectReferencedModuleIds(state);
    const order = moduleOrder || referenced;
    return order
        .filter(type => referenced.includes(type))
        .map((type, index) => ({
            id: type,
            type,
            row: 1,
            index
        }));
}

function remapObjectKeys(obj, idMap) {
    const result = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
        result[idMap[key] || key] = value;
    });
    return result;
}

function normalizeCables(cables, idMap) {
    return (cables || []).map(cable => ({
        fromModule: idMap[cable.fromModule] || cable.fromModule,
        fromPort: cable.fromPort,
        toModule: idMap[cable.toModule] || cable.toModule,
        toPort: cable.toPort
    }));
}

export function normalizePatch(rawPatchOrState, { moduleOrder = [] } = {}) {
    const state = rawPatchOrState?.state || rawPatchOrState;
    if (!state || typeof state !== 'object') {
        return {
            version: PATCH_VERSION,
            modules: [],
            params: {},
            cables: [],
            midiMappings: {}
        };
    }

    if (state.version === PATCH_VERSION && Array.isArray(state.modules) && state.params) {
        return {
            version: PATCH_VERSION,
            modules: state.modules.map((mod, index) => ({
                id: mod.id,
                type: mod.type,
                row: mod.row || 1,
                index: mod.index ?? index
            })),
            params: clone(state.params),
            cables: normalizeCables(state.cables || [], {}),
            midiMappings: clone(state.midiMappings)
        };
    }

    const modules = normalizeModules(state, moduleOrder);
    const idMap = {};
    modules.forEach(mod => {
        if (mod.legacyId) idMap[mod.legacyId] = mod.id;
        idMap[mod.type] = mod.id;
    });

    return {
        version: PATCH_VERSION,
        modules: modules.map(({ legacyId, ...mod }) => mod),
        params: remapObjectKeys(mergeParamGroups(state), idMap),
        cables: normalizeCables(state.cables || [], idMap),
        midiMappings: clone(state.midiMappings)
    };
}

export function createVersionedPatch(name, state, factory = false) {
    return {
        name,
        factory,
        created: new Date().toISOString(),
        state: normalizePatch(state)
    };
}

export function migratePatchCollection(patches, { moduleOrder = [] } = {}) {
    let changed = false;
    const migrated = {};

    Object.entries(patches || {}).forEach(([name, patch]) => {
        const nextPatch = {
            ...patch,
            name: patch.name || name,
            state: normalizePatch(patch.state || patch, { moduleOrder })
        };
        migrated[name] = nextPatch;
        if (patch.state?.version !== PATCH_VERSION) {
            changed = true;
        }
    });

    return { patches: migrated, changed };
}
