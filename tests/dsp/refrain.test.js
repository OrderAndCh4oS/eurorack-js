import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import refrainModule, {
    applyRefrainDelta,
    createPcg32,
    createRefrainBaseSnapshot,
    mapRefrainSeed
} from '../../src/js/modules/refrain/index.js';
import changesModule from '../../src/js/modules/changes/index.js';
import cascadeModule, {
    computeCascadeFill,
    getCascadeLaneCount
} from '../../src/js/modules/cascade/index.js';
import arpModule, {
    CHORDS,
    CHORD_NAMES
} from '../../src/js/modules/arp/index.js';
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

function processLevels(dsp, levels = {}) {
    clearInputs(dsp);
    Object.entries(levels).forEach(([port, voltage]) => {
        dsp.inputs[port].fill(voltage);
    });
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

function clockEdgeAtSample(
    dsp,
    sample,
    { voltage = 10, reset = 0, levels = {}, pulses = {} } = {}
) {
    clearInputs(dsp);
    Object.entries(levels).forEach(([port, level]) => dsp.inputs[port].fill(level));
    Object.entries(pulses).forEach(([port, level]) => {
        dsp.inputs[port][sample] = level;
    });
    dsp.inputs.clock[sample] = voltage;
    dsp.inputs.reset[sample] = reset;
    dsp.process();
    const result = {
        debug: dsp.getDebugState(),
        leds: { ...dsp.leds },
        telemetry: {
            activeSeed: dsp.activeSeed,
            nextSeed: dsp.nextSeed,
            seedPendingState: dsp.seedPendingState
        },
        outputs: Object.fromEntries(
            Object.entries(dsp.outputs).map(([name, output]) => [name, output[sample]])
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

function changedLanes(before, after, cell) {
    return LANES.filter(lane => before[cell][lane] !== after[cell][lane]);
}

function setLaneMask(dsp, mask) {
    dsp.params.mutateKey = mask & 1 ? 1 : 0;
    dsp.params.mutateHarm = mask & 2 ? 1 : 0;
    dsp.params.mutateEnergy = mask & 4 ? 1 : 0;
    dsp.params.mutateMod = mask & 8 ? 1 : 0;
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
            hp: 12,
            color: 'module-color-ten',
            category: 'sequencer'
        });
        expect(refrainModule.render).toBeTypeOf('function');
        expect(refrainModule.telemetry).toEqual({
            fields: ['activeSeed', 'nextSeed', 'seedPendingState'],
            methods: []
        });
        expect(refrainModule.ui.knobs).toEqual([
            { id: 'seed', label: 'Seed', param: 'seed', min: 0, max: 65535, default: 0, step: 1 },
            { id: 'length', label: 'Length', param: 'length', min: 1, max: 8, default: 4, step: 1 },
            { id: 'amount', label: 'Amount', param: 'amount', min: 1, max: 8, default: 1, step: 1 },
            { id: 'chance', label: 'Chance', param: 'chance', min: 0, max: 100, default: 20, step: 1 }
        ]);
        expect(refrainModule.ui.buttons).toEqual([
            { id: 'mutateKey', label: 'Key', param: 'mutateKey', default: 1 },
            { id: 'mutateHarm', label: 'Harm', param: 'mutateHarm', default: 1 },
            { id: 'mutateEnergy', label: 'Energy', param: 'mutateEnergy', default: 1 },
            { id: 'mutateMod', label: 'Mod', param: 'mutateMod', default: 1 }
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
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'seedCV', label: 'Seed CV', port: 'seedCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'mutateTrig', label: 'Mutate', port: 'mutateTrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'recallTrig', label: 'Recall', port: 'recallTrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'hold', label: 'Hold', port: 'hold', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } }
        ]);
        expect(refrainModule.ui.outputs).toEqual([
            { id: 'key', label: 'Key', port: 'key', signal: 'cv', voltage: { min: -1, max: 1 } },
            { id: 'harm', label: 'Harm', port: 'harm', signal: 'cv', voltage: { min: 0, max: 5 } },
            { id: 'energy', label: 'Energy', port: 'energy', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'mod', label: 'Mod', port: 'mod', signal: 'cv', voltage: { min: -5, max: 5 } }
        ]);
        expect(refrainModule.ui.leds).toEqual([
            'cell1', 'cell2', 'cell3', 'cell4', 'cell5', 'cell6', 'cell7', 'cell8',
            'substep', 'anchor', 'pending', 'seedPending', 'mutation'
        ]);

        expectExhaustivePanelCoverage(refrainModule, {
            knobs: ['seed', 'length', 'amount', 'chance'],
            buttons: ['mutateKey', 'mutateHarm', 'mutateEnergy', 'mutateMod'],
            switches: ['anchor'],
            actions: ['mutate', 'recall'],
            inputs: ['clock', 'reset', 'seedCV', 'mutateTrig', 'recallTrig', 'hold'],
            outputs: ['key', 'harm', 'energy', 'mod'],
            leds: [
                'cell1', 'cell2', 'cell3', 'cell4', 'cell5', 'cell6', 'cell7', 'cell8',
                'substep', 'anchor', 'pending', 'seedPending', 'mutation'
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
            mutateKey: 1,
            mutateHarm: 1,
            mutateEnergy: 1,
            mutateMod: 1,
            mutate: 0,
            anchor: 0,
            recall: 0
        });
        expect(Object.keys(dsp.inputs)).toEqual([
            'clock',
            'reset',
            'seedCV',
            'mutateTrig',
            'recallTrig',
            'hold'
        ]);
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
            seedPending: 0,
            mutation: 0
        });
        expect(dsp).toMatchObject({
            activeSeed: 0,
            nextSeed: 0,
            seedPendingState: 0
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

    it('maps bipolar Seed CV to exact semitone-grid offsets with clamp, ties, and wrap', () => {
        expect(mapRefrainSeed(1234, 0)).toBe(1234);
        expect(mapRefrainSeed(1234, 1 / 12)).toBe(1235);
        expect(mapRefrainSeed(1234, -1 / 12)).toBe(1233);
        expect(mapRefrainSeed(1234, 5)).toBe(1294);
        expect(mapRefrainSeed(1234, 20)).toBe(1294);
        expect(mapRefrainSeed(1234, -5)).toBe(1174);
        expect(mapRefrainSeed(1234, -20)).toBe(1174);
        expect(mapRefrainSeed(0, -1 / 12)).toBe(65535);
        expect(mapRefrainSeed(65535, 1 / 12)).toBe(0);
        expect(mapRefrainSeed(10, 1 / 24)).toBe(11);
        expect(mapRefrainSeed(10, -1 / 24)).toBe(10);
        expect(mapRefrainSeed(10, Number.NaN)).toBe(10);
        expect(mapRefrainSeed(10, Infinity)).toBe(10);

        for (let offset = -60; offset <= 60; offset++) {
            expect(mapRefrainSeed(32768, offset / 12)).toBe(32768 + offset);
        }
    });

    it('installs restored visible params before first-process Anchor capture or output', () => {
        const dsp = createRefrain({ bufferSize: 19 });
        Object.assign(dsp.params, {
            seed: 474,
            length: 6,
            amount: 3,
            chance: 100,
            mutateKey: 1,
            mutateHarm: 0,
            mutateEnergy: 1,
            mutateMod: 0,
            anchor: 1,
            recall: 1
        });
        dsp.inputs.seedCV.fill(1 / 12);

        dsp.process();

        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 475,
            activePanelSeed: 474,
            activeLength: 6,
            cellIndex: 0,
            substepIndex: 0,
            anchorValid: true,
            pendingRecall: false,
            pendingMask: 0,
            basePattern: createRefrainBaseSnapshot(475).cells,
            livePattern: createRefrainBaseSnapshot(475).cells,
            anchorPattern: createRefrainBaseSnapshot(475).cells,
            prngState: createRefrainBaseSnapshot(475).prngState
        });
        Object.entries(dsp.outputs).forEach(([lane, output]) => {
            const divisor = lane === 'key' ? 12 : 4;
            output.forEach(value => {
                expect(value).toBeCloseTo(
                    createRefrainBaseSnapshot(475).cells[0][lane] / divisor,
                    6
                );
            });
        });
        expect(dsp).toMatchObject({
            activeSeed: 475,
            nextSeed: 475,
            seedPendingState: 0
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
                mutateKey: Number.NaN,
                mutateHarm: Number.NaN,
                mutateEnergy: Number.NaN,
                mutateMod: Number.NaN,
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

describe('REFRAIN Seed CV auditioning, preview, and Hold eligibility', () => {
    it('previews the latest target and distinguishes eligible from Hold-blocked CV intent', () => {
        const dsp = createRefrain();
        processIdle(dsp);

        processLevels(dsp, { seedCV: 1 / 12 });
        expect(dsp).toMatchObject({
            activeSeed: 0,
            nextSeed: 1,
            seedPendingState: 1
        });
        expect(dsp.leds.seedPending).toBe(1);

        dsp.params.anchor = 1;
        processLevels(dsp, { seedCV: 1 / 12 });
        expect(dsp).toMatchObject({
            activeSeed: 0,
            nextSeed: 1,
            seedPendingState: 2
        });
        expect(dsp.leds.seedPending).toBe(0.5);

        const blocked = clockEdgeAtSample(dsp, 0, {
            levels: { seedCV: 1 / 12, hold: 10 }
        });
        expect(blocked.debug.activeSeed).toBe(0);
        expect(blocked.telemetry).toEqual({
            activeSeed: 0,
            nextSeed: 1,
            seedPendingState: 2
        });

        dsp.params.seed = 2;
        clockEdges(dsp, 15);
        const explicit = clockEdgeAtSample(dsp, 0, {
            levels: { seedCV: 1 / 12, hold: 10 }
        });
        expect(explicit.debug).toMatchObject({
            activeSeed: 3,
            activePanelSeed: 2,
            cellIndex: 0,
            substepIndex: 0
        });
        expect(explicit.debug.livePattern).toEqual(createRefrainBaseSnapshot(3).cells);
    });

    it('uses the exact boundary sample while NEXT follows the latest processed sample', () => {
        const dsp = createRefrain({ bufferSize: 8 });
        processIdle(dsp);
        clockEdge(dsp);
        clockEdges(dsp, 15);
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 15 });

        clearInputs(dsp);
        dsp.inputs.seedCV[2] = 1 / 12;
        dsp.inputs.clock[2] = 10;
        dsp.inputs.seedCV[3] = 2 / 12;
        dsp.inputs.seedCV[4] = 2 / 12;
        dsp.inputs.seedCV[5] = 2 / 12;
        dsp.inputs.seedCV[6] = 2 / 12;
        dsp.inputs.seedCV[7] = 2 / 12;
        dsp.process();

        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 1,
            cellIndex: 0,
            substepIndex: 0,
            livePattern: createRefrainBaseSnapshot(1).cells
        });
        expect(dsp).toMatchObject({
            activeSeed: 1,
            nextSeed: 2,
            seedPendingState: 1
        });
        expectCellOutputs(
            Object.fromEntries(
                Object.entries(dsp.outputs).map(([lane, output]) => [lane, output[2]])
            ),
            createRefrainBaseSnapshot(1).cells[0]
        );
    });

    it('auditions a full cell zero at consecutive boundaries and advances when a target is held', () => {
        const dsp = createRefrain();
        processIdle(dsp);

        let boundary = clockEdgeAtSample(dsp, 0, { levels: { seedCV: 1 / 12 } });
        expect(boundary.debug).toMatchObject({ activeSeed: 1, cellIndex: 0, substepIndex: 0 });
        for (let edge = 0; edge < 15; edge++) {
            boundary = clockEdgeAtSample(dsp, 0, { levels: { seedCV: 1 / 12 } });
        }
        expect(boundary.debug).toMatchObject({ activeSeed: 1, cellIndex: 0, substepIndex: 15 });

        boundary = clockEdgeAtSample(dsp, 0, { levels: { seedCV: 2 / 12 } });
        expect(boundary.debug).toMatchObject({ activeSeed: 2, cellIndex: 0, substepIndex: 0 });
        expectCellOutputs(boundary.outputs, createRefrainBaseSnapshot(2).cells[0]);

        for (let edge = 0; edge < 16; edge++) {
            boundary = clockEdgeAtSample(dsp, 0, { levels: { seedCV: 2 / 12 } });
        }
        expect(boundary.debug).toMatchObject({ activeSeed: 2, cellIndex: 1, substepIndex: 0 });
        expectCellOutputs(boundary.outputs, createRefrainBaseSnapshot(2).cells[1]);
    });

    it('acknowledges a new panel basis that maps to ACTIVE without regeneration or restart', () => {
        const dsp = createRefrain();
        dsp.inputs.seedCV.fill(1 / 12);
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 1,
            activePanelSeed: 0
        });

        clockEdgeAtSample(dsp, 0, { levels: { seedCV: 1 / 12 } });
        clockEdges(dsp, 15);
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 15 });
        const before = dsp.getDebugState();

        dsp.params.seed = 1;
        const boundary = clockEdge(dsp);
        expect(boundary.debug).toMatchObject({
            activeSeed: 1,
            activePanelSeed: 1,
            cellIndex: 1,
            substepIndex: 0
        });
        expect(boundary.debug.livePattern).toEqual(before.livePattern);
        expect(boundary.debug.prngState).toEqual(before.prngState);
    });
});

