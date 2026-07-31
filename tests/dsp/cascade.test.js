import { describe, expect, it } from 'vitest';
import cascadeModule, {
    CASCADE_PRIORITY,
    CASCADE_RANK,
    computeCascadeFill,
    createCascadeMask,
    getCascadeLaneCount,
    isCascadeHit
} from '../../src/js/modules/cascade/index.js';
import changesModule, {
    createGeneratedPlanTableSnapshot,
    getPlanTableIndex
} from '../../src/js/modules/changes/index.js';
import { expectExhaustivePanelCoverage } from './panel-test-helpers.js';

const DEFAULT_SAMPLE_RATE = 1000;
const DEFAULT_BUFFER_SIZE = 32;

function createCascade(options = {}) {
    return cascadeModule.createDSP({
        sampleRate: DEFAULT_SAMPLE_RATE,
        bufferSize: DEFAULT_BUFFER_SIZE,
        ...options
    });
}

function clearInputs(dsp) {
    Object.values(dsp.inputs).forEach(input => input.fill(0));
}

function clockOnce(dsp, {
    voltage = 10,
    fillCV = 0,
    reset = 0
} = {}) {
    clearInputs(dsp);
    dsp.inputs.fillCV.fill(fillCV);
    dsp.inputs.clock[0] = voltage;
    dsp.inputs.reset[0] = reset;
    dsp.process();
    return {
        lanes: [1, 2, 3, 4].map(lane => dsp.outputs[`lane${lane}`][0]),
        leds: { ...dsp.leds }
    };
}

function collectRuntimeMasks({ fill, rotate = 0, fillCV = 0 }) {
    const dsp = createCascade({ bufferSize: 16 });
    Object.assign(dsp.params, { fill, rotate });
    const masks = [[], [], [], []];
    for (let step = 0; step < 16; step++) {
        const frame = clockOnce(dsp, { fillCV });
        frame.lanes.forEach((value, lane) => masks[lane].push(value === 10 ? 1 : 0));
    }
    return masks;
}

describe('CASCADE panel and initialization', () => {
    it('declares the exact metadata, controls, ports, voltages, normals, and LEDs', () => {
        expect(cascadeModule).toMatchObject({
            id: 'cascade',
            name: 'CASCADE',
            hp: 6,
            color: 'module-color-five',
            category: 'clock'
        });
        expect(cascadeModule.render).toBeUndefined();
        expect(cascadeModule.ui.knobs).toEqual([
            { id: 'fill', label: 'Fill', param: 'fill', min: 0, max: 16, default: 8, step: 1 },
            { id: 'rotate', label: 'Rotate', param: 'rotate', min: 0, max: 15, default: 0, step: 1 }
        ]);
        expect(cascadeModule.ui.actions).toEqual([
            { id: 'resetAction', label: 'Reset', param: 'resetAction', mode: 'trigger', default: 0 }
        ]);
        expect(cascadeModule.ui.inputs).toEqual([
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'fillCV', label: 'Fill', port: 'fillCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ]);
        expect(cascadeModule.ui.outputs).toEqual([
            { id: 'lane1', label: '1', port: 'lane1', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'lane2', label: '2', port: 'lane2', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'lane3', label: '3', port: 'lane3', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'lane4', label: '4', port: 'lane4', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]);
        expect(cascadeModule.ui.leds).toEqual(['lane1', 'lane2', 'lane3', 'lane4', 'pending']);

        expectExhaustivePanelCoverage(cascadeModule, {
            knobs: ['fill', 'rotate'],
            actions: ['resetAction'],
            inputs: ['clock', 'reset', 'fillCV'],
            outputs: ['lane1', 'lane2', 'lane3', 'lane4'],
            leds: ['lane1', 'lane2', 'lane3', 'lane4', 'pending']
        });
    });

    it('creates exact defaults and stable block-sized zero buffers', () => {
        const dsp = createCascade({ sampleRate: 48000, bufferSize: 17 });
        expect(dsp.params).toEqual({ fill: 8, rotate: 0, resetAction: 0 });
        expect(Object.keys(dsp.inputs)).toEqual(['clock', 'reset', 'fillCV']);
        expect(Object.keys(dsp.outputs)).toEqual(['lane1', 'lane2', 'lane3', 'lane4']);
        [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)].forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(17);
            expect([...buffer]).toEqual(Array(17).fill(0));
        });
        expect(dsp.leds).toEqual({ lane1: 0, lane2: 0, lane3: 0, lane4: 0, pending: 0 });
        expect(typeof dsp.process).toBe('function');
        expect(typeof dsp.reset).toBe('function');
    });

    it('fully writes finite binary outputs and preserves every buffer identity through reset', () => {
        const dsp = createCascade({ bufferSize: 19 });
        const inputRefs = { ...dsp.inputs };
        const outputRefs = { ...dsp.outputs };
        Object.values(dsp.inputs).forEach(input => input.fill(Number.NaN));
        Object.values(dsp.outputs).forEach(output => output.fill(Number.NaN));
        Object.assign(dsp.params, {
            fill: Number.NaN,
            rotate: Infinity,
            resetAction: Number.NaN
        });

        dsp.process();
        Object.values(dsp.outputs).forEach(output => {
            expect(output.every(value => value === 0 || value === 10)).toBe(true);
        });
        dsp.reset();
        Object.entries(inputRefs).forEach(([name, ref]) => {
            expect(dsp.inputs[name]).toBe(ref);
            expect([...ref]).toEqual(Array(19).fill(0));
        });
        Object.entries(outputRefs).forEach(([name, ref]) => {
            expect(dsp.outputs[name]).toBe(ref);
            expect([...ref]).toEqual(Array(19).fill(0));
        });
        expect(Object.values(dsp.leds).every(value => value === 0)).toBe(true);
        expect(dsp.params.resetAction).toBe(0);
    });
});

