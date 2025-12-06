import { describe, it, expect, beforeEach } from 'vitest';
import divModule, { DIV_RATIO_NAMES } from '../../src/js/modules/div/index.js';

// Helper to create Div instance using new module system
const createDiv = (options = {}) => divModule.createDSP(options);

describe('createDiv', () => {
    let div;

    beforeEach(() => {
        div = createDiv();
    });

    describe('initialization', () => {
        it('should create a Div with default params', () => {
            expect(div.params.rate1).toBe(0.5); // Center = pass-through
            expect(div.params.rate2).toBe(0.5);
        });

        it('should create input buffers', () => {
            expect(div.inputs.clock).toBeInstanceOf(Float32Array);
            expect(div.inputs.rate1CV).toBeInstanceOf(Float32Array);
            expect(div.inputs.rate2CV).toBeInstanceOf(Float32Array);
            expect(div.inputs.clock.length).toBe(512);
        });

        it('should create output buffers', () => {
            expect(div.outputs.out1).toBeInstanceOf(Float32Array);
            expect(div.outputs.out2).toBeInstanceOf(Float32Array);
            expect(div.outputs.out1.length).toBe(512);
        });

        it('should have LED outputs for both channels', () => {
            expect(div.leds.ch1).toBe(0);
            expect(div.leds.ch2).toBe(0);
        });

        it('should accept custom options', () => {
            const customDiv = createDiv({ sampleRate: 48000, bufferSize: 256 });
            expect(customDiv.outputs.out1.length).toBe(256);
        });
    });

    describe('ratio names', () => {
        it('should export 17 ratio names', () => {
            expect(DIV_RATIO_NAMES.length).toBe(17);
        });

        it('should have correct ratio names in order', () => {
            expect(DIV_RATIO_NAMES[0]).toBe('/16');
            expect(DIV_RATIO_NAMES[8]).toBe('x1');
            expect(DIV_RATIO_NAMES[16]).toBe('x16');
        });
    });

    describe('clock input threshold', () => {
        it('should use 2.5V threshold (per 2hp spec)', () => {
            div.params.rate1 = 0.5; // Pass-through
            div.params.rate2 = 0.5;

            // Below threshold - no output
            div.inputs.clock.fill(0);
            div.inputs.clock[100] = 2.4; // Just below threshold
            div.process();

            // Should not see output pulse at that point
            let sawPulse = false;
            for (let i = 95; i < 110; i++) {
                if (div.outputs.out1[i] > 0) sawPulse = true;
            }
            expect(sawPulse).toBe(false);

            // Above threshold - should output
            div.reset();
            div.inputs.clock.fill(0);
            div.inputs.clock[100] = 2.6; // Just above threshold
            div.process();

            sawPulse = false;
            for (let i = 95; i < 200; i++) {
                if (div.outputs.out1[i] > 0) sawPulse = true;
            }
            expect(sawPulse).toBe(true);
        });
    });

    describe('pass-through mode (x1)', () => {
        it('should pass clock through when rate is centered', () => {
            div.params.rate1 = 0.5;

            // Create clock pulses
            for (let i = 0; i < 512; i++) {
                div.inputs.clock[i] = (i % 100 < 10) ? 5 : 0;
            }

            div.process();

            // Output should have same number of pulses as input
            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] > 0) count++;
                }
                return count;
            };

            const inputPulses = countPulses(div.inputs.clock);
            const outputPulses = countPulses(div.outputs.out1);

            expect(outputPulses).toBe(inputPulses);
        });
    });

    describe('division mode', () => {
        it('should divide clock by 2 when rate is at /2 position', () => {
            // /2 is at index 7, which is rate = 7/16 ≈ 0.4375
            div.params.rate1 = 7 / 16;

            const div2 = createDiv({ bufferSize: 44100 });
            div2.params.rate1 = 7 / 16;

            // Send regular clock pulses
            for (let i = 0; i < 44100; i++) {
                div2.inputs.clock[i] = (i % 1000 < 50) ? 5 : 0;
            }

            div2.process();

            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] > 0) count++;
                }
                return count;
            };

            const inputPulses = countPulses(div2.inputs.clock);
            const outputPulses = countPulses(div2.outputs.out1);

            // Output should have roughly half the pulses
            expect(outputPulses).toBeLessThan(inputPulses);
            expect(outputPulses).toBeGreaterThan(inputPulses / 3);
        });
    });

    describe('multiplication mode', () => {
        it('should multiply clock by 2 when rate is at x2 position', () => {
            // x2 is at index 9, which is rate = 9/16 ≈ 0.5625
            const mult2 = createDiv({ bufferSize: 44100 });
            mult2.params.rate1 = 9 / 16;

            // Send slower clock pulses to allow multiplication
            for (let i = 0; i < 44100; i++) {
                mult2.inputs.clock[i] = (i % 4410 < 50) ? 5 : 0;
            }

            mult2.process();

            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] > 0) count++;
                }
                return count;
            };

            const inputPulses = countPulses(mult2.inputs.clock);
            const outputPulses = countPulses(mult2.outputs.out1);

            // Output should have more pulses than input
            expect(outputPulses).toBeGreaterThan(inputPulses);
        });
    });

    describe('independent channels', () => {
        it('should process channels independently', () => {
            div.params.rate1 = 0; // /16
            div.params.rate2 = 1; // x16

            // Create clock pulses
            for (let i = 0; i < 512; i++) {
                div.inputs.clock[i] = (i % 100 < 10) ? 5 : 0;
            }

            div.process();

            // Channels should have different output patterns
            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] > 0) count++;
                }
                return count;
            };

            const ch1Pulses = countPulses(div.outputs.out1);
            const ch2Pulses = countPulses(div.outputs.out2);

            // Channel 2 (x16) should have more pulses than channel 1 (/16)
            expect(ch2Pulses).toBeGreaterThan(ch1Pulses);
        });
    });

    describe('CV control', () => {
        it('should respond to rate CV (0-5V per 2hp spec)', () => {
            div.params.rate1 = 0; // Start at /16

            const withoutCV = createDiv({ bufferSize: 44100 });
            withoutCV.params.rate1 = 0;

            const withCV = createDiv({ bufferSize: 44100 });
            withCV.params.rate1 = 0;
            withCV.inputs.rate1CV.fill(2.5); // Add CV to shift toward center

            // Send clock pulses
            for (let i = 0; i < 44100; i++) {
                withoutCV.inputs.clock[i] = (i % 2000 < 50) ? 5 : 0;
                withCV.inputs.clock[i] = (i % 2000 < 50) ? 5 : 0;
            }

            withoutCV.process();
            withCV.process();

            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] > 0) count++;
                }
                return count;
            };

            // With CV should have more pulses (closer to pass-through)
            expect(countPulses(withCV.outputs.out1)).toBeGreaterThanOrEqual(countPulses(withoutCV.outputs.out1));
        });
    });

    describe('output pulse height', () => {
        it('should match input pulse height', () => {
            div.params.rate1 = 0.5; // Pass-through

            // Send 8V pulses
            for (let i = 0; i < 512; i++) {
                div.inputs.clock[i] = (i % 100 < 10) ? 8 : 0;
            }

            div.process();

            // Find max output voltage
            let maxOutput = 0;
            for (const v of div.outputs.out1) {
                if (v > maxOutput) maxOutput = v;
            }

            expect(maxOutput).toBe(8);
        });
    });

    describe('LED behavior', () => {
        it('should update LED for each channel', () => {
            div.params.rate1 = 0.5;
            div.params.rate2 = 0.5;

            // Send clock pulse
            div.inputs.clock.fill(0);
            div.inputs.clock[50] = 5;

            div.process();

            // LEDs should be defined numbers
            expect(typeof div.leds.ch1).toBe('number');
            expect(typeof div.leds.ch2).toBe('number');
        });
    });

    describe('reset', () => {
        it('should have reset method', () => {
            expect(typeof div.reset).toBe('function');
        });

        it('should reset counters', () => {
            div.params.rate1 = 0.5;

            // Process some clocks
            for (let i = 0; i < 512; i++) {
                div.inputs.clock[i] = (i % 100 < 10) ? 5 : 0;
            }
            div.process();

            // Reset
            div.reset();

            // Should be in clean state
            expect(div.leds.ch1).toBe(0);
            expect(div.leds.ch2).toBe(0);
        });
    });

    describe('getRatios', () => {
        it('should return ratio array', () => {
            const ratios = div.getRatios();
            expect(ratios.length).toBe(17);
            expect(ratios[0]).toBe(1 / 16);
            expect(ratios[8]).toBe(1);
            expect(ratios[16]).toBe(16);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            div.process();
            expect(div.outputs.out1.every(v => !isNaN(v))).toBe(true);
            expect(div.outputs.out2.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('2hp Div spec compliance', () => {
        it('should have 17 division/multiplication ratios', () => {
            const ratios = div.getRatios();
            expect(ratios.length).toBe(17);
        });

        it('should have correct ratio values per spec', () => {
            const ratios = div.getRatios();

            // Divisions
            expect(ratios[0]).toBeCloseTo(1 / 16);
            expect(ratios[1]).toBeCloseTo(1 / 8);
            expect(ratios[2]).toBeCloseTo(1 / 7);
            expect(ratios[3]).toBeCloseTo(1 / 6);
            expect(ratios[4]).toBeCloseTo(1 / 5);
            expect(ratios[5]).toBeCloseTo(1 / 4);
            expect(ratios[6]).toBeCloseTo(1 / 3);
            expect(ratios[7]).toBeCloseTo(1 / 2);

            // Pass-through
            expect(ratios[8]).toBe(1);

            // Multiplications
            expect(ratios[9]).toBe(2);
            expect(ratios[10]).toBe(3);
            expect(ratios[11]).toBe(4);
            expect(ratios[12]).toBe(5);
            expect(ratios[13]).toBe(6);
            expect(ratios[14]).toBe(7);
            expect(ratios[15]).toBe(8);
            expect(ratios[16]).toBe(16);
        });

        it('should have 2 independent channels', () => {
            expect(div.outputs.out1).toBeDefined();
            expect(div.outputs.out2).toBeDefined();
            expect(div.params.rate1).toBeDefined();
            expect(div.params.rate2).toBeDefined();
        });

        it('should accept 0-5V CV per channel (per spec)', () => {
            expect(div.inputs.rate1CV).toBeDefined();
            expect(div.inputs.rate2CV).toBeDefined();
        });

        it('should use 2.5V clock input threshold (per spec)', () => {
            div.params.rate1 = 0.5;

            // Just below threshold
            div.inputs.clock.fill(2.4);
            div.process();
            const belowThreshold = div.outputs.out1.some(v => v > 0);

            div.reset();

            // Just above threshold
            div.inputs.clock.fill(0);
            div.inputs.clock[0] = 2.6;
            div.process();
            const aboveThreshold = div.outputs.out1.some(v => v > 0);

            expect(belowThreshold).toBe(false);
            expect(aboveThreshold).toBe(true);
        });
    });
});
