import { describe, it, expect, beforeEach } from 'vitest';
import swingModule, { SWING_TEMPLATE_WEIGHTS } from '../../src/js/modules/swing/index.js';

const SAMPLE_RATE = 1000;

const createSwing = (options = {}) => swingModule.createDSP({
    sampleRate: SAMPLE_RATE,
    bufferSize: 256,
    ...options
});

function collect(dsp, {
    totalSamples,
    clockEdges = [],
    resetEdges = [],
    swingCV = 0,
    humanCV = 0
}) {
    const bufferSize = dsp.outputs.swung.length;
    const clockSet = new Set(clockEdges);
    const resetSet = new Set(resetEdges);
    const clock = [];
    const straight = [];

    for (let offset = 0; offset < totalSamples; offset += bufferSize) {
        const len = Math.min(bufferSize, totalSamples - offset);

        dsp.inputs.clock.fill(0);
        dsp.inputs.reset.fill(0);
        dsp.inputs.swingCV.fill(swingCV);
        dsp.inputs.humanCV.fill(humanCV);

        for (let i = 0; i < len; i++) {
            const sample = offset + i;
            if (clockSet.has(sample)) dsp.inputs.clock[i] = 10;
            if (resetSet.has(sample)) dsp.inputs.reset[i] = 10;
        }

        dsp.process();

        for (let i = 0; i < len; i++) {
            clock.push(dsp.outputs.swung[i]);
            straight.push(dsp.outputs.straight[i]);
        }
    }

    return { clock, straight };
}

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

