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

    it('serializes and restores every edited step field with fresh identities', () => {
        const rack = new RackState();
        const added = rack.addModule('prob-seq', registry, { id: 'probSeq' });
        const editedSteps = Array.from({ length: 8 }, (_, index) => ({
            enabled: index % 2,
            probability: 7 + index * 11,
            ratchets: index + 1,
            condition: (index + 3) % 11
        }));
        added.params.seed = 4242;
        added.params.length = 5;
        added.params.fallbackBpm = 173;
        added.params.steps = editedSteps;

        const serialized = rack.serializePatch();
        const restored = new RackState();
        restored.loadPatch(serialized, registry);
        const restoredModule = restored.getModule('probSeq');

        expect(restoredModule.params).toEqual({
            seed: 4242,
            length: 5,
            fallbackBpm: 173,
            steps: editedSteps
        });
        expect(restoredModule.params.steps).not.toBe(editedSteps);
        restoredModule.params.steps.forEach((step, index) => {
            expect(step).not.toBe(editedSteps[index]);
        });
    });
});
