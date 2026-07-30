import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import refrainModule, {
    applyRefrainDelta,
    createPcg32,
    createRefrainBaseSnapshot
} from '../../src/js/modules/refrain/index.js';
import testRefrainPatch from '../../src/js/config/patches/test-refrain.js';
import { expectExhaustivePanelCoverage } from './panel-test-helpers.js';

const DEFAULT_SAMPLE_RATE = 1000;
const DEFAULT_BUFFER_SIZE = 8;
const LANES = ['key', 'harm', 'energy', 'mod'];

function createRefrain(options = {}) {
    return refrainModule.createDSP({
        sampleRate: DEFAULT_SAMPLE_RATE,
        bufferSize: DEFAULT_BUFFER_SIZE,
        ...options
    });
}

function clearInputs(dsp) {
    Object.values(dsp.inputs).forEach(input => input.fill(0));
}

function processIdle(dsp) {
    clearInputs(dsp);
    dsp.process();
}

function pulseAction(dsp, param) {
    dsp.params[param] = 1;
    processIdle(dsp);
    dsp.params[param] = 0;
    processIdle(dsp);
}

function clockEdge(dsp, { voltage = 10, reset = 0 } = {}) {
    clearInputs(dsp);
    dsp.inputs.clock[0] = voltage;
    dsp.inputs.reset[0] = reset;
    dsp.process();
    const result = {
        debug: dsp.getDebugState(),
        leds: { ...dsp.leds },
        outputs: Object.fromEntries(
            Object.entries(dsp.outputs).map(([name, output]) => [name, output[0]])
        )
    };
    clearInputs(dsp);
    dsp.process();
    return result;
}

function clockEdges(dsp, count, options = {}) {
    let result;
    for (let edge = 0; edge < count; edge++) {
        result = clockEdge(dsp, options);
    }
    return result;
}

function cloneCells(cells) {
    return cells.map(cell => ({ ...cell }));
}

function changedCellIndices(before, after, length = 8) {
    const changed = [];
    for (let cell = 0; cell < length; cell++) {
        if (LANES.some(lane => before[cell][lane] !== after[cell][lane])) changed.push(cell);
    }
    return changed;
}

function expectCellOutputs(outputs, cell) {
    expect(outputs.key).toBeCloseTo(cell.key / 12, 7);
    expect(outputs.harm).toBeCloseTo(cell.harm / 4, 7);
    expect(outputs.energy).toBeCloseTo(cell.energy / 4, 7);
    expect(outputs.mod).toBeCloseTo(cell.mod / 4, 7);
}

