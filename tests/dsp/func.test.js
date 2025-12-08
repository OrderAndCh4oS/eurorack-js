/**
 * FUNC (Function Generator) Module Tests
 *
 * Tests for function generator based on Make Noise Function/Maths.
 * Generates envelopes, LFOs, slew limiting, and complex CV functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import funcModule from '../../src/js/modules/func/index.js';

describe('FUNC Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = funcModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.in.length).toBe(bufferSize);
            expect(dsp.inputs.trig.length).toBe(bufferSize);
            expect(dsp.inputs.riseCV.length).toBe(bufferSize);
            expect(dsp.inputs.fallCV.length).toBe(bufferSize);
            expect(dsp.inputs.cycleCV.length).toBe(bufferSize);
            expect(dsp.outputs.out.length).toBe(bufferSize);
            expect(dsp.outputs.inv.length).toBe(bufferSize);
            expect(dsp.outputs.eor.length).toBe(bufferSize);
            expect(dsp.outputs.eoc.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.rise).toBeDefined();
            expect(dsp.params.fall).toBeDefined();
            expect(dsp.params.curve).toBeDefined();
            expect(dsp.params.cycle).toBeDefined();
        });

        it('should have LED indicator', () => {
            expect(dsp.leds).toHaveProperty('level');
        });

        it('should start with output at 0', () => {
            dsp.process();
            expect(dsp.outputs.out[0]).toBe(0);
        });
    });

    describe('Trigger Response', () => {
        it('should start rising on trigger', () => {
            dsp.params.rise = 0.5;
            dsp.params.fall = 0.5;

            // Send trigger
            dsp.inputs.trig[0] = 10;
            dsp.process();

            // Output should start rising
            expect(dsp.outputs.out[bufferSize - 1]).toBeGreaterThan(0);
        });

        it('should rise then fall after trigger', () => {
            dsp.params.rise = 0.01; // Very fast
            dsp.params.fall = 0.01;

            // Trigger
            dsp.inputs.trig[0] = 10;

            // Process enough buffers to complete cycle
            let maxOutput = 0;
            let sawFall = false;

            for (let b = 0; b < 50; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();

                const currentMax = Math.max(...dsp.outputs.out);
                if (currentMax > maxOutput) {
                    maxOutput = currentMax;
                } else if (maxOutput > 5 && currentMax < maxOutput - 1) {
                    sawFall = true;
                }
            }

            expect(maxOutput).toBeGreaterThan(5);
            expect(sawFall).toBe(true);
        });

        it('should ignore trigger while rising', () => {
            dsp.params.rise = 0.5; // Slow rise
            dsp.params.fall = 0.1;

            // Initial trigger
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const level1 = dsp.outputs.out[bufferSize - 1];

            // Another trigger during rise
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const level2 = dsp.outputs.out[bufferSize - 1];

            // Should continue rising, not restart
            expect(level2).toBeGreaterThan(level1);
        });
    });

    describe('Output Range', () => {
        it('should output in 0-10V range', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.01;
            dsp.params.cycle = 1;

            // Run cycling
            for (let b = 0; b < 100; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    expect(dsp.outputs.out[i]).toBeGreaterThanOrEqual(0);
                    expect(dsp.outputs.out[i]).toBeLessThanOrEqual(10);
                }
            }
        });

        it('should reach near 10V at peak', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.5;

            // Trigger
            dsp.inputs.trig[0] = 10;

            let maxOutput = 0;
            for (let b = 0; b < 30; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();
                maxOutput = Math.max(maxOutput, ...dsp.outputs.out);
            }

            expect(maxOutput).toBeGreaterThan(9);
        });
    });

    describe('Inverted Output', () => {
        it('should be inverse of main output', () => {
            dsp.params.rise = 0.01;
            dsp.params.cycle = 1;

            for (let b = 0; b < 20; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    expect(dsp.outputs.inv[i]).toBeCloseTo(10 - dsp.outputs.out[i], 3);
                }
            }
        });

        it('should be 10V when output is 0V', () => {
            dsp.process();
            expect(dsp.outputs.inv[0]).toBeCloseTo(10, 1);
        });
    });

    describe('Rise Time', () => {
        it('should rise faster with low rise value', () => {
            // Fast rise
            dsp.params.rise = 0.01;
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const fastLevel = dsp.outputs.out[bufferSize - 1];

            dsp.reset();

            // Slow rise
            dsp.params.rise = 0.9;
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const slowLevel = dsp.outputs.out[bufferSize - 1];

            expect(fastLevel).toBeGreaterThan(slowLevel);
        });

        it('should be modulated by riseCV', () => {
            dsp.params.rise = 0.5;

            // No CV
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const baseLevel = dsp.outputs.out[bufferSize - 1];

            dsp.reset();

            // Negative CV (faster)
            dsp.inputs.trig[0] = 10;
            dsp.inputs.riseCV.fill(-5);
            dsp.process();
            const fasterLevel = dsp.outputs.out[bufferSize - 1];

            expect(fasterLevel).toBeGreaterThan(baseLevel);
        });
    });

    describe('Fall Time', () => {
        it('should fall faster with low fall value', () => {
            dsp.params.rise = 0.001; // Near instant
            dsp.params.curve = 0.5; // Linear

            // Fast fall
            dsp.params.fall = 0.01;
            dsp.inputs.trig[0] = 10;
            for (let b = 0; b < 10; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();
            }
            const fastFallLevel = dsp.outputs.out[bufferSize - 1];

            dsp.reset();

            // Slow fall
            dsp.params.fall = 0.9;
            dsp.inputs.trig[0] = 10;
            for (let b = 0; b < 10; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();
            }
            const slowFallLevel = dsp.outputs.out[bufferSize - 1];

            expect(slowFallLevel).toBeGreaterThan(fastFallLevel);
        });

        it('should be modulated by fallCV', () => {
            dsp.params.rise = 0.001;
            dsp.params.fall = 0.5;

            // Trigger and let it start falling
            dsp.inputs.trig[0] = 10;
            for (let b = 0; b < 5; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();
            }
            const baseLevel = dsp.outputs.out[bufferSize - 1];

            dsp.reset();

            // With negative CV (faster fall)
            dsp.inputs.trig[0] = 10;
            for (let b = 0; b < 5; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.inputs.fallCV.fill(-5);
                dsp.process();
            }
            const fasterLevel = dsp.outputs.out[bufferSize - 1];

            expect(fasterLevel).toBeLessThan(baseLevel);
        });
    });

    describe('Curve Shaping', () => {
        it('should produce different shapes with different curves', () => {
            dsp.params.rise = 0.2;
            dsp.params.fall = 0.2;

            // Logarithmic curve - collect first buffer sample
            dsp.params.curve = 0;
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const logFirst = dsp.outputs.out[bufferSize - 1];

            dsp.reset();

            // Exponential curve - collect first buffer sample
            dsp.params.curve = 1;
            dsp.inputs.trig[0] = 10;
            dsp.process();
            const expFirst = dsp.outputs.out[bufferSize - 1];

            // With same timing, different curves should produce different values
            // Log curve rises faster at start, exp curve rises slower at start
            expect(Math.abs(logFirst - expFirst)).toBeGreaterThan(1);
        });

        it('should be symmetric with linear curve', () => {
            dsp.params.rise = 0.1;
            dsp.params.fall = 0.1;
            dsp.params.curve = 0.5; // Linear
            dsp.params.cycle = 1;

            // Collect samples during cycle
            const samples = [];
            for (let b = 0; b < 50; b++) {
                dsp.process();
                samples.push(...dsp.outputs.out);
            }

            // Find peak
            const peakIndex = samples.indexOf(Math.max(...samples));

            // Check symmetry around peak (roughly)
            if (peakIndex > 100 && peakIndex < samples.length - 100) {
                const beforePeak = samples[peakIndex - 50];
                const afterPeak = samples[peakIndex + 50];
                // With linear curve and equal rise/fall, should be roughly symmetric
                expect(Math.abs(beforePeak - afterPeak)).toBeLessThan(2);
            }
        });
    });

    describe('Cycle Mode', () => {
        it('should self-trigger when cycle enabled', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.01;
            dsp.params.cycle = 1;

            // No external trigger needed
            let sawMultipleCycles = false;
            let cycleCount = 0;
            let wasLow = true;

            for (let b = 0; b < 100; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    if (wasLow && dsp.outputs.out[i] > 5) {
                        cycleCount++;
                        wasLow = false;
                    }
                    if (dsp.outputs.out[i] < 1) {
                        wasLow = true;
                    }
                }
            }

            expect(cycleCount).toBeGreaterThan(2);
        });

        it('should stop cycling when cycle disabled', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.01;
            dsp.params.cycle = 1;

            // Let it cycle
            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            // Disable cycle
            dsp.params.cycle = 0;

            // Let any current cycle complete
            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            // Should settle to 0
            const lastOutput = dsp.outputs.out[bufferSize - 1];
            expect(lastOutput).toBeLessThan(1);
        });

        it('should respond to cycleCV gate input', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.01;
            dsp.params.cycle = 0; // Panel switch off

            // CV gate high should enable cycling
            dsp.inputs.cycleCV.fill(5);

            let sawOutput = false;
            for (let b = 0; b < 50; b++) {
                dsp.process();
                if (Math.max(...dsp.outputs.out) > 5) {
                    sawOutput = true;
                }
            }

            expect(sawOutput).toBe(true);
        });
    });

    describe('EOR (End of Rise) Gate', () => {
        it('should output gate at peak', () => {
            dsp.params.rise = 0.05;
            dsp.params.fall = 0.5;

            dsp.inputs.trig[0] = 10;

            let sawEOR = false;
            for (let b = 0; b < 30; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();

                for (let i = 0; i < bufferSize; i++) {
                    if (dsp.outputs.eor[i] > 5) {
                        sawEOR = true;
                    }
                }
            }

            expect(sawEOR).toBe(true);
        });

        it('should be 0V or 10V only', () => {
            dsp.params.rise = 0.1;
            dsp.params.fall = 0.1;
            dsp.params.cycle = 1;

            for (let b = 0; b < 50; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    const eor = dsp.outputs.eor[i];
                    expect(eor === 0 || eor === 10).toBe(true);
                }
            }
        });
    });

    describe('EOC (End of Cycle) Gate', () => {
        it('should output gate at end of fall', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.05;

            dsp.inputs.trig[0] = 10;

            let sawEOC = false;
            for (let b = 0; b < 50; b++) {
                if (b > 0) dsp.inputs.trig.fill(0);
                dsp.process();

                for (let i = 0; i < bufferSize; i++) {
                    if (dsp.outputs.eoc[i] > 5) {
                        sawEOC = true;
                    }
                }
            }

            expect(sawEOC).toBe(true);
        });

        it('should be 0V or 10V only', () => {
            dsp.params.rise = 0.1;
            dsp.params.fall = 0.1;
            dsp.params.cycle = 1;

            for (let b = 0; b < 50; b++) {
                dsp.process();
                for (let i = 0; i < bufferSize; i++) {
                    const eoc = dsp.outputs.eoc[i];
                    expect(eoc === 0 || eoc === 10).toBe(true);
                }
            }
        });
    });

    describe('Slew Limiter Mode', () => {
        it('should smooth sudden input changes', () => {
            dsp.params.rise = 0.3;
            dsp.params.fall = 0.3;

            // Sudden step from 0 to 5V
            dsp.inputs.in.fill(5);
            dsp.process();

            // Output should not instantly jump to 5V
            expect(dsp.outputs.out[0]).toBeLessThan(5);
            expect(dsp.outputs.out[bufferSize - 1]).toBeLessThan(5);
        });

        it('should eventually reach target', () => {
            dsp.params.rise = 0.1;
            dsp.params.fall = 0.1;

            // Step to 5V
            dsp.inputs.in.fill(5);

            for (let b = 0; b < 100; b++) {
                dsp.process();
            }

            // Should reach target
            expect(dsp.outputs.out[bufferSize - 1]).toBeGreaterThan(4.5);
        });

        it('should follow input down with fall rate', () => {
            dsp.params.rise = 0.01;
            dsp.params.fall = 0.5; // Slow fall

            // Rise to 5V
            dsp.inputs.in.fill(5);
            for (let b = 0; b < 100; b++) {
                dsp.process();
            }
            const peakLevel = dsp.outputs.out[bufferSize - 1];
            expect(peakLevel).toBeGreaterThan(4); // Verify we reached target

            // Drop to 1V (above 0.1V threshold to stay in slew mode)
            dsp.inputs.in.fill(1);
            dsp.process();

            // Should not instantly drop due to slow fall rate
            expect(dsp.outputs.out[bufferSize - 1]).toBeGreaterThan(2);
        });
    });

    describe('LED Indicator', () => {
        it('should reflect output level', () => {
            dsp.params.rise = 0.1;
            dsp.params.cycle = 1;

            // LED should follow output
            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            // LED should be proportional to output
            const outputLevel = dsp.outputs.out[bufferSize - 1];
            expect(dsp.leds.level).toBeGreaterThan(0);
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            dsp.params.rise = 0.1;
            dsp.params.fall = 0.1;
            dsp.params.cycle = 1;

            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            expect(dsp.outputs.out.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.inv.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.eor.every(v => !isNaN(v))).toBe(true);
            expect(dsp.outputs.eoc.every(v => !isNaN(v))).toBe(true);
        });

        it('should fill entire buffer', () => {
            dsp.process();

            expect(dsp.outputs.out.length).toBe(bufferSize);
            expect(dsp.outputs.inv.length).toBe(bufferSize);
            expect(dsp.outputs.eor.length).toBe(bufferSize);
            expect(dsp.outputs.eoc.length).toBe(bufferSize);
        });
    });

    describe('Reset', () => {
        it('should clear state on reset', () => {
            dsp.params.cycle = 1;

            // Build up state
            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            dsp.reset();
            dsp.params.cycle = 0;
            dsp.process();

            expect(dsp.outputs.out[0]).toBe(0);
        });

        it('should reset LED', () => {
            dsp.params.cycle = 1;

            for (let b = 0; b < 10; b++) {
                dsp.process();
            }

            dsp.reset();

            expect(dsp.leds.level).toBe(0);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(funcModule.id).toBe('func');
        });

        it('should have UI definition', () => {
            expect(funcModule.ui).toBeDefined();
            expect(funcModule.ui.knobs).toBeDefined();
            expect(funcModule.ui.inputs).toBeDefined();
            expect(funcModule.ui.outputs).toBeDefined();
        });

        it('should define rise, fall, and curve knobs', () => {
            const knobParams = funcModule.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('rise');
            expect(knobParams).toContain('fall');
            expect(knobParams).toContain('curve');
        });

        it('should define all outputs', () => {
            const outputPorts = funcModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('out');
            expect(outputPorts).toContain('inv');
            expect(outputPorts).toContain('eor');
            expect(outputPorts).toContain('eoc');
        });
    });
});
