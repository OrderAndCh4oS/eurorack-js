import { describe, it, expect } from 'vitest';
import { migratePatchCollection, normalizePatch } from '../../src/js/app/patch-format.js';

describe('patch-format', () => {
    it('normalizes legacy module layout and params into v2 state', () => {
        const legacy = {
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
        };

        expect(normalizePatch(legacy)).toEqual({
            version: 2,
            modules: [
                { id: 'vco', type: 'vco', row: 1, index: 0 },
                { id: 'out', type: 'out', row: 1, index: 1 }
            ],
            params: {
                vco: { coarse: 0.3 },
                out: { volume: 0.5 }
            },
            cables: [
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'out', toPort: 'L' }
            ],
            midiMappings: {}
        });
    });

    it('infers legacy type-based modules when layout is missing', () => {
        const normalized = normalizePatch({
            knobs: { vco: { coarse: 0.4 }, out: { volume: 0.8 } },
            cables: [{ fromModule: 'vco', fromPort: 'triangle', toModule: 'out', toPort: 'L' }]
        }, { moduleOrder: ['clk', 'vco', 'out'] });

        expect(normalized.modules.map(mod => mod.id)).toEqual(['vco', 'out']);
        expect(normalized.params.vco.coarse).toBe(0.4);
        expect(normalized.cables[0].toModule).toBe('out');
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

    it('marks legacy patch collections as changed for one-time migration', () => {
        const { patches, changed } = migratePatchCollection({
            Demo: {
                name: 'Demo',
                state: { knobs: { vco: { coarse: 0.2 } }, cables: [] }
            }
        }, { moduleOrder: ['vco'] });

        expect(changed).toBe(true);
        expect(patches.Demo.state.version).toBe(2);
    });
});
