import { beforeAll, describe, it, expect } from 'vitest';
import {
    PATCH_URL_FORMAT,
    createPatchUrlHash,
    normalizePatch,
    normalizePatchCollection,
    parsePatchUrlHash,
    patchUrlTestInternals
} from '../../src/js/app/patch-format.js';
import { FACTORY_PATCHES } from '../../src/js/config/factory-patches.js';
import { loadModules, DEFAULT_MODULE_ORDER } from '../../src/js/index.js';
import { moduleRegistry } from '../../src/js/rack/registry.js';

function toLegacyBase64Url(value) {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/g, '');
}

function createDensePatchState() {
    return {
        version: 2,
        modules: Array.from({ length: 24 }, (_, index) => ({
            id: `vco_${index}`,
            type: index % 2 ? 'vca' : 'vco',
            row: Math.floor(index / 8) + 1,
            index: index % 8
        })),
        params: Object.fromEntries(Array.from({ length: 24 }, (_, index) => [
            `vco_${index}`,
            {
                coarse: 0.423456,
                fine: 0.012345,
                ch1Gain: 0.812345,
                ch2Gain: 0.712345
            }
        ])),
        cables: Array.from({ length: 20 }, (_, index) => ({
            fromModule: `vco_${index}`,
            fromPort: 'triangle',
            toModule: `vco_${index + 1}`,
            toPort: 'ch1In'
        })),
        midiMappings: {}
    };
}

