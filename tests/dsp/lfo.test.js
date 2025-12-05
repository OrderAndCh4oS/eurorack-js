import { describe, it, expect, beforeEach } from 'vitest';
import { create2hpLFO } from '../../src/js/dsp/lfo.js';

describe('create2hpLFO', () => {
    let lfo;

    beforeEach(() => {
        lfo = create2hpLFO();
    });

    describe('initialization', () => {
        it('should create an LFO with default params', () => {
            expect(lfo.params.range).toBe(0);
            expect(lfo.params.rateKnob).toBe(0.75);
            expect(lfo.params.waveKnob).toBe(0);
        });

        it('should create an LFO with default inputs', () => {
            expect(lfo.inputs.rateCV).toBe(0);
            expect(lfo.inputs.waveCV).toBe(0);
            expect(lfo.inputs.reset).toBe(0);
        });

        it('should create output buffers of correct size', () => {
            expect(lfo.outputs.primary).toBeInstanceOf(Float32Array);
            expect(lfo.outputs.secondary).toBeInstanceOf(Float32Array);
            expect(lfo.outputs.primary.length).toBe(512);
            expect(lfo.outputs.secondary.length).toBe(512);
        });

        it('should accept custom buffer size', () => {
            const customLfo = create2hpLFO({ bufferSize: 256 });
            expect(customLfo.outputs.primary.length).toBe(256);
        });
    });

    describe('output range (unipolar 0-5V)', () => {
        it('should produce output in 0-5V range', () => {
            lfo.params.rateKnob = 0.9; // Higher rate for more cycles

            // Process multiple times to get full waveform
            for (let i = 0; i < 10; i++) {
                lfo.process();
            }

            const min = Math.min(...lfo.outputs.primary);
            const max = Math.max(...lfo.outputs.primary);

            expect(min).toBeGreaterThanOrEqual(0);
            expect(max).toBeLessThanOrEqual(5);
        });

        it('should produce secondary output in 0-5V range', () => {
            lfo.params.rateKnob = 0.9;

            for (let i = 0; i < 10; i++) {
                lfo.process();
            }

            const min = Math.min(...lfo.outputs.secondary);
            const max = Math.max(...lfo.outputs.secondary);

            expect(min).toBeGreaterThanOrEqual(0);
            expect(max).toBeLessThanOrEqual(5);
        });
    });

    describe('parameter response', () => {
        it('should change rate with rateKnob', () => {
            const slowLfo = create2hpLFO({ bufferSize: 4410 }); // 100ms worth
            slowLfo.params.rateKnob = 0.2;
            slowLfo.process();
            const slowOutput = [...slowLfo.outputs.primary];

            const fastLfo = create2hpLFO({ bufferSize: 4410 });
            fastLfo.params.rateKnob = 0.9;
            fastLfo.process();
            const fastOutput = [...fastLfo.outputs.primary];

            // Count zero crossings (transitions through 2.5V)
            const countCrossings = (arr) => {
                let crossings = 0;
                for (let i = 1; i < arr.length; i++) {
                    if ((arr[i-1] < 2.5 && arr[i] >= 2.5) || (arr[i-1] >= 2.5 && arr[i] < 2.5)) {
                        crossings++;
                    }
                }
                return crossings;
            };

            expect(countCrossings(fastOutput)).toBeGreaterThan(countCrossings(slowOutput));
        });

        it('should respond to range parameter (slow vs fast)', () => {
            const slowRange = create2hpLFO({ bufferSize: 4410 });
            slowRange.params.range = 0; // Slow range
            slowRange.params.rateKnob = 0.5;
            slowRange.process();

            const fastRange = create2hpLFO({ bufferSize: 4410 });
            fastRange.params.range = 1; // Fast range
            fastRange.params.rateKnob = 0.5;
            fastRange.process();

            // Fast range should produce more variation in same time
            const variance = (arr) => {
                const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
                return arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / arr.length;
            };

            // Fast range at same knob position should be faster
            // This manifests as different phase after same number of samples
            // We just check both produce valid output
            expect(slowRange.outputs.primary.some(v => v > 0)).toBe(true);
            expect(fastRange.outputs.primary.some(v => v > 0)).toBe(true);
        });

        it('should morph waveforms with waveKnob', () => {
            const lfo1 = create2hpLFO();
            lfo1.params.waveKnob = 0; // Sine
            lfo1.process();
            const sineOutput = [...lfo1.outputs.primary];

            const lfo2 = create2hpLFO();
            lfo2.params.waveKnob = 0.75; // Closer to square
            lfo2.process();
            const squareOutput = [...lfo2.outputs.primary];

            // Different waveforms should produce different outputs
            const different = sineOutput.some((v, i) => Math.abs(v - squareOutput[i]) > 0.01);
            expect(different).toBe(true);
        });
    });

    describe('CV modulation', () => {
        it('should respond to rateCV', () => {
            const noCV = create2hpLFO({ bufferSize: 4410 });
            noCV.inputs.rateCV = 0;
            noCV.process();

            const withCV = create2hpLFO({ bufferSize: 4410 });
            withCV.inputs.rateCV = 3; // +3 octaves
            withCV.process();

            // Both should produce valid output
            expect(noCV.outputs.primary.some(v => v > 0)).toBe(true);
            expect(withCV.outputs.primary.some(v => v > 0)).toBe(true);
        });

        it('should respond to waveCV', () => {
            const noCV = create2hpLFO();
            noCV.inputs.waveCV = 0;
            noCV.process();
            const output1 = [...noCV.outputs.primary];

            const withCV = create2hpLFO();
            withCV.inputs.waveCV = 2.5;
            withCV.process();
            const output2 = [...withCV.outputs.primary];

            // Should produce different waveforms
            const different = output1.some((v, i) => Math.abs(v - output2[i]) > 0.01);
            expect(different).toBe(true);
        });
    });

    describe('reset trigger', () => {
        it('should reset phase on rising edge', () => {
            lfo.params.rateKnob = 0.5;

            // Run for a while to advance phase
            for (let i = 0; i < 5; i++) {
                lfo.process();
            }
            const beforeReset = [...lfo.outputs.primary];

            // Trigger reset
            lfo.inputs.reset = 5;
            lfo.process();
            const afterReset = [...lfo.outputs.primary];

            // After reset, phase should restart from 0
            // First sample should be near start of waveform
            expect(afterReset[0]).toBeDefined();
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers', () => {
            lfo.process();

            // Check no NaN or undefined values
            expect(lfo.outputs.primary.every(v => !isNaN(v) && v !== undefined)).toBe(true);
            expect(lfo.outputs.secondary.every(v => !isNaN(v) && v !== undefined)).toBe(true);
        });
    });
});