describe('REFRAIN transport, clock/reset, and boundary-only structure', () => {
    it('accepts only crossings from <=2.5V to >2.5V, starts on cell zero, then advances after 16 steps', () => {
        const dsp = createRefrain();
        expect(clockEdge(dsp, { voltage: 2.5 }).debug).toMatchObject({ cellIndex: 0, substepIndex: 0 });
        expect(clockEdge(dsp, { voltage: 2.5001 }).debug).toMatchObject({
            cellIndex: 0,
            substepIndex: 0,
            restartPending: false
        });

        clearInputs(dsp);
        dsp.inputs.clock.fill(10);
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 1 });
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 1 });
        clearInputs(dsp);
        dsp.process();

        clockEdges(dsp, 14);
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
        clockEdges(dsp, 17);
        processIdle(dsp);
        const state = dsp.getDebugState();
        Object.entries(dsp.outputs).forEach(([lane, output]) => {
            const expected = state.livePattern[1][lane] / (lane === 'key' ? 12 : 4);
            expect([...output]).toEqual(Array(31).fill(expected));
        });
    });

    it('commits Seed at the next cell boundary but Length only at the old natural-loop boundary', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const seed0 = cloneCells(dsp.getDebugState().livePattern);
        const seed1 = createRefrainBaseSnapshot(1).cells;
        dsp.params.seed = 1;
        dsp.params.length = 2;
        processIdle(dsp);

        expect(dsp.getDebugState()).toMatchObject({ activeSeed: 0, activeLength: 4 });
        expect(dsp.getDebugState().livePattern).toEqual(seed0);
        const seedBoundary = clockEdge(dsp);
        expect(seedBoundary.debug).toMatchObject({
            activeSeed: 1,
            activePanelSeed: 1,
            activeLength: 4,
            cellIndex: 0,
            substepIndex: 0,
            livePattern: seed1,
            changeAutoGuard: true
        });
        expectCellOutputs(seedBoundary.outputs, seed1[0]);

        clockEdges(dsp, 63);
        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 1,
            activeLength: 4,
            cellIndex: 3,
            substepIndex: 15
        });

        const boundary = clockEdge(dsp);
        expect(boundary.debug).toMatchObject({
            activeSeed: 1,
            activeLength: 2,
            cellIndex: 0,
            substepIndex: 0,
            livePattern: seed1,
            changeAutoGuard: false
        });
        expectCellOutputs(boundary.outputs, seed1[0]);
    });

    it('commits a Length increase at the old boundary and exposes the existing added cells', () => {
        const dsp = createRefrain();
        dsp.params.seed = 19;
        dsp.params.length = 2;
        dsp.params.chance = 0;
        dsp.reset();
        processIdle(dsp);
        const live = cloneCells(dsp.getDebugState().livePattern);
        clockEdges(dsp, 12);
        dsp.params.length = 4;
        clockEdges(dsp, 21);
        expect(dsp.getDebugState()).toMatchObject({
            activeLength: 4,
            cellIndex: 0,
            substepIndex: 0,
            livePattern: live
        });

        clockEdges(dsp, 32);
        const state = dsp.getDebugState();
        expect(state).toMatchObject({ activeLength: 4, cellIndex: 2, substepIndex: 0 });
        expectCellOutputs(
            Object.fromEntries(Object.entries(dsp.outputs).map(([lane, output]) => [lane, output[0]])),
            live[2]
        );
    });

    it('lets reset win transport while committing queued actions on the coincident boundary', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        clockEdges(dsp, 20);
        dsp.params.amount = 3;
        pulseAction(dsp, 'mutate');
        const before = dsp.getDebugState();
        expect(before.pendingMutate).toBe(true);

        const reset = clockEdge(dsp, { voltage: 10, reset: 10 });
        expect(reset.debug).toMatchObject({
            cellIndex: 0,
            substepIndex: 0,
            restartPending: false,
            pendingMutate: false,
            changeAutoGuard: true
        });
        expect(reset.debug.livePattern).not.toEqual(before.livePattern);
        expect(reset.debug.anchorPattern).toEqual(before.anchorPattern);
        expect(reset.debug.anchorValid).toBe(true);
        expect(reset.debug.prngState).not.toEqual(before.prngState);
        expectCellOutputs(reset.outputs, reset.debug.livePattern[0]);

        clearInputs(dsp);
        dsp.inputs.reset.fill(10);
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({ cellIndex: 0, substepIndex: 0 });
    });

    it('queues an asynchronous reset until the next clock without exposing a mismatched macro cell', () => {
        const dsp = createRefrain();
        clockEdges(dsp, 20);
        const before = dsp.getDebugState();
        const beforeOutputs = Object.fromEntries(
            Object.entries(dsp.outputs).map(([lane, output]) => [lane, output[0]])
        );

        clearInputs(dsp);
        dsp.inputs.reset[0] = 1;
        dsp.process();
        expect(dsp.getDebugState()).toMatchObject({
            cellIndex: before.cellIndex,
            substepIndex: before.substepIndex,
            restartPending: true
        });
        Object.entries(dsp.outputs).forEach(([lane, output]) => {
            expect(output[0]).toBe(beforeOutputs[lane]);
        });

        processIdle(dsp);
        expect(clockEdge(dsp).debug).toMatchObject({
            cellIndex: 0,
            substepIndex: 0,
            restartPending: false
        });
    });

    it('keeps Refrain cells phase-aligned with Changes phrases and Cascade step zero', () => {
        const refrain = createRefrain();
        const changes = changesModule.createDSP({ sampleRate: 1000, bufferSize: 8 });
        const cascade = cascadeModule.createDSP({ sampleRate: 1000, bufferSize: 8 });
        refrain.params.seed = 474;
        cascade.params.fill = 16;

        const sharedEdge = () => {
            clearInputs(refrain);
            Object.values(changes.inputs).forEach(input => input.fill(0));
            Object.values(cascade.inputs).forEach(input => input.fill(0));
            refrain.inputs.clock[0] = 10;
            refrain.process();
            changes.inputs.keyCV.set(refrain.outputs.key);
            cascade.inputs.fillCV.set(refrain.outputs.energy);
            changes.inputs.clock[0] = 10;
            cascade.inputs.clock[0] = 10;
            changes.process();
            cascade.process();
            const frame = {
                refrain: refrain.getDebugState(),
                change: changes.outputs.change[0],
                cascadeLane1: cascade.outputs.lane1[0]
            };
            processIdle(refrain);
            Object.values(changes.inputs).forEach(input => input.fill(0));
            Object.values(cascade.inputs).forEach(input => input.fill(0));
            changes.process();
            cascade.process();
            return frame;
        };

        const first = sharedEdge();
        expect(first.refrain).toMatchObject({ cellIndex: 0, substepIndex: 0 });
        expect(first.change).toBe(10);
        expect(first.cascadeLane1).toBe(10);

        let sixteenth;
        for (let edge = 2; edge <= 16; edge++) sixteenth = sharedEdge();
        expect(sixteenth.refrain).toMatchObject({ cellIndex: 0, substepIndex: 15 });
        expect(sixteenth.change).toBe(0);

        const nextPhrase = sharedEdge();
        expect(nextPhrase.refrain).toMatchObject({ cellIndex: 1, substepIndex: 0 });
        expect(nextPhrase.change).toBe(10);
        expect(nextPhrase.cascadeLane1).toBe(10);
    });

    it('drives Arp as a full-scale HARM selector at knob zero and adds/clamps nonzero knob values', () => {
        const refrain = createRefrain();
        refrain.params.seed = 4;
        processIdle(refrain);

        const runArp = chord => {
            const arp = arpModule.createDSP({ sampleRate: 1000, bufferSize: 8 });
            arp.params.chord = chord;
            arp.inputs.chordCV.set(refrain.outputs.harm);
            arp.inputs.trigger[0] = 10;
            arp.process();
            return arp.outputs.cv[0];
        };

        const selectorIndex = Math.round(
            refrain.outputs.harm[0] * (CHORD_NAMES.length - 1) / 5
        );
        expect(selectorIndex).toBe(7);
        expect(runArp(0)).toBeCloseTo(
            CHORDS[CHORD_NAMES[selectorIndex]][1] / 12,
            7
        );
        expect(runArp(1)).toBeCloseTo(
            CHORDS[CHORD_NAMES[selectorIndex + 1]][1] / 12,
            7
        );
        expect(runArp(CHORD_NAMES.length - 1)).toBeCloseTo(
            CHORDS[CHORD_NAMES.at(-1)][1] / 12,
            7
        );
    });

    it('keeps both Test-Refrain trigger lanes active across the full ENERGY range', () => {
        for (let energyStep = -20; energyStep <= 20; energyStep++) {
            const fill = computeCascadeFill(12, energyStep / 4);
            expect(fill).toBeGreaterThanOrEqual(4);
            expect(getCascadeLaneCount(fill, 4)).toBeGreaterThanOrEqual(4);
            expect(getCascadeLaneCount(fill, 2)).toBeGreaterThanOrEqual(2);
        }
    });
});

