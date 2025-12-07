/**
 * Fold (Wavefolder) Module Tests
 *
 * Tests for wavefolder that adds harmonic complexity
 * by folding waveforms back on themselves.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import foldModule from '../../src/js/modules/fold/index.js';

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
        it('should create asymmetric folding with symmetry offset', () => {
            dsp.params.fold = 0.5;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(i * 0.1) * 3;
            }

            // Symmetric (centered)
            dsp.params.sym = 0;
            dsp.process();
            const centered = [...dsp.outputs.out];

            // Calculate mean (should be ~0 for symmetric)
            const centeredMean = centered.reduce((a, b) => a + b, 0) / bufferSize;

            // Asymmetric
            dsp.params.sym = 0.5;
            dsp.process();
            const offset = [...dsp.outputs.out];
            const offsetMean = offset.reduce((a, b) => a + b, 0) / bufferSize;

            // Asymmetric should have different DC content
            expect(Math.abs(offsetMean - centeredMean)).toBeGreaterThan(0);
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

            // Output should be bounded (sine folder naturally limits to ±1, scaled to ±5)
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out[i]).toBeGreaterThanOrEqual(-6);
                expect(dsp.outputs.out[i]).toBeLessThanOrEqual(6);
            }
        });
    });

    describe('Buffer Integrity', () => {
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
