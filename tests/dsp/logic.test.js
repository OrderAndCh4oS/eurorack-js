/**
 * Logic Module Tests
 *
 * Tests for the 2hp Logic boolean gate operator.
 * Provides AND and OR logic operations on gate/trigger signals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import logicModule from '../../src/js/modules/logic/index.js';

describe('Logic Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = logicModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.in1.length).toBe(bufferSize);
            expect(dsp.inputs.in2.length).toBe(bufferSize);
            expect(dsp.outputs.and.length).toBe(bufferSize);
            expect(dsp.outputs.or.length).toBe(bufferSize);
        });

        it('should initialize with zero outputs', () => {
            dsp.process();
            expect(dsp.outputs.and.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.or.every(v => v === 0)).toBe(true);
        });

        it('should have LED indicators', () => {
            expect(dsp.leds).toHaveProperty('and');
            expect(dsp.leds).toHaveProperty('or');
        });
    });

    describe('AND Logic', () => {
        it('should output 0V when both inputs are low', () => {
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.and.every(v => v === 0)).toBe(true);
        });

        it('should output 0V when only IN 1 is high', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.and.every(v => v === 0)).toBe(true);
        });

        it('should output 0V when only IN 2 is high', () => {
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.outputs.and.every(v => v === 0)).toBe(true);
        });

        it('should output 10V when both inputs are high', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.outputs.and.every(v => v === 10)).toBe(true);
        });

        it('should use 1V threshold for high detection', () => {
            // Just below threshold
            dsp.inputs.in1.fill(0.9);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.outputs.and[0]).toBe(0);

            // At threshold
            dsp.inputs.in1.fill(1);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.outputs.and[0]).toBe(10);
        });

        it('should handle sample-by-sample logic', () => {
            // Alternating pattern
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = (i % 2 === 0) ? 10 : 0;
                dsp.inputs.in2[i] = (i % 4 < 2) ? 10 : 0;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                const in1High = dsp.inputs.in1[i] >= 1;
                const in2High = dsp.inputs.in2[i] >= 1;
                const expected = (in1High && in2High) ? 10 : 0;
                expect(dsp.outputs.and[i]).toBe(expected);
            }
        });
    });

    describe('OR Logic', () => {
        it('should output 0V when both inputs are low', () => {
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.or.every(v => v === 0)).toBe(true);
        });

        it('should output 10V when only IN 1 is high', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.or.every(v => v === 10)).toBe(true);
        });

        it('should output 10V when only IN 2 is high', () => {
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.outputs.or.every(v => v === 10)).toBe(true);
        });

        it('should output 10V when both inputs are high', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.outputs.or.every(v => v === 10)).toBe(true);
        });

        it('should use 1V threshold for high detection', () => {
            // Just below threshold on both
            dsp.inputs.in1.fill(0.9);
            dsp.inputs.in2.fill(0.5);
            dsp.process();
            expect(dsp.outputs.or[0]).toBe(0);

            // One at threshold
            dsp.inputs.in1.fill(1);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.or[0]).toBe(10);
        });

        it('should handle sample-by-sample logic', () => {
            // Alternating pattern
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = (i % 2 === 0) ? 10 : 0;
                dsp.inputs.in2[i] = (i % 4 < 2) ? 10 : 0;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                const in1High = dsp.inputs.in1[i] >= 1;
                const in2High = dsp.inputs.in2[i] >= 1;
                const expected = (in1High || in2High) ? 10 : 0;
                expect(dsp.outputs.or[i]).toBe(expected);
            }
        });
    });

    describe('LED Indicators', () => {
        it('should light AND LED when AND output is high', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(10);
            dsp.process();
            expect(dsp.leds.and).toBe(1);
        });

        it('should not light AND LED when AND output is low', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.leds.and).toBe(0);
        });

        it('should light OR LED when OR output is high', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.leds.or).toBe(1);
        });

        it('should not light OR LED when OR output is low', () => {
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.leds.or).toBe(0);
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.and.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.or.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(10);
            dsp.process();

            let nonZeroAnd = 0;
            let nonZeroOr = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (dsp.outputs.and[i] !== 0) nonZeroAnd++;
                if (dsp.outputs.or[i] !== 0) nonZeroOr++;
            }
            expect(nonZeroAnd).toBe(bufferSize);
            expect(nonZeroOr).toBe(bufferSize);
        });

        it('should only output 0V or 10V (gate levels)', () => {
            // Various input levels
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = Math.random() * 10;
                dsp.inputs.in2[i] = Math.random() * 10;
            }
            dsp.process();

            expect(dsp.outputs.and.every(v => v === 0 || v === 10)).toBe(true);
            expect(dsp.outputs.or.every(v => v === 0 || v === 10)).toBe(true);
        });
    });

    describe('Reset', () => {
        it('should clear outputs on reset', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(10);
            dsp.process();

            dsp.reset();

            expect(dsp.outputs.and.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.or.every(v => v === 0)).toBe(true);
        });

        it('should clear LEDs on reset', () => {
            dsp.inputs.in1.fill(10);
            dsp.inputs.in2.fill(10);
            dsp.process();

            dsp.reset();

            expect(dsp.leds.and).toBe(0);
            expect(dsp.leds.or).toBe(0);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(logicModule.id).toBe('logic');
        });

        it('should have correct HP width', () => {
            expect(logicModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(logicModule.ui).toBeDefined();
            expect(logicModule.ui.inputs).toBeDefined();
            expect(logicModule.ui.outputs).toBeDefined();
        });

        it('should define correct inputs in UI', () => {
            const inputPorts = logicModule.ui.inputs.map(i => i.port);
            expect(inputPorts).toContain('in1');
            expect(inputPorts).toContain('in2');
        });

        it('should define correct outputs in UI', () => {
            const outputPorts = logicModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('and');
            expect(outputPorts).toContain('or');
        });
    });
});
