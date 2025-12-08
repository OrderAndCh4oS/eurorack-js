/**
 * Ring Modulator Module Tests
 *
 * Tests for ring modulator that multiplies two signals together.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import ringModule from '../../src/js/modules/ring/index.js';

describe('Ring Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = ringModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.x.length).toBe(bufferSize);
            expect(dsp.inputs.y.length).toBe(bufferSize);
            expect(dsp.outputs.out.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.mix).toBeDefined();
        });

        it('should initialize with zero output when no input', () => {
            dsp.process();
            expect(dsp.outputs.out.every(v => v === 0)).toBe(true);
        });
    });

    describe('Ring Modulation', () => {
        it('should multiply two DC signals correctly', () => {
            dsp.params.mix = 1;
            dsp.inputs.x.fill(2);
            dsp.inputs.y.fill(3);
            dsp.process();

            // 2 * 3 = 6, scaled by 1/5 = 1.2
            const expected = (2 * 3) / 5;
            expect(dsp.outputs.out[0]).toBeCloseTo(expected, 2);
        });

        it('should output zero when one input is zero', () => {
            dsp.params.mix = 1;
            dsp.inputs.x.fill(5);
            dsp.inputs.y.fill(0);
            dsp.process();

            expect(dsp.outputs.out.every(v => v === 0)).toBe(true);
        });

        it('should handle negative signals', () => {
            dsp.params.mix = 1;
            dsp.inputs.x.fill(-3);
            dsp.inputs.y.fill(2);
            dsp.process();

            // -3 * 2 = -6, scaled = -1.2
            const expected = (-3 * 2) / 5;
            expect(dsp.outputs.out[0]).toBeCloseTo(expected, 2);
        });

        it('should produce bipolar output from bipolar inputs', () => {
            dsp.params.mix = 1;
            // Alternating signals
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.x[i] = Math.sin(i * 0.1) * 5;
                dsp.inputs.y[i] = Math.sin(i * 0.15) * 5;
            }
            dsp.process();

            let hasPositive = false;
            let hasNegative = false;
            for (let i = 0; i < bufferSize; i++) {
                if (dsp.outputs.out[i] > 0.1) hasPositive = true;
                if (dsp.outputs.out[i] < -0.1) hasNegative = true;
            }
            expect(hasPositive).toBe(true);
            expect(hasNegative).toBe(true);
        });
    });

    describe('Mix Control', () => {
        it('should output dry signal when mix is 0', () => {
            dsp.params.mix = 0;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.x[i] = Math.sin(i * 0.1) * 3;
                dsp.inputs.y[i] = 5; // Constant modulator
            }
            dsp.process();

            // At mix=0, output should equal input X
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out[i]).toBeCloseTo(dsp.inputs.x[i], 2);
            }
        });

        it('should output full ring mod when mix is 1', () => {
            dsp.params.mix = 1;
            dsp.inputs.x.fill(4);
            dsp.inputs.y.fill(2);
            dsp.process();

            // Full ring mod: (4 * 2) / 5 = 1.6
            const expected = (4 * 2) / 5;
            expect(dsp.outputs.out[0]).toBeCloseTo(expected, 2);
        });

        it('should blend dry and wet at mix 0.5', () => {
            dsp.params.mix = 0.5;
            dsp.inputs.x.fill(4);
            dsp.inputs.y.fill(2);
            dsp.process();

            // dry = 4, wet = (4*2)/5 = 1.6
            // blended = 4 * 0.5 + 1.6 * 0.5 = 2.8
            const dry = 4;
            const wet = (4 * 2) / 5;
            const expected = dry * 0.5 + wet * 0.5;
            expect(dsp.outputs.out[0]).toBeCloseTo(expected, 2);
        });
    });

    describe('Sum and Difference Frequencies', () => {
        it('should create sidebands from two sine waves', () => {
            dsp.params.mix = 1;
            const freqX = 0.1;  // Carrier frequency
            const freqY = 0.07; // Modulator frequency

            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.x[i] = Math.sin(i * freqX) * 5;
                dsp.inputs.y[i] = Math.sin(i * freqY) * 5;
            }
            dsp.process();

            // Output should have energy at sum and difference frequencies
            // We can verify by checking that the output differs from both inputs
            let diffFromX = 0;
            let diffFromY = 0;
            for (let i = 0; i < bufferSize; i++) {
                diffFromX += Math.abs(dsp.outputs.out[i] - dsp.inputs.x[i]);
                diffFromY += Math.abs(dsp.outputs.out[i] - dsp.inputs.y[i]);
            }
            expect(diffFromX).toBeGreaterThan(bufferSize * 0.5);
            expect(diffFromY).toBeGreaterThan(bufferSize * 0.5);
        });
    });

    describe('Output Range', () => {
        it('should keep output within audio range', () => {
            dsp.params.mix = 1;
            // Maximum inputs
            dsp.inputs.x.fill(5);
            dsp.inputs.y.fill(5);
            dsp.process();

            // 5 * 5 / 5 = 5, should be within ±5V
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out[i]).toBeGreaterThanOrEqual(-6);
                expect(dsp.outputs.out[i]).toBeLessThanOrEqual(6);
            }
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.mix = 0.5;
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.x[i] = Math.sin(i * 0.1) * 5;
                dsp.inputs.y[i] = Math.cos(i * 0.15) * 5;
            }
            dsp.process();
            expect(dsp.outputs.out.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.inputs.x.fill(1);
            dsp.inputs.y.fill(1);
            dsp.params.mix = 1;
            dsp.process();

            // All samples should be processed
            const expected = (1 * 1) / 5;
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out[i]).toBeCloseTo(expected, 5);
            }
        });
    });

    describe('Reset', () => {
        it('should clear output on reset', () => {
            dsp.inputs.x.fill(5);
            dsp.inputs.y.fill(5);
            dsp.params.mix = 1;
            dsp.process();

            dsp.reset();

            expect(dsp.outputs.out.every(v => v === 0)).toBe(true);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(ringModule.id).toBe('ring');
        });

        it('should have correct HP width', () => {
            expect(ringModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(ringModule.ui).toBeDefined();
            expect(ringModule.ui.knobs).toBeDefined();
            expect(ringModule.ui.inputs).toBeDefined();
            expect(ringModule.ui.outputs).toBeDefined();
        });

        it('should define mix knob', () => {
            const knobParams = ringModule.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('mix');
        });

        it('should define correct inputs', () => {
            const inputPorts = ringModule.ui.inputs.map(i => i.port);
            expect(inputPorts).toContain('x');
            expect(inputPorts).toContain('y');
        });

        it('should define correct outputs', () => {
            const outputPorts = ringModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('out');
        });
    });
});
