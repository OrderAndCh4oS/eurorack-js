import { describe, expect, it } from 'vitest';
import complexVcoModule from '../../src/js/modules/complex-vco/index.js';

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

    it('separates fundamental, even, and upper odd harmonic groups', () => {
        const dsp = create({ sampleRate: 8192, bufferSize: 8192 });
        dsp.params.coarse = complexVcoModule.frequencyToCoarse(64);
        dsp.process();
        expect(amplitudeAt(dsp.outputs.fund, 8192, 64)).toBeGreaterThan(1);
        expect(amplitudeAt(dsp.outputs.even, 8192, 128)).toBeGreaterThan(amplitudeAt(dsp.outputs.even, 8192, 64) * 4);
        expect(amplitudeAt(dsp.outputs.odd, 8192, 192)).toBeGreaterThan(amplitudeAt(dsp.outputs.odd, 8192, 64) * 4);
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
            output.forEach(value => {
                expect(Number.isFinite(value)).toBe(true);
                expect(Math.abs(value)).toBeLessThanOrEqual(5.00001);
            });
        });
    });
});
