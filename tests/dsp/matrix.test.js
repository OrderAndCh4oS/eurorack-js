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
            expect(matrixModule.ui.inputs.map(port => port.voltage)).toEqual([
                { min: -10, max: 10, normal: 0 },
                { min: -10, max: 10, normal: 0 },
                { min: -10, max: 10, normal: 0 },
                { min: -10, max: 10, normal: 0 }
            ]);
        });

        it('accepts custom buffer options', () => {
            const custom = createMatrix({ sampleRate: 48000, bufferSize: 128 });
            expect(custom.inputs.in1.length).toBe(128);
            expect(custom.outputs.outA.length).toBe(128);
        });
    });

    describe('unipolar routing', () => {
        it.each([
            ['a1', 'in1', 'outA'], ['a2', 'in2', 'outA'], ['a3', 'in3', 'outA'], ['a4', 'in4', 'outA'],
            ['b1', 'in1', 'outB'], ['b2', 'in2', 'outB'], ['b3', 'in3', 'outB'], ['b4', 'in4', 'outB'],
            ['c1', 'in1', 'outC'], ['c2', 'in2', 'outC'], ['c3', 'in3', 'outC'], ['c4', 'in4', 'outC'],
            ['d1', 'in1', 'outD'], ['d2', 'in2', 'outD'], ['d3', 'in3', 'outD'], ['d4', 'in4', 'outD']
        ])('routes %s from %s to %s', (param, input, output) => {
            matrix.inputs[input].fill(2);
            matrix.params[param] = 1;

            matrix.process();

            expectBufferValue(matrix.outputs[output], 2);
        });

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

        it('slews route changes while rendering initial patch values directly', () => {
            matrix.inputs.in1.fill(5);
            matrix.params.a1 = 0;
            matrix.process();
            expect(matrix.outputs.outA[0]).toBe(0);

            matrix.params.a1 = 1;
            matrix.process();

            expect(matrix.outputs.outA[0]).toBeGreaterThan(0);
            expect(matrix.outputs.outA[0]).toBeLessThan(5);
            for (let block = 0; block < 10; block++) matrix.process();
            expect(matrix.outputs.outA[511]).toBeCloseTo(5, 2);
        });

        it.each([44100, 48000, 96000])('uses a sample-rate-invariant 5ms route slew at %i Hz', sampleRate => {
            const bufferSize = Math.round(sampleRate * 0.005);
            const timed = createMatrix({ sampleRate, bufferSize });
            timed.inputs.in1.fill(5);
            timed.params.a1 = 0;
            timed.process();
            timed.params.a1 = 1;

            timed.process();

            expect(timed.outputs.outA[bufferSize - 1])
                .toBeCloseTo(5 * (1 - Math.exp(-1)), 2);
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

        it('slews a polarity-mode transition', () => {
            matrix.inputs.in1.fill(5);
            matrix.params.a1 = 0;
            matrix.params.modeA = 0;
            matrix.process();

            matrix.params.modeA = 1;
            matrix.process();

            expect(matrix.outputs.outA[0]).toBeLessThan(0);
            expect(matrix.outputs.outA[0]).toBeGreaterThan(-5);
        });
    });

    describe('range and buffer integrity', () => {
        it('preserves linear sums below the rail and softly limits overload', () => {
            matrix.inputs.in1.fill(4);
            matrix.inputs.in2.fill(4);
            matrix.params.a1 = 1;
            matrix.params.a2 = 1;
            matrix.process();
            expectBufferValue(matrix.outputs.outA, 8);

            matrix.inputs.in1.fill(5);
            matrix.inputs.in2.fill(5);
            matrix.inputs.in3.fill(5);
            matrix.inputs.in4.fill(5);
            matrix.params.a1 = 1;
            matrix.params.a2 = 1;
            matrix.params.a3 = 1;
            matrix.params.a4 = 1;
            matrix.process();

            for (const value of matrix.outputs.outA) {
                expect(value).toBeGreaterThan(9.6);
                expect(value).toBeLessThanOrEqual(10);
            }
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

        it('recovers safely from non-finite controls and samples', () => {
            matrix.params.a1 = Number.NaN;
            matrix.params.b2 = Number.POSITIVE_INFINITY;
            matrix.params.modeA = Number.NaN;
            matrix.inputs.in1.fill(Number.NaN);
            matrix.inputs.in2.fill(Number.NEGATIVE_INFINITY);

            matrix.process();

            Object.values(matrix.outputs).forEach(buffer => {
                expect(buffer.every(Number.isFinite)).toBe(true);
            });
            Object.values(matrix.leds).forEach(value => expect(Number.isFinite(value)).toBe(true));
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

        it('clears stable inputs, outputs, smoothing state, and LEDs on reset', () => {
            const inputs = { ...matrix.inputs };
            const outputs = { ...matrix.outputs };
            matrix.inputs.in1.fill(5);
            matrix.params.a1 = 1;
            matrix.process();
            matrix.reset();

            Object.entries(inputs).forEach(([key, buffer]) => {
                expect(matrix.inputs[key]).toBe(buffer);
                expect(buffer.every(value => value === 0)).toBe(true);
            });
            Object.entries(outputs).forEach(([key, buffer]) => {
                expect(matrix.outputs[key]).toBe(buffer);
                expect(buffer.every(value => value === 0)).toBe(true);
            });
            expect(matrix.leds).toEqual({ outA: 0, outB: 0, outC: 0, outD: 0 });
        });
    });

    describe('stable inputs', () => {
        it('keeps input buffer identities across processing', () => {
            const inputs = { ...matrix.inputs };
            matrix.inputs.in1.fill(3);
            matrix.params.a1 = 1;
            matrix.process();

            expectBufferValue(matrix.outputs.outA, 3);
            Object.entries(inputs).forEach(([name, buffer]) => expect(matrix.inputs[name]).toBe(buffer));
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
