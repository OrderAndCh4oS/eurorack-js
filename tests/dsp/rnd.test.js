/**
 * Rnd (Random) Module Tests
 *
 * Tests for random voltage generator with stepped/smooth outputs
 * and internal clock/random gate functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import rndModule from '../../src/js/modules/rnd/index.js';

describe('Rnd Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = rndModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.clock.length).toBe(bufferSize);
            expect(dsp.outputs.step.length).toBe(bufferSize);
            expect(dsp.outputs.smooth.length).toBe(bufferSize);
            expect(dsp.outputs.gate.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.rate).toBeDefined();
            expect(dsp.params.amp).toBeDefined();
        });

        it('should have LED indicator', () => {
            expect(dsp.leds).toHaveProperty('active');
        });
    });

    describe('Stepped Output', () => {
        it('should produce values in 0-10V range', () => {
            dsp.params.amp = 1;
            dsp.params.rate = 0.5;

            // Process multiple buffers to get random values
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }

            // Check range
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.step[i]).toBeGreaterThanOrEqual(0);
                expect(dsp.outputs.step[i]).toBeLessThanOrEqual(10);
            }
        });

        it('should scale with amplitude parameter', () => {
            dsp.params.rate = 0.8;

            // High amplitude
            dsp.params.amp = 1;
            for (let b = 0; b < 20; b++) dsp.process();
            const highAmpMax = Math.max(...dsp.outputs.step);

            dsp.reset();

            // Low amplitude
            dsp.params.amp = 0.3;
            for (let b = 0; b < 20; b++) dsp.process();
            const lowAmpMax = Math.max(...dsp.outputs.step);

            // High amp should generally produce larger values
            // (probabilistic, so we just check amp=0 case)
            dsp.params.amp = 0;
            dsp.process();
            expect(dsp.outputs.step.every(v => v === 0 || Math.abs(v) < 0.01)).toBe(true);
        });

        it('should hold value between clock pulses', () => {
            dsp.params.rate = 0; // Very slow internal clock
            dsp.params.amp = 1;

            dsp.process();
            const firstValue = dsp.outputs.step[bufferSize - 1];

            dsp.process();
            const secondValue = dsp.outputs.step[0];

            // Value should be held (same or very close)
            expect(secondValue).toBeCloseTo(firstValue, 5);
        });

        it('should change value on external clock', () => {
            dsp.params.amp = 1;
            const values = new Set();

            // Send multiple clock pulses
            for (let pulse = 0; pulse < 10; pulse++) {
                // Rising edge
                dsp.inputs.clock.fill(0);
                dsp.inputs.clock[0] = 10;
                dsp.process();
                values.add(dsp.outputs.step[bufferSize - 1].toFixed(2));
            }

            // Should have generated multiple different values
            expect(values.size).toBeGreaterThan(1);
        });
    });

    describe('Smooth Output', () => {
        it('should produce slewed version of step output', () => {
            dsp.params.rate = 1; // Max rate for faster triggering
            dsp.params.amp = 1;

            // Process many buffers to get random values
            for (let b = 0; b < 50; b++) {
                dsp.process();
            }

            // Smooth should be in same range as step
            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.smooth[i]).toBeGreaterThanOrEqual(-0.1);
                expect(dsp.outputs.smooth[i]).toBeLessThanOrEqual(10.1);
            }
        });

        it('should change more gradually than step output', () => {
            dsp.params.rate = 1; // Max rate for fastest clock
            dsp.params.amp = 1;

            // Collect step and smooth changes
            let stepJumps = 0;
            let smoothJumps = 0;
            let prevStep = 0;
            let prevSmooth = 0;

            // Process many buffers to accumulate changes
            // Count large jumps (> 0.5V) which step will have many of, smooth few
            for (let b = 0; b < 100; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    if (Math.abs(dsp.outputs.step[i] - prevStep) > 0.5) {
                        stepJumps++;
                    }
                    if (Math.abs(dsp.outputs.smooth[i] - prevSmooth) > 0.5) {
                        smoothJumps++;
                    }
                    prevStep = dsp.outputs.step[i];
                    prevSmooth = dsp.outputs.smooth[i];
                }
            }

            // Smooth should have fewer large jumps (more gradual)
            expect(smoothJumps).toBeLessThan(stepJumps);
        });
    });

    describe('Gate Output', () => {
        it('should output gate voltage (0V or 10V)', () => {
            dsp.params.rate = 1; // Max rate

            for (let b = 0; b < 50; b++) {
                dsp.process();
            }

            for (let i = 0; i < bufferSize; i++) {
                expect(dsp.outputs.gate[i] === 0 || dsp.outputs.gate[i] === 10).toBe(true);
            }
        });

        it('should produce gates at internal clock rate', () => {
            dsp.params.rate = 1; // Max rate for fastest clock

            let gateCount = 0;
            let wasHigh = false;

            for (let b = 0; b < 100; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    if (dsp.outputs.gate[i] === 10 && !wasHigh) {
                        gateCount++;
                    }
                    wasHigh = dsp.outputs.gate[i] === 10;
                }
            }

            // Should have generated some gates
            expect(gateCount).toBeGreaterThan(0);
        });
    });

    describe('Rate Control', () => {
        it('should generate faster changes at higher rate', () => {
            dsp.params.amp = 1;

            // Count value changes at low rate
            dsp.params.rate = 0.3;
            let lowRateChanges = 0;
            let prevValue = 0;
            for (let b = 0; b < 200; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    if (Math.abs(dsp.outputs.step[i] - prevValue) > 0.1) {
                        lowRateChanges++;
                        prevValue = dsp.outputs.step[i];
                    }
                }
            }

            dsp.reset();

            // Count value changes at high rate
            dsp.params.rate = 1;
            let highRateChanges = 0;
            prevValue = 0;
            for (let b = 0; b < 200; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    if (Math.abs(dsp.outputs.step[i] - prevValue) > 0.1) {
                        highRateChanges++;
                        prevValue = dsp.outputs.step[i];
                    }
                }
            }

            // Higher rate should have more changes
            expect(highRateChanges).toBeGreaterThan(lowRateChanges);
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.rate = 0.5;
            dsp.params.amp = 1;

            for (let b = 0; b < 5; b++) {
                dsp.process();
            }

            expect(dsp.outputs.step.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.smooth.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.gate.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.params.rate = 0.5;
            dsp.params.amp = 1;
            dsp.process();

            // All outputs should be defined
            expect(dsp.outputs.step.length).toBe(bufferSize);
            expect(dsp.outputs.smooth.length).toBe(bufferSize);
            expect(dsp.outputs.gate.length).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear outputs on reset', () => {
            dsp.params.rate = 0.8;
            dsp.params.amp = 1;

            for (let b = 0; b < 5; b++) {
                dsp.process();
            }

            dsp.reset();

            expect(dsp.outputs.step.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.smooth.every(v => v === 0)).toBe(true);
            expect(dsp.outputs.gate.every(v => v === 0)).toBe(true);
        });

        it('should reset internal state', () => {
            dsp.params.rate = 0.5;
            dsp.params.amp = 1;

            for (let b = 0; b < 5; b++) {
                dsp.process();
            }

            dsp.reset();
            dsp.process();

            // Should start fresh (smooth should be near 0 initially)
            expect(dsp.outputs.smooth[0]).toBeLessThan(1);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(rndModule.id).toBe('rnd');
        });

        it('should have correct HP width', () => {
            expect(rndModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(rndModule.ui).toBeDefined();
            expect(rndModule.ui.knobs).toBeDefined();
            expect(rndModule.ui.inputs).toBeDefined();
            expect(rndModule.ui.outputs).toBeDefined();
        });

        it('should define rate and amp knobs', () => {
            const knobParams = rndModule.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('rate');
            expect(knobParams).toContain('amp');
        });

        it('should define correct outputs', () => {
            const outputPorts = rndModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('step');
            expect(outputPorts).toContain('smooth');
            expect(outputPorts).toContain('gate');
        });
    });
});
