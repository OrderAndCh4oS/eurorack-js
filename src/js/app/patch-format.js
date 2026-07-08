import { createDefaultParams } from './rack-state.js';

export const PATCH_VERSION = 2;
export const COMPACT_PATCH_URL_VERSION = 1;
export const PATCH_URL_FORMAT = 'gz1';
const PATCH_COMPRESSION_FORMAT = 'gzip';
const URL_NUMBER_DECIMALS = 3;

function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function encodeUtf8(value) {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value);
    }
    return Buffer.from(value, 'utf8');
}

function decodeUtf8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
    }
    return Buffer.from(bytes).toString('utf8');
}

function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
}

function encodeBytesBase64Url(bytes) {
    return bytesToBase64(bytes)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/g, '');
}

function base64ToBytes(base64) {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(base64, 'base64'));
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function decodeBytesBase64Url(value) {
    const base64 = value
        .replaceAll('-', '+')
        .replaceAll('_', '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');
    return base64ToBytes(base64);
}

function assertCompressionStreams() {
    if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') {
        throw new Error('Shared patch links require a browser with gzip CompressionStream support');
    }
}

async function streamToArrayBuffer(stream) {
    return new Response(stream).arrayBuffer();
}

async function compressPatchPayloadToBase64Url(value) {
    assertCompressionStreams();
    let stream;
    try {
        stream = new Response(encodeUtf8(value)).body.pipeThrough(new CompressionStream(PATCH_COMPRESSION_FORMAT));
    } catch (error) {
        throw new Error(`gzip compression is not supported: ${error.message}`);
    }
    return encodeBytesBase64Url(new Uint8Array(await streamToArrayBuffer(stream)));
}

async function decompressPatchPayloadFromBase64Url(value) {
    assertCompressionStreams();
    let stream;
    try {
        stream = new Response(decodeBytesBase64Url(value)).body.pipeThrough(new DecompressionStream(PATCH_COMPRESSION_FORMAT));
    } catch (error) {
        throw new Error(`gzip decompression is not supported: ${error.message}`);
    }
    return decodeUtf8(new Uint8Array(await streamToArrayBuffer(stream)));
}

function roundUrlNumber(value) {
    if (!Number.isFinite(value)) return value;
    const rounded = Number(value.toFixed(URL_NUMBER_DECIMALS));
    return Object.is(rounded, -0) ? 0 : rounded;
}

function createStringTable() {
    const strings = [];
    const indexes = new Map();

    return {
        strings,
        ref(value) {
            const text = String(value ?? '');
            if (!indexes.has(text)) {
                indexes.set(text, strings.length);
                strings.push(text);
            }
            return indexes.get(text);
        }
    };
}

function createTokenTable(moduleDefinitions = []) {
    const tokens = [];
    const indexes = new Map();

    function add(value) {
        const text = String(value ?? '');
        if (indexes.has(text)) return indexes.get(text);
        indexes.set(text, tokens.length);
        tokens.push(text);
        return indexes.get(text);
    }

    moduleDefinitions.forEach(definition => {
        add(definition.id);
        const ui = definition.ui || {};
        (ui.knobs || []).forEach(knob => add(knob.param));
        (ui.switches || []).forEach(sw => add(sw.param));
        (ui.buttons || []).forEach(button => add(button.param));
        (ui.inputs || []).forEach(input => add(input.port));
        (ui.outputs || []).forEach(output => add(output.port));
    });

    return { tokens, indexes };
}

function getModuleDefinitions({ moduleDefinitions = null, moduleRegistry = null } = {}) {
    if (Array.isArray(moduleDefinitions)) return moduleDefinitions;
    if (typeof moduleRegistry?.getAllDefinitions === 'function') return moduleRegistry.getAllDefinitions();
    return [];
}

function createReferenceTables(options = {}) {
    const staticTable = createTokenTable(getModuleDefinitions(options));
    const localTable = createStringTable();

    return {
        staticTokens: staticTable.tokens,
        localTokens: localTable.strings,
        ref(value) {
            const text = String(value ?? '');
            if (staticTable.indexes.has(text)) return staticTable.indexes.get(text);
            return -(localTable.ref(text) + 1);
        },
        resolve(ref) {
            if (ref >= 0) return staticTable.tokens[ref] ?? '';
            return localTable.strings[-ref - 1] ?? '';
        }
    };
}

