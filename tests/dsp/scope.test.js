/**
 * Tests for SCOPE - Dual Channel Oscilloscope Module
 * Based on Intellijel Zeroscope 1U
 */
import { describe, it, expect, beforeEach } from 'vitest';
import scopeModule from '../../src/js/modules/scope/index.js';

describe('SCOPE - Dual Channel Oscilloscope', () => {
    let dsp;
    const SAMPLE_RATE = 44100;
    const BUFFER_SIZE = 512;

    beforeEach(() => {
        dsp = scopeModule.createDSP({
            sampleRate: SAMPLE_RATE,
            bufferSize: BUFFER_SIZE
        });
    });

    describe('module metadata', () => {
        it('should have correct id', () => {
            expect(scopeModule.id).toBe('scope');
        });

        it('should have correct name', () => {
            expect(scopeModule.name).toBe('SCOPE');
        });

        it('should have correct HP width', () => {
            expect(scopeModule.hp).toBe(16);
        });

        it('should have utility category', () => {
            expect(scopeModule.category).toBe('utility');
        });

        it('should have render function for custom UI', () => {
            expect(typeof scopeModule.render).toBe('function');
        });
    });

    describe('initialization', () => {
        it('should create dual display buffers', () => {
            expect(dsp.displayBuffer1).toBeInstanceOf(Float32Array);
            expect(dsp.displayBuffer2).toBeInstanceOf(Float32Array);
            expect(dsp.displayBuffer1.length).toBe(BUFFER_SIZE * 4);
            expect(dsp.displayBuffer2.length).toBe(BUFFER_SIZE * 4);
        });

        it('should have default params', () => {
            expect(dsp.params.time).toBe(0.5);
            expect(dsp.params.gain1).toBe(0.5);
            expect(dsp.params.gain2).toBe(0.5);
            expect(dsp.params.trigger).toBe(0.5);
            expect(dsp.params.mode).toBe(0);
        });

        it('should have dual input buffers', () => {
            expect(dsp.inputs.in1).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.in2).toBeInstanceOf(Float32Array);
            expect(dsp.inputs.in1.length).toBe(BUFFER_SIZE);
            expect(dsp.inputs.in2.length).toBe(BUFFER_SIZE);
        });

        it('should have dual output buffers (passthrough)', () => {
            expect(dsp.outputs.out1).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.out2).toBeInstanceOf(Float32Array);
            expect(dsp.outputs.out1.length).toBe(BUFFER_SIZE);
            expect(dsp.outputs.out2.length).toBe(BUFFER_SIZE);
        });

        it('should have dual LED states', () => {
            expect(dsp.leds.ch1).toBe(0);
            expect(dsp.leds.ch2).toBe(0);
        });
    });

    describe('passthrough (normalled outputs)', () => {
        it('should pass CH1 input to CH1 output', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = Math.sin(i * 0.1) * 5;
            }

            dsp.process();

            for (let i = 0; i < BUFFER_SIZE; i++) {
                expect(dsp.outputs.out1[i]).toBe(dsp.inputs.in1[i]);
            }
        });

        it('should pass CH2 input to CH2 output', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in2[i] = Math.cos(i * 0.1) * 3;
            }

            dsp.process();

            for (let i = 0; i < BUFFER_SIZE; i++) {
                expect(dsp.outputs.out2[i]).toBe(dsp.inputs.in2[i]);
            }
        });
    });

    describe('display buffer capture', () => {
        it('should copy CH1 input to display buffer 1', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = Math.sin(i * 0.1);
            }

            dsp.process();

            let hasNonZero = false;
            for (let i = 0; i < dsp.displayBuffer1.length; i++) {
                if (dsp.displayBuffer1[i] !== 0) {
                    hasNonZero = true;
                    break;
                }
            }
            expect(hasNonZero).toBe(true);
        });

        it('should copy CH2 input to display buffer 2', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in2[i] = Math.cos(i * 0.1);
            }

            dsp.process();

            let hasNonZero = false;
            for (let i = 0; i < dsp.displayBuffer2.length; i++) {
                if (dsp.displayBuffer2[i] !== 0) {
                    hasNonZero = true;
                    break;
                }
            }
            expect(hasNonZero).toBe(true);
        });
    });

    describe('LED indicators', () => {
        it('should show zero when no signal', () => {
            dsp.inputs.in1.fill(0);
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.leds.ch1).toBe(0);
            expect(dsp.leds.ch2).toBe(0);
        });

        it('should reflect CH1 signal level', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = 5 * Math.sin(i * 0.1); // ±5V
            }
            dsp.inputs.in2.fill(0);
            dsp.process();
            expect(dsp.leds.ch1).toBeGreaterThan(0);
            expect(dsp.leds.ch2).toBe(0);
        });

        it('should reflect CH2 signal level', () => {
            dsp.inputs.in1.fill(0);
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in2[i] = 8 * Math.sin(i * 0.1); // ±8V
            }
            dsp.process();
            expect(dsp.leds.ch1).toBe(0);
            expect(dsp.leds.ch2).toBeGreaterThan(0);
        });

        it('should scale LED to ±10V range', () => {
            // Full scale ±10V should give LED value close to 1
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = 10 * Math.sin(i * 0.1);
            }
            dsp.process();
            expect(dsp.leds.ch1).toBeCloseTo(1, 1);
        });
    });

    describe('trigger detection', () => {
        it('should detect trigger on rising edge of CH1', () => {
            // Create rising edge crossing trigger level (0V at default)
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = (i / BUFFER_SIZE) * 20 - 10; // -10V to +10V ramp
            }

            dsp.process();

            expect(dsp.getTriggerIndex()).toBeGreaterThan(0);
        });

        it('should respect trigger level parameter', () => {
            dsp.params.trigger = 0.75; // +5V trigger level

            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = (i / BUFFER_SIZE) * 20 - 10; // -10V to +10V ramp
            }

            dsp.process();

            // Trigger should occur later in the buffer (when signal crosses +5V)
            const trigIdx = dsp.getTriggerIndex();
            expect(trigIdx).toBeGreaterThan(BUFFER_SIZE * 0.5);
        });
    });

    describe('frequency detection (tune mode)', () => {
        it('should detect frequency of periodic signal', () => {
            const testFreq = 440; // A4
            const samplesPerCycle = SAMPLE_RATE / testFreq;

            // Generate several cycles of sine wave
            for (let cycle = 0; cycle < 10; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.in1[i] = 5 * Math.sin(2 * Math.PI * testFreq * (cycle * BUFFER_SIZE + i) / SAMPLE_RATE);
                }
                dsp.process();
            }

            const detected = dsp.getDetectedFreq();
            // Allow 5% tolerance
            expect(detected).toBeGreaterThan(testFreq * 0.95);
            expect(detected).toBeLessThan(testFreq * 1.05);
        });
    });

    describe('circular buffer handling', () => {
        it('should handle multiple process calls without overflow', () => {
            for (let cycle = 0; cycle < 20; cycle++) {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.in1[i] = cycle + Math.sin(i * 0.1);
                    dsp.inputs.in2[i] = cycle + Math.cos(i * 0.1);
                }
                dsp.process();
            }

            // Should not crash and write index should wrap
            expect(dsp.getWriteIndex()).toBeLessThan(dsp.displaySize);
        });
    });

    describe('reset', () => {
        it('should clear both display buffers', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = Math.random() * 10 - 5;
                dsp.inputs.in2[i] = Math.random() * 10 - 5;
            }
            dsp.process();

            dsp.reset();

            expect(dsp.displayBuffer1.every(v => v === 0)).toBe(true);
            expect(dsp.displayBuffer2.every(v => v === 0)).toBe(true);
        });

        it('should reset LED states', () => {
            dsp.leds.ch1 = 0.8;
            dsp.leds.ch2 = 0.6;
            dsp.reset();
            expect(dsp.leds.ch1).toBe(0);
            expect(dsp.leds.ch2).toBe(0);
        });

        it('should reset detected frequency', () => {
            // Generate some signal to detect
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = Math.sin(i * 0.1);
            }
            dsp.process();

            dsp.reset();
            expect(dsp.getDetectedFreq()).toBe(0);
        });
    });

    describe('buffer integrity', () => {
        it('should not produce NaN values in display buffers', () => {
            const testInputs = [
                () => 0,
                () => 10,
                () => -10,
                () => Math.random() * 20 - 10,
            ];

            testInputs.forEach(generator => {
                for (let i = 0; i < BUFFER_SIZE; i++) {
                    dsp.inputs.in1[i] = generator();
                    dsp.inputs.in2[i] = generator();
                }
                dsp.process();
            });

            expect(dsp.displayBuffer1.some(v => Number.isNaN(v))).toBe(false);
            expect(dsp.displayBuffer2.some(v => Number.isNaN(v))).toBe(false);
        });

        it('should not produce NaN values in outputs', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = Math.random() * 20 - 10;
                dsp.inputs.in2[i] = Math.random() * 20 - 10;
            }
            dsp.process();

            expect(dsp.outputs.out1.some(v => Number.isNaN(v))).toBe(false);
            expect(dsp.outputs.out2.some(v => Number.isNaN(v))).toBe(false);
        });
    });

    describe('ui definition', () => {
        it('should have dual LEDs defined', () => {
            expect(scopeModule.ui.leds).toContain('ch1');
            expect(scopeModule.ui.leds).toContain('ch2');
        });

        it('should have dual input jacks defined', () => {
            expect(scopeModule.ui.inputs).toHaveLength(2);
            expect(scopeModule.ui.inputs[0].port).toBe('in1');
            expect(scopeModule.ui.inputs[1].port).toBe('in2');
        });

        it('should have dual output jacks defined', () => {
            expect(scopeModule.ui.outputs).toHaveLength(2);
            expect(scopeModule.ui.outputs[0].port).toBe('out1');
            expect(scopeModule.ui.outputs[1].port).toBe('out2');
        });
    });

    describe('voltage range (DC coupled ±10V)', () => {
        it('should accept full ±10V range on CH1', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in1[i] = 10 * Math.sin(i * 0.1);
            }
            dsp.process();

            // Should capture without clipping
            const maxCapture = Math.max(...dsp.displayBuffer1.slice(0, BUFFER_SIZE));
            expect(maxCapture).toBeCloseTo(10, 0);
        });

        it('should accept full ±10V range on CH2', () => {
            for (let i = 0; i < BUFFER_SIZE; i++) {
                dsp.inputs.in2[i] = 10 * Math.sin(i * 0.1);
            }
            dsp.process();

            const maxCapture = Math.max(...dsp.displayBuffer2.slice(0, BUFFER_SIZE));
            expect(maxCapture).toBeCloseTo(10, 0);
        });
    });
});
