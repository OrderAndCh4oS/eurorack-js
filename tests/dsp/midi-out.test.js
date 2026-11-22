import { describe, expect, it } from 'vitest';
import midiOut from '../../src/js/modules/midi-out/index.js';

function block(dsp, gate, time = 0) {
    dsp.inputs.gate.set(gate);
    dsp.process({ time });
    return dsp.drainEvents().flatMap(event => event.messages);
}

describe('MIDI OUT', () => {
    it('starts silent with stable input normals and releases the sampled pitch on its original channel', () => {
        const dsp = midiOut.createDSP({ sampleRate: 1000, bufferSize: 4 });
        const { gate, pitch, velocity } = dsp.inputs;
        expect(dsp.params.channel).toBe(1);
        expect([...velocity]).toEqual([10, 10, 10, 10]);
        expect(block(dsp, [0, 0, 0.99, 1], 2)).toEqual([[2.003, 0x90, 60, 127]]);
        expect(dsp.leds.gate).toBe(1);
        dsp.params.channel = 16;
        pitch.fill(-1 / 12);
        velocity.fill(5);
        expect(block(dsp, [10, 5, 0.9, 10], 3)).toEqual([
            [3.002, 0x80, 60, 0], [3.003, 0x9f, 59, 64]
        ]);
        expect(block(dsp, [0, 0, 0, 0], 4)).toEqual([[4, 0x8f, 59, 0]]);
        expect(dsp.leds.gate).toBe(0);
        expect(dsp.drainEvents()).toEqual([]);
        expect(dsp.inputs.gate).toBe(gate);
        expect(dsp.inputs.pitch).toBe(pitch);
        expect(dsp.inputs.velocity).toBe(velocity);
    });

    it('tracks octaves, clips note and velocity rails, and preserves multiple short gates in one block', () => {
        const dsp = midiOut.createDSP({ sampleRate: 1000, bufferSize: 6 });
        dsp.inputs.pitch.set([1, 0, -20, 0, 20, 0]);
        dsp.inputs.velocity.set([8, 0, 0.1, 0, 20, 0]);
        expect(block(dsp, [5, 0, 5, 0, 5, 0]).map(message => message.slice(1))).toEqual([
            [0x90, 72, 102], [0x80, 72, 0], [0x90, 0, 1], [0x80, 0, 0], [0x90, 127, 127], [0x80, 127, 0]
        ]);
    });

    it('mutes zero and invalid velocity, treats an invalid gate as low, and resets its edge state', () => {
        const dsp = midiOut.createDSP({ bufferSize: 4 });
        dsp.inputs.velocity.set([NaN, -1, 0, 10]);
        expect(block(dsp, [1, 0, 1, 10])).toEqual([]);
        dsp.inputs.pitch.fill(NaN);
        expect(block(dsp, [NaN, 0, 0, 1]).map(message => message.slice(1))).toEqual([[0x90, 60, 127]]);
        dsp.reset();
        expect(dsp.leds.gate).toBe(0);
        expect(dsp.inputs.gate.every(value => value === 0)).toBe(true);
        expect(dsp.inputs.pitch.every(value => value === 0)).toBe(true);
        expect(dsp.inputs.velocity.every(value => value === 10)).toBe(true);
        expect(block(dsp, [1, 1, 1, 1])).toEqual([[0, 0x90, 60, 127]]);
    });
});
