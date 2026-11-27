/**
 * Fold (Wavefolder) Module Tests
 *
 * Tests for wavefolder that adds harmonic complexity
 * by folding waveforms back on themselves.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import foldModule from '../../src/js/modules/fold/index.js';
import { createRealFft } from '../../src/js/utils/fft.js';

describe('Fold Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = foldModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.audio.length).toBe(bufferSize);
            expect(dsp.inputs.foldCV.length).toBe(bufferSize);
            expect(dsp.inputs.symCV.length).toBe(bufferSize);
            expect(dsp.outputs.out.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.fold).toBeDefined();
            expect(dsp.params.sym).toBeDefined();
        });

        it('should initialize with zero output when no input', () => {
            dsp.process();
            expect(dsp.outputs.out.every(v => v === 0)).toBe(true);
        });
    });

    describe('Clean Pass-through', () => {
        it('should pass signal with minimal change at minimum fold', () => {
            dsp.params.fold = 0;
            // Low amplitude sine
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 2;
            }
            dsp.process();

            // At minimum fold (drive=1), sine wavefolder still applies sin(x*PI)
            // Output should still track input shape, just with some nonlinearity
            // Check that output follows input direction (correlation)
            let sameDirection = 0;
            for (let i = 1; i < bufferSize; i++) {
                const inputDelta = dsp.inputs.audio[i] - dsp.inputs.audio[i-1];
                const outputDelta = dsp.outputs.out[i] - dsp.outputs.out[i-1];
                if ((inputDelta >= 0 && outputDelta >= 0) || (inputDelta < 0 && outputDelta < 0)) {
                    sameDirection++;
                }
            }
            // At minimum fold, output should mostly follow input direction
            expect(sameDirection / (bufferSize - 1)).toBeGreaterThan(0.7);
        });
    });

    describe('Wavefolding Behavior', () => {
        it('should fold signal at high fold amounts', () => {
            dsp.params.fold = 1;
            // High amplitude to trigger folding
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dsp.process();

            // Output should differ from input due to folding
            let differences = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (Math.abs(dsp.outputs.out[i] - dsp.inputs.audio[i]) > 0.1) {
                    differences++;
                }
            }
            expect(differences).toBeGreaterThan(bufferSize * 0.3);
        });

        it('should increase harmonic content with higher fold', () => {
            // Test with pure sine
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.05) * 3;
            }

            // Low fold
            dsp.params.fold = 0.2;
            dsp.process();
            const lowFoldOutput = [...dsp.outputs.out];

            // High fold
            dsp.params.fold = 0.8;
            dsp.process();
            const highFoldOutput = [...dsp.outputs.out];

            // Calculate zero crossings (more = more harmonics)
            const countZeroCrossings = (arr) => {
                let crossings = 0;
                for (let i = 1; i < arr.length; i++) {
                    if ((arr[i] >= 0 && arr[i-1] < 0) || (arr[i] < 0 && arr[i-1] >= 0)) {
                        crossings++;
                    }
                }
                return crossings;
            };

            const lowCrossings = countZeroCrossings(lowFoldOutput);
            const highCrossings = countZeroCrossings(highFoldOutput);

            // Higher fold should have more zero crossings (more harmonics)
            expect(highCrossings).toBeGreaterThanOrEqual(lowCrossings);
        });

        it('suppresses folded harmonics that would reflect below Nyquist', () => {
            const fftSize = 4096;
            const auditSampleRate = 16384;
            const frequency = 3072;
            const amplitude = 4;
            const drive = 7;
            const auditDSP = foldModule.createDSP({
                sampleRate: auditSampleRate,
                bufferSize: fftSize
            });
            const naive = new Float32Array(fftSize);

            auditDSP.params.fold = (drive - 1) / 9;
            for (let i = 0; i < fftSize; i++) {
                const input = Math.sin(2 * Math.PI * frequency * i / auditSampleRate) * amplitude;
                auditDSP.inputs.audio[i] = input;
                naive[i] = Math.sin(drive * input / 5 * Math.PI) * 5;
            }
            auditDSP.process();

            const fft = createRealFft({ size: fftSize });
            const spectrum = new Float32Array(fftSize / 2);
            const naiveSpectrum = new Float32Array(fftSize / 2);
            fft.analyzeCircular(auditDSP.outputs.out, 0, spectrum);
            fft.analyzeCircular(naive, 0, naiveSpectrum);

            // At this coherent test frequency, upper odd harmonics reflect into
            // the 1, 5, and 7 kHz bins. Compare their combined linear power.
            const aliasBins = [1024, 5120, 7168]
                .map(aliasFrequency => aliasFrequency * fftSize / auditSampleRate);
            const aliasPower = bins => aliasBins.reduce(
                (sum, bin) => sum + Math.pow(10, bins[bin] / 10),
                0
            );

            expect(aliasPower(spectrum)).toBeLessThan(aliasPower(naiveSpectrum) * 0.35);
        });
    });

    describe('CV Modulation', () => {
        it('should respond to fold CV', () => {
            dsp.params.fold = 0.3;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 3;
            }

            // Without CV
            dsp.inputs.foldCV.fill(0);
            dsp.process();
            const withoutCV = [...dsp.outputs.out];

            // With positive CV
            dsp.inputs.foldCV.fill(5);
            dsp.process();
            const withCV = [...dsp.outputs.out];

            // Outputs should differ
            let differences = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (Math.abs(withCV[i] - withoutCV[i]) > 0.01) {
                    differences++;
                }
            }
            expect(differences).toBeGreaterThan(0);
        });

        it('declares bipolar CV ranges with a 0V normal', () => {
            for (const port of ['foldCV', 'symCV']) {
                expect(foldModule.ui.inputs.find(input => input.port === port).voltage).toEqual({
                    min: -5,
                    max: 5,
                    normal: 0
                });
            }
        });

        it('should respond to symmetry CV', () => {
            dsp.params.fold = 0.5;
            dsp.params.sym = 0;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 3;
            }

            // Without symmetry CV
            dsp.inputs.symCV.fill(0);
            dsp.process();
            const symmetric = [...dsp.outputs.out];

            // With symmetry CV (adds DC offset)
            dsp.inputs.symCV.fill(2);
            dsp.process();
            const asymmetric = [...dsp.outputs.out];

            // Outputs should differ
            let differences = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (Math.abs(asymmetric[i] - symmetric[i]) > 0.01) {
                    differences++;
                }
            }
            expect(differences).toBeGreaterThan(0);
        });
    });

    describe('Symmetry Control', () => {
        it('keeps the even harmonics of asymmetric folding while rejecting the steady offset', () => {
            dsp.params.fold = 0.3;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = 0.8 * Math.sin(2 * Math.PI * i / bufferSize);
            }
            for (const sym of [0, 0.18]) {
                dsp.params.sym = sym;
                for (let block = 0; block < 100; block++) dsp.process();
                const cycle = dsp.outputs.out;
                const mean = cycle.reduce((sum, value) => sum + value, 0) / bufferSize;
                expect(Math.abs(mean)).toBeLessThan(0.001);

                // Adding opposite halves of a complete cycle cancels its odd harmonics.
                const evenPeak = Math.max(...cycle.map((value, i) =>
                    Math.abs((value + cycle[(i + bufferSize / 2) % bufferSize]) / 2)));
                if (sym === 0) expect(evenPeak).toBeLessThan(0.001);
                else expect(evenPeak).toBeGreaterThan(0.5);
            }
        });
    });

    describe('Output coupling', () => {
        it.each([44100, 48000, 96000])('starts silent with bias and rejects a sustained CV change at %i Hz', rate => {
            for (const size of [128, 512]) {
                const folder = foldModule.createDSP({ sampleRate: rate, bufferSize: size });
                folder.params.fold = 1;
                folder.params.sym = 0.35;
                folder.process();
                expect(folder.outputs.out.every(value => value === 0)).toBe(true);

                // Reverse the silent operating point from −4.76 V to +4.76 V.
                folder.params.sym = 0;
                folder.inputs.symCV.fill(-1.75);
                let peak = 0;
                for (let elapsed = 0; elapsed < 0.16 * rate; elapsed += size) {
                    folder.process();
                    for (const value of folder.outputs.out) peak = Math.max(peak, Math.abs(value));
                }
                expect(peak).toBeGreaterThan(4.5);
                expect(peak).toBeLessThanOrEqual(5);
                expect(folder.outputs.out.every(value => Math.abs(value) < 0.0001)).toBe(true);

                folder.reset();
                folder.process();
                expect(folder.outputs.out.every(value => value === 0)).toBe(true);
            }
        });

        it.each([[18, Math.SQRT1_2], [72, 0.970]])('preserves the expected small-signal gain at %i Hz', (hz, gain) => {
            const rate = 48000;
            const folder = foldModule.createDSP({ sampleRate: rate, bufferSize });
            folder.params.fold = 0;
            let energy = 0;
            for (let start = 0; start < rate; start += bufferSize) {
                for (let i = 0; i < bufferSize; i++) {
                    folder.inputs.audio[i] = 0.01 * Math.sin(2 * Math.PI * hz * (start + i) / rate);
                }
                folder.process();
                for (let i = 0; i < bufferSize; i++) {
                    if (start + i >= rate / 2) energy += folder.outputs.out[i] ** 2;
                }
            }
            // The sine folder's small-signal gain at minimum drive is π.
            const amplitude = Math.sqrt(2 * energy / (rate / 2));
            expect(amplitude / (0.01 * Math.PI)).toBeCloseTo(gain, 2);
        });
    });

    describe('Output Range', () => {
        it('should keep output within audio range', () => {
            dsp.params.fold = 1;
            // Large input
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 10;
            }
            dsp.process();

            expect(Math.min(...dsp.outputs.out)).toBeGreaterThanOrEqual(-5);
            expect(Math.max(...dsp.outputs.out)).toBeLessThanOrEqual(5);
        });
    });

    describe('Buffer Integrity', () => {
        it('recovers from a non-finite CV sample when the panel starts', () => {
            dsp.inputs.symCV[0] = NaN;
            for (let i = 0; i < bufferSize; i++) dsp.inputs.audio[i] = Math.sin(i * 0.1);
            dsp.process();
            expect(dsp.outputs.out.every(Number.isFinite)).toBe(true);
            expect(dsp.outputs.out.some(value => Math.abs(value) > 0.1)).toBe(true);
        });

        it('should produce no NaN values', () => {
            dsp.params.fold = 0.7;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 5;
            }
            dsp.process();
            expect(dsp.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.params.fold = 0.5;
            dsp.inputs.audio.fill(1);
            dsp.process();

            // Should have processed all samples
            let processed = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (dsp.outputs.out[i] !== 0) processed++;
            }
            expect(processed).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear output on reset', () => {
            dsp.inputs.audio.fill(3);
            dsp.params.fold = 0.5;
            dsp.process();

            dsp.reset();

            expect(dsp.outputs.out.every(v => v === 0)).toBe(true);
        });

        it('clears stable inputs without replacing their buffers', () => {
            const inputs = { ...dsp.inputs };
            Object.values(dsp.inputs).forEach(input => input.fill(3));
            dsp.reset();

            Object.entries(inputs).forEach(([port, input]) => {
                expect(dsp.inputs[port]).toBe(input);
                expect(input.every(value => value === 0)).toBe(true);
            });
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(foldModule.id).toBe('fold');
        });

        it('should have correct HP width', () => {
            expect(foldModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(foldModule.ui).toBeDefined();
            expect(foldModule.ui.knobs).toBeDefined();
            expect(foldModule.ui.inputs).toBeDefined();
            expect(foldModule.ui.outputs).toBeDefined();
        });

        it('should define fold and sym knobs', () => {
            const knobParams = foldModule.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('fold');
            expect(knobParams).toContain('sym');
        });

        it('should define correct inputs', () => {
            const inputPorts = foldModule.ui.inputs.map(i => i.port);
            expect(inputPorts).toContain('audio');
            expect(inputPorts).toContain('foldCV');
            expect(inputPorts).toContain('symCV');
        });

        it('should define correct outputs', () => {
            const outputPorts = foldModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('out');
        });
    });
});