describe('patch-format', () => {
    const urlOptions = () => ({
        moduleOrder: DEFAULT_MODULE_ORDER,
        moduleRegistry
    });

    beforeAll(async () => {
        await loadModules();
    });

    it('rejects patch state without canonical v2 version', () => {
        expect(() => normalizePatch({
            modules: [],
            params: {},
            cables: [],
            midiMappings: {}
        })).toThrow('Unsupported patch state version: missing');
    });

    it('rejects legacy module layout and params', () => {
        expect(() => normalizePatch({
            modules: [
                { type: 'vco', instanceId: 'vco', row: 1 },
                { type: 'out', instanceId: 'out', row: 1 }
            ],
            knobs: {
                vco: { coarse: 0.3 },
                out: { volume: 0.5 }
            },
            switches: {},
            buttons: {},
            cables: [
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'out', toPort: 'L' }
            ]
        })).toThrow('Unsupported patch state version: missing');
    });

    it('rejects legacy groups even when version is present', () => {
        expect(() => normalizePatch({
            version: 2,
            modules: [{ id: 'vco', type: 'vco', row: 1, index: 0 }],
            params: {},
            knobs: { vco: { coarse: 0.4 } },
            cables: [],
            midiMappings: {}
        })).toThrow('Legacy patch fields are not supported');
    });

    it('preserves canonical v2 shape without legacy groups', () => {
        const v2 = {
            version: 2,
            modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
            params: { vco_1: { coarse: 0.5 } },
            cables: [],
            midiMappings: { '0:74': { moduleId: 'vco_1', paramId: 'coarse' } }
        };

        expect(normalizePatch(v2)).toEqual(v2);
    });

    it('rejects unsupported patch collections', () => {
        expect(() => normalizePatchCollection({
            Demo: {
                name: 'Demo',
                state: { knobs: { vco: { coarse: 0.2 } }, cables: [] }
            }
        })).toThrow('Unsupported patch state version: missing');
    });

    it('round-trips patch state through a shareable URL hash', async () => {
        const state = {
            version: 2,
            modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
            params: { vco_1: { coarse: 0.42 } },
            cables: [],
            midiMappings: {}
        };

        const hash = await createPatchUrlHash({ name: 'Shared Lead', state }, urlOptions());
        const parsed = await parsePatchUrlHash(`#${hash}`, urlOptions());

        expect(hash).toMatch(new RegExp(`^patch=${PATCH_URL_FORMAT}\\.`));
        expect(parsed.name).toBe('Shared Lead');
        expect(parsed.state).toEqual(state);
    });

    it('preserves rows, indices, cables, and midi mappings in compact share hashes', async () => {
        const state = {
            version: 2,
            modules: [
                { id: 'custom_lfo', type: 'lfo', row: 1, index: 2 },
                { id: 'vco_1', type: 'vco', row: 3, index: 0 }
            ],
            params: {
                custom_lfo: { rateKnob: 0.2 },
                vco_1: { coarse: 0.45, fine: 0.01 }
            },
            cables: [
                { fromModule: 'custom_lfo', fromPort: 'primary', toModule: 'vco_1', toPort: 'vOct' }
            ],
            midiMappings: { '0:74': { moduleId: 'vco_1', paramId: 'coarse' } }
        };

        expect(await parsePatchUrlHash(
            `#${await createPatchUrlHash({ name: 'Complex Link', state }, urlOptions())}`,
            urlOptions()
        )).toEqual({
            name: 'Complex Link',
            factory: false,
            state
        });
    });

    it('rounds URL patch numbers to three decimal places', async () => {
        const state = {
            version: 2,
            modules: [{ id: 'filetest_1', type: 'filetest', row: 1, index: 0 }],
            params: { filetest_1: { level: 0.123456, offset: -0.00001 } },
            cables: [],
            midiMappings: { '0:74': { moduleId: 'filetest_1', amount: 0.987654 } }
        };

        const parsed = await parsePatchUrlHash(
            `#${await createPatchUrlHash({ name: 'Rounded', state }, urlOptions())}`,
            urlOptions()
        );

        expect(parsed.state.params.filetest_1.level).toBe(0.123);
        expect(parsed.state.params.filetest_1.offset).toBe(0);
        expect(parsed.state.midiMappings['0:74'].amount).toBe(0.988);
    });

    it('compresses realistic patch URL hashes before base64url encoding', async () => {
        const state = createDensePatchState();
        const payload = { name: 'Dense Patch', factory: false, state };
        const compressedHash = await createPatchUrlHash({ name: 'Dense Patch', state }, urlOptions());
        const legacyHash = `patch=${toLegacyBase64Url(JSON.stringify(payload))}`;

        expect(compressedHash.length).toBeLessThan(legacyHash.length);
        expect(compressedHash.length).toBeLessThan(legacyHash.length * 0.4);
        expect((await parsePatchUrlHash(`#${compressedHash}`, urlOptions())).state.params.vco_0.coarse).toBe(0.423);
    });

    it('serializes compact payloads smaller than ordinary patch JSON before compression', () => {
        const state = createDensePatchState();
        const jsonPayload = JSON.stringify({ name: 'Dense Patch', factory: false, state });
        const compactPayload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Dense Patch', state }, urlOptions());
        const compactJson = JSON.stringify(compactPayload);

        expect(compactPayload[0]).toBe(1);
        expect(compactJson.length).toBeLessThan(jsonPayload.length);
        expect(compactJson.length).toBeLessThan(jsonPayload.length * 0.45);
    });

    it('compresses compact payloads smaller than their pre-compression serialized form', async () => {
        const state = createDensePatchState();
        const compactPayload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Dense Patch', state }, urlOptions());
        const compactJson = JSON.stringify(compactPayload);
        const compressedPayload = await patchUrlTestInternals.encodePatchUrlPayload(compactPayload);

        expect(compressedPayload).toMatch(new RegExp(`^${PATCH_URL_FORMAT}\\.`));
        expect(compressedPayload.length).toBeLessThan(compactJson.length);
        expect(compressedPayload.length).toBeLessThan(compactJson.length * 0.65);
    });

    it('keeps compressed compact URLs materially smaller than base64 JSON patch URLs', async () => {
        const state = createDensePatchState();
        const jsonPayload = JSON.stringify({ name: 'Dense Patch', factory: false, state });
        const base64JsonPayload = toLegacyBase64Url(jsonPayload);
        const compactPayload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Dense Patch', state }, urlOptions());
        const compressedPayload = await patchUrlTestInternals.encodePatchUrlPayload(compactPayload);

        expect(compressedPayload.length).toBeLessThan(base64JsonPayload.length);
        expect(compressedPayload.length).toBeLessThan(base64JsonPayload.length * 0.32);
    });

    it('round-trips compact payloads through the payload parser', () => {
        const state = createDensePatchState();
        const compactPayload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Dense Patch', state }, urlOptions());
        const parsed = patchUrlTestInternals.parseCompactPatchUrlPayload(compactPayload, urlOptions());

        expect(parsed.name).toBe('Dense Patch');
        expect(parsed.state.modules).toEqual(state.modules);
        expect(parsed.state.cables).toEqual(state.cables);
        expect(parsed.state.params.vco_0).toEqual({
            coarse: 0.423,
            fine: 0.012,
            ch1Gain: 0.812,
            ch2Gain: 0.712
        });
    });

    it('serializes modules as compact type refs with custom IDs only when needed', () => {
        const state = {
            version: 2,
            modules: [
                { id: 'vco_1', type: 'vco', row: 1, index: 0 },
                { id: 'lead_voice', type: 'vco', row: 2, index: 1 },
                { id: 'out_1', type: 'out', row: 2, index: 2 }
            ],
            params: {},
            cables: [],
            midiMappings: {}
        };
        const payload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Module Shape', state }, urlOptions());
        const [, localTokens, [nameRef, modules]] = payload;

        expect(nameRef).toBeLessThan(0);
        expect(localTokens).toContain('Module Shape');
        expect(modules[0]).toHaveLength(1);
        expect(modules[1]).toHaveLength(4);
        expect(localTokens[modules[1][3] * -1 - 1]).toBe('lead_voice');
        expect(modules[2]).toEqual(expect.arrayContaining([2, 2]));
    });

    it('serializes cables with module indexes instead of module IDs', () => {
        const state = {
            version: 2,
            modules: [
                { id: 'vco_1', type: 'vco', row: 1, index: 0 },
                { id: 'out_1', type: 'out', row: 1, index: 1 }
            ],
            params: {},
            cables: [
                { fromModule: 'vco_1', fromPort: 'triangle', toModule: 'out_1', toPort: 'L' }
            ],
            midiMappings: {}
        };
        const payload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Cable Shape', state }, urlOptions());
        const cables = payload[2][3];
        const parsed = patchUrlTestInternals.parseCompactPatchUrlPayload(payload, urlOptions());

        expect(cables).toHaveLength(1);
        expect(cables[0][0]).toBe(0);
        expect(cables[0][2]).toBe(1);
        expect(cables[0][1]).not.toBe('triangle');
        expect(cables[0][3]).not.toBe('L');
        expect(parsed.state.cables).toEqual(state.cables);
    });

    it('serializes simple MIDI mappings as mapping key plus module index and param ref', () => {
        const state = {
            version: 2,
            modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
            params: {},
            cables: [],
            midiMappings: { '0:74': { moduleId: 'vco_1', paramId: 'coarse' } }
        };
        const payload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'MIDI Shape', state }, urlOptions());
        const midiMappings = payload[2][4];
        const parsed = patchUrlTestInternals.parseCompactPatchUrlPayload(payload, urlOptions());

        expect(midiMappings).toHaveLength(1);
        expect(midiMappings[0]).toHaveLength(3);
        expect(midiMappings[0][1]).toBe(0);
        expect(midiMappings[0][2]).not.toBe('coarse');
        expect(parsed.state.midiMappings).toEqual(state.midiMappings);
    });

    it('round-trips nested custom compact values in params and MIDI mappings', () => {
        const state = {
            version: 2,
            modules: [{ id: 'custom_1', type: 'custom', row: 1, index: 0 }],
            params: {
                custom_1: {
                    mode: 'fold',
                    curve: [0.12345, 'soft'],
                    meta: { label: 'lead', depth: 0.98765 }
                }
            },
            cables: [],
            midiMappings: {
                '0:91': {
                    moduleId: 'custom_1',
                    paramId: 'meta.depth',
                    amount: 0.33333,
                    label: 'macro'
                }
            }
        };
        const payload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Nested Values', state }, urlOptions());
        const parsed = patchUrlTestInternals.parseCompactPatchUrlPayload(payload, urlOptions());

        expect(parsed.state.params.custom_1).toEqual({
            mode: 'fold',
            curve: [0.123, 'soft'],
            meta: { label: 'lead', depth: 0.988 }
        });
        expect(parsed.state.midiMappings['0:91']).toEqual({
            moduleId: 'custom_1',
            paramId: 'meta.depth',
            amount: 0.333,
            label: 'macro'
        });
    });

    it('rejects unknown compact payload versions before decompression is involved', () => {
        const payload = patchUrlTestInternals.createCompactPatchUrlPayload({
            name: 'Bad Version',
            state: { version: 2, modules: [], params: {}, cables: [], midiMappings: {} }
        }, urlOptions());

        expect(() => patchUrlTestInternals.parseCompactPatchUrlPayload([99, ...payload.slice(1)], urlOptions()))
            .toThrow('Unsupported compact patch URL payload');
    });

    it('omits module default params from compact payloads', () => {
        const state = {
            version: 2,
            modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
            params: { vco_1: { coarse: 0.4, fine: 0.125 } },
            cables: [],
            midiMappings: {}
        };
        const payload = patchUrlTestInternals.createCompactPatchUrlPayload({ name: 'Defaults', state }, urlOptions());
        const parsed = patchUrlTestInternals.parseCompactPatchUrlPayload(payload, urlOptions());

        expect(parsed.state.params.vco_1).toEqual({ fine: 0.125 });
    });

    it('keeps large factory patch URLs below practical share-size targets', async () => {
        const deepAbyssHash = await createPatchUrlHash(FACTORY_PATCHES['Demo - Deep Abyss'], urlOptions());
        const neonGridHash = await createPatchUrlHash(FACTORY_PATCHES['Demo - Neon Grid'], urlOptions());

        expect(deepAbyssHash.length).toBeLessThan(900);
        expect(neonGridHash.length).toBeLessThan(1400);
    });

    it('returns null for hashes without patch payloads', async () => {
        expect(await parsePatchUrlHash('', urlOptions())).toBeNull();
        expect(await parsePatchUrlHash('#theme=dark', urlOptions())).toBeNull();
    });

    it('rejects unsupported share URL formats', async () => {
        await expect(parsePatchUrlHash('#patch=p1.old', urlOptions())).rejects.toThrow('Unsupported patch URL format');
    });
});
