import { describe, expect, it, vi } from 'vitest';
import chaosModule from '../../src/js/modules/chaos/index.js';

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_BUFFER_SIZE = 128;

function create(options = {}) {
    return chaosModule.createDSP({
        sampleRate: DEFAULT_SAMPLE_RATE,
        bufferSize: DEFAULT_BUFFER_SIZE,
        ...options
    });
}

function expectNear(actual, expected, tolerance = 1e-5) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectBufferNear(actual, expected, tolerance = 1e-6) {
    expect(actual.length).toBe(expected.length);
    for (let index = 0; index < actual.length; index++) {
        expectNear(actual[index], expected[index], tolerance);
    }
}

function renderExactSecond(dsp, sampleRate) {
    const bufferSize = dsp.outputs.x.length;
    expect(sampleRate % bufferSize).toBe(0);
    const blockCount = sampleRate / bufferSize;
    let lobeTransitions = 0;
    let lastLobe = null;

    for (let block = 0; block < blockCount; block++) {
        dsp.process();
        for (let index = 0; index < bufferSize; index++) {
            const nextLobe = dsp.outputs.lobe[index];
            if (lastLobe !== null && nextLobe !== lastLobe) lobeTransitions++;
            lastLobe = nextLobe;
        }
    }

    const last = bufferSize - 1;
    return {
        axes: [dsp.outputs.x[last], dsp.outputs.y[last], dsp.outputs.z[last]],
        lobeTransitions
    };
}

function totalVariation(rate) {
    const dsp = create({ bufferSize: 100 });
    dsp.params.rate = rate;
    let previous = null;
    let variation = 0;

    for (let block = 0; block < DEFAULT_SAMPLE_RATE / 100; block++) {
        dsp.process();
        for (let index = 0; index < 100; index++) {
            const current = [dsp.outputs.x[index], dsp.outputs.y[index], dsp.outputs.z[index]];
            if (previous) {
                variation += Math.abs(current[0] - previous[0]);
                variation += Math.abs(current[1] - previous[1]);
                variation += Math.abs(current[2] - previous[2]);
            }
            previous = current;
        }
    }

    return variation;
}

function expectValidOutputs(dsp) {
    for (const port of ['x', 'y', 'z']) {
        const output = dsp.outputs[port];
        expect(output.every(Number.isFinite)).toBe(true);
        expect(output.every(sample => sample >= -5 && sample <= 5)).toBe(true);
    }
    expect(dsp.outputs.lobe.every(sample => sample === 0 || sample === 10)).toBe(true);
    for (const led of Object.values(dsp.leds)) {
        expect(Number.isFinite(led)).toBe(true);
        expect(led).toBeGreaterThanOrEqual(0);
        expect(led).toBeLessThanOrEqual(1);
    }
}