describe('CASCADE pure priority, rank, Fill, and mask planning', () => {
    it('contains the exact bit-reversal priority and inverse-rank tables', () => {
        expect(CASCADE_PRIORITY).toEqual([0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]);
        expect(CASCADE_RANK).toEqual([0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]);
        CASCADE_PRIORITY.forEach((step, rank) => {
            expect(CASCADE_RANK[step]).toBe(rank);
        });
    });

    it('applies exact Fill CV scaling, rounding, clamping, and non-finite fallback', () => {
        expect(computeCascadeFill(8, -5)).toBe(0);
        expect(computeCascadeFill(8, 0)).toBe(8);
        expect(computeCascadeFill(8, 5)).toBe(16);
        expect(computeCascadeFill(0, -100)).toBe(0);
        expect(computeCascadeFill(16, 100)).toBe(16);
        expect(computeCascadeFill(3, 0.31)).toBe(3);
        expect(computeCascadeFill(3, 0.32)).toBe(4);
        expect(computeCascadeFill(3.4, 0.1)).toBe(4);
        expect(computeCascadeFill(12.6, -0.1)).toBe(12);
        expect(computeCascadeFill(Number.NaN, Number.NaN)).toBe(8);
        expect(computeCascadeFill(Infinity, Infinity)).toBe(8);
    });

    it('has exact lane counts, lane nesting, Fill nesting, and rotation for every contract value', () => {
        for (let rotate = 0; rotate < 16; rotate++) {
            const previousMasks = Array(4).fill(null);
            for (let fill = 0; fill <= 16; fill++) {
                const masks = [];
                for (let lane = 1; lane <= 4; lane++) {
                    const mask = createCascadeMask(fill, rotate, lane);
                    masks.push(mask);
                    expect(mask).toHaveLength(16);
                    expect(mask.filter(Boolean)).toHaveLength(Math.floor(lane * fill / 4));
                    expect(getCascadeLaneCount(fill, lane)).toBe(Math.floor(lane * fill / 4));
                    mask.forEach((hit, step) => {
                        const rotatedStep = ((step - rotate) % 16 + 16) % 16;
                        expect(hit).toBe(CASCADE_RANK[rotatedStep] < Math.floor(lane * fill / 4));
                        expect(isCascadeHit(step, rotate, fill, lane)).toBe(hit);
                        if (lane > 1 && masks[lane - 2][step]) expect(hit).toBe(true);
                        if (previousMasks[lane - 1]?.[step]) expect(hit).toBe(true);
                    });
                    if (fill >= 4 && lane > 1) {
                        expect(mask.some((hit, step) => hit && !masks[lane - 2][step])).toBe(true);
                    }
                    previousMasks[lane - 1] = mask;
                }
            }
        }
    });

    it('matches the golden masks at Fill 0, Fill 8/Rotate 0, and Fill 16', () => {
        for (let lane = 1; lane <= 4; lane++) {
            expect(createCascadeMask(0, 0, lane).some(Boolean)).toBe(false);
        }
        expect(createCascadeMask(8, 0, 1)
            .map((hit, step) => hit ? step : -1).filter(step => step >= 0)).toEqual([0, 8]);
        expect(createCascadeMask(8, 0, 2)
            .map((hit, step) => hit ? step : -1).filter(step => step >= 0)).toEqual([0, 4, 8, 12]);
        expect(createCascadeMask(8, 0, 3)
            .map((hit, step) => hit ? step : -1).filter(step => step >= 0)).toEqual([0, 2, 4, 8, 10, 12]);
        expect(createCascadeMask(8, 0, 4)
            .map((hit, step) => hit ? step : -1).filter(step => step >= 0)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
        expect(createCascadeMask(16, 0, 4)).toEqual(Array(16).fill(true));
        expect([1, 2, 3, 4].map(lane => getCascadeLaneCount(16, lane))).toEqual([4, 8, 12, 16]);
    });
});

describe('CASCADE clocking, runtime masks, latching, pulses, and LEDs', () => {
    it('accepts only genuine rising edges strictly above 2.5V and starts at step zero', () => {
        const atThreshold = createCascade();
        expect(clockOnce(atThreshold, { voltage: 2.5 }).lanes).toEqual([0, 0, 0, 0]);
        expect(Object.values(atThreshold.leds).every(value => value === 0)).toBe(true);

        const aboveThreshold = createCascade({ bufferSize: 8 });
        aboveThreshold.params.fill = 16;
        aboveThreshold.inputs.clock.fill(2.5001);
        aboveThreshold.process();
        expect([1, 2, 3, 4].map(lane => aboveThreshold.outputs[`lane${lane}`][0]))
            .toEqual([10, 10, 10, 10]);
        aboveThreshold.process();
        aboveThreshold.inputs.clock.fill(0);
        aboveThreshold.process();
        aboveThreshold.inputs.clock.fill(10);
        aboveThreshold.process();
        expect(aboveThreshold.outputs.lane4[0]).toBe(10);
    });

    it('matches every pure Fill/Rotate mask at runtime and wraps after exactly 16 clocks', () => {
        for (let fill = 0; fill <= 16; fill++) {
            for (let rotate = 0; rotate < 16; rotate++) {
                const actual = collectRuntimeMasks({ fill, rotate });
                for (let lane = 1; lane <= 4; lane++) {
                    expect(actual[lane - 1]).toEqual(
                        createCascadeMask(fill, rotate, lane).map(Boolean).map(Number)
                    );
                }
                const dsp = createCascade({ bufferSize: 16 });
                Object.assign(dsp.params, { fill, rotate });
                const first = clockOnce(dsp).lanes;
                for (let step = 1; step < 16; step++) clockOnce(dsp);
                expect(clockOnce(dsp).lanes).toEqual(first);
            }
        }
    }, 30000);

    it('samples Fill and Fill CV on the current accepted clock with exact normal and fallback behavior', () => {
        const cases = [
            { fill: 8, cv: -5, expected: 0 },
            { fill: 8, cv: 0, expected: 8 },
            { fill: 8, cv: 5, expected: 16 },
            { fill: 0, cv: 5, expected: 8 },
            { fill: 3.4, cv: 0.1, expected: 4 },
            { fill: 12.6, cv: -0.1, expected: 12 },
            { fill: Number.NaN, cv: Number.NaN, expected: 8 }
        ];
        cases.forEach(({ fill, cv, expected }) => {
            const dsp = createCascade({ bufferSize: 16 });
            dsp.params.fill = fill;
            const runtime = Array.from({ length: 16 }, () => clockOnce(dsp, { fillCV: cv }).lanes);
            for (let lane = 1; lane <= 4; lane++) {
                expect(runtime.map(frame => frame[lane - 1] === 10 ? 1 : 0))
                    .toEqual(createCascadeMask(expected, 0, lane).map(Number));
            }
        });
    });

    it('phrase-latches Rotate through step 15, exposes Pending, and commits on natural step zero', () => {
        const dsp = createCascade({ bufferSize: 16 });
        dsp.params.fill = 8;
        expect(clockOnce(dsp).lanes[0]).toBe(10);
        dsp.params.rotate = 1;
        clearInputs(dsp);
        dsp.process();
        expect(dsp.leds.pending).toBe(1);

        for (let step = 1; step < 16; step++) {
            const frame = clockOnce(dsp);
            expect(frame.lanes[0] === 10).toBe(createCascadeMask(8, 0, 1)[step]);
            expect(frame.leds.pending).toBe(1);
        }
        const committed = clockOnce(dsp);
        expect(committed.lanes[0] === 10).toBe(createCascadeMask(8, 1, 1)[0]);
        expect(committed.leds.pending).toBe(0);
    });

    it('shows a pre-clock Rotate edit as pending and commits it on the first clock', () => {
        const dsp = createCascade({ bufferSize: 16 });
        dsp.params.fill = 8;
        dsp.params.rotate = 1;
        clearInputs(dsp);
        dsp.process();
        expect(dsp.leds.pending).toBe(1);

        const first = clockOnce(dsp);
        expect(first.lanes[0] === 10).toBe(createCascadeMask(8, 1, 1)[0]);
        expect(first.leds.pending).toBe(0);
    });

    it('does not cancel an active pulse when Fill falls on the next clock', () => {
        const dsp = createCascade({ sampleRate: 1000, bufferSize: 4 });
        dsp.params.fill = 16;
        dsp.inputs.clock[0] = 10;
        dsp.process();
        expect([...dsp.outputs.lane4]).toEqual([10, 10, 10, 10]);

        clearInputs(dsp);
        dsp.params.fill = 0;
        dsp.inputs.clock[0] = 10;
        dsp.process();
        expect([...dsp.outputs.lane4]).toEqual([10, 10, 10, 10]);
        clearInputs(dsp);
        dsp.process();
        expect([...dsp.outputs.lane4]).toEqual([0, 0, 0, 0]);
    });

    it('samples a changed Fill on that exact clock after the previous pulse has ended', () => {
        const rising = createCascade({ sampleRate: 1000, bufferSize: 8 });
        rising.params.fill = 0;
        expect(clockOnce(rising).lanes).toEqual([0, 0, 0, 0]);
        rising.params.fill = 16;
        expect(clockOnce(rising).lanes).toEqual(
            [1, 2, 3, 4].map(lane => createCascadeMask(16, 0, lane)[1] ? 10 : 0)
        );

        const falling = createCascade({ sampleRate: 1000, bufferSize: 8 });
        falling.params.fill = 16;
        expect(clockOnce(falling).lanes).toEqual([10, 10, 10, 10]);
        falling.params.fill = 0;
        expect(clockOnce(falling).lanes).toEqual([0, 0, 0, 0]);
    });

    it('emits exactly 8ms at 10V across sample rates and exactly 0V otherwise', () => {
        for (const sampleRate of [1000, 44100, 48000, 96000]) {
            const pulseSamples = Math.max(1, Math.round(sampleRate * 0.008));
            const dsp = createCascade({ sampleRate, bufferSize: pulseSamples + 5 });
            dsp.params.fill = 16;
            dsp.inputs.clock[0] = 10;
            dsp.process();
            for (let lane = 1; lane <= 4; lane++) {
                expect([...dsp.outputs[`lane${lane}`].slice(0, pulseSamples)])
                    .toEqual(Array(pulseSamples).fill(10));
                expect([...dsp.outputs[`lane${lane}`].slice(pulseSamples)])
                    .toEqual(Array(5).fill(0));
            }
        }
    });

    it('retriggering a lane restarts its fixed trigger counter', () => {
        const dsp = createCascade({ sampleRate: 2000, bufferSize: 30 });
        dsp.params.fill = 16;
        for (const sample of [0, 8]) dsp.inputs.clock[sample] = 10;
        dsp.process();
        expect([...dsp.outputs.lane4.slice(0, 24)]).toEqual(Array(24).fill(10));
        expect([...dsp.outputs.lane4.slice(24)]).toEqual(Array(6).fill(0));
    });

    it('holds lane LEDs for 50ms independently of the 8ms trigger voltage', () => {
        const dsp = createCascade({ sampleRate: 1000, bufferSize: 10 });
        dsp.params.fill = 16;
        dsp.inputs.clock[0] = 10;
        dsp.process();
        expect([...dsp.outputs.lane1]).toEqual([...Array(8).fill(10), 0, 0]);
        expect([dsp.leds.lane1, dsp.leds.lane2, dsp.leds.lane3, dsp.leds.lane4])
            .toEqual([1, 1, 1, 1]);

        clearInputs(dsp);
        for (let block = 0; block < 3; block++) dsp.process();
        expect(dsp.leds.lane1).toBe(1);
        dsp.process();
        expect(dsp.leds.lane1).toBe(0);

        const sparse = createCascade({ sampleRate: 1000, bufferSize: 10 });
        sparse.params.fill = 4;
        sparse.inputs.clock[0] = 10;
        sparse.process();
        expect(sparse.leds.lane1).toBe(1);
        clearInputs(sparse);
        for (let step = 1; step < 4; step++) clockOnce(sparse);
        expect(sparse.leds.lane4).toBe(1);
    });

    it('keeps staggered lane LED counters independent', () => {
        const dsp = createCascade({ sampleRate: 1000, bufferSize: 4 });
        dsp.params.fill = 4;
        clockOnce(dsp);
        for (let step = 1; step <= 8; step++) clockOnce(dsp);
        clearInputs(dsp);
        for (let block = 0; block < 4; block++) dsp.process();

        expect([dsp.leds.lane1, dsp.leds.lane2, dsp.leds.lane3, dsp.leds.lane4])
            .toEqual([0, 1, 1, 1]);
    });
});

describe('CASCADE reset semantics and deterministic replay', () => {
    it('external reset cancels all pulse/LED counters, sets Pending, and restarts on the next clock', () => {
        const dsp = createCascade({ sampleRate: 1000, bufferSize: 4 });
        dsp.params.fill = 16;
        clockOnce(dsp);
        clearInputs(dsp);
        dsp.inputs.reset[0] = 1;
        dsp.process();
        Object.values(dsp.outputs).forEach(output => expect([...output]).toEqual([0, 0, 0, 0]));
        expect([dsp.leds.lane1, dsp.leds.lane2, dsp.leds.lane3, dsp.leds.lane4])
            .toEqual([0, 0, 0, 0]);
        expect(dsp.leds.pending).toBe(1);

        const restarted = clockOnce(dsp);
        expect(restarted.lanes).toEqual([10, 10, 10, 10]);
        expect(restarted.leds.pending).toBe(0);
    });

    it('commits a pending Rotate when Reset restarts the next step zero', () => {
        const dsp = createCascade({ sampleRate: 1000, bufferSize: 8 });
        dsp.params.fill = 8;
        for (let step = 0; step < 5; step++) clockOnce(dsp);
        dsp.params.rotate = 3;
        clearInputs(dsp);
        dsp.inputs.reset[0] = 1;
        dsp.process();
        expect(dsp.leds.pending).toBe(1);

        const restarted = clockOnce(dsp);
        for (let lane = 1; lane <= 4; lane++) {
            expect(restarted.lanes[lane - 1] === 10)
                .toBe(createCascadeMask(8, 3, lane)[0]);
        }
        expect(restarted.leds.pending).toBe(0);
    });

    it('detects held Reset once, waits through an already-high Clock, and accepts same-sample Reset+Clock', () => {
        const dsp = createCascade({ sampleRate: 1000, bufferSize: 4 });
        dsp.params.fill = 16;
        clockOnce(dsp);
        clearInputs(dsp);
        dsp.inputs.clock.fill(10);
        dsp.process();
        dsp.inputs.reset.fill(10);
        dsp.process();
        expect(Object.values(dsp.outputs).every(output => output.every(value => value === 0))).toBe(true);
        expect(dsp.leds.pending).toBe(1);
        dsp.process();
        expect(Object.values(dsp.outputs).every(output => output.every(value => value === 0))).toBe(true);

        clearInputs(dsp);
        dsp.process();
        expect(clockOnce(dsp).lanes).toEqual([10, 10, 10, 10]);
        clockOnce(dsp);
        expect(clockOnce(dsp, { reset: 10 }).lanes).toEqual([10, 10, 10, 10]);
    });

    it('independently edge-detects Reset action and lifecycle reset clears all runtime state', () => {
        const dsp = createCascade({ bufferSize: 8 });
        dsp.params.fill = 16;
        for (let step = 0; step < 5; step++) clockOnce(dsp);
        clearInputs(dsp);
        dsp.params.resetAction = 1;
        dsp.process();
        expect(dsp.leds.pending).toBe(1);
        dsp.process();
        expect(dsp.leds.pending).toBe(1);
        dsp.params.resetAction = 0;
        dsp.process();
        expect(clockOnce(dsp).lanes).toEqual([10, 10, 10, 10]);

        Object.values(dsp.inputs).forEach(input => input.fill(10));
        Object.values(dsp.outputs).forEach(output => output.fill(10));
        dsp.reset();
        expect(Object.values(dsp.inputs).every(input => input.every(value => value === 0))).toBe(true);
        expect(Object.values(dsp.outputs).every(output => output.every(value => value === 0))).toBe(true);
        expect(Object.values(dsp.leds).every(value => value === 0)).toBe(true);
        expect(clockOnce(dsp).lanes).toEqual([10, 10, 10, 10]);
    });

    it('fresh instances and lifecycle resets replay every lane identically across sample rates and blocks', () => {
        const options = [
            { sampleRate: 1000, bufferSize: 17 },
            { sampleRate: 44100, bufferSize: 64 },
            { sampleRate: 48000, bufferSize: 257 }
        ];
        const phrases = options.map(option => {
            const dsp = createCascade(option);
            Object.assign(dsp.params, { fill: 11, rotate: 7 });
            const collectSpacedPhrase = () => Array.from({ length: 16 }, () => {
                const frame = clockOnce(dsp).lanes;
                clearInputs(dsp);
                const waitBlocks = Math.ceil((option.sampleRate * 0.008) / option.bufferSize) + 1;
                for (let block = 0; block < waitBlocks; block++) dsp.process();
                return frame;
            });
            const first = collectSpacedPhrase();
            dsp.reset();
            const replay = collectSpacedPhrase();
            expect(replay).toEqual(first);
            return first;
        });
        phrases.slice(1).forEach(phrase => expect(phrase).toEqual(phrases[0]));
    });
});

describe('CASCADE + CHANGES pair integration', () => {
    function createPair(fill) {
        const cascade = createCascade();
        const changes = changesModule.createDSP({
            sampleRate: DEFAULT_SAMPLE_RATE,
            bufferSize: DEFAULT_BUFFER_SIZE
        });
        Object.assign(cascade.params, { fill, rotate: 0 });
        Object.assign(changes.params, { key: 2, scale: 0, changes: 1, motion: 3 });
        return { cascade, changes };
    }

    function collectPair(pair) {
        const frames = [];
        for (let step = 0; step < 16; step++) {
            clearInputs(pair.cascade);
            Object.values(pair.changes.inputs).forEach(input => input.fill(0));
            pair.cascade.inputs.clock[0] = 10;
            pair.changes.inputs.clock[0] = 10;
            pair.cascade.process();
            pair.changes.process();
            frames.push({
                lanes: [1, 2, 3, 4].map(lane => pair.cascade.outputs[`lane${lane}`][0]),
                pitch: pair.changes.outputs.pitch[0],
                root: pair.changes.outputs.root[0],
                change: pair.changes.outputs.change[0]
            });
        }
        return frames;
    }

    it('keeps harmonic phase advancing on a common clock through lane rests', () => {
        const frames = collectPair(createPair(1));
        const table = createGeneratedPlanTableSnapshot();
        frames.forEach((frame, step) => {
            expect(frame.pitch).toBeCloseTo(
                (2 + table[getPlanTableIndex(0, 1, 3, step)]) / 12,
                6
            );
        });
        expect(frames.some(frame => frame.lanes[2] === 0)).toBe(true);
    });

    it('retains every previously articulated pitch position when Fill increases', () => {
        const sparse = collectPair(createPair(4));
        const dense = collectPair(createPair(12));
        sparse.forEach((frame, step) => {
            if (frame.lanes[2] === 10) {
                expect(dense[step].lanes[2]).toBe(10);
                expect(dense[step].pitch).toBe(frame.pitch);
            }
        });
    });

    it('shared reset exactly replays Changes and all Cascade lanes', () => {
        const pair = createPair(9);
        const first = collectPair(pair);
        clearInputs(pair.cascade);
        Object.values(pair.changes.inputs).forEach(input => input.fill(0));
        pair.cascade.inputs.reset[0] = 10;
        pair.changes.inputs.reset[0] = 10;
        pair.cascade.process();
        pair.changes.process();
        expect(collectPair(pair)).toEqual(first);
    });
});
