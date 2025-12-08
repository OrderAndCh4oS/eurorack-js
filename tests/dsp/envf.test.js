/**
 * ENVF (Envelope Follower) Module Tests
 *
 * Tests for envelope follower that extracts amplitude from audio
 * and outputs control voltage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import envfModule from '../../src/js/modules/envf/index.js';

describe('ENVF Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = envfModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.audio.length).toBe(bufferSize);
            expect(dsp.outputs.env.length).toBe(bufferSize);
            expect(dsp.outputs.inv.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.threshold).toBeDefined();
            expect(dsp.params.gain).toBeDefined();
            expect(dsp.params.slope).toBeDefined();
        });

        it('should have LED indicator', () => {
            expect(dsp.leds).toHaveProperty('active');
        });
    });

    describe('Envelope Output', () => {
        it('should output 0V with no input', () => {
            dsp.inputs.audio.fill(0);
            dsp.process();

            expect(dsp.outputs.env.every(v => v >= 0 && v < 0.01)).toBe(true);
        });

        it('should produce positive envelope from audio input', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;

            // Feed sine wave
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
            }

            // Process multiple times to let envelope rise
            for (let b = 0; b < 10; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }

            // Envelope should have risen
            const maxEnv = Math.max(...dsp.outputs.env);
            expect(maxEnv).toBeGreaterThan(0);
        });

        it('should output in 0-10V range', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;

            // Feed loud signal
            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 100 * i / sampleRate) * 5;
                }
                dsp.process();
            }

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.env[i]).toBeGreaterThanOrEqual(0);
                expect(dsp.outputs.env[i]).toBeLessThanOrEqual(10);
            }
        });

        it('should follow amplitude increases', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;
            dsp.params.slope = 0; // Fast

            // Start quiet
            dsp.inputs.audio.fill(0);
            dsp.process();
            const quietLevel = dsp.outputs.env[bufferSize - 1];

            // Get loud
            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }
            const loudLevel = dsp.outputs.env[bufferSize - 1];

            expect(loudLevel).toBeGreaterThan(quietLevel);
        });

        it('should follow amplitude decreases', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;
            dsp.params.slope = 0; // Fast

            // Get loud first
            for (let b = 0; b < 30; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }
            const loudLevel = dsp.outputs.env[bufferSize - 1];

            // Go quiet
            for (let b = 0; b < 50; b++) {
                dsp.inputs.audio.fill(0);
                dsp.process();
            }
            const quietLevel = dsp.outputs.env[bufferSize - 1];

            expect(quietLevel).toBeLessThan(loudLevel);
        });
    });

    describe('Inverted Output', () => {
        it('should be inverse of normal output', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;

            // Feed signal
            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }

            // Inverted should be 10 - env
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.inv[i]).toBeCloseTo(10 - dsp.outputs.env[i], 3);
            }
        });

        it('should be high when input is quiet', () => {
            dsp.inputs.audio.fill(0);
            dsp.process();

            // Inverted should be near 10V when envelope is near 0
            expect(dsp.outputs.inv[bufferSize - 1]).toBeGreaterThan(9);
        });
    });

    describe('Threshold Control', () => {
        it('should not respond below threshold', () => {
            dsp.params.threshold = 0.8; // High threshold
            dsp.params.gain = 1;

            // Feed quiet signal (below threshold)
            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 1; // Quiet
                }
                dsp.process();
            }

            // Envelope should stay low
            expect(dsp.outputs.env[bufferSize - 1]).toBeLessThan(1);
        });

        it('should respond above threshold', () => {
            dsp.params.threshold = 0.2; // Low threshold
            dsp.params.gain = 1;

            // Feed loud signal (above threshold)
            for (let b = 0; b < 20; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5; // Loud
                }
                dsp.process();
            }

            // Envelope should rise
            expect(dsp.outputs.env[bufferSize - 1]).toBeGreaterThan(1);
        });

        it('should activate LED when signal exceeds threshold', () => {
            dsp.params.threshold = 0.2;

            // Feed loud signal
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
            }
            dsp.process();

            expect(dsp.leds.active).toBe(1);
        });
    });

    describe('Gain Control', () => {
        it('should scale output with gain', () => {
            dsp.params.threshold = 0;

            // Low gain
            dsp.params.gain = 0.3;
            for (let b = 0; b < 30; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }
            const lowGainLevel = dsp.outputs.env[bufferSize - 1];

            dsp.reset();

            // High gain
            dsp.params.gain = 1;
            for (let b = 0; b < 30; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }
            const highGainLevel = dsp.outputs.env[bufferSize - 1];

            expect(highGainLevel).toBeGreaterThan(lowGainLevel);
        });

        it('should output 0 with gain at 0', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 0;

            for (let b = 0; b < 10; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }

            expect(dsp.outputs.env.every(v => v < 0.01)).toBe(true);
        });
    });

    describe('Slope Control', () => {
        it('should respond faster in fast mode', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;

            // Fast mode - measure rise time
            dsp.params.slope = 0;
            dsp.reset();
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = 5; // DC for consistent test
            }
            dsp.process();
            const fastRise = dsp.outputs.env[bufferSize - 1];

            // Slow mode - measure rise time
            dsp.params.slope = 1;
            dsp.reset();
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.audio[i] = 5;
            }
            dsp.process();
            const slowRise = dsp.outputs.env[bufferSize - 1];

            // Fast should rise more in same time
            expect(fastRise).toBeGreaterThan(slowRise);
        });

        it('should decay faster in fast mode', () => {
            dsp.params.threshold = 0;
            dsp.params.gain = 1;

            // Build up envelope first
            for (let b = 0; b < 50; b++) {
                dsp.inputs.audio.fill(5);
                dsp.process();
            }

            // Fast mode decay
            dsp.params.slope = 0;
            const startLevel = dsp.outputs.env[bufferSize - 1];
            dsp.inputs.audio.fill(0);
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }
            const fastDecay = startLevel - dsp.outputs.env[bufferSize - 1];

            // Reset and build up again
            dsp.reset();
            for (let b = 0; b < 50; b++) {
                dsp.inputs.audio.fill(5);
                dsp.process();
            }

            // Slow mode decay
            dsp.params.slope = 1;
            dsp.inputs.audio.fill(0);
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }
            const slowDecay = startLevel - dsp.outputs.env[bufferSize - 1];

            // Fast should decay more
            expect(fastDecay).toBeGreaterThan(slowDecay);
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.threshold = 0.5;
            dsp.params.gain = 1;

            for (let b = 0; b < 5; b++) {
                for (let i = 0; i < bufferSize; i++) {
                    dsp.inputs.audio[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5;
                }
                dsp.process();
            }

            expect(dsp.outputs.env.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.inv.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.process();

            expect(dsp.outputs.env.length).toBe(bufferSize);
            expect(dsp.outputs.inv.length).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear outputs on reset', () => {
            // Build up envelope
            for (let b = 0; b < 20; b++) {
                dsp.inputs.audio.fill(5);
                dsp.process();
            }

            dsp.reset();

            // After reset, envelope should be near 0
            dsp.inputs.audio.fill(0);
            dsp.process();
            expect(dsp.outputs.env[0]).toBeLessThan(0.1);
        });

        it('should reset LED state', () => {
            // Trigger LED
            dsp.inputs.audio.fill(5);
            dsp.process();

            dsp.reset();

            expect(dsp.leds.active).toBe(0);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(envfModule.id).toBe('envf');
        });

        it('should have correct HP width', () => {
            expect(envfModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(envfModule.ui).toBeDefined();
            expect(envfModule.ui.knobs).toBeDefined();
            expect(envfModule.ui.inputs).toBeDefined();
            expect(envfModule.ui.outputs).toBeDefined();
        });

        it('should define threshold and gain knobs', () => {
            const knobParams = envfModule.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('threshold');
            expect(knobParams).toContain('gain');
        });

        it('should define correct outputs', () => {
            const outputPorts = envfModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('env');
            expect(outputPorts).toContain('inv');
        });
    });
});
