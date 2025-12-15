/**
 * Tests for SPECTRUM - Spectrum Analyzer Module
 * FFT-based frequency visualization for evaluating synthesis quality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import spectrumModule from '../../src/js/modules/spectrum/index.js';

describe('SPECTRUM - Spectrum Analyzer', () => {
    let dsp;
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 512;

    beforeEach(() => {
        dsp = spectrumModule.createDSP({
            sampleRate: SAMPLE_RATE,
            bufferSize: BUFFER_SIZE
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(spectrumModule.id).toBe('spectrum');
        });

        it('should have correct name', () => {
            expect(spectrumModule.name).toBe('SPECTRUM');
        });

        it('should have correct HP width', () => {
            expect(spectrumModule.hp).toBe(12);
        });

        it('should have utility category', () => {
            expect(spectrumModule.category).toBe('utility');
        });

        it('should have render function for custom UI', () => {
            expect(typeof spectrumModule.render).toBe('function');
        });
    });

    describe('initialization', () => {
        it('should create FFT magnitude buffer', () => {
            expect(dsp.magnitudes).toBeInstanceOf(Float32Array);
            // FFT output is half the FFT size (Nyquist)
            expect(dsp.magnitudes.length).toBeGreaterThan(0);
        });

        it('should have default params', () => {
            expect(dsp.params.floor).toBe(0.5);    // dB floor
            expect(dsp.params.decay).toBe(0.5);    // Peak decay
            expect(dsp.params.scale).toBe(0);      // 0=log, 1=linear
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

    describe('FFT analysis', () => {
        it('should detect a single frequency peak', () => {
            const testFreq = 1000; // 1kHz test tone
            const angularFreq = 2 * Math.PI * testFreq / SAMPLE_RATE;

            // Generate several buffers of sine wave to fill FFT
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    const t = cycle * BUFFER_SIZE + i;
                    dsp.inputs.audio[i] = Math.sin(angularFreq * t) * 5;
                }
                dsp.process();
            }

            // Find the peak bin
            let maxMag = -Infinity;
            let peakBin = 0;
            for (let i = 1; i < dsp.magnitudes.length; i++) {
                if (dsp.magnitudes[i] > maxMag) {
                    maxMag = dsp.magnitudes[i];
                    peakBin = i;
                }
            }

            // Calculate expected bin for 1kHz
            const fftSize = dsp.getFFTSize();
            const binFreq = SAMPLE_RATE / fftSize;
            const expectedBin = Math.round(testFreq / binFreq);

            // Peak should be within 2 bins of expected
            expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(2);
        });

        it('should show higher magnitude for louder signals', () => {
            const testFreq = 440;
            const angularFreq = 2 * Math.PI * testFreq / SAMPLE_RATE;

            // Quiet signal
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(angularFreq * (cycle * BUFFER_SIZE + i)) * 0.5;
                }
                dsp.process();
            }
            const quietMax = Math.max(...dsp.magnitudes);

            // Reset and do loud signal
            dsp.reset();
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(angularFreq * (cycle * BUFFER_SIZE + i)) * 5;
                }
                dsp.process();
            }
            const loudMax = Math.max(...dsp.magnitudes);

            expect(loudMax).toBeGreaterThan(quietMax);
        });

        it('should detect multiple frequency components', () => {
            const freq1 = 440;  // A4
            const freq2 = 880;  // A5 (octave higher)
            const angularFreq1 = 2 * Math.PI * freq1 / SAMPLE_RATE;
            const angularFreq2 = 2 * Math.PI * freq2 / SAMPLE_RATE;

            // Generate sum of two sines
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    const t = cycle * BUFFER_SIZE + i;
                    dsp.inputs.audio[i] = Math.sin(angularFreq1 * t) * 2 + Math.sin(angularFreq2 * t) * 2;
                }
                dsp.process();
            }

            const fftSize = dsp.getFFTSize();
            const binFreq = SAMPLE_RATE / fftSize;
            const bin1 = Math.round(freq1 / binFreq);
            const bin2 = Math.round(freq2 / binFreq);

            // Both frequency bins should have significant energy
            // Find local maxima near expected bins
            const searchRange = 3;
            let peak1 = 0, peak2 = 0;
            for (let i = Math.max(0, bin1 - searchRange); i <= Math.min(dsp.magnitudes.length - 1, bin1 + searchRange); i++) {
                peak1 = Math.max(peak1, dsp.magnitudes[i]);
            }
            for (let i = Math.max(0, bin2 - searchRange); i <= Math.min(dsp.magnitudes.length - 1, bin2 + searchRange); i++) {
                peak2 = Math.max(peak2, dsp.magnitudes[i]);
            }

            // Both peaks should be significantly above the noise floor (magnitudes are in dB)
            // Noise floor is around -100dB, significant peaks should be > -40dB
            expect(peak1).toBeGreaterThan(-40);
            expect(peak2).toBeGreaterThan(-40);
        });
    });

    describe('peak decay', () => {
        it('should have peak hold that decays over time', () => {
            const testFreq = 1000;
            const angularFreq = 2 * Math.PI * testFreq / SAMPLE_RATE;

            // Generate signal
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(angularFreq * (cycle * BUFFER_SIZE + i)) * 5;
                }
                dsp.process();
            }

            const peakAfterSignal = Math.max(...dsp.peaks);

            // Now process silence
            dsp.inputs.audio.fill(0);
            for (let i = 0; i < 10; i++) {
                dsp.process();
            }

            const peakAfterSilence = Math.max(...dsp.peaks);

            // Peaks should decay
            expect(peakAfterSilence).toBeLessThan(peakAfterSignal);
        });

        it('should decay faster with higher decay param', () => {
            const testFreq = 1000;
            const angularFreq = 2 * Math.PI * testFreq / SAMPLE_RATE;

            // Test with slow decay
            dsp.params.decay = 0.2;
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(angularFreq * (cycle * BUFFER_SIZE + i)) * 5;
                }
                dsp.process();
            }
            dsp.inputs.audio.fill(0);
            for (let i = 0; i < 5; i++) dsp.process();
            const slowDecayPeak = Math.max(...dsp.peaks);

            // Reset and test with fast decay
            dsp.reset();
            dsp.params.decay = 0.9;
            for (let cycle = 0; cycle < 4; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.audio[i] = Math.sin(angularFreq * (cycle * BUFFER_SIZE + i)) * 5;
                }
                dsp.process();
            }
            dsp.inputs.audio.fill(0);
            for (let i = 0; i < 5; i++) dsp.process();
            const fastDecayPeak = Math.max(...dsp.peaks);

            // Fast decay should result in lower remaining peak
            expect(fastDecayPeak).toBeLessThan(slowDecayPeak);
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

        it('should scale LED to +-10V range', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = 10 * Math.sin(i * 0.1);
            }
            dsp.process();
            expect(dsp.leds.signal).toBeCloseTo(1, 1);
        });
    });

    describe('reset', () => {
        it('should clear magnitude buffer', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.random() * 10 - 5;
            }
            dsp.process();

            dsp.reset();

            expect(dsp.magnitudes.every(v => v === 0)).toBe(true);
        });

        it('should clear peaks buffer', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.random() * 10 - 5;
            }
            dsp.process();

            dsp.reset();

            expect(dsp.peaks.every(v => v === 0)).toBe(true);
        });

        it('should reset LED state', () => {
            dsp.leds.signal = 0.8;
            dsp.reset();
            expect(dsp.leds.signal).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should not produce NaN values in magnitudes', () => {
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

            expect(dsp.magnitudes.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should not produce NaN values in output', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.random() * 20 - 10;
            }
            dsp.process();

            expect(dsp.outputs.out.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should produce magnitude values in valid dB range', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dsp.process();

            // Magnitudes are in dB, valid range is roughly -100dB to +20dB
            expect(dsp.magnitudes.every(v => v >= -120 && v <= 20)).toBe(true);
        });
    });

    describe('ui definition', () => {
        it('should have signal LED defined', () => {
            expect(spectrumModule.ui.leds).toContain('signal');
        });

        it('should have audio input jack defined', () => {
            const audioInput = spectrumModule.ui.inputs.find(i => i.port === 'audio');
            expect(audioInput).toBeDefined();
            expect(audioInput.type).toBe('audio');
        });

        it('should have output jack defined', () => {
            const out = spectrumModule.ui.outputs.find(o => o.port === 'out');
            expect(out).toBeDefined();
        });
    });

    describe('frequency helpers', () => {
        it('should provide bin to frequency conversion', () => {
            const fftSize = dsp.getFFTSize();
            const binFreq = SAMPLE_RATE / fftSize;

            // Bin 10 should be at 10 * binFreq Hz
            const freq = dsp.binToFreq(10);
            expect(freq).toBeCloseTo(10 * binFreq, 1);
        });

        it('should provide frequency to bin conversion', () => {
            const testFreq = 1000;
            const bin = dsp.freqToBin(testFreq);
            const fftSize = dsp.getFFTSize();
            const expectedBin = Math.round(testFreq * fftSize / SAMPLE_RATE);
            expect(bin).toBe(expectedBin);
        });
    });
});
