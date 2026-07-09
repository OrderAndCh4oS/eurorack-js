import { describe, it, expect, beforeEach } from 'vitest';
import wavetableModule from '../../src/js/modules/wavetable/index.js';

const createWavetable = (options = {}) => wavetableModule.createDSP(options);

function finiteBuffer(buffer) {
    return buffer.every(value => Number.isFinite(value));
}

function peak(buffer) {
    return Math.max(...buffer.map(value => Math.abs(value)));
}

function rmsDifference(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum / a.length);
}

function countRisingCrossings(buffer) {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
        if (buffer[i - 1] < 0 && buffer[i] >= 0) crossings++;
    }
    return crossings;
}

function render(params = {}, inputValues = {}, options = {}, blocks = 3) {
    const osc = createWavetable({ bufferSize: 4096, ...options });
    Object.assign(osc.params, params);
    Object.entries(inputValues).forEach(([name, value]) => {
        osc.inputs[name].fill(value);
    });
    for (let i = 0; i < blocks; i++) osc.process();
    return { osc, output: [...osc.outputs.out] };
}

describe('wavetable module', () => {
    let wavetable;

    beforeEach(() => {
        wavetable = createWavetable();
    });

    describe('initialization', () => {
        it('creates the specified params, inputs, output, and LEDs', () => {
            expect(wavetable.params).toMatchObject({
                coarse: 0.4,
                fine: 0,
                bank: 0,
                position: 0,
                scanAmt: 0.5,
                fmAmt: 0,
                level: 0.9,
                interp: 1
            });

            expect(wavetable.inputs.vOct).toBeInstanceOf(Float32Array);
            expect(wavetable.inputs.fm).toBeInstanceOf(Float32Array);
            expect(wavetable.inputs.position).toBeInstanceOf(Float32Array);
            expect(wavetable.inputs.bankCv).toBeInstanceOf(Float32Array);
            expect(wavetable.inputs.sync).toBeInstanceOf(Float32Array);
            expect(wavetable.outputs.out).toBeInstanceOf(Float32Array);
            expect(wavetable.outputs.out.length).toBe(512);
            expect(wavetable.leds).toEqual({ level: 0, sync: 0 });
        });

        it('accepts custom sample rate and buffer size options', () => {
            const custom = createWavetable({ sampleRate: 48000, bufferSize: 256 });
            expect(custom.outputs.out.length).toBe(256);
            expect(custom.inputs.vOct.length).toBe(256);
        });

        it('produces a finite non-silent default signal', () => {
            wavetable.process();

            expect(finiteBuffer(wavetable.outputs.out)).toBe(true);
            expect(peak(wavetable.outputs.out)).toBeGreaterThan(0.1);
        });
    });

    describe('output range and buffer integrity', () => {
        it('keeps output inside +/-5V at modulation extremes', () => {
            Object.assign(wavetable.params, {
                coarse: 1,
                fine: 6,
                bank: 4,
                position: 1,
                scanAmt: 1,
                fmAmt: 1,
                level: 1,
                interp: 1
            });
            wavetable.inputs.vOct.fill(5);
            wavetable.inputs.fm.fill(5);
            wavetable.inputs.position.fill(5);
            wavetable.inputs.bankCv.fill(5);

            for (let i = 0; i < 5; i++) wavetable.process();

            expect(finiteBuffer(wavetable.outputs.out)).toBe(true);
            expect(Math.min(...wavetable.outputs.out)).toBeGreaterThanOrEqual(-5);
            expect(Math.max(...wavetable.outputs.out)).toBeLessThanOrEqual(5);
        });

        it('stays finite and bounded when FM would drive frequency negative', () => {
            Object.assign(wavetable.params, {
                coarse: 0,
                fmAmt: 1,
                level: 1
            });
            wavetable.inputs.fm.fill(-5);

            wavetable.process();

            expect(finiteBuffer(wavetable.outputs.out)).toBe(true);
            expect(peak(wavetable.outputs.out)).toBeLessThanOrEqual(5);
        });

        it('outputs silence when level is zero', () => {
            wavetable.params.level = 0;
            wavetable.process();

            expect(peak(wavetable.outputs.out)).toBe(0);
            expect(wavetable.leds.level).toBe(0);
        });

        it('uses a useful peak at full level without exceeding audio range', () => {
            wavetable.params.level = 1;

            for (let i = 0; i < 4; i++) wavetable.process();

            expect(peak(wavetable.outputs.out)).toBeGreaterThan(3);
            expect(peak(wavetable.outputs.out)).toBeLessThanOrEqual(5);
        });
    });

    describe('pitch and FM response', () => {
        it('tracks V/Oct so +1V approximately doubles frequency', () => {
            const options = { sampleRate: 44100, bufferSize: 44100 };
            const base = createWavetable(options);
            Object.assign(base.params, { coarse: 0.35, position: 0, bank: 0, level: 1 });
            base.inputs.vOct.fill(0);
            base.process();
            base.process();

            const octave = createWavetable(options);
            Object.assign(octave.params, { coarse: 0.35, position: 0, bank: 0, level: 1 });
            octave.inputs.vOct.fill(1);
            octave.process();
            octave.process();

            const baseCount = countRisingCrossings(base.outputs.out);
            const octaveCount = countRisingCrossings(octave.outputs.out);

            expect(baseCount).toBeGreaterThan(50);
            expect(octaveCount / baseCount).toBeGreaterThan(1.85);
            expect(octaveCount / baseCount).toBeLessThan(2.15);
        });

        it('fine tunes by semitones around the coarse frequency', () => {
            const options = { sampleRate: 44100, bufferSize: 44100 };
            const low = createWavetable(options);
            Object.assign(low.params, { coarse: 0.35, fine: -6, position: 0, bank: 0, level: 1 });
            low.process();

            const base = createWavetable(options);
            Object.assign(base.params, { coarse: 0.35, fine: 0, position: 0, bank: 0, level: 1 });
            base.process();

            const high = createWavetable(options);
            Object.assign(high.params, { coarse: 0.35, fine: 6, position: 0, bank: 0, level: 1 });
            high.process();

            expect(countRisingCrossings(low.outputs.out)).toBeLessThan(countRisingCrossings(base.outputs.out));
            expect(countRisingCrossings(high.outputs.out)).toBeGreaterThan(countRisingCrossings(base.outputs.out));
        });

        it('responds to linear FM amount and CV', () => {
            const dry = render({ coarse: 0.45, fmAmt: 0, level: 1 }, { fm: 5 }).output;
            const modulated = render({ coarse: 0.45, fmAmt: 1, level: 1 }, { fm: 5 }).output;

            expect(rmsDifference(dry, modulated)).toBeGreaterThan(0.5);
        });
    });

    describe('wavetable position and bank selection', () => {
        it('selects detectably different waves at position endpoints', () => {
            const start = render({ bank: 1, position: 0, scanAmt: 0, level: 1 }).output;
            const end = render({ bank: 1, position: 1, scanAmt: 0, level: 1 }).output;

            expect(rmsDifference(start, end)).toBeGreaterThan(0.5);
        });

        it('uses position CV with scan amount and clamps to endpoints', () => {
            const low = render({ bank: 1, position: 0.5, scanAmt: 1, level: 1 }, { position: -5 }).output;
            const high = render({ bank: 1, position: 0, scanAmt: 1, level: 1 }, { position: 5 }).output;
            const directLow = render({ bank: 1, position: 0, scanAmt: 0, level: 1 }).output;
            const directHigh = render({ bank: 1, position: 1, scanAmt: 0, level: 1 }).output;

            expect(rmsDifference(low, directLow)).toBeLessThan(0.05);
            expect(rmsDifference(high, directHigh)).toBeLessThan(0.05);
        });

        it('ignores position CV when scan amount is zero', () => {
            const negative = render({ bank: 2, position: 0.35, scanAmt: 0, level: 1 }, { position: -5 }).output;
            const positive = render({ bank: 2, position: 0.35, scanAmt: 0, level: 1 }, { position: 5 }).output;

            expect(rmsDifference(negative, positive)).toBeLessThan(0.001);
        });

        it('quantizes bank knob and lets Bank CV offset the bank', () => {
            const direct = render({ bank: 4, position: 0.35, level: 1 }).output;
            const cvOffset = render({ bank: 0, position: 0.35, level: 1 }, { bankCv: 4 }).output;

            expect(rmsDifference(direct, cvOffset)).toBeLessThan(0.001);
        });

        it('clamps extreme Bank CV values to valid banks', () => {
            const low = render({ bank: 2, position: 0.6, level: 1 }, { bankCv: -10 }).output;
            const high = render({ bank: 2, position: 0.6, level: 1 }, { bankCv: 10 }).output;

            expect(finiteBuffer(low)).toBe(true);
            expect(finiteBuffer(high)).toBe(true);
            expect(Math.max(peak(low), peak(high))).toBeLessThanOrEqual(5);
        });
    });

    describe('interpolation mode', () => {
        it('smooth mode blends adjacent waves while step mode snaps', () => {
            const smooth = render({ bank: 3, position: 0.3, scanAmt: 0, interp: 1, level: 1 }, {}, {}, 8).output;
            const stepped = render({ bank: 3, position: 0.3, scanAmt: 0, interp: 0, level: 1 }, {}, {}, 8).output;

            expect(rmsDifference(smooth, stepped)).toBeGreaterThan(0.05);
            expect(peak(smooth)).toBeLessThanOrEqual(5);
            expect(peak(stepped)).toBeLessThanOrEqual(5);
        });
    });

    describe('sync and reset', () => {
        it('resets phase only on rising sync edges above 2.5V', () => {
            const osc = createWavetable({ bufferSize: 128 });
            Object.assign(osc.params, { coarse: 0.5, bank: 0, position: 0, level: 1 });

            osc.process();

            osc.inputs.sync.fill(2.5);
            osc.process();
            expect(osc.leds.sync).toBe(0);

            osc.inputs.sync.fill(2.6);
            osc.process();
            const resetFirstSample = osc.outputs.out[0];
            expect(Math.abs(resetFirstSample)).toBeLessThan(0.05);
            expect(osc.leds.sync).toBe(1);

            osc.inputs.sync.fill(2.6);
            osc.process();
            const heldFirstSample = osc.outputs.out[0];
            expect(Math.abs(heldFirstSample)).toBeGreaterThan(0.25);

            osc.inputs.sync.fill(0);
            osc.process();
            osc.inputs.sync.fill(5);
            osc.process();
            expect(Math.abs(osc.outputs.out[0])).toBeLessThan(0.05);
        });

        it('reset clears phase, buffers, LEDs, and sync edge state', () => {
            const osc = createWavetable({ bufferSize: 128 });
            osc.params.level = 1;
            osc.inputs.sync.fill(5);
            osc.process();
            expect(osc.leds.sync).toBe(1);

            osc.reset();

            expect(peak(osc.outputs.out)).toBe(0);
            expect(osc.leds).toEqual({ level: 0, sync: 0 });

            osc.inputs.sync.fill(5);
            osc.process();
            expect(osc.leds.sync).toBe(1);
            expect(Math.abs(osc.outputs.out[0])).toBeLessThan(0.05);
        });
    });

    describe('LED behavior', () => {
        it('level LED follows output peak and decays when silent', () => {
            wavetable.params.level = 1;
            wavetable.process();
            expect(wavetable.leds.level).toBeGreaterThan(0.2);

            const lit = wavetable.leds.level;
            wavetable.params.level = 0;
            wavetable.process();

            expect(wavetable.leds.level).toBeLessThan(lit);
        });
    });

    describe('spec compliance stress cases', () => {
        it('keeps high-frequency bright table playback bounded and finite', () => {
            const osc = createWavetable();
            Object.assign(osc.params, {
                coarse: 1,
                fine: 6,
                bank: 1,
                position: 1,
                fmAmt: 1,
                level: 1
            });
            osc.inputs.vOct.fill(1);
            osc.inputs.fm.fill(5);

            for (let i = 0; i < 8; i++) osc.process();

            expect(finiteBuffer(osc.outputs.out)).toBe(true);
            expect(peak(osc.outputs.out)).toBeLessThanOrEqual(5);
        });
    });
});
