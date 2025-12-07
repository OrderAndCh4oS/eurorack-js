import { describe, it, expect, beforeEach } from 'vitest';
import seqModule from '../../src/js/modules/seq/index.js';

// Helper to create SEQ instance
const createSeq = (options = {}) => seqModule.createDSP(options);

/**
 * SEQ - 8 Step Analog Sequencer Tests
 *
 * Based on Doepfer A-155-2 specifications:
 * - 8 step CV knobs (0-1V / 0-2V / 0-4V range selectable)
 * - Per-step gate on/off
 * - Clock input (+3V threshold)
 * - Reset input (+3V threshold)
 * - CV output (unquantized)
 * - Gate output (0V / +10V)
 * - 8 direction modes: up, down, 2x up, 2x down, pendulum1, 2x pendulum1, pendulum2, random
 * - Adjustable sequence length (1-8 steps)
 * - Per-step ratcheting (1x, 2x, 3x, 4x)
 */
describe('seq', () => {
    describe('initialization', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128, sampleRate: 48000 });
        });

        it('should create seq instance', () => {
            expect(seq).toBeDefined();
        });

        it('should have 8 step params (step1-step8)', () => {
            expect(seq.params).toHaveProperty('step1');
            expect(seq.params).toHaveProperty('step2');
            expect(seq.params).toHaveProperty('step3');
            expect(seq.params).toHaveProperty('step4');
            expect(seq.params).toHaveProperty('step5');
            expect(seq.params).toHaveProperty('step6');
            expect(seq.params).toHaveProperty('step7');
            expect(seq.params).toHaveProperty('step8');
        });

        it('should have default step values of 0', () => {
            for (let i = 1; i <= 8; i++) {
                expect(seq.params[`step${i}`]).toBe(0);
            }
        });

        it('should have range param (0=1V, 1=2V, 2=4V)', () => {
            expect(seq.params).toHaveProperty('range');
            expect(seq.params.range).toBe(1); // Default 2V
        });

        it('should have length param (1-8)', () => {
            expect(seq.params).toHaveProperty('length');
            expect(seq.params.length).toBe(8); // Default full 8 steps
        });

        it('should have direction param', () => {
            expect(seq.params).toHaveProperty('direction');
            expect(seq.params.direction).toBe(0); // Default up
        });

        it('should have clock and reset inputs', () => {
            expect(seq.inputs).toHaveProperty('clock');
            expect(seq.inputs).toHaveProperty('reset');
            expect(seq.inputs.clock.length).toBe(128);
            expect(seq.inputs.reset.length).toBe(128);
        });

        it('should have cv and gate outputs', () => {
            expect(seq.outputs).toHaveProperty('cv');
            expect(seq.outputs).toHaveProperty('gate');
            expect(seq.outputs.cv.length).toBe(128);
            expect(seq.outputs.gate.length).toBe(128);
        });

        it('should have 8 step LEDs', () => {
            for (let i = 1; i <= 8; i++) {
                expect(seq.leds).toHaveProperty(`step${i}`);
            }
        });

        it('should have process function', () => {
            expect(typeof seq.process).toBe('function');
        });

        it('should have reset function', () => {
            expect(typeof seq.reset).toBe('function');
        });
    });

    describe('clock input', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should advance on clock rising edge (>3V threshold)', () => {
            seq.params.step1 = 0.5;
            seq.params.step2 = 1.0;

            // Process without clock
            seq.process();
            const initialCV = seq.outputs.cv[0];

            // Send clock pulse
            seq.inputs.clock.fill(5);
            seq.process();

            // Should have advanced to step 2
            expect(seq.outputs.cv[0]).not.toBe(initialCV);
        });

        it('should NOT trigger below 3V', () => {
            seq.params.step1 = 0.5;
            seq.params.step2 = 1.0;

            seq.process();
            const step = seq.getCurrentStep();

            // Try clock at 2.9V - below threshold
            seq.inputs.clock.fill(2.9);
            seq.process();

            // Drop to 0
            seq.inputs.clock.fill(0);
            seq.process();

            // Try again at 2.9V
            seq.inputs.clock.fill(2.9);
            seq.process();

            expect(seq.getCurrentStep()).toBe(step);
        });

        it('should trigger at exactly 3V', () => {
            seq.process();
            const initialStep = seq.getCurrentStep();

            // Clock at 3V
            seq.inputs.clock.fill(3);
            seq.process();

            // Drop and rise again
            seq.inputs.clock.fill(0);
            seq.process();
            seq.inputs.clock.fill(3);
            seq.process();

            expect(seq.getCurrentStep()).not.toBe(initialStep);
        });

        it('should only trigger on rising edge, not while held high', () => {
            seq.process();

            // First rising edge
            seq.inputs.clock.fill(5);
            seq.process();
            const stepAfterFirst = seq.getCurrentStep();

            // Hold high - should not advance
            seq.process();
            expect(seq.getCurrentStep()).toBe(stepAfterFirst);

            // Still high
            seq.process();
            expect(seq.getCurrentStep()).toBe(stepAfterFirst);
        });
    });

    describe('reset input', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should reset to step 1 on reset rising edge', () => {
            // Advance a few steps
            for (let i = 0; i < 6; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
            }

            expect(seq.getCurrentStep()).toBeGreaterThan(0);

            // Send reset
            seq.inputs.reset.fill(5);
            seq.process();

            expect(seq.getCurrentStep()).toBe(0);
        });

        it('should require >3V for reset', () => {
            // Advance
            seq.inputs.clock.fill(5);
            seq.process();
            seq.inputs.clock.fill(0);
            seq.process();
            seq.inputs.clock.fill(5);
            seq.process();

            const stepBefore = seq.getCurrentStep();

            // Try reset at 2.9V
            seq.inputs.reset.fill(2.9);
            seq.process();

            expect(seq.getCurrentStep()).toBe(stepBefore);
        });
    });

    describe('CV output', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should output step voltage scaled by range (1V mode)', () => {
            seq.params.range = 0; // 1V mode
            seq.params.step1 = 1.0; // Full value

            seq.process();

            expect(seq.outputs.cv[0]).toBeCloseTo(1.0, 2);
        });

        it('should output step voltage scaled by range (2V mode)', () => {
            seq.params.range = 1; // 2V mode
            seq.params.step1 = 1.0; // Full value

            seq.process();

            expect(seq.outputs.cv[0]).toBeCloseTo(2.0, 2);
        });

        it('should output step voltage scaled by range (4V mode)', () => {
            seq.params.range = 2; // 4V mode
            seq.params.step1 = 1.0; // Full value

            seq.process();

            expect(seq.outputs.cv[0]).toBeCloseTo(4.0, 2);
        });

        it('should output 0V when step value is 0', () => {
            seq.params.step1 = 0;

            seq.process();

            expect(seq.outputs.cv[0]).toBe(0);
        });

        it('should output intermediate values', () => {
            seq.params.range = 1; // 2V mode
            seq.params.step1 = 0.5;

            seq.process();

            expect(seq.outputs.cv[0]).toBeCloseTo(1.0, 2); // 0.5 * 2V = 1V
        });

        it('should change CV when step advances', () => {
            seq.params.step1 = 0.25;
            seq.params.step2 = 0.75;
            seq.params.range = 2; // 4V mode

            seq.process();
            const cv1 = seq.outputs.cv[0]; // 0.25 * 4 = 1V

            seq.inputs.clock.fill(5);
            seq.process();
            const cv2 = seq.outputs.cv[0]; // 0.75 * 4 = 3V

            expect(cv1).toBeCloseTo(1.0, 2);
            expect(cv2).toBeCloseTo(3.0, 2);
        });
    });

    describe('gate output', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should output 10V gate when step gate is on', () => {
            seq.params.gate1 = 1; // Gate on

            seq.process();

            expect(seq.outputs.gate[0]).toBe(10);
        });

        it('should output 0V gate when step gate is off', () => {
            seq.params.gate1 = 0; // Gate off

            seq.process();

            expect(seq.outputs.gate[0]).toBe(0);
        });

        it('should follow per-step gate settings', () => {
            seq.params.gate1 = 1;
            seq.params.gate2 = 0;
            seq.params.gate3 = 1;

            seq.process();
            expect(seq.outputs.gate[0]).toBe(10);

            seq.inputs.clock.fill(5);
            seq.process();
            expect(seq.outputs.gate[0]).toBe(0);

            seq.inputs.clock.fill(0);
            seq.process();
            seq.inputs.clock.fill(5);
            seq.process();
            expect(seq.outputs.gate[0]).toBe(10);
        });

        it('should have all gates on by default', () => {
            for (let i = 1; i <= 8; i++) {
                expect(seq.params[`gate${i}`]).toBe(1);
            }
        });
    });

    describe('sequence length', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should wrap at sequence length', () => {
            seq.params.length = 4; // 4 step sequence

            // Advance 5 times (should wrap back to step 1)
            for (let i = 0; i < 10; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
            }

            // Should have wrapped (step 0, 1, 2, 3, 0, ...)
            expect(seq.getCurrentStep()).toBeLessThan(4);
        });

        it('should support length of 1 (single step)', () => {
            seq.params.length = 1;
            seq.params.step1 = 0.5;

            // Advance multiple times
            for (let i = 0; i < 6; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
            }

            // Should always be at step 0
            expect(seq.getCurrentStep()).toBe(0);
        });

        it('should support full length of 8', () => {
            seq.params.length = 8;

            // Advance through all 8 steps
            for (let i = 0; i < 16; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
            }

            // Should wrap after 8
            expect(seq.getCurrentStep()).toBeLessThan(8);
        });
    });

    describe('direction modes', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
            seq.params.length = 4;
            seq.params.step1 = 0.1;
            seq.params.step2 = 0.2;
            seq.params.step3 = 0.3;
            seq.params.step4 = 0.4;
        });

        it('should play forward in up mode (direction=0)', () => {
            seq.params.direction = 0;

            const steps = [];
            for (let i = 0; i < 8; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
                if (i % 2 === 1) steps.push(seq.getCurrentStep());
            }

            // Should go 0, 1, 2, 3, 0, ...
            expect(steps[0]).toBe(1);
            expect(steps[1]).toBe(2);
            expect(steps[2]).toBe(3);
            expect(steps[3]).toBe(0);
        });

        it('should play backward in down mode (direction=1)', () => {
            seq.params.direction = 1;

            const steps = [];
            for (let i = 0; i < 8; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
                if (i % 2 === 1) steps.push(seq.getCurrentStep());
            }

            // Should go 3, 2, 1, 0, 3, ...
            expect(steps[0]).toBe(3);
            expect(steps[1]).toBe(2);
        });

        it('should play pendulum in pendulum mode (direction=4)', () => {
            seq.params.direction = 4; // pendulum1
            seq.params.length = 4;

            const steps = [];
            for (let i = 0; i < 14; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
                if (i % 2 === 1) steps.push(seq.getCurrentStep());
            }

            // Should go 0 -> 1 -> 2 -> 3 -> 2 -> 1 -> 0 -> 1 ...
            expect(steps[0]).toBe(1);
            expect(steps[1]).toBe(2);
            expect(steps[2]).toBe(3);
            expect(steps[3]).toBe(2);
            expect(steps[4]).toBe(1);
            expect(steps[5]).toBe(0);
        });

        it('should play random in random mode (direction=7)', () => {
            seq.params.direction = 7;

            // Advance several times
            const steps = [];
            for (let i = 0; i < 20; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
                if (i % 2 === 1) steps.push(seq.getCurrentStep());
            }

            // All steps should be valid (0-3 for length 4)
            steps.forEach(s => {
                expect(s).toBeGreaterThanOrEqual(0);
                expect(s).toBeLessThan(4);
            });

            // Should have some variation (not all same step)
            const unique = new Set(steps);
            expect(unique.size).toBeGreaterThan(1);
        });
    });

    describe('LED indicators', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should light current step LED', () => {
            seq.process();
            expect(seq.leds.step1).toBe(1);
            expect(seq.leds.step2).toBe(0);

            seq.inputs.clock.fill(5);
            seq.process();
            expect(seq.leds.step1).toBe(0);
            expect(seq.leds.step2).toBe(1);
        });

        it('should only light one LED at a time', () => {
            seq.inputs.clock.fill(5);
            seq.process();

            let litCount = 0;
            for (let i = 1; i <= 8; i++) {
                if (seq.leds[`step${i}`] === 1) litCount++;
            }

            expect(litCount).toBe(1);
        });
    });

    describe('reset function', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 128 });
        });

        it('should reset to step 0', () => {
            // Advance several steps
            for (let i = 0; i < 6; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
            }

            seq.reset();

            expect(seq.getCurrentStep()).toBe(0);
        });

        it('should reset direction state', () => {
            seq.params.direction = 4; // pendulum

            // Run for a while
            for (let i = 0; i < 10; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();
            }

            seq.reset();

            // After reset, step should be 0
            expect(seq.getCurrentStep()).toBe(0);

            // First clock after reset should advance from 0 to 1 (forward direction)
            seq.inputs.clock.fill(0);
            seq.process();
            seq.inputs.clock.fill(5);
            seq.process();
            expect(seq.getCurrentStep()).toBe(1);
        });

        it('should clear outputs', () => {
            seq.params.step1 = 1.0;
            seq.params.gate1 = 1;
            seq.process();

            seq.reset();

            expect(seq.outputs.cv[0]).toBe(0);
            expect(seq.outputs.gate[0]).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        let seq;

        beforeEach(() => {
            seq = createSeq({ bufferSize: 512 });
        });

        it('should fill entire CV buffer', () => {
            seq.params.step1 = 0.5;
            seq.process();

            expect(seq.outputs.cv.every(v => !isNaN(v))).toBe(true);
            expect(seq.outputs.cv.every(v => v !== undefined)).toBe(true);
        });

        it('should fill entire gate buffer', () => {
            seq.params.gate1 = 1;
            seq.process();

            expect(seq.outputs.gate.every(v => !isNaN(v))).toBe(true);
            expect(seq.outputs.gate.every(v => v === 0 || v === 10)).toBe(true);
        });

        it('should not produce NaN values', () => {
            // Run through various scenarios
            for (let i = 0; i < 20; i++) {
                seq.inputs.clock.fill(i % 2 === 0 ? 0 : 5);
                seq.process();

                expect(seq.outputs.cv.every(v => !isNaN(v))).toBe(true);
                expect(seq.outputs.gate.every(v => !isNaN(v))).toBe(true);
            }
        });
    });

    describe('Doepfer A-155-2 spec compliance', () => {
        describe('CV range options', () => {
            let seq;

            beforeEach(() => {
                seq = createSeq({ bufferSize: 128 });
            });

            it('should have 3 range options: 1V, 2V, 4V', () => {
                // Range 0 = 1V
                seq.params.range = 0;
                seq.params.step1 = 1.0;
                seq.process();
                expect(seq.outputs.cv[0]).toBeCloseTo(1.0, 2);

                // Range 1 = 2V
                seq.params.range = 1;
                seq.process();
                expect(seq.outputs.cv[0]).toBeCloseTo(2.0, 2);

                // Range 2 = 4V
                seq.params.range = 2;
                seq.process();
                expect(seq.outputs.cv[0]).toBeCloseTo(4.0, 2);
            });
        });

        describe('gate voltage levels', () => {
            let seq;

            beforeEach(() => {
                seq = createSeq({ bufferSize: 128 });
            });

            it('should output 0V for gate off', () => {
                seq.params.gate1 = 0;
                seq.process();
                expect(seq.outputs.gate[0]).toBe(0);
            });

            it('should output +10V for gate on (per A-155-2 spec)', () => {
                seq.params.gate1 = 1;
                seq.process();
                expect(seq.outputs.gate[0]).toBe(10);
            });
        });

        describe('clock threshold (+3V per spec)', () => {
            let seq;

            beforeEach(() => {
                seq = createSeq({ bufferSize: 128 });
            });

            it('should require minimum +3V for clock', () => {
                seq.process();

                // Below threshold
                seq.inputs.clock.fill(2.9);
                seq.process();
                expect(seq.getCurrentStep()).toBe(0);

                // At threshold
                seq.inputs.clock.fill(0);
                seq.process();
                seq.inputs.clock.fill(3.0);
                seq.process();
                expect(seq.getCurrentStep()).toBe(1);
            });
        });

        describe('direction modes (8 per spec)', () => {
            it('should have 8 direction modes', () => {
                // 0: up, 1: down, 2: 2x up, 3: 2x down,
                // 4: pendulum1, 5: 2x pendulum1, 6: pendulum2, 7: random
                const seq = createSeq({ bufferSize: 128 });

                // Should accept all 8 modes
                for (let mode = 0; mode < 8; mode++) {
                    seq.params.direction = mode;
                    expect(() => seq.process()).not.toThrow();
                }
            });
        });
    });
});