describe('REFRAIN panel, initialization, and deterministic generation', () => {
    it('declares the exact metadata, Run/Hold switch, actions, ports, voltages, and LEDs', () => {
        expect(refrainModule).toMatchObject({
            id: 'refrain',
            name: 'REFRAIN',
            hp: 10,
            color: 'module-color-ten',
            category: 'sequencer'
        });
        expect(refrainModule.render).toBeUndefined();
        expect(refrainModule.ui.knobs).toEqual([
            { id: 'seed', label: 'Seed', param: 'seed', min: 0, max: 65535, default: 0, step: 1 },
            { id: 'length', label: 'Length', param: 'length', min: 1, max: 8, default: 4, step: 1 },
            { id: 'amount', label: 'Amount', param: 'amount', min: 1, max: 8, default: 1, step: 1 },
            { id: 'chance', label: 'Chance', param: 'chance', min: 0, max: 100, default: 20, step: 1 }
        ]);
        expect(refrainModule.ui.switches).toEqual([
            { id: 'anchor', label: 'Anchor Run/Hold', param: 'anchor', default: 0 }
        ]);
        expect(refrainModule.ui.actions).toEqual([
            { id: 'mutate', label: 'Mutate', param: 'mutate', mode: 'trigger', default: 0 },
            { id: 'recall', label: 'Recall', param: 'recall', mode: 'trigger', default: 0 }
        ]);
        expect(refrainModule.ui.inputs).toEqual([
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ]);
        expect(refrainModule.ui.outputs).toEqual([
            { id: 'key', label: 'Key', port: 'key', signal: 'cv', voltage: { min: -1, max: 1 } },
            { id: 'harm', label: 'Harm', port: 'harm', signal: 'cv', voltage: { min: 0, max: 5 } },
            { id: 'energy', label: 'Energy', port: 'energy', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'mod', label: 'Mod', port: 'mod', signal: 'cv', voltage: { min: -5, max: 5 } }
        ]);
        expect(refrainModule.ui.leds).toEqual([
            'cell1', 'cell2', 'cell3', 'cell4', 'cell5', 'cell6', 'cell7', 'cell8',
            'substep', 'anchor', 'pending', 'mutation'
        ]);

        expectExhaustivePanelCoverage(refrainModule, {
            knobs: ['seed', 'length', 'amount', 'chance'],
            switches: ['anchor'],
            actions: ['mutate', 'recall'],
            inputs: ['clock', 'reset'],
            outputs: ['key', 'harm', 'energy', 'mod'],
            leds: [
                'cell1', 'cell2', 'cell3', 'cell4', 'cell5', 'cell6', 'cell7', 'cell8',
                'substep', 'anchor', 'pending', 'mutation'
            ]
        });
    });

    it('locks PCG32 seeding/output vectors and unbiased bounded rejection', () => {
        const vectors = [
            [0, [3894649422, 2055130073, 2315086854, 2925816488, 3443325253, 1644475139], [1528919950, 1015441064]],
            [1, [1412771199, 1791099446, 124312908, 1968572995, 1080415314, 2578637408], [3568277842, 3699242221]],
            [42, [3270867926, 1795671209, 1924641435, 1143034755, 4121910957, 1757328946], [1282605520, 2065939962]],
            [65535, [897602290, 2369527347, 307999653, 406242199, 3116371453, 2898745102], [56096193, 718526563]]
        ];

        vectors.forEach(([seed, expected, state]) => {
            const prng = createPcg32(seed);
            expect(Array.from({ length: 6 }, () => prng.nextUint32())).toEqual(expected);
            expect(prng.getStateWords()).toEqual(state);
        });

        const rejection = createPcg32(0);
        rejection.setStateWords(0, 0);
        expect(rejection.bounded(100)).toBe(45);
        expect(rejection.getStateWords()).toEqual([436792849, 2226810162]);
    });

    it('locks the seed-0 base pattern and post-base PCG continuation state', () => {
        expect(createRefrainBaseSnapshot(0)).toEqual({
            cells: [
                { key: 10, harm: 17, energy: -19, mod: 11 },
                { key: -9, harm: 20, energy: 17, mod: 6 },
                { key: -12, harm: 10, energy: 5, mod: -16 },
                { key: 11, harm: 15, energy: 7, mod: 8 },
                { key: -8, harm: 17, energy: 6, mod: -13 },
                { key: 0, harm: 10, energy: -13, mod: 0 },
                { key: -11, harm: 20, energy: 1, mod: -6 },
                { key: -4, harm: 9, energy: -1, mod: -7 }
            ],
            prngState: [768717768, 1287235282]
        });
    });

    it('creates exact defaults, fixed buffers, cell zero output, and initial LEDs', () => {
        const dsp = createRefrain({ sampleRate: 48000, bufferSize: 17 });
        const base = createRefrainBaseSnapshot(0).cells;

        expect(dsp.params).toEqual({
            seed: 0,
            length: 4,
            amount: 1,
            chance: 20,
            mutate: 0,
            anchor: 0,
            recall: 0
        });
        expect(Object.keys(dsp.inputs)).toEqual(['clock', 'reset']);
        expect(Object.keys(dsp.outputs)).toEqual(['key', 'harm', 'energy', 'mod']);
        [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)].forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(17);
        });
        Object.values(dsp.inputs).forEach(buffer => {
            expect([...buffer]).toEqual(Array(17).fill(0));
        });
        expectCellOutputs(Object.fromEntries(
            Object.entries(dsp.outputs).map(([name, output]) => [name, output[0]])
        ), base[0]);
        expect(dsp.leds).toEqual({
            cell1: 1,
            cell2: 0,
            cell3: 0,
            cell4: 0,
            cell5: 0,
            cell6: 0,
            cell7: 0,
            cell8: 0,
            substep: 1 / 64,
            anchor: 0,
            pending: 0,
            mutation: 0
        });
        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 0,
            activeLength: 4,
            cellIndex: 0,
            substepIndex: 0,
            anchorValid: false,
            pendingMutate: false,
            pendingRecall: false,
            livePattern: base
        });
    });

    it('installs restored visible params before first-process Anchor capture or output', () => {
        const dsp = createRefrain({ bufferSize: 19 });
        const restoredBase = createRefrainBaseSnapshot(474).cells;
        Object.assign(dsp.params, {
            seed: 474,
            length: 6,
            amount: 3,
            chance: 100,
            anchor: 1,
            recall: 1
        });

        dsp.process();

        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 474,
            activeLength: 6,
            cellIndex: 0,
            substepIndex: 0,
            anchorValid: true,
            pendingRecall: false,
            basePattern: restoredBase,
            livePattern: restoredBase,
            anchorPattern: restoredBase,
            prngState: createRefrainBaseSnapshot(474).prngState
        });
        Object.entries(dsp.outputs).forEach(([lane, output]) => {
            const divisor = lane === 'key' ? 12 : 4;
            output.forEach(value => {
                expect(value).toBeCloseTo(restoredBase[0][lane] / divisor, 6);
            });
        });
        expect(dsp.leds.anchor).toBe(1);
        expect(dsp.leds.cell1).toBe(1);
        expect(dsp.leds.pending).toBe(0);

        dsp.params.recall = 0;
        processIdle(dsp);
        dsp.params.recall = 1;
        processIdle(dsp);
        expect(dsp.getDebugState().pendingRecall).toBe(true);
    });

    it('does not replay a restored high Mutate action before a fresh low-to-high edge', () => {
        const dsp = createRefrain();
        Object.assign(dsp.params, {
            seed: 474,
            length: 6,
            amount: 3,
            mutate: 1
        });

        dsp.process();

        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 474,
            activeLength: 6,
            pendingMutate: false
        });
        expect(dsp.leds.pending).toBe(0);

        dsp.params.mutate = 0;
        processIdle(dsp);
        dsp.params.mutate = 1;
        processIdle(dsp);
        expect(dsp.getDebugState()).toMatchObject({
            pendingMutate: true,
            pendingAmount: 3
        });
    });

    it('hydrates the Test - Refrain factory Seed on its first production-style block', () => {
        const dsp = createRefrain({ bufferSize: 32 });
        const factoryParams = testRefrainPatch.state.params.refrain;
        const factoryBase = createRefrainBaseSnapshot(factoryParams.seed).cells;
        Object.assign(dsp.params, factoryParams);

        dsp.process();

        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 474,
            activeLength: 4,
            basePattern: factoryBase,
            livePattern: factoryBase
        });
        expect(dsp.getDebugState().livePattern).not.toEqual(
            createRefrainBaseSnapshot(0).cells
        );
        Object.entries(dsp.outputs).forEach(([lane, output]) => {
            const divisor = lane === 'key' ? 12 : 4;
            output.forEach(value => {
                expect(value).toBeCloseTo(factoryBase[0][lane] / divisor, 6);
            });
        });
    });

    it('fills finite quantized rails and preserves every buffer identity through process and reset', () => {
        [1, 17, 128, 512].forEach(bufferSize => {
            const dsp = createRefrain({ sampleRate: 96000, bufferSize });
            const inputRefs = { ...dsp.inputs };
            const outputRefs = { ...dsp.outputs };
            Object.values(dsp.inputs).forEach(input => input.fill(Number.NaN));
            Object.values(dsp.outputs).forEach(output => output.fill(Number.NaN));
            Object.assign(dsp.params, {
                seed: Number.NaN,
                length: Infinity,
                amount: -Infinity,
                chance: Number.NaN,
                mutate: Number.NaN,
                anchor: Number.NaN,
                recall: Number.NaN
            });

            dsp.process();
            Object.entries(dsp.outputs).forEach(([lane, output]) => {
                expect(output.every(Number.isFinite)).toBe(true);
                output.forEach(value => {
                    if (lane === 'key') {
                        expect(value).toBeGreaterThanOrEqual(-1);
                        expect(value).toBeLessThanOrEqual(1);
                        expect(value * 12).toBeCloseTo(Math.round(value * 12), 5);
                    } else if (lane === 'harm') {
                        expect(value).toBeGreaterThanOrEqual(0);
                        expect(value).toBeLessThanOrEqual(5);
                        expect(value * 4).toBeCloseTo(Math.round(value * 4), 5);
                    } else {
                        expect(value).toBeGreaterThanOrEqual(-5);
                        expect(value).toBeLessThanOrEqual(5);
                        expect(value * 4).toBeCloseTo(Math.round(value * 4), 5);
                    }
                });
            });

            dsp.reset();
            Object.entries(inputRefs).forEach(([name, ref]) => {
                expect(dsp.inputs[name]).toBe(ref);
                expect([...ref]).toEqual(Array(bufferSize).fill(0));
            });
            Object.entries(outputRefs).forEach(([name, ref]) => {
                expect(dsp.outputs[name]).toBe(ref);
                expect(ref.every(Number.isFinite)).toBe(true);
            });
        });
    });

    it('contains no implementation-defined Math.random path', () => {
        const source = readFileSync(resolve('src/js/modules/refrain/index.js'), 'utf8');
        expect(source).not.toMatch(/Math\.random/);
    });
});

