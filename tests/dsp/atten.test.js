import { describe, it, expect, beforeEach } from 'vitest';
import attenModule from '../../src/js/modules/atten/index.js';

// Helper to create ATTEN instance using new module system
const createAtten = (options = {}) => attenModule.createDSP(options);

/**
 * Attenuverter Specification Compliance Tests
 *
 * Based on Mutable Instruments Shades:
 * - Attenuverter: gain from -1 (inverted) through 0 (muted) to +1 (unity)
 * - Offset: add DC voltage to output
 * - Unpatched inputs normalize to +5V reference
 * - LED indicators show signal level
 *
 * Source: https://pichenettes.github.io/mutable-instruments-documentation/modules/shades_2020/manual/
 */

describe('createAtten', () => {
    let atten;

    beforeEach(() => {
        atten = createAtten();
    });

    describe('initialization', () => {
        it('should create with default params', () => {
            // Attenuverter defaults to center (0.5 = unity gain)
            expect(atten.params.atten1).toBe(1);
            expect(atten.params.atten2).toBe(1);
            // Offset defaults to center (0.5 = 0V offset)
            expect(atten.params.offset1).toBe(0.5);
            expect(atten.params.offset2).toBe(0.5);
        });

        it('should create output buffers', () => {
            expect(atten.outputs.out1).toBeInstanceOf(Float32Array);
            expect(atten.outputs.out2).toBeInstanceOf(Float32Array);
            expect(atten.outputs.out1.length).toBe(512);
            expect(atten.outputs.out2.length).toBe(512);
        });

        it('should create input buffers', () => {
            expect(atten.inputs.in1).toBeInstanceOf(Float32Array);
            expect(atten.inputs.in2).toBeInstanceOf(Float32Array);
        });

        it('should have LED outputs', () => {
            expect(atten.leds.ch1).toBeDefined();
            expect(atten.leds.ch2).toBeDefined();
        });

        it('should accept custom options', () => {
            const custom = createAtten({ bufferSize: 256, sampleRate: 48000 });
            expect(custom.outputs.out1.length).toBe(256);
        });
    });

    describe('attenuverter gain', () => {
        it('should pass signal at unity when atten=1 (full CW)', () => {
            atten.params.atten1 = 1;     // Full CW = +1 gain
            atten.params.offset1 = 0.5;  // No offset
            atten.inputs.in1.fill(5.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(5.0, 1);
        });

        it('should mute signal when atten=0.5 (center)', () => {
            atten.params.atten1 = 0.5;   // Center = 0 gain
            atten.params.offset1 = 0.5;  // No offset
            atten.inputs.in1.fill(5.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(0, 1);
        });

        it('should invert signal when atten=0 (full CCW)', () => {
            atten.params.atten1 = 0;     // Full CCW = -1 gain
            atten.params.offset1 = 0.5;  // No offset
            atten.inputs.in1.fill(5.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(-5.0, 1);
        });

        it('should attenuate signal at intermediate values', () => {
            atten.params.atten1 = 0.75;  // 0.75 = +0.5 gain
            atten.params.offset1 = 0.5;
            atten.inputs.in1.fill(4.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(2.0, 1);
        });

        it('should attenuate and invert at intermediate values', () => {
            atten.params.atten1 = 0.25;  // 0.25 = -0.5 gain
            atten.params.offset1 = 0.5;
            atten.inputs.in1.fill(4.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(-2.0, 1);
        });
    });

    describe('offset', () => {
        it('should add +5V offset when offset=1 (full CW)', () => {
            atten.params.atten1 = 0.5;   // Muted input
            atten.params.offset1 = 1;    // +5V offset
            atten.inputs.in1.fill(0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(5.0, 1);
        });

        it('should add -5V offset when offset=0 (full CCW)', () => {
            atten.params.atten1 = 0.5;   // Muted input
            atten.params.offset1 = 0;    // -5V offset
            atten.inputs.in1.fill(0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(-5.0, 1);
        });

        it('should add no offset when offset=0.5 (center)', () => {
            atten.params.atten1 = 1;     // Unity gain
            atten.params.offset1 = 0.5;  // No offset
            atten.inputs.in1.fill(3.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(3.0, 1);
        });

        it('should combine gain and offset', () => {
            atten.params.atten1 = 0.75;  // +0.5 gain
            atten.params.offset1 = 0.75; // +2.5V offset
            atten.inputs.in1.fill(4.0);  // 4V input
            atten.process();

            // 4V * 0.5 + 2.5V = 4.5V
            expect(atten.outputs.out1[0]).toBeCloseTo(4.5, 1);
        });
    });

    describe('channel independence', () => {
        it('should process channels independently', () => {
            atten.params.atten1 = 1;     // Unity
            atten.params.atten2 = 0;     // Inverted
            atten.params.offset1 = 0.5;  // No offset
            atten.params.offset2 = 0.5;  // No offset
            atten.inputs.in1.fill(3.0);
            atten.inputs.in2.fill(3.0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(3.0, 1);
            expect(atten.outputs.out2[0]).toBeCloseTo(-3.0, 1);
        });

        it('should have independent offsets per channel', () => {
            atten.params.atten1 = 0.5;   // Muted
            atten.params.atten2 = 0.5;   // Muted
            atten.params.offset1 = 1;    // +5V
            atten.params.offset2 = 0;    // -5V
            atten.inputs.in1.fill(0);
            atten.inputs.in2.fill(0);
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(5.0, 1);
            expect(atten.outputs.out2[0]).toBeCloseTo(-5.0, 1);
        });
    });

    describe('bipolar to unipolar conversion', () => {
        it('should convert ±5V to 0-5V range', () => {
            // Attenuate to 50% and add 2.5V offset
            atten.params.atten1 = 0.75;  // +0.5 gain
            atten.params.offset1 = 0.75; // +2.5V offset

            // Test with +5V input
            atten.inputs.in1.fill(5.0);
            atten.process();
            expect(atten.outputs.out1[0]).toBeCloseTo(5.0, 1); // 5*0.5 + 2.5 = 5

            // Test with -5V input
            atten.inputs.in1.fill(-5.0);
            atten.process();
            expect(atten.outputs.out1[0]).toBeCloseTo(0, 1); // -5*0.5 + 2.5 = 0
        });
    });

    describe('output clamping', () => {
        it('should clamp output to ±10V', () => {
            atten.params.atten1 = 1;     // Unity
            atten.params.offset1 = 1;    // +5V offset
            atten.inputs.in1.fill(10.0); // Would be 15V without clamp
            atten.process();

            expect(atten.outputs.out1[0]).toBe(10);
        });

        it('should clamp negative output to -10V', () => {
            atten.params.atten1 = 1;     // Unity
            atten.params.offset1 = 0;    // -5V offset
            atten.inputs.in1.fill(-10.0); // Would be -15V without clamp
            atten.process();

            expect(atten.outputs.out1[0]).toBe(-10);
        });
    });

    describe('DC voltage generation (unpatched input)', () => {
        it('should output offset voltage when input is zero', () => {
            atten.params.atten1 = 1;     // Unity (doesn't matter with 0 input)
            atten.params.offset1 = 0.8;  // +3V offset
            atten.inputs.in1.fill(0);    // Unpatched = 0
            atten.process();

            expect(atten.outputs.out1[0]).toBeCloseTo(3.0, 1);
        });

        it('should generate full ±5V range from offset alone', () => {
            atten.params.atten1 = 0.5;   // Muted input
            atten.inputs.in1.fill(0);

            // Test +5V
            atten.params.offset1 = 1;
            atten.process();
            expect(atten.outputs.out1[0]).toBeCloseTo(5.0, 1);

            // Test -5V
            atten.params.offset1 = 0;
            atten.process();
            expect(atten.outputs.out1[0]).toBeCloseTo(-5.0, 1);

            // Test 0V
            atten.params.offset1 = 0.5;
            atten.process();
            expect(atten.outputs.out1[0]).toBeCloseTo(0, 1);
        });
    });

    describe('LED indicators', () => {
        it('should show positive signal level', () => {
            atten.params.atten1 = 1;
            atten.params.offset1 = 0.5;
            atten.inputs.in1.fill(5.0);
            atten.process();

            // LED maps -5V to +5V onto 0 to 1
            // +5V should be 1.0
            expect(atten.leds.ch1).toBeCloseTo(1.0, 1);
        });

        it('should show negative signal level', () => {
            atten.params.atten1 = 1;
            atten.params.offset1 = 0.5;
            atten.inputs.in1.fill(-5.0);
            atten.process();

            // -5V should be 0.0
            expect(atten.leds.ch1).toBeCloseTo(0, 1);
        });

        it('should show center for zero signal', () => {
            atten.params.atten1 = 0.5;   // Muted
            atten.params.offset1 = 0.5;  // No offset
            atten.inputs.in1.fill(0);
            atten.process();

            // 0V should be 0.5
            expect(atten.leds.ch1).toBeCloseTo(0.5, 1);
        });

        it('should clamp LED to 0-1 range', () => {
            atten.params.atten1 = 1;
            atten.params.offset1 = 1;    // +5V offset
            atten.inputs.in1.fill(10.0); // Would be 15V, clamped to 10V
            atten.process();

            // Should clamp to 1
            expect(atten.leds.ch1).toBeLessThanOrEqual(1);
            expect(atten.leds.ch1).toBeGreaterThanOrEqual(0);
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            atten.inputs.in1.fill(5.0);
            atten.inputs.in2.fill(5.0);
            atten.process();

            atten.reset();

            expect(atten.outputs.out1[0]).toBe(0);
            expect(atten.outputs.out2[0]).toBe(0);
            expect(atten.leds.ch1).toBe(0);
            expect(atten.leds.ch2).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire buffers without NaN', () => {
            atten.inputs.in1.fill(3.0);
            atten.inputs.in2.fill(-2.0);
            atten.process();

            expect(atten.outputs.out1.every(v => !isNaN(v))).toBe(true);
            expect(atten.outputs.out2.every(v => !isNaN(v))).toBe(true);
        });

        it('should process varying input correctly', () => {
            atten.params.atten1 = 0;  // Invert
            atten.params.offset1 = 0.5;

            // Create varying input
            for (let i = 0; i < 512; i++) {
                atten.inputs.in1[i] = Math.sin(i * 0.1) * 5;
            }

            atten.process();

            // Check that output is inverted
            for (let i = 0; i < 512; i++) {
                expect(atten.outputs.out1[i]).toBeCloseTo(-atten.inputs.in1[i], 1);
            }
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(attenModule.id).toBe('atten');
        });

        it('should have correct category', () => {
            expect(attenModule.category).toBe('utility');
        });

        it('should have UI definition', () => {
            expect(attenModule.ui).toBeDefined();
            expect(attenModule.ui.knobs.length).toBe(4);
            expect(attenModule.ui.inputs.length).toBe(2);
            expect(attenModule.ui.outputs.length).toBe(2);
        });
    });
});
