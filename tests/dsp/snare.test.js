import { describe, it, expect, beforeEach } from 'vitest';
import snareModule from '../../src/js/modules/snare/index.js';

const createSnare = (options = {}) => snareModule.createDSP(options);

describe('2hp Snare - Snare Drum Synthesizer', () => {
    let snare;

    beforeEach(() => {
        snare = createSnare();
    });

    describe('initialization', () => {
        it('should create a snare with default params', () => {
            expect(snare.params.snap).toBeDefined();
            expect(snare.params.decay).toBeDefined();
            expect(snare.params.pitch).toBeDefined();
        });

        it('should have trigger input', () => {
            expect(snare.inputs.trigger).toBeInstanceOf(Float32Array);
        });

        it('should have CV inputs', () => {
            expect(snare.inputs.pitchCV).toBeInstanceOf(Float32Array);
            expect(snare.inputs.decayCV).toBeInstanceOf(Float32Array);
            expect(snare.inputs.snapCV).toBeInstanceOf(Float32Array);
        });

        it('should create output buffer', () => {
            expect(snare.outputs.out).toBeInstanceOf(Float32Array);
            expect(snare.outputs.out.length).toBe(512);
        });

        it('should have LED indicator', () => {
            expect(snare.leds.active).toBe(0);
        });

        it('should accept custom options', () => {
            const customSnare = createSnare({ bufferSize: 256, sampleRate: 48000 });
            expect(customSnare.outputs.out.length).toBe(256);
        });
    });

    describe('trigger behavior', () => {
        it('should produce output when triggered', () => {
            snare.inputs.trigger[0] = 10;
            snare.inputs.trigger.fill(0, 1);
            snare.process();

            const hasOutput = snare.outputs.out.some(v => Math.abs(v) > 0.01);
            expect(hasOutput).toBe(true);
        });

        it('should not produce output without trigger', () => {
            snare.inputs.trigger.fill(0);
            snare.process();

            const maxOutput = Math.max(...snare.outputs.out.map(Math.abs));
            expect(maxOutput).toBeLessThan(0.1);
        });

        it('should detect rising edge only', () => {
            snare.inputs.trigger.fill(10);
            snare.process();
            const firstOutput = [...snare.outputs.out];

            snare.process();
            const maxSecond = Math.max(...snare.outputs.out.map(Math.abs));
            const maxFirst = Math.max(...firstOutput.map(Math.abs));
            expect(maxSecond).toBeLessThan(maxFirst);
        });

        it('should activate LED on trigger', () => {
            snare.inputs.trigger[0] = 10;
            snare.process();

            expect(snare.leds.active).toBeGreaterThan(0);
        });
    });

    describe('snap control', () => {
        it('should affect attack intensity', () => {
            // Low snap
            snare.params.snap = 0.1;
            snare.inputs.trigger[0] = 10;
            snare.process();
            const lowSnapOutput = [...snare.outputs.out];

            // High snap
            snare.reset();
            snare.params.snap = 0.9;
            snare.inputs.trigger[0] = 10;
            snare.process();
            const highSnapOutput = [...snare.outputs.out];

            // High snap should have more noise/transient content
            // Check early samples for difference
            let difference = 0;
            for (let i = 0; i < 64; i++) {
                difference += Math.abs(lowSnapOutput[i] - highSnapOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });

        it('should respond to snap CV', () => {
            snare.params.snap = 0.5;

            snare.inputs.trigger[0] = 10;
            snare.inputs.snapCV.fill(0);
            snare.process();
            const noCVOutput = [...snare.outputs.out];

            snare.reset();
            snare.inputs.trigger[0] = 10;
            snare.inputs.snapCV.fill(5);
            snare.process();
            const withCVOutput = [...snare.outputs.out];

            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(noCVOutput[i] - withCVOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });
    });

    describe('decay control', () => {
        it('should have shorter decay at lower settings', () => {
            snare.params.decay = 0.1;
            snare.inputs.trigger[0] = 10;
            snare.process();
            for (let i = 0; i < 15; i++) snare.process();
            const shortDecayLevel = Math.max(...snare.outputs.out.map(Math.abs));

            snare.reset();
            snare.params.decay = 0.9;
            snare.inputs.trigger[0] = 10;
            snare.process();
            for (let i = 0; i < 15; i++) snare.process();
            const longDecayLevel = Math.max(...snare.outputs.out.map(Math.abs));

            expect(longDecayLevel).toBeGreaterThan(shortDecayLevel);
        });

        it('should respond to decay CV', () => {
            snare.params.decay = 0.3;

            snare.inputs.trigger[0] = 10;
            snare.inputs.decayCV.fill(0);
            snare.process();
            for (let i = 0; i < 10; i++) snare.process();
            const lowCVLevel = Math.max(...snare.outputs.out.map(Math.abs));

            snare.reset();
            snare.inputs.trigger[0] = 10;
            snare.inputs.decayCV.fill(5);
            snare.process();
            for (let i = 0; i < 10; i++) snare.process();
            const highCVLevel = Math.max(...snare.outputs.out.map(Math.abs));

            expect(highCVLevel).toBeGreaterThan(lowCVLevel);
        });
    });

    describe('pitch control', () => {
        it('should affect oscillator frequency', () => {
            snare.params.pitch = 0.2;
            snare.inputs.trigger[0] = 10;
            snare.process();
            const lowPitchOutput = [...snare.outputs.out];

            snare.reset();
            snare.params.pitch = 0.8;
            snare.inputs.trigger[0] = 10;
            snare.process();
            const highPitchOutput = [...snare.outputs.out];

            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(lowPitchOutput[i] - highPitchOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });

        it('should respond to 1V/Oct CV', () => {
            snare.params.pitch = 0.5;

            snare.inputs.trigger[0] = 10;
            snare.inputs.pitchCV.fill(0);
            snare.process();
            const noCVOutput = [...snare.outputs.out];

            snare.reset();
            snare.inputs.trigger[0] = 10;
            snare.inputs.pitchCV.fill(1);
            snare.process();
            const withCVOutput = [...snare.outputs.out];

            let difference = 0;
            for (let i = 0; i < 512; i++) {
                difference += Math.abs(noCVOutput[i] - withCVOutput[i]);
            }
            expect(difference).toBeGreaterThan(0);
        });
    });

    describe('output characteristics', () => {
        it('should produce audio-range output', () => {
            snare.inputs.trigger[0] = 10;
            snare.process();

            const maxOutput = Math.max(...snare.outputs.out.map(Math.abs));
            expect(maxOutput).toBeLessThanOrEqual(10);
            expect(maxOutput).toBeGreaterThan(0);
        });

        it('should contain both tonal and noise components', () => {
            // Snare should have noise content (high frequency variation)
            snare.inputs.trigger[0] = 10;
            snare.params.snap = 0.7;
            snare.process();

            // Check for high-frequency content by measuring sample variance
            let variance = 0;
            for (let i = 1; i < 512; i++) {
                const diff = snare.outputs.out[i] - snare.outputs.out[i-1];
                variance += diff * diff;
            }
            variance /= 511;

            // Should have significant variance (noise content)
            expect(variance).toBeGreaterThan(0.001);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffer', () => {
            snare.inputs.trigger[0] = 10;
            snare.process();

            expect(snare.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should produce no NaN values', () => {
            snare.process();
            expect(snare.outputs.out.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear output and state on reset', () => {
            snare.inputs.trigger[0] = 10;
            snare.process();
            snare.reset();

            expect(snare.outputs.out[0]).toBe(0);
            expect(snare.leds.active).toBe(0);
        });
    });

    describe('module metadata', () => {
        it('should have correct module ID', () => {
            expect(snareModule.id).toBe('snare');
        });

        it('should have correct HP width', () => {
            expect(snareModule.hp).toBe(2);
        });

        it('should have 3 knobs (snap, decay, pitch)', () => {
            expect(snareModule.ui.knobs.length).toBe(3);
        });

        it('should have trigger and CV inputs', () => {
            expect(snareModule.ui.inputs.length).toBeGreaterThanOrEqual(4);
        });

        it('should have 1 output', () => {
            expect(snareModule.ui.outputs.length).toBe(1);
        });
    });
});
