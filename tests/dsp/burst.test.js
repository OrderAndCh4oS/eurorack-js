import { describe, it, expect, beforeEach } from 'vitest';
import burstModule from '../../src/js/modules/burst/index.js';

const SAMPLE_RATE = 1000;

const createBurst = (options = {}) => burstModule.createDSP({
    sampleRate: SAMPLE_RATE,
    bufferSize: 64,
    ...options
});

function risingEdges(values) {
    const edges = [];
    let wasHigh = false;

    values.forEach((value, index) => {
        const isHigh = value > 0;
        if (isHigh && !wasHigh) edges.push(index);
        wasHigh = isHigh;
    });

    return edges;
}

function highRunLength(values, start) {
    let length = 0;
    for (let i = start; i < values.length && values[i] === 10; i++) {
        length++;
    }
    return length;
}

function collect(dsp, {
    totalSamples,
    trigEdges = [],
    pingEdges = [],
    quantityCv = 0,
    distributionCv = 0,
    timeCv = 0,
    probabilityCv = 0,
    beforeBlock = null
}) {
    const bufferSize = dsp.outputs.out.length;
    const trigSet = new Set(trigEdges);
    const pingSet = new Set(pingEdges);
    const out = [];
    const tempo = [];
    const eoc = [];

    for (let offset = 0; offset < totalSamples; offset += bufferSize) {
        const len = Math.min(bufferSize, totalSamples - offset);

        beforeBlock?.(dsp, offset);

        dsp.inputs.trig.fill(0);
        dsp.inputs.ping.fill(0);
        dsp.inputs.quantityCv.fill(quantityCv);
        dsp.inputs.distributionCv.fill(distributionCv);
        dsp.inputs.timeCv.fill(timeCv);
        dsp.inputs.probabilityCv.fill(probabilityCv);

        for (let i = 0; i < len; i++) {
            const sample = offset + i;
            if (trigSet.has(sample)) dsp.inputs.trig[i] = 10;
            if (pingSet.has(sample)) dsp.inputs.ping[i] = 10;
        }

        dsp.process();

        for (let i = 0; i < len; i++) {
            out.push(dsp.outputs.out[i]);
            tempo.push(dsp.outputs.tempo[i]);
            eoc.push(dsp.outputs.eoc[i]);
        }
    }

    return { out, tempo, eoc };
}

