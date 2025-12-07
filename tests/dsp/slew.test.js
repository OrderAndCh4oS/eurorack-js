import { describe, it, expect, beforeEach } from 'vitest';
import slewModule from '../../src/js/modules/slew/index.js';

// Helper to create SLEW instance
const createSlewModule = (options = {}) => slewModule.createDSP(options);

/**
 * Slew Limiter Specification Compliance Tests
 *
 * Based on Doepfer A-170 (simplified):
 * - 2 independent channels
 * - Adjustable slew rate (0ms to 2000ms)
 * - CV control of slew rate
 * - One-pole RC filter implementation
 *
 * Source: https://doepfer.de/a170.htm
 */

describe('createSlewModule', () => {
    let slew;

    beforeEach(() => {
        slew = createSlewModule();
    });

    describe('initialization', () => {
        it('should create with default params', () => {
            expect(slew.params.rate1).toBeDefined();
            expect(slew.params.rate2).toBeDefined();
        });

        it('should create output buffers', () => {
            expect(slew.outputs.out1).toBeInstanceOf(Float32Array);
            expect(slew.outputs.out2).toBeInstanceOf(Float32Array);
            expect(slew.outputs.out1.length).toBe(512);
            expect(slew.outputs.out2.length).toBe(512);
        });

        it('should create input buffers', () => {
            expect(slew.inputs.in1).toBeInstanceOf(Float32Array);
            expect(slew.inputs.in2).toBeInstanceOf(Float32Array);
            expect(slew.inputs.cv1).toBeInstanceOf(Float32Array);
            expect(slew.inputs.cv2).toBeInstanceOf(Float32Array);
        });

        it('should have LED outputs', () => {
            expect(slew.leds.ch1).toBeDefined();
            expect(slew.leds.ch2).toBeDefined();
        });

        it('should accept custom options', () => {
            const custom = createSlewModule({ bufferSize: 256, sampleRate: 48000 });
            expect(custom.outputs.out1.length).toBe(256);
        });
    });

    describe('slew behavior - minimum rate (instant)', () => {
        it('should pass through instantly when rate=0', () => {
            slew.params.rate1 = 0;
            slew.inputs.in1.fill(5.0);
            slew.process();

            // Should immediately reach target
            expect(slew.outputs.out1[slew.outputs.out1.length - 1]).toBeCloseTo(5.0, 1);
        });

        it('should track input changes instantly when rate=0', () => {
            slew.params.rate1 = 0;

            // First half at 0V
            for (let i = 0; i < 256; i++) slew.inputs.in1[i] = 0;
            // Second half at 5V
            for (let i = 256; i < 512; i++) slew.inputs.in1[i] = 5;

            slew.process();

            // Should jump to 5V quickly after the step
            expect(slew.outputs.out1[511]).toBeCloseTo(5.0, 0);
        });
    });

    describe('slew behavior - maximum rate (slow)', () => {
        it('should smooth transitions when rate=1', () => {
            slew.params.rate1 = 1;  // Maximum slew (2000ms)

            // Start at 0, jump to 5V
            slew.inputs.in1.fill(5.0);
            slew.process();

            // With 2000ms slew at 44100Hz, should NOT reach target in one buffer
            const lastSample = slew.outputs.out1[511];
            expect(lastSample).toBeLessThan(5.0);
            expect(lastSample).toBeGreaterThan(0);
        });

        it('should gradually approach target over multiple buffers', () => {
            slew.params.rate1 = 0.1;  // 200ms slew
            slew.inputs.in1.fill(5.0);

            // Process multiple buffers
            let lastValue = 0;
            for (let i = 0; i < 50; i++) {
                slew.process();
                const currentValue = slew.outputs.out1[511];
                expect(currentValue).toBeGreaterThanOrEqual(lastValue - 0.001); // Allow tiny float variance
                lastValue = currentValue;
            }

            // Should be close to target after ~50 buffers (~580ms)
            expect(lastValue).toBeCloseTo(5.0, 0);
        });
    });

    describe('channel independence', () => {
        it('should process channels independently', () => {
            slew.params.rate1 = 0;    // Instant
            slew.params.rate2 = 1;    // Slow
            slew.inputs.in1.fill(5.0);
            slew.inputs.in2.fill(5.0);
            slew.process();

            // Channel 1 should reach target quickly
            expect(slew.outputs.out1[511]).toBeCloseTo(5.0, 0);
            // Channel 2 should still be transitioning
            expect(slew.outputs.out2[511]).toBeLessThan(5.0);
        });

        it('should have independent CV modulation', () => {
            slew.params.rate1 = 0.5;
            slew.params.rate2 = 0.5;
            slew.inputs.in1.fill(5.0);
            slew.inputs.in2.fill(5.0);
            slew.inputs.cv1.fill(5);   // Increase rate (slower)
            slew.inputs.cv2.fill(-5);  // Decrease rate (faster)
            slew.process();

            // Channel 2 should be closer to target (faster slew)
            expect(slew.outputs.out2[511]).toBeGreaterThan(slew.outputs.out1[511]);
        });
    });

    describe('CV rate modulation', () => {
        it('should increase slew time with positive CV', () => {
            slew.params.rate1 = 0.25;  // 500ms base
            slew.inputs.in1.fill(5.0);

            // Without CV
            slew.inputs.cv1.fill(0);
            slew.process();
            const withoutCV = slew.outputs.out1[511];
            slew.reset();

            // With positive CV (should be slower, less progress)
            slew.inputs.cv1.fill(5);
            slew.process();
            const withCV = slew.outputs.out1[511];

            expect(withCV).toBeLessThan(withoutCV);
        });

        it('should decrease slew time with negative CV', () => {
            slew.params.rate1 = 0.5;  // 1000ms base
            slew.inputs.in1.fill(5.0);

            // Without CV
            slew.inputs.cv1.fill(0);
            slew.process();
            const withoutCV = slew.outputs.out1[511];
            slew.reset();

            // With negative CV (should be faster, more progress)
            slew.inputs.cv1.fill(-5);
            slew.process();
            const withCV = slew.outputs.out1[511];

            expect(withCV).toBeGreaterThan(withoutCV);
        });

        it('should clamp rate to minimum (not go negative)', () => {
            slew.params.rate1 = 0;
            slew.inputs.cv1.fill(-10);  // Try to go negative
            slew.inputs.in1.fill(5.0);
            slew.process();

            // Should still work, not produce NaN
            expect(slew.outputs.out1.every(v => !isNaN(v))).toBe(true);
            expect(slew.outputs.out1[511]).toBeCloseTo(5.0, 0);
        });
    });

    describe('bipolar signal handling', () => {
        it('should handle positive signals', () => {
            slew.params.rate1 = 0.1;
            slew.inputs.in1.fill(5.0);
            slew.process();

            expect(slew.outputs.out1[511]).toBeGreaterThan(0);
        });

        it('should handle negative signals', () => {
            slew.params.rate1 = 0.1;
            slew.inputs.in1.fill(-5.0);
            slew.process();

            expect(slew.outputs.out1[511]).toBeLessThan(0);
        });

        it('should slew from positive to negative', () => {
            slew.params.rate1 = 0.3;

            // Start at +5V
            slew.inputs.in1.fill(5.0);
            slew.process();

            // Jump to -5V
            slew.inputs.in1.fill(-5.0);
            slew.process();

            // Should be transitioning through zero
            const last = slew.outputs.out1[511];
            expect(last).toBeLessThan(5.0);
            expect(last).toBeGreaterThan(-5.0);
        });
    });

    describe('portamento use case', () => {
        it('should create smooth pitch transitions', () => {
            slew.params.rate1 = 0.1;  // 200ms - typical portamento

            // Simulate stepping through notes
            const notes = [0, 1, 2, 3, 4];  // V/Oct values
            const outputs = [];

            for (const note of notes) {
                slew.inputs.in1.fill(note);
                slew.process();
                outputs.push(slew.outputs.out1[511]);
            }

            // Each step should be between previous and target
            for (let i = 1; i < outputs.length; i++) {
                expect(outputs[i]).toBeGreaterThan(outputs[i - 1]);
                expect(outputs[i]).toBeLessThanOrEqual(notes[i]);
            }
        });
    });

    describe('LED indicators', () => {
        it('should reflect output level', () => {
            slew.params.rate1 = 0;
            slew.inputs.in1.fill(5.0);
            slew.process();

            // LED should show high level
            expect(slew.leds.ch1).toBeGreaterThan(0.5);
        });

        it('should show zero for zero output', () => {
            slew.params.rate1 = 0;
            slew.inputs.in1.fill(0);
            slew.process();

            // LED should be at center (0.5 for bipolar display) or low
            expect(slew.leds.ch1).toBeLessThanOrEqual(0.5);
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            // Build up some state
            slew.inputs.in1.fill(5.0);
            slew.inputs.in2.fill(5.0);
            slew.process();

            slew.reset();

            expect(slew.outputs.out1[0]).toBe(0);
            expect(slew.outputs.out2[0]).toBe(0);
            expect(slew.leds.ch1).toBe(0);
            expect(slew.leds.ch2).toBe(0);
        });

        it('should reset internal slew state', () => {
            slew.params.rate1 = 0.5;
            slew.inputs.in1.fill(5.0);
            slew.process();

            slew.reset();

            // After reset, should start from 0 again
            slew.inputs.in1.fill(5.0);
            slew.process();
            // First sample should be close to 0, not 5
            expect(slew.outputs.out1[0]).toBeLessThan(1);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire buffers without NaN', () => {
            slew.inputs.in1.fill(3.0);
            slew.inputs.in2.fill(-2.0);
            slew.process();

            expect(slew.outputs.out1.every(v => !isNaN(v))).toBe(true);
            expect(slew.outputs.out2.every(v => !isNaN(v))).toBe(true);
        });

        it('should produce continuous output (no jumps between samples)', () => {
            slew.params.rate1 = 0.5;
            slew.inputs.in1.fill(5.0);
            slew.process();

            // Check no large jumps between consecutive samples
            for (let i = 1; i < 512; i++) {
                const diff = Math.abs(slew.outputs.out1[i] - slew.outputs.out1[i - 1]);
                expect(diff).toBeLessThan(0.5);  // Should be smooth
            }
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(slewModule.id).toBe('slew');
        });

        it('should have correct category', () => {
            expect(slewModule.category).toBe('utility');
        });

        it('should have UI definition', () => {
            expect(slewModule.ui).toBeDefined();
            expect(slewModule.ui.knobs.length).toBe(2);
            expect(slewModule.ui.inputs.length).toBe(4);
            expect(slewModule.ui.outputs.length).toBe(2);
        });
    });
});