describe('Chaos', () => {
    it('declares the exact metadata and declarative panel contract', () => {
        expect(chaosModule).toMatchObject({
            id: 'chaos',
            name: 'Chaos',
            hp: 8,
            color: 'module-color-ten',
            category: 'modulation'
        });
        expect(chaosModule.ui.knobs).toEqual([
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.5 },
            { id: 'character', label: 'Character', param: 'character', min: 0, max: 1, default: 1 / 3 },
            { id: 'depth', label: 'Depth', param: 'depth', min: 0, max: 1, default: 1 }
        ]);
        expect(chaosModule.ui.inputs).toEqual([
            { id: 'rateCV', label: 'Rate', port: 'rateCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'characterCV', label: 'Char', port: 'characterCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ]);
        expect(chaosModule.ui.outputs).toEqual([
            { id: 'x', label: 'X', port: 'x', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'y', label: 'Y', port: 'y', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'z', label: 'Z', port: 'z', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'lobe', label: 'Lobe', port: 'lobe', signal: 'gate', voltage: { min: 0, max: 10 } }
        ]);
        expect(chaosModule.ui.leds).toEqual(['xLed', 'yLed', 'zLed', 'lobeLed']);

        for (const forbidden of [
            'render', 'telemetry', 'captureRuntimeState', 'restoreRuntimeState',
            'handleWorkletEvent'
        ]) {
            expect(chaosModule[forbidden]).toBeUndefined();
        }
        for (const forbidden of ['switches', 'buttons', 'actions', 'state']) {
            expect(chaosModule.ui[forbidden]).toBeUndefined();
        }
    });

    it('initializes matching defaults and separate stable buffers', () => {
        const dsp = create({ bufferSize: 37 });
        expect(dsp.params).toEqual({ rate: 0.5, character: 1 / 3, depth: 1 });
        expect(dsp.inputs).toEqual({
            rateCV: expect.any(Float32Array),
            characterCV: expect.any(Float32Array),
            reset: expect.any(Float32Array)
        });
        expect(dsp.outputs).toEqual({
            x: expect.any(Float32Array),
            y: expect.any(Float32Array),
            z: expect.any(Float32Array),
            lobe: expect.any(Float32Array)
        });
        const allBuffers = [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)];
        expect(new Set(allBuffers).size).toBe(allBuffers.length);
        for (const buffer of allBuffers) {
            expect(buffer).toHaveLength(37);
            expect(buffer.every(sample => sample === 0)).toBe(true);
        }
        expect(dsp.leds).toEqual({ xLed: 0.5, yLed: 0.5, zLed: 0.5, lobeLed: 0 });
        expect(dsp.drainEvents).toBeUndefined();
    });

    it('matches the golden first default block and final LED mapping', () => {
        const dsp = create();
        dsp.process();

        expectNear(dsp.outputs.x[0], 3.4482796192, 1e-6);
        expectNear(dsp.outputs.y[0], 2.5900843143, 1e-6);
        expectNear(dsp.outputs.z[0], 1.5805529356, 1e-6);
        expect(dsp.outputs.lobe[0]).toBe(10);
        expectNear(dsp.outputs.x[127], 3.4444050789, 1e-6);
        expectNear(dsp.outputs.y[127], 2.5536072254, 1e-6);
        expectNear(dsp.outputs.z[127], 1.6086698771, 1e-6);
        expect(dsp.outputs.lobe[127]).toBe(10);

        expectNear(dsp.leds.xLed, dsp.outputs.x[127] / 10 + 0.5, 1e-7);
        expectNear(dsp.leds.yLed, dsp.outputs.y[127] / 10 + 0.5, 1e-7);
        expectNear(dsp.leds.zLed, dsp.outputs.z[127] / 10 + 0.5, 1e-7);
        expect(dsp.leds.lobeLed).toBe(1);
    });

    it('matches the one-second default trajectory across sample rates', () => {
        const expected = [2.454939, 3.208325, -1.696188];
        const results = [44100, 48000, 96000].map(sampleRate => {
            const dsp = create({ sampleRate, bufferSize: 100 });
            return renderExactSecond(dsp, sampleRate).axes;
        });

        for (const axes of results) {
            axes.forEach((value, axis) => expectNear(value, expected[axis], 1e-5));
        }
        for (let axis = 0; axis < 3; axis++) {
            expectNear(results[0][axis], results[1][axis], 1e-5);
            expectNear(results[2][axis], results[1][axis], 1e-5);
        }
    });

    it('maps Rate exponentially and changes traversal speed without changing rails', () => {
        const slowVariation = totalVariation(0);
        const fastVariation = totalVariation(1);

        expect(slowVariation).toBeGreaterThan(0.7);
        expect(slowVariation).toBeLessThan(1.0);
        expect(fastVariation).toBeGreaterThan(500);
        expect(fastVariation).toBeGreaterThan(slowVariation * 100);

        for (const rate of [0, 1]) {
            const dsp = create({ bufferSize: 1 });
            dsp.params.rate = rate;
            dsp.process();
            expectValidOutputs(dsp);
            expect(dsp.outputs.x[0]).toBeGreaterThan(3.4);
            expect(dsp.outputs.lobe[0]).toBe(10);
        }
    });

    it('applies Rate CV at one volt per octave with documented clamps', () => {
        const doubled = create({ bufferSize: 100 });
        doubled.inputs.rateCV.fill(1);
        const result = renderExactSecond(doubled, DEFAULT_SAMPLE_RATE);
        const expected = [-0.143663, -0.208829, -3.078136];
        result.axes.forEach((value, axis) => expectNear(value, expected[axis], 1e-5));
        expect(result.lobeTransitions).toBe(1);

        for (const rate of [0, 1]) {
            for (const cv of [-5, 5]) {
                const dsp = create();
                dsp.params.rate = rate;
                dsp.inputs.rateCV.fill(cv);
                for (let block = 0; block < 20; block++) dsp.process();
                expectValidOutputs(dsp);
            }
        }
    });

    it('maps Character and Character CV to the same clamped rho domain', () => {
        const render = ({ character = 1 / 3, cv = 0 } = {}) => {
            const dsp = create();
            dsp.params.character = character;
            dsp.inputs.characterCV.fill(cv);
            dsp.process();
            return dsp;
        };

        const highKnob = render({ character: 1 });
        const highCv = render({ cv: 5 });
        const lowKnob = render({ character: 0 });
        const lowCv = render({ cv: -5 });
        for (const port of ['x', 'y', 'z', 'lobe']) {
            expectBufferNear(highCv.outputs[port], highKnob.outputs[port], 0);
            expectBufferNear(lowCv.outputs[port], lowKnob.outputs[port], 0);
        }

        const defaults = render({ character: 1 / 3 });
        expect(Array.from(defaults.outputs.x)).not.toEqual(Array.from(lowKnob.outputs.x));
        expect(Array.from(defaults.outputs.x)).not.toEqual(Array.from(highKnob.outputs.x));
    });

    it('matches the one-second Character endpoint trajectories', () => {
        const cases = [
            { character: 0, expected: [-1.959004, -2.504195, -1.764815] },
            { character: 1, expected: [3.167364, 2.244047, 1.138022] }
        ];

        for (const testCase of cases) {
            const dsp = create({ bufferSize: 100 });
            dsp.params.character = testCase.character;
            const { axes } = renderExactSecond(dsp, DEFAULT_SAMPLE_RATE);
            axes.forEach((value, axis) => expectNear(value, testCase.expected[axis], 1e-5));
        }
    });

    it('applies Depth after state evolution without altering Lobe', () => {
        const full = create();
        const half = create();
        const zero = create();
        half.params.depth = 0.5;
        zero.params.depth = 0;

        for (let block = 0; block < 20; block++) {
            full.process();
            half.process();
            zero.process();
            expect(Array.from(half.outputs.lobe)).toEqual(Array.from(full.outputs.lobe));
            expect(Array.from(zero.outputs.lobe)).toEqual(Array.from(full.outputs.lobe));
            for (const port of ['x', 'y', 'z']) {
                for (let index = 0; index < DEFAULT_BUFFER_SIZE; index++) {
                    expectNear(half.outputs[port][index], full.outputs[port][index] * 0.5, 1e-6);
                    expect(zero.outputs[port][index]).toBe(0);
                }
            }
        }

        expect(zero.leds.xLed).toBe(0.5);
        expect(zero.leds.yLed).toBe(0.5);
        expect(zero.leds.zLed).toBe(0.5);
        expect(zero.leds.lobeLed).toBe(full.leds.lobeLed);
    });

    it('is deterministic and never consults Math.random', () => {
        const first = create();
        const second = create();
        first.params.rate = second.params.rate = 0.83;
        first.params.character = second.params.character = 0.71;
        first.inputs.rateCV.fill(-0.25);
        second.inputs.rateCV.fill(-0.25);

        const random = vi.spyOn(Math, 'random').mockImplementation(() => {
            throw new Error('Chaos must not use randomness');
        });
        try {
            for (let block = 0; block < 200; block++) {
                first.process();
                second.process();
                for (const port of ['x', 'y', 'z', 'lobe']) {
                    expect(Array.from(first.outputs[port])).toEqual(Array.from(second.outputs[port]));
                }
                expect(first.leds).toEqual(second.leds);
            }
        } finally {
            random.mockRestore();
        }
    });

    it('shows finite sensitivity to a one-sample Character perturbation', () => {
        const reference = create();
        const perturbed = create();
        reference.params.rate = 1;
        perturbed.params.rate = 1;
        perturbed.inputs.characterCV[0] = 0.0001;

        for (let block = 0; block < DEFAULT_SAMPLE_RATE / DEFAULT_BUFFER_SIZE; block++) {
            reference.process();
            perturbed.process();
            perturbed.inputs.characterCV[0] = 0;
        }

        const last = DEFAULT_BUFFER_SIZE - 1;
        const distance = Math.hypot(
            perturbed.outputs.x[last] - reference.outputs.x[last],
            perturbed.outputs.y[last] - reference.outputs.y[last],
            perturbed.outputs.z[last] - reference.outputs.z[last]
        );
        expect(distance).toBeGreaterThan(1);
        expectValidOutputs(reference);
        expectValidOutputs(perturbed);
    });

    it('derives the exact Lobe gate and LEDs from trajectory sign', () => {
        const dsp = create();
        dsp.params.rate = 1;
        let sawPositive = false;
        let sawNegative = false;

        for (let block = 0; block < 1000; block++) {
            dsp.process();
            for (let index = 0; index < DEFAULT_BUFFER_SIZE; index++) {
                const x = dsp.outputs.x[index];
                const gate = dsp.outputs.lobe[index];
                expect([0, 10]).toContain(gate);
                if (x > 0) {
                    sawPositive = true;
                    expect(gate).toBe(10);
                } else if (x < 0) {
                    sawNegative = true;
                    expect(gate).toBe(0);
                }
            }
        }

        expect(sawPositive).toBe(true);
        expect(sawNegative).toBe(true);
        expect(dsp.leds.lobeLed).toBe(dsp.outputs.lobe[DEFAULT_BUFFER_SIZE - 1] / 10);
    });

    it('uses a sample-accurate one-volt Reset rising edge with re-arm', () => {
        const dsp = create({ bufferSize: 4 });
        const uninterrupted = create({ bufferSize: 4 });
        dsp.process();
        uninterrupted.process();

        dsp.inputs.reset.fill(0.99);
        dsp.process();
        uninterrupted.process();
        for (const port of ['x', 'y', 'z', 'lobe']) {
            expectBufferNear(dsp.outputs[port], uninterrupted.outputs[port], 0);
        }

        const fresh = create({ bufferSize: 4 });
        fresh.process();
        dsp.inputs.reset.set([1, 10, 10, 0]);
        dsp.process();
        for (const port of ['x', 'y', 'z', 'lobe']) {
            expectNear(dsp.outputs[port][0], fresh.outputs[port][0], 1e-7);
            expectNear(dsp.outputs[port][1], fresh.outputs[port][1], 1e-7);
            expectNear(dsp.outputs[port][2], fresh.outputs[port][2], 1e-7);
        }

        dsp.inputs.reset.set([1, 10, 10, 10]);
        dsp.process();
        for (const port of ['x', 'y', 'z', 'lobe']) {
            expectNear(dsp.outputs[port][0], fresh.outputs[port][0], 1e-7);
        }
    });

    it('lifecycle reset clears all state in place and reproduces a fresh block', () => {
        const dsp = create();
        const inputRefs = Object.fromEntries(Object.entries(dsp.inputs));
        const outputRefs = Object.fromEntries(Object.entries(dsp.outputs));
        dsp.params.rate = 1;
        dsp.params.character = 1;
        dsp.inputs.rateCV.fill(5);
        dsp.inputs.characterCV.fill(-5);
        dsp.inputs.reset.fill(10);
        for (let block = 0; block < 40; block++) dsp.process();

        dsp.reset();
        for (const [port, buffer] of Object.entries(inputRefs)) {
            expect(dsp.inputs[port]).toBe(buffer);
            expect(buffer.every(sample => sample === 0)).toBe(true);
        }
        for (const [port, buffer] of Object.entries(outputRefs)) {
            expect(dsp.outputs[port]).toBe(buffer);
            expect(buffer.every(sample => sample === 0)).toBe(true);
        }
        expect(dsp.leds).toEqual({ xLed: 0.5, yLed: 0.5, zLed: 0.5, lobeLed: 0 });

        dsp.params.rate = 0.5;
        dsp.params.character = 1 / 3;
        const fresh = create();
        dsp.process();
        fresh.process();
        for (const port of ['x', 'y', 'z', 'lobe']) {
            expectBufferNear(dsp.outputs[port], fresh.outputs[port], 0);
        }
        expect(dsp.leds).toEqual(fresh.leds);
    });

    it('keeps every extreme finite, bounded, and buffer-stable across the audit matrix', () => {
        for (const sampleRate of [44100, 48000, 96000]) {
            for (const bufferSize of [128, 512]) {
                const dsp = create({ sampleRate, bufferSize });
                const inputRefs = Object.fromEntries(Object.entries(dsp.inputs));
                const outputRefs = Object.fromEntries(Object.entries(dsp.outputs));
                for (const rate of [0, 1]) {
                    for (const character of [0, 1]) {
                        for (const depth of [0, 1]) {
                            for (const rateCV of [-5, 0, 5]) {
                                for (const characterCV of [-5, 0, 5]) {
                                    dsp.params.rate = rate;
                                    dsp.params.character = character;
                                    dsp.params.depth = depth;
                                    dsp.inputs.rateCV.fill(rateCV);
                                    dsp.inputs.characterCV.fill(characterCV);
                                    dsp.inputs.reset.fill(0);
                                    dsp.process();
                                    expectValidOutputs(dsp);
                                }
                            }
                        }
                    }
                }
                dsp.reset();
                for (const [port, ref] of Object.entries(inputRefs)) expect(dsp.inputs[port]).toBe(ref);
                for (const [port, ref] of Object.entries(outputRefs)) expect(dsp.outputs[port]).toBe(ref);
            }
        }
    });

    it('sanitizes non-finite parameters and inputs without contaminating later samples', () => {
        const dsp = create();
        dsp.params.rate = Number.NaN;
        dsp.params.character = Number.POSITIVE_INFINITY;
        dsp.params.depth = Number.NEGATIVE_INFINITY;
        for (const input of Object.values(dsp.inputs)) {
            for (let index = 0; index < input.length; index++) {
                input[index] = index % 2 === 0 ? Number.NaN : Number.POSITIVE_INFINITY;
            }
        }
        dsp.process();
        expectValidOutputs(dsp);

        for (const input of Object.values(dsp.inputs)) input.fill(0);
        dsp.params.rate = 0.5;
        dsp.params.character = 1 / 3;
        dsp.params.depth = 1;
        dsp.process();
        expectValidOutputs(dsp);
        for (const output of Object.values(dsp.outputs)) {
            expect(output.every(Number.isFinite)).toBe(true);
        }
    });

    it('does not repeat sampled tuples and produces unequal Lobe dwell lengths', () => {
        const dsp = create();
        dsp.params.rate = 1;
        const tuples = new Set();
        const dwellLengths = [];
        let currentLobe = null;
        let currentDwell = 0;
        const blockCount = 2 * DEFAULT_SAMPLE_RATE / DEFAULT_BUFFER_SIZE;

        for (let block = 0; block < blockCount; block++) {
            dsp.process();
            const last = DEFAULT_BUFFER_SIZE - 1;
            const tuple = `${dsp.outputs.x[last]},${dsp.outputs.y[last]},${dsp.outputs.z[last]}`;
            expect(tuples.has(tuple)).toBe(false);
            tuples.add(tuple);

            for (const lobe of dsp.outputs.lobe) {
                if (currentLobe === null || lobe === currentLobe) {
                    currentLobe = lobe;
                    currentDwell++;
                } else {
                    dwellLengths.push(currentDwell);
                    currentLobe = lobe;
                    currentDwell = 1;
                }
            }
        }

        expect(tuples.size).toBe(blockCount);
        expect(dwellLengths.length).toBeGreaterThan(3);
        expect(new Set(dwellLengths).size).toBeGreaterThan(1);
    });
});
