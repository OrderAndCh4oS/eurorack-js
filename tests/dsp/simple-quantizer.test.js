import { describe, it, expect, beforeEach } from 'vitest';
import quantModule, {
    quantizeVoltage,
    SCALES,
    SCALE_NAMES
} from '../../src/js/modules/quant/index.js';

// Helper to create Quantizer instance using new module system
const createQuantizer = (options = {}) => quantModule.createDSP(options);

describe('simple-quantizer', () => {
    describe('SCALES', () => {
        it('should have 16 scales defined', () => {
            expect(SCALE_NAMES.length).toBe(16);
        });

        it('should have chromatic scale with all 12 notes', () => {
            expect(SCALES.chromatic.length).toBe(12);
            expect(SCALES.chromatic).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        });

        it('should have major scale with 7 notes', () => {
            expect(SCALES.major.length).toBe(7);
            expect(SCALES.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
        });

        it('should have minor scale with 7 notes', () => {
            expect(SCALES.minor.length).toBe(7);
            expect(SCALES.minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
        });

        it('should have pentatonic scales with 5 notes', () => {
            expect(SCALES.pentatonicMaj.length).toBe(5);
            expect(SCALES.pentatonicMin.length).toBe(5);
        });
    });

    describe('quantizeVoltage', () => {
        it('should quantize 0V to 0V (C) in chromatic scale', () => {
            const result = quantizeVoltage(0, SCALES.chromatic);
            expect(result).toBe(0);
        });

        it('should quantize to nearest note in major scale', () => {
            // 0.25V = 3 semitones (D#/Eb), nearest major note is D (2) - equidistant but D comes first
            const result = quantizeVoltage(0.25, SCALES.major);
            // Should snap to D (2 semitones = 2/12 V)
            expect(result).toBeCloseTo(2 / 12, 5);
        });

        it('should handle octave transpose', () => {
            const withoutTranspose = quantizeVoltage(0, SCALES.major, 0, 0);
            const withOctaveUp = quantizeVoltage(0, SCALES.major, 1, 0);
            const withOctaveDown = quantizeVoltage(0, SCALES.major, -1, 0);

            expect(withOctaveUp - withoutTranspose).toBeCloseTo(1, 5); // 1V = 1 octave
            expect(withoutTranspose - withOctaveDown).toBeCloseTo(1, 5);
        });

        it('should handle semitone transpose', () => {
            const withoutTranspose = quantizeVoltage(0, SCALES.major, 0, 0);
            const withSemitone = quantizeVoltage(0, SCALES.major, 0, 3);

            expect(withSemitone - withoutTranspose).toBeCloseTo(3 / 12, 5);
        });

        it('should quantize negative voltages correctly', () => {
            const result = quantizeVoltage(-0.5, SCALES.chromatic, 0, 0);
            expect(result).toBeCloseTo(-0.5, 5);
        });

        it('chooses the nearest note across a negative octave boundary', () => {
            expect(quantizeVoltage(-0.01, SCALES.chromatic)).toBeCloseTo(0, 6);
            expect(quantizeVoltage(-11.9 / 12, SCALES.chromatic)).toBeCloseTo(-1, 6);
        });
    });

    describe('createSimpleQuantizer', () => {
        let quantizer;

        beforeEach(() => {
            quantizer = createQuantizer({ bufferSize: 128, sampleRate: 48000 });
        });

        describe('initialization', () => {
            it('should create quantizer instance', () => {
                expect(quantizer).toBeDefined();
            });

            it('should have correct default params', () => {
                expect(quantizer.params.scale).toBe(1);
                expect(quantizer.params.scale).toBe(quantModule.ui.knobs[0].default);
                expect(quantizer.params.octave).toBe(0);
                expect(quantizer.params.semitone).toBe(0);
            });

            it('should have cv input', () => {
                expect(quantizer.inputs).toHaveProperty('cv');
                expect(quantModule.ui.inputs[0].voltage).toEqual({ min: -5, max: 5, normal: 0 });
            });

            it('should have cv and trigger outputs', () => {
                expect(quantizer.outputs.cv).toBeDefined();
                expect(quantizer.outputs.trigger).toBeDefined();
                expect(quantizer.outputs.cv.length).toBe(128);
                expect(quantizer.outputs.trigger.length).toBe(128);
                expect(quantModule.ui.outputs[1].voltage).toEqual({ min: 0, max: 5 });
            });

            it('should have active LED', () => {
                expect(quantizer.leds).toHaveProperty('active');
            });

            it('should have process function', () => {
                expect(typeof quantizer.process).toBe('function');
            });
        });

        describe('process', () => {
            it('should output 0V when no input connected', () => {
                quantizer.process();
                expect(quantizer.outputs.cv[0]).toBe(0);
            });

            it('should quantize input CV to selected scale', () => {
                quantizer.inputs.cv.fill(0.25); // ~3 semitones
                quantizer.params.scale = 1; // major scale

                quantizer.process();

                // Should be quantized to nearest major scale note
                // 3 semitones is between D (2) and E (4), D found first
                expect(quantizer.outputs.cv[0]).toBeCloseTo(2 / 12, 5);
            });

            it('should apply octave transpose', () => {
                quantizer.inputs.cv.fill(0);
                quantizer.params.octave = 1;

                quantizer.process();

                expect(quantizer.outputs.cv[0]).toBeCloseTo(1, 5); // 1V up
            });

            it('should apply semitone transpose', () => {
                quantizer.inputs.cv.fill(0);
                quantizer.params.semitone = 5; // Perfect 4th

                quantizer.process();

                expect(quantizer.outputs.cv[0]).toBeCloseTo(5 / 12, 5);
            });

            it('should generate trigger on note change', () => {
                // First process with 0V
                quantizer.inputs.cv.fill(0);
                quantizer.process();

                // Now change to different note
                quantizer.inputs.cv.fill(1); // 1 octave up
                quantizer.process();

                // Should have trigger at start of buffer
                expect(quantizer.outputs.trigger[0]).toBe(5);
            });

            it('should not trigger when note stays same', () => {
                quantizer.inputs.cv.fill(0);
                quantizer.process();

                // Process again with same input
                quantizer.process();

                // Middle samples should be 0 (no change)
                expect(quantizer.outputs.trigger[64]).toBe(0);
            });

            it('should handle all 16 scales', () => {
                quantizer.inputs.cv.fill(0.5);

                for (let i = 0; i < 16; i++) {
                    quantizer.params.scale = i;
                    expect(() => quantizer.process()).not.toThrow();
                }
            });

            it('emits an 8ms 5V trigger pulse on a note change', () => {
                const timed = createQuantizer({ sampleRate: 1000, bufferSize: 16 });
                timed.inputs.cv.fill(1);

                timed.process();

                expect([...timed.outputs.trigger.slice(0, 8)]).toEqual(Array(8).fill(5));
                expect([...timed.outputs.trigger.slice(8)]).toEqual(Array(8).fill(0));
            });

            it('clamps invalid params and recovers from non-finite CV', () => {
                quantizer.params.scale = Number.NaN;
                quantizer.params.octave = Number.POSITIVE_INFINITY;
                quantizer.params.semitone = Number.NEGATIVE_INFINITY;
                quantizer.inputs.cv.fill(Number.NaN);

                quantizer.process();

                expect(quantizer.outputs.cv.every(Number.isFinite)).toBe(true);
                expect(quantizer.outputs.trigger.every(Number.isFinite)).toBe(true);
                expect(Number.isFinite(quantizer.leds.active)).toBe(true);
            });
        });

        describe('LED behavior', () => {
            it('should light LED when note changes', () => {
                quantizer.inputs.cv.fill(0);
                quantizer.process();

                quantizer.inputs.cv.fill(1);
                quantizer.process();

                expect(quantizer.leds.active).toBe(1);
            });

            it('should decay LED when no note change', () => {
                quantizer.inputs.cv.fill(0);
                quantizer.process();
                quantizer.leds.active = 1;

                // Process with same note
                quantizer.process();

                expect(quantizer.leds.active).toBeLessThan(1);
            });
        });

        describe('reset', () => {
            it('clears stable buffers, trigger timing, held pitch, and LED state', () => {
                const input = quantizer.inputs.cv;
                const cvOut = quantizer.outputs.cv;
                const triggerOut = quantizer.outputs.trigger;
                quantizer.inputs.cv.fill(1);
                quantizer.process();

                quantizer.reset();

                expect(quantizer.inputs.cv).toBe(input);
                expect(quantizer.outputs.cv).toBe(cvOut);
                expect(quantizer.outputs.trigger).toBe(triggerOut);
                expect(input.every(value => value === 0)).toBe(true);
                expect(cvOut.every(value => value === 0)).toBe(true);
                expect(triggerOut.every(value => value === 0)).toBe(true);
                expect(quantizer.leds.active).toBe(0);
            });
        });
    });
});
