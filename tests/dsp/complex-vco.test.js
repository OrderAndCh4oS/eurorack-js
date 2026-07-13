import { describe, expect, it } from 'vitest';
import complexVcoModule from '../../src/js/modules/complex-vco/index.js';
import {
    energy,
    expectExhaustivePanelCoverage,
    expectFiniteVoltage,
    maxAbs
} from './panel-test-helpers.js';

function create(options = {}) {
    return complexVcoModule.createDSP({ sampleRate: 48000, bufferSize: 4096, ...options });
}

function zeroCrossings(values) {
    let count = 0;
    for (let i = 1; i < values.length; i++) {
        if (values[i - 1] <= 0 && values[i] > 0) count++;
    }
    return count;
}

function amplitudeAt(values, sampleRate, frequency) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < values.length; i++) {
        const phase = 2 * Math.PI * frequency * i / sampleRate;
        re += values[i] * Math.cos(phase);
        im -= values[i] * Math.sin(phase);
    }
    return Math.hypot(re, im) / values.length;
}

describe('complex-vco', () => {
    it('declares its oscillator, modulation, and harmonic contracts', () => {
        const dsp = create({ bufferSize: 64 });
        expect(complexVcoModule).toMatchObject({ id: 'complex-vco', category: 'source', hp: 12 });
        expect(Object.keys(dsp.inputs)).toEqual([
            'vOct', 'expFm', 'tzFm', 'phase', 'reset', 'flip', 'fundAm', 'evenAm', 'oddAm'
        ]);
        expect(Object.keys(dsp.outputs)).toEqual(['core', 'fund', 'even', 'odd', 'full']);
        expect(dsp.params).toHaveProperty('tzFmAc');
        expect(dsp.params).toHaveProperty('tzFmBias');
        expectExhaustivePanelCoverage(complexVcoModule, {
            knobs: ['coarse', 'fine', 'expFmAmt', 'tzFmAmt', 'phaseAmt', 'fundLevel', 'evenLevel', 'oddLevel'],
            switches: ['range', 'tzFmAc', 'tzFmBias'],
            inputs: ['vOct', 'expFm', 'tzFm', 'phase', 'reset', 'flip', 'fundAm', 'evenAm', 'oddAm'],
            outputs: ['core', 'fund', 'even', 'odd', 'full'],
            leds: ['positive', 'negative']
        });
    });

    it('maps coarse and fine knobs across useful pitch ranges', () => {
        const low = create();
        low.params.coarse = 0.25;
        low.params.fine = -12;
        low.process();
        const high = create();
        high.params.coarse = 0.55;
        high.params.fine = 12;
        high.process();
        expect(zeroCrossings(high.outputs.fund)).toBeGreaterThan(zeroCrossings(low.outputs.fund) * 4);

        const fineDown = create();
        fineDown.params.coarse = 0.45;
        fineDown.params.fine = -12;
        fineDown.process();
        const fineUp = create();
        fineUp.params.coarse = 0.45;
        fineUp.params.fine = 12;
        fineUp.process();
        expect(zeroCrossings(fineUp.outputs.fund)).toBeCloseTo(zeroCrossings(fineDown.outputs.fund) * 4, -1);
    });

    it('tracks pitch at one volt per octave', () => {
        const base = create();
        base.params.coarse = 0.45;
        base.process();
        const octave = create();
        octave.params.coarse = 0.45;
        octave.inputs.vOct.fill(1);
        octave.process();
        expect(zeroCrossings(octave.outputs.fund)).toBeCloseTo(zeroCrossings(base.outputs.fund) * 2, -1);
    });

    it('applies exponential FM through its bipolar amount control', () => {
        const unmodulated = create();
        unmodulated.params.coarse = 0.42;
        unmodulated.inputs.expFm.fill(1);
        unmodulated.process();

        const positive = create();
        positive.params.coarse = 0.42;
        positive.params.expFmAmt = 1;
        positive.inputs.expFm.fill(1);
        positive.process();

        const negative = create();
        negative.params.coarse = 0.42;
        negative.params.expFmAmt = -1;
        negative.inputs.expFm.fill(1);
        negative.process();
        expect(zeroCrossings(positive.outputs.fund)).toBeCloseTo(zeroCrossings(unmodulated.outputs.fund) * 2, -1);
        expect(zeroCrossings(negative.outputs.fund)).toBeCloseTo(zeroCrossings(unmodulated.outputs.fund) / 2, -1);
    });

    it('allows through-zero FM to reverse signed phase motion', () => {
        const dsp = create({ sampleRate: 1000, bufferSize: 32 });
        dsp.params.coarse = 0;
        dsp.params.tzFmAmt = 1;
        dsp.inputs.tzFm.fill(-5);
        dsp.process();
        expect(dsp.outputs.fund[1]).toBeLessThan(dsp.outputs.fund[0]);
        expect(dsp.getPhase()).toBeGreaterThanOrEqual(0);
        expect(dsp.getPhase()).toBeLessThan(1);
    });

    it('gives TZ FM distinct DC, AC-coupled, and biased switch behavior', () => {
        const render = (tzFmAc, tzFmBias) => {
            const dsp = create({ sampleRate: 2000, bufferSize: 512 });
            dsp.params.coarse = 0.2;
            dsp.params.tzFmAmt = 1;
            dsp.params.tzFmAc = tzFmAc;
            dsp.params.tzFmBias = tzFmBias;
            dsp.inputs.tzFm.fill(-5);
            dsp.process();
            return Array.from(dsp.outputs.fund);
        };
        const dc = render(0, 0);
        const ac = render(1, 0);
        const biased = render(0, 1);
        expect(ac).not.toEqual(dc);
        expect(biased).not.toEqual(dc);
        expect(ac).not.toEqual(biased);
    });

    it('keeps phase modulation from changing the base cycle count', () => {
        const plain = create();
        plain.process();
        const modulated = create();
        modulated.params.phaseAmt = 1;
        for (let i = 0; i < modulated.inputs.phase.length; i++) {
            modulated.inputs.phase[i] = Math.sin(2 * Math.PI * 20 * i / 48000) * 5;
        }
        modulated.process();
        expect(zeroCrossings(modulated.outputs.core)).toBe(zeroCrossings(plain.outputs.core));
        expect(Array.from(modulated.outputs.fund)).not.toEqual(Array.from(plain.outputs.fund));
    });

    it('scales phase CV with a bipolar phase amount without altering the core', () => {
        const plain = create({ bufferSize: 512 });
        plain.inputs.phase.fill(2.5);
        plain.process();
        const positive = create({ bufferSize: 512 });
        positive.params.phaseAmt = 1;
        positive.inputs.phase.fill(2.5);
        positive.process();
        const negative = create({ bufferSize: 512 });
        negative.params.phaseAmt = -1;
        negative.inputs.phase.fill(2.5);
        negative.process();
        expect(Array.from(positive.outputs.core)).toEqual(Array.from(plain.outputs.core));
        expect(Array.from(positive.outputs.fund)).not.toEqual(Array.from(plain.outputs.fund));
        expect(Array.from(negative.outputs.fund)).not.toEqual(Array.from(positive.outputs.fund));
    });

    it('separates fundamental, even, and upper odd harmonic groups', () => {
        const dsp = create({ sampleRate: 8192, bufferSize: 8192 });
        dsp.params.coarse = complexVcoModule.frequencyToCoarse(64);
        dsp.process();
        expect(amplitudeAt(dsp.outputs.fund, 8192, 64)).toBeGreaterThan(1);
        expect(amplitudeAt(dsp.outputs.even, 8192, 128)).toBeGreaterThan(amplitudeAt(dsp.outputs.even, 8192, 64) * 4);
        expect(amplitudeAt(dsp.outputs.odd, 8192, 192)).toBeGreaterThan(amplitudeAt(dsp.outputs.odd, 8192, 64) * 4);
    });

    it.each([
        ['fundLevel', 'fund', 'fundAm'],
        ['evenLevel', 'even', 'evenAm'],
        ['oddLevel', 'odd', 'oddAm']
    ])('%s and %s independently control the %s output', (levelParam, outputPort, amPort) => {
        const muted = create({ bufferSize: 512 });
        muted.params[levelParam] = 0;
        muted.process();
        expect(maxAbs(muted.outputs[outputPort])).toBe(0);

        const positive = create({ bufferSize: 512 });
        positive.params[levelParam] = 1;
        positive.inputs[amPort].fill(5);
        positive.process();
        const inverted = create({ bufferSize: 512 });
        inverted.params[levelParam] = 1;
        inverted.inputs[amPort].fill(-5);
        inverted.process();
        expect(maxAbs(positive.outputs[outputPort])).toBeGreaterThan(0.01);
        expect(inverted.outputs[outputPort][100]).toBeCloseTo(-positive.outputs[outputPort][100], 5);

        const otherPorts = ['fund', 'even', 'odd'].filter(port => port !== outputPort);
        otherPorts.forEach(port => expect(Array.from(inverted.outputs[port])).toEqual(Array.from(positive.outputs[port])));
    });

    it('uses LF range for sub-audio operation', () => {
        const audio = create({ sampleRate: 1000, bufferSize: 1000 });
        audio.params.coarse = 0.5;
        audio.process();
        const low = create({ sampleRate: 1000, bufferSize: 1000 });
        low.params.coarse = 0.5;
        low.params.range = 1;
        low.process();
        expect(zeroCrossings(audio.outputs.fund)).toBeGreaterThan(10);
        expect(zeroCrossings(low.outputs.fund)).toBeLessThanOrEqual(1);
    });

    it('supports reset, flip, LF range, and balanced AM', () => {
        const positive = create({ sampleRate: 1000, bufferSize: 64 });
        positive.params.range = 1;
        positive.params.fundLevel = 1;
        positive.inputs.fundAm.fill(5);
        positive.process();

        const negative = create({ sampleRate: 1000, bufferSize: 64 });
        negative.params.range = 1;
        negative.params.fundLevel = 1;
        negative.inputs.fundAm.fill(-5);
        negative.process();
        expect(negative.outputs.fund[20]).toBeCloseTo(-positive.outputs.fund[20], 5);

        const dsp = create({ sampleRate: 1000, bufferSize: 64 });
        dsp.params.range = 1;
        dsp.inputs.flip[0] = 10;
        dsp.process();
        expect(dsp.getPhase()).toBeGreaterThan(0.9);
        dsp.inputs.reset.fill(0);
        dsp.inputs.reset[0] = 10;
        dsp.process();
        expect(dsp.outputs.fund[0]).toBeCloseTo(0, 4);
    });

    it('applies trigger thresholds and edge detection independently to reset and flip', () => {
        const reset = create({ sampleRate: 1000, bufferSize: 8 });
        reset.params.coarse = 0.4;
        reset.process();
        reset.inputs.reset.fill(0.999);
        reset.process();
        expect(reset.outputs.fund[0]).not.toBeCloseTo(0, 4);
        reset.inputs.reset.fill(10);
        reset.process();
        expect(reset.outputs.fund[0]).toBeCloseTo(0, 4);
        reset.process();
        expect(reset.outputs.fund[0]).not.toBeCloseTo(0, 4);

        const flip = create({ sampleRate: 1000, bufferSize: 8 });
        flip.params.coarse = 0;
        flip.inputs.flip.fill(10);
        flip.process();
        const once = flip.getPhase();
        flip.process();
        expect(flip.getPhase()).toBeLessThan(once);
        flip.inputs.flip.fill(0);
        flip.process();
        flip.inputs.flip.fill(10);
        flip.process();
        const afterRetrigger = flip.getPhase();
        flip.process();
        expect(flip.getPhase()).toBeGreaterThan(afterRetrigger);
    });

    it('restores normalled TZ FM and AM inputs after routed buffers are released', () => {
        const dsp = create({ bufferSize: 8 });
        dsp.inputs.tzFm = new Float32Array(8).fill(-5);
        dsp.inputs.fundAm = new Float32Array(8).fill(0);
        dsp.inputs.evenAm = new Float32Array(8).fill(0);
        dsp.inputs.oddAm = new Float32Array(8).fill(0);
        dsp.process();
        expect(Array.from(dsp.inputs.tzFm)).toEqual(Array(8).fill(5));
        expect(Array.from(dsp.inputs.fundAm)).toEqual(Array(8).fill(5));
        expect(Array.from(dsp.inputs.evenAm)).toEqual(Array(8).fill(5));
        expect(Array.from(dsp.inputs.oddAm)).toEqual(Array(8).fill(5));
    });

    it('drives every output and reports the final full-output polarity on both LEDs', () => {
        const dsp = create({ bufferSize: 1024 });
        dsp.process();
        ['core', 'fund', 'even', 'odd', 'full'].forEach(port => expect(energy(dsp.outputs[port])).toBeGreaterThan(1e-6));
        const last = dsp.outputs.full.at(-1) / 5;
        expect(dsp.leds.positive).toBeCloseTo(Math.max(0, last), 6);
        expect(dsp.leds.negative).toBeCloseTo(Math.max(0, -last), 6);
    });

    it('fills stable finite buffers bounded to +/-5V', () => {
        const dsp = create({ bufferSize: 256 });
        const refs = { ...dsp.outputs };
        Object.values(dsp.inputs).forEach(input => input.fill(10));
        Object.values(dsp.params).forEach((value, key) => {
            if (typeof value === 'number') dsp.params[key] = Number.isInteger(value) ? value : 1;
        });
        dsp.process();
        dsp.process();
        Object.entries(dsp.outputs).forEach(([port, output]) => {
            expect(output).toBe(refs[port]);
        });
        expectFiniteVoltage(dsp.outputs, 5);
        dsp.reset();
        expect(dsp.getPhase()).toBe(0);
        expect(dsp.leds).toEqual({ positive: 0, negative: 0 });
        Object.values(dsp.outputs).forEach(output => expect(maxAbs(output)).toBe(0));
    });
});
