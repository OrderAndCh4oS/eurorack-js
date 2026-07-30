import { describe, it, expect, beforeEach } from 'vitest';
import mixModule from '../../src/js/modules/mix/index.js';

const createMix = (options = {}) => mixModule.createDSP(options);

describe('2hp Mix - 4 Channel Mixer', () => {
    let mix;

    beforeEach(() => {
        mix = createMix();
    });

    describe('initialization', () => {
        it('should create a mixer with default params', () => {
            expect(mix.params.lvl1).toBe(0.8);
            expect(mix.params.lvl2).toBe(0.8);
            expect(mix.params.lvl3).toBe(0.8);
            expect(mix.params.lvl4).toBe(0.8);
        });

        it('should create 4 input buffers', () => {
            expect(mix.inputs.in1).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in2).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in3).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in4).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in1.length).toBe(512);
            expect(mixModule.ui.inputs.map(port => port.voltage)).toEqual([
                { min: -10, max: 10, normal: 0 },
                { min: -10, max: 10, normal: 0 },
                { min: -10, max: 10, normal: 0 },
                { min: -10, max: 10, normal: 0 }
            ]);
        });

        it('should create output buffer', () => {
            expect(mix.outputs.out).toBeInstanceOf(Float32Array);
            expect(mix.outputs.out.length).toBe(512);
        });

        it('should have LED meter', () => {
            expect(mix.leds.level).toBe(0);
        });

        it('should accept custom options', () => {
            const customMix = createMix({ bufferSize: 256, sampleRate: 48000 });
            expect(customMix.outputs.out.length).toBe(256);
        });
    });

    describe('level controls', () => {
        it('should pass signal at unity gain', () => {
            mix.inputs.in1.fill(2.5);
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 0;
            mix.params.lvl3 = 0;
            mix.params.lvl4 = 0;
            mix.process();

            expect(mix.outputs.out[0]).toBeCloseTo(2.5, 5);
        });

        it('should attenuate signal with lower level', () => {
            mix.inputs.in1.fill(4);
            mix.params.lvl1 = 0.5;
            mix.params.lvl2 = 0;
            mix.params.lvl3 = 0;
            mix.params.lvl4 = 0;
            mix.process();

            expect(mix.outputs.out[0]).toBeCloseTo(2, 5);
        });

        it('should mute signal at zero level', () => {
            mix.inputs.in1.fill(5);
            mix.params.lvl1 = 0;
            mix.process();

            expect(mix.outputs.out[0]).toBe(0);
        });

        it('should control each channel independently', () => {
            mix.inputs.in1.fill(1);
            mix.inputs.in2.fill(2);
            mix.inputs.in3.fill(3);
            mix.inputs.in4.fill(4);

            mix.params.lvl1 = 1;
            mix.params.lvl2 = 0.5;
            mix.params.lvl3 = 0.25;
            mix.params.lvl4 = 0;
            mix.process();

            // 1*1 + 2*0.5 + 3*0.25 + 4*0 = 1 + 1 + 0.75 + 0 = 2.75
            expect(mix.outputs.out[0]).toBeCloseTo(2.75, 5);
        });

        it('slews a level change without changing the initial patch render', () => {
            mix.inputs.in1.fill(5);
            mix.params.lvl1 = 0;
            mix.params.lvl2 = 0;
            mix.params.lvl3 = 0;
            mix.params.lvl4 = 0;
            mix.process();
            expect(mix.outputs.out[0]).toBe(0);

            mix.params.lvl1 = 1;
            mix.process();

            expect(mix.outputs.out[0]).toBeGreaterThan(0);
            expect(mix.outputs.out[0]).toBeLessThan(5);
            for (let block = 0; block < 10; block++) mix.process();
            expect(mix.outputs.out[511]).toBeCloseTo(5, 2);
        });

        it.each([44100, 48000, 96000])('uses a sample-rate-invariant 5ms level slew at %i Hz', sampleRate => {
            const bufferSize = Math.round(sampleRate * 0.005);
            const timed = createMix({ sampleRate, bufferSize });
            timed.inputs.in1.fill(5);
            timed.params.lvl1 = 0;
            timed.params.lvl2 = 0;
            timed.params.lvl3 = 0;
            timed.params.lvl4 = 0;
            timed.process();
            timed.params.lvl1 = 1;

            timed.process();

            expect(timed.outputs.out[bufferSize - 1]).toBeCloseTo(5 * (1 - Math.exp(-1)), 2);
        });
    });

    describe('signal summing', () => {
        it('should sum multiple inputs together', () => {
            mix.inputs.in1.fill(1);
            mix.inputs.in2.fill(1);
            mix.inputs.in3.fill(1);
            mix.inputs.in4.fill(1);
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 1;
            mix.params.lvl3 = 1;
            mix.params.lvl4 = 1;
            mix.process();

            expect(mix.outputs.out[0]).toBeCloseTo(4, 5);
        });

        it('should handle bipolar signals (audio)', () => {
            for (let i = 0; i < 512; i++) {
                mix.inputs.in1[i] = Math.sin(i * 0.1) * 5;
                mix.inputs.in2[i] = Math.sin(i * 0.1 + Math.PI) * 5; // Phase inverted
            }
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 1;
            mix.params.lvl3 = 0;
            mix.params.lvl4 = 0;
            mix.process();

            // Phase-inverted signals should cancel out
            for (let i = 0; i < 512; i++) {
                expect(mix.outputs.out[i]).toBeCloseTo(0, 4);
            }
        });

        it('should handle DC signals (CV mixing)', () => {
            mix.inputs.in1.fill(2.5);  // Pitch CV
            mix.inputs.in2.fill(1.0);  // Offset CV
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 1;
            mix.params.lvl3 = 0;
            mix.params.lvl4 = 0;
            mix.process();

            expect(mix.outputs.out[0]).toBeCloseTo(3.5, 5);
        });

        it('should preserve linear sums below the rail and softly limit overload', () => {
            mix.inputs.in1.fill(4);
            mix.inputs.in2.fill(4);
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 1;
            mix.params.lvl3 = 0;
            mix.params.lvl4 = 0;
            mix.process();
            expect(mix.outputs.out[0]).toBeCloseTo(8, 5);

            mix.inputs.in1.fill(5);
            mix.inputs.in2.fill(5);
            mix.inputs.in3.fill(5);
            mix.inputs.in4.fill(5);
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 1;
            mix.params.lvl3 = 1;
            mix.params.lvl4 = 1;
            mix.process();

            expect(mix.outputs.out[0]).toBeGreaterThan(9.6);
            expect(mix.outputs.out[0]).toBeLessThanOrEqual(10);
        });
    });

    describe('LED metering', () => {
        it('should update LED level based on output', () => {
            mix.inputs.in1.fill(5);
            mix.params.lvl1 = 1;
            mix.process();

            expect(mix.leds.level).toBeGreaterThan(0);
        });

        it('should decay LED level over time', () => {
            mix.inputs.in1.fill(5);
            mix.params.lvl1 = 1;
            mix.process();
            const initialLed = mix.leds.level;

            mix.inputs.in1.fill(0);
            mix.process();

            expect(mix.leds.level).toBeLessThan(initialLed);
        });

        it('should show zero with no signal', () => {
            mix.process();
            expect(mix.leds.level).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffer', () => {
            for (let i = 0; i < 512; i++) {
                mix.inputs.in1[i] = Math.random() * 10 - 5;
                mix.inputs.in2[i] = Math.random() * 10 - 5;
            }
            mix.process();

            expect(mix.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should produce no NaN values with normal input', () => {
            for (let i = 0; i < 512; i++) {
                mix.inputs.in1[i] = Math.random() * 20 - 10;
                mix.inputs.in2[i] = Math.random() * 20 - 10;
                mix.inputs.in3[i] = Math.random() * 20 - 10;
                mix.inputs.in4[i] = Math.random() * 20 - 10;
            }
            mix.process();

            expect(mix.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should recover safely from non-finite controls and samples', () => {
            mix.params.lvl1 = Number.NaN;
            mix.params.lvl2 = Number.POSITIVE_INFINITY;
            mix.inputs.in1.fill(Number.NaN);
            mix.inputs.in2.fill(Number.NEGATIVE_INFINITY);

            mix.process();

            expect(mix.outputs.out.every(Number.isFinite)).toBe(true);
            expect(Number.isFinite(mix.leds.level)).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear stable input and output buffers on reset', () => {
            const inputs = { ...mix.inputs };
            const output = mix.outputs.out;
            mix.inputs.in1.fill(5);
            mix.inputs.in2.fill(-5);
            mix.process();
            mix.reset();

            for (const key of Object.keys(inputs)) {
                expect(mix.inputs[key]).toBe(inputs[key]);
                expect(mix.inputs[key].every(value => value === 0)).toBe(true);
            }
            expect(mix.outputs.out).toBe(output);
            expect(mix.outputs.out.every(value => value === 0)).toBe(true);
        });

        it('should clear LED on reset', () => {
            mix.inputs.in1.fill(5);
            mix.process();
            mix.reset();

            expect(mix.leds.level).toBe(0);
        });
    });

    describe('module metadata', () => {
        it('should have correct module ID', () => {
            expect(mixModule.id).toBe('mix');
        });

        it('should have correct HP width', () => {
            expect(mixModule.hp).toBe(4);
        });

        it('should have UI definition with 4 inputs', () => {
            expect(mixModule.ui.inputs.length).toBe(4);
        });

        it('should have UI definition with 4 knobs', () => {
            expect(mixModule.ui.knobs.length).toBe(4);
        });

        it('should have UI definition with 1 output', () => {
            expect(mixModule.ui.outputs.length).toBe(1);
        });
    });
});
