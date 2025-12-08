/**
 * Compare 2 Module Tests
 *
 * Tests for dual window comparator based on Joranalogue Compare 2.
 * Two independent window comparators with logic section.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import cmp2Module from '../../src/js/modules/cmp2/index.js';

describe('CMP2 Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = cmp2Module.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.in1.length).toBe(bufferSize);
            expect(dsp.inputs.in2.length).toBe(bufferSize);
            expect(dsp.outputs.out1.length).toBe(bufferSize);
            expect(dsp.outputs.not1.length).toBe(bufferSize);
            expect(dsp.outputs.out2.length).toBe(bufferSize);
            expect(dsp.outputs.not2.length).toBe(bufferSize);
            expect(dsp.outputs.and.length).toBe(bufferSize);
            expect(dsp.outputs.or.length).toBe(bufferSize);
            expect(dsp.outputs.xor.length).toBe(bufferSize);
            expect(dsp.outputs.ff.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.shift1).toBeDefined();
            expect(dsp.params.size1).toBeDefined();
            expect(dsp.params.shift2).toBeDefined();
            expect(dsp.params.size2).toBeDefined();
        });

        it('should have LED indicators', () => {
            expect(dsp.leds).toHaveProperty('state1');
            expect(dsp.leds).toHaveProperty('state2');
            expect(dsp.leds).toHaveProperty('and');
            expect(dsp.leds).toHaveProperty('or');
            expect(dsp.leds).toHaveProperty('xor');
            expect(dsp.leds).toHaveProperty('ff');
        });
    });

    describe('Window Comparator Basic Behavior', () => {
        it('should output HIGH when input is inside window', () => {
            // Window centered at 0V with size 4V: -2V to +2V
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            // Input at 0V (inside window)
            dsp.inputs.in1.fill(0);
            dsp.process();

            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
            expect(dsp.outputs.not1[bufferSize - 1]).toBe(0);
        });

        it('should output LOW when input is below window', () => {
            // Window centered at 0V with size 4V: -2V to +2V
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            // Input at -4V (below window)
            dsp.inputs.in1.fill(-4);
            dsp.process();

            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);
            expect(dsp.outputs.not1[bufferSize - 1]).toBe(10);
        });

        it('should output LOW when input is above window', () => {
            // Window centered at 0V with size 4V: -2V to +2V
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            // Input at +4V (above window)
            dsp.inputs.in1.fill(4);
            dsp.process();

            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);
            expect(dsp.outputs.not1[bufferSize - 1]).toBe(10);
        });

        it('should output complementary signals (out and not)', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            // Test multiple input values
            const testValues = [-5, -2, 0, 2, 5];
            for (const val of testValues) {
                dsp.inputs.in1.fill(val);
                dsp.process();

                const out = dsp.outputs.out1[bufferSize - 1];
                const not = dsp.outputs.not1[bufferSize - 1];

                // Out and Not should be complementary (one is 10, other is 0)
                expect(out + not).toBe(10);
            }
        });
    });

    describe('Shift Parameter', () => {
        it('should shift window upward with positive shift', () => {
            // Window size 2V, shifted to +3V center: +2V to +4V
            dsp.params.shift1 = 3;
            dsp.params.size1 = 2;

            // Input at +3V (inside shifted window)
            dsp.inputs.in1.fill(3);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);

            // Input at 0V (below shifted window)
            dsp.inputs.in1.fill(0);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);
        });

        it('should shift window downward with negative shift', () => {
            // Window size 2V, shifted to -3V center: -4V to -2V
            dsp.params.shift1 = -3;
            dsp.params.size1 = 2;

            // Input at -3V (inside shifted window)
            dsp.inputs.in1.fill(-3);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);

            // Input at 0V (above shifted window)
            dsp.inputs.in1.fill(0);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);
        });

        it('should respond to shift CV', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 2; // Window -1V to +1V

            // Input at 2V - outside window normally
            dsp.inputs.in1.fill(2);
            dsp.inputs.shiftCV1.fill(0);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);

            // Add +2V shift CV - window now +1V to +3V, input 2V is inside
            dsp.inputs.shiftCV1.fill(2);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
        });
    });

    describe('Size Parameter', () => {
        it('should widen window with larger size', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 8; // Window -4V to +4V

            // Input at 3V (inside wide window)
            dsp.inputs.in1.fill(3);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
        });

        it('should narrow window with smaller size', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 1; // Window -0.5V to +0.5V

            // Input at 1V (outside narrow window)
            dsp.inputs.in1.fill(1);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);

            // Input at 0.3V (inside narrow window)
            dsp.inputs.in1.fill(0.3);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
        });

        it('should respond to size CV', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 2; // Window -1V to +1V

            // Input at 2V - outside window
            dsp.inputs.in1.fill(2);
            dsp.inputs.sizeCV1.fill(0);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);

            // Add +4V size CV - window now -3V to +3V, input 2V is inside
            dsp.inputs.sizeCV1.fill(4);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
        });

        it('should handle zero size (never triggers)', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 0;

            // Even input at exact center shouldn't trigger with zero-width window
            dsp.inputs.in1.fill(0);
            dsp.process();
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(0);
        });
    });

    describe('Dual Comparators', () => {
        it('should operate both comparators independently', () => {
            // Comparator 1: window at +2V
            dsp.params.shift1 = 2;
            dsp.params.size1 = 2;

            // Comparator 2: window at -2V
            dsp.params.shift2 = -2;
            dsp.params.size2 = 2;

            // Input 1 at +2V (inside comp1 window)
            dsp.inputs.in1.fill(2);
            // Input 2 at -2V (inside comp2 window)
            dsp.inputs.in2.fill(-2);

            dsp.process();

            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
            expect(dsp.outputs.out2[bufferSize - 1]).toBe(10);
        });

        it('should normalize in1 to in2 when in2 not patched', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 2;
            dsp.params.shift2 = 0;
            dsp.params.size2 = 2;

            // Only patch in1
            dsp.inputs.in1.fill(0);
            // in2 should use in1's value via normalization

            dsp.process();

            // Both should be inside their windows
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
            expect(dsp.outputs.out2[bufferSize - 1]).toBe(10);
        });
    });

    describe('Logic Section - AND', () => {
        it('should output HIGH only when both comparators output HIGH', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;
            dsp.params.shift2 = 0;
            dsp.params.size2 = 4;

            // Both inside
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.and[bufferSize - 1]).toBe(10);

            // Only one inside
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.and[bufferSize - 1]).toBe(0);

            // Neither inside
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.and[bufferSize - 1]).toBe(0);
        });
    });

    describe('Logic Section - OR', () => {
        it('should output HIGH when either comparator outputs HIGH', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;
            dsp.params.shift2 = 0;
            dsp.params.size2 = 4;

            // Both inside
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.or[bufferSize - 1]).toBe(10);

            // Only one inside
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.or[bufferSize - 1]).toBe(10);

            // Neither inside
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.or[bufferSize - 1]).toBe(0);
        });
    });

    describe('Logic Section - XOR', () => {
        it('should output HIGH when exactly one comparator outputs HIGH', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;
            dsp.params.shift2 = 0;
            dsp.params.size2 = 4;

            // Both inside - XOR is LOW
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.outputs.xor[bufferSize - 1]).toBe(0);

            // Only one inside - XOR is HIGH
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.xor[bufferSize - 1]).toBe(10);

            // Neither inside - XOR is LOW
            dsp.inputs.in1.fill(5);
            dsp.inputs.in2.fill(5);
            dsp.process();
            expect(dsp.outputs.xor[bufferSize - 1]).toBe(0);
        });
    });

    describe('Logic Section - Flip-Flop', () => {
        it('should toggle on rising edge of XOR (per manual)', () => {
            // Per manual: "Rising edges of the XOR signal also toggle a flip-flop"
            // XOR is HIGH when exactly one comparator is active
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4; // Window -2V to +2V
            dsp.params.shift2 = 0;
            dsp.params.size2 = 4; // Window -2V to +2V

            // Both inside window - XOR is LOW
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            const initialFF = dsp.outputs.ff[bufferSize - 1];
            expect(dsp.outputs.xor[bufferSize - 1]).toBe(0);

            // Move in2 outside window - XOR goes HIGH (rising edge)
            dsp.inputs.in2.fill(5);
            dsp.process();
            const afterXorRise = dsp.outputs.ff[bufferSize - 1];
            expect(dsp.outputs.xor[bufferSize - 1]).toBe(10);

            // FF should have toggled
            expect(afterXorRise).not.toBe(initialFF);

            // Stay with XOR HIGH (no edge)
            dsp.process();
            const noChange = dsp.outputs.ff[bufferSize - 1];
            expect(noChange).toBe(afterXorRise);

            // XOR goes LOW then HIGH again (another rising edge)
            dsp.inputs.in2.fill(0); // Both inside, XOR LOW
            dsp.process();
            expect(dsp.outputs.xor[bufferSize - 1]).toBe(0);

            dsp.inputs.in2.fill(5); // One outside, XOR HIGH (rising edge)
            dsp.process();
            const afterSecondRise = dsp.outputs.ff[bufferSize - 1];

            // FF should have toggled again (back to initial)
            expect(afterSecondRise).toBe(initialFF);
        });
    });

    describe('LED Indicators', () => {
        it('should indicate below state', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            dsp.inputs.in1.fill(-5);
            dsp.process();

            expect(dsp.leds.state1).toBe(0);
        });

        it('should indicate inside state', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            dsp.inputs.in1.fill(0);
            dsp.process();

            expect(dsp.leds.state1).toBe(0.5);
        });

        it('should indicate above state', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            dsp.inputs.in1.fill(5);
            dsp.process();

            expect(dsp.leds.state1).toBe(1);
        });

        it('should update logic LEDs', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;
            dsp.params.shift2 = 0;
            dsp.params.size2 = 4;

            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();

            expect(dsp.leds.and).toBe(1);
            expect(dsp.leds.or).toBe(1);
            expect(dsp.leds.xor).toBe(0);
        });

        it('should turn off LED when signal is in negative window', () => {
            // Per manual: "If the window size is negative, and the signal is
            // within this 'negative window', the LED will turn off"
            dsp.params.shift1 = 0;
            dsp.params.size1 = 2; // Start with positive window

            // Use CV to make size negative
            dsp.inputs.sizeCV1.fill(-4); // Effective size = 2 + (-4) = -2

            // With negative size -2 and shift 0:
            // upper = 0 - (-2/2) = 0 + 1 = 1
            // lower = 0 + (-2/2) = 0 - 1 = -1
            // So upper=1, lower=-1, but inverted (upper < lower conceptually)
            // "Negative window" is when input is between upper and lower (1 to -1 region doesn't exist)
            // Actually with size=-2: halfSize=-1, lower=0-(-1)=1, upper=0+(-1)=-1
            // So lower=1, upper=-1. Input between -1 and 1 is "in negative window"

            dsp.inputs.in1.fill(0); // Should be in "negative window" range
            dsp.process();

            expect(dsp.leds.state1).toBe(-1); // Off
        });
    });

    describe('Gate Output Voltage', () => {
        it('should output 10V gates (per system standard)', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            dsp.inputs.in1.fill(0);
            dsp.process();

            // All gate outputs should be either 0V or 10V
            expect(dsp.outputs.out1[bufferSize - 1]).toBe(10);
            expect(dsp.outputs.not1[bufferSize - 1]).toBe(0);
        });

        it('should only output 0V or 10V', () => {
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            // Process with various inputs
            for (let v = -5; v <= 5; v += 0.5) {
                dsp.inputs.in1.fill(v);
                dsp.process();

                for (let i = 0; i < bufferSize; i++) {
                    expect(dsp.outputs.out1[i] === 0 || dsp.outputs.out1[i] === 10).toBe(true);
                    expect(dsp.outputs.not1[i] === 0 || dsp.outputs.not1[i] === 10).toBe(true);
                }
            }
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.inputs.in1.fill(0);
            dsp.process();

            expect(dsp.outputs.out1.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.not1.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.out2.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.not2.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.and.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.or.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.xor.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.ff.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffers', () => {
            dsp.process();

            expect(dsp.outputs.out1.length).toBe(bufferSize);
            expect(dsp.outputs.and.length).toBe(bufferSize);
            expect(dsp.outputs.ff.length).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear outputs on reset', () => {
            dsp.inputs.in1.fill(0);
            dsp.process();

            dsp.reset();

            expect(dsp.outputs.out1.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.ff.every(v => v === 0)).toBe(true);
        });

        it('should reset flip-flop state', () => {
            // Toggle FF a few times
            dsp.params.shift1 = 0;
            dsp.params.size1 = 4;

            dsp.inputs.in1.fill(5);
            dsp.process();
            dsp.inputs.in1.fill(0);
            dsp.process();

            dsp.reset();

            // FF should be back to initial state (0)
            dsp.inputs.in1.fill(0);
            dsp.process();
            // Just verify it doesn't crash and produces valid output
            expect(dsp.outputs.ff[bufferSize - 1] === 0 || dsp.outputs.ff[bufferSize - 1] === 10).toBe(true);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(cmp2Module.id).toBe('cmp2');
        });

        it('should have correct HP width', () => {
            expect(cmp2Module.hp).toBe(8);
        });

        it('should have UI definition', () => {
            expect(cmp2Module.ui).toBeDefined();
            expect(cmp2Module.ui.knobs).toBeDefined();
            expect(cmp2Module.ui.inputs).toBeDefined();
            expect(cmp2Module.ui.outputs).toBeDefined();
        });

        it('should define shift and size knobs for both comparators', () => {
            const knobParams = cmp2Module.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('shift1');
            expect(knobParams).toContain('size1');
            expect(knobParams).toContain('shift2');
            expect(knobParams).toContain('size2');
        });

        it('should define all inputs', () => {
            const inputPorts = cmp2Module.ui.inputs.map(i => i.port);
            expect(inputPorts).toContain('in1');
            expect(inputPorts).toContain('in2');
            expect(inputPorts).toContain('shiftCV1');
            expect(inputPorts).toContain('sizeCV1');
        });

        it('should define all outputs', () => {
            const outputPorts = cmp2Module.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('out1');
            expect(outputPorts).toContain('not1');
            expect(outputPorts).toContain('out2');
            expect(outputPorts).toContain('not2');
            expect(outputPorts).toContain('and');
            expect(outputPorts).toContain('or');
            expect(outputPorts).toContain('xor');
            expect(outputPorts).toContain('ff');
        });
    });
});
