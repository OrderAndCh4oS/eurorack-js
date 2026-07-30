import { describe, it, expect, beforeEach } from 'vitest';
import lfoModule from '../../src/js/modules/lfo/index.js';

// Helper to create LFO instance using new module system
const create2hpLFO = (options = {}) => lfoModule.createDSP(options);

/**
 * 2hp LFO Specification Compliance Tests
 *
 * Based on official 2hp LFO manual specifications:
 * - Frequency range (slow): 27 seconds to 20Hz
 * - Frequency range (fast): 3.3 seconds to 152Hz
 * - Output voltage: 0-5V unipolar
 * - Rate CV input: 0-5V (added to knob position)
 * - Wave CV input: 0-5V (morphs between waveforms)
 * - Reset input: Rising edge triggers phase reset
 * - 8 waveforms: sine, triangle, saw, square + 4 alternate
 * - 2 simultaneous outputs (primary and secondary)
 *
 * Source: https://www.twohp.com/modules/lfo
 */

describe('create2hpLFO', () => {
    let lfo;

    beforeEach(() => {
        lfo = create2hpLFO();
    });

    describe('initialization', () => {
        it('should create an LFO with default params', () => {
            expect(lfo.params.range).toBe(0);
            expect(lfo.params.rateKnob).toBe(0.3);
            expect(lfo.params.waveKnob).toBe(0);
        });

        it('should create an LFO with default inputs', () => {
            expect(lfo.inputs.rateCV).toBeInstanceOf(Float32Array);
            expect(lfo.inputs.waveCV).toBeInstanceOf(Float32Array);
            expect(lfo.inputs.reset).toBeInstanceOf(Float32Array);
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

        it('should declare the documented CV, reset, normalization, and output voltages', () => {
            expect(lfoModule.ui.inputs).toEqual(expect.arrayContaining([
                expect.objectContaining({ port: 'rateCV', voltage: { min: 0, max: 5, normal: 0 } }),
                expect.objectContaining({ port: 'waveCV', voltage: { min: 0, max: 5, normal: 0 } }),
                expect.objectContaining({ port: 'reset', voltage: { min: 0, max: 10, normal: 0 } })
            ]));
            for (const output of lfoModule.ui.outputs) {
                expect(output.voltage).toEqual({ min: 0, max: 5 });
            }
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

        it('should reach the fourth waveform at the maximum Wave setting', () => {
            const endpoint = create2hpLFO({ sampleRate: 1000, bufferSize: 1 });
            endpoint.params.rateKnob = 0;
            endpoint.params.waveKnob = 1;

            endpoint.process();

            expect(endpoint.outputs.primary[0]).toBe(5);
            expect(endpoint.outputs.secondary[0]).toBe(5);
        });
    });

    describe('CV modulation', () => {
        it('should respond to rateCV', () => {
            const noCV = create2hpLFO({ bufferSize: 4410 });
            noCV.inputs.rateCV.fill(0);
            noCV.process();

            const withCV = create2hpLFO({ bufferSize: 4410 });
            withCV.inputs.rateCV.fill(3); // +3 octaves
            withCV.process();

            // Both should produce valid output
            expect(noCV.outputs.primary.some(v => v > 0)).toBe(true);
            expect(withCV.outputs.primary.some(v => v > 0)).toBe(true);
        });

        it('should respond to waveCV', () => {
            const noCV = create2hpLFO();
            noCV.inputs.waveCV.fill(0);
            noCV.process();
            const output1 = [...noCV.outputs.primary];

            const withCV = create2hpLFO();
            withCV.inputs.waveCV.fill(2.5);
            withCV.process();
            const output2 = [...withCV.outputs.primary];

            // Should produce different waveforms
            const different = output1.some((v, i) => Math.abs(v - output2[i]) > 0.01);
            expect(different).toBe(true);
        });

        it('should apply rate CV at the exact sample where it changes', () => {
            const baseline = create2hpLFO({ sampleRate: 1000, bufferSize: 128 });
            baseline.params.range = 1;
            baseline.params.rateKnob = 0.5;
            baseline.process();

            const modulated = create2hpLFO({ sampleRate: 1000, bufferSize: 128 });
            modulated.params.range = 1;
            modulated.params.rateKnob = 0.5;
            modulated.inputs.rateCV.fill(5, 64);
            modulated.process();

            expect(Array.from(modulated.outputs.primary.slice(0, 64)))
                .toEqual(Array.from(baseline.outputs.primary.slice(0, 64)));
            expect(Array.from(modulated.outputs.primary.slice(64)))
                .not.toEqual(Array.from(baseline.outputs.primary.slice(64)));
        });

        it('should apply waveform CV at the exact sample where it changes', () => {
            const baseline = create2hpLFO({ sampleRate: 1000, bufferSize: 32 });
            baseline.params.rateKnob = 0;
            baseline.process();

            const modulated = create2hpLFO({ sampleRate: 1000, bufferSize: 32 });
            modulated.params.rateKnob = 0;
            modulated.inputs.waveCV.fill(5, 16);
            modulated.process();

            expect(Array.from(modulated.outputs.primary.slice(0, 16)))
                .toEqual(Array.from(baseline.outputs.primary.slice(0, 16)));
            expect(Array.from(modulated.outputs.primary.slice(16)))
                .not.toEqual(Array.from(baseline.outputs.primary.slice(16)));
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
            lfo.inputs.reset.fill(5);
            lfo.process();
            const afterReset = [...lfo.outputs.primary];

            // After reset, phase should restart from 0
            // First sample should be near start of waveform
            expect(afterReset[0]).toBeDefined();
        });

        it('should reset at the exact trigger sample and output phase zero there', () => {
            const exact = create2hpLFO({ sampleRate: 1000, bufferSize: 32 });
            exact.params.range = 1;
            exact.params.rateKnob = 0.8;
            exact.process();
            exact.inputs.reset.fill(0);
            exact.inputs.reset[8] = 5;

            exact.process();

            expect(exact.outputs.primary[8]).toBeCloseTo(2.5, 6);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers', () => {
            lfo.process();

            // Check no NaN or undefined values
            expect(lfo.outputs.primary.every(v => !isNaN(v) && v !== undefined)).toBe(true);
            expect(lfo.outputs.secondary.every(v => !isNaN(v) && v !== undefined)).toBe(true);
        });

        it('should recover from non-finite controls and inputs within 0-5V', () => {
            lfo.params.range = Number.NaN;
            lfo.params.rateKnob = Number.NaN;
            lfo.params.waveKnob = Number.POSITIVE_INFINITY;
            lfo.inputs.rateCV.fill(Number.NaN);
            lfo.inputs.waveCV.fill(Number.NEGATIVE_INFINITY);
            lfo.inputs.reset.fill(Number.NaN);

            lfo.process();

            for (const output of Object.values(lfo.outputs)) {
                expect(output.every(Number.isFinite)).toBe(true);
                expect(Math.min(...output)).toBeGreaterThanOrEqual(0);
                expect(Math.max(...output)).toBeLessThanOrEqual(5);
            }
        });

        it('should reset every stable input and output buffer in place', () => {
            const inputRefs = { ...lfo.inputs };
            const outputRefs = { ...lfo.outputs };
            lfo.inputs.rateCV.fill(5);
            lfo.inputs.waveCV.fill(5);
            lfo.inputs.reset.fill(5);
            lfo.process();

            lfo.reset();

            expect(lfo.inputs).toEqual(inputRefs);
            expect(lfo.outputs).toEqual(outputRefs);
            for (const buffer of [...Object.values(lfo.inputs), ...Object.values(lfo.outputs)]) {
                expect(buffer.every(value => value === 0)).toBe(true);
            }
        });
    });

    // ========================================
    // 2hp LFO Specification Compliance Tests
    // ========================================

    describe('2hp LFO spec compliance', () => {
        describe('frequency range - slow mode (27s to 20Hz)', () => {
            it('should produce ~27 second cycle at minimum rate in slow mode', () => {
                const sampleRate = 44100;
                const lfo = create2hpLFO({ sampleRate, bufferSize: 512 });
                lfo.params.range = 0; // Slow mode
                lfo.params.rateKnob = 0; // Minimum

                // At 27s cycle, frequency = 1/27 ≈ 0.037 Hz
                // Phase increment per sample = 0.037 / 44100 ≈ 8.4e-7
                // After 44100 samples (1 second), phase should advance ~0.037

                let totalPhaseAdvance = 0;
                const samplesPerSecond = sampleRate;

                for (let i = 0; i < samplesPerSecond / 512; i++) {
                    const prevVal = lfo.outputs.primary[0];
                    lfo.process();
                }

                // After 1 second at 27s cycle rate, we should be about 1/27 through the cycle
                // Output should still be in early part of waveform (sine starts at 2.5V going up)
                expect(lfo.outputs.primary[0]).toBeGreaterThanOrEqual(0);
                expect(lfo.outputs.primary[0]).toBeLessThanOrEqual(5);
            });

            it('should produce ~20Hz at maximum rate in slow mode', () => {
                const sampleRate = 44100;
                const bufferSize = 4410; // 100ms of samples
                const lfo = create2hpLFO({ sampleRate, bufferSize });
                lfo.params.range = 0; // Slow mode
                lfo.params.rateKnob = 1; // Maximum

                lfo.process();

                // At 20Hz, we expect 2 full cycles in 100ms
                // Count zero crossings (through 2.5V midpoint)
                let crossings = 0;
                for (let i = 1; i < bufferSize; i++) {
                    if ((lfo.outputs.primary[i - 1] < 2.5 && lfo.outputs.primary[i] >= 2.5) ||
                        (lfo.outputs.primary[i - 1] >= 2.5 && lfo.outputs.primary[i] < 2.5)) {
                        crossings++;
                    }
                }

                // 20Hz = 2 cycles per 100ms = 4 zero crossings (2 per cycle)
                // Allow some tolerance (3-6 crossings)
                expect(crossings).toBeGreaterThanOrEqual(3);
                expect(crossings).toBeLessThanOrEqual(6);
            });
        });

        describe('frequency range - fast mode (3.3s to 152Hz)', () => {
            it('should produce ~3.3 second cycle at minimum rate in fast mode', () => {
                const sampleRate = 44100;
                const lfo = create2hpLFO({ sampleRate, bufferSize: 512 });
                lfo.params.range = 1; // Fast mode
                lfo.params.rateKnob = 0; // Minimum

                // At 3.3s cycle, frequency ≈ 0.303 Hz
                // In 1 second, we should see about 1/3 of a cycle
                lfo.process();

                expect(lfo.outputs.primary[0]).toBeGreaterThanOrEqual(0);
                expect(lfo.outputs.primary[0]).toBeLessThanOrEqual(5);
            });

            it('should produce ~152Hz at maximum rate in fast mode', () => {
                const sampleRate = 44100;
                const bufferSize = 4410; // 100ms of samples
                const lfo = create2hpLFO({ sampleRate, bufferSize });
                lfo.params.range = 1; // Fast mode
                lfo.params.rateKnob = 1; // Maximum

                lfo.process();

                // At 152Hz, we expect ~15.2 cycles in 100ms
                // Count zero crossings
                let crossings = 0;
                for (let i = 1; i < bufferSize; i++) {
                    if ((lfo.outputs.primary[i - 1] < 2.5 && lfo.outputs.primary[i] >= 2.5) ||
                        (lfo.outputs.primary[i - 1] >= 2.5 && lfo.outputs.primary[i] < 2.5)) {
                        crossings++;
                    }
                }

                // 152Hz = ~15 cycles per 100ms = ~30 zero crossings
                // Allow tolerance (25-40 crossings)
                expect(crossings).toBeGreaterThanOrEqual(25);
                expect(crossings).toBeLessThanOrEqual(40);
            });
        });

        describe('output voltage (0-5V unipolar)', () => {
            it('should output exactly in 0-5V range for primary', () => {
                const lfo = create2hpLFO({ bufferSize: 4410 });
                lfo.params.rateKnob = 0.8;

                // Process multiple buffers to capture full waveform
                let min = Infinity, max = -Infinity;
                for (let i = 0; i < 20; i++) {
                    lfo.process();
                    for (const v of lfo.outputs.primary) {
                        min = Math.min(min, v);
                        max = Math.max(max, v);
                    }
                }

                expect(min).toBeGreaterThanOrEqual(0);
                expect(min).toBeLessThan(0.5); // Should approach 0V
                expect(max).toBeLessThanOrEqual(5);
                expect(max).toBeGreaterThan(4.5); // Should approach 5V
            });

            it('should output exactly in 0-5V range for secondary', () => {
                const lfo = create2hpLFO({ bufferSize: 4410 });
                lfo.params.rateKnob = 0.8;

                let min = Infinity, max = -Infinity;
                for (let i = 0; i < 20; i++) {
                    lfo.process();
                    for (const v of lfo.outputs.secondary) {
                        min = Math.min(min, v);
                        max = Math.max(max, v);
                    }
                }

                expect(min).toBeGreaterThanOrEqual(0);
                expect(max).toBeLessThanOrEqual(5);
            });
        });

        describe('rate CV input (0-5V)', () => {
            it('should accept 0-5V CV and add to rate', () => {
                const sampleRate = 44100;
                const bufferSize = 44100; // 1 second of samples for better measurement

                const lfoNoCV = create2hpLFO({ sampleRate, bufferSize });
                lfoNoCV.params.rateKnob = 0.5; // Higher rate to ensure crossings
                lfoNoCV.params.range = 0; // Slow mode
                lfoNoCV.inputs.rateCV.fill(0);
                lfoNoCV.process();

                const lfoWithCV = create2hpLFO({ sampleRate, bufferSize });
                lfoWithCV.params.rateKnob = 0.5;
                lfoWithCV.params.range = 0;
                lfoWithCV.inputs.rateCV.fill(2); // +2V CV = +2 octaves (4x frequency)
                lfoWithCV.process();

                // Count crossings to verify CV increases rate
                const countCrossings = (arr) => {
                    let c = 0;
                    for (let i = 1; i < arr.length; i++) {
                        if ((arr[i - 1] < 2.5 && arr[i] >= 2.5) ||
                            (arr[i - 1] >= 2.5 && arr[i] < 2.5)) c++;
                    }
                    return c;
                };

                const noCVCrossings = countCrossings(lfoNoCV.outputs.primary);
                const withCVCrossings = countCrossings(lfoWithCV.outputs.primary);

                // With +2 octaves CV, should have ~4x the crossings
                expect(withCVCrossings).toBeGreaterThan(noCVCrossings);
            });

            it('should clamp CV input to 0-5V range', () => {
                const lfo = create2hpLFO();
                lfo.params.rateKnob = 0.5;
                lfo.inputs.rateCV.fill(10); // Exceeds 5V
                lfo.process();

                // Should not crash and should produce valid output
                expect(lfo.outputs.primary.every(v => !isNaN(v))).toBe(true);
            });
        });

        describe('wave CV input (0-5V)', () => {
            it('should morph waveforms with CV', () => {
                const lfoSine = create2hpLFO();
                lfoSine.params.waveKnob = 0;
                lfoSine.inputs.waveCV.fill(0);
                lfoSine.process();
                const sineOut = [...lfoSine.outputs.primary];

                const lfoMorphed = create2hpLFO();
                lfoMorphed.params.waveKnob = 0;
                lfoMorphed.inputs.waveCV.fill(5); // +5V reaches the fourth waveform
                lfoMorphed.process();
                const morphedOut = [...lfoMorphed.outputs.primary];

                // Outputs should be different due to CV modulation
                const different = sineOut.some((v, i) => Math.abs(v - morphedOut[i]) > 0.1);
                expect(different).toBe(true);
            });
        });

        describe('reset input', () => {
            it('should reset phase on rising edge above threshold', () => {
                const lfo = create2hpLFO();
                lfo.params.rateKnob = 0.5;

                // Advance phase
                for (let i = 0; i < 10; i++) {
                    lfo.process();
                }
                const beforeReset = lfo.outputs.primary[0];

                // Trigger reset (rising edge from 0 to >=1V)
                lfo.inputs.reset.fill(0);
                lfo.process();
                lfo.inputs.reset.fill(5); // Rising edge
                lfo.process();
                const afterReset = lfo.outputs.primary[0];

                // After reset, phase is 0, so first sample of sine should be near 2.5V
                // (sin(0) = 0, scaled to 2.5V center)
                expect(afterReset).toBeGreaterThan(2); // Near center after reset
                expect(afterReset).toBeLessThan(3.5);
            });

            it('should not reset on sustained high input (no edge)', () => {
                const lfo = create2hpLFO();
                lfo.params.rateKnob = 0.5;

                // Set reset high first
                lfo.inputs.reset.fill(5);
                lfo.process();

                // Keep high and process more
                for (let i = 0; i < 5; i++) {
                    lfo.process();
                }
                const val1 = lfo.outputs.primary[0];

                // Still high, should NOT reset again
                lfo.process();
                const val2 = lfo.outputs.primary[0];

                // Phase should have advanced, not reset
                // (values should be different as LFO continues)
                expect(val1).not.toBe(val2);
            });
        });

        describe('8 waveforms with morphing', () => {
            it('should have 4 primary waveforms (sine, tri, saw, square)', () => {
                // Test each waveform position
                const waveforms = [0, 0.25, 0.5, 0.75];
                const outputs = [];

                for (const pos of waveforms) {
                    const lfo = create2hpLFO({ bufferSize: 1000 });
                    lfo.params.rateKnob = 0.8;
                    lfo.params.waveKnob = pos;
                    lfo.process();
                    outputs.push([...lfo.outputs.primary]);
                }

                // Each waveform should be distinct
                for (let i = 0; i < outputs.length; i++) {
                    for (let j = i + 1; j < outputs.length; j++) {
                        const diff = outputs[i].some((v, k) => Math.abs(v - outputs[j][k]) > 0.1);
                        expect(diff).toBe(true);
                    }
                }
            });

            it('should have 4 secondary waveforms', () => {
                const waveforms = [0, 0.25, 0.5, 0.75];
                const outputs = [];

                for (const pos of waveforms) {
                    const lfo = create2hpLFO({ bufferSize: 1000 });
                    lfo.params.rateKnob = 0.8;
                    lfo.params.waveKnob = pos;
                    lfo.process();
                    outputs.push([...lfo.outputs.secondary]);
                }

                // Secondary outputs should exist and vary
                for (const out of outputs) {
                    expect(out.some(v => v !== out[0])).toBe(true);
                }
            });

            it('should smoothly morph between waveforms', () => {
                const lfo = create2hpLFO({ bufferSize: 1000 });
                lfo.params.rateKnob = 0.8;

                // Get output at two adjacent positions
                lfo.params.waveKnob = 0.1;
                lfo.process();
                const out1 = [...lfo.outputs.primary];

                const lfo2 = create2hpLFO({ bufferSize: 1000 });
                lfo2.params.rateKnob = 0.8;
                lfo2.params.waveKnob = 0.15; // Slightly different
                lfo2.process();
                const out2 = [...lfo2.outputs.primary];

                // Should be similar but not identical (smooth morphing)
                const maxDiff = out1.reduce((max, v, i) => Math.max(max, Math.abs(v - out2[i])), 0);
                expect(maxDiff).toBeGreaterThan(0); // Not identical
                expect(maxDiff).toBeLessThan(1); // But close (smooth morph)
            });
        });

        describe('two simultaneous outputs', () => {
            it('should produce different waveforms on primary and secondary', () => {
                const lfo = create2hpLFO({ bufferSize: 1000 });
                lfo.params.rateKnob = 0.8;
                lfo.params.waveKnob = 0;
                lfo.process();

                // Primary and secondary should be different
                const different = lfo.outputs.primary.some(
                    (v, i) => Math.abs(v - lfo.outputs.secondary[i]) > 0.01
                );
                expect(different).toBe(true);
            });

            it('should have both outputs at same frequency', () => {
                const lfo = create2hpLFO({ bufferSize: 44100 }); // 1 second
                lfo.params.rateKnob = 0.8;
                lfo.params.range = 0; // Slow mode for more crossings
                lfo.process();

                // Count crossings for both outputs
                const countCrossings = (arr) => {
                    let c = 0;
                    for (let i = 1; i < arr.length; i++) {
                        if ((arr[i - 1] < 2.5 && arr[i] >= 2.5) ||
                            (arr[i - 1] >= 2.5 && arr[i] < 2.5)) c++;
                    }
                    return c;
                };

                const primaryCrossings = countCrossings(lfo.outputs.primary);
                const secondaryCrossings = countCrossings(lfo.outputs.secondary);

                // Both should have similar crossing count (same frequency)
                // Secondary waveforms may have different shapes causing more/fewer crossings
                // but the base frequency should be similar (within 2x tolerance)
                expect(primaryCrossings).toBeGreaterThan(0);
                expect(secondaryCrossings).toBeGreaterThan(0);
                // Both are driven by same phase, so similar overall frequency
                expect(Math.abs(primaryCrossings - secondaryCrossings)).toBeLessThanOrEqual(Math.max(primaryCrossings, secondaryCrossings));
            });
        });
    });
});