function isCanonicalInstanceId(id, type, count) {
    return id === `${type}_${count}`;
}

function roundUrlNumberValue(value) {
    if (typeof value === 'number') return roundUrlNumber(value);
    if (Array.isArray(value)) return value.map(roundUrlNumberValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundUrlNumberValue(item)]));
    }
    return value;
}

function getDefaultParamsForModule(type, definitionsById) {
    const definition = definitionsById.get(type);
    return definition ? createDefaultParams(definition) : {};
}

function createDefinitionsById(options = {}) {
    return new Map(getModuleDefinitions(options).map(definition => [definition.id, definition]));
}

function valuesEqualForUrl(value, defaultValue) {
    return JSON.stringify(roundUrlNumberValue(value)) === JSON.stringify(roundUrlNumberValue(defaultValue));
}

function encodeCompactValue(value, ref) {
    if (typeof value === 'number') return roundUrlNumber(value);
    if (typeof value === 'string') return [0, ref(value)];
    if (Array.isArray(value)) return [1, value.map(item => encodeCompactValue(item, ref))];
    if (value && typeof value === 'object') {
        return [2, Object.entries(value).map(([key, item]) => [ref(key), encodeCompactValue(item, ref)])];
    }
    return value;
}

function decodeCompactValue(value, resolve) {
    if (!Array.isArray(value)) return value;

    const [type, payload] = value;
    if (type === 0) return resolve(payload);
    if (type === 1) return (payload || []).map(item => decodeCompactValue(item, resolve));
    if (type === 2) {
        return Object.fromEntries((payload || []).map(([key, item]) => [
            resolve(key),
            decodeCompactValue(item, resolve)
        ]));
    }

    return value.map(item => decodeCompactValue(item, resolve));
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

function createCompactPatchUrlPayload(patch, options = {}) {
    const { moduleOrder = [] } = options;
    const name = patch?.name || 'Shared Patch';
    const state = normalizePatch(patch?.state || patch, { moduleOrder });
    const references = createReferenceTables(options);
    const definitionsById = createDefinitionsById(options);
    const moduleIndexById = new Map(state.modules.map((mod, index) => [mod.id, index]));
    const typeCounts = {};
    const modules = state.modules.map((mod, position) => {
        typeCounts[mod.type] = (typeCounts[mod.type] || 0) + 1;
        const row = mod.row || 1;
        const index = mod.index ?? position;
        const isCanonical = isCanonicalInstanceId(mod.id, mod.type, typeCounts[mod.type]);
        const tuple = [references.ref(mod.type)];
        if (row !== 1 || index !== position || !isCanonical) {
            tuple.push(row, index);
        }
        if (!isCanonical) {
            tuple.push(references.ref(mod.id));
        }
        return tuple;
    });
    const params = Object.entries(state.params || {})
        .filter(([, moduleParams]) => Object.keys(moduleParams || {}).length > 0)
        .map(([moduleId, moduleParams]) => {
            const mod = state.modules[moduleIndexById.get(moduleId)];
            const defaults = getDefaultParamsForModule(mod?.type, definitionsById);
            const entries = Object.entries(moduleParams)
                .filter(([param, value]) => !valuesEqualForUrl(value, defaults[param]))
                .map(([param, value]) => [
                    references.ref(param),
                    encodeCompactValue(value, references.ref)
                ]);
            return [moduleIndexById.get(moduleId), entries];
        })
        .filter(([moduleIndex, entries]) => Number.isInteger(moduleIndex) && entries.length > 0);
    const cables = (state.cables || []).map(cable => [
        moduleIndexById.get(cable.fromModule),
        references.ref(cable.fromPort),
        moduleIndexById.get(cable.toModule),
        references.ref(cable.toPort)
    ]).filter(cable => Number.isInteger(cable[0]) && Number.isInteger(cable[2]));
    const midiMappings = Object.entries(state.midiMappings || {}).map(([key, value]) => {
        if (value?.moduleId && value?.paramId && moduleIndexById.has(value.moduleId)) {
            const extras = Object.entries(value)
                .filter(([extraKey]) => extraKey !== 'moduleId' && extraKey !== 'paramId');
            if (extras.length === 0) {
                return [references.ref(key), moduleIndexById.get(value.moduleId), references.ref(value.paramId)];
            }
        }
        return [
            references.ref(key),
            encodeCompactValue(value, references.ref)
        ];
    });
    const payload = [
        COMPACT_PATCH_URL_VERSION,
        references.localTokens,
        [references.ref(name), modules, params, cables]
    ];
    if (Object.keys(state.midiMappings || {}).length > 0) {
        payload[2].push(midiMappings);
    }

    return payload;
}

async function encodePatchUrlPayload(payload) {
    return `${PATCH_URL_FORMAT}.${await compressPatchPayloadToBase64Url(JSON.stringify(payload))}`;
}

export async function createPatchUrlHash(patch, options = {}) {
    const payload = createCompactPatchUrlPayload(patch, options);
    return `patch=${await encodePatchUrlPayload(payload)}`;
}

function parseCompactPatchUrlPayload(payload, options = {}) {
    const { moduleOrder = [] } = options;
    if (!Array.isArray(payload) || payload[0] !== COMPACT_PATCH_URL_VERSION) {
        throw new Error('Unsupported compact patch URL payload');
    }

    const [, localTokens = [], body = []] = payload;
    const references = createReferenceTables(options);
    references.localTokens.splice(0, references.localTokens.length, ...localTokens);
    const [nameRef, modules = [], params = [], cables = [], midiMappings = []] = body;
    const typeCounts = {};
    const reconstructedModules = modules.map((mod, position) => {
        const type = references.resolve(mod[0]);
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        const hasLayout = mod.length >= 3;
        const idRef = mod.length >= 4 ? mod[3] : null;
        return {
            id: idRef === null ? `${type}_${typeCounts[type]}` : references.resolve(idRef),
            type,
            row: hasLayout ? mod[1] : 1,
            index: hasLayout ? mod[2] : position
        };
    });

    return {
        name: (references.resolve(nameRef) || 'Shared Patch').trim() || 'Shared Patch',
        factory: false,
        state: normalizePatch({
            version: PATCH_VERSION,
            modules: reconstructedModules,
            params: Object.fromEntries((params || []).map(([moduleRef, entries]) => [
                reconstructedModules[moduleRef]?.id,
                Object.fromEntries((entries || []).map(([paramRef, value]) => [
                    references.resolve(paramRef),
                    decodeCompactValue(value, references.resolve)
                ]))
            ]).filter(([moduleId]) => moduleId)),
            cables: (cables || []).map(cable => ({
                fromModule: reconstructedModules[cable[0]]?.id,
                fromPort: references.resolve(cable[1]),
                toModule: reconstructedModules[cable[2]]?.id,
                toPort: references.resolve(cable[3])
            })).filter(cable => cable.fromModule && cable.toModule),
            midiMappings: Object.fromEntries((midiMappings || []).map(mapping => {
                const key = references.resolve(mapping[0]);
                if (mapping.length === 3) {
                    return [key, {
                        moduleId: reconstructedModules[mapping[1]]?.id,
                        paramId: references.resolve(mapping[2])
                    }];
                }
                return [
                    key,
                    decodeCompactValue(mapping[1], references.resolve)
                ];
            })),
        }, { moduleOrder })
    };
}

export async function parsePatchUrlHash(hash, options = {}) {
    const rawHash = (hash || '').replace(/^#/, '');
    if (!rawHash) return null;

    const params = new URLSearchParams(rawHash);
    const encoded = params.get('patch');
    if (!encoded) return null;

    if (!encoded.startsWith(`${PATCH_URL_FORMAT}.`)) {
        throw new Error('Unsupported patch URL format');
    }

    const payload = JSON.parse(await decompressPatchPayloadFromBase64Url(encoded.slice(PATCH_URL_FORMAT.length + 1)));
    return parseCompactPatchUrlPayload(payload, options);
}

export const patchUrlTestInternals = {
    createCompactPatchUrlPayload,
    encodePatchUrlPayload,
    parseCompactPatchUrlPayload
};
