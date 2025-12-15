/**
 * Tests for PLOT - Waveform Plotter Module
 * Time-domain amplitude visualization over seconds
 */
import { describe, it, expect, beforeEach } from 'vitest';
import plotModule from '../../src/js/modules/plot/index.js';

describe('PLOT - Waveform Plotter', () => {
    let dsp;
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 512;

    beforeEach(() => {
        dsp = plotModule.createDSP({
            sampleRate: SAMPLE_RATE,
            bufferSize: BUFFER_SIZE
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(plotModule.id).toBe('plot');
        });

        it('should have correct name', () => {
            expect(plotModule.name).toBe('PLOT');
        });

        it('should have correct HP width', () => {
            expect(plotModule.hp).toBe(12);
        });

        it('should have utility category', () => {
            expect(plotModule.category).toBe('utility');
        });

        it('should have render function for custom UI', () => {
            expect(typeof plotModule.render).toBe('function');
        });
    });

    describe('initialization', () => {
        it('should create display buffer for waveform data', () => {
            expect(dsp.displayBuffer).toBeInstanceOf(Float32Array);
            expect(dsp.displayBuffer.length).toBeGreaterThan(0);
        });

        it('should have default params', () => {
            expect(dsp.params.time).toBe(0.5);      // Time window
            expect(dsp.params.freeze).toBe(0);      // Running
        });

        it('should have audio input buffer', () => {
            expect(dsp.inputs.audio).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.audio.length).toBe(BUFFER_SIZE);
        });

        it('should have trigger input buffer', () => {
            expect(dsp.inputs.trig).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.trig.length).toBe(BUFFER_SIZE);
        });

        it('should have passthrough output buffer', () => {
            expect(dsp.outputs.out).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.out.length).toBe(BUFFER_SIZE);
        });

        it('should have signal LED state', () => {
            expect(dsp.leds.signal).toBe(0);
        });
    });

    describe('passthrough', () => {
        it('should pass input audio to output unchanged', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }

            dsp.process();

            for (let i = 0; i < BUFFER_SIZE; i++) {
                expect(dsp.outputs.out[i]).toBe(dsp.inputs.audio[i]);
            }
        });
    });

    describe('waveform capture', () => {
        it('should capture audio to display buffer', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.01) * 3;
            }

            dsp.process();

            // Display buffer should have non-zero values
            let hasNonZero = false;
            for (let i = 0; i < dsp.displayBuffer.length; i++) {
                if (dsp.displayBuffer[i] !== 0) {
                    hasNonZero = true;
                    break;
                }
            }
            expect(hasNonZero).toBe(true);
        });

        it('should downsample to fit display buffer', () => {
            // Fill with recognizable pattern
            for (let cycle = 0; cycle < 100; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = 5; // Constant value
                }
                dsp.process();
            }

            // Check display buffer captured the value
            const avgValue = dsp.displayBuffer.reduce((a, b) => a + b, 0) / dsp.displayBuffer.length;
            expect(avgValue).toBeGreaterThan(0);
        });
    });

    describe('freeze mode', () => {
        it('should stop updating display when frozen', () => {
            // Capture some data
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 5;
            }
            dsp.process();

            // Freeze
            dsp.params.freeze = 1;

            // Get current display state
            const frozenData = new Float32Array(dsp.displayBuffer);

            // Process more data
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = -5;
            }
            dsp.process();

            // Display should be unchanged
            expect(dsp.displayBuffer).toEqual(frozenData);
        });

        it('should resume updating when unfrozen', () => {
            dsp.params.freeze = 1;

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 5;
            }
            dsp.process();

            const frozenData = new Float32Array(dsp.displayBuffer);

            // Unfreeze
            dsp.params.freeze = 0;

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 3;
            }
            dsp.process();

            // Display should have changed
            let changed = false;
            for (let i = 0; i < dsp.displayBuffer.length; i++) {
                if (dsp.displayBuffer[i] !== frozenData[i]) {
                    changed = true;
                    break;
                }
            }
            expect(changed).toBe(true);
        });
    });

    describe('trigger capture', () => {
        it('should capture on trigger rising edge', () => {
            // Reset to known state
            dsp.reset();

            // Send trigger with audio
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 2;
                dsp.inputs.trig[i] = i < BUFFER_SIZE / 2 ? 0 : 5; // Rising edge mid-buffer
            }
            dsp.process();

            // Should have captured
            expect(dsp.isCapturing()).toBe(true);
        });
    });

    describe('statistics', () => {
        it('should calculate peak amplitude', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 4;
            }
            dsp.process();

            const stats = dsp.getStats();
            expect(stats.peakPos).toBeCloseTo(4, 0);
            expect(stats.peakNeg).toBeCloseTo(-4, 0);
        });

        it('should calculate RMS level', () => {
            // Constant value for predictable RMS
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 3;
            }
            dsp.process();

            const stats = dsp.getStats();
            expect(stats.rms).toBeCloseTo(3, 1);
        });

        it('should calculate DC offset', () => {
            // Signal with DC offset
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 2 + Math.sin(i * 0.1) * 0.5;
            }
            dsp.process();

            const stats = dsp.getStats();
            expect(stats.dc).toBeCloseTo(2, 0);
        });
    });

    describe('LED indicator', () => {
        it('should show zero when no signal', () => {
            dsp.inputs.audio.fill(0);
            dsp.process();
            expect(dsp.leds.signal).toBe(0);
        });

        it('should reflect signal level', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 5 * Math.sin(i * 0.1);
            }
            dsp.process();
            expect(dsp.leds.signal).toBeGreaterThan(0);
        });
    });

    describe('reset', () => {
        it('should clear display buffer', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.random() * 10 - 5;
            }
            dsp.process();

            dsp.reset();

            expect(dsp.displayBuffer.every(v => v === 0)).toBe(true);
        });

        it('should reset statistics', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 5;
            }
            dsp.process();

            dsp.reset();

            const stats = dsp.getStats();
            expect(stats.peakPos).toBe(0);
            expect(stats.peakNeg).toBe(0);
            expect(stats.rms).toBe(0);
        });

        it('should reset LED state', () => {
            dsp.leds.signal = 0.8;
            dsp.reset();
            expect(dsp.leds.signal).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should not produce NaN values in display buffer', () => {
            const testInputs = [
                () => 0,
                () => 10,
                () => -10,
                () => Math.random() * 20 - 10,
            ];

            testInputs.forEach(generator => {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = generator();
                }
                dsp.process();
            });

            expect(dsp.displayBuffer.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should not produce NaN values in output', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.random() * 20 - 10;
            }
            dsp.process();

            expect(dsp.outputs.out.some(v => Number.isNaN(v))).toBe(false);
        });
    });

    describe('time window', () => {
        it('should provide time window in seconds', () => {
            dsp.params.time = 0; // Minimum
            expect(dsp.getTimeWindow()).toBeCloseTo(1, 0);

            dsp.params.time = 1; // Maximum
            expect(dsp.getTimeWindow()).toBeCloseTo(10, 0);

            dsp.params.time = 0.5; // Middle
            expect(dsp.getTimeWindow()).toBeGreaterThan(1);
            expect(dsp.getTimeWindow()).toBeLessThan(10);
        });
    });

    describe('ui definition', () => {
        it('should have signal LED defined', () => {
            expect(plotModule.ui.leds).toContain('signal');
        });

        it('should have audio input jack defined', () => {
            const audioInput = plotModule.ui.inputs.find(i => i.port === 'audio');
            expect(audioInput).toBeDefined();
            expect(audioInput.type).toBe('audio');
        });

        it('should have trigger input jack defined', () => {
            const trigInput = plotModule.ui.inputs.find(i => i.port === 'trig');
            expect(trigInput).toBeDefined();
        });

        it('should have output jack defined', () => {
            const out = plotModule.ui.outputs.find(o => o.port === 'out');
            expect(out).toBeDefined();
        });
    });
});
