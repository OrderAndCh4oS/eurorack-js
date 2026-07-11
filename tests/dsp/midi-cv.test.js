import { describe, expect, it } from 'vitest';
import moduleDefinition from '../../src/js/modules/midi-cv/index.js';

function createService() {
    return {
        notes: [], bend: 0, mod: 0,
        getNoteEvents(channel) { return this.notes.filter(event => event.channel === channel); },
        getPitchBend() { return this.bend; },
        getModWheel() { return this.mod; }
    };
}

describe('MIDI-CV', () => {
    it('applies notes at sample offsets and maps expression to declared voltages', () => {
        const midi = createService();
        midi.notes = [{ type: 'noteOn', channel: 0, note: 72, velocity: 127, sampleOffset: 32 }];
        midi.mod = 127;
        const dsp = moduleDefinition.createDSP({ sampleRate: 48000, bufferSize: 128, services: { midiManager: midi } });
        dsp.process();

        expect(dsp.outputs.pitch[31]).toBe(0);
        expect(dsp.outputs.pitch[32]).toBe(1);
        expect(dsp.outputs.velocity[32]).toBe(10);
        expect(dsp.outputs.mod[32]).toBe(10);
    });

    it('falls back to the previous held note and resets deterministically', () => {
        const midi = createService();
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16, services: { midiManager: midi } });
        midi.notes = [
            { type: 'noteOn', channel: 0, note: 60, velocity: 80, sampleOffset: 0 },
            { type: 'noteOn', channel: 0, note: 64, velocity: 90, sampleOffset: 1 },
            { type: 'noteOff', channel: 0, note: 64, velocity: 0, sampleOffset: 2 }
        ];
        dsp.process();
        expect(dsp.outputs.pitch[1]).toBeCloseTo(4 / 12);
        expect(dsp.outputs.pitch[2]).toBe(0);
        dsp.reset();
        expect(dsp.outputs.pitch.every(value => value === 0)).toBe(true);
    });
});