describe('createBurst', () => {
    let burst;

    beforeEach(() => {
        burst = createBurst();
    });

    describe('initialization', () => {
        it('creates the documented default params', () => {
            expect(burst.params).toEqual({
                tempo: 120,
                quantity: 4,
                quantityCvAmount: 1,
                distribution: 0,
                timeFactor: 1,
                probability: 1,
                cycle: 0,
                includeFirstPulse: 1,
                retrigger: 1
            });
        });

        it('creates input, output, and LED contracts', () => {
            expect(burst.inputs.trig).toBeInstanceOf(Float32Array);
            expect(burst.inputs.ping).toBeInstanceOf(Float32Array);
            expect(burst.inputs.quantityCv).toBeInstanceOf(Float32Array);
            expect(burst.inputs.distributionCv).toBeInstanceOf(Float32Array);
            expect(burst.inputs.timeCv).toBeInstanceOf(Float32Array);
            expect(burst.inputs.probabilityCv).toBeInstanceOf(Float32Array);

            expect(burst.outputs.out).toBeInstanceOf(Float32Array);
            expect(burst.outputs.tempo).toBeInstanceOf(Float32Array);
            expect(burst.outputs.eoc).toBeInstanceOf(Float32Array);
            expect(burst.outputs.out.length).toBe(64);

            expect(burst.leds).toEqual({
                active: 0,
                out: 0,
                tempo: 0,
                eoc: 0
            });
        });

        it('accepts custom sample rate and buffer size', () => {
            const custom = burstModule.createDSP({ sampleRate: 48000, bufferSize: 32 });
            expect(custom.inputs.trig.length).toBe(32);
            expect(custom.outputs.out.length).toBe(32);
        });
    });

    describe('voltage and buffer integrity', () => {
        it('outputs only finite 0V/10V trigger levels', () => {
            burst.params.quantity = 32;
            burst.params.distribution = 1;
            burst.params.timeFactor = -8;
            burst.params.probability = 0.5;

            const result = collect(burst, {
                totalSamples: 512,
                trigEdges: [0],
                quantityCv: 10,
                distributionCv: 10,
                timeCv: 10,
                probabilityCv: 10
            });

            [...result.out, ...result.tempo, ...result.eoc].forEach(value => {
                expect(Number.isFinite(value)).toBe(true);
                expect([0, 10]).toContain(value);
            });
        });
    });

    describe('trigger behavior', () => {
        it('uses a strict >2.5V trigger threshold', () => {
            burst.inputs.trig.fill(0);
            burst.inputs.trig[8] = 2.5;
            burst.process();
            expect(burst.outputs.out.some(value => value > 0)).toBe(false);

            burst.reset();
            burst.inputs.trig.fill(0);
            burst.inputs.trig[8] = 2.51;
            burst.process();
            expect(burst.outputs.out.some(value => value === 10)).toBe(true);
        });

        it('does not retrigger while trig is held high', () => {
            const held = createBurst({ bufferSize: 32 });

            held.inputs.trig.fill(10);
            held.process();
            const first = Array.from(held.outputs.out);

            held.inputs.trig.fill(10);
            held.process();
            const second = Array.from(held.outputs.out);

            expect(risingEdges([...first, ...second])).toEqual([0]);
        });

        it('schedules a linear four-pulse burst inside the base window', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 4;
            burst.params.distribution = 0;

            const result = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0]
            });

            expect(risingEdges(result.out)).toEqual([0, 333, 667, 1000]);
            expect(risingEdges(result.eoc)).toEqual([1010]);
        });

        it('shrinks output pulses when spacing is shorter than 10ms', () => {
            burst.params.tempo = 6000;
            burst.params.quantity = 3;

            const result = collect(burst, {
                totalSamples: 40,
                trigEdges: [0]
            });

            expect(risingEdges(result.out)).toEqual([0, 5, 10]);
            expect(highRunLength(result.out, 0)).toBe(4);
        });
    });

    describe('ping and tempo behavior', () => {
        it('keeps the internal tempo after only one ping', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;

            const result = collect(burst, {
                totalSamples: 1080,
                pingEdges: [0],
                trigEdges: [50]
            });

            expect(risingEdges(result.out)).toEqual([50, 1050]);
        });

        it('uses two ping edges to set the burst window', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;

            const result = collect(burst, {
                totalSamples: 480,
                pingEdges: [0, 200],
                trigEdges: [250]
            });

            expect(risingEdges(result.out)).toEqual([250, 450]);
        });

        it('emits tempo triggers from the measured ping interval', () => {
            const result = collect(burst, {
                totalSamples: 650,
                pingEdges: [10, 210]
            });

            expect(risingEdges(result.tempo)).toEqual([410, 610]);
        });
    });

    describe('quantity and CV inputs', () => {
        it('maps quantity CV as -5V to +5V equals -16 to +16 triggers', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 20;

            const reduced = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0],
                quantityCv: -5
            });

            expect(risingEdges(reduced.out).length).toBe(4);

            const attenuated = createBurst();
            attenuated.params.tempo = 60;
            attenuated.params.quantity = 4;
            attenuated.params.quantityCvAmount = 0;

            const ignored = collect(attenuated, {
                totalSamples: 1030,
                trigEdges: [0],
                quantityCv: 5
            });

            expect(risingEdges(ignored.out).length).toBe(4);
        });

        it('freezes quantity for the active burst', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;

            const result = collect(burst, {
                totalSamples: 2140,
                trigEdges: [0, 1120],
                beforeBlock: (dsp, offset) => {
                    if (offset >= 128) dsp.params.quantity = 8;
                }
            });

            expect(risingEdges(result.out).slice(0, 2)).toEqual([0, 1000]);
            expect(risingEdges(result.out).filter(edge => edge >= 1120).length).toBeGreaterThan(2);
        });
    });

    describe('time factor and distribution', () => {
        it('quantizes time factors from division through multiplication', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.timeFactor = -2;

            const divided = collect(burst, {
                totalSamples: 540,
                trigEdges: [0]
            });

            expect(risingEdges(divided.out)).toEqual([0, 500]);

            const multiplied = createBurst();
            multiplied.params.tempo = 60;
            multiplied.params.quantity = 2;
            multiplied.params.timeFactor = 2;

            const stretched = collect(multiplied, {
                totalSamples: 2040,
                trigEdges: [0]
            });

            expect(risingEdges(stretched.out)).toEqual([0, 2000]);
        });

        it('lets time CV shift and clamp the quantized time factor', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.timeFactor = 1;

            const result = collect(burst, {
                totalSamples: 8030,
                trigEdges: [0],
                timeCv: 5
            });

            expect(risingEdges(result.out)).toEqual([0, 8000]);
        });

        it('bends pulse spacing in opposite directions around linear center', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 4;
            burst.params.distribution = 0;

            const linearEdges = risingEdges(collect(burst, {
                totalSamples: 1030,
                trigEdges: [0]
            }).out);
            expect(linearEdges).toEqual([0, 333, 667, 1000]);

            const positive = createBurst();
            positive.params.tempo = 60;
            positive.params.quantity = 4;
            positive.params.distribution = 1;
            const positiveEdges = risingEdges(collect(positive, {
                totalSamples: 1030,
                trigEdges: [0]
            }).out);

            const negative = createBurst();
            negative.params.tempo = 60;
            negative.params.quantity = 4;
            negative.params.distribution = -1;
            const negativeEdges = risingEdges(collect(negative, {
                totalSamples: 1030,
                trigEdges: [0]
            }).out);

            expect(positiveEdges).toEqual([0, 4, 132, 1000]);
            expect(negativeEdges).toEqual([0, 868, 996, 1000]);
        });

        it('adds and clamps distribution CV', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 4;
            burst.params.distribution = 0;

            const result = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0],
                distributionCv: -5
            });

            expect(risingEdges(result.out)).toEqual([0, 868, 996, 1000]);
        });
    });

    describe('probability behavior', () => {
        it('inhibits external bursts at probability zero but still emits EOC', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 4;
            burst.params.probability = 0;

            const result = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0]
            });

            expect(risingEdges(result.out)).toEqual([]);
            expect(risingEdges(result.eoc)).toEqual([1000]);
        });

        it('lets probability CV restore an inhibited burst', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.probability = 0;

            const result = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0],
                probabilityCv: 5
            });

            expect(risingEdges(result.out)).toEqual([0, 1000]);
        });
    });

    describe('switch behavior', () => {
        it('omits the immediate pulse when includeFirstPulse is off', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.includeFirstPulse = 0;

            const result = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0]
            });

            expect(risingEdges(result.out)).toEqual([500, 1000]);
        });

        it('restarts active bursts when retrigger is on', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.retrigger = 1;

            const result = collect(burst, {
                totalSamples: 1230,
                trigEdges: [0, 200]
            });

            expect(risingEdges(result.out)).toEqual([0, 200, 1200]);
        });

        it('ignores in-flight triggers when retrigger is off', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.retrigger = 0;

            const result = collect(burst, {
                totalSamples: 1030,
                trigEdges: [0, 200]
            });

            expect(risingEdges(result.out)).toEqual([0, 1000]);
        });

        it('cycles after the first trigger and stops when cycle is switched off', () => {
            burst.params.tempo = 600;
            burst.params.quantity = 1;
            burst.params.cycle = 1;

            const result = collect(burst, {
                totalSamples: 260,
                trigEdges: [0],
                beforeBlock: (dsp, offset) => {
                    if (offset >= 150) dsp.params.cycle = 0;
                }
            });

            expect(risingEdges(result.out)).toEqual([0, 100]);
        });

        it('preserves boundary pulses while cycling with includeFirstPulse off', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 2;
            burst.params.includeFirstPulse = 0;
            burst.params.cycle = 1;

            const result = collect(burst, {
                totalSamples: 1540,
                trigEdges: [0]
            });

            expect(risingEdges(result.out)).toEqual([500, 1000, 1500]);
            expect(highRunLength(result.out, 1000)).toBe(10);
        });
    });

    describe('LEDs and reset', () => {
        it('updates LEDs for active, out, tempo, and EOC pulses', () => {
            burst.params.tempo = 600;
            burst.params.quantity = 1;

            collect(burst, {
                totalSamples: 120,
                trigEdges: [0]
            });

            expect(burst.leds.active).toBe(0);
            expect(burst.leds.out).toBe(0);
            expect(burst.leds.tempo).toBe(1);
            expect(burst.leds.eoc).toBe(1);
        });

        it('reset clears state and outputs but preserves params', () => {
            burst.params.tempo = 60;
            burst.params.quantity = 7;

            collect(burst, {
                totalSamples: 128,
                trigEdges: [0]
            });

            burst.reset();

            expect(burst.outputs.out.every(value => value === 0)).toBe(true);
            expect(burst.outputs.tempo.every(value => value === 0)).toBe(true);
            expect(burst.outputs.eoc.every(value => value === 0)).toBe(true);
            expect(burst.leds).toEqual({
                active: 0,
                out: 0,
                tempo: 0,
                eoc: 0
            });
            expect(burst.params.quantity).toBe(7);
            expect(burst.params.tempo).toBe(60);
        });
    });
});
