import { describe, it, expect, beforeEach } from 'vitest';
import seqSwitchModule from '../../src/js/modules/seq-switch/index.js';

const createSeqSwitch = (options = {}) => seqSwitchModule.createDSP(options);

function pulse(buffer, index, voltage = 5) {
    buffer[index] = voltage;
}

describe('seq-switch DSP', () => {
    let seqSwitch;

    beforeEach(() => {
        seqSwitch = createSeqSwitch({ sampleRate: 1000, bufferSize: 16 });
    });

    describe('initialization', () => {
        it('creates default params, buffers, outputs, and LEDs', () => {
            expect(seqSwitch.params.steps).toBe(4);
            expect(seqSwitch.inputs.clock).toBeInstanceOf(Float32Array);
            expect(seqSwitch.inputs.reset).toBeInstanceOf(Float32Array);
            expect(seqSwitch.inputs.commonIn).toBeInstanceOf(Float32Array);
            expect(seqSwitch.inputs.in1).toBeInstanceOf(Float32Array);
            expect(seqSwitch.outputs.commonOut).toBeInstanceOf(Float32Array);
            expect(seqSwitch.outputs.out1).toBeInstanceOf(Float32Array);
            expect(seqSwitch.outputs.out4).toBeInstanceOf(Float32Array);
            expect(seqSwitch.leds).toEqual({
                stage1: 1,
                stage2: 0,
                stage3: 0,
                stage4: 0
            });
            expect(seqSwitchModule.ui.inputs.map(port => port.voltage)).toEqual([
                { min: 0, max: 10, normal: 0 },
                { min: 0, max: 10, normal: 0 },
                { min: -5, max: 5, normal: 0 },
                { min: -5, max: 5, normal: 0 },
                { min: -5, max: 5, normal: 0 },
                { min: -5, max: 5, normal: 0 },
                { min: -5, max: 5, normal: 0 }
            ]);
            expect(seqSwitchModule.ui.outputs.map(port => port.voltage))
                .toEqual(Array(5).fill({ min: -5, max: 5 }));
        });

        it('accepts custom buffer sizes', () => {
            const custom = createSeqSwitch({ bufferSize: 32 });
            expect(custom.outputs.commonOut.length).toBe(32);
            expect(custom.outputs.out4.length).toBe(32);
        });
    });

    describe('routing', () => {
        it('routes the selected one-of-four input to commonOut', () => {
            seqSwitch.inputs.in1.fill(1);
            seqSwitch.inputs.in2.fill(2);
            seqSwitch.inputs.in3.fill(3);
            seqSwitch.inputs.in4.fill(4);
            seqSwitch.process();

            expect(Array.from(seqSwitch.outputs.commonOut)).toEqual(new Array(16).fill(1));

            pulse(seqSwitch.inputs.clock, 0);
            seqSwitch.process();

            expect(seqSwitch.outputs.commonOut[15]).toBe(2);
            expect(seqSwitch.leds.stage2).toBe(1);
        });

        it('routes commonIn only to the selected output', () => {
            seqSwitch.inputs.commonIn.fill(3.5);
            seqSwitch.process();

            expect(seqSwitch.outputs.out1[15]).toBe(3.5);
            expect(seqSwitch.outputs.out2[15]).toBe(0);
            expect(seqSwitch.outputs.out3[15]).toBe(0);
            expect(seqSwitch.outputs.out4[15]).toBe(0);

            pulse(seqSwitch.inputs.clock, 0);
            seqSwitch.process();

            expect(seqSwitch.outputs.out1[15]).toBe(0);
            expect(seqSwitch.outputs.out2[15]).toBe(3.5);
        });

        it('crossfades an audio switch over 1ms without a full-scale discontinuity', () => {
            const audioSwitch = createSeqSwitch({ sampleRate: 10000, bufferSize: 20 });
            audioSwitch.inputs.in1.fill(5);
            audioSwitch.inputs.in2.fill(-5);
            audioSwitch.process();
            audioSwitch.inputs.clock[0] = 5;

            audioSwitch.process();

            let maxJump = 0;
            for (let i = 1; i < 20; i++) {
                maxJump = Math.max(
                    maxJump,
                    Math.abs(audioSwitch.outputs.commonOut[i] - audioSwitch.outputs.commonOut[i - 1])
                );
            }
            expect(audioSwitch.outputs.commonOut[0]).toBe(5);
            expect(audioSwitch.outputs.commonOut[19]).toBe(-5);
            expect(maxJump).toBeLessThanOrEqual(1.01);
        });
    });

    describe('clock and reset behavior', () => {
        it('advances only on rising clock edges above 2.5V', () => {
            seqSwitch.inputs.in1.fill(1);
            seqSwitch.inputs.in2.fill(2);
            seqSwitch.inputs.clock.fill(2.5);
            seqSwitch.process();
            expect(seqSwitch.outputs.commonOut[15]).toBe(1);

            seqSwitch.inputs.clock.fill(5);
            seqSwitch.process();
            expect(seqSwitch.outputs.commonOut[15]).toBe(2);

            seqSwitch.process();
            expect(seqSwitch.outputs.commonOut[15]).toBe(2);
        });

        it('resets to stage 1 and reset wins over clock at the same sample', () => {
            seqSwitch.inputs.in1.fill(1);
            seqSwitch.inputs.in2.fill(2);
            seqSwitch.inputs.in3.fill(3);
            pulse(seqSwitch.inputs.clock, 0);
            seqSwitch.process();
            expect(seqSwitch.outputs.commonOut[15]).toBe(2);

            seqSwitch.inputs.clock.fill(0);
            seqSwitch.process();
            pulse(seqSwitch.inputs.clock, 0);
            pulse(seqSwitch.inputs.reset, 0);
            seqSwitch.process();

            expect(seqSwitch.outputs.commonOut[15]).toBe(1);
            expect(seqSwitch.leds.stage1).toBe(1);
            expect(seqSwitch.leds.stage2).toBe(0);
        });
    });

    describe('step limit', () => {
        it('wraps over two stages when steps is set to 2', () => {
            seqSwitch.params.steps = 2;
            seqSwitch.inputs.in1.fill(1);
            seqSwitch.inputs.in2.fill(2);
            seqSwitch.inputs.in3.fill(3);

            pulse(seqSwitch.inputs.clock, 0);
            seqSwitch.process();
            expect(seqSwitch.outputs.commonOut[15]).toBe(2);

            seqSwitch.inputs.clock.fill(0);
            seqSwitch.process();
            pulse(seqSwitch.inputs.clock, 0);
            seqSwitch.process();
            expect(seqSwitch.outputs.commonOut[15]).toBe(1);
            expect(seqSwitch.leds.stage3).toBe(0);
            expect(seqSwitch.leds.stage4).toBe(0);
        });

        it('quantizes and clamps steps to 2 through 4', () => {
            seqSwitch.params.steps = 99;
            seqSwitch.process();
            expect(seqSwitch.getActiveSteps()).toBe(4);

            seqSwitch.params.steps = 1;
            seqSwitch.process();
            expect(seqSwitch.getActiveSteps()).toBe(2);

            seqSwitch.params.steps = 2.6;
            seqSwitch.process();
            expect(seqSwitch.getActiveSteps()).toBe(3);

            seqSwitch.params.steps = Number.NaN;
            expect(() => seqSwitch.process()).not.toThrow();
            expect(seqSwitch.getActiveSteps()).toBe(4);
        });
    });

    describe('reset and buffer integrity', () => {
        it('clears stable inputs, outputs, edge memory, and LEDs on reset', () => {
            const inputs = { ...seqSwitch.inputs };
            const outputs = { ...seqSwitch.outputs };
            seqSwitch.inputs.in2.fill(2);
            seqSwitch.inputs.commonIn.fill(3);
            pulse(seqSwitch.inputs.clock, 0);
            seqSwitch.process();
            expect(seqSwitch.leds.stage2).toBe(1);
            seqSwitch.inputs.reset.fill(4);

            seqSwitch.reset();

            Object.entries(inputs).forEach(([key, buffer]) => {
                expect(seqSwitch.inputs[key]).toBe(buffer);
                expect(buffer.every(value => value === 0)).toBe(true);
            });
            Object.entries(outputs).forEach(([key, buffer]) => {
                expect(seqSwitch.outputs[key]).toBe(buffer);
                expect(buffer.every(value => value === 0)).toBe(true);
            });
            expect(seqSwitch.leds.stage1).toBe(1);
            expect(seqSwitch.leds.stage2).toBe(0);
        });

        it('clamps outputs to the app audio range and never emits NaN', () => {
            seqSwitch.inputs.in1.fill(12);
            seqSwitch.inputs.commonIn.fill(-12);
            seqSwitch.process();

            const allOutputs = [
                seqSwitch.outputs.commonOut,
                seqSwitch.outputs.out1,
                seqSwitch.outputs.out2,
                seqSwitch.outputs.out3,
                seqSwitch.outputs.out4
            ];

            allOutputs.forEach(output => {
                expect(output.every(sample => Number.isFinite(sample))).toBe(true);
                expect(output.every(sample => sample >= -5 && sample <= 5)).toBe(true);
            });
        });
    });
});
