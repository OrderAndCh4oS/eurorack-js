import { createHash } from 'node:crypto';
import { CORE_MODULE_DEFINITIONS } from '../src/js/rack/core-definitions.js';
import { normalizePatch } from '../src/js/app/patch-format.js';
import { controlRange, getControlDomain, legalControlValue } from '../src/js/rack/control-domain.js';

export const LIMITS = Object.freeze({ stateBytes: 262144, modules: 256, cables: 2048, rows: 32,
    patches: 100, accountStateBytes: 10 * 1024 * 1024, accountImageBytes: 50 * 1024 * 1024,
    uploadBytes: 2 * 1024 * 1024, imagePixels: 8000000, imageBytes: 1024 * 1024, pageSize: 24 });
export class HttpError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function assert(condition, message, status = 400, code = 'invalid_request') {
    if (!condition) throw new HttpError(status, code, message);
}
export function id(value, field = 'id') {
    assert(typeof value === 'string' && /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value), `${field} must be a ULID.`);
    return value;
}
export function textField(value, field, maximum, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    assert(typeof value === 'string', `${field} must be text.`);
    const result = value.trim();
    assert(result.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result), `${field} is too long or contains control characters.`);
    return result;
}
export function visibility(value = 'private') {
    assert(value === 'private' || value === 'public', 'Visibility must be private or public.');
    return value;
}
export function revision(value) {
    assert(Number.isSafeInteger(value) && value > 0, 'expectedRevision is required.'); return value;
}
export function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
    return JSON.stringify(value);
}
export const hash = value => createHash('sha256').update(stableJson(value)).digest('hex');

// Read only module contracts. In particular, never instantiate DSP on a web server.
export function createMetadataRegistry(definitions = CORE_MODULE_DEFINITIONS) {
    const modules = new Map(definitions.map(definition => [definition.id, definition]));
    return { get: key => modules.get(key), has: key => modules.has(key),
        getPlugin: key => key === 'core' ? { manifest: { patchVersion: 1 } } : undefined,
        getPluginForModule: key => modules.has(key) ? 'core' : undefined };
}
const registry = createMetadataRegistry();

// Hosted saves contain patch data for shipped modules, never executable plugins.
// Keep this separate from normalization so stored copies retain their exact hash.
export function assertBuiltInModules(state, contracts = registry) {
    const externalPlugin = state?.plugins && typeof state.plugins === 'object' &&
        Object.keys(state.plugins).some(pluginId => pluginId !== 'core');
    const externalModule = Array.isArray(state?.modules) && state.modules.some(module =>
        typeof module?.type === 'string' && contracts.getPluginForModule(module.type) !== 'core');
    assert(!externalPlugin && !externalModule,
        'Only built-in modules can be saved to an account. Submit tested modules through a GitHub pull request.',
        400, 'unsupported_module');
}

function boundedTree(value, depth = 0) {
    assert(depth <= 24, 'Patch nesting is too deep.');
    if (typeof value === 'number') assert(Number.isFinite(value), 'Patch numbers must be finite.');
    if (value && typeof value === 'object') {
        assert(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype, 'Patch values must be JSON.');
        for (const [key, child] of Object.entries(value)) {
            assert(!['__proto__', 'prototype', 'constructor'].includes(key), 'Unsafe patch key.');
            boundedTree(child, depth + 1);
        }
    } else assert(['string', 'number', 'boolean'].includes(typeof value) || value === null, 'Patch values must be JSON.');
}
export function validateState(raw, contracts = registry) {
    boundedTree(raw);
    assert(Buffer.byteLength(JSON.stringify(raw)) <= LIMITS.stateBytes, 'Patch exceeds 256 KiB.', 413, 'patch_too_large');
    assert(raw && !raw.state && Array.isArray(raw.modules) && raw.modules.length <= LIMITS.modules, 'Invalid patch modules.');
    assert(Array.isArray(raw.cables) && raw.cables.length <= LIMITS.cables, 'Too many patch cables.');
    assertBuiltInModules(raw, contracts);
    const placements = new Set(); const rowHP = new Map();
    for (const module of raw.modules) {
        assert(module && typeof module.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(module.id), 'Invalid module instance ID.');
        assert(typeof module.type === 'string', 'Invalid module type.');
        assert(Number.isInteger(module.row) && module.row >= 1 && module.row <= LIMITS.rows, 'Invalid rack row.');
        assert(Number.isInteger(module.index) && module.index >= 0 && module.index < LIMITS.modules, 'Invalid rack position.');
        const place = `${module.row}:${module.index}`;
        assert(!placements.has(place), 'Two modules occupy the same rack position.'); placements.add(place);
        rowHP.set(module.row, (rowHP.get(module.row) || 0) + (contracts.get(module.type)?.hp || 0));
        assert(rowHP.get(module.row) <= 84, 'Rack row exceeds 84 HP.');
        for (const [param, value] of Object.entries(raw.params?.[module.id] || {})) {
            const domain = getControlDomain(contracts.get(module.type), param);
            if (domain) assert(legalControlValue(domain, value), `Parameter ${module.id}.${param} is outside its declared control settings.`);
        }
    }
    let state;
    try { state = normalizePatch(raw, { registry: contracts }); }
    catch (error) { throw new HttpError(400, 'invalid_patch', error.message); }
    assert(Object.keys(state.midiMappings).length <= 2048, 'Too many MIDI mappings.');
    for (const [key, mapping] of Object.entries(state.midiMappings)) {
        const parts = /^(\d{1,2}):(\d{1,3})$/.exec(key);
        const module = state.modules.find(item => item.id === mapping?.moduleId);
        assert(parts && Number(parts[1]) <= 15 && Number(parts[2]) <= 127 && module, 'Invalid MIDI mapping target.');
        const domain = getControlDomain(contracts.get(module.type), mapping.paramId);
        assert(domain, 'MIDI mappings must target a visible control.');
        assert(Number.isFinite(mapping.min) && Number.isFinite(mapping.max) && mapping.min <= mapping.max, 'Invalid MIDI mapping range.');
        const { min, max } = controlRange(domain);
        assert(mapping.min >= min && mapping.max <= max, 'MIDI mapping is outside its control range.');
        assert(Object.keys(mapping).every(k => ['moduleId', 'paramId', 'min', 'max'].includes(k)), 'Unsupported MIDI mapping field.');
    }
    return { state, stateHash: hash(state), stateBytes: Buffer.byteLength(JSON.stringify(state)) };
}
export function publicName(value) {
    const name = textField(value, 'Public name', 80, 'Patch maker');
    assert(name && !name.includes('@'), 'Use a public name, not an email address.');
    assert(!/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value ?? ''), 'Public name must be a single line without control characters.');
    return name;
}
