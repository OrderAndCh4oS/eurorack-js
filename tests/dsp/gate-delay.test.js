import { describe, expect, it } from 'vitest';
import gateDelayModule from '../../src/js/modules/gate-delay/index.js';

function create(options = {}) {
    return gateDelayModule.createDSP({ sampleRate: 1000, bufferSize: 16, ...options });
}

describe('gate-delay', () => {
    it('declares the complete dual-channel contract', () => {
        const dsp = create();
        expect(gateDelayModule).toMatchObject({ id: 'gate-delay', category: 'clock', hp: 6 });
        expect(dsp.params).toEqual({ delay1: 0, length1: 0.35, delay2: 0, length2: 0.35 });
        expect(Object.keys(dsp.inputs)).toEqual(['trig1', 'trig2']);
        expect(Object.keys(dsp.outputs)).toEqual(['gate1', 'gate2']);
        expect(gateDelayModule.ui.inputs.map(port => port.port)).toEqual(['trig1', 'trig2']);
        expect(gateDelayModule.ui.outputs.map(port => port.port)).toEqual(['gate1', 'gate2']);
    });

    it('turns a rising edge into an immediate gate and ignores a held-high input', () => {
        const dsp = create({ sampleRate: 1000, bufferSize: 8 });
        dsp.params.length1 = 0.001; // 2 ms minimum non-zero timing.
        dsp.inputs.trig1[0] = 1;
        dsp.inputs.trig1.fill(10, 1);
        dsp.process();
        expect(Array.from(dsp.outputs.gate1)).toEqual([10, 10, 0, 0, 0, 0, 0, 0]);
        expect(dsp.leds.gate1).toBe(0);
    });

    it('preserves delayed timing across process blocks', () => {
        const dsp = create({ sampleRate: 1000, bufferSize: 4 });
        dsp.params.delay1 = 0.001; // 2 samples.
        dsp.params.length1 = 0.001; // 2 samples.
        dsp.inputs.trig1[3] = 10;
        dsp.process();
        expect(Array.from(dsp.outputs.gate1)).toEqual([0, 0, 0, 0]);

        dsp.inputs.trig1.fill(0);
        dsp.process();
        expect(Array.from(dsp.outputs.gate1)).toEqual([0, 10, 10, 0]);
    });

    it('runs channels independently and replaces a pending event on retrigger', () => {
        const dsp = create({ sampleRate: 1000, bufferSize: 8 });
        dsp.params.delay1 = 0.001;
        dsp.params.length1 = 0.001;
        dsp.params.length2 = 0.001;
        dsp.inputs.trig1[0] = 10;
        dsp.inputs.trig1[1] = 0;
        dsp.inputs.trig1[1] = 10;
        dsp.inputs.trig2[0] = 10;
        dsp.process();
        expect(dsp.outputs.gate2[0]).toBe(10);
        expect(dsp.outputs.gate1[0]).toBe(0);
        expect(Math.max(...dsp.outputs.gate1)).toBe(10);
    });

    it('emits no pulse at zero length and reset clears pending state', () => {
        const dsp = create({ sampleRate: 1000, bufferSize: 4 });
        dsp.params.delay1 = 0.001;
        dsp.params.length1 = 0;
        dsp.inputs.trig1[0] = 10;
        dsp.process();
        dsp.reset();
        dsp.inputs.trig1.fill(0);
        dsp.process();
        expect(Array.from(dsp.outputs.gate1)).toEqual([0, 0, 0, 0]);
        expect(dsp.leds).toEqual({ gate1: 0, gate2: 0 });
    });

    it('keeps every sample finite and inside the gate voltage contract', () => {
        const dsp = create({ sampleRate: 48000, bufferSize: 128 });
        dsp.params.delay1 = 1;
        dsp.params.length1 = 1;
        dsp.inputs.trig1.fill(10);
        dsp.process();
        Object.values(dsp.outputs).flatMap(output => Array.from(output)).forEach(value => {
            expect(Number.isFinite(value)).toBe(true);
            expect([0, 10]).toContain(value);
        });
    });
});
