import { describe, expect, it } from 'vitest';
import moduleDefinition from '../../src/js/modules/midi-drum/index.js';

describe('MIDI drum', () => {
    it('maps notes, velocity, and sample offsets to trigger outputs', () => {
        const midi = { getNoteEvents: () => [
            { type: 'noteOn', channel: 9, note: 36, velocity: 127, sampleOffset: 8 }
        ] };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16, services: { midiManager: midi } });
        dsp.process();

        expect(dsp.outputs.trig1[7]).toBe(0);
        expect(dsp.outputs.trig1[8]).toBe(10);
        expect(dsp.outputs.velocity[8]).toBe(10);
    });

    it('filters explicit MIDI channels and clears state on reset', () => {
        const calls = [];
        const midi = { getNoteEvents(channel) { calls.push(channel); return []; } };
        const dsp = moduleDefinition.createDSP({ bufferSize: 16, services: { midiManager: midi } });
        dsp.params.channel = 10;
        dsp.process();
        expect(calls).toEqual([9]);
        dsp.reset();
        expect(dsp.outputs.velocity.every(value => value === 0)).toBe(true);
    });

    it('triggers every pad assigned to the same note', () => {
        const midi = { getNoteEvents: () => [
            { type: 'noteOn', channel: 9, note: 36, velocity: 64, sampleOffset: 0 }
        ] };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 8, services: { midiManager: midi } });
        dsp.params.note2 = 36;
        dsp.process();

        expect(dsp.outputs.trig1[0]).toBe(10);
        expect(dsp.outputs.trig2[0]).toBe(10);
        expect([...dsp.outputs.trig1]).toEqual([...dsp.outputs.trig2]);
    });

    it('contains malformed mappings and velocities within trigger/CV rails', () => {
        const midi = { getNoteEvents: () => [
            { type: 'noteOn', channel: 0, note: 36, velocity: Infinity, sampleOffset: 0 }
        ] };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 8, services: { midiManager: midi } });
        dsp.params.channel = NaN;
        dsp.params.note2 = Infinity;
        dsp.process();

        Object.values(dsp.outputs).forEach(output => expect(output.every(Number.isFinite)).toBe(true));
        expect(Math.max(...dsp.outputs.velocity)).toBeLessThanOrEqual(10);
        dsp.reset();
        expect(Object.values(dsp.leds).every(value => value === 0)).toBe(true);
    });
});
