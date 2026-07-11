import { describe, expect, it } from 'vitest';
import moduleDefinition from '../../src/js/modules/midi-4/index.js';

describe('MIDI-4', () => {
    it('allocates a chord from a shared sample-offset event block', () => {
        const midi = {
            getNoteEvents: () => [60, 64, 67].map((note, index) => ({
                type: 'noteOn', channel: 0, note, velocity: 100, sampleOffset: index
            })),
            getPitchBend: () => 0
        };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16, services: { midiManager: midi } });
        dsp.process();

        expect(dsp.outputs.pitch1[2]).toBe(0);
        expect(dsp.outputs.pitch2[2]).toBeCloseTo(4 / 12);
        expect(dsp.outputs.pitch3[2]).toBeCloseTo(7 / 12);
    });

    it('declares bend range and applies it to all active voices', () => {
        const midi = {
            getNoteEvents: () => [{ type: 'noteOn', channel: 0, note: 60, velocity: 100, sampleOffset: 0 }],
            getPitchBend: () => 8192
        };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16, services: { midiManager: midi } });
        dsp.params.bendRange = 12;
        dsp.process();

        expect(dsp.outputs.pitch1[0]).toBe(1);
        expect(moduleDefinition.ui.knobs.find(control => control.param === 'bendRange')).toBeDefined();
    });
});
