import { describe, expect, it } from 'vitest';
import mutes from '../../src/js/modules/mutes/index.js';

describe('Performance Mutes', () => {
    it('starts a saved closed channel or a high mute gate at silence on frame one', () => {
        const dsp = mutes.createDSP({ bufferSize: 128, sampleRate: 48000 });
        dsp.params.on1 = 0;
        dsp.inputs.in1.fill(10);
        dsp.inputs.mute2.fill(10);
        dsp.process();
        expect(dsp.outputs.out1.every(v => v === 0)).toBe(true);
        expect(dsp.outputs.out2.every(v => v === 0)).toBe(true);
        expect(dsp.outputs.out3[0]).toBe(10);
    });

    it('defaults to four open paths and restores the input cascade when a cable is removed', () => {
        const dsp = mutes.createDSP({ bufferSize: 4 });
        dsp.inputs.in1.set([-10, -2, 0, 10]);
        dsp.process();
        for (const buffer of Object.values(dsp.outputs)) expect(buffer).toEqual(dsp.inputs.in1);
        dsp.onInputConnected('in2');
        dsp.onInputConnected('in4');
        dsp.inputs.in4.fill(3);
        dsp.process();
        expect([...dsp.outputs.out2]).toEqual([0, 0, 0, 0]);
        expect(dsp.outputs.out3).toEqual(dsp.outputs.out2);
        expect(dsp.outputs.out4[0]).toBe(3);
        dsp.onInputDisconnected('in2');
        dsp.params.on2 = 0;
        dsp.process();
        expect(dsp.outputs.out3).toEqual(dsp.inputs.in1);
    });

    it('reads the routed mute CV on the first sample after reset on all four stems', () => {
        const dsp = mutes.createDSP({ sampleRate: 48000, bufferSize: 128 });
        dsp.inputs.in1.fill(5);
        dsp.process();
        expect(dsp.outputs.out1[0]).toBe(5);
        dsp.reset();
        dsp.inputs.in1.fill(5);
        for (const n of [1, 2, 3, 4]) dsp.inputs['mute' + n].fill(n === 1 ? 10 : 1);
        dsp.process();
        for (const n of [1, 2, 3, 4]) {
            expect(dsp.outputs['out' + n][0]).toBe(0);
            expect(dsp.outputs['out' + n].every(v => v === 0)).toBe(true);
            expect(dsp.leds['level' + n]).toBe(0);
        }
    });

    it.each([1, 2, 3, 4])('independently latches, punches in and gate-mutes stem %i', n => {
        const dsp = mutes.createDSP({ sampleRate: 1000, bufferSize: 256 });
        dsp.inputs.in1.fill(-5);
        const tail = () => dsp.outputs['out' + n].at(-1);
        dsp.params['on' + n] = 0;
        dsp.process();
        expect(tail()).toBe(0);
        expect(dsp.outputs['out' + (n === 4 ? 1 : n + 1)][255]).toBe(-5);
        dsp.params['hold' + n] = 1;
        dsp.inputs['mute' + n].fill(0.999);
        dsp.process();
        expect(tail()).toBe(-5);
        expect(dsp.leds['level' + n]).toBeGreaterThan(0);
        dsp.inputs['mute' + n].fill(1, 4);
        dsp.process();
        expect(dsp.outputs['out' + n][3]).toBe(-5);
        expect(dsp.outputs['out' + n][4]).toBeGreaterThan(-5);
        expect(tail()).toBe(0);
        dsp.inputs['mute' + n].fill(0);
        dsp.process();
        expect(tail()).toBe(-5);
        dsp.params['hold' + n] = 0;
        dsp.process();
        expect(tail()).toBe(0);
    });

    it.each([44100, 96000])('preserves the 3 ms rise and 12 ms release at %i Hz', sampleRate => {
        const size = Math.round(sampleRate * 0.012);
        const dsp = mutes.createDSP({ sampleRate, bufferSize: size });
        dsp.params.on1 = 0;
        dsp.reset();
        dsp.inputs.in1.fill(5);
        dsp.params.hold1 = 1;
        dsp.process();
        expect(dsp.outputs.out1[Math.round(sampleRate * 0.003) - 1]).toBeCloseTo(5 * (1 - Math.exp(-1)), 2);
        const open = dsp.outputs.out1[size - 1];
        dsp.params.hold1 = 0;
        dsp.process();
        expect(dsp.outputs.out1[0]).toBeCloseTo(open, 1);
        expect(dsp.outputs.out1[size - 1]).toBeCloseTo(open * Math.exp(-size / (0.012 * sampleRate)), 5);
    });

    it('overwrites every sample, handles bad voltage, and clears meters without replacing ports', () => {
        const dsp = mutes.createDSP({ bufferSize: 4 });
        const ports = { ...dsp.inputs, ...dsp.outputs };
        dsp.inputs.in1.set([NaN, Infinity, -14, 14]);
        for (const out of Object.values(dsp.outputs)) out.fill(NaN);
        dsp.process();
        expect([...dsp.outputs.out4]).toEqual([0, 0, -10, 10]);
        dsp.reset();
        for (const [id, buffer] of Object.entries({ ...dsp.inputs, ...dsp.outputs })) {
            expect(buffer).toBe(ports[id]);
            expect(buffer.every(v => v === 0)).toBe(true);
        }
        expect(Object.values(dsp.leds)).toEqual([0, 0, 0, 0]);
    });
});
