import { describe, it, expect, beforeEach } from 'vitest';
import formantModule from '../../src/js/modules/formant/index.js';

const sampleRate = 44100;
const bufferSize = 512;

const createFormant = (options = {}) => formantModule.createDSP({ sampleRate, bufferSize, ...options });

function rms(samples) {
    return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
}

function differenceRms(a, b) {
    return rms(a.map((sample, index) => sample - b[index]));
}

function expectFiniteAudioRange(samples) {
    samples.forEach(sample => {
        expect(Number.isFinite(sample)).toBe(true);
        expect(sample).toBeGreaterThanOrEqual(-5.0001);
        expect(sample).toBeLessThanOrEqual(5.0001);
    });
}

function fillSine(buffer, frequency, amplitude, phase = 0) {
    let nextPhase = phase;
    const increment = 2 * Math.PI * frequency / sampleRate;

    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sin(nextPhase) * amplitude;
        nextPhase += increment;
        if (nextPhase >= 2 * Math.PI) nextPhase -= 2 * Math.PI;
    }

    return nextPhase;
}

function renderTone(params, frequency, { amplitude = 1.25, blocks = 140, cv = {} } = {}) {
    const dsp = createFormant();
    Object.assign(dsp.params, params);

    Object.entries(cv).forEach(([port, value]) => {
        dsp.inputs[port].fill(value);
    });

    let phase = 0;
    for (let block = 0; block < blocks; block++) {
        phase = fillSine(dsp.inputs.audio, frequency, amplitude, phase);
        dsp.process();
    }

    return {
        dsp,
        out: Array.from(dsp.outputs.out),
        rms: rms(Array.from(dsp.outputs.out))
    };
}

function renderRich(params, { blocks = 80 } = {}) {
    const dsp = createFormant();
    Object.assign(dsp.params, params);

    let phaseA = 0;
    let phaseB = 0;
    let phaseC = 0;

    for (let block = 0; block < blocks; block++) {
        for (let i = 0; i < bufferSize; i++) {
            dsp.inputs.audio[i] =
                Math.sin(phaseA) * 3.0 +
                Math.sin(phaseB) * 2.0 +
                Math.sin(phaseC) * 1.25;

            phaseA += 2 * Math.PI * 110 / sampleRate;
            phaseB += 2 * Math.PI * 770 / sampleRate;
            phaseC += 2 * Math.PI * 2310 / sampleRate;
            if (phaseA >= 2 * Math.PI) phaseA -= 2 * Math.PI;
            if (phaseB >= 2 * Math.PI) phaseB -= 2 * Math.PI;
            if (phaseC >= 2 * Math.PI) phaseC -= 2 * Math.PI;
        }
        dsp.process();
    }

    return {
        dsp,
        out: Array.from(dsp.outputs.out),
        rms: rms(Array.from(dsp.outputs.out))
    };
}

