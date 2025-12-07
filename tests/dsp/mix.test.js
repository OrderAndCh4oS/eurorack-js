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
            expect(mix.params.lvl1).toBe(1);
            expect(mix.params.lvl2).toBe(1);
            expect(mix.params.lvl3).toBe(1);
            expect(mix.params.lvl4).toBe(1);
        });

        it('should create 4 input buffers', () => {
            expect(mix.inputs.in1).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in2).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in3).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in4).toBeInstanceOf(Float32Array);
            expect(mix.inputs.in1.length).toBe(512);
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

        it('should allow signal levels above unity (no hard clip)', () => {
            mix.inputs.in1.fill(5);
            mix.inputs.in2.fill(5);
            mix.inputs.in3.fill(5);
            mix.inputs.in4.fill(5);
            mix.params.lvl1 = 1;
            mix.params.lvl2 = 1;
            mix.params.lvl3 = 1;
            mix.params.lvl4 = 1;
            mix.process();

            // DC coupled mixer should pass 20V without clipping
            expect(mix.outputs.out[0]).toBeCloseTo(20, 5);
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
    });

    describe('reset', () => {
        it('should clear output buffer on reset', () => {
            mix.inputs.in1.fill(5);
            mix.process();
            mix.reset();

            expect(mix.outputs.out[0]).toBe(0);
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
