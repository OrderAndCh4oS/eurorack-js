import { describe, expect, it } from 'vitest';
import filter from '../../src/js/modules/dj-filter/index.js';

const sampleRate = 48000;
const bufferSize = 128;

function toneGain(frequency, params, cv = {}) {
    const dsp = filter.createDSP({ sampleRate, bufferSize });
    Object.assign(dsp.params, params);
    for (const [port, voltage] of Object.entries(cv)) {
        dsp.onInputConnected(port);
        dsp.inputs[port].fill(voltage);
    }
    let sumL = 0, sumR = 0;
    for (let block = 0; block < 160; block++) {
        for (let i = 0; i < bufferSize; i++) {
            dsp.inputs.inL[i] = Math.sin(2 * Math.PI * frequency * (block * bufferSize + i) / sampleRate);
        }
        dsp.process();
        if (block >= 80) {
            for (const v of dsp.outputs.outL) sumL += v * v;
            for (const v of dsp.outputs.outR) sumR += v * v;
        }
    }
    return [sumL, sumR].map(sum => Math.sqrt(2 * sum / (80 * bufferSize)));
}

describe('Stereo DJ Filter', () => {
    it('restores a saved bypass before the first sample of a new instance', () => {
        const dsp = filter.createDSP({ sampleRate, bufferSize: 16 });
        Object.assign(dsp.params, { bypass: 1, sweep: -1 });
        dsp.inputs.inL.set(Array.from({ length: 16 }, (_, i) => i % 2 ? -5 : 5));
        dsp.process();
        expect(dsp.outputs.outL).toEqual(dsp.inputs.inL);
    });

    it('passes independent dry voltages at noon and normals R to L only with the jack empty', () => {
        const dsp = filter.createDSP({ bufferSize: 4 });
        dsp.inputs.inL.set([-5, 0, 1.3, 5]);
        dsp.process();
        expect(dsp.outputs.outL).toEqual(dsp.inputs.inL);
        expect(dsp.outputs.outR).toEqual(dsp.inputs.inL);
        dsp.onInputConnected('inR');
        dsp.process();
        expect([...dsp.outputs.outR]).toEqual([0, 0, 0, 0]);
        dsp.inputs.inR.set([3, 0, -3, 0]);
        dsp.process();
        expect(dsp.outputs.outR).toEqual(dsp.inputs.inR);
        dsp.onInputDisconnected('inR');
        dsp.process();
        expect(dsp.outputs.outR).toEqual(dsp.inputs.inL);
    });

    it('sweeps low-pass to the left and high-pass to the right and keeps the limited stops audible', () => {
        expect(toneGain(80, { sweep: -1 })[0]).toBeGreaterThan(0.9);
        expect(toneGain(4000, { sweep: -1 })[0]).toBeLessThan(0.02);
        expect(toneGain(80, { sweep: 1 })[0]).toBeLessThan(0.02);
        expect(toneGain(8000, { sweep: 1 })[0]).toBeGreaterThan(0.9);
        expect(toneGain(100, { sweep: -1, limit: 0 })[0]).toBeLessThan(0.1);
        expect(toneGain(4000, { sweep: 1, limit: 0 })[0]).toBeLessThan(0.1);
    });

    it('adds master and resonance CV to the knob and keeps a silent channel silent', () => {
        expect(toneGain(180, { sweep: 0 }, { masterCV: 5 })[0]).toBeCloseTo(toneGain(180, { sweep: 1 })[0], 5);
        const boosted = toneGain(220, { sweep: -1 }, { resCV: 5 })[0];
        expect(boosted).toBeGreaterThan(toneGain(220, { sweep: -1 })[0] * 2);
        expect(boosted).toBeCloseTo(toneGain(220, { sweep: -1, resonance: 1 })[0], 4);
        const dsp = filter.createDSP({ bufferSize });
        Object.assign(dsp.params, { sweep: -1, resonance: 1 });
        dsp.onInputConnected('inR');
        dsp.inputs.inL.fill(4);
        for (let n = 0; n < 120; n++) dsp.process();
        expect(dsp.outputs.outR.every(v => v === 0)).toBe(true);
    });

    it('routes stereo tilt to the selected filter and accepts bipolar tilt CV', () => {
        const low = { sweep: -0.85, tilt: 1 };
        const both = toneGain(1000, { ...low, tiltRoute: 1 });
        expect(both[0]).toBeGreaterThan(both[1] * 2);
        expect(toneGain(1000, { ...low, tiltRoute: 0 })).toEqual(both);
        const unshifted = toneGain(1000, { ...low, tiltRoute: 2 });
        expect(unshifted[0]).toBe(unshifted[1]);
        const reversed = toneGain(1000, { sweep: -0.85 }, { tiltCV: -5 });
        expect(reversed[1]).toBeCloseTo(both[0], 4);
        expect(reversed[0]).toBeCloseTo(both[1], 4);
        const high = toneGain(400, { sweep: 0.8, tilt: 1, tiltRoute: 2 });
        expect(high[1]).toBeGreaterThan(high[0] * 2);
    });

    it('can engage both attenuverters and lets a silent cable override the +5 V offset', () => {
        const band = { lpAmount: -1, hpAmount: 1, offset: 1 };
        expect(toneGain(50, band)[0]).toBeLessThan(0.02);
        expect(toneGain(5000, band)[0]).toBeLessThan(0.02);
        expect(toneGain(50, band, { hpCV: 0 })[0]).toBeGreaterThan(0.9);
        expect(toneGain(5000, band, { lpCV: 0 })[0]).toBeGreaterThan(0.9);
        expect(toneGain(5000, { lpAmount: -1 }, { lpCV: 5 })[0]).toBeLessThan(0.02);
        expect(toneGain(50, { hpAmount: -1 }, { hpCV: -5 })[0]).toBeLessThan(0.02);
    });

    it('crossfades bypass to exact dry, recovers from invalid inputs and clears state in place', () => {
        const dsp = filter.createDSP({ bufferSize: 256, sampleRate });
        const ports = { ...dsp.inputs, ...dsp.outputs };
        dsp.inputs.inL.fill(4.95);
        dsp.params.sweep = 1;
        for (let n = 0; n < 20; n++) dsp.process();
        dsp.params.bypass = 1;
        dsp.process();
        expect(dsp.outputs.outL[0]).toBeLessThan(0.5);
        expect(dsp.outputs.outL[255]).toBe(dsp.inputs.inL[255]);
        expect(dsp.leds.active).toBe(0);
        dsp.params.bypass = 0;
        dsp.inputs.inL.fill(NaN);
        dsp.inputs.tiltCV.fill(Infinity);
        dsp.outputs.outL.fill(NaN);
        dsp.process();
        expect(dsp.outputs.outL.every(v => Number.isFinite(v) && Math.abs(v) <= 5)).toBe(true);
        dsp.reset();
        expect(dsp.leds.active).toBe(1);
        for (const [id, buffer] of Object.entries({ ...dsp.inputs, ...dsp.outputs })) {
            expect(buffer).toBe(ports[id]);
            expect(buffer.every(v => v === 0)).toBe(true);
        }
    });
});
