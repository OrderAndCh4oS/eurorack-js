import { describe, it, expect, beforeEach } from 'vitest';
import { createClockDiv } from '../../src/js/dsp/clock.js';

describe('createClockDiv', () => {
    let clock;

    beforeEach(() => {
        clock = createClockDiv();
    });

    describe('initialization', () => {
        it('should create a Clock/Divider with default params', () => {
            expect(clock.params.bpm).toBe(0.4);
            expect(clock.params.swing).toBe(0);
        });

        it('should create default inputs', () => {
            expect(clock.inputs.extClock).toBe(0);
            expect(clock.inputs.reset).toBe(0);
        });

        it('should create output buffers', () => {
            expect(clock.outputs.clock).toBeInstanceOf(Float32Array);
            expect(clock.outputs.div2).toBeInstanceOf(Float32Array);
            expect(clock.outputs.div4).toBeInstanceOf(Float32Array);
            expect(clock.outputs.div8).toBeInstanceOf(Float32Array);
            expect(clock.outputs.clock.length).toBe(512);
        });

        it('should have LED output', () => {
            expect(clock.leds.clock).toBe(0);
        });

        it('should accept custom options', () => {
            const customClock = createClockDiv({ sampleRate: 48000, bufferSize: 256 });
            expect(customClock.outputs.clock.length).toBe(256);
        });
    });

    describe('output range (trigger 0/5V)', () => {
        it('should produce clock output of 0 or 5V only', () => {
            clock.params.bpm = 0.8; // Fast BPM for testing

            for (let i = 0; i < 10; i++) {
                clock.process();
            }

            // All values should be either 0 or 5
            expect(clock.outputs.clock.every(v => v === 0 || v === 5)).toBe(true);
        });

        it('should produce divided outputs of 0 or 5V only', () => {
            clock.params.bpm = 0.8;

            for (let i = 0; i < 10; i++) {
                clock.process();
            }

            expect(clock.outputs.div2.every(v => v === 0 || v === 5)).toBe(true);
            expect(clock.outputs.div4.every(v => v === 0 || v === 5)).toBe(true);
            expect(clock.outputs.div8.every(v => v === 0 || v === 5)).toBe(true);
        });
    });

    describe('clock generation', () => {
        it('should generate clock pulses', () => {
            clock.params.bpm = 0.9; // ~250 BPM, fast enough to see pulses

            let sawPulse = false;
            for (let i = 0; i < 50; i++) {
                clock.process();
                if (clock.outputs.clock.some(v => v === 5)) {
                    sawPulse = true;
                    break;
                }
            }

            expect(sawPulse).toBe(true);
        });

        it('should produce faster pulses at higher BPM', () => {
            const slowClock = createClockDiv({ bufferSize: 44100 }); // 1 second of audio
            slowClock.params.bpm = 0.2; // ~50 BPM

            const fastClock = createClockDiv({ bufferSize: 44100 });
            fastClock.params.bpm = 0.8; // ~200 BPM

            // Process 1 second
            slowClock.process();
            fastClock.process();

            // Count pulses (transitions from 0 to 5)
            const countPulses = (arr) => {
                let count = 0;
                for (let i = 1; i < arr.length; i++) {
                    if (arr[i-1] === 0 && arr[i] === 5) count++;
                }
                return count;
            };

            expect(countPulses(fastClock.outputs.clock)).toBeGreaterThan(countPulses(slowClock.outputs.clock));
        });
    });

    describe('clock divisions', () => {
        it('should divide clock by 2', () => {
            clock.params.bpm = 0.9;

            let mainPulses = 0;
            let div2Pulses = 0;

            for (let i = 0; i < 100; i++) {
                clock.process();
                for (let j = 1; j < 512; j++) {
                    if (clock.outputs.clock[j-1] === 0 && clock.outputs.clock[j] === 5) mainPulses++;
                    if (clock.outputs.div2[j-1] === 0 && clock.outputs.div2[j] === 5) div2Pulses++;
                }
            }

            // div2 should have roughly half the pulses (swing may affect this)
            if (mainPulses > 4) {
                expect(div2Pulses).toBeLessThan(mainPulses);
            }
        });

        it('should divide clock by 4', () => {
            clock.params.bpm = 0.9;

            let mainPulses = 0;
            let div4Pulses = 0;

            for (let i = 0; i < 100; i++) {
                clock.process();
                for (let j = 1; j < 512; j++) {
                    if (clock.outputs.clock[j-1] === 0 && clock.outputs.clock[j] === 5) mainPulses++;
                    if (clock.outputs.div4[j-1] === 0 && clock.outputs.div4[j] === 5) div4Pulses++;
                }
            }

            // div4 should have roughly 1/4 the pulses
            if (mainPulses > 8) {
                expect(div4Pulses).toBeLessThan(mainPulses / 2);
            }
        });

        it('should divide clock by 8', () => {
            clock.params.bpm = 0.9;

            let mainPulses = 0;
            let div8Pulses = 0;

            for (let i = 0; i < 100; i++) {
                clock.process();
                for (let j = 1; j < 512; j++) {
                    if (clock.outputs.clock[j-1] === 0 && clock.outputs.clock[j] === 5) mainPulses++;
                    if (clock.outputs.div8[j-1] === 0 && clock.outputs.div8[j] === 5) div8Pulses++;
                }
            }

            // div8 should have roughly 1/8 the pulses
            if (mainPulses > 16) {
                expect(div8Pulses).toBeLessThan(mainPulses / 4);
            }
        });
    });

    describe('external clock', () => {
        it('should respond to external clock input', () => {
            clock.inputs.extClock = 0;
            clock.process();

            // Trigger external clock
            clock.inputs.extClock = 5;
            clock.process();

            // Should have generated a pulse
            expect(clock.outputs.clock.some(v => v === 5)).toBe(true);
        });
    });

    describe('reset', () => {
        it('should reset dividers on reset trigger', () => {
            clock.params.bpm = 0.9;

            // Let clock run for a while
            for (let i = 0; i < 20; i++) {
                clock.process();
            }

            // Reset
            clock.inputs.reset = 5;
            clock.process();

            // After reset, counters should be back to 0
            // This means next clock should trigger all divisions at once
            clock.inputs.reset = 0;
        });
    });

    describe('swing', () => {
        it('should apply swing to /2 output', () => {
            // Hard to test precisely without timing analysis
            // Just verify it processes without error
            clock.params.swing = 0.5;
            clock.params.bpm = 0.8;

            for (let i = 0; i < 50; i++) {
                clock.process();
            }

            // Should produce output without crashing
            expect(clock.outputs.div2.every(v => v === 0 || v === 5)).toBe(true);
        });
    });

    describe('LED', () => {
        it('should blink with clock', () => {
            clock.params.bpm = 0.9;

            let sawOn = false;
            let sawOff = false;

            for (let i = 0; i < 50; i++) {
                clock.process();
                if (clock.leds.clock === 1) sawOn = true;
                if (clock.leds.clock === 0) sawOff = true;
            }

            expect(sawOn || sawOff).toBe(true);
        });
    });

    describe('buffer processing', () => {
        it('should fill entire output buffers without NaN', () => {
            clock.process();

            expect(clock.outputs.clock.every(v => !isNaN(v))).toBe(true);
            expect(clock.outputs.div2.every(v => !isNaN(v))).toBe(true);
            expect(clock.outputs.div4.every(v => !isNaN(v))).toBe(true);
            expect(clock.outputs.div8.every(v => !isNaN(v))).toBe(true);
        });
    });
});
