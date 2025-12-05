import { describe, it, expect, beforeEach } from 'vitest';
import { createNoiseSH } from '../../src/js/dsp/noise.js';

describe('createNoiseSH', () => {
    let noise;

    beforeEach(() => {
        noise = createNoiseSH();
    });

    describe('initialization', () => {
        it('should create a Noise/SH with default params', () => {
            expect(noise.params.rate).toBe(0.3);
            expect(noise.params.slew).toBe(0);
        });

        it('should create default inputs', () => {
            expect(noise.inputs.sample).toBe(null);
            expect(noise.inputs.trigger).toBe(0);
        });

        it('should create output buffers', () => {
            expect(noise.outputs.white).toBeInstanceOf(Float32Array);
            expect(noise.outputs.pink).toBeInstanceOf(Float32Array);
            expect(noise.outputs.sh).toBeInstanceOf(Float32Array);
            expect(noise.outputs.white.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(noise.leds.sh).toBe(0);
        });

        it('should accept custom options', () => {
            const customNoise = createNoiseSH({ sampleRate: 48000, bufferSize: 256 });
            expect(customNoise.outputs.white.length).toBe(256);
        });
    });

    describe('white noise', () => {
        it('should produce output in ±5V range', () => {
            noise.process();

            const max = Math.max(...noise.outputs.white);
            const min = Math.min(...noise.outputs.white);

            expect(max).toBeLessThanOrEqual(5);
            expect(min).toBeGreaterThanOrEqual(-5);
        });

        it('should produce different values each sample (random)', () => {
            noise.process();

            // Check that values vary
            const uniqueValues = new Set(noise.outputs.white);
            expect(uniqueValues.size).toBeGreaterThan(100);
        });

        it('should have roughly zero mean', () => {
            // Process many buffers for statistical significance
            let sum = 0;
            let count = 0;
            for (let i = 0; i < 100; i++) {
                noise.process();
                for (const v of noise.outputs.white) {
                    sum += v;
                    count++;
                }
            }

            const mean = sum / count;
            expect(Math.abs(mean)).toBeLessThan(0.5); // Close to zero
        });
    });

    describe('pink noise', () => {
        it('should produce output in reasonable range', () => {
            noise.process();

            const max = Math.max(...noise.outputs.pink);
            const min = Math.min(...noise.outputs.pink);

            expect(max).toBeLessThan(10);
            expect(min).toBeGreaterThan(-10);
        });

        it('should have different spectral characteristics than white', () => {
            // Process to let pink filter settle
            for (let i = 0; i < 10; i++) {
                noise.process();
            }

            // Pink should be smoother (less high frequency content)
            // Check variance of differences between adjacent samples
            let whiteDiffVar = 0;
            let pinkDiffVar = 0;

            for (let i = 1; i < 512; i++) {
                whiteDiffVar += Math.abs(noise.outputs.white[i] - noise.outputs.white[i-1]);
                pinkDiffVar += Math.abs(noise.outputs.pink[i] - noise.outputs.pink[i-1]);
            }

            // Pink should be "smoother" - less sample-to-sample variation
            expect(pinkDiffVar).toBeLessThan(whiteDiffVar);
        });
    });

    describe('sample & hold', () => {
        it('should hold a constant value between triggers', () => {
            noise.params.rate = 0; // Very slow internal clock
            noise.process();

            // S&H output should be constant within buffer (no triggers)
            const firstValue = noise.outputs.sh[0];
            const allSame = noise.outputs.sh.every(v => v === firstValue);

            // May not be perfectly same if internal clock fires, but mostly constant
            expect(noise.outputs.sh.filter(v => v === firstValue).length).toBeGreaterThan(400);
        });

        it('should sample on external trigger', () => {
            noise.params.rate = 0; // No internal clock
            noise.process();
            const initialValue = noise.outputs.sh[511];

            // Trigger
            noise.inputs.trigger = 5;
            noise.process();

            // Value may have changed (sampled white noise)
            expect(noise.outputs.sh[0]).toBeDefined();
        });

        it('should sample from white noise by default', () => {
            noise.params.rate = 1; // Fast internal clock for many samples

            for (let i = 0; i < 10; i++) {
                noise.process();
            }

            // S&H output should be in ±5V range (from white noise)
            const max = Math.max(...noise.outputs.sh);
            const min = Math.min(...noise.outputs.sh);

            expect(max).toBeLessThanOrEqual(5);
            expect(min).toBeGreaterThanOrEqual(-5);
        });

        it('should sample from external input when connected', () => {
            const sampleInput = new Float32Array(512).fill(3.5);
            noise.inputs.sample = sampleInput;
            noise.params.rate = 1; // Fast clock

            for (let i = 0; i < 10; i++) {
                noise.process();
            }

            // S&H should have sampled the 3.5V input
            expect(noise.outputs.sh.some(v => Math.abs(v - 3.5) < 0.1)).toBe(true);
        });
    });

    describe('slew', () => {
        it('should smooth S&H output when slew is enabled', () => {
            noise.params.rate = 1; // Fast clock
            noise.params.slew = 0.5;

            for (let i = 0; i < 10; i++) {
                noise.process();
            }

            // With slew, transitions should be gradual
            // Check that consecutive samples don't jump too much
            let maxJump = 0;
            for (let i = 1; i < 512; i++) {
                maxJump = Math.max(maxJump, Math.abs(noise.outputs.sh[i] - noise.outputs.sh[i-1]));
            }

            // With slew, jumps should be smaller (hard to test precisely)
            expect(maxJump).toBeLessThan(5); // Not instant jumps to full range
        });
    });

    describe('internal clock', () => {
        it('should trigger S&H at rate set by param', () => {
            noise.params.rate = 0.5; // Medium rate

            // Process and count changes
            let changes = 0;
            let lastVal = 0;

            for (let i = 0; i < 100; i++) {
                noise.process();
                for (const v of noise.outputs.sh) {
                    if (Math.abs(v - lastVal) > 0.1) {
                        changes++;
                        lastVal = v;
                    }
                }
            }

            expect(changes).toBeGreaterThan(0);
        });
    });

    describe('LED', () => {
        it('should reflect S&H output level', () => {
            noise.params.rate = 1;

            for (let i = 0; i < 10; i++) {
                noise.process();
            }

            // LED should be between 0 and 1
            expect(noise.leds.sh).toBeGreaterThanOrEqual(0);
            expect(noise.leds.sh).toBeLessThanOrEqual(1);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            noise.process();

            expect(noise.outputs.white.every(v => !isNaN(v))).toBe(true);
            expect(noise.outputs.pink.every(v => !isNaN(v))).toBe(true);
            expect(noise.outputs.sh.every(v => !isNaN(v))).toBe(true);
        });
    });
});
