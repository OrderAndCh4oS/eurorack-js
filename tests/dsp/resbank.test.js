import { describe, expect, it } from 'vitest';
import resbankModule from '../../src/js/modules/resbank/index.js';
import {
    energy,
    expectExhaustivePanelCoverage,
    expectFiniteVoltage,
    maxAbs
} from './panel-test-helpers.js';

function create(options = {}) {
    return resbankModule.createDSP({ sampleRate: 8000, bufferSize: 256, ...options });
}

function renderStrike(dsp, blocks = 16) {
    const rendered = [];
    dsp.inputs.strum[0] = 10;
    for (let block = 0; block < blocks; block++) {
        if (block) dsp.inputs.strum.fill(0);
        dsp.process();
        rendered.push(...dsp.outputs.mix);
    }
    return rendered;
}

describe('resbank', () => {
    it('declares the complete resonator contract', () => {
        const dsp = create({ bufferSize: 64 });
        expect(resbankModule).toMatchObject({ id: 'resbank', category: 'filter', hp: 14 });
        expect(Object.keys(dsp.inputs)).toEqual([
            'vOct', 'frequencyCv', 'structureCv', 'brightnessCv', 'dampingCv', 'positionCv', 'strum', 'audio'
        ]);
        expect(Object.keys(dsp.outputs)).toEqual(['mix', 'odd', 'even']);
        expect(dsp.params.model).toBe(0);
        expect(dsp.params.polyphony).toBe(0);
        expectExhaustivePanelCoverage(resbankModule, {
            knobs: [
                'frequency', 'frequencyAmt', 'structure', 'structureAmt', 'brightness',
                'brightnessAmt', 'damping', 'dampingAmt', 'position', 'positionAmt'
            ],
            buttons: ['model', 'polyphony'],
            inputs: [
                'vOct', 'frequencyCv', 'structureCv', 'brightnessCv',
                'dampingCv', 'positionCv', 'strum', 'audio'
            ],
            outputs: ['mix', 'odd', 'even'],
            leds: ['model', 'voice']
        });
    });

    it('maps the frequency knob across its declared pitch range', () => {
        const low = create({ bufferSize: 32 });
        low.params.frequency = 0;
        low.inputs.strum[0] = 10;
        low.process();
        const high = create({ bufferSize: 32 });
        high.params.frequency = 1;
        high.inputs.strum[0] = 10;
        high.process();
        expect(low.getVoiceFrequencies()[0]).toBeCloseTo(20, 2);
        expect(high.getVoiceFrequencies()[0]).toBeCloseTo(523.25, 2);
    });

    it('uses the bipolar frequency amount to scale the frequency CV input', () => {
        const frequencyFor = amount => {
            const dsp = create({ bufferSize: 32 });
            dsp.params.frequency = 0.4;
            dsp.params.frequencyAmt = amount;
            dsp.inputs.frequencyCv.fill(1);
            dsp.inputs.strum[0] = 10;
            dsp.process();
            return dsp.getVoiceFrequencies()[0];
        };
        const neutral = frequencyFor(0);
        expect(frequencyFor(1)).toBeCloseTo(neutral * 2, 3);
        expect(frequencyFor(-1)).toBeCloseTo(neutral / 2, 3);
    });

    it('uses an internal exciter and produces a decaying modal response', () => {
        const dsp = create();
        dsp.params.damping = 0.25;
        const signal = renderStrike(dsp, 24);
        expect(Math.max(...signal.map(Math.abs))).toBeGreaterThan(0.05);
        expect(energy(signal.slice(-256))).toBeLessThan(energy(signal.slice(0, 512)));
    });

    it('renders three distinct resonator models', () => {
        const rendered = [0, 1, 2].map(model => {
            const dsp = create();
            dsp.params.model = model;
            dsp.params.structure = 0.7;
            return renderStrike(dsp, 8);
        });
        expect(rendered[0]).not.toEqual(rendered[1]);
        expect(rendered[1]).not.toEqual(rendered[2]);
        rendered.forEach(signal => expect(energy(signal)).toBeGreaterThan(1e-7));
    });

    it.each(['structure', 'brightness', 'damping', 'position'])(
        '%s knob changes the resonator response', param => {
            const low = create();
            low.params[param] = 0.1;
            const lowSignal = renderStrike(low, 8);
            const high = create();
            high.params[param] = 0.9;
            const highSignal = renderStrike(high, 8);
            expect(highSignal).not.toEqual(lowSignal);
        }
    );

    it.each([
        ['structureCv', 'structureAmt'],
        ['brightnessCv', 'brightnessAmt'],
        ['dampingCv', 'dampingAmt'],
        ['positionCv', 'positionAmt']
    ])('%s is scaled independently by %s', (inputPort, amountParam) => {
        const neutral = create();
        neutral.params[amountParam] = 0;
        neutral.inputs[inputPort].fill(5);
        const neutralSignal = renderStrike(neutral, 6);

        const positive = create();
        positive.params[amountParam] = 1;
        positive.inputs[inputPort].fill(5);
        const positiveSignal = renderStrike(positive, 6);

        const negative = create();
        negative.params[amountParam] = -1;
        negative.inputs[inputPort].fill(5);
        const negativeSignal = renderStrike(negative, 6);
        expect(positiveSignal).not.toEqual(neutralSignal);
        expect(negativeSignal).not.toEqual(neutralSignal);
        expect(negativeSignal).not.toEqual(positiveSignal);
    });

    it('accepts external excitation and responds to every CV control', () => {
        const dry = create();
        dry.params.model = 0;
        dry.inputs.audio[0] = 5;
        dry.process();

        const modulated = create();
        modulated.params.model = 0;
        modulated.inputs.audio[0] = 5;
        modulated.params.structureAmt = 1;
        modulated.params.brightnessAmt = 1;
        modulated.params.dampingAmt = 1;
        modulated.params.positionAmt = 1;
        modulated.inputs.structureCv.fill(5);
        modulated.inputs.brightnessCv.fill(5);
        modulated.inputs.dampingCv.fill(5);
        modulated.inputs.positionCv.fill(5);
        modulated.process();
        expect(Array.from(modulated.outputs.mix)).not.toEqual(Array.from(dry.outputs.mix));
    });

    it('tracks one volt per octave and overlaps tails in polyphonic modes', () => {
        const base = create();
        base.params.frequency = 0.4;
        base.inputs.strum[0] = 10;
        base.process();
        const baseFrequency = base.getVoiceFrequencies()[0];

        const octave = create();
        octave.params.frequency = 0.4;
        octave.inputs.vOct.fill(1);
        octave.inputs.strum[0] = 10;
        octave.process();
        expect(octave.getVoiceFrequencies()[0]).toBeCloseTo(baseFrequency * 2, 3);

        const poly = create();
        poly.params.polyphony = 2;
        poly.inputs.strum[0] = 10;
        poly.process();
        poly.inputs.strum.fill(0);
        poly.process();
        poly.inputs.vOct.fill(0.5);
        poly.inputs.strum[0] = 10;
        poly.process();
        expect(poly.getActiveVoiceCount()).toBeGreaterThan(1);
    });

    it.each([
        [0, 1],
        [1, 2],
        [2, 4]
    ])('polyphony button %i allocates up to %i overlapping voices', (polyphony, expectedVoices) => {
        const dsp = create({ bufferSize: 16 });
        dsp.params.polyphony = polyphony;
        for (let strike = 0; strike < expectedVoices + 1; strike++) {
            dsp.inputs.vOct.fill(strike / 12);
            dsp.inputs.strum.fill(0);
            dsp.process();
            dsp.inputs.strum[0] = 10;
            dsp.process();
        }
        expect(dsp.getActiveVoiceCount()).toBe(expectedVoices);
    });

    it('enforces the Strum threshold and ignores a held-high trigger', () => {
        const below = create({ bufferSize: 16 });
        below.inputs.strum.fill(0.999);
        below.process();
        expect(below.getActiveVoiceCount()).toBe(0);

        const dsp = create({ bufferSize: 16 });
        dsp.params.polyphony = 2;
        dsp.inputs.strum.fill(1);
        dsp.process();
        expect(dsp.getActiveVoiceCount()).toBe(1);
        dsp.process();
        expect(dsp.getActiveVoiceCount()).toBe(1);
        dsp.inputs.strum.fill(0);
        dsp.process();
        dsp.inputs.strum.fill(1);
        dsp.process();
        expect(dsp.getActiveVoiceCount()).toBe(2);
    });

    it('uses the audio input transient threshold as an external exciter', () => {
        const below = create({ bufferSize: 32 });
        below.inputs.audio[0] = 0.5;
        below.process();
        expect(below.getActiveVoiceCount()).toBe(0);
        expect(maxAbs(below.outputs.mix)).toBe(0);

        const above = create({ bufferSize: 32 });
        above.inputs.audio[0] = 0.501;
        above.process();
        expect(above.getActiveVoiceCount()).toBe(1);
        expect(maxAbs(above.outputs.mix)).toBeGreaterThan(0);
    });

    it('auto-strums on a pitch step when strum and audio are unpatched', () => {
        const dsp = create();
        dsp.process();
        dsp.inputs.vOct.fill(0.5);
        dsp.process();
        expect(Math.max(...dsp.outputs.mix.map(Math.abs))).toBeGreaterThan(0.01);
    });

    it('drives mix, odd, and even outputs and reports model and allocated voice LEDs', () => {
        const dsp = create({ bufferSize: 256 });
        dsp.params.model = 2;
        dsp.params.polyphony = 2;
        const rendered = { mix: [], odd: [], even: [] };
        dsp.inputs.strum[0] = 10;
        for (let block = 0; block < 8; block++) {
            if (block) dsp.inputs.strum.fill(0);
            dsp.process();
            Object.keys(rendered).forEach(port => rendered[port].push(...dsp.outputs[port]));
        }
        expect(energy(rendered.mix)).toBeGreaterThan(1e-7);
        expect(energy(rendered.odd)).toBeGreaterThan(1e-8);
        expect(energy(rendered.even)).toBeGreaterThan(1e-8);
        expect(Array.from(dsp.outputs.mix)).not.toEqual(Array.from(dsp.outputs.odd));
        expect(Array.from(dsp.outputs.mix)).not.toEqual(Array.from(dsp.outputs.even));
        expect(dsp.leds.model).toBe(1);
        expect(dsp.leds.voice).toBe(0.25);
    });

    it('keeps mix and component outputs finite, bounded, stable, and resettable', () => {
        const dsp = create({ sampleRate: 48000, bufferSize: 128 });
        const refs = { ...dsp.outputs };
        dsp.params.model = 2;
        dsp.inputs.strum[0] = 10;
        Object.values(dsp.inputs).forEach(input => input.fill(10));
        dsp.process();
        Object.entries(dsp.outputs).forEach(([port, output]) => {
            expect(output).toBe(refs[port]);
        });
        expectFiniteVoltage(dsp.outputs, 5);
        dsp.reset();
        expect(dsp.leds).toEqual({ model: 0, voice: 0 });
        dsp.inputs.strum.fill(0);
        dsp.inputs.audio.fill(0);
        dsp.process();
        expect(Math.max(...dsp.outputs.mix.map(Math.abs))).toBe(0);
        expect(dsp.getActiveVoiceCount()).toBe(0);
        expect(dsp.leds).toEqual({ model: 1, voice: 0 });
    });
});
