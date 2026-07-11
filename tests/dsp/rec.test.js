import { describe, expect, it } from 'vitest';
import moduleDefinition from '../../src/js/modules/rec/index.js';

describe('REC', () => {
    it('passes stereo audio through and records into one-second chunks', () => {
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 100 });
        dsp.params.record = 1;
        dsp.inputs.L.fill(2);
        dsp.inputs.R.fill(-3);
        for (let block = 0; block < 12; block++) dsp.process();
        dsp.params.record = 0;
        dsp.process();
        const [event] = dsp.drainEvents();

        expect(dsp.outputs.outL.every(value => value === 2)).toBe(true);
        expect(dsp.outputs.outR.every(value => value === -3)).toBe(true);
        expect(event.sampleCount).toBe(1200);
        expect(event.buffersL).toHaveLength(2);
        expect(event.buffersL[0]).toHaveLength(1000);
    });

    it('auto-stops at the exact injectable recording bound', () => {
        const dsp = moduleDefinition.createDSP({
            sampleRate: 1000, bufferSize: 16, maxRecordingSeconds: 0.02
        });
        dsp.params.record = 1;
        dsp.inputs.L.fill(1);
        dsp.inputs.R.fill(-1);
        dsp.process();
        dsp.process();
        const [event] = dsp.drainEvents();

        expect(event.sampleCount).toBe(20);
        expect(dsp.params.record).toBe(0);
        expect(dsp.leds.recording).toBe(0);
    });

    it('reset discards recording and pending events', () => {
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 16 });
        dsp.params.record = 1;
        dsp.process();
        dsp.reset();
        expect(dsp.getRecordingTime()).toBe(0);
        expect(dsp.drainEvents()).toEqual([]);
    });
});
