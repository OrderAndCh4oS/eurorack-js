/**
 * Mult Module Tests
 *
 * Tests for the 2hp Mult signal splitter.
 * 2 inputs, 6 outputs (3 per channel).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import multModule from '../../src/js/modules/mult/index.js';

describe('Mult Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = multModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.in1.length).toBe(bufferSize);
            expect(dsp.inputs.in2.length).toBe(bufferSize);
            expect(dsp.outputs.out1a.length).toBe(bufferSize);
            expect(dsp.outputs.out1b.length).toBe(bufferSize);
            expect(dsp.outputs.out1c.length).toBe(bufferSize);
            expect(dsp.outputs.out2a.length).toBe(bufferSize);
            expect(dsp.outputs.out2b.length).toBe(bufferSize);
            expect(dsp.outputs.out2c.length).toBe(bufferSize);
        });

        it('should initialize with zero outputs', () => {
            dsp.process();
            expect(dsp.outputs.out1a.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.out2a.every(v => v === 0)).toBe(true);
        });
    });

    describe('Channel 1 Signal Copying', () => {
        it('should copy IN 1 to all three channel 1 outputs', () => {
            // Fill with test signal
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = Math.sin(i * 0.1) * 5;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out1a[i]).toBe(dsp.inputs.in1[i]);
                expect(dsp.outputs.out1b[i]).toBe(dsp.inputs.in1[i]);
                expect(dsp.outputs.out1c[i]).toBe(dsp.inputs.in1[i]);
            }
        });

        it('should pass through audio signals without modification', () => {
            const testValue = 3.5; // Use value that's exact in Float32
            dsp.inputs.in1.fill(testValue);
            dsp.process();

            expect(dsp.outputs.out1a[0]).toBe(testValue);
            expect(dsp.outputs.out1b[0]).toBe(testValue);
            expect(dsp.outputs.out1c[0]).toBe(testValue);
        });

        it('should pass through negative voltages', () => {
            dsp.inputs.in1.fill(-5);
            dsp.process();

            expect(dsp.outputs.out1a[0]).toBe(-5);
            expect(dsp.outputs.out1b[0]).toBe(-5);
            expect(dsp.outputs.out1c[0]).toBe(-5);
        });
    });

    describe('Channel 2 Signal Copying', () => {
        it('should copy IN 2 to all three channel 2 outputs', () => {
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in2[i] = Math.cos(i * 0.1) * 5;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out2a[i]).toBe(dsp.inputs.in2[i]);
                expect(dsp.outputs.out2b[i]).toBe(dsp.inputs.in2[i]);
                expect(dsp.outputs.out2c[i]).toBe(dsp.inputs.in2[i]);
            }
        });
    });

    describe('Independent Channels', () => {
        it('should keep channels independent when both patched', () => {
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(-3);
            dsp.process();

            // Channel 1 outputs should have in1 value
            expect(dsp.outputs.out1a[0]).toBe(5);
            expect(dsp.outputs.out1b[0]).toBe(5);
            expect(dsp.outputs.out1c[0]).toBe(5);

            // Channel 2 outputs should have in2 value
            expect(dsp.outputs.out2a[0]).toBe(-3);
            expect(dsp.outputs.out2b[0]).toBe(-3);
            expect(dsp.outputs.out2c[0]).toBe(-3);
        });
    });

    describe('Signal Types', () => {
        it('should pass through gate signals (0V and 10V)', () => {
            // Alternating gate pattern
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = (i % 2 === 0) ? 10 : 0;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                const expected = (i % 2 === 0) ? 10 : 0;
                expect(dsp.outputs.out1a[i]).toBe(expected);
            }
        });

        it('should pass through CV signals', () => {
            // Ramp CV
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = (i / bufferSize) * 10 - 5;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out1a[i]).toBe(dsp.inputs.in1[i]);
            }
        });

        it('should pass through audio rate signals', () => {
            // High frequency sine
            for (let i = 0; i < bufferSize; i++) {
                dsp.inputs.in1[i] = Math.sin(i * 0.5) * 5;
            }
            dsp.process();

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.out1a[i]).toBe(dsp.inputs.in1[i]);
            }
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(-5);
            dsp.process();

            expect(dsp.outputs.out1a.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.out1b.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.out1c.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.out2a.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.out2b.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.out2c.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.inputs.in1.fill(1);
            dsp.process();

            let count = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (dsp.outputs.out1a[i] === 1) count++;
            }
            expect(count).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear outputs on reset', () => {
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(5);
            dsp.process();

            dsp.reset();

            expect(dsp.outputs.out1a.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.out1b.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.out1c.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.out2a.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.out2b.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.out2c.every(v => v === 0)).toBe(true);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(multModule.id).toBe('mult');
        });

        it('should have correct HP width', () => {
            expect(multModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(multModule.ui).toBeDefined();
            expect(multModule.ui.inputs).toBeDefined();
            expect(multModule.ui.outputs).toBeDefined();
        });

        it('should define correct inputs in UI', () => {
            const inputPorts = multModule.ui.inputs.map(i => i.port);
            expect(inputPorts).toContain('in1');
            expect(inputPorts).toContain('in2');
        });

        it('should define correct outputs in UI', () => {
            const outputPorts = multModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('out1a');
            expect(outputPorts).toContain('out1b');
            expect(outputPorts).toContain('out1c');
            expect(outputPorts).toContain('out2a');
            expect(outputPorts).toContain('out2b');
            expect(outputPorts).toContain('out2c');
        });
    });
});
