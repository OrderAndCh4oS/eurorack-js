import { describe, expect, it } from 'vitest';
import resbankModule from '../../src/js/modules/resbank/index.js';

function create(options = {}) {
    return resbankModule.createDSP({ sampleRate: 8000, bufferSize: 256, ...options });
}

function energy(values) {
    return values.reduce((sum, value) => sum + value * value, 0) / values.length;
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

    it('auto-strums on a pitch step when strum and audio are unpatched', () => {
        const dsp = create();
        dsp.process();
        dsp.inputs.vOct.fill(0.5);
        dsp.process();
        expect(Math.max(...dsp.outputs.mix.map(Math.abs))).toBeGreaterThan(0.01);
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
            output.forEach(value => {
                expect(Number.isFinite(value)).toBe(true);
                expect(Math.abs(value)).toBeLessThanOrEqual(5.00001);
            });
        });
        dsp.reset();
        dsp.inputs.strum.fill(0);
        dsp.inputs.audio.fill(0);
        dsp.process();
        expect(Math.max(...dsp.outputs.mix.map(Math.abs))).toBe(0);
    });
});
