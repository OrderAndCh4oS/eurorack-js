import { describe, it, expect, beforeEach } from 'vitest';
import { createSlew } from '../../src/js/dsp/slew.js';

describe('createSlew', () => {
    describe('initialization', () => {
        it('should create a slew processor with default options', () => {
            const slew = createSlew();
            expect(slew).toBeDefined();
            expect(typeof slew.process).toBe('function');
            expect(typeof slew.processBuffer).toBe('function');
            expect(typeof slew.reset).toBe('function');
        });

        it('should accept custom sampleRate and timeMs', () => {
            const slew = createSlew({ sampleRate: 48000, timeMs: 10 });
            expect(slew).toBeDefined();
        });
    });

    describe('process()', () => {
        it('should return initial value of 0', () => {
            const slew = createSlew();
            expect(slew.process(0)).toBe(0);
        });

        it('should gradually approach target value', () => {
            const slew = createSlew({ timeMs: 1 }); // Fast slew
            let value = 0;
            for (let i = 0; i < 500; i++) {
                value = slew.process(5);
            }
            expect(value).toBeCloseTo(5, 0); // Within 0.5 of target
        });

        it('should slew down as well as up', () => {
            const slew = createSlew({ timeMs: 1 });
            // Slew up first
            for (let i = 0; i < 500; i++) {
                slew.process(5);
            }
            // Now slew down
            let value = 0;
            for (let i = 0; i < 500; i++) {
                value = slew.process(0);
            }
            expect(value).toBeCloseTo(0, 0); // Within 0.5 of target
        });

        it('should slew slower with longer timeMs', () => {
            const fastSlew = createSlew({ timeMs: 1 });
            const slowSlew = createSlew({ timeMs: 50 });

            let fastVal = 0, slowVal = 0;
            for (let i = 0; i < 100; i++) {
                fastVal = fastSlew.process(5);
                slowVal = slowSlew.process(5);
            }
            expect(fastVal).toBeGreaterThan(slowVal);
        });
    });

    describe('processBuffer()', () => {
        it('should process an entire buffer', () => {
            const slew = createSlew({ timeMs: 1 });
            const input = new Float32Array(512).fill(5);
            const output = new Float32Array(512);

            slew.processBuffer(input, output);

            expect(output[0]).toBeGreaterThan(0);
            expect(output[511]).toBeGreaterThan(output[0]);
        });

        it('should fill output buffer with smoothed values', () => {
            const slew = createSlew({ timeMs: 0.1 }); // Very fast
            const input = new Float32Array(512).fill(10);
            const output = new Float32Array(512);

            slew.processBuffer(input, output);

            expect(output[511]).toBeCloseTo(10, 0);
        });
    });

    describe('reset()', () => {
        it('should reset state to 0 by default', () => {
            const slew = createSlew();
            slew.process(5);
            slew.process(5);
            slew.reset();
            expect(slew.process(0)).toBe(0);
        });

        it('should reset state to provided value', () => {
            const slew = createSlew();
            slew.reset(3);
            // First process should be near 3, then slew toward target
            expect(slew.process(3)).toBeCloseTo(3, 5);
        });
    });

    describe('timeMs setter', () => {
        it('should update slew rate at runtime', () => {
            const slew = createSlew({ timeMs: 50 });

            // Slow slew initially
            let slowVal = 0;
            for (let i = 0; i < 50; i++) {
                slowVal = slew.process(5);
            }

            slew.reset();
            slew.timeMs = 1; // Make it fast

            let fastVal = 0;
            for (let i = 0; i < 50; i++) {
                fastVal = slew.process(5);
            }

            expect(fastVal).toBeGreaterThan(slowVal);
        });
    });
});
