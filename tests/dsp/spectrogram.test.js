/**
 * Tests for SPECTROGRAM - Frequency Over Time Module
 * 2D visualization of frequency content evolving over time
 */
import { describe, it, expect, beforeEach } from 'vitest';
import spectrogramModule from '../../src/js/modules/spectrogram/index.js';

describe('SPECTROGRAM - Frequency Over Time', () => {
    let dsp;
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 512;

    beforeEach(() => {
        dsp = spectrogramModule.createDSP({
            sampleRate: SAMPLE_RATE,
            bufferSize: BUFFER_SIZE
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(spectrogramModule.id).toBe('spectrogram');
        });

        it('should have correct name', () => {
            expect(spectrogramModule.name).toBe('SPECTRO');
        });

        it('should have correct HP width', () => {
            expect(spectrogramModule.hp).toBe(14);
        });

        it('should have utility category', () => {
            expect(spectrogramModule.category).toBe('utility');
        });

        it('should have render function for custom UI', () => {
            expect(typeof spectrogramModule.render).toBe('function');
        });
    });

    describe('initialization', () => {
        it('should create FFT history buffer', () => {
            expect(dsp.history).toBeDefined();
            expect(Array.isArray(dsp.history)).toBe(true);
            // History starts empty and is populated during processing
            expect(dsp.history.length).toBe(0);
        });

        it('should have default params', () => {
            expect(dsp.params.time).toBe(0.5);      // Time window
            expect(dsp.params.floor).toBe(0.5);    // dB floor
            expect(dsp.params.freeze).toBe(0);     // Running
        });

        it('should have audio input buffer', () => {
            expect(dsp.inputs.audio).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.audio.length).toBe(BUFFER_SIZE);
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

    describe('FFT history capture', () => {
        it('should accumulate FFT snapshots over time', () => {
            // Process several buffers
            for (let cycle = 0; cycle < 10; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
                }
                dsp.process();
            }

            // History should have data
            const historyCount = dsp.getHistoryCount();
            expect(historyCount).toBeGreaterThan(0);
        });

        it('should detect frequency in history', () => {
            const testFreq = 1000;
            const angularFreq = 2 * Math.PI * testFreq / SAMPLE_RATE;

            // Generate several buffers of sine wave
            for (let cycle = 0; cycle < 20; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    const t = cycle * BUFFER_SIZE + i;
                    dsp.inputs.audio[i] = Math.sin(angularFreq * t) * 5;
                }
                dsp.process();
            }

            // Get latest snapshot and check for peak at test frequency
            const snapshot = dsp.getLatestSnapshot();
            expect(snapshot).toBeDefined();
            expect(snapshot.length).toBeGreaterThan(0);

            // Find peak bin
            let maxMag = -Infinity;
            let peakBin = 0;
            for (let i = 1; i < snapshot.length; i++) {
                if (snapshot[i] > maxMag) {
                    maxMag = snapshot[i];
                    peakBin = i;
                }
            }

            // Check peak is near expected frequency
            const fftSize = dsp.getFFTSize();
            const binFreq = SAMPLE_RATE / fftSize;
            const expectedBin = Math.round(testFreq / binFreq);
            expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(3);
        });
    });

    describe('freeze mode', () => {
        it('should stop updating history when frozen', () => {
            // Capture some data
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dsp.process();

            const countBefore = dsp.getHistoryCount();

            // Freeze
            dsp.params.freeze = 1;

            // Process more data
            for (let cycle = 0; cycle < 5; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(i * 0.2) * 3;
                }
                dsp.process();
            }

            // History count should not have increased
            expect(dsp.getHistoryCount()).toBe(countBefore);
        });

        it('should resume updating when unfrozen', () => {
            dsp.params.freeze = 1;

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 5;
            }
            dsp.process();

            const frozenCount = dsp.getHistoryCount();

            // Unfreeze
            dsp.params.freeze = 0;

            for (let cycle = 0; cycle < 5; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = 3;
                }
                dsp.process();
            }

            expect(dsp.getHistoryCount()).toBeGreaterThan(frozenCount);
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
        it('should clear history', () => {
            for (let cycle = 0; cycle < 10; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.random() * 10 - 5;
                }
                dsp.process();
            }

            dsp.reset();

            expect(dsp.getHistoryCount()).toBe(0);
        });

        it('should reset LED state', () => {
            dsp.leds.signal = 0.8;
            dsp.reset();
            expect(dsp.leds.signal).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should not produce NaN values in output', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.random() * 20 - 10;
            }
            dsp.process();

            expect(dsp.outputs.out.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should not produce NaN values in snapshots', () => {
            for (let cycle = 0; cycle < 10; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.random() * 20 - 10;
                }
                dsp.process();
            }

            const snapshot = dsp.getLatestSnapshot();
            if (snapshot) {
                expect(snapshot.some(v => Number.isNaN(v))).toBe(false);
            }
        });
    });

    describe('time window', () => {
        it('should provide time window in seconds', () => {
            dsp.params.time = 0; // Minimum
            expect(dsp.getTimeWindow()).toBeCloseTo(2, 0);

            dsp.params.time = 1; // Maximum
            expect(dsp.getTimeWindow()).toBeCloseTo(30, 0);
        });
    });

    describe('snapshot export', () => {
        it('should provide snapshot data for export', () => {
            for (let cycle = 0; cycle < 10; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
                }
                dsp.process();
            }

            const exportData = dsp.getExportData();
            expect(exportData).toBeDefined();
            expect(exportData.history).toBeDefined();
            expect(exportData.timeWindow).toBeDefined();
            expect(exportData.fftSize).toBeDefined();
            expect(exportData.sampleRate).toBe(SAMPLE_RATE);
        });
    });

    describe('ui definition', () => {
        it('should have signal LED defined', () => {
            expect(spectrogramModule.ui.leds).toContain('signal');
        });

        it('should have audio input jack defined', () => {
            const audioInput = spectrogramModule.ui.inputs.find(i => i.port === 'audio');
            expect(audioInput).toBeDefined();
            expect(audioInput.type).toBe('audio');
        });

        it('should have output jack defined', () => {
            const out = spectrogramModule.ui.outputs.find(o => o.port === 'out');
            expect(out).toBeDefined();
        });
    });
});
