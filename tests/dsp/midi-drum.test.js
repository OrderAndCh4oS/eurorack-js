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
});
