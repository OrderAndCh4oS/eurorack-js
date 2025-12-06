import { describe, it, expect, beforeEach } from 'vitest';
import clkModule from '../../src/js/modules/clk/index.js';

// Helper to create CLK instance using new module system
const createClk = (options = {}) => clkModule.createDSP(options);

describe('createClk', () => {
    let clk;

    beforeEach(() => {
        clk = createClk();
    });

    describe('initialization', () => {
        it('should create a Clk with default params', () => {
            expect(clk.params.rate).toBe(0.3);
            expect(clk.params.pause).toBe(0);
        });

        it('should create input buffers', () => {
            expect(clk.inputs.rateCV).toBeInstanceOf(Float32Array);
            expect(clk.inputs.pause).toBeInstanceOf(Float32Array);
            expect(clk.inputs.rateCV.length).toBe(512);
        });

        it('should create output buffer', () => {
            expect(clk.outputs.clock).toBeInstanceOf(Float32Array);
            expect(clk.outputs.clock.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(clk.leds.clock).toBe(0);
        });

        it('should accept custom options', () => {
            const customClk = createClk({ sampleRate: 48000, bufferSize: 256 });
            expect(customClk.outputs.clock.length).toBe(256);
        });
    });

    describe('output voltage levels', () => {
        it('should produce 0V or 10V pulses only (per 2hp spec)', () => {
            clk.params.rate = 0.8; // Fast rate

            for (let i = 0; i < 10; i++) {
                clk.process();
            }

            expect(clk.outputs.clock.every(v => v === 0 || v === 10)).toBe(true);
        });
    });

    describe('clock generation', () => {
        it('should generate clock pulses', () => {
            clk.params.rate = 0.6; // Moderate rate

            let sawPulse = false;
            for (let i = 0; i < 50; i++) {
                clk.process();
                if (clk.outputs.clock.some(v => v === 10)) {
                    sawPulse = true;
                    break;
                }
            }

            expect(sawPulse).toBe(true);
        });

        it('should produce faster pulses at higher rate', () => {
            const slowClk = createClk({ bufferSize: 44100 }); // 1 second buffer
            slowClk.params.rate = 0.2;

            const fastClk = createClk({ bufferSize: 44100 });
            fastClk.params.rate = 0.6;

            slowClk.process();
            fastClk.process();

            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] === 10) count++;
                }
                return count;
            };

            expect(countPulses(fastClk.outputs.clock)).toBeGreaterThan(countPulses(slowClk.outputs.clock));
        });
    });

    describe('pause functionality', () => {
        it('should pause when pause param is 1', () => {
            clk.params.rate = 0.8;
            clk.params.pause = 1;

            // Process several buffers
            for (let i = 0; i < 10; i++) {
                clk.process();
            }

            // Should not see any pulses when paused
            expect(clk.outputs.clock.every(v => v === 0)).toBe(true);
        });

        it('should pause when pause input exceeds 2V threshold', () => {
            clk.params.rate = 0.8;
            clk.inputs.pause.fill(3); // Above 2V threshold

            // Process several buffers
            for (let i = 0; i < 10; i++) {
                clk.process();
            }

            // Should not see any new pulses (only decay of existing)
            // Check the last buffer - should be mostly zeros
            const hasActivity = clk.outputs.clock.some(v => v === 10);
            // After 10 buffers of being paused, should have no activity
            expect(clk.outputs.clock.every(v => v === 0)).toBe(true);
        });

        it('should resume when pause is released', () => {
            clk.params.rate = 0.8;

            // Start paused
            clk.params.pause = 1;
            for (let i = 0; i < 5; i++) {
                clk.process();
            }

            // Unpause
            clk.params.pause = 0;

            let sawPulse = false;
            for (let i = 0; i < 20; i++) {
                clk.process();
                if (clk.outputs.clock.some(v => v === 10)) {
                    sawPulse = true;
                    break;
                }
            }

            expect(sawPulse).toBe(true);
        });
    });

    describe('rate CV modulation', () => {
        it('should respond to rate CV input (0-10V)', () => {
            clk.params.rate = 0.3; // Low base rate

            // Without CV
            const noCV = createClk({ bufferSize: 44100 });
            noCV.params.rate = 0.3;
            noCV.process();

            // With CV
            const withCV = createClk({ bufferSize: 44100 });
            withCV.params.rate = 0.3;
            withCV.inputs.rateCV.fill(5); // Add 5V CV
            withCV.process();

            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] === 10) count++;
                }
                return count;
            };

            // With CV should be faster
            expect(countPulses(withCV.outputs.clock)).toBeGreaterThan(countPulses(noCV.outputs.clock));
        });
    });

    describe('LED behavior', () => {
        it('should have LED indicator', () => {
            expect(typeof clk.leds.clock).toBe('number');
        });
    });

    describe('reset', () => {
        it('should have reset method', () => {
            expect(typeof clk.reset).toBe('function');
        });

        it('should reset clock phase', () => {
            clk.params.rate = 0.5;
            clk.process();
            clk.reset();
            // After reset, no immediate pulse expected
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffer without NaN', () => {
            clk.process();
            expect(clk.outputs.clock.every(v => !isNaN(v))).toBe(true);
        });
    });

    describe('2hp Clk spec compliance', () => {
        it('should have frequency range from 0.1Hz to 10kHz', () => {
            // At rate=0, should be very slow (~0.1Hz)
            // At rate=1, should be very fast (~10kHz)

            const slowClk = createClk({ bufferSize: 44100, sampleRate: 44100 });
            slowClk.params.rate = 0;
            slowClk.process();

            const fastClk = createClk({ bufferSize: 44100, sampleRate: 44100 });
            fastClk.params.rate = 1;
            fastClk.process();

            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i - 1] === 0 && arr[i] === 10) count++;
                }
                return count;
            };

            // At 0.1Hz, we'd expect ~0 pulses in 1 second
            // At 10kHz, we'd expect ~10000 pulses in 1 second
            expect(countPulses(slowClk.outputs.clock)).toBeLessThanOrEqual(1);
            expect(countPulses(fastClk.outputs.clock)).toBeGreaterThan(1000);
        });

        it('should output 10V pulses (per 2hp spec)', () => {
            clk.params.rate = 0.5;

            for (let i = 0; i < 20; i++) {
                clk.process();
            }

            // Find a pulse and verify it's 10V
            let maxVoltage = 0;
            for (let i = 0; i < 20; i++) {
                clk.process();
                for (const v of clk.outputs.clock) {
                    if (v > maxVoltage) maxVoltage = v;
                }
            }

            expect(maxVoltage).toBe(10);
        });

        it('should pause on gate >2V (per 2hp spec)', () => {
            clk.params.rate = 0.8;

            // Below threshold - should work
            clk.inputs.pause.fill(1.9);
            let sawPulseBelow = false;
            for (let i = 0; i < 20; i++) {
                clk.process();
                if (clk.outputs.clock.some(v => v === 10)) {
                    sawPulseBelow = true;
                    break;
                }
            }

            // Reset and try above threshold
            clk.reset();
            clk.inputs.pause.fill(2.1);
            for (let i = 0; i < 10; i++) {
                clk.process();
            }
            const sawPulseAbove = clk.outputs.clock.some(v => v === 10);

            expect(sawPulseBelow).toBe(true);
            expect(sawPulseAbove).toBe(false);
        });
    });
});
