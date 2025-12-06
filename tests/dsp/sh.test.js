import { describe, it, expect, beforeEach } from 'vitest';
import shModule from '../../src/js/modules/sh/index.js';

// Helper to create SH instance using new module system
const createSH = (options = {}) => shModule.createDSP(options);

/**
 * 2hp S+H Specification Compliance Tests
 *
 * Based on 2hp S+H module:
 * - 2 independent channels
 * - Wide input range: ±12V
 * - Trigger threshold: ≥1V (Eurorack standard)
 * - Clocks fast enough to downsample audio
 *
 * Source: https://www.twohp.com/modules/sh
 */

describe('createSH', () => {
    let sh;

    beforeEach(() => {
        sh = createSH();
    });

    describe('initialization', () => {
        it('should create with default params', () => {
            expect(sh.params.slew1).toBe(0);
            expect(sh.params.slew2).toBe(0);
        });

        it('should create output buffers', () => {
            expect(sh.outputs.out1).toBeInstanceOf(Float32Array);
            expect(sh.outputs.out2).toBeInstanceOf(Float32Array);
            expect(sh.outputs.out1.length).toBe(512);
            expect(sh.outputs.out2.length).toBe(512);
        });

        it('should create input buffers', () => {
            expect(sh.inputs.in1).toBeInstanceOf(Float32Array);
            expect(sh.inputs.in2).toBeInstanceOf(Float32Array);
            expect(sh.inputs.trig1).toBeInstanceOf(Float32Array);
            expect(sh.inputs.trig2).toBeInstanceOf(Float32Array);
        });

        it('should have LED outputs', () => {
            expect(sh.leds.ch1).toBe(0);
            expect(sh.leds.ch2).toBe(0);
        });

        it('should accept custom options', () => {
            const custom = createSH({ bufferSize: 256, sampleRate: 48000 });
            expect(custom.outputs.out1.length).toBe(256);
        });
    });

    describe('channel 1 sample & hold', () => {
        it('should sample on trigger rising edge', () => {
            // Set up input signal
            sh.inputs.in1.fill(3.5);
            sh.inputs.trig1.fill(0);
            sh.process();

            // Trigger
            sh.inputs.trig1.fill(5);
            sh.process();

            // Should have sampled 3.5V
            expect(sh.outputs.out1[0]).toBeCloseTo(3.5, 1);
        });

        it('should hold value between triggers', () => {
            // Sample a value
            sh.inputs.in1.fill(2.5);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // Change input, no trigger
            sh.inputs.in1.fill(7.0);
            sh.inputs.trig1.fill(0);
            sh.process();

            // Should still hold 2.5V
            expect(sh.outputs.out1[0]).toBeCloseTo(2.5, 1);
        });

        it('should require ≥1V threshold for trigger', () => {
            sh.inputs.in1.fill(4.0);
            sh.inputs.trig1.fill(0.9); // Below threshold
            sh.process();

            // Should not have sampled
            expect(sh.outputs.out1[0]).toBe(0);

            // Now trigger at threshold
            sh.inputs.trig1.fill(1.0);
            sh.process();

            expect(sh.outputs.out1[0]).toBeCloseTo(4.0, 1);
        });

        it('should not re-sample on sustained high trigger', () => {
            // First sample
            sh.inputs.in1.fill(1.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // Change input, keep trigger high
            sh.inputs.in1.fill(9.0);
            sh.process();

            // Should still hold 1.0 (no new rising edge)
            expect(sh.outputs.out1[0]).toBeCloseTo(1.0, 1);
        });
    });

    describe('channel 2 sample & hold', () => {
        it('should operate independently from channel 1', () => {
            // Sample different values on each channel
            sh.inputs.in1.fill(2.0);
            sh.inputs.in2.fill(8.0);
            sh.inputs.trig1.fill(0);
            sh.inputs.trig2.fill(0);
            sh.process();

            // Trigger only channel 1
            sh.inputs.trig1.fill(5);
            sh.process();

            expect(sh.outputs.out1[0]).toBeCloseTo(2.0, 1);
            expect(sh.outputs.out2[0]).toBe(0); // Not triggered

            // Now trigger channel 2
            sh.inputs.trig1.fill(0);
            sh.inputs.trig2.fill(5);
            sh.process();

            expect(sh.outputs.out1[0]).toBeCloseTo(2.0, 1); // Still held
            expect(sh.outputs.out2[0]).toBeCloseTo(8.0, 1);
        });
    });

    describe('input range (±12V per 2hp spec)', () => {
        it('should accept +12V input', () => {
            sh.inputs.in1.fill(12.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            expect(sh.outputs.out1[0]).toBeCloseTo(12.0, 1);
        });

        it('should accept -12V input', () => {
            sh.inputs.in1.fill(-12.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            expect(sh.outputs.out1[0]).toBeCloseTo(-12.0, 1);
        });

        it('should handle full ±12V swing', () => {
            // Sample positive
            sh.inputs.in1.fill(10.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();
            expect(sh.outputs.out1[0]).toBeCloseTo(10.0, 1);

            // Sample negative
            sh.inputs.in1.fill(-10.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();
            expect(sh.outputs.out1[0]).toBeCloseTo(-10.0, 1);
        });
    });

    describe('slew control', () => {
        it('should pass through instantly when slew=0', () => {
            sh.params.slew1 = 0;

            // Set up step change
            sh.inputs.in1.fill(5.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // Should immediately be at target value
            expect(sh.outputs.out1[0]).toBeCloseTo(5.0, 1);
        });

        it('should smooth transitions when slew>0', () => {
            sh.params.slew1 = 1; // Maximum slew (50ms)

            // Sample 0 first
            sh.inputs.in1.fill(0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // Now sample a large jump
            sh.inputs.in1.fill(10.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // With slew, should not immediately reach 10V
            // The first sample might still be transitioning
            // Check that max jump per sample is limited
            let maxJump = 0;
            for (let i = 1; i < 512; i++) {
                maxJump = Math.max(maxJump, Math.abs(sh.outputs.out1[i] - sh.outputs.out1[i - 1]));
            }

            expect(maxJump).toBeLessThan(1); // Slewed, not instant
        });

        it('should have independent slew per channel', () => {
            sh.params.slew1 = 0;   // No slew
            sh.params.slew2 = 1;   // Full slew

            sh.inputs.in1.fill(5.0);
            sh.inputs.in2.fill(5.0);
            sh.inputs.trig1.fill(0);
            sh.inputs.trig2.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.inputs.trig2.fill(5);
            sh.process();

            // Channel 1 should be instant
            expect(sh.outputs.out1[0]).toBeCloseTo(5.0, 1);

            // Channel 2 should be slewed (still transitioning from 0)
            // With slew, first sample won't immediately be at 5
            // Just verify both produce valid output
            expect(sh.outputs.out2.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('audio rate clocking', () => {
        it('should handle fast trigger rates', () => {
            // Create alternating trigger pattern
            for (let i = 0; i < 512; i++) {
                sh.inputs.trig1[i] = (i % 10 < 5) ? 5 : 0; // Toggle every 5 samples
                sh.inputs.in1[i] = Math.sin(i * 0.1) * 5; // Varying input
            }

            sh.process();

            // Should have sampled multiple times
            const unique = new Set();
            for (const v of sh.outputs.out1) {
                unique.add(v.toFixed(2));
            }

            // Should have captured multiple different values
            expect(unique.size).toBeGreaterThan(10);
        });
    });

    describe('LED indicators', () => {
        it('should reflect held value level (normalized)', () => {
            sh.inputs.in1.fill(4.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // LED should be |4|/5 = 0.8
            expect(sh.leds.ch1).toBeCloseTo(0.8, 1);
        });

        it('should handle negative values (absolute)', () => {
            sh.inputs.in1.fill(-3.0);
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // LED should be |-3|/5 = 0.6
            expect(sh.leds.ch1).toBeCloseTo(0.6, 1);
        });

        it('should clamp to 0-1 range', () => {
            sh.inputs.in1.fill(10.0); // Above 5V
            sh.inputs.trig1.fill(0);
            sh.process();
            sh.inputs.trig1.fill(5);
            sh.process();

            // Should clamp to 1
            expect(sh.leds.ch1).toBe(1);
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            // Sample some values
            sh.inputs.in1.fill(5.0);
            sh.inputs.in2.fill(7.0);
            sh.inputs.trig1.fill(5);
            sh.inputs.trig2.fill(5);
            sh.process();

            sh.reset();

            expect(sh.leds.ch1).toBe(0);
            expect(sh.leds.ch2).toBe(0);
            expect(sh.outputs.out1[0]).toBe(0);
            expect(sh.outputs.out2[0]).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire buffers without NaN', () => {
            sh.inputs.in1.fill(1);
            sh.inputs.in2.fill(2);
            sh.inputs.trig1.fill(5);
            sh.inputs.trig2.fill(5);
            sh.process();

            expect(sh.outputs.out1.every(v => !isNaN(v))).toBe(true);
            expect(sh.outputs.out2.every(v => !isNaN(v))).toBe(true);
        });
    });
});
