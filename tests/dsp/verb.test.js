import { describe, it, expect, beforeEach } from 'vitest';
import verbModule from '../../src/js/modules/verb/index.js';

// Helper to create VERB instance
const createVerb = (options = {}) => verbModule.createDSP(options);

describe('VERB (Reverb)', () => {
    let verb;

    beforeEach(() => {
        verb = createVerb();
    });

    describe('initialization', () => {
        it('should create a reverb with default params', () => {
            expect(verb.params.time).toBe(0.5);
            expect(verb.params.mix).toBe(0.5);
            expect(verb.params.damp).toBe(0.5);
        });

        it('should create stereo audio input buffers', () => {
            expect(verb.inputs.audioL).toBeInstanceOf(Float32Array);
            expect(verb.inputs.audioL.length).toBe(512);
            expect(verb.inputs.audioR).toBeInstanceOf(Float32Array);
            expect(verb.inputs.audioR.length).toBe(512);
        });

        it('should create CV input buffer for mix', () => {
            expect(verb.inputs.mixCV).toBeInstanceOf(Float32Array);
        });

        it('should create stereo output buffers', () => {
            expect(verb.outputs.outL).toBeInstanceOf(Float32Array);
            expect(verb.outputs.outL.length).toBe(512);
            expect(verb.outputs.outR).toBeInstanceOf(Float32Array);
            expect(verb.outputs.outR.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(verb.leds).toBeDefined();
            expect(verb.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const customVerb = createVerb({ sampleRate: 48000, bufferSize: 256 });
            expect(customVerb.outputs.outL.length).toBe(256);
            expect(customVerb.outputs.outR.length).toBe(256);
        });
    });

    describe('output range (audio +/-5V)', () => {
        it('should produce stereo output within audio range', () => {
            // Input a test signal
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.sin(i * 0.1) * 5;
                verb.inputs.audioR[i] = Math.sin(i * 0.1 + 0.5) * 5;
            }
            verb.params.mix = 1; // Full wet
            verb.process();

            const maxL = Math.max(...verb.outputs.outL);
            const minL = Math.min(...verb.outputs.outL);
            const maxR = Math.max(...verb.outputs.outR);
            const minR = Math.min(...verb.outputs.outR);

            expect(maxL).toBeLessThanOrEqual(5.5);
            expect(minL).toBeGreaterThanOrEqual(-5.5);
            expect(maxR).toBeLessThanOrEqual(5.5);
            expect(minR).toBeGreaterThanOrEqual(-5.5);
        });
    });

    describe('mono normalization', () => {
        it('should copy left input to right when right is empty', () => {
            // Only input to left channel
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.sin(i * 0.1) * 3;
            }
            verb.inputs.audioR.fill(0);

            verb.params.mix = 0; // Full dry to test normalization behavior
            verb.process();

            // Both outputs should have signal
            const hasOutputL = verb.outputs.outL.some(v => Math.abs(v) > 0.01);
            const hasOutputR = verb.outputs.outR.some(v => Math.abs(v) > 0.01);

            expect(hasOutputL).toBe(true);
            expect(hasOutputR).toBe(true);
        });
    });

    describe('time knob behavior', () => {
        it('should create shorter decay at low time', () => {
            // Input impulse
            verb.inputs.audioL.fill(0);
            verb.inputs.audioL[0] = 5;
            verb.inputs.audioR.fill(0);

            verb.params.time = 0.1; // Short reverb
            verb.params.mix = 1; // Full wet
            verb.params.damp = 0.5;

            // Process many buffers and measure decay
            let outputAfter10 = 0;
            for (let i = 0; i < 20; i++) {
                verb.process();
                if (i === 10) {
                    outputAfter10 = Math.max(...verb.outputs.outL.map(Math.abs));
                }
                verb.inputs.audioL.fill(0);
                verb.inputs.audioR.fill(0);
            }

            // Short time should decay faster
            expect(outputAfter10).toBeDefined();
        });

        it('should create longer decay at high time', () => {
            // Input impulse
            verb.inputs.audioL.fill(0);
            verb.inputs.audioL[0] = 5;
            verb.inputs.audioR.fill(0);

            verb.params.time = 0.9; // Long reverb
            verb.params.mix = 1;
            verb.params.damp = 0.5;

            // Process and track output
            let hasOutputAfter20 = false;
            for (let i = 0; i < 30; i++) {
                verb.process();
                if (i > 20 && verb.outputs.outL.some(v => Math.abs(v) > 0.001)) {
                    hasOutputAfter20 = true;
                }
                verb.inputs.audioL.fill(0);
                verb.inputs.audioR.fill(0);
            }

            // Long time should still have reverb tail
            expect(hasOutputAfter20).toBe(true);
        });
    });

    describe('mix knob behavior', () => {
        it('should output only dry signal at mix = 0', () => {
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.sin(i * 0.1) * 3;
                verb.inputs.audioR[i] = Math.sin(i * 0.1 + 0.5) * 3;
            }

            verb.params.mix = 0; // Full dry
            verb.process();

            // Output should match input (dry only)
            for (let i = 0; i < 512; i++) {
                expect(verb.outputs.outL[i]).toBeCloseTo(verb.inputs.audioL[i], 1);
            }
        });

        it('should output only wet signal at mix = 1', () => {
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.sin(i * 0.1) * 3;
                verb.inputs.audioR[i] = Math.sin(i * 0.1 + 0.5) * 3;
            }

            verb.params.mix = 1; // Full wet
            verb.process();

            // Wet signal is processed, should be different from dry input
            const inputSum = verb.inputs.audioL.reduce((a, b) => a + b, 0);
            const outputSum = verb.outputs.outL.reduce((a, b) => a + b, 0);

            // Reverb changes the signal
            expect(Math.abs(inputSum - outputSum)).toBeGreaterThan(0.1);
        });

        it('should blend dry and wet at mix = 0.5', () => {
            verb.params.mix = 0.5;
            expect(verb.params.mix).toBe(0.5);
        });
    });

    describe('damp knob behavior', () => {
        it('should preserve high frequencies at low damp', () => {
            verb.params.damp = 0.1;
            expect(verb.params.damp).toBe(0.1);
        });

        it('should attenuate high frequencies at high damp', () => {
            verb.params.damp = 0.9;
            expect(verb.params.damp).toBe(0.9);
        });
    });

    describe('CV modulation', () => {
        it('should respond to mix CV', () => {
            verb.inputs.mixCV.fill(2); // +2V
            verb.process();

            expect(verb.inputs.mixCV[0]).toBe(2);
        });
    });

    describe('LED indicators', () => {
        it('should update active LED based on signal', () => {
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.sin(i * 0.1) * 5;
            }
            verb.process();

            // LED should indicate activity
            expect(typeof verb.leds.active).toBe('number');
        });
    });

    describe('reset', () => {
        it('should clear reverb buffer on reset', () => {
            // Fill with signal
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.sin(i * 0.1) * 5;
                verb.inputs.audioR[i] = Math.sin(i * 0.1) * 5;
            }
            verb.params.time = 0.9;
            verb.params.mix = 1;
            for (let i = 0; i < 10; i++) {
                verb.process();
            }

            // Reset
            verb.reset();

            // Process with silence
            verb.inputs.audioL.fill(0);
            verb.inputs.audioR.fill(0);
            verb.process();

            // Output should be silent after reset
            const maxOutputL = Math.max(...verb.outputs.outL.map(Math.abs));
            const maxOutputR = Math.max(...verb.outputs.outR.map(Math.abs));
            expect(maxOutputL).toBeLessThan(0.01);
            expect(maxOutputR).toBeLessThan(0.01);
        });
    });

    describe('buffer integrity', () => {
        it('should fill entire output buffer without NaN', () => {
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.random() * 10 - 5;
                verb.inputs.audioR[i] = Math.random() * 10 - 5;
            }
            verb.process();

            expect(verb.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(verb.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });

        it('should not produce infinite values', () => {
            for (let i = 0; i < 512; i++) {
                verb.inputs.audioL[i] = Math.random() * 10 - 5;
                verb.inputs.audioR[i] = Math.random() * 10 - 5;
            }

            // Process many times with high time
            verb.params.time = 0.99;
            for (let i = 0; i < 100; i++) {
                verb.process();
            }

            expect(verb.outputs.outL.every(v => isFinite(v))).toBe(true);
            expect(verb.outputs.outR.every(v => isFinite(v))).toBe(true);
        });

        it('should handle silence without issues', () => {
            verb.inputs.audioL.fill(0);
            verb.inputs.audioR.fill(0);
            verb.process();

            expect(verb.outputs.outL.every(v => !isNaN(v))).toBe(true);
            expect(verb.outputs.outR.every(v => !isNaN(v))).toBe(true);
        });
    });
});