describe('REFRAIN transport, clock/reset, and boundary-only structure', () => {
    it('accepts only crossings from <=2.5V to >2.5V and advances one cell after exactly 16 clocks', () => {
        const dsp = createRefrain();
        expect(clockEdge(dsp, { voltage: 2.5 }).debug).toMatchObject({ cellIndex: 0, substepIndex: 0 });
        expect(clockEdge(dsp, { voltage: 2.5001 }).debug).toMatchObject({ cellIndex: 0, substepIndex: 1 });

        clearInputs(dsp);
        dsp.inputs.clock.fill(10);
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 2 });
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 2 });
        clearInputs(dsp);
        dsp.process();

        clockEdges(dsp, 13);
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 15 });
        const boundary = clockEdge(dsp);
        expect(boundary.debug).toMatchObject({ cellIndex: 1, substepIndex: 0 });
        expectCellOutputs(boundary.outputs, boundary.debug.livePattern[1]);
        expect(boundary.leds.cell1).toBe(0);
        expect(boundary.leds.cell2).toBe(1);
        expect(boundary.leds.substep).toBe(1);
    });

    it('holds every tuple between clocks and fills the exact current-cell value for the whole block', () => {
        const dsp = createRefrain({ bufferSize: 31 });
        clockEdges(dsp, 16);
        processIdle(dsp);
        const state = dsp.getDebugState();
        Object.entries(dsp.outputs).forEach(([lane, output]) => {
            const expected = state.livePattern[1][lane] / (lane === 'key' ? 12 : 4);
            expect([...output]).toEqual(Array(31).fill(expected));
        });
    });

    it('defers Length and Seed to the old complete-loop boundary in the required order', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const seed0 = cloneCells(dsp.getDebugState().livePattern);
        const seed1 = createRefrainBaseSnapshot(1).cells;
        dsp.params.seed = 1;
        dsp.params.length = 2;
        processIdle(dsp);

        expect(dsp.getDebugState()).toMatchObject({ activeSeed: 0, activeLength: 4 });
        expect(dsp.getDebugState().livePattern).toEqual(seed0);
        clockEdges(dsp, 63);
        expect(dsp.getDebugState()).toMatchObject({ activeSeed: 0, activeLength: 4, cellIndex: 3, substepIndex: 15 });

        const boundary = clockEdge(dsp);
        expect(boundary.debug).toMatchObject({
            activeSeed: 1,
            activeLength: 2,
            cellIndex: 0,
            substepIndex: 0,
            livePattern: seed1
        });
        expectCellOutputs(boundary.outputs, seed1[0]);
    });

    it('lets reset win coincident clock without changing pattern, Anchor, queues, or PRNG continuation', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        dsp.params.amount = 3;
        pulseAction(dsp, 'mutate');
        clockEdges(dsp, 20);
        const before = dsp.getDebugState();

        const reset = clockEdge(dsp, { voltage: 10, reset: 10 });
        expect(reset.debug).toMatchObject({ cellIndex: 0, substepIndex: 0 });
        expect(reset.debug.livePattern).toEqual(before.livePattern);
        expect(reset.debug.anchorPattern).toEqual(before.anchorPattern);
        expect(reset.debug.anchorValid).toBe(true);
        expect(reset.debug.pendingMutate).toBe(true);
        expect(reset.debug.prngState).toEqual(before.prngState);
        expectCellOutputs(reset.outputs, before.livePattern[0]);

        clearInputs(dsp);
        dsp.inputs.reset.fill(10);
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 0 });
    });
});

