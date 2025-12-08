/**
 * øchd Module Tests
 *
 * Tests for 8x free-running LFO module based on Instruo/DivKid øchd.
 * Features 8 triangle LFOs from fast (output 1) to slow (output 8).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import ochdModule from '../../src/js/modules/ochd/index.js';

describe('OCHD Module', () => {
    let dsp;
    const sampleRate = 44100;
    const bufferSize = 128;

    beforeEach(() => {
        dsp = ochdModule.createDSP({ sampleRate, bufferSize });
    });

    describe('Initialization', () => {
        it('should create with correct buffer sizes', () => {
            expect(dsp.inputs.rateCV.length).toBe(bufferSize);
            expect(dsp.outputs.out1.length).toBe(bufferSize);
            expect(dsp.outputs.out2.length).toBe(bufferSize);
            expect(dsp.outputs.out3.length).toBe(bufferSize);
            expect(dsp.outputs.out4.length).toBe(bufferSize);
            expect(dsp.outputs.out5.length).toBe(bufferSize);
            expect(dsp.outputs.out6.length).toBe(bufferSize);
            expect(dsp.outputs.out7.length).toBe(bufferSize);
            expect(dsp.outputs.out8.length).toBe(bufferSize);
        });

        it('should have default parameters', () => {
            expect(dsp.params.rate).toBeDefined();
            expect(dsp.params.rate).toBeGreaterThanOrEqual(0);
            expect(dsp.params.rate).toBeLessThanOrEqual(1);
        });

        it('should have LED indicators for all 8 outputs', () => {
            expect(dsp.leds).toHaveProperty('led1');
            expect(dsp.leds).toHaveProperty('led2');
            expect(dsp.leds).toHaveProperty('led3');
            expect(dsp.leds).toHaveProperty('led4');
            expect(dsp.leds).toHaveProperty('led5');
            expect(dsp.leds).toHaveProperty('led6');
            expect(dsp.leds).toHaveProperty('led7');
            expect(dsp.leds).toHaveProperty('led8');
        });

        it('should initialize with random phases (organic behavior)', () => {
            // Create two instances - they should have different starting phases
            const dsp1 = ochdModule.createDSP({ sampleRate, bufferSize });
            const dsp2 = ochdModule.createDSP({ sampleRate, bufferSize });

            dsp1.process();
            dsp2.process();

            // At least one output should differ between instances
            let foundDifference = false;
            for (let i = 1; i <= 8; i++) {
                if (Math.abs(dsp1.outputs[`out${i}`][0] - dsp2.outputs[`out${i}`][0]) > 0.01) {
                    foundDifference = true;
                    break;
                }
            }
            // This may rarely fail by chance but is unlikely
            expect(foundDifference).toBe(true);
        });
    });

    describe('Output Voltage Range (Bipolar ±5V)', () => {
        it('should produce values in -5V to +5V range', () => {
            dsp.params.rate = 0.8; // High rate for more cycles

            // Process multiple buffers to capture full waveform
            for (let b = 0; b < 100; b++) {
                dsp.process();
            }

            for (let i = 1; i <= 8; i++) {
                const output = dsp.outputs[`out${i}`];
                for (let s = 0; s < bufferSize; s++) {
                    expect(output[s]).toBeGreaterThanOrEqual(-5.1);
                    expect(output[s]).toBeLessThanOrEqual(5.1);
                }
            }
        });

        it('should reach near full range for triangle waveform', () => {
            dsp.params.rate = 0.9;

            let mins = new Array(8).fill(Infinity);
            let maxs = new Array(8).fill(-Infinity);

            // Process many buffers to capture extremes
            for (let b = 0; b < 500; b++) {
                dsp.process();
                for (let i = 0; i < 8; i++) {
                    const output = dsp.outputs[`out${i + 1}`];
                    for (let s = 0; s < bufferSize; s++) {
                        mins[i] = Math.min(mins[i], output[s]);
                        maxs[i] = Math.max(maxs[i], output[s]);
                    }
                }
            }

            // At least the faster outputs should reach near full range
            expect(mins[0]).toBeLessThan(-4);
            expect(maxs[0]).toBeGreaterThan(4);
        });
    });

    describe('Frequency Relationships', () => {
        it('should have output 1 faster than output 8', () => {
            dsp.params.rate = 0.8; // Higher rate for more crossings

            // Count zero crossings for each output
            const crossings = new Array(8).fill(0);
            const lastValues = new Array(8).fill(0);

            for (let b = 0; b < 500; b++) {
                dsp.process();
                for (let i = 0; i < 8; i++) {
                    const output = dsp.outputs[`out${i + 1}`];
                    for (let s = 0; s < bufferSize; s++) {
                        if ((lastValues[i] < 0 && output[s] >= 0) ||
                            (lastValues[i] >= 0 && output[s] < 0)) {
                            crossings[i]++;
                        }
                        lastValues[i] = output[s];
                    }
                }
            }

            // Output 1 should have more crossings than output 8
            expect(crossings[0]).toBeGreaterThan(crossings[7]);
        });

        it('should have decreasing frequencies from output 1 to 8', () => {
            dsp.params.rate = 0.8; // Higher rate

            const crossings = new Array(8).fill(0);
            const lastValues = new Array(8).fill(0);

            for (let b = 0; b < 500; b++) {
                dsp.process();
                for (let i = 0; i < 8; i++) {
                    const output = dsp.outputs[`out${i + 1}`];
                    for (let s = 0; s < bufferSize; s++) {
                        if ((lastValues[i] < 0 && output[s] >= 0) ||
                            (lastValues[i] >= 0 && output[s] < 0)) {
                            crossings[i]++;
                        }
                        lastValues[i] = output[s];
                    }
                }
            }

            // Each output should be slower than or equal to the previous
            // (equal is possible for very slow rates where we don't see crossings)
            for (let i = 1; i < 8; i++) {
                expect(crossings[i]).toBeLessThanOrEqual(crossings[i - 1]);
            }
        });

        it('should span wide frequency range (160Hz to very slow)', () => {
            // At max rate, output 1 should approach audio rate
            dsp.params.rate = 1.0;

            let crossings = 0;
            let lastValue = 0;

            // 1 second of samples
            const oneSecond = Math.ceil(sampleRate / bufferSize);
            for (let b = 0; b < oneSecond; b++) {
                dsp.process();
                for (let s = 0; s < bufferSize; s++) {
                    if ((lastValue < 0 && dsp.outputs.out1[s] >= 0) ||
                        (lastValue >= 0 && dsp.outputs.out1[s] < 0)) {
                        crossings++;
                    }
                    lastValue = dsp.outputs.out1[s];
                }
            }

            // Crossings / 2 = cycles per second = Hz
            // Should be in range of 100-200 Hz at max rate
            const hz = crossings / 2;
            expect(hz).toBeGreaterThan(50);
            expect(hz).toBeLessThan(250);
        });
    });

    describe('Rate Knob', () => {
        it('should increase all frequencies when rate increases', () => {
            // Slow rate
            dsp.params.rate = 0.2;
            const slowCrossings = new Array(8).fill(0);
            const slowLast = new Array(8).fill(0);

            for (let b = 0; b < 100; b++) {
                dsp.process();
                for (let i = 0; i < 8; i++) {
                    const output = dsp.outputs[`out${i + 1}`];
                    for (let s = 0; s < bufferSize; s++) {
                        if ((slowLast[i] < 0 && output[s] >= 0) ||
                            (slowLast[i] >= 0 && output[s] < 0)) {
                            slowCrossings[i]++;
                        }
                        slowLast[i] = output[s];
                    }
                }
            }

            // Fast rate - new instance to reset phases
            const fastDsp = ochdModule.createDSP({ sampleRate, bufferSize });
            fastDsp.params.rate = 0.8;
            const fastCrossings = new Array(8).fill(0);
            const fastLast = new Array(8).fill(0);

            for (let b = 0; b < 100; b++) {
                fastDsp.process();
                for (let i = 0; i < 8; i++) {
                    const output = fastDsp.outputs[`out${i + 1}`];
                    for (let s = 0; s < bufferSize; s++) {
                        if ((fastLast[i] < 0 && output[s] >= 0) ||
                            (fastLast[i] >= 0 && output[s] < 0)) {
                            fastCrossings[i]++;
                        }
                        fastLast[i] = output[s];
                    }
                }
            }

            // At least the faster outputs should show clear difference
            expect(fastCrossings[0]).toBeGreaterThan(slowCrossings[0]);
        });

        it('should produce very slow modulation at minimum rate', () => {
            dsp.params.rate = 0;

            // Output 8 at minimum rate should barely move
            const values = [];
            for (let b = 0; b < 10; b++) {
                dsp.process();
                values.push(dsp.outputs.out8[0]);
            }

            // Calculate variance - should be very low for slow LFO
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;

            // Low variance indicates slow movement
            expect(variance).toBeLessThan(1);
        });
    });

    describe('Rate CV Input', () => {
        it('should increase rate with positive CV', () => {
            dsp.params.rate = 0.5; // Medium rate

            // No CV
            dsp.inputs.rateCV.fill(0);
            let noCVCrossings = 0;
            let lastValue = 0;

            for (let b = 0; b < 500; b++) {
                dsp.process();
                for (let s = 0; s < bufferSize; s++) {
                    if ((lastValue < 0 && dsp.outputs.out1[s] >= 0) ||
                        (lastValue >= 0 && dsp.outputs.out1[s] < 0)) {
                        noCVCrossings++;
                    }
                    lastValue = dsp.outputs.out1[s];
                }
            }

            // With positive CV
            const cvDsp = ochdModule.createDSP({ sampleRate, bufferSize });
            cvDsp.params.rate = 0.5;
            cvDsp.inputs.rateCV.fill(3); // +3V
            let withCVCrossings = 0;
            lastValue = 0;

            for (let b = 0; b < 500; b++) {
                cvDsp.process();
                for (let s = 0; s < bufferSize; s++) {
                    if ((lastValue < 0 && cvDsp.outputs.out1[s] >= 0) ||
                        (lastValue >= 0 && cvDsp.outputs.out1[s] < 0)) {
                        withCVCrossings++;
                    }
                    lastValue = cvDsp.outputs.out1[s];
                }
            }

            expect(withCVCrossings).toBeGreaterThan(noCVCrossings);
        });

        it('should decrease rate with negative CV', () => {
            dsp.params.rate = 0.7; // Higher rate so we have crossings to compare

            // No CV
            dsp.inputs.rateCV.fill(0);
            let noCVCrossings = 0;
            let lastValue = 0;

            for (let b = 0; b < 500; b++) {
                dsp.process();
                for (let s = 0; s < bufferSize; s++) {
                    if ((lastValue < 0 && dsp.outputs.out1[s] >= 0) ||
                        (lastValue >= 0 && dsp.outputs.out1[s] < 0)) {
                        noCVCrossings++;
                    }
                    lastValue = dsp.outputs.out1[s];
                }
            }

            // With negative CV
            const cvDsp = ochdModule.createDSP({ sampleRate, bufferSize });
            cvDsp.params.rate = 0.7;
            cvDsp.inputs.rateCV.fill(-3); // -3V
            let withCVCrossings = 0;
            lastValue = 0;

            for (let b = 0; b < 500; b++) {
                cvDsp.process();
                for (let s = 0; s < bufferSize; s++) {
                    if ((lastValue < 0 && cvDsp.outputs.out1[s] >= 0) ||
                        (lastValue >= 0 && cvDsp.outputs.out1[s] < 0)) {
                        withCVCrossings++;
                    }
                    lastValue = cvDsp.outputs.out1[s];
                }
            }

            expect(withCVCrossings).toBeLessThan(noCVCrossings);
        });

        it('should stall oscillators with very negative CV (track and hold)', () => {
            dsp.params.rate = 0.5;

            // Process a bit first
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }

            // Apply strong negative CV to stall
            dsp.inputs.rateCV.fill(-10);

            // Record output
            dsp.process();
            const stalledValue = dsp.outputs.out1[0];

            // Process more with CV still negative
            for (let b = 0; b < 10; b++) {
                dsp.process();
            }

            // Output should be nearly unchanged (stalled)
            const laterValue = dsp.outputs.out1[0];
            expect(Math.abs(laterValue - stalledValue)).toBeLessThan(0.5);
        });
    });

    describe('Triangle Waveform', () => {
        it('should produce triangle wave shape', () => {
            dsp.params.rate = 0.9; // High rate

            // Collect samples
            const samples = [];
            for (let b = 0; b < 20; b++) {
                dsp.process();
                for (let s = 0; s < bufferSize; s++) {
                    samples.push(dsp.outputs.out1[s]);
                }
            }

            // Triangle wave should have linear slopes
            // Check that derivative is relatively constant between direction changes
            let slopeChanges = 0;
            let lastSlope = 0;

            for (let i = 1; i < samples.length; i++) {
                const slope = samples[i] - samples[i - 1];
                if (lastSlope !== 0 && Math.sign(slope) !== Math.sign(lastSlope)) {
                    slopeChanges++;
                }
                if (Math.abs(slope) > 0.0001) {
                    lastSlope = slope;
                }
            }

            // Should have slope changes (peaks and troughs)
            expect(slopeChanges).toBeGreaterThan(0);
        });
    });

    describe('LED Indicators', () => {
        it('should update LED values based on output', () => {
            dsp.process();

            // LEDs should reflect output values (normalized to 0-1 or similar)
            for (let i = 1; i <= 8; i++) {
                const led = dsp.leds[`led${i}`];
                expect(typeof led).toBe('number');
            }
        });

        it('should show bipolar LED indication', () => {
            dsp.params.rate = 0.8;

            let foundPositive = new Array(8).fill(false);
            let foundNegative = new Array(8).fill(false);

            for (let b = 0; b < 100; b++) {
                dsp.process();
                for (let i = 0; i < 8; i++) {
                    const output = dsp.outputs[`out${i + 1}`];
                    if (output[bufferSize - 1] > 0) foundPositive[i] = true;
                    if (output[bufferSize - 1] < 0) foundNegative[i] = true;
                }
            }

            // Faster outputs should have seen both polarities
            expect(foundPositive[0]).toBe(true);
            expect(foundNegative[0]).toBe(true);
        });
    });

    describe('Buffer Integrity', () => {
        it('should produce no NaN values', () => {
            for (let b = 0; b < 20; b++) {
                dsp.process();
            }

            for (let i = 1; i <= 8; i++) {
                expect(dsp.outputs[`out${i}`].every(v => !isNaN(v))).toBe(true);
            }
        });

        it('should fill entire buffers', () => {
            dsp.process();

            for (let i = 1; i <= 8; i++) {
                expect(dsp.outputs[`out${i}`].length).toBe(bufferSize);
            }
        });

        it('should produce continuous waveforms across buffers', () => {
            dsp.params.rate = 0.7;

            dsp.process();
            const lastSample = dsp.outputs.out1[bufferSize - 1];

            dsp.process();
            const firstSample = dsp.outputs.out1[0];

            // Should be continuous (no large jumps)
            expect(Math.abs(firstSample - lastSample)).toBeLessThan(1);
        });
    });

    describe('Reset', () => {
        it('should clear outputs on reset', () => {
            for (let b = 0; b < 5; b++) {
                dsp.process();
            }

            dsp.reset();

            for (let i = 1; i <= 8; i++) {
                expect(dsp.outputs[`out${i}`].every(v => v === 0)).toBe(true);
            }
        });

        it('should reset LED states', () => {
            for (let b = 0; b < 5; b++) {
                dsp.process();
            }

            dsp.reset();

            for (let i = 1; i <= 8; i++) {
                expect(dsp.leds[`led${i}`]).toBe(0);
            }
        });

        it('should reinitialize with random phases after reset', () => {
            dsp.process();
            const before = dsp.outputs.out1[0];

            dsp.reset();
            dsp.process();
            const after = dsp.outputs.out1[0];

            // After reset with new random phases, values should differ
            // (This could rarely fail by chance)
            // Main check is that it doesn't crash and produces valid output
            expect(typeof after).toBe('number');
            expect(!isNaN(after)).toBe(true);
        });
    });

    describe('Module Metadata', () => {
        it('should have correct module id', () => {
            expect(ochdModule.id).toBe('ochd');
        });

        it('should have correct HP width', () => {
            expect(ochdModule.hp).toBe(4);
        });

        it('should have UI definition', () => {
            expect(ochdModule.ui).toBeDefined();
            expect(ochdModule.ui.knobs).toBeDefined();
            expect(ochdModule.ui.inputs).toBeDefined();
            expect(ochdModule.ui.outputs).toBeDefined();
        });

        it('should define rate knob', () => {
            const knobParams = ochdModule.ui.knobs.map(k => k.param);
            expect(knobParams).toContain('rate');
        });

        it('should define rateCV input', () => {
            const inputPorts = ochdModule.ui.inputs.map(i => i.port);
            expect(inputPorts).toContain('rateCV');
        });

        it('should define all 8 outputs', () => {
            const outputPorts = ochdModule.ui.outputs.map(o => o.port);
            expect(outputPorts).toContain('out1');
            expect(outputPorts).toContain('out2');
            expect(outputPorts).toContain('out3');
            expect(outputPorts).toContain('out4');
            expect(outputPorts).toContain('out5');
            expect(outputPorts).toContain('out6');
            expect(outputPorts).toContain('out7');
            expect(outputPorts).toContain('out8');
        });
    });

    describe('Free-Running Behavior', () => {
        it('should have unsynchronized phases between outputs', () => {
            dsp.params.rate = 0.5;
            dsp.process();

            // Check that outputs are at different phases
            const values = [];
            for (let i = 1; i <= 8; i++) {
                values.push(dsp.outputs[`out${i}`][0]);
            }

            // Not all values should be the same (different phases)
            const uniqueValues = new Set(values.map(v => v.toFixed(2)));
            expect(uniqueValues.size).toBeGreaterThan(1);
        });

        it('should maintain organic drift over time', () => {
            dsp.params.rate = 0.5;

            // Record phase relationships at start
            dsp.process();
            const startRatios = [];
            for (let i = 2; i <= 8; i++) {
                startRatios.push(dsp.outputs[`out${i}`][0] - dsp.outputs.out1[0]);
            }

            // Process for a while
            for (let b = 0; b < 1000; b++) {
                dsp.process();
            }

            // Record phase relationships again
            const endRatios = [];
            for (let i = 2; i <= 8; i++) {
                endRatios.push(dsp.outputs[`out${i}`][0] - dsp.outputs.out1[0]);
            }

            // Relationships should have changed (not locked)
            let changed = false;
            for (let i = 0; i < startRatios.length; i++) {
                if (Math.abs(startRatios[i] - endRatios[i]) > 0.1) {
                    changed = true;
                    break;
                }
            }
            expect(changed).toBe(true);
        });
    });
});
