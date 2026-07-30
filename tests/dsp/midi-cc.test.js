import { describe, expect, it } from 'vitest';
import moduleDefinition from '../../src/js/modules/midi-cc/index.js';

describe('MIDI-CC', () => {
    it('slews controller values toward 0-10 V targets', () => {
        const midi = { getCCValue: (_channel, number) => number === 1 ? 127 : 0 };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 32, services: { midiManager: midi } });
        dsp.process();

        expect(dsp.outputs.cv1[0]).toBeGreaterThan(0);
        expect(dsp.outputs.cv1[31]).toBeGreaterThan(dsp.outputs.cv1[0]);
        expect(dsp.outputs.cv1[31]).toBeLessThanOrEqual(10);
        expect(dsp.outputs.cv2.every(value => value === 0)).toBe(true);
    });

    it('clears slew state and outputs on reset', () => {
        const dsp = moduleDefinition.createDSP({ bufferSize: 16, services: { midiManager: { getCCValue: () => 127 } } });
        dsp.process();
        dsp.reset();
        expect(dsp.outputs.cv1.every(value => value === 0)).toBe(true);
        expect(dsp.leds.active).toBe(0);
    });

    it('bounds malformed controller values and assignments to 0-10 V', () => {
        const midi = { getCCValue: (_channel, number) => number === 1 ? Infinity : NaN };
        const dsp = moduleDefinition.createDSP({ sampleRate: 1000, bufferSize: 32, services: { midiManager: midi } });
        dsp.params.channel = NaN;
        dsp.params.cc2 = Infinity;
        dsp.process();

        Object.values(dsp.outputs).forEach(output => {
            expect(output.every(Number.isFinite)).toBe(true);
            expect(Math.min(...output)).toBeGreaterThanOrEqual(0);
            expect(Math.max(...output)).toBeLessThanOrEqual(10);
        });
    });
});