describe('REFRAIN exact mutation, Anchor, Recall, priority, and automatic evolution', () => {
    it('locks the seed-0 exact-K mask, lane deltas, golden result, and post-mutation state', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const before = cloneCells(dsp.getDebugState().livePattern);
        dsp.params.amount = 3;
        pulseAction(dsp, 'mutate');
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

        const boundary = clockEdge(dsp);

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

    it('changes exact K cells and only selected lanes for every nonzero mask/Length/Amount', () => {
        for (let mask = 1; mask < 16; mask++) {
            const enabledLanes = LANES.filter((lane, index) => mask & (1 << index));
            for (let length = 1; length <= 8; length++) {
                for (let amount = 1; amount <= 8; amount++) {
                    const dsp = createRefrain({ bufferSize: 2 });
                    dsp.params.length = length;
                    dsp.params.amount = amount;
                    dsp.params.chance = 0;
                    setLaneMask(dsp, mask);
                    processIdle(dsp);
                    const before = cloneCells(dsp.getDebugState().livePattern);
                    pulseAction(dsp, 'mutate');
                    clockEdge(dsp);
                    const after = dsp.getDebugState().livePattern;
                    const changed = changedCellIndices(before, after);

                    expect(changed).toHaveLength(Math.min(amount, length));
                    changed.forEach(cell => {
                        expect(changedLanes(before, after, cell)).toEqual(enabledLanes);
                    });
                    expect(changed.every(cell => cell < length)).toBe(true);
                    for (let cell = length; cell < 8; cell++) {
                        expect(after[cell]).toEqual(before[cell]);
                    }
                }
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

    it('rejects an all-off request, clears older Mutate only, and consumes no PCG draw', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        dsp.params.anchor = 0;
        processIdle(dsp);

        pulseAction(dsp, 'recall');
        dsp.params.amount = 3;
        pulseAction(dsp, 'mutate');
        expect(dsp.getDebugState()).toMatchObject({
            pendingRecall: true,
            pendingMutate: true
        });
        const before = dsp.getDebugState();

        setLaneMask(dsp, 0);
        pulseAction(dsp, 'mutate');
        expect(dsp.getDebugState()).toMatchObject({
            pendingRecall: true,
            pendingMutate: false,
            pendingMask: 0,
            prngState: before.prngState,
            livePattern: before.livePattern,
            changeAutoGuard: false
        });
        expect(dsp.leds.pending).toBe(1);

        const automatic = createRefrain();
        automatic.params.length = 1;
        automatic.params.chance = 100;
        setLaneMask(automatic, 0);
        processIdle(automatic);
        clockEdge(automatic);
        const automaticBefore = automatic.getDebugState();
        clockEdges(automatic, 16);
        expect(automatic.getDebugState()).toMatchObject({
            livePattern: automaticBefore.livePattern,
            prngState: automaticBefore.prngState
        });
    });

    it('consumes the same mask and four-lane draw schedule for every nonzero lane mask', () => {
        const results = [];
        for (let mask = 1; mask < 16; mask++) {
            const dsp = createRefrain();
            dsp.params.amount = 3;
            dsp.params.chance = 0;
            setLaneMask(dsp, mask);
            processIdle(dsp);
            pulseAction(dsp, 'mutate');
            clockEdge(dsp);
            results.push(dsp.getDebugState());
        }

        results.slice(1).forEach(result => {
            expect(result.lastMutationIndices).toEqual(results[0].lastMutationIndices);
            expect(result.lastMutationDeltas).toEqual(results[0].lastMutationDeltas);
            expect(result.prngState).toEqual(results[0].prngState);
        });
    });

    it('accepts panel/jack commands at >=1V once per edge and commits at the next cell boundary', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const before = cloneCells(dsp.getDebugState().livePattern);

        processLevels(dsp, { mutateTrig: 0.999 });
        expect(dsp.getDebugState().pendingMutate).toBe(false);

        processLevels(dsp, { mutateTrig: 1 });
        expect(dsp.getDebugState().pendingMutate).toBe(true);
        processLevels(dsp, { mutateTrig: 10 });
        expect(dsp.getDebugState().pendingMutate).toBe(true);

        clearInputs(dsp);
        dsp.inputs.mutateTrig.fill(10);
        dsp.inputs.clock[0] = 10;
        dsp.process();
        expect(dsp.getDebugState().pendingMutate).toBe(false);
        expect(dsp.getDebugState().livePattern).not.toEqual(before);
        dsp.process();
        expect(dsp.getDebugState().pendingMutate).toBe(false);
        processIdle(dsp);
        processLevels(dsp, { mutateTrig: 1 });
        expect(dsp.getDebugState().pendingMutate).toBe(true);
    });

    it('observes trigger edges on the exact boundary sample and defers edges after it', () => {
        const sameSample = createRefrain({ bufferSize: 8 });
        processIdle(sameSample);
        const before = cloneCells(sameSample.getDebugState().livePattern);
        const committed = clockEdgeAtSample(sameSample, 3, {
            pulses: { mutateTrig: 1 }
        });
        expect(committed.debug.pendingMutate).toBe(false);
        expect(committed.debug.livePattern).not.toEqual(before);

        const afterSample = createRefrain({ bufferSize: 8 });
        processIdle(afterSample);
        const afterBefore = cloneCells(afterSample.getDebugState().livePattern);
        clearInputs(afterSample);
        afterSample.inputs.clock[2] = 10;
        afterSample.inputs.mutateTrig[3] = 1;
        afterSample.process();
        expect(afterSample.getDebugState()).toMatchObject({
            cellIndex: 0,
            substepIndex: 0,
            pendingMutate: true,
            livePattern: afterBefore
        });
        clearInputs(afterSample);
        afterSample.process();
        clockEdges(afterSample, 16);
        expect(afterSample.getDebugState().pendingMutate).toBe(false);
        expect(afterSample.getDebugState().livePattern).not.toEqual(afterBefore);
    });

    it('queues Recall from its jack only when Anchor is valid and restores it on a boundary', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        processLevels(dsp, { recallTrig: 10 });
        expect(dsp.getDebugState().pendingRecall).toBe(false);
        processIdle(dsp);

        dsp.params.anchor = 1;
        processIdle(dsp);
        const anchor = cloneCells(dsp.getDebugState().anchorPattern);
        dsp.params.amount = 2;
        pulseAction(dsp, 'mutate');
        clockEdge(dsp);
        expect(dsp.getDebugState().livePattern).not.toEqual(anchor);

        dsp.params.anchor = 0;
        processIdle(dsp);
        processLevels(dsp, { recallTrig: 0.999 });
        expect(dsp.getDebugState().pendingRecall).toBe(false);
        processLevels(dsp, { recallTrig: 1 });
        expect(dsp.getDebugState().pendingRecall).toBe(true);
        processLevels(dsp, { recallTrig: 10 });
        expect(dsp.getDebugState().pendingRecall).toBe(true);

        clockEdges(dsp, 16);
        expect(dsp.getDebugState()).toMatchObject({
            pendingRecall: false,
            livePattern: anchor
        });
    });

    it('ORs panel and gate Hold, captures only combined false-to-true transitions, and stays live', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const base = cloneCells(dsp.getDebugState().livePattern);

        dsp.params.anchor = 1;
        processIdle(dsp);
        expect(dsp.getDebugState().anchorPattern).toEqual(base);

        dsp.params.amount = 2;
        pulseAction(dsp, 'mutate');
        clockEdgeAtSample(dsp, 0, { levels: { hold: 10 } });
        const mutated = cloneCells(dsp.getDebugState().livePattern);
        expect(mutated).not.toEqual(base);
        expect(dsp.getDebugState().anchorPattern).toEqual(base);

        dsp.params.anchor = 0;
        processLevels(dsp, { hold: 10 });
        expect(dsp.getDebugState().anchorPattern).toEqual(base);
        processIdle(dsp);
        expect(dsp.getDebugState().anchorPattern).toEqual(base);

        processLevels(dsp, { hold: 10 });
        expect(dsp.getDebugState().anchorPattern).toEqual(mutated);
        expect(dsp.leds.anchor).toBe(1);
        processLevels(dsp, { hold: 10 });
        expect(dsp.getDebugState().anchorPattern).toEqual(mutated);
    });

    it('captures pre-transaction state when Hold rises on a boundary and blocks CV-only Seed there', () => {
        const dsp = createRefrain();
        processIdle(dsp);
        const before = cloneCells(dsp.getDebugState().livePattern);

        const boundary = clockEdgeAtSample(dsp, 0, {
            levels: { seedCV: 1 / 12, hold: 10 }
        });
        expect(boundary.debug).toMatchObject({
            activeSeed: 0,
            anchorValid: true,
            anchorPattern: before,
            livePattern: before
        });
        expect(boundary.telemetry).toEqual({
            activeSeed: 0,
            nextSeed: 1,
            seedPendingState: 2
        });
    });

    it('guards a deliberate result through a complete traversal before automatic evolution', () => {
        const dsp = createRefrain();
        dsp.params.length = 2;
        dsp.params.amount = 1;
        dsp.params.chance = 100;
        processIdle(dsp);
        pulseAction(dsp, 'mutate');

        const manual = clockEdge(dsp);
        expect(manual.debug.changeAutoGuard).toBe(true);
        const deliberate = cloneCells(manual.debug.livePattern);
        const continuation = [...manual.debug.prngState];

        const guardedWrap = clockEdges(dsp, 32);
        expect(guardedWrap.debug).toMatchObject({
            cellIndex: 0,
            substepIndex: 0,
            livePattern: deliberate,
            prngState: continuation,
            changeAutoGuard: false
        });

        const automaticWrap = clockEdges(dsp, 32);
        expect(automaticWrap.debug.livePattern).not.toEqual(deliberate);
        expect(automaticWrap.debug.prngState).not.toEqual(continuation);
        expect(automaticWrap.leds.mutation).toBe(1);
    });

    it('snapshots the latest Mutate Amount/mask and keeps manual mutation available in Hold', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        const anchor = cloneCells(dsp.getDebugState().anchorPattern);

        dsp.params.amount = 1;
        setLaneMask(dsp, 1);
        pulseAction(dsp, 'mutate');
        dsp.params.amount = 4;
        setLaneMask(dsp, 5);
        pulseAction(dsp, 'mutate');
        dsp.params.amount = 2;
        setLaneMask(dsp, 8);
        clockEdge(dsp);
        const state = dsp.getDebugState();

        expect(state.anchorValid).toBe(true);
        expect(state.anchorPattern).toEqual(anchor);
        expect(changedCellIndices(anchor, state.livePattern)).toHaveLength(4);
        changedCellIndices(anchor, state.livePattern).forEach(cell => {
            expect(changedLanes(anchor, state.livePattern, cell)).toEqual(['key', 'energy']);
        });
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
        processIdle(recalled);
        clockEdges(recalled, 64);
        expect(recalled.getDebugState()).toMatchObject({
            activeLength: 4,
            cellIndex: 3,
            substepIndex: 15
        });

        recalled.params.seed = 1;
        recalled.params.length = 2;
        recalled.params.amount = 2;
        recalled.params.chance = 100;
        pulseAction(recalled, 'mutate');
        pulseAction(recalled, 'recall');

        clockEdge(recalled);
        expect(recalled.getDebugState()).toMatchObject({
            activeSeed: 1,
            activeLength: 2,
            livePattern: anchor,
            anchorPattern: anchor,
            pendingMutate: false,
            pendingRecall: false,
            prngState: createRefrainBaseSnapshot(1).prngState,
            changeAutoGuard: false
        });

        const mutated = createRefrain();
        processIdle(mutated);
        clockEdges(mutated, 64);
        mutated.params.seed = 1;
        mutated.params.length = 2;
        mutated.params.amount = 2;
        mutated.params.chance = 100;
        pulseAction(mutated, 'mutate');
        clockEdge(mutated);
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
        clockEdge(dsp);
        expect(dsp.getDebugState().livePattern).not.toEqual(anchor);

        dsp.params.anchor = 0;
        processIdle(dsp);
        expect(dsp.getDebugState().anchorPattern).toEqual(anchor);
        expect(dsp.leds.anchor).toBe(0.5);

        pulseAction(dsp, 'mutate');
        pulseAction(dsp, 'recall');
        expect(dsp.leds.pending).toBe(1);
        const boundary = clockEdges(dsp, 16);
        expect(boundary.debug.livePattern).toEqual(anchor);
        expect(boundary.debug.pendingMutate).toBe(false);
        expect(boundary.debug.pendingRecall).toBe(false);
        expect(boundary.leds.mutation).toBe(0);
    });

    it('uses the latest immediately overwritten Anchor when a queued Recall reaches its boundary', () => {
        const dsp = createRefrain();
        dsp.params.anchor = 1;
        processIdle(dsp);
        const originalAnchor = cloneCells(dsp.getDebugState().anchorPattern);

        dsp.params.amount = 2;
        pulseAction(dsp, 'mutate');
        clockEdge(dsp);
        const mutated = cloneCells(dsp.getDebugState().livePattern);
        expect(mutated).not.toEqual(originalAnchor);

        dsp.params.anchor = 0;
        processIdle(dsp);
        pulseAction(dsp, 'recall');
        dsp.params.anchor = 1;
        processIdle(dsp);
        expect(dsp.getDebugState().anchorPattern).toEqual(mutated);

        clockEdges(dsp, 16);
        expect(dsp.getDebugState().livePattern).toEqual(mutated);
        expect(dsp.getDebugState().pendingRecall).toBe(false);
    });

    it('ignores invalid Recall, disables auto in Hold, and applies Chance 0/100 exactly in Run', () => {
        const noRecall = createRefrain();
        processIdle(noRecall);
        pulseAction(noRecall, 'recall');
        expect(noRecall.getDebugState().pendingRecall).toBe(false);

        const never = createRefrain();
        never.params.length = 1;
        never.params.chance = 0;
        processIdle(never);
        const neverBefore = cloneCells(never.getDebugState().livePattern);
        clockEdges(never, 17);
        expect(never.getDebugState().livePattern).toEqual(neverBefore);

        const held = createRefrain();
        held.params.length = 1;
        held.params.chance = 100;
        held.params.anchor = 1;
        processIdle(held);
        const heldBefore = cloneCells(held.getDebugState().livePattern);
        const heldContinuation = [...held.getDebugState().prngState];
        clockEdges(held, 17);
        expect(held.getDebugState().livePattern).toEqual(heldBefore);
        expect(held.getDebugState().prngState).toEqual(heldContinuation);

        held.params.anchor = 0;
        processIdle(held);
        const automatic = clockEdges(held, 16);
        expect(automatic.debug.livePattern).not.toEqual(heldBefore);
        expect(automatic.leds.mutation).toBe(1);
    });

    it('reports one-hot position plus bounded substep, Anchor, pending, and visible 50ms event LEDs', () => {
        const dsp = createRefrain({ sampleRate: 1000, bufferSize: 10 });
        dsp.params.anchor = 1;
        processIdle(dsp);
        pulseAction(dsp, 'mutate');
        expect(dsp.leds.pending).toBe(0.5);
        expect(dsp.leds.anchor).toBe(1);
        expect(Object.values(dsp.leds).every(value => value >= 0 && value <= 1)).toBe(true);

        const boundary = clockEdge(dsp);
        expect(boundary.leds.mutation).toBe(1);
        expect(boundary.leds.substep).toBe(1);
        expect(boundary.leds.cell1).toBe(1);
        expect(['cell5', 'cell6', 'cell7', 'cell8'].every(id => boundary.leds[id] === 0)).toBe(true);
        processIdle(dsp);
        expect(dsp.leds.mutation).toBe(1);
        expect(dsp.leds.substep).toBe(1);
        processIdle(dsp);
        expect(dsp.leds.mutation).toBe(1);
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
            cellIndex: 0,
            substepIndex: 0,
            anchorValid: false,
            pendingMutate: false,
            pendingRecall: false,
            firstProcessPending: true
        });
        expect(dsp.params.anchor).toBe(1);
        expect(dsp.leds.anchor).toBe(0);

        processLevels(dsp, { seedCV: 1 / 12 });
        expect(dsp.getDebugState()).toMatchObject({
            activeSeed: 43,
            activePanelSeed: 42,
            activeLength: 2,
            anchorValid: true,
            livePattern: createRefrainBaseSnapshot(43).cells,
            anchorPattern: createRefrainBaseSnapshot(43).cells
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
