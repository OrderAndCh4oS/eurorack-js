/**
 * CHORUS Module Tests
 *
 * Tests for stereo chorus effect with modulated delay lines.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import chorusModule from '../../src/js/modules/chorus/index.js';

describe('CHORUS Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = chorusModule.createDSP({ sampleRate, bufferSize });
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
            expect(dsp.params.mix).toBeDefined();
        });

        it('should have LED indicator', () => {
            expect(dsp.leds).toHaveProperty('lfo');
        });
    });

    describe('Dry Signal Pass-through', () => {
        it('should pass dry signal with mix at 0', () => {
            dsp.params.mix = 0;

            // Feed sine wave
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            dsp.process();

            // Output should match input
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.outL[i]).toBeCloseTo(dsp.inputs.inL[i], 2);
            }
        });
    });

    describe('Wet Signal', () => {
        it('should produce modulated output with mix at 1', () => {
            dsp.params.mix = 1;
            dsp.params.rate = 0.5;
            dsp.params.depth = 0.5;

            // Feed constant signal
            dsp.inputs.inL.fill(1);
            dsp.inputs.inR.fill(1);

            // Process multiple buffers to let delay fill
            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            // Output should exist
            expect(Math.abs(dsp.outputs.outL[bufferSize - 1])).toBeGreaterThan(0);
        });

        it('should create stereo width', () => {
            dsp.params.mix = 1;
            dsp.params.rate = 1;
            dsp.params.depth = 0.5;

            // Feed mono signal
            for (let i = 0; i < bufferSize; i++) {
                const sample = Math.sin(2 * Math.PI * 100 * i / sampleRate) * 2;
                dsp.inputs.inL[i] = sample;
                dsp.inputs.inR[i] = sample;
            }

            // Process to let modulation create difference
            for (let b = 0; b < 50; b++) {
                dsp.process();
            }

            // L and R should differ due to phase offset
            let hasDifference = false;
            for (let i = 0; i < bufferSize; i++) {
                if (Math.abs(dsp.outputs.outL[i] - dsp.outputs.outR[i]) > 0.01) {
                    hasDifference = true;
                    break;
                }
            }
            expect(hasDifference).toBe(true);
        });
    });

    describe('Rate Control', () => {
        it('should modulate faster with higher rate', () => {
            dsp.params.mix = 1;
            dsp.params.depth = 0.5;

            // Slow rate - collect LED values
            dsp.params.rate = 0.1;
            const slowLeds = [];
            for (let b = 0; b < 20; b++) {
                dsp.inputs.inL.fill(1);
                dsp.inputs.inR.fill(1);
                dsp.process();
                slowLeds.push(dsp.leds.lfo);
            }

            dsp.reset();

            // Fast rate
            dsp.params.rate = 1;
            const fastLeds = [];
            for (let b = 0; b < 20; b++) {
                dsp.inputs.inL.fill(1);
                dsp.inputs.inR.fill(1);
                dsp.process();
                fastLeds.push(dsp.leds.lfo);
            }

            // Fast rate should have more variation
            const slowVariation = Math.max(...slowLeds) - Math.min(...slowLeds);
            const fastVariation = Math.max(...fastLeds) - Math.min(...fastLeds);
            expect(fastVariation).toBeGreaterThanOrEqual(slowVariation);
        });
    });

    describe('Depth Control', () => {
        it('should have more modulation with higher depth', () => {
            dsp.params.mix = 1;
            dsp.params.rate = 2;

            // Feed steady signal
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }

            // Low depth
            dsp.params.depth = 0.1;
            for (let b = 0; b < 30; b++) {
                dsp.process();
            }
            const lowDepthSamples = [...dsp.outputs.outL];

            dsp.reset();

            // High depth
            dsp.params.depth = 1;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate) * 2;
                dsp.inputs.inR[i] = dsp.inputs.inL[i];
            }
            for (let b = 0; b < 30; b++) {
                dsp.process();
            }
            const highDepthSamples = [...dsp.outputs.outL];

            // High depth should produce different output pattern
            let totalDiff = 0;
            for (let i = 0; i < bufferSize; i++) {
                totalDiff += Math.abs(lowDepthSamples[i] - highDepthSamples[i]);
            }
            expect(totalDiff).toBeGreaterThan(0);
        });
    });

    describe('Output Range', () => {
        it('should stay within audio range', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 1;
            dsp.params.depth = 1;

            for (let b = 0; b < 50; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
                dsp.process();

                for (let i = 0; i < bufferSize; i++) {
                    expect(dsp.outputs.outL[i]).toBeGreaterThanOrEqual(-10);
                    expect(dsp.outputs.outL[i]).toBeLessThanOrEqual(10);
                    expect(dsp.outputs.outR[i]).toBeGreaterThanOrEqual(-10);
                    expect(dsp.outputs.outR[i]).toBeLessThanOrEqual(10);
                }
            }
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 1;
            dsp.params.depth = 0.5;

            for (let b = 0; b < 10; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
                dsp.process();
            }

            expect(dsp.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.process();
            expect(dsp.outputs.outL.length).toBe(bufferSize);
            expect(dsp.outputs.outR.length).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear delay lines on reset', () => {
            // Fill with signal
            for (let b = 0; b < 20; b++) {
                dsp.inputs.inL.fill(2);
                dsp.inputs.inR.fill(2);
                dsp.process();
            }

            dsp.reset();

            // Process silence
            dsp.inputs.inL.fill(0);
            dsp.inputs.inR.fill(0);
            dsp.params.mix = 1;
            dsp.process();

            // Should be near silent
            const maxOutput = Math.max(...dsp.outputs.outL.map(Math.abs));
            expect(maxOutput).toBeLessThan(0.1);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(chorusModule.id).toBe('chorus');
        });

        it('should have UI definition', () => {
            expect(chorusModule.ui).toBeDefined();
            expect(chorusModule.ui.knobs).toBeDefined();
            expect(chorusModule.ui.inputs).toBeDefined();
            expect(chorusModule.ui.outputs).toBeDefined();
        });
    });
});
