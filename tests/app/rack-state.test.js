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

    it('adds rack rows and uses them when earlier rows are full', () => {
        const rack = new RackState();
        rack.addModule('wide', registry, { id: 'wide_1', row: 1 });
        rack.addModule('wide', registry, { id: 'wide_2', row: 2 });

        expect(rack.findFirstFittingRow(registry.get('vco'), registry)).toBeNull();

        const row = rack.addRow();
        const moduleState = rack.addModule('vco', registry);

        expect(row).toBe(3);
        expect(moduleState.row).toBe(3);
        expect(rack.getRowNumbers()).toEqual([1, 2, 3]);
    });

    it('removes a rack row, connected cables, and compacts later row numbers', () => {
        const rack = new RackState();
        rack.addRow();
        rack.addModule('vco', registry, { id: 'vco_1', row: 1 });
        rack.addModule('vca', registry, { id: 'vca_1', row: 2 });
        rack.addModule('vco', registry, { id: 'vco_2', row: 3 });
        rack.connect({ fromModule: 'vco_1', fromPort: 'out', toModule: 'vca_1', toPort: 'in' });
        rack.connect({ fromModule: 'vco_2', fromPort: 'out', toModule: 'vco_1', toPort: 'in' });

        const result = rack.removeRow(2);

        expect(result).toEqual({ row: 2, removedModuleIds: ['vca_1'] });
        expect(rack.getRowNumbers()).toEqual([1, 2]);
        expect(rack.getModule('vca_1')).toBeNull();
        expect(rack.getModule('vco_2').row).toBe(2);
        expect(rack.getRow(2)).toEqual(['vco_2']);
        expect(rack.cables).toEqual([
            { fromModule: 'vco_2', fromPort: 'out', toModule: 'vco_1', toPort: 'in' }
        ]);
    });

    it('removes connected cables when a module is removed', () => {
        const rack = new RackState();
        rack.addModule('vco', registry, { id: 'vco_1' });
        rack.addModule('vca', registry, { id: 'vca_1' });
        rack.connect({ fromModule: 'vco_1', fromPort: 'out', toModule: 'vca_1', toPort: 'in' });

        rack.removeModule('vco_1');

        expect(rack.cables).toEqual([]);
    });

    it('serializes canonical v3 patch state', () => {
        const rack = new RackState();
        rack.addModule('vco', registry, { id: 'vco_1' });
        rack.setParam('vco_1', 'coarse', 0.7);

        expect(rack.serializePatch()).toMatchObject({
            version: 3, plugins: { core: 1 },
            modules: [{ id: 'vco_1', type: 'vco', row: 1, index: 0 }],
            params: { vco_1: { coarse: 0.7 } }
        });
    });

    it('loads and serializes patches with more than two rows', () => {
        const rack = new RackState();

        rack.loadPatch({
            version: 3, plugins: { core: 1 },
            modules: [
                { id: 'vco_1', type: 'vco', row: 3, index: 0 }
            ],
            params: { vco_1: { coarse: 0.6 } },
            cables: [],
            midiMappings: {}
        }, registry);

        expect(rack.getRowNumbers()).toEqual([1, 2, 3]);
        expect(rack.getRow(3)).toEqual(['vco_1']);
        expect(rack.serializePatch().modules).toEqual([
            { id: 'vco_1', type: 'vco', row: 3, index: 0 }
        ]);
    });
});
