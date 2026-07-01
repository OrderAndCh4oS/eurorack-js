import { describe, it, expect } from 'vitest';
import { RackState } from '../../src/js/app/rack-state.js';

const registry = {
    definitions: {
        vco: {
            id: 'vco',
            hp: 4,
            ui: {
                knobs: [{ id: 'coarse', param: 'coarse', default: 0.4 }],
                buttons: []
            }
        },
        vca: {
            id: 'vca',
            hp: 4,
            ui: {
                knobs: [{ id: 'gain', param: 'gain', default: 0.8 }],
                buttons: []
            }
        },
        wide: { id: 'wide', hp: 84, ui: { knobs: [], buttons: [] } }
    },
    get(id) {
        return this.definitions[id];
    }
};

describe('RackState', () => {
    it('allows duplicate module types with stable instance ids', () => {
        const rack = new RackState();

        const first = rack.addModule('vco', registry);
        const second = rack.addModule('vco', registry);

        expect(first.id).toBe('vco_1');
        expect(second.id).toBe('vco_2');
        expect(rack.getRow(1)).toEqual(['vco_1', 'vco_2']);
    });

    it('enforces row HP limits', () => {
        const rack = new RackState();
        rack.addModule('wide', registry, { row: 1, id: 'wide_1' });

        expect(() => rack.addModule('vco', registry, { row: 1 })).toThrow('does not fit');
    });

    it('moves modules between rows while preserving order', () => {
        const rack = new RackState();
        rack.addModule('vco', registry, { id: 'vco_1', row: 1 });
        rack.addModule('vca', registry, { id: 'vca_1', row: 1 });

        rack.moveModule('vca_1', registry, { row: 2, index: 0 });

        expect(rack.getRow(1)).toEqual(['vco_1']);
        expect(rack.getRow(2)).toEqual(['vca_1']);
    });

    it('removes connected cables when a module is removed', () => {
        const rack = new RackState();
        rack.addModule('vco', registry, { id: 'vco_1' });
        rack.addModule('vca', registry, { id: 'vca_1' });
        rack.connect({ fromModule: 'vco_1', fromPort: 'out', toModule: 'vca_1', toPort: 'in' });

        rack.removeModule('vco_1');

        expect(rack.cables).toEqual([]);
    });

    it('serializes canonical v2 patch state', () => {
        const rack = new RackState();
        rack.addModule('vco', registry, { id: 'vco_1' });
        rack.setParam('vco_1', 'coarse', 0.7);

        expect(rack.serializePatch()).toMatchObject({
            version: 2,
            modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
            params: { vco_1: { coarse: 0.7 } }
        });
    });
});
