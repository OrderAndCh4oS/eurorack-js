import { describe, it, expect, beforeEach } from 'vitest';
import quadLfoModule from '../../src/js/modules/quad-lfo/index.js';

const OUTPUT_PORTS = ['out0', 'out90', 'out180', 'out270'];
const LEDS = ['led0', 'led90', 'led180', 'led270'];

const createQuadLfo = (options = {}) => quadLfoModule.createDSP({
    sampleRate: 1000,
    bufferSize: 1000,
    ...options
});

function countZeroCrossings(values) {
    let crossings = 0;
    let last = values[0];

    for (let i = 1; i < values.length; i++) {
        const current = values[i];
        if ((last < 0 && current >= 0) || (last >= 0 && current < 0)) {
            crossings++;
        }
        last = current;
    }

    return crossings;
}

function configureOneHz(dsp) {
    dsp.params.range = 1;
    dsp.params.rate = 0;
    dsp.params.rateCvAmt = 0;
}

describe('createQuadLfo', () => {
    let lfo;

    beforeEach(() => {
        lfo = createQuadLfo({ bufferSize: 128 });
    });

    describe('initialization', () => {
        it('creates the documented params, inputs, outputs, LEDs, and buffer sizes', () => {
            expect(lfo.params).toEqual({
                rate: 0.35,
                range: 0,
                rateCvAmt: 0
            });

            expect(lfo.inputs.rateCV).toBeInstanceOf(Float32Array);
            expect(lfo.inputs.rateMod).toBeInstanceOf(Float32Array);
            expect(lfo.inputs.reset).toBeInstanceOf(Float32Array);
            expect(lfo.inputs.hold).toBeInstanceOf(Float32Array);

            OUTPUT_PORTS.forEach(port => {
                expect(lfo.outputs[port]).toBeInstanceOf(Float32Array);
                expect(lfo.outputs[port].length).toBe(128);
            });

            LEDS.forEach(led => {
                expect(lfo.leds[led]).toBe(0);
            });
        });

        it('declares the expected module metadata and UI port contract', () => {
            expect(quadLfoModule.id).toBe('quad-lfo');
            expect(quadLfoModule.category).toBe('modulation');
            expect(quadLfoModule.ui.inputs.map(input => input.port)).toEqual([
                'rateCV',
                'rateMod',
                'reset',
                'hold'
            ]);
            expect(quadLfoModule.ui.outputs.map(output => output.port)).toEqual(OUTPUT_PORTS);
        });
    });

    describe('voltage range and buffer integrity', () => {
        it('fills every output with finite app-standard +/-5V CV', () => {
            lfo.params.rate = 1;
            lfo.params.range = 2;
            lfo.params.rateCvAmt = 1;
            lfo.inputs.rateCV.fill(10);
            lfo.inputs.rateMod.fill(10);

            lfo.process();

            OUTPUT_PORTS.forEach(port => {
                lfo.outputs[port].forEach(value => {
                    expect(Number.isFinite(value)).toBe(true);
                    expect(value).toBeGreaterThanOrEqual(-5.00001);
                    expect(value).toBeLessThanOrEqual(5.00001);
                });
            });
        });
    });

    describe('quadrature phase taps', () => {
        it('produces fixed 0, 90, 180, and 270 degree sine outputs', () => {
            const dsp = createQuadLfo({ sampleRate: 16, bufferSize: 16 });
            configureOneHz(dsp);

            dsp.process();

            expect(dsp.outputs.out0[0]).toBeCloseTo(0, 5);
            expect(dsp.outputs.out90[0]).toBeCloseTo(5, 5);
            expect(dsp.outputs.out180[0]).toBeCloseTo(0, 5);
            expect(dsp.outputs.out270[0]).toBeCloseTo(-5, 5);

            expect(dsp.outputs.out0[4]).toBeCloseTo(5, 5);
            expect(dsp.outputs.out90[4]).toBeCloseTo(0, 5);
            expect(dsp.outputs.out180[4]).toBeCloseTo(-5, 5);
            expect(dsp.outputs.out270[4]).toBeCloseTo(0, 5);

            for (let i = 0; i < 16; i++) {
                expect(dsp.outputs.out180[i]).toBeCloseTo(-dsp.outputs.out0[i], 5);
                expect(dsp.outputs.out270[i]).toBeCloseTo(-dsp.outputs.out90[i], 5);
            }
        });
    });

    describe('reset input', () => {
        it('resets on rising edges at >=1V and ignores sub-threshold or held-high signals', () => {
            const dsp = createQuadLfo({ sampleRate: 16, bufferSize: 4 });
            configureOneHz(dsp);

            dsp.process();

            dsp.inputs.reset.fill(0.99);
            dsp.process();
            expect(dsp.outputs.out0[0]).toBeGreaterThan(4.9);

            dsp.inputs.reset.fill(1);
            dsp.process();
            expect(dsp.outputs.out0[0]).toBeCloseTo(0, 5);
            expect(dsp.outputs.out90[0]).toBeCloseTo(5, 5);

            dsp.inputs.reset.fill(5);
            dsp.process();
            expect(dsp.outputs.out0[0]).toBeGreaterThan(4.9);

            dsp.inputs.reset.fill(0);
            dsp.process();
            dsp.inputs.reset.fill(1);
            dsp.process();
            expect(dsp.outputs.out0[0]).toBeCloseTo(0, 5);
        });
    });

    describe('hold input', () => {
        it('freezes phase above 2V and resumes from the frozen phase', () => {
            const dsp = createQuadLfo({ sampleRate: 16, bufferSize: 4 });
            configureOneHz(dsp);

            dsp.process();

            dsp.inputs.hold.fill(3);
            dsp.process();
            const held = Array.from(dsp.outputs.out0);
            held.forEach(value => expect(value).toBeCloseTo(5, 5));

            dsp.process();
            expect(Array.from(dsp.outputs.out0)).toEqual(held);

            dsp.inputs.hold.fill(0);
            dsp.process();
            expect(dsp.outputs.out0[0]).toBeCloseTo(held[0], 5);
            expect(dsp.outputs.out0[3]).toBeLessThan(held[3]);
        });

        it('does not hold at exactly 2V', () => {
            const dsp = createQuadLfo({ sampleRate: 16, bufferSize: 4 });
            configureOneHz(dsp);

            dsp.process();
            dsp.inputs.hold.fill(2);
            dsp.process();

            expect(dsp.outputs.out0[0]).toBeGreaterThan(4.9);
            expect(dsp.outputs.out0[1]).toBeLessThan(4.9);
        });
    });

    describe('rate controls', () => {
        it('increases frequency as the rate knob increases', () => {
            const slow = createQuadLfo();
            slow.params.range = 1;
            slow.params.rate = 0;
            slow.process();

            const fast = createQuadLfo();
            fast.params.range = 1;
            fast.params.rate = 1;
            fast.process();

            expect(countZeroCrossings(fast.outputs.out0))
                .toBeGreaterThan(countZeroCrossings(slow.outputs.out0));
        });

        it('uses low, mid, and high ranges with increasing frequency spans', () => {
            const crossings = [0, 1, 2].map(range => {
                const dsp = createQuadLfo();
                dsp.params.range = range;
                dsp.params.rate = 0;
                dsp.process();
                return countZeroCrossings(dsp.outputs.out0);
            });

            expect(crossings[1]).toBeGreaterThan(crossings[0]);
            expect(crossings[2]).toBeGreaterThan(crossings[1]);
        });
    });

    describe('CV inputs', () => {
        it('applies direct rateCV as octave-style frequency modulation', () => {
            const base = createQuadLfo();
            configureOneHz(base);
            base.process();

            const faster = createQuadLfo();
            configureOneHz(faster);
            faster.inputs.rateCV.fill(1);
            faster.process();

            const slower = createQuadLfo();
            configureOneHz(slower);
            slower.inputs.rateCV.fill(-1);
            slower.process();

            expect(countZeroCrossings(faster.outputs.out0))
                .toBeGreaterThan(countZeroCrossings(base.outputs.out0));
            expect(countZeroCrossings(slower.outputs.out0))
                .toBeLessThan(countZeroCrossings(base.outputs.out0));
        });

        it('attenuverts rateMod with rateCvAmt', () => {
            const neutral = createQuadLfo();
            configureOneHz(neutral);
            neutral.inputs.rateMod.fill(1);
            neutral.process();

            const positive = createQuadLfo();
            configureOneHz(positive);
            positive.params.rateCvAmt = 1;
            positive.inputs.rateMod.fill(1);
            positive.process();

            const inverted = createQuadLfo();
            configureOneHz(inverted);
            inverted.params.rateCvAmt = -1;
            inverted.inputs.rateMod.fill(1);
            inverted.process();

            expect(countZeroCrossings(positive.outputs.out0))
                .toBeGreaterThan(countZeroCrossings(neutral.outputs.out0));
            expect(countZeroCrossings(inverted.outputs.out0))
                .toBeLessThan(countZeroCrossings(neutral.outputs.out0));
        });
    });

    describe('LEDs and reset method', () => {
        it('sets signed LEDs from the final output sample normalized to +/-1', () => {
            const dsp = createQuadLfo({ sampleRate: 16, bufferSize: 4 });
            configureOneHz(dsp);

            dsp.process();

            expect(dsp.leds.led0).toBeCloseTo(dsp.outputs.out0[3] / 5, 5);
            expect(dsp.leds.led90).toBeCloseTo(dsp.outputs.out90[3] / 5, 5);
            expect(dsp.leds.led180).toBeCloseTo(dsp.outputs.out180[3] / 5, 5);
            expect(dsp.leds.led270).toBeCloseTo(dsp.outputs.out270[3] / 5, 5);
        });

        it('clears phase, edge memory, outputs, and LEDs', () => {
            const dsp = createQuadLfo({ sampleRate: 16, bufferSize: 4 });
            configureOneHz(dsp);
            dsp.inputs.reset.fill(5);
            dsp.inputs.hold.fill(3);
            dsp.process();

            dsp.reset();

            OUTPUT_PORTS.forEach(port => {
                expect(Array.from(dsp.outputs[port])).toEqual([0, 0, 0, 0]);
            });
            LEDS.forEach(led => expect(dsp.leds[led]).toBe(0));

            dsp.inputs.reset.fill(0);
            dsp.inputs.hold.fill(0);
            dsp.process();

            expect(dsp.outputs.out0[0]).toBeCloseTo(0, 5);
            expect(dsp.outputs.out90[0]).toBeCloseTo(5, 5);
        });
    });
});
