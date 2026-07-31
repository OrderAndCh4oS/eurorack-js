import { describe, expect, it } from 'vitest';
import { RackState } from '../../src/js/app/rack-state.js';
import probSeqModule from '../../src/js/modules/prob-seq/index.js';

const registry = {
    get(id) {
        return id === 'prob-seq' ? probSeqModule : null;
    }
};

describe('prob-seq rack persistence', () => {
    it('serializes and restores untouched structured step defaults', () => {
        const rack = new RackState();
        const added = rack.addModule('prob-seq', registry, { id: 'probSeq' });
        const serialized = rack.serializePatch();

        expect(added.params.steps).toEqual(probSeqModule.ui.state[0].default);
        expect(added.params.steps).not.toBe(probSeqModule.ui.state[0].default);
        expect(serialized.params.probSeq.steps).toEqual(probSeqModule.ui.state[0].default);

        const restored = new RackState();
        restored.loadPatch(serialized, registry);
        const restoredSteps = restored.getModule('probSeq').params.steps;

        expect(restoredSteps).toEqual(probSeqModule.ui.state[0].default);
        expect(restoredSteps).not.toBe(added.params.steps);
    });
});
