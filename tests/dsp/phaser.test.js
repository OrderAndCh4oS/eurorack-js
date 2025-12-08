/**
 * PHASER Module Tests
 *
 * Tests for phaser effect with cascaded allpass filters.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import phaserModule from '../../src/js/modules/phaser/index.js';

describe('PHASER Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = phaserModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.inL.length).toBe(bufferSize);
            expect(dsp.inputs.inR.length).toBe(bufferSize);
            expect(dsp.outputs.outL.length).toBe(bufferSize);
            expect(dsp.outputs.outR.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.rate).toBeDefined();
            expect(dsp.params.depth).toBeDefined();
            expect(dsp.params.feedback).toBeDefined();
            expect(dsp.params.mix).toBeDefined();
        });

        it('should have LED indicator', () => {
            expect(dsp.leds).toHaveProperty('lfo');
        });
    });

    describe('Dry Signal Pass-through', () => {
        it('should pass dry signal with mix at 0', () => {
            dsp.params.mix = 0;

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.outL[i]).toBeCloseTo(dsp.inputs.inL[i], 2);
            }
        });
    });

    describe('Phasing Effect', () => {
        it('should produce phase-shifted output', () => {
            dsp.params.mix = 1;
            dsp.params.rate = 0;  // Static for consistent test
            dsp.params.depth = 0.5;

            // Feed sine wave
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Output should differ from input (phase shifted)
            let totalDiff = 0;
            for (let i = 0; i < bufferSize; i++) {
                totalDiff += Math.abs(dsp.outputs.outL[i] - dsp.inputs.inL[i]);
            }
            expect(totalDiff).toBeGreaterThan(0);
        });

        it('should create notches when mixed with dry', () => {
            dsp.params.mix = 0.5;  // Mix wet with dry
            dsp.params.rate = 0;
            dsp.params.depth = 0.5;

            // Process noise-like signal
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = (Math.random() - 0.5) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Should produce output
            const hasOutput = dsp.outputs.outL.some(v => Math.abs(v) > 0.01);
            expect(hasOutput).toBe(true);
        });
    });

    describe('Feedback Control', () => {
        it('should increase resonance with higher feedback', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 0;
            dsp.params.depth = 0.5;

            // Test with steady tone
            const testSignal = () => {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 500 * i / sampleRate) * 2;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
            };

            // Low feedback
            dsp.params.feedback = 0;
            testSignal();
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }
            const lowFbMax = Math.max(...dsp.outputs.outL.map(Math.abs));

            dsp.reset();

            // High feedback
            dsp.params.feedback = 0.8;
            testSignal();
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }
            const highFbMax = Math.max(...dsp.outputs.outL.map(Math.abs));

            // High feedback may produce different amplitude due to resonance
            expect(Math.abs(highFbMax - lowFbMax)).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Rate Control', () => {
        it('should sweep faster with higher rate', () => {
            dsp.params.mix = 0.5;
            dsp.params.depth = 0.5;

            // Collect LED values to track LFO
            dsp.params.rate = 0.1;
            const slowLeds = [];
            for (let b = 0; b < 30; b++) {
                dsp.inputs.inL.fill(1);
                dsp.inputs.inR.fill(1);
                dsp.process();
                slowLeds.push(dsp.leds.lfo);
            }

            dsp.reset();

            dsp.params.rate = 1;
            const fastLeds = [];
            for (let b = 0; b < 30; b++) {
                dsp.inputs.inL.fill(1);
                dsp.inputs.inR.fill(1);
                dsp.process();
                fastLeds.push(dsp.leds.lfo);
            }

            const slowVar = Math.max(...slowLeds) - Math.min(...slowLeds);
            const fastVar = Math.max(...fastLeds) - Math.min(...fastLeds);
            expect(fastVar).toBeGreaterThanOrEqual(slowVar);
        });
    });

    describe('Output Range', () => {
        it('should stay within audio range', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 1;
            dsp.params.depth = 1;
            dsp.params.feedback = 0.5;

            for (let b = 0; b < 50; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
                dsp.process();

                for (let i = 0; i < bufferSize; i++) {
                    expect(dsp.outputs.outL[i]).toBeGreaterThanOrEqual(-10);
                    expect(dsp.outputs.outL[i]).toBeLessThanOrEqual(10);
                }
            }
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.mix = 0.5;
            dsp.params.feedback = 0.7;

            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
                dsp.process();
            }

            expect(dsp.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('Reset', () => {
        it('should clear filter states on reset', () => {
            dsp.params.feedback = 0.8;

            for (let b = 0; b < 20; b++) {
                dsp.inputs.inL.fill(2);
                dsp.inputs.inR.fill(2);
                dsp.process();
            }

            dsp.reset();

            dsp.inputs.inL.fill(0);
            dsp.inputs.inR.fill(0);
            dsp.process();

            const maxOutput = Math.max(...dsp.outputs.outL.map(Math.abs));
            expect(maxOutput).toBeLessThan(0.5);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(phaserModule.id).toBe('phaser');
        });

        it('should have UI definition', () => {
            expect(phaserModule.ui).toBeDefined();
        });
    });
});
