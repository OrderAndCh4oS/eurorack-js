import { describe, it, expect, beforeEach } from 'vitest';
import matrixModule from '../../src/js/modules/matrix/index.js';

const createMatrix = (options = {}) => matrixModule.createDSP(options);

function expectBufferValue(buffer, value, precision = 5) {
    for (let i = 0; i < buffer.length; i++) {
        expect(buffer[i]).toBeCloseTo(value, precision);
    }
}

describe('Matrix - 4x4 Matrix Mixer', () => {
    let matrix;

    beforeEach(() => {
        matrix = createMatrix();
    });

    describe('initialization', () => {
        it('creates default route and mode params', () => {
            const routeParams = [
                'a1', 'a2', 'a3', 'a4',
                'b1', 'b2', 'b3', 'b4',
                'c1', 'c2', 'c3', 'c4',
                'd1', 'd2', 'd3', 'd4'
            ];

            routeParams.forEach(param => {
                expect(matrix.params[param]).toBe(0);
            });
            expect(matrix.params.modeA).toBe(0);
            expect(matrix.params.modeB).toBe(0);
            expect(matrix.params.modeC).toBe(0);
            expect(matrix.params.modeD).toBe(0);
        });

        it('creates four input buffers, four output buffers, and four LEDs', () => {
            ['in1', 'in2', 'in3', 'in4'].forEach(port => {
                expect(matrix.inputs[port]).toBeInstanceOf(Float32Array);
                expect(matrix.inputs[port].length).toBe(512);
            });
            ['outA', 'outB', 'outC', 'outD'].forEach(port => {
                expect(matrix.outputs[port]).toBeInstanceOf(Float32Array);
                expect(matrix.outputs[port].length).toBe(512);
                expect(matrix.leds[port]).toBe(0);
            });
        });

        it('accepts custom buffer options', () => {
            const custom = createMatrix({ sampleRate: 48000, bufferSize: 128 });
            expect(custom.inputs.in1.length).toBe(128);
            expect(custom.outputs.outA.length).toBe(128);
        });
    });

    describe('unipolar routing', () => {
        it('passes an input to an output at unity gain', () => {
            matrix.inputs.in1.fill(3);
            matrix.params.a1 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 3);
            expectBufferValue(matrix.outputs.outB, 0);
        });

        it('attenuates and mutes per-route gains', () => {
            matrix.inputs.in1.fill(4);
            matrix.params.a1 = 0.25;
            matrix.params.b1 = 0;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 1);
            expectBufferValue(matrix.outputs.outB, 0);
        });

        it('routes each input to each output independently', () => {
            matrix.inputs.in1.fill(1);
            matrix.inputs.in2.fill(2);
            matrix.inputs.in3.fill(3);
            matrix.inputs.in4.fill(4);

            matrix.params.a1 = 1;
            matrix.params.b2 = 1;
            matrix.params.c3 = 1;
            matrix.params.d4 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 1);
            expectBufferValue(matrix.outputs.outB, 2);
            expectBufferValue(matrix.outputs.outC, 3);
            expectBufferValue(matrix.outputs.outD, 4);
        });

        it('sums multiple inputs linearly and preserves DC values', () => {
            matrix.inputs.in1.fill(2);
            matrix.inputs.in2.fill(3);
            matrix.inputs.in3.fill(-1);
            matrix.params.a1 = 1;
            matrix.params.a2 = 0.5;
            matrix.params.a3 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 2.5);
        });
    });

    describe('bipolar routing', () => {
        it('maps route knobs to inversion, zero, and unity in bipolar mode', () => {
            matrix.inputs.in1.fill(5);
            matrix.inputs.in2.fill(5);
            matrix.inputs.in3.fill(5);
            matrix.params.modeA = 1;
            matrix.params.a1 = 0;
            matrix.params.a2 = 0.5;
            matrix.params.a3 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 0);
        });

        it('cancels phase-inverted audio-rate signals', () => {
            for (let i = 0; i < 512; i++) {
                const sample = Math.sin(i * 0.05) * 5;
                matrix.inputs.in1[i] = sample;
                matrix.inputs.in2[i] = sample;
            }
            matrix.params.modeA = 1;
            matrix.params.a1 = 1;
            matrix.params.a2 = 0;
            matrix.process();

            matrix.outputs.outA.forEach(value => {
                expect(value).toBeCloseTo(0, 4);
            });
        });

        it('keeps modes independent per output', () => {
            matrix.inputs.in1.fill(2);
            matrix.params.modeA = 0;
            matrix.params.modeB = 1;
            matrix.params.a1 = 0.25;
            matrix.params.b1 = 0.25;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 0.5);
            expectBufferValue(matrix.outputs.outB, -1);
        });
    });

    describe('range and buffer integrity', () => {
        it('does not hard-clip large linear sums', () => {
            matrix.inputs.in1.fill(5);
            matrix.inputs.in2.fill(5);
            matrix.inputs.in3.fill(5);
            matrix.inputs.in4.fill(5);
            matrix.params.a1 = 1;
            matrix.params.a2 = 1;
            matrix.params.a3 = 1;
            matrix.params.a4 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 20);
        });

        it('fills all output buffers without NaN values', () => {
            for (let i = 0; i < 512; i++) {
                matrix.inputs.in1[i] = Math.sin(i * 0.11) * 5;
                matrix.inputs.in2[i] = Math.cos(i * 0.13) * 5;
                matrix.inputs.in3[i] = i % 2 ? 10 : -10;
                matrix.inputs.in4[i] = i / 512;
            }
            Object.keys(matrix.params).forEach(param => {
                if (!param.startsWith('mode')) {
                    matrix.params[param] = 0.75;
                }
            });
            matrix.params.modeC = 1;
            matrix.process();

            Object.values(matrix.outputs).forEach(buffer => {
                expect(buffer.every(Number.isFinite)).toBe(true);
            });
        });
    });

    describe('LEDs and reset', () => {
        it('updates and decays output LEDs', () => {
            matrix.inputs.in1.fill(5);
            matrix.params.a1 = 1;
            matrix.process();
            const initial = matrix.leds.outA;

            matrix.inputs.in1.fill(0);
            matrix.process();

            expect(initial).toBeGreaterThan(0);
            expect(matrix.leds.outA).toBeLessThan(initial);
        });

        it('clears outputs and LEDs on reset', () => {
            matrix.inputs.in1.fill(5);
            matrix.params.a1 = 1;
            matrix.process();
            matrix.reset();

            expectBufferValue(matrix.outputs.outA, 0);
            expect(matrix.leds.outA).toBe(0);
        });
    });

    describe('input clearing', () => {
        it('clears own input buffers on demand', () => {
            matrix.inputs.in1.fill(3);
            matrix.clearAudioInputs();
            matrix.params.a1 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 0);
        });

        it('restores own buffers after processing routed buffers', () => {
            const routed = new Float32Array(512).fill(4);
            matrix.inputs.in1 = routed;
            matrix.params.a1 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 4);
            expect(matrix.inputs.in1).not.toBe(routed);
            expectBufferValue(matrix.inputs.in1, 0);
        });
    });

    describe('module metadata', () => {
        it('has valid metadata and UI contract', () => {
            expect(matrixModule.id).toBe('matrix');
            expect(matrixModule.category).toBe('utility');
            expect(matrixModule.hp).toBe(8);
            expect(matrixModule.ui.knobs.length).toBe(16);
            expect(matrixModule.ui.switches.length).toBe(4);
            expect(matrixModule.ui.inputs.map(input => input.port)).toEqual(['in1', 'in2', 'in3', 'in4']);
            expect(matrixModule.ui.outputs.map(output => output.port)).toEqual(['outA', 'outB', 'outC', 'outD']);
        });
    });
});
