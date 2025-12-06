import { describe, it, expect, beforeEach } from 'vitest';
import { createNse } from '../../src/js/dsp/nse.js';

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
            expect(nse.params.rate).toBe(0.5);
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
            nse.params.vcaMode = 1;
            nse.inputs.trigger.fill(5);
            nse.process();

            nse.reset();

            expect(nse.leds.active).toBe(0);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire buffer without NaN', () => {
            nse.process();
            expect(nse.outputs.noise.every(v => !isNaN(v))).toBe(true);
        });
    });
});