describe('createSwing', () => {
    let swing;

    beforeEach(() => {
        swing = createSwing();
    });

    describe('initialization', () => {
        it('creates documented params, ports, outputs, and LEDs', () => {
            expect(swing.params).toEqual({
                swing: 0,
                human: 0,
                width: 0.1,
                template: 0
            });

            expect(swing.inputs.clock).toBeInstanceOf(Float32Array);
            expect(swing.inputs.reset).toBeInstanceOf(Float32Array);
            expect(swing.inputs.swingCV).toBeInstanceOf(Float32Array);
            expect(swing.inputs.humanCV).toBeInstanceOf(Float32Array);
            expect(swing.outputs.swung).toBeInstanceOf(Float32Array);
            expect(swing.outputs.straight).toBeInstanceOf(Float32Array);
            expect(swing.leds.in).toBe(0);
            expect(swing.leds.out).toBe(0);
        });

        it('accepts custom buffer sizes', () => {
            const custom = createSwing({ bufferSize: 64 });
            expect(custom.inputs.clock.length).toBe(64);
            expect(custom.outputs.swung.length).toBe(64);
        });
    });

    describe('voltage and buffer integrity', () => {
        it('outputs only finite 0V/10V trigger levels', () => {
            swing.params.swing = 1;
            swing.params.human = 1;
            swing.params.width = 1;
            swing.params.template = 3;

            const { clock, straight } = collect(swing, {
                totalSamples: 512,
                clockEdges: [10, 90, 170, 250, 330, 410],
                swingCV: 10,
                humanCV: 10
            });

            [...clock, ...straight].forEach(value => {
                expect(Number.isFinite(value)).toBe(true);
                expect([0, 10]).toContain(value);
            });
        });
    });

    describe('clock input', () => {
        it('uses a strict >2.5V rising-edge threshold', () => {
            swing.inputs.clock.fill(0);
            swing.inputs.clock[8] = 2.5;
            swing.process();
            expect(swing.outputs.swung.some(value => value > 0)).toBe(false);
            expect(swing.outputs.straight.some(value => value > 0)).toBe(false);

            swing.reset();
            swing.inputs.clock.fill(0);
            swing.inputs.clock[8] = 2.51;
            swing.process();
            expect(swing.outputs.swung.some(value => value === 10)).toBe(true);
            expect(swing.outputs.straight.some(value => value === 10)).toBe(true);
        });

        it('does not retrigger while the clock input is held high', () => {
            const held = createSwing({ bufferSize: 64 });
            held.inputs.clock.fill(10);
            held.process();
            const firstClock = Array.from(held.outputs.swung);

            held.inputs.clock.fill(10);
            held.process();
            const secondClock = Array.from(held.outputs.swung);

            expect(risingEdges([...firstClock, ...secondClock])).toEqual([0]);
        });
    });

    describe('swing timing', () => {
        it('keeps processed and straight outputs aligned when swing and humanization are zero', () => {
            swing.params.swing = 0;
            swing.params.human = 0;
            swing.params.width = 0;

            const result = collect(swing, {
                totalSamples: 320,
                clockEdges: [10, 110, 210]
            });

            expect(risingEdges(result.straight)).toEqual([10, 110, 210]);
            expect(risingEdges(result.clock)).toEqual([10, 110, 210]);
        });

        it('delays every second classic pulse by half the measured period at full swing', () => {
            swing.params.swing = 1;
            swing.params.human = 0;
            swing.params.width = 0;
            swing.params.template = 0;

            const result = collect(swing, {
                totalSamples: 390,
                clockEdges: [10, 110, 210, 310]
            });

            expect(risingEdges(result.straight)).toEqual([10, 110, 210, 310]);
            expect(risingEdges(result.clock)).toEqual([10, 160, 210, 360]);
        });

        it('scales classic swing delay linearly', () => {
            swing.params.swing = 0.5;
            swing.params.human = 0;
            swing.params.width = 0;
            swing.params.template = 0;

            const result = collect(swing, {
                totalSamples: 260,
                clockEdges: [10, 110, 210]
            });

            expect(risingEdges(result.clock)).toEqual([10, 135, 210]);
        });

        it('exports and applies the documented template tables', () => {
            expect(SWING_TEMPLATE_WEIGHTS[0]).toEqual([0, 1]);
            expect(SWING_TEMPLATE_WEIGHTS[1]).toEqual([0, 1.33]);
            expect(SWING_TEMPLATE_WEIGHTS[2]).toEqual([0, 1, 0.15, 0.70, 0, 0.90, 0.10, 0.60]);
            expect(SWING_TEMPLATE_WEIGHTS[3]).toEqual([0.20, 0.85, 0, 0.65, 0.10, 1, 0, 0.55]);

            const triplet = createSwing({ bufferSize: 256 });
            triplet.params.swing = 0.5;
            triplet.params.width = 0;
            triplet.params.template = 1;
            expect(risingEdges(collect(triplet, {
                totalSamples: 180,
                clockEdges: [10, 110]
            }).clock)).toEqual([10, 143]);

            const laidback = createSwing({ bufferSize: 512 });
            laidback.params.swing = 0.5;
            laidback.params.width = 0;
            laidback.params.template = 2;
            expect(risingEdges(collect(laidback, {
                totalSamples: 360,
                clockEdges: [10, 110, 210, 310]
            }).clock)).toEqual([10, 135, 214, 328]);

            const pushPull = createSwing({ bufferSize: 512 });
            pushPull.params.swing = 0.5;
            pushPull.params.width = 0;
            pushPull.params.template = 3;
            expect(risingEdges(collect(pushPull, {
                totalSamples: 360,
                clockEdges: [10, 110, 210, 310]
            }).clock).slice(1)).toEqual([131, 210, 326]);
        });
    });

    describe('CV inputs', () => {
        it('adds and clamps swing CV from 0V to 5V', () => {
            const noCv = createSwing({ bufferSize: 256 });
            noCv.params.swing = 0;
            noCv.params.width = 0;
            expect(risingEdges(collect(noCv, {
                totalSamples: 180,
                clockEdges: [10, 110],
                swingCV: -5
            }).clock)).toEqual([10, 110]);

            const fullCv = createSwing({ bufferSize: 256 });
            fullCv.params.swing = 0;
            fullCv.params.width = 0;
            expect(risingEdges(collect(fullCv, {
                totalSamples: 200,
                clockEdges: [10, 110],
                swingCV: 5
            }).clock)).toEqual([10, 160]);

            const overCv = createSwing({ bufferSize: 256 });
            overCv.params.swing = 0;
            overCv.params.width = 0;
            expect(risingEdges(collect(overCv, {
                totalSamples: 200,
                clockEdges: [10, 110],
                swingCV: 10
            }).clock)).toEqual([10, 160]);
        });

        it('adds human CV within the documented timing bounds', () => {
            swing.params.swing = 0;
            swing.params.human = 0;
            swing.params.width = 0;

            const result = collect(swing, {
                totalSamples: 260,
                clockEdges: [10, 110, 210],
                humanCV: 5
            });

            const secondOutput = risingEdges(result.clock).find(edge => edge >= 110);
            expect(secondOutput).toBeGreaterThanOrEqual(110);
            expect(secondOutput).toBeLessThanOrEqual(130);
        });
    });

    describe('humanization', () => {
        it('is deterministic across instances and after reset', () => {
            const makeHumanized = () => {
                const dsp = createSwing({ bufferSize: 128 });
                dsp.params.swing = 0.4;
                dsp.params.human = 0.7;
                dsp.params.width = 0;
                dsp.params.template = 3;
                return dsp;
            };

            const first = collect(makeHumanized(), {
                totalSamples: 512,
                clockEdges: [10, 110, 210, 310, 410]
            }).clock;
            const second = collect(makeHumanized(), {
                totalSamples: 512,
                clockEdges: [10, 110, 210, 310, 410]
            }).clock;

            expect(second).toEqual(first);

            const reused = makeHumanized();
            const beforeReset = collect(reused, {
                totalSamples: 512,
                clockEdges: [10, 110, 210, 310, 410]
            }).clock;
            reused.reset();
            const afterReset = collect(reused, {
                totalSamples: 512,
                clockEdges: [10, 110, 210, 310, 410]
            }).clock;

            expect(afterReset).toEqual(beforeReset);
        });
    });

    describe('width and delayed event scheduling', () => {
        it('uses a 5ms minimum pulse width', () => {
            swing.params.width = 0;

            const result = collect(swing, {
                totalSamples: 64,
                clockEdges: [10]
            });

            expect(highRunLength(result.clock, 10)).toBe(5);
            expect(highRunLength(result.straight, 10)).toBe(5);
        });

        it('limits maximum width to half the measured period', () => {
            swing.params.swing = 1;
            swing.params.width = 1;

            const result = collect(swing, {
                totalSamples: 240,
                clockEdges: [10, 110]
            });
            const delayedEdge = risingEdges(result.clock)[1];

            expect(highRunLength(result.clock, delayedEdge)).toBeLessThanOrEqual(50);
        });

        it('fires delayed events across audio-buffer boundaries', () => {
            const smallBuffer = createSwing({ bufferSize: 64 });
            smallBuffer.params.swing = 1;
            smallBuffer.params.width = 0;

            const result = collect(smallBuffer, {
                totalSamples: 200,
                clockEdges: [10, 110]
            });

            expect(risingEdges(result.clock)).toEqual([10, 160]);
            expect(risingEdges(result.straight)).toEqual([10, 110]);
        });
    });

    describe('LEDs', () => {
        it('latches input and output activity for pulses inside the processed buffer', () => {
            swing.params.width = 0;

            collect(swing, {
                totalSamples: 64,
                clockEdges: [0]
            });

            expect(swing.leds.in).toBe(1);
            expect(swing.leds.out).toBe(1);
        });
    });

    describe('reset', () => {
        it('clears pending delayed pulses and returns the pattern to step zero', () => {
            swing.params.swing = 1;
            swing.params.width = 0;
            swing.params.template = 0;

            const result = collect(swing, {
                totalSamples: 300,
                clockEdges: [10, 110, 210],
                resetEdges: [130]
            });

            expect(risingEdges(result.straight)).toEqual([10, 110, 210]);
            expect(risingEdges(result.clock)).toEqual([10, 210]);
        });

        it('lets reset win over a clock edge in the same sample', () => {
            const resetWin = createSwing({ bufferSize: 32 });
            resetWin.inputs.clock.fill(0);
            resetWin.inputs.reset.fill(0);
            resetWin.inputs.clock[5] = 10;
            resetWin.inputs.reset[5] = 10;

            resetWin.process();

            expect(resetWin.outputs.swung.every(value => value === 0)).toBe(true);
            expect(resetWin.outputs.straight.every(value => value === 0)).toBe(true);
            expect(resetWin.leds.in).toBe(0);
            expect(resetWin.leds.out).toBe(0);
        });

        it('has a reset method that clears output buffers and LEDs', () => {
            swing.params.swing = 1;
            collect(swing, {
                totalSamples: 180,
                clockEdges: [10, 110]
            });

            swing.reset();

            expect(swing.outputs.swung.every(value => value === 0)).toBe(true);
            expect(swing.outputs.straight.every(value => value === 0)).toBe(true);
            expect(swing.leds.in).toBe(0);
            expect(swing.leds.out).toBe(0);
        });
    });
});
