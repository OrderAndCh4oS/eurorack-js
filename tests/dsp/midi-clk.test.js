import { describe, expect, it } from 'vitest';
import moduleDefinition from '../../src/js/modules/midi-clk/index.js';

describe('MIDI clock', () => {
    it('applies start and stop at exact sample offsets', () => {
        const midi = { getClockEvents: () => [
            { type: 'start', sampleOffset: 4 },
            { type: 'stop', sampleOffset: 12 }
        ] };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16, services: { midiManager: midi } });
        dsp.process();

        expect(dsp.outputs.run[3]).toBe(0);
        expect(dsp.outputs.run[4]).toBe(10);
        expect(dsp.outputs.run[11]).toBe(10);
        expect(dsp.outputs.run[12]).toBe(0);
        expect(dsp.outputs.reset[4]).toBe(10);
    });

    it('emits divided clock pulses without collapsing events in one block', () => {
        const events = [{ type: 'start', sampleOffset: 0 }];
        for (let index = 0; index < 6; index++) events.push({ type: 'clock', sampleOffset: index + 1 });
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16, services: {
            midiManager: { getClockEvents: () => events }
        } });
        dsp.params.division = 4;
        dsp.process();
        expect(dsp.outputs.clock[6]).toBe(10);
    });
});