describe('REFRAIN exact mutation, Anchor, Recall, priority, and automatic evolution', () => {
    it('locks the seed-0 exact-K mask, lane deltas, golden result, and post-mutation state', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const before = cloneCells(dsp.getDebugState().livePattern);
        dsp.params.amount = 3;
        pulseAction(dsp, 'mutate');
        clockEdges(dsp, 63);
        expect(dsp.getDebugState().livePattern).toEqual(before);
        expect(dsp.leds.pending).toBe(0.5);

        const boundary = clockEdge(dsp);
        expect(boundary.debug.lastMutationIndices).toEqual([0, 1, 2]);
        expect(boundary.debug.lastMutationDeltas).toEqual([
            [-1, 1, -1, 4],
            [-4, -3, -1, 2],
            [4, 1, -3, -4]
        ]);
        expect(boundary.debug.livePattern).toEqual([
            { key: 9, harm: 18, energy: -20, mod: 15 },
            { key: -12, harm: 17, energy: 16, mod: 8 },
            { key: -8, harm: 11, energy: 2, mod: -20 },
            ...before.slice(3)
        ]);
        expect(boundary.debug.prngState).toEqual([39757088, 1051894571]);
        expect(boundary.leds.pending).toBe(0);
        expect(boundary.leds.mutation).toBe(1);
        expectCellOutputs(boundary.outputs, boundary.debug.livePattern[0]);
    });

    it('locks a nonidentity seed-1 Fisher-Yates mask and mutation result', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const seed1 = createRefrainBaseSnapshot(1).cells;
        dsp.params.seed = 1;
        dsp.params.amount = 3;
        dsp.params.chance = 0;
        pulseAction(dsp, 'mutate');

        const boundary = clockEdges(dsp, 64);

        expect(boundary.debug.lastMutationIndices).toEqual([3, 2, 0]);
        expect(boundary.debug.lastMutationDeltas).toEqual([
            [-1, 1, 3, -4],
            [-1, -3, -1, -1],
            [-3, -3, 2, 3]
        ]);
        expect(boundary.debug.livePattern).toEqual([
            { key: 9, harm: 14, energy: -12, mod: 3 },
            seed1[1],
            { key: 6, harm: 5, energy: -20, mod: -12 },
            { key: 11, harm: 18, energy: 19, mod: -14 },
            ...seed1.slice(4)
        ]);
        expect(boundary.debug.prngState).toEqual([2678786327, 772103964]);
    });

    it('changes exactly min(Amount, Length) unique active cells and all four lanes for every setting', () => {
        for (let length = 1; length <= 8; length++) {
            for (let amount = 1; amount <= 8; amount++) {
                const dsp = createRefrain({ bufferSize: 4 });
                dsp.params.length = length;
                dsp.params.amount = amount;
                dsp.params.chance = 0;
                dsp.reset();
                const before = cloneCells(dsp.getDebugState().livePattern);
                pulseAction(dsp, 'mutate');
                clockEdges(dsp, length * 16);
                const after = dsp.getDebugState().livePattern;
                const changed = changedCellIndices(before, after);

                expect(changed).toHaveLength(Math.min(amount, length));
                changed.forEach(cell => {
                    LANES.forEach(lane => expect(after[cell][lane]).not.toBe(before[cell][lane]));
                });
                expect(changed.every(cell => cell < length)).toBe(true);
                for (let cell = length; cell < 8; cell++) expect(after[cell]).toEqual(before[cell]);
            }
        }
    });

    it('reflects rail-facing deltas inward and always remains quantized in-domain', () => {
        [
            [-12, -4, -12, 12, -8],
            [12, 4, -12, 12, 8],
            [0, -3, 0, 20, 3],
            [20, 3, 0, 20, 17],
            [-20, -4, -20, 20, -16],
            [20, 4, -20, 20, 16]
        ].forEach(([value, delta, minimum, maximum, expected]) => {
            expect(applyRefrainDelta(value, delta, minimum, maximum)).toBe(expected);
        });
    });

    it('snapshots the latest Mutate Amount and keeps manual mutation available in Hold', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        const anchor = cloneCells(dsp.getDebugState().anchorPattern);

        dsp.params.amount = 1;
        pulseAction(dsp, 'mutate');
        dsp.params.amount = 4;
        pulseAction(dsp, 'mutate');
        dsp.params.amount = 2;
        clockEdges(dsp, 64);
        const state = dsp.getDebugState();

        expect(state.anchorValid).toBe(true);
        expect(state.anchorPattern).toEqual(anchor);
        expect(changedCellIndices(anchor, state.livePattern)).toHaveLength(4);
        expect(dsp.leds.anchor).toBe(1);

        dsp.params.anchor = 0;
        processIdle(dsp);
        dsp.params.anchor = 1;
        processIdle(dsp);
        expect(dsp.getDebugState().anchorPattern).toEqual(state.livePattern);
    });

    it('orders Seed, Length, then Recall/Mutate atomically at the old loop boundary', () => {
        const recalled = createRefrain();
        recalled.params.anchor = 1;
        processIdle(recalled);
        const anchor = cloneCells(recalled.getDebugState().anchorPattern);
        recalled.params.anchor = 0;
        recalled.params.seed = 1;
        recalled.params.length = 2;
        recalled.params.amount = 2;
        recalled.params.chance = 100;
        processIdle(recalled);
        pulseAction(recalled, 'mutate');
        pulseAction(recalled, 'recall');

        clockEdges(recalled, 64);
        expect(recalled.getDebugState()).toMatchObject({
            activeSeed: 1,
            activeLength: 2,
            livePattern: anchor,
            anchorPattern: anchor,
            pendingMutate: false,
            pendingRecall: false,
            prngState: createRefrainBaseSnapshot(1).prngState
        });

        const mutated = createRefrain();
        processIdle(mutated);
        mutated.params.seed = 1;
        mutated.params.length = 2;
        mutated.params.amount = 2;
        mutated.params.chance = 100;
        processIdle(mutated);
        pulseAction(mutated, 'mutate');
        clockEdges(mutated, 64);
        const newBase = createRefrainBaseSnapshot(1).cells;
        const after = mutated.getDebugState().livePattern;
        expect(changedCellIndices(newBase, after)).toHaveLength(2);
        expect(after.slice(2)).toEqual(newBase.slice(2));
    });

    it('captures/overwrites Anchor immediately, retains it in Run, and Recall wins over Mutate and auto', () => {
        const dsp = createRefrain();
        dsp.params.chance = 100;
        dsp.params.anchor = 1;
        processIdle(dsp);
        const anchor = cloneCells(dsp.getDebugState().anchorPattern);
        expect(dsp.leds.anchor).toBe(1);

        dsp.params.amount = 2;
        pulseAction(dsp, 'mutate');
        clockEdges(dsp, 64);
        expect(dsp.getDebugState().livePattern).not.toEqual(anchor);

        dsp.params.anchor = 0;
        processIdle(dsp);
        expect(dsp.getDebugState().anchorPattern).toEqual(anchor);
        expect(dsp.leds.anchor).toBe(0.5);

        pulseAction(dsp, 'mutate');
        pulseAction(dsp, 'recall');
        expect(dsp.leds.pending).toBe(1);
        const boundary = clockEdges(dsp, 64);
        expect(boundary.debug.livePattern).toEqual(anchor);
        expect(boundary.debug.pendingMutate).toBe(false);
        expect(boundary.debug.pendingRecall).toBe(false);
        expect(boundary.leds.mutation).toBe(0);
    });

    it('ignores invalid Recall, disables auto in Hold, and applies Chance 0/100 exactly in Run', () => {
        const noRecall = createRefrain();
        processIdle(noRecall);
        pulseAction(noRecall, 'recall');
        expect(noRecall.getDebugState().pendingRecall).toBe(false);

        const never = createRefrain();
        never.params.length = 1;
        never.params.chance = 0;
        never.reset();
        const neverBefore = cloneCells(never.getDebugState().livePattern);
        clockEdges(never, 16);
        expect(never.getDebugState().livePattern).toEqual(neverBefore);

        const held = createRefrain();
        held.params.length = 1;
        held.params.chance = 100;
        held.params.anchor = 1;
        held.reset();
        processIdle(held);
        const heldBefore = cloneCells(held.getDebugState().livePattern);
        clockEdges(held, 16);
        expect(held.getDebugState().livePattern).toEqual(heldBefore);

        held.params.anchor = 0;
        processIdle(held);
        const automatic = clockEdges(held, 16);
        expect(automatic.debug.livePattern).not.toEqual(heldBefore);
        expect(automatic.leds.mutation).toBe(1);
    });

    it('reports one-hot position plus bounded substep, Anchor, pending, and one-block mutation LEDs', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        pulseAction(dsp, 'mutate');
        expect(dsp.leds.pending).toBe(0.5);
        expect(dsp.leds.anchor).toBe(1);
        expect(Object.values(dsp.leds).every(value => value >= 0 && value <= 1)).toBe(true);

        clockEdges(dsp, 63);
        const boundary = clockEdge(dsp);
        expect(boundary.leds.mutation).toBe(1);
        expect(boundary.leds.substep).toBe(1);
        expect(boundary.leds.cell1).toBe(1);
        expect(['cell5', 'cell6', 'cell7', 'cell8'].every(id => boundary.leds[id] === 0)).toBe(true);
        processIdle(dsp);
        expect(dsp.leds.mutation).toBe(0);
        expect(dsp.leds.substep).toBe(1 / 64);
    });
});