describe('FORMANT module', () => {
    let dsp;

    beforeEach(() => {
        dsp = createFormant();
    });

    describe('metadata and UI contract', () => {
        it('matches the researched module contract', () => {
            expect(formantModule.id).toBe('formant');
            expect(formantModule.name).toBe('FORMANT');
            expect(formantModule.hp).toBe(6);
            expect(formantModule.color).toBe('module-color-ten');
            expect(formantModule.category).toBe('filter');

            expect(formantModule.ui.leds).toEqual(['level']);
            expect(formantModule.ui.knobs.map(knob => knob.param)).toEqual([
                'vowel',
                'resonance',
                'shift',
                'drive',
                'mix'
            ]);
            expect(formantModule.ui.inputs.map(input => [input.port, input.signal])).toEqual([
                ['audio', 'audio'],
                ['vowelCV', 'cv'],
                ['shiftCV', 'cv'],
                ['resCV', 'cv']
            ]);
            expect(formantModule.ui.outputs.map(output => [output.port, output.signal])).toEqual([
                ['out', 'audio']
            ]);
        });
    });

    describe('initialization', () => {
        it('creates default params, buffers, output, and LED', () => {
            expect(dsp.params).toEqual({
                vowel: 0.25,
                resonance: 0.55,
                shift: 0.5,
                drive: 0.25,
                mix: 1
            });

            expect(dsp.inputs.audio).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.vowelCV).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.shiftCV).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.resCV).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.out).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.out.length).toBe(bufferSize);
            expect(dsp.leds.level).toBe(0);
        });

        it('accepts custom sample rate and buffer size', () => {
            const custom = createFormant({ sampleRate: 48000, bufferSize: 128 });

            expect(custom.inputs.audio.length).toBe(128);
            expect(custom.outputs.out.length).toBe(128);
        });
    });

    describe('silence, ranges, and buffer integrity', () => {
        it('outputs silence and finite values with unpatched audio', () => {
            dsp.process();

            expect(Array.from(dsp.outputs.out).every(sample => sample === 0)).toBe(true);
            expect(dsp.leds.level).toBe(0);
        });

        it('keeps a rich nominal input inside the +/-5 V output contract', () => {
            const rendered = renderRich({
                vowel: 0.5,
                resonance: 0.9,
                shift: 0.5,
                drive: 1,
                mix: 1
            });

            expect(rendered.rms).toBeGreaterThan(0.01);
            expectFiniteAudioRange(rendered.out);
            expect(rendered.dsp.leds.level).toBeGreaterThan(0);
            expect(rendered.dsp.leds.level).toBeLessThanOrEqual(1);
        });

        it('writes the entire output buffer without NaN or Infinity', () => {
            dsp.outputs.out.fill(Number.NaN);
            dsp.params.resonance = 1;
            dsp.params.drive = 1;
            dsp.params.shift = 1;
            dsp.inputs.vowelCV.fill(5);
            dsp.inputs.shiftCV.fill(5);
            dsp.inputs.resCV.fill(5);

            for (let block = 0; block < 30; block++) {
                fillSine(dsp.inputs.audio, 137 + block, 7);
                dsp.process();
            }

            expectFiniteAudioRange(Array.from(dsp.outputs.out));
        });
    });

    describe('mix and drive controls', () => {
        it('returns the dry path when mix is zero', () => {
            dsp.params.mix = 0;
            fillSine(dsp.inputs.audio, 330, 2);
            const input = Array.from(dsp.inputs.audio);

            dsp.process();

            dsp.outputs.out.forEach((sample, index) => {
                expect(sample).toBeCloseTo(input[index], 5);
            });
        });

        it('returns wet formant output at mix one and blends halfway at mix 0.5', () => {
            const commonParams = {
                vowel: 0,
                resonance: 0.8,
                shift: 0.5,
                drive: 0.2
            };

            const dry = renderTone({ ...commonParams, mix: 0 }, 1000, { amplitude: 1 }).out;
            const wet = renderTone({ ...commonParams, mix: 1 }, 1000, { amplitude: 1 }).out;
            const half = renderTone({ ...commonParams, mix: 0.5 }, 1000, { amplitude: 1 }).out;

            expect(differenceRms(dry, wet)).toBeGreaterThan(0.05);
            half.forEach((sample, index) => {
                expect(sample).toBeCloseTo((dry[index] + wet[index]) * 0.5, 4);
            });
        });

        it('changes the waveform at high drive without escaping the voltage range', () => {
            const lowDrive = renderRich({
                vowel: 0.25,
                resonance: 0.65,
                shift: 0.5,
                drive: 0,
                mix: 1
            });
            const highDrive = renderRich({
                vowel: 0.25,
                resonance: 0.65,
                shift: 0.5,
                drive: 1,
                mix: 1
            });

            expect(differenceRms(lowDrive.out, highDrive.out)).toBeGreaterThan(0.03);
            expectFiniteAudioRange(highDrive.out);
        });
    });

    describe('vowel morphing and CV', () => {
        it('selects A and U target regions at the vowel extremes', () => {
            const aAt1000 = renderTone({ vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 }, 1000).rms;
            const aAt320 = renderTone({ vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 }, 320).rms;
            const uAt320 = renderTone({ vowel: 1, resonance: 1, shift: 0.5, drive: 0, mix: 1 }, 320).rms;
            const uAt1000 = renderTone({ vowel: 1, resonance: 1, shift: 0.5, drive: 0, mix: 1 }, 1000).rms;

            expect(aAt1000).toBeGreaterThan(aAt320 * 2);
            expect(uAt320).toBeGreaterThan(uAt1000 * 1.2);
        });

        it('changes spectral balance at midpoint vowel settings', () => {
            const aAt3200 = renderTone({ vowel: 0, resonance: 0.95, shift: 0.5, drive: 0, mix: 1 }, 3200).rms;
            const iAt3200 = renderTone({ vowel: 0.5, resonance: 0.95, shift: 0.5, drive: 0, mix: 1 }, 3200).rms;

            expect(iAt3200).toBeGreaterThan(aAt3200 * 1.5);
        });

        it('uses bipolar vowel CV and clamps at both ends', () => {
            const cvToUAt320 = renderTone(
                { vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                320,
                { cv: { vowelCV: 5 } }
            ).rms;
            const cvToUAt1000 = renderTone(
                { vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                1000,
                { cv: { vowelCV: 5 } }
            ).rms;
            const cvToAAt1000 = renderTone(
                { vowel: 1, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                1000,
                { cv: { vowelCV: -5 } }
            ).rms;
            const cvToAAt320 = renderTone(
                { vowel: 1, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                320,
                { cv: { vowelCV: -5 } }
            ).rms;

            expect(cvToUAt320).toBeGreaterThan(cvToUAt1000 * 1.2);
            expect(cvToAAt1000).toBeGreaterThan(cvToAAt320 * 2);
        });
    });

    describe('shift and resonance modulation', () => {
        it('moves formant peaks with the shift knob and shift CV', () => {
            const shiftedKnobAt2000 = renderTone({ vowel: 0, resonance: 1, shift: 1, drive: 0, mix: 1 }, 2000).rms;
            const shiftedKnobAt1000 = renderTone({ vowel: 0, resonance: 1, shift: 1, drive: 0, mix: 1 }, 1000).rms;
            const shiftedCvAt2000 = renderTone(
                { vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                2000,
                { cv: { shiftCV: 5 } }
            ).rms;
            const shiftedCvAt1000 = renderTone(
                { vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                1000,
                { cv: { shiftCV: 5 } }
            ).rms;
            const shiftedDownAt500 = renderTone(
                { vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                500,
                { cv: { shiftCV: -5 } }
            ).rms;
            const shiftedDownAt1000 = renderTone(
                { vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 },
                1000,
                { cv: { shiftCV: -5 } }
            ).rms;

            expect(shiftedKnobAt2000).toBeGreaterThan(shiftedKnobAt1000 * 2);
            expect(shiftedCvAt2000).toBeGreaterThan(shiftedCvAt1000 * 2);
            expect(shiftedDownAt500).toBeGreaterThan(shiftedDownAt1000 * 2);
        });

        it('increases selectivity with resonance and positive resonance CV', () => {
            const broadOn = renderTone({ vowel: 0, resonance: 0, shift: 0.5, drive: 0, mix: 1 }, 1000).rms;
            const broadOff = renderTone({ vowel: 0, resonance: 0, shift: 0.5, drive: 0, mix: 1 }, 700).rms;
            const narrowOn = renderTone({ vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 }, 1000).rms;
            const narrowOff = renderTone({ vowel: 0, resonance: 1, shift: 0.5, drive: 0, mix: 1 }, 700).rms;
            const cvOn = renderTone(
                { vowel: 0, resonance: 0, shift: 0.5, drive: 0, mix: 1 },
                1000,
                { cv: { resCV: 5 } }
            ).rms;
            const cvOff = renderTone(
                { vowel: 0, resonance: 0, shift: 0.5, drive: 0, mix: 1 },
                700,
                { cv: { resCV: 5 } }
            ).rms;

            expect(narrowOn / narrowOff).toBeGreaterThan(broadOn / broadOff);
            expect(cvOn / cvOff).toBeGreaterThan(broadOn / broadOff);
            expect(Number.isFinite(narrowOn)).toBe(true);
        });
    });

    describe('LED, reset, and input clearing', () => {
        it('raises the level LED with signal and decays after silence', () => {
            for (let block = 0; block < 20; block++) {
                fillSine(dsp.inputs.audio, 1000, 3);
                dsp.process();
            }
            const initialLevel = dsp.leds.level;

            dsp.inputs.audio.fill(0);
            for (let block = 0; block < 90; block++) {
                dsp.process();
            }

            expect(initialLevel).toBeGreaterThan(0);
            expect(initialLevel).toBeLessThanOrEqual(1);
            expect(dsp.leds.level).toBeLessThan(initialLevel);
        });

        it('clears filter state, output, smoothing state, and LED on reset', () => {
            dsp.params.vowel = 1;
            dsp.params.shift = 1;
            dsp.params.resonance = 1;
            fillSine(dsp.inputs.audio, 320, 3);
            dsp.process();

            expect(dsp.leds.level).toBeGreaterThan(0);

            dsp.reset();
            expect(Array.from(dsp.outputs.out).every(sample => sample === 0)).toBe(true);
            expect(dsp.leds.level).toBe(0);

            dsp.inputs.audio.fill(0);
            dsp.process();
            expect(Math.max(...Array.from(dsp.outputs.out).map(Math.abs))).toBeLessThan(1e-6);
        });

        it('keeps its input buffer stable and clears it on reset', () => {
            const input = dsp.inputs.audio;
            dsp.inputs.audio.fill(2);
            dsp.process();
            expect(dsp.inputs.audio).toBe(input);

            dsp.reset();
            expect(dsp.inputs.audio).toBe(input);
            expect(Array.from(dsp.inputs.audio).every(sample => sample === 0)).toBe(true);
        });
    });
});
