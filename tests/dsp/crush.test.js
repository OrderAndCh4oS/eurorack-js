/**
 * CRUSH (Bitcrusher) Module Tests
 *
 * Tests for bitcrusher effect with bit depth and sample rate reduction.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crushModule from '../../src/js/modules/crush/index.js';

describe('CRUSH Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = crushModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.inL.length).toBe(bufferSize);
            expect(dsp.inputs.inR.length).toBe(bufferSize);
            expect(dsp.outputs.outL.length).toBe(bufferSize);
            expect(dsp.outputs.outR.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.bits).toBeDefined();
            expect(dsp.params.rate).toBeDefined();
            expect(dsp.params.mix).toBeDefined();
        });

        it('should have LED indicator', () => {
            expect(dsp.leds).toHaveProperty('active');
        });
    });

    describe('Dry Signal Pass-through', () => {
        it('should pass dry signal with mix at 0', () => {
            dsp.params.mix = 0;

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.outL[i]).toBeCloseTo(dsp.inputs.inL[i], 5);
            }
        });
    });

    describe('Bit Depth Reduction', () => {
        it('should quantize signal with low bit depth', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 0.1;  // Very low bits
            dsp.params.rate = 0;    // No sample rate reduction

            // Feed smooth ramp
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = (i / bufferSize) * 4 - 2;  // -2 to 2
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Count unique output values - should be limited
            const uniqueValues = new Set(dsp.outputs.outL);
            // With very low bits, should have much fewer unique values than input
            expect(uniqueValues.size).toBeLessThan(bufferSize / 2);
        });

        it('should pass cleaner signal with high bit depth', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 1;   // Full bits
            dsp.params.rate = 0;

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Output should closely match input with high bits
            let totalError = 0;
            for (let i = 0; i < bufferSize; i++) {
                totalError += Math.abs(dsp.outputs.outL[i] - dsp.inputs.inL[i]);
            }
            expect(totalError / bufferSize).toBeLessThan(0.1);
        });
    });

    describe('Sample Rate Reduction', () => {
        it('should create stair-step effect with high rate reduction', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 1;   // Full bits
            dsp.params.rate = 1;   // Maximum rate reduction

            // Feed smooth sine
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Count consecutive same values (indicates sample holding)
            let sameCount = 0;
            for (let i = 1; i < bufferSize; i++) {
                if (dsp.outputs.outL[i] === dsp.outputs.outL[i - 1]) {
                    sameCount++;
                }
            }
            // With rate reduction, should have many consecutive same values
            expect(sameCount).toBeGreaterThan(bufferSize / 4);
        });

        it('should not hold samples with no rate reduction', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 1;
            dsp.params.rate = 0;  // No reduction

            // Feed varying signal
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Most samples should differ
            let sameCount = 0;
            for (let i = 1; i < bufferSize; i++) {
                if (Math.abs(dsp.outputs.outL[i] - dsp.outputs.outL[i - 1]) < 0.0001) {
                    sameCount++;
                }
            }
            expect(sameCount).toBeLessThan(bufferSize / 2);
        });
    });

    describe('Combined Effect', () => {
        it('should apply both bit and rate reduction', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 0.3;
            dsp.params.rate = 0.5;

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Should have aliasing artifacts (different from clean sine)
            let totalDiff = 0;
            for (let i = 0; i < bufferSize; i++) {
                totalDiff += Math.abs(dsp.outputs.outL[i] - dsp.inputs.inL[i]);
            }
            expect(totalDiff).toBeGreaterThan(1);
        });
    });

    describe('Output Range', () => {
        it('should stay within audio range', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 0.2;
            dsp.params.rate = 0.5;

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.outL[i]).toBeGreaterThanOrEqual(-10);
                expect(dsp.outputs.outL[i]).toBeLessThanOrEqual(10);
            }
        });
    });

    describe('Stereo Processing', () => {
        it('should process L and R independently', () => {
            dsp.params.mix = 1;
            dsp.params.bits = 0.5;
            dsp.params.rate = 0.3;

            // Feed different signals to L and R
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = Math.sin(2 * Math.PI * 880 * i / sampleRate) * 2;
            }
            dsp.process();

            // Outputs should differ
            let hasDiff = false;
            for (let i = 0; i < bufferSize; i++) {
                if (Math.abs(dsp.outputs.outL[i] - dsp.outputs.outR[i]) > 0.01) {
                    hasDiff = true;
                    break;
                }
            }
            expect(hasDiff).toBe(true);
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.mix = 0.5;
            dsp.params.bits = 0.3;
            dsp.params.rate = 0.5;

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            expect(dsp.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.process();
            expect(dsp.outputs.outL.length).toBe(bufferSize);
            expect(dsp.outputs.outR.length).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should reset sample hold state', () => {
            dsp.params.rate = 1;

            // Process some signal
            dsp.inputs.inL.fill(2);
            dsp.inputs.inR.fill(2);
            dsp.process();

            dsp.reset();

            // After reset, held sample should be cleared
            dsp.inputs.inL.fill(0);
            dsp.inputs.inR.fill(0);
            dsp.params.mix = 1;
            dsp.process();

            expect(dsp.outputs.outL[0]).toBe(0);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(crushModule.id).toBe('crush');
        });

        it('should have UI definition', () => {
            expect(crushModule.ui).toBeDefined();
            expect(crushModule.ui.knobs).toBeDefined();
        });
    });
});
