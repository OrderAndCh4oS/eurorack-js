import { describe, it, expect, beforeEach } from 'vitest';
import nseModule from '../../src/js/modules/nse/index.js';

// Helper to create Nse instance using new module system
const createNse = (options = {}) => nseModule.createDSP(options);

/**
 * 2hp Nse Specification Compliance Tests
 *
 * Based on 2hp Nse module:
 * - White noise generator
 * - Adjustable sample rate (downsample control)
 * - VCA mode for triggered noise bursts
 * - Output: ±5V (Eurorack standard)
 *
 * Source: https://www.twohp.com/modules/nse
 */

describe('createNse', () => {
    let nse;

    beforeEach(() => {
        nse = createNse();
    });

    describe('initialization', () => {
        it('should create with default params', () => {
            expect(nse.params.rate).toBe(1);
            expect(nse.params.vcaMode).toBe(0);
        });

        it('should create output buffer', () => {
            expect(nse.outputs.noise).toBeInstanceOf(Float32Array);
            expect(nse.outputs.noise.length).toBe(512);
        });

        it('should create trigger input buffer', () => {
            expect(nse.inputs.trigger).toBeInstanceOf(Float32Array);
            expect(nse.inputs.trigger.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(nse.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const custom = createNse({ bufferSize: 256, sampleRate: 48000 });
            expect(custom.outputs.noise.length).toBe(256);
        });

        it('should declare trigger normalization and bipolar audio rails', () => {
            expect(nseModule.ui.inputs[0]).toMatchObject({
                port: 'trigger',
                voltage: { min: 0, max: 10, normal: 0 }
            });
            expect(nseModule.ui.outputs[0]).toMatchObject({
                port: 'noise',
                voltage: { min: -5, max: 5 }
            });
        });
    });

    describe('white noise output', () => {
        it('should output in ±5V range', () => {
            nse.params.rate = 1; // Full rate white noise

            let min = Infinity, max = -Infinity;
            for (let i = 0; i < 100; i++) {
                nse.process();
                for (const v of nse.outputs.noise) {
                    min = Math.min(min, v);
                    max = Math.max(max, v);
                }
            }

            expect(min).toBeGreaterThanOrEqual(-5);
            expect(max).toBeLessThanOrEqual(5);
            expect(min).toBeLessThan(-4); // Should use full range
            expect(max).toBeGreaterThan(4);
        });

        it('should have roughly zero mean', () => {
            nse.params.rate = 1;

            let sum = 0, count = 0;
            for (let i = 0; i < 100; i++) {
                nse.process();
                for (const v of nse.outputs.noise) {
                    sum += v;
                    count++;
                }
            }

            const mean = sum / count;
            expect(Math.abs(mean)).toBeLessThan(0.5);
        });

        it('should produce varying values', () => {
            nse.params.rate = 1;
            nse.process();

            const unique = new Set(nse.outputs.noise);
            expect(unique.size).toBeGreaterThan(100);
        });
    });

    describe('downsample control (rate parameter)', () => {
        it('should produce full-rate noise at rate=1', () => {
            nse.params.rate = 1;
            nse.process();

            // At full rate, each sample should be different
            let changes = 0;
            for (let i = 1; i < 512; i++) {
                if (nse.outputs.noise[i] !== nse.outputs.noise[i - 1]) {
                    changes++;
                }
            }

            // Should have many changes (most samples different)
            expect(changes).toBeGreaterThan(400);
        });

        it('should produce downsampled noise at rate=0', () => {
            nse.params.rate = 0;
            nse.process();

            // At heavy downsample, many consecutive samples should be the same
            let sameCount = 0;
            for (let i = 1; i < 512; i++) {
                if (nse.outputs.noise[i] === nse.outputs.noise[i - 1]) {
                    sameCount++;
                }
            }

            // Most samples should be held (same as previous)
            expect(sameCount).toBeGreaterThan(400);
        });

        it('should produce "rumble" at low rates', () => {
            nse.params.rate = 0.1;

            // Process and check for characteristic low-frequency content
            nse.process();

            // With downsample, there should be repeated values
            let repeats = 0;
            for (let i = 1; i < 512; i++) {
                if (nse.outputs.noise[i] === nse.outputs.noise[i - 1]) {
                    repeats++;
                }
            }

            expect(repeats).toBeGreaterThan(100);
        });

        it('should preserve the low-rate hold duration across sample rates', () => {
            const countChanges = currentSampleRate => {
                let state = 0;
                const deterministic = createNse({
                    sampleRate: currentSampleRate,
                    bufferSize: currentSampleRate,
                    random: () => {
                        state = state ? 0 : 1;
                        return state;
                    }
                });
                deterministic.params.rate = 0;
                deterministic.process();
                let changes = 0;
                for (let i = 1; i < deterministic.outputs.noise.length; i++) {
                    if (deterministic.outputs.noise[i] !== deterministic.outputs.noise[i - 1]) {
                        changes++;
                    }
                }
                return changes;
            };

            expect(Math.abs(countChanges(44100) - countChanges(96000)))
                .toBeLessThanOrEqual(1);
        });
    });

    describe('VCA mode', () => {
        it('should output continuous noise when vcaMode=0', () => {
            nse.params.vcaMode = 0;
            nse.params.rate = 1;
            nse.process();

            // Should have non-zero output without trigger
            const hasOutput = nse.outputs.noise.some(v => Math.abs(v) > 0.1);
            expect(hasOutput).toBe(true);
        });

        it('should be silent without trigger when vcaMode=1', () => {
            nse.params.vcaMode = 1;
            nse.params.rate = 1;
            nse.inputs.trigger.fill(0);

            // Process a few times to ensure envelope has decayed
            for (let i = 0; i < 10; i++) {
                nse.process();
            }

            // Should be silent (all near zero)
            const maxLevel = Math.max(...nse.outputs.noise.map(Math.abs));
            expect(maxLevel).toBeLessThan(0.1);
        });

        it('should produce burst on trigger in VCA mode', () => {
            nse.params.vcaMode = 1;
            nse.params.rate = 1;

            // Set up trigger (rising edge)
            nse.inputs.trigger.fill(0);
            nse.process(); // Process with no trigger first

            // Now trigger
            nse.inputs.trigger.fill(5);
            nse.process();

            // Should have output during attack/decay
            const hasOutput = nse.outputs.noise.some(v => Math.abs(v) > 0.5);
            expect(hasOutput).toBe(true);
        });

        it('should decay after trigger in VCA mode', () => {
            nse.params.vcaMode = 1;
            nse.params.rate = 0; // Short decay (10ms) for quick test

            // Trigger
            nse.inputs.trigger.fill(0);
            nse.process();
            nse.inputs.trigger.fill(5);
            nse.process();

            // Let decay complete (10ms = ~441 samples at 44100Hz)
            nse.inputs.trigger.fill(0);
            for (let i = 0; i < 5; i++) {
                nse.process();
            }

            // Should be silent after decay
            const maxLevel = Math.max(...nse.outputs.noise.map(Math.abs));
            expect(maxLevel).toBeLessThan(0.1);
        });

        it('should require rising edge for trigger (≥1V)', () => {
            nse.params.vcaMode = 1;
            nse.params.rate = 0; // Short decay (10ms) for quick test

            // Hold trigger high (no edge)
            nse.inputs.trigger.fill(5);
            for (let i = 0; i < 5; i++) {
                nse.process();
            }

            // After initial burst decays, sustained high should not re-trigger
            const maxLevel = Math.max(...nse.outputs.noise.map(Math.abs));
            expect(maxLevel).toBeLessThan(0.1);
        });

        it('should use the exact >=1V threshold', () => {
            const below = createNse({ sampleRate: 1000, bufferSize: 16, random: () => 1 });
            below.params.vcaMode = 1;
            below.inputs.trigger[0] = 0.999;
            below.process();
            expect(below.outputs.noise.every(value => value === 0)).toBe(true);

            const exact = createNse({ sampleRate: 1000, bufferSize: 16, random: () => 1 });
            exact.params.vcaMode = 1;
            exact.inputs.trigger[0] = 1;
            exact.process();
            expect(exact.outputs.noise.some(value => value > 0)).toBe(true);
        });

        it('should control decay time with rate knob in VCA mode', () => {
            // Short decay (rate=0, 10ms = ~441 samples at 44100Hz)
            const nseShort = createNse({ bufferSize: 128 });
            nseShort.params.vcaMode = 1;
            nseShort.params.rate = 0;

            // Trigger
            nseShort.inputs.trigger.fill(0);
            nseShort.process();
            nseShort.inputs.trigger.fill(5);
            nseShort.process(); // Start envelope
            nseShort.inputs.trigger.fill(0);

            // Count buffers until decay completes (check LED which tracks envelope)
            let shortBuffers = 1;
            while (nseShort.leds.active > 0.01 && shortBuffers < 500) {
                nseShort.process();
                shortBuffers++;
            }

            // Long decay (rate=1, 500ms = ~22050 samples)
            const nseLong = createNse({ bufferSize: 128 });
            nseLong.params.vcaMode = 1;
            nseLong.params.rate = 1;

            // Trigger
            nseLong.inputs.trigger.fill(0);
            nseLong.process();
            nseLong.inputs.trigger.fill(5);
            nseLong.process(); // Start envelope
            nseLong.inputs.trigger.fill(0);

            // Count buffers until decay completes
            let longBuffers = 1;
            while (nseLong.leds.active > 0.01 && longBuffers < 500) {
                nseLong.process();
                longBuffers++;
            }

            // Long decay should be much longer than short
            // Short: ~441 samples / 128 = ~4 buffers
            // Long: ~22050 samples / 128 = ~172 buffers
            expect(longBuffers).toBeGreaterThan(shortBuffers * 10);
        });

        it('should preserve the 10ms minimum decay across sample rates', () => {
            const lastActiveSample = currentSampleRate => {
                const current = createNse({
                    sampleRate: currentSampleRate,
                    bufferSize: Math.round(currentSampleRate * 0.02),
                    random: () => 1
                });
                current.params.vcaMode = 1;
                current.params.rate = 0;
                current.inputs.trigger[0] = 10;
                current.process();
                return Array.from(current.outputs.noise)
                    .findLastIndex(value => Math.abs(value) > 0);
            };

            const at1k = lastActiveSample(1000) / 1000;
            const at2k = lastActiveSample(2000) / 2000;
            expect(Math.abs(at1k - at2k)).toBeLessThanOrEqual(0.0011);
            expect(at1k).toBeCloseTo(0.01, 2);
            expect(at2k).toBeCloseTo(0.01, 2);
        });

        it('should retrigger from the current envelope level without dropping to zero', () => {
            const retriggered = createNse({
                sampleRate: 1000,
                bufferSize: 32,
                random: () => 1
            });
            retriggered.params.vcaMode = 1;
            retriggered.params.rate = 1;
            retriggered.inputs.trigger[0] = 10;
            retriggered.inputs.trigger[10] = 10;
            retriggered.process();

            expect(retriggered.outputs.noise[10])
                .toBeGreaterThanOrEqual(retriggered.outputs.noise[9]);
        });

        it('should clear an old envelope when VCA mode is switched off', () => {
            const switched = createNse({
                sampleRate: 1000,
                bufferSize: 32,
                random: () => 1
            });
            switched.params.vcaMode = 1;
            switched.params.rate = 1;
            switched.inputs.trigger[0] = 10;
            switched.process();
            switched.params.vcaMode = 0;
            switched.inputs.trigger.fill(0);
            switched.process();
            switched.params.vcaMode = 1;
            switched.process();

            expect(switched.outputs.noise.every(value => value === 0)).toBe(true);
        });
    });

    describe('LED indicator', () => {
        it('should be 1 in continuous mode', () => {
            nse.params.vcaMode = 0;
            nse.process();
            expect(nse.leds.active).toBe(1);
        });

        it('should track envelope in VCA mode', () => {
            nse.params.vcaMode = 1;
            nse.inputs.trigger.fill(0);

            for (let i = 0; i < 10; i++) {
                nse.process();
            }

            // Should be 0 when silent
            expect(nse.leds.active).toBe(0);

            // Trigger
            nse.inputs.trigger.fill(5);
            nse.process();

            // Should be >0 during envelope
            expect(nse.leds.active).toBeGreaterThan(0);
        });
    });

    describe('reset', () => {
        it('should reset all state', () => {
            const inputRefs = { ...nse.inputs };
            const outputRefs = { ...nse.outputs };
            nse.params.vcaMode = 1;
            nse.inputs.trigger.fill(5);
            nse.process();

            nse.reset();

            expect(nse.inputs).toEqual(inputRefs);
            expect(nse.outputs).toEqual(outputRefs);
            expect(nse.inputs.trigger.every(value => value === 0)).toBe(true);
            expect(nse.outputs.noise.every(value => value === 0)).toBe(true);
            expect(nse.leds.active).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire buffer without NaN', () => {
            nse.process();
            expect(nse.outputs.noise.every(v => !isNaN(v))).toBe(true);
        });

        it('should recover from non-finite params, triggers, and RNG values', () => {
            const invalid = createNse({ random: () => Number.NaN });
            invalid.params.rate = Number.NaN;
            invalid.params.vcaMode = Number.POSITIVE_INFINITY;
            invalid.inputs.trigger.fill(Number.NaN);
            invalid.process();

            expect(invalid.outputs.noise.every(Number.isFinite)).toBe(true);
            expect(Math.min(...invalid.outputs.noise)).toBeGreaterThanOrEqual(-5);
            expect(Math.max(...invalid.outputs.noise)).toBeLessThanOrEqual(5);
        });
    });
});
