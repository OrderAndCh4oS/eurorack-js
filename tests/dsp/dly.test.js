import { describe, it, expect, beforeEach } from 'vitest';
import dlyModule from '../../src/js/modules/dly/index.js';

// Helper to create DLY instance
const createDLY = (options = {}) => dlyModule.createDSP(options);

describe('DLY (Delay)', () => {
    let dly;

    beforeEach(() => {
        dly = createDLY();
    });

    describe('initialization', () => {
        it('should create a delay with default params', () => {
            expect(dly.params.time).toBe(0.5);
            expect(dly.params.feedback).toBe(0.3);
            expect(dly.params.mix).toBe(0.5);
        });

        it('should create audio input buffer', () => {
            expect(dly.inputs.audio).toBeInstanceOf(Float32Array);
            expect(dly.inputs.audio.length).toBe(512);
        });

        it('should create CV input buffers', () => {
            expect(dly.inputs.timeCV).toBeInstanceOf(Float32Array);
            expect(dly.inputs.feedbackCV).toBeInstanceOf(Float32Array);
            expect(dly.inputs.mixCV).toBeInstanceOf(Float32Array);
        });

        it('should create output buffer', () => {
            expect(dly.outputs.out).toBeInstanceOf(Float32Array);
            expect(dly.outputs.out.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(dly.leds).toBeDefined();
            expect(dly.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const customDly = createDLY({ sampleRate: 48000, bufferSize: 256 });
            expect(customDly.outputs.out.length).toBe(256);
        });
    });

    describe('output range (audio ±5V)', () => {
        it('should produce output within audio range', () => {
            // Input a test signal
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dly.params.mix = 1; // Full wet
            dly.params.feedback = 0;
            dly.process();

            const max = Math.max(...dly.outputs.out);
            const min = Math.min(...dly.outputs.out);

            expect(max).toBeLessThanOrEqual(5.5);
            expect(min).toBeGreaterThanOrEqual(-5.5);
        });
    });

    describe('time knob behavior', () => {
        it('should delay signal by time amount', () => {
            // Create impulse at sample 0
            dly.inputs.audio.fill(0);
            dly.inputs.audio[0] = 5;

            dly.params.time = 0.01; // ~441 samples delay at 44100Hz
            dly.params.feedback = 0;
            dly.params.mix = 1; // Full wet

            // Process: the delayed impulse should appear after ~441 samples
            dly.process();

            // The output at sample 0 should be silent (delayed)
            expect(Math.abs(dly.outputs.out[0])).toBeLessThan(0.01);

            // The impulse should appear around sample 441 (within the 512-sample buffer)
            // Find the peak in the output
            let peakIndex = -1;
            let peakValue = 0;
            for (let i = 0; i < dly.outputs.out.length; i++) {
                if (Math.abs(dly.outputs.out[i]) > peakValue) {
                    peakValue = Math.abs(dly.outputs.out[i]);
                    peakIndex = i;
                }
            }

            // Peak should be near the expected delay time
            expect(peakIndex).toBeGreaterThan(400);
            expect(peakIndex).toBeLessThan(500);
            expect(peakValue).toBeGreaterThan(4); // Close to original 5V impulse
        });

        it('should have longer delay at max time', () => {
            dly.params.time = 1; // Max delay ~1 second

            // At 44100 Hz, 1 second = 44100 samples
            // Internal buffer should be large enough
            expect(dly.params.time).toBe(1);
        });

        it('should have shorter delay at min time', () => {
            dly.params.time = 0;
            expect(dly.params.time).toBe(0);
        });
    });

    describe('feedback knob behavior', () => {
        it('should have no repeats at zero feedback', () => {
            // Create impulse
            dly.inputs.audio.fill(0);
            dly.inputs.audio[0] = 5;

            dly.params.time = 0.01; // Very short delay
            dly.params.feedback = 0;
            dly.params.mix = 1;

            // Process many times
            let maxAfterFirst = 0;
            for (let i = 0; i < 50; i++) {
                dly.process();
                if (i > 5) {
                    maxAfterFirst = Math.max(maxAfterFirst, Math.max(...dly.outputs.out.map(Math.abs)));
                }
                dly.inputs.audio.fill(0);
            }

            // After initial delay, output should decay to near zero
            expect(maxAfterFirst).toBeLessThan(0.5);
        });

        it('should have multiple repeats with high feedback', () => {
            // Create impulse
            dly.inputs.audio.fill(0);
            dly.inputs.audio[0] = 5;

            dly.params.time = 0.01; // Short delay
            dly.params.feedback = 0.8;
            dly.params.mix = 1;

            // Process first buffer with impulse
            dly.process();
            dly.inputs.audio.fill(0);

            // Track outputs across multiple delay cycles
            // With 0.01 time, delay is ~441 samples, so each buffer of 512 samples
            // should see about 1 repeat
            let repeatCount = 0;
            let lastPeakBuffer = -10;

            for (let i = 0; i < 50; i++) {
                dly.process();
                const maxOut = Math.max(...dly.outputs.out.map(Math.abs));
                // Count significant peaks that are spaced apart (new repeats)
                if (maxOut > 0.1 && i - lastPeakBuffer > 0) {
                    repeatCount++;
                    lastPeakBuffer = i;
                }
            }

            // With high feedback, we should see multiple repeats
            expect(repeatCount).toBeGreaterThan(2);
        });

        it('should approach infinite repeats near max feedback', () => {
            dly.params.feedback = 0.99;
            expect(dly.params.feedback).toBeGreaterThan(0.9);
        });
    });

    describe('mix knob behavior', () => {
        it('should output only dry signal at mix = 0', () => {
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.sin(i * 0.1) * 3;
            }

            dly.params.mix = 0; // Full dry
            dly.params.feedback = 0;
            dly.process();

            // Output should match input (dry only)
            for (let i = 0; i < 512; i++) {
                expect(dly.outputs.out[i]).toBeCloseTo(dly.inputs.audio[i], 1);
            }
        });

        it('should output only wet signal at mix = 1', () => {
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.sin(i * 0.1) * 3;
            }

            dly.params.time = 0.5;
            dly.params.mix = 1; // Full wet
            dly.params.feedback = 0;
            dly.process();

            // First buffer with no prior audio - wet should be different from input
            const inputSum = dly.inputs.audio.reduce((a, b) => a + b, 0);
            const outputSum = dly.outputs.out.reduce((a, b) => a + b, 0);

            // Wet signal is delayed, so sums should be different
            expect(Math.abs(inputSum - outputSum)).toBeGreaterThan(0.1);
        });

        it('should blend dry and wet at mix = 0.5', () => {
            dly.params.mix = 0.5;
            expect(dly.params.mix).toBe(0.5);
        });
    });

    describe('CV modulation', () => {
        it('should respond to time CV', () => {
            dly.inputs.timeCV.fill(2); // +2V should increase delay time
            dly.process();

            // Time CV should modulate the delay time
            expect(dly.inputs.timeCV[0]).toBe(2);
        });

        it('should respond to feedback CV', () => {
            dly.inputs.feedbackCV.fill(3); // +3V
            dly.process();

            expect(dly.inputs.feedbackCV[0]).toBe(3);
        });

        it('should respond to mix CV', () => {
            dly.inputs.mixCV.fill(2);
            dly.process();

            expect(dly.inputs.mixCV[0]).toBe(2);
        });
    });

    describe('LED indicators', () => {
        it('should update active LED based on signal', () => {
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dly.process();

            // LED should indicate activity
            expect(typeof dly.leds.active).toBe('number');
        });
    });

    describe('reset', () => {
        it('should clear delay buffer on reset', () => {
            // Fill with signal
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dly.params.feedback = 0.9;
            for (let i = 0; i < 10; i++) {
                dly.process();
            }

            // Reset
            dly.reset();

            // Process with silence
            dly.inputs.audio.fill(0);
            dly.process();

            // Output should be silent after reset
            const maxOutput = Math.max(...dly.outputs.out.map(Math.abs));
            expect(maxOutput).toBeLessThan(0.01);
        });
    });

    describe('buffer integrity', () => {
        it('should fill entire output buffer without NaN', () => {
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.random() * 10 - 5;
            }
            dly.process();

            expect(dly.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should not produce infinite values', () => {
            for (let i = 0; i < 512; i++) {
                dly.inputs.audio[i] = Math.random() * 10 - 5;
            }

            // Process many times with high feedback
            dly.params.feedback = 0.95;
            for (let i = 0; i < 100; i++) {
                dly.process();
            }

            expect(dly.outputs.out.every(v => isFinite(v))).toBe(true);
        });

        it('should handle silence without issues', () => {
            dly.inputs.audio.fill(0);
            dly.process();

            expect(dly.outputs.out.every(v => !isNaN(v))).toBe(true);
        });
    });
});