describe('REFRAIN lifecycle reset and deterministic replay', () => {
    it('reconstructs the visible Seed, clears volatile state, and lets persisted Hold recapture next process', () => {
        const dsp = createRefrain();
        dsp.params.seed = 42;
        dsp.params.length = 2;
        dsp.params.amount = 3;
        dsp.params.chance = 100;
        dsp.params.anchor = 1;
        processIdle(dsp);
        pulseAction(dsp, 'mutate');
        clockEdges(dsp, 12);

        dsp.reset();
        const reset = dsp.getDebugState();
        expect(reset).toMatchObject({
            activeSeed: 42,
            activeLength: 2,
            cellIndex: 0,
            substepIndex: 0,
            anchorValid: false,
            pendingMutate: false,
            pendingRecall: false,
            livePattern: createRefrainBaseSnapshot(42).cells
        });
        expect(dsp.params.anchor).toBe(1);
        expect(dsp.leds.anchor).toBe(0);

        processIdle(dsp);
        expect(dsp.getDebugState()).toMatchObject({
            anchorValid: true,
            anchorPattern: createRefrainBaseSnapshot(42).cells
        });
        expect(dsp.leds.anchor).toBe(1);
    });

    it('replays identical transport and voltages across supported rates and block sizes', () => {
        const configurations = [
            [44100, 128],
            [48000, 512],
            [96000, 128]
        ];
        const runs = configurations.map(([sampleRate, bufferSize]) => {
            const dsp = createRefrain({ sampleRate, bufferSize });
            dsp.params.seed = 65535;
            dsp.params.length = 3;
            dsp.params.chance = 0;
            dsp.reset();
            const values = [];
            for (let edge = 0; edge < 64; edge++) {
                const result = clockEdge(dsp);
                values.push([
                    result.debug.cellIndex,
                    result.debug.substepIndex,
                    result.outputs.key,
                    result.outputs.harm,
                    result.outputs.energy,
                    result.outputs.mod
                ]);
            }
            return values;
        });

        expect(runs[1]).toEqual(runs[0]);
        expect(runs[2]).toEqual(runs[0]);
    });
});
