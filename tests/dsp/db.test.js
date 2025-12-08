/**
 * Tests for DB - Dual VU Meter Module
 * Based on Wavefonix Dual VU Meter and NoisyFruitsLab RGB VU
 */
import { describe, it, expect, beforeEach } from 'vitest';
import dbModule from '../../src/js/modules/db/index.js';

describe('DB - Dual VU Meter', () => {
    let dsp;
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 512;

    beforeEach(() => {
        dsp = dbModule.createDSP({
            sampleRate: SAMPLE_RATE,
            bufferSize: BUFFER_SIZE
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(dbModule.id).toBe('db');
        });

        it('should have correct name', () => {
            expect(dbModule.name).toBe('DB');
        });

        it('should have correct HP width', () => {
            expect(dbModule.hp).toBe(4);
        });

        it('should have utility category', () => {
            expect(dbModule.category).toBe('utility');
        });
    });

    describe('initialization', () => {
        it('should have default params', () => {
            expect(dsp.params.mode).toBe(0); // VU mode
            expect(dsp.params.hold).toBe(1); // Peak hold on
        });

        it('should have dual input buffers', () => {
            expect(dsp.inputs.L).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.R).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.L.length).toBe(BUFFER_SIZE);
            expect(dsp.inputs.R.length).toBe(BUFFER_SIZE);
        });

        it('should have dual output buffers (thru)', () => {
            expect(dsp.outputs.outL).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.outR).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.outL.length).toBe(BUFFER_SIZE);
            expect(dsp.outputs.outR.length).toBe(BUFFER_SIZE);
        });

        it('should have LED arrays for both channels', () => {
            // 12 LEDs per channel
            expect(dsp.leds.L0).toBeDefined();
            expect(dsp.leds.L11).toBeDefined();
            expect(dsp.leds.R0).toBeDefined();
            expect(dsp.leds.R11).toBeDefined();
        });

        it('should have peak hold indicators', () => {
            expect(dsp.leds.peakL).toBeDefined();
            expect(dsp.leds.peakR).toBeDefined();
        });

        it('should initialize all LEDs to off', () => {
            for (let i = 0; i < 12; i++) {
                expect(dsp.leds[`L${i}`]).toBe(0);
                expect(dsp.leds[`R${i}`]).toBe(0);
            }
            expect(dsp.leds.peakL).toBe(0);
            expect(dsp.leds.peakR).toBe(0);
        });
    });

    describe('thru outputs', () => {
        it('should pass L input to L output unchanged', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = Math.sin(i * 0.1) * 5;
            }

            dsp.process();

            for (let i = 0; i < BUFFER_SIZE; i++) {
                expect(dsp.outputs.outL[i]).toBe(dsp.inputs.L[i]);
            }
        });

        it('should pass R input to R output unchanged', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.R[i] = Math.cos(i * 0.1) * 3;
            }

            dsp.process();

            for (let i = 0; i < BUFFER_SIZE; i++) {
                expect(dsp.outputs.outR[i]).toBe(dsp.inputs.R[i]);
            }
        });
    });

    describe('VU metering (mode 0)', () => {
        beforeEach(() => {
            dsp.params.mode = 0;
        });

        it('should show no LEDs for silence', () => {
            dsp.inputs.L.fill(0);
            dsp.inputs.R.fill(0);

            // Process multiple times to let averaging settle
            for (let j = 0; j < 20; j++) {
                dsp.process();
            }

            for (let i = 0; i < 12; i++) {
                expect(dsp.leds[`L${i}`]).toBe(0);
                expect(dsp.leds[`R${i}`]).toBe(0);
            }
        });

        it('should light bottom LEDs for quiet signal (-18dB)', () => {
            // -18dB relative to 5V = 5 * 10^(-18/20) = 0.63V peak
            // RMS = 0.63 / sqrt(2) = 0.445V, which is about -21dB
            // This should light LED0 and maybe LED1 in our -30 to +6 range
            const amplitude = 0.63;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = amplitude * Math.sin(i * 0.1);
            }
            dsp.inputs.R.fill(0);

            // Let VU averaging settle
            for (let j = 0; j < 30; j++) {
                dsp.process();
            }

            // Should light at least the bottom LED
            expect(dsp.leds.L0).toBeGreaterThan(0);
            // Should not light top LEDs
            expect(dsp.leds.L11).toBe(0);
        });

        it('should light more LEDs for louder signal (0dB = 5V)', () => {
            // 0dB = 5V peak
            const amplitude = 5;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = amplitude * Math.sin(i * 0.1);
            }

            // Let VU averaging settle
            for (let j = 0; j < 30; j++) {
                dsp.process();
            }

            // Should light up to around 0dB mark
            // With 12 LEDs and -36 to +6 range, 0dB is around LED 9-10
            expect(dsp.leds.L6).toBeGreaterThan(0);
            expect(dsp.leds.L8).toBeGreaterThan(0);
        });

        it('should light top LEDs for hot signal (+6dB)', () => {
            // +6dB relative to 5V = 5 * 10^(6/20) = 10V peak
            // VU measures RMS, so 10V peak sine = 7.07V RMS = +3dB
            // This should light up to around LED 10-11
            const amplitude = 10;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = amplitude * Math.sin(i * 0.1);
            }

            // Let VU averaging settle
            for (let j = 0; j < 30; j++) {
                dsp.process();
            }

            // Top LEDs should be lit (VU shows RMS so won't quite hit clip)
            expect(dsp.leds.L10).toBeGreaterThan(0);
        });

        it('should have slow response (VU characteristic ~300ms)', () => {
            // Start with signal
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 5 * Math.sin(i * 0.1);
            }

            // Let it settle
            for (let j = 0; j < 50; j++) {
                dsp.process();
            }

            const settledLevel = dsp.leds.L8;
            expect(settledLevel).toBeGreaterThan(0);

            // Now cut to silence
            dsp.inputs.L.fill(0);
            dsp.process();

            // Level should still be high (slow decay)
            expect(dsp.leds.L8).toBeGreaterThan(settledLevel * 0.5);
        });
    });

    describe('peak metering (mode 1)', () => {
        beforeEach(() => {
            dsp.params.mode = 1;
        });

        it('should respond instantly to peaks', () => {
            dsp.inputs.L.fill(0);
            // Single peak in the middle
            dsp.inputs.L[BUFFER_SIZE / 2] = 5;

            dsp.process();

            // Should show the peak immediately (0dB = 5V is around LED 9-10)
            expect(dsp.leds.L8).toBeGreaterThan(0);
        });

        it('should decay slowly after peak', () => {
            // Initial peak
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 5 * Math.sin(i * 0.1);
            }
            dsp.process();

            const peakLevel = dsp.leds.L8;

            // Now silence
            dsp.inputs.L.fill(0);
            dsp.process();

            // Should still show some level (slow decay)
            expect(dsp.leds.L8).toBeGreaterThan(0);
            expect(dsp.leds.L8).toBeLessThanOrEqual(peakLevel);
        });
    });

    describe('combined mode (mode 2)', () => {
        beforeEach(() => {
            dsp.params.mode = 2;
        });

        it('should show both VU average and peak', () => {
            // Signal with peaks
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 3 * Math.sin(i * 0.1);
            }
            // Add a spike
            dsp.inputs.L[100] = 8;

            // Let it settle a bit
            for (let j = 0; j < 10; j++) {
                dsp.process();
            }

            // Peak indicator should be higher than VU level
            expect(dsp.leds.peakL).toBeGreaterThan(0);
        });
    });

    describe('peak hold', () => {
        it('should hold peak indicator when hold is on', () => {
            dsp.params.hold = 1;
            dsp.params.mode = 1;

            // Big peak
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 8 * Math.sin(i * 0.1);
            }
            dsp.process();

            const peakLedAfterSignal = dsp.leds.peakL;

            // Now silence for several buffers
            dsp.inputs.L.fill(0);
            for (let j = 0; j < 10; j++) {
                dsp.process();
            }

            // Peak hold should still show the peak position
            expect(dsp.leds.peakL).toBe(peakLedAfterSignal);
        });

        it('should not hold peak when hold is off', () => {
            dsp.params.hold = 0;
            dsp.params.mode = 1;

            // Big peak
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 8 * Math.sin(i * 0.1);
            }
            dsp.process();

            const peakLedAfterSignal = dsp.leds.peakL;
            expect(peakLedAfterSignal).toBe(11); // Sanity check - should be at max

            // Now silence for many buffers (need enough time for significant decay)
            // ~3 seconds worth of buffers for clear decay
            dsp.inputs.L.fill(0);
            const buffersFor3Seconds = Math.ceil((SAMPLE_RATE * 3) / BUFFER_SIZE);
            for (let j = 0; j < buffersFor3Seconds; j++) {
                dsp.process();
            }

            // Peak should have decayed significantly (below max)
            expect(dsp.leds.peakL).toBeLessThan(11);
        });
    });

    describe('stereo independence', () => {
        it('should meter L and R channels independently', () => {
            // L channel loud, R channel quiet
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 5 * Math.sin(i * 0.1);
                dsp.inputs.R[i] = 0.5 * Math.sin(i * 0.1);
            }

            for (let j = 0; j < 30; j++) {
                dsp.process();
            }

            // L should be much higher than R
            expect(dsp.leds.L8).toBeGreaterThan(dsp.leds.R8);
        });
    });

    describe('dB scale accuracy', () => {
        it('should map 5V peak to 0dB', () => {
            dsp.params.mode = 1; // Peak mode for accuracy

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 5 * Math.sin(i * 0.1);
            }
            dsp.process();

            // 0dB with 12 LEDs in -36 to +6 range = LED around index 10
            // (36dB from bottom / 3.5dB per LED ≈ 10.3)
            expect(dsp.leds.L9).toBeGreaterThan(0.5);
        });

        it('should map 10V peak to +6dB (clip)', () => {
            dsp.params.mode = 1;

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 10 * Math.sin(i * 0.1);
            }
            dsp.process();

            // Top LED (clip) should be lit
            expect(dsp.leds.L11).toBeGreaterThan(0.5);
        });
    });

    describe('reset', () => {
        it('should clear all LED states', () => {
            // Generate signal
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 5 * Math.sin(i * 0.1);
                dsp.inputs.R[i] = 5 * Math.cos(i * 0.1);
            }

            for (let j = 0; j < 30; j++) {
                dsp.process();
            }

            dsp.reset();

            for (let i = 0; i < 12; i++) {
                expect(dsp.leds[`L${i}`]).toBe(0);
                expect(dsp.leds[`R${i}`]).toBe(0);
            }
            expect(dsp.leds.peakL).toBe(0);
            expect(dsp.leds.peakR).toBe(0);
        });

        it('should reset internal averaging state', () => {
            // Build up some level
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.L[i] = 5 * Math.sin(i * 0.1);
            }
            for (let j = 0; j < 30; j++) {
                dsp.process();
            }

            dsp.reset();

            // Now process silence
            dsp.inputs.L.fill(0);
            dsp.process();

            // Should show no level (no residual from before reset)
            expect(dsp.leds.L8).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should not produce NaN in outputs', () => {
            const testInputs = [0, 5, -5, 10, -10, 0.001, -0.001];

            testInputs.forEach(val => {
                dsp.inputs.L.fill(val);
                dsp.inputs.R.fill(val);
                dsp.process();
            });

            expect(dsp.outputs.outL.some(v => Number.isNaN(v))).toBe(false);
            expect(dsp.outputs.outR.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should not produce NaN in LED values', () => {
            // Process various signals including edge cases
            const signals = [
                () => 0,
                () => Math.random() * 10 - 5,
                () => 10,
                () => -10,
                () => 0.0001
            ];

            signals.forEach(gen => {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.L[i] = gen();
                    dsp.inputs.R[i] = gen();
                }
                dsp.process();

                for (let i = 0; i < 12; i++) {
                    expect(Number.isNaN(dsp.leds[`L${i}`])).toBe(false);
                    expect(Number.isNaN(dsp.leds[`R${i}`])).toBe(false);
                }
            });
        });
    });

    describe('ui definition', () => {
        it('should have all 12 LEDs per channel defined', () => {
            for (let i = 0; i < 12; i++) {
                expect(dbModule.ui.leds).toContain(`L${i}`);
                expect(dbModule.ui.leds).toContain(`R${i}`);
            }
        });

        it('should have peak hold LEDs defined', () => {
            expect(dbModule.ui.leds).toContain('peakL');
            expect(dbModule.ui.leds).toContain('peakR');
        });

        it('should have stereo input jacks', () => {
            const inputs = dbModule.ui.inputs;
            expect(inputs.find(i => i.port === 'L')).toBeDefined();
            expect(inputs.find(i => i.port === 'R')).toBeDefined();
        });

        it('should have stereo output jacks (thru)', () => {
            const outputs = dbModule.ui.outputs;
            expect(outputs.find(o => o.port === 'outL')).toBeDefined();
            expect(outputs.find(o => o.port === 'outR')).toBeDefined();
        });

        it('should have mode switch', () => {
            const switches = dbModule.ui.switches;
            expect(switches.find(s => s.param === 'mode')).toBeDefined();
        });

        it('should have hold switch', () => {
            const switches = dbModule.ui.switches;
            expect(switches.find(s => s.param === 'hold')).toBeDefined();
        });
    });
});
