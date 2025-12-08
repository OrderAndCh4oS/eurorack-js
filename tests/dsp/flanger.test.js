/**
 * FLANGER Module Tests
 *
 * Tests for flanger effect with short modulated delay and feedback.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import flangerModule from '../../src/js/modules/flanger/index.js';

describe('FLANGER Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = flangerModule.createDSP({ sampleRate, bufferSize });
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

    describe('Flanging Effect', () => {
        it('should create comb filtering', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 0;  // Static
            dsp.params.depth = 0.5;
            dsp.params.feedback = 0.5;

            // Feed signal and let delay fill
            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 500 * i / sampleRate) * 2;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
                dsp.process();
            }

            // Output should differ from simple pass-through
            let totalDiff = 0;
            for (let i = 0; i < bufferSize; i++) {
                totalDiff += Math.abs(dsp.outputs.outL[i] - dsp.inputs.inL[i]);
            }
            expect(totalDiff).toBeGreaterThan(0);
        });
    });

    describe('Feedback Control', () => {
        it('should increase resonance with higher feedback', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 0;
            dsp.params.depth = 0.5;

            const testSignal = () => {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 500 * i / sampleRate) * 2;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
            };

            // Zero feedback
            dsp.params.feedback = 0;
            for (let b = 0; b < 20; b++) {
                testSignal();
                dsp.process();
            }
            const noFbOutput = [...dsp.outputs.outL];

            dsp.reset();

            // High feedback
            dsp.params.feedback = 0.8;
            for (let b = 0; b < 20; b++) {
                testSignal();
                dsp.process();
            }
            const highFbOutput = [...dsp.outputs.outL];

            // Outputs should differ
            let totalDiff = 0;
            for (let i = 0; i < bufferSize; i++) {
                totalDiff += Math.abs(noFbOutput[i] - highFbOutput[i]);
            }
            expect(totalDiff).toBeGreaterThan(0);
        });

        it('should support negative feedback', () => {
            dsp.params.mix = 0.5;
            dsp.params.rate = 0;
            dsp.params.depth = 0.5;
            dsp.params.feedback = -0.5;

            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.inL[i] = Math.sin(2 * Math.PI * 500 * i / sampleRate) * 2;
                    dsp.inputs.inR[i] = dsp.inputs.inL[i];
                }
                dsp.process();
            }

            // Should produce output without NaN
            expect(dsp.outputs.outL.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('Rate Control', () => {
        it('should sweep faster with higher rate', () => {
            dsp.params.mix = 0.5;
            dsp.params.depth = 0.5;

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
            dsp.params.feedback = 0.7;

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
        it('should clear delay line on reset', () => {
            dsp.params.feedback = 0.8;

            for (let b = 0; b < 20; b++) {
                dsp.inputs.inL.fill(2);
                dsp.inputs.inR.fill(2);
                dsp.process();
            }

            dsp.reset();

            dsp.inputs.inL.fill(0);
            dsp.inputs.inR.fill(0);
            dsp.params.mix = 1;
            dsp.process();

            const maxOutput = Math.max(...dsp.outputs.outL.map(Math.abs));
            expect(maxOutput).toBeLessThan(0.1);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(flangerModule.id).toBe('flanger');
        });

        it('should have UI definition', () => {
            expect(flangerModule.ui).toBeDefined();
        });
    });
});
