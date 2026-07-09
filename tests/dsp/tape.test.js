import { describe, it, expect } from 'vitest';
import tapeModule from '../../src/js/modules/tape/index.js';

const createTape = (options = {}) => tapeModule.createDSP(options);

function peak(buffer, from = 0, to = buffer.length) {
    let max = 0;
    for (let i = from; i < to; i++) {
        max = Math.max(max, Math.abs(buffer[i]));
    }
    return max;
}

function peakIndex(buffer, from = 0, to = buffer.length) {
    let index = from;
    let max = 0;
    for (let i = from; i < to; i++) {
        const value = Math.abs(buffer[i]);
        if (value > max) {
            max = value;
            index = i;
        }
    }
    return index;
}

function localPeak(buffer, center, radius = 3) {
    return peak(buffer, Math.max(0, center - radius), Math.min(buffer.length, center + radius + 1));
}

function meanAbs(buffer, from = 0, to = buffer.length) {
    let sum = 0;
    for (let i = from; i < to; i++) {
        sum += Math.abs(buffer[i]);
    }
    return sum / Math.max(1, to - from);
}

function rms(buffer, from = 0, to = buffer.length) {
    let sum = 0;
    for (let i = from; i < to; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / Math.max(1, to - from));
}

function configureTiming(dsp, overrides = {}) {
    Object.assign(dsp.params, {
        time: 0,
        feedback: 0,
        mix: 1,
        drive: 0,
        age: 0,
        lowCut: 0,
        wow: 0,
        crinkle: 0,
        freeze: 0,
        headMode: 0,
        ...overrides
    });
}

function impulseResponse({ sampleRate = 1000, bufferSize = 300, headMode = 0, time = 0 } = {}) {
    const dsp = createTape({ sampleRate, bufferSize });
    configureTiming(dsp, { headMode, time });
    dsp.inputs.audio[0] = 5;
    dsp.process();
    return dsp.outputs.out;
}

function delayedPeakForInput(input, drive) {
    const dsp = createTape({ sampleRate: 1000, bufferSize: 120 });
    configureTiming(dsp, { drive });
    dsp.inputs.audio[0] = input;
    dsp.process();
    return localPeak(dsp.outputs.out, 50, 2);
}

describe('TAPE module', () => {
    describe('initialization and UI contract', () => {
        it('creates the documented params, ports, outputs, LEDs, and delay range', () => {
            const tape = createTape();

            expect(tape.params).toEqual({
                time: 0.45,
                feedback: 0.35,
                mix: 0.45,
                drive: 0.25,
                age: 0.35,
                lowCut: 0.2,
                wow: 0.15,
                crinkle: 0.05,
                freeze: 0,
                headMode: 1
            });
            expect(Object.keys(tape.inputs)).toEqual([
                'audio',
                'timeCV',
                'speedCV',
                'feedbackCV',
                'mixCV',
                'tap',
                'freezeGate'
            ]);
            Object.values(tape.inputs).forEach(input => {
                expect(input).toBeInstanceOf(Float32Array);
                expect(input.length).toBe(512);
            });
            expect(tape.outputs.out).toBeInstanceOf(Float32Array);
            expect(tape.outputs.clock).toBeInstanceOf(Float32Array);
            expect(tape.leds).toEqual({ level: 0, freeze: 0, clock: 0, dropout: 0 });
            expect(tape.delayRange.minSamples).toBeCloseTo(2205, 0);
            expect(tape.delayRange.maxSamples).toBeCloseTo(110250, 0);
        });

        it('accepts custom sample rate and buffer size options', () => {
            const tape = createTape({ sampleRate: 48000, bufferSize: 128 });

            expect(tape.inputs.audio.length).toBe(128);
            expect(tape.outputs.out.length).toBe(128);
            expect(tape.outputs.clock.length).toBe(128);
            expect(tape.delayRange.minSamples).toBeCloseTo(2400, 0);
        });

        it('defines the expected declarative UI ports and controls', () => {
            expect(tapeModule).toMatchObject({
                id: 'tape',
                name: 'TAPE',
                hp: 10,
                color: 'module-color-three',
                category: 'effect'
            });
            expect(tapeModule.ui.knobs.map(knob => knob.param)).toEqual([
                'time',
                'feedback',
                'mix',
                'drive',
                'age',
                'lowCut',
                'wow',
                'crinkle'
            ]);
            expect(tapeModule.ui.switches[0]).toMatchObject({ param: 'freeze', default: 0 });
            expect(tapeModule.ui.buttons[0]).toMatchObject({
                param: 'headMode',
                values: [0, 1, 2],
                default: 1
            });
            expect(tapeModule.ui.inputs.map(input => input.port)).toEqual([
                'audio',
                'timeCV',
                'speedCV',
                'feedbackCV',
                'mixCV',
                'tap',
                'freezeGate'
            ]);
            expect(tapeModule.ui.outputs.map(output => output.port)).toEqual(['out', 'clock']);
            expect(tapeModule.ui.socketLayout).toEqual({
                columns: [
                    {
                        className: 'socket-column-left',
                        columns: 1,
                        ports: ['audio', 'tap', 'freezeGate']
                    },
                    {
                        className: 'socket-column-right',
                        columns: 2,
                        ports: ['out', 'clock', 'timeCV', 'speedCV', 'feedbackCV', 'mixCV']
                    }
                ]
            });
        });
    });

    describe('output range, silence, and buffer integrity', () => {
        it('is silent and finite by default with no audio input', () => {
            const tape = createTape();

            tape.process();

            expect(tape.outputs.out.every(value => value === 0)).toBe(true);
            expect(tape.outputs.out.every(Number.isFinite)).toBe(true);
            expect(tape.outputs.clock.every(Number.isFinite)).toBe(true);
            expect(tape.leds.level).toBe(0);
        });

        it('bounds hot driven feedback to the rack audio range', () => {
            const tape = createTape({ sampleRate: 1000, bufferSize: 128 });

            Object.assign(tape.params, {
                time: 0,
                feedback: 1,
                mix: 1,
                drive: 1,
                age: 1,
                lowCut: 0,
                wow: 1,
                crinkle: 1,
                headMode: 2
            });

            for (let block = 0; block < 80; block++) {
                for (let i = 0; i < tape.inputs.audio.length; i++) {
                    tape.inputs.audio[i] = i % 2 === 0 ? 12 : -12;
                    tape.inputs.feedbackCV[i] = 5;
                    tape.inputs.mixCV[i] = 5;
                    tape.inputs.speedCV[i] = block % 2 === 0 ? 3 : -3;
                }
                tape.process();
            }

            expect(tape.outputs.out.every(Number.isFinite)).toBe(true);
            expect(Math.max(...tape.outputs.out)).toBeLessThanOrEqual(5);
            expect(Math.min(...tape.outputs.out)).toBeGreaterThanOrEqual(-5);
        });
    });

    describe('delay timing and head modes', () => {
        it('places a single-head impulse at the 50ms minimum delay', () => {
            const response = impulseResponse({ headMode: 0 });

            expect(peakIndex(response, 35, 70)).toBeGreaterThanOrEqual(49);
            expect(peakIndex(response, 35, 70)).toBeLessThanOrEqual(51);
            expect(localPeak(response, 50, 2)).toBeGreaterThan(3);
        });

        it('places even multi-head taps at quarter, half, three-quarter, and full delay', () => {
            const response = impulseResponse({ headMode: 1 });

            [13, 25, 38, 50].forEach(expected => {
                expect(localPeak(response, expected, 2)).toBeGreaterThan(0.1);
            });
        });

        it('places triplet multi-head taps at the documented ratios', () => {
            const response = impulseResponse({ headMode: 2 });

            [8, 17, 33, 50].forEach(expected => {
                expect(localPeak(response, expected, 2)).toBeGreaterThan(0.1);
            });
        });

        it('maps the time control from about 50ms to 2500ms', () => {
            const minResponse = impulseResponse({ sampleRate: 1000, bufferSize: 200, time: 0 });
            const maxResponse = impulseResponse({ sampleRate: 1000, bufferSize: 2800, time: 1 });

            expect(peakIndex(minResponse, 30, 80)).toBeGreaterThanOrEqual(49);
            expect(peakIndex(minResponse, 30, 80)).toBeLessThanOrEqual(51);
            expect(peakIndex(maxResponse, 2400, 2600)).toBeGreaterThanOrEqual(2498);
            expect(peakIndex(maxResponse, 2400, 2600)).toBeLessThanOrEqual(2502);
        });
    });

    describe('controls and tone shaping', () => {
        it('returns dry audio at mix 0 and wet-only delayed audio at mix 1', () => {
            const dry = createTape({ sampleRate: 1000, bufferSize: 80 });
            configureTiming(dry, { mix: 0 });
            for (let i = 0; i < dry.inputs.audio.length; i++) {
                dry.inputs.audio[i] = Math.sin(i * 0.12) * 3;
            }
            dry.process();

            for (let i = 0; i < dry.outputs.out.length; i++) {
                expect(dry.outputs.out[i]).toBeCloseTo(dry.inputs.audio[i], 5);
            }

            const wet = createTape({ sampleRate: 1000, bufferSize: 80 });
            configureTiming(wet, { mix: 1 });
            wet.inputs.audio.fill(3);
            wet.process();

            expect(Math.abs(wet.outputs.out[0])).toBeLessThan(0.001);
            expect(peak(wet.outputs.out, 49, 55)).toBeGreaterThan(2);
        });

        it('produces one repeat at zero feedback and decaying repeats at higher feedback', () => {
            const noFeedback = createTape({ sampleRate: 1000, bufferSize: 180 });
            configureTiming(noFeedback, { feedback: 0 });
            noFeedback.inputs.audio[0] = 5;
            noFeedback.process();

            expect(localPeak(noFeedback.outputs.out, 50, 2)).toBeGreaterThan(3);
            expect(localPeak(noFeedback.outputs.out, 100, 2)).toBeLessThan(0.25);

            const highFeedback = createTape({ sampleRate: 1000, bufferSize: 180 });
            configureTiming(highFeedback, { feedback: 0.8 });
            highFeedback.inputs.audio[0] = 5;
            highFeedback.process();

            expect(localPeak(highFeedback.outputs.out, 50, 2)).toBeGreaterThan(3);
            expect(localPeak(highFeedback.outputs.out, 100, 3)).toBeGreaterThan(0.5);
            expect(localPeak(highFeedback.outputs.out, 150, 3)).toBeGreaterThan(0.1);
        });

        it('record drive compresses high input more than low input', () => {
            const cleanLow = delayedPeakForInput(1, 0);
            const cleanHigh = delayedPeakForInput(5, 0);
            const drivenLow = delayedPeakForInput(1, 1);
            const drivenHigh = delayedPeakForInput(5, 1);

            expect(cleanHigh / cleanLow).toBeGreaterThan(4);
            expect(drivenHigh / drivenLow).toBeLessThan(cleanHigh / cleanLow);
        });

        it('age darkens high-frequency repeats', () => {
            const fresh = createTape({ sampleRate: 8000, bufferSize: 1000 });
            const old = createTape({ sampleRate: 8000, bufferSize: 1000 });

            [fresh, old].forEach(dsp => configureTiming(dsp, { age: 0 }));
            old.params.age = 1;

            for (let i = 0; i < fresh.inputs.audio.length; i++) {
                const sample = i % 2 === 0 ? 4 : -4;
                fresh.inputs.audio[i] = sample;
                old.inputs.audio[i] = sample;
            }

            fresh.process();
            old.process();

            expect(rms(old.outputs.out, 500, 900)).toBeLessThan(rms(fresh.outputs.out, 500, 900) * 0.75);
        });

        it('low cut thins sustained low-frequency repeats', () => {
            const full = createTape({ sampleRate: 2000, bufferSize: 700 });
            const cut = createTape({ sampleRate: 2000, bufferSize: 700 });

            [full, cut].forEach(dsp => configureTiming(dsp, { lowCut: 0 }));
            cut.params.lowCut = 1;
            full.inputs.audio.fill(3);
            cut.inputs.audio.fill(3);

            full.process();
            cut.process();

            expect(meanAbs(cut.outputs.out, 140, 300)).toBeLessThan(meanAbs(full.outputs.out, 140, 300) * 0.6);
        });

        it('wow/flutter modulates delay without producing invalid samples', () => {
            const steady = createTape({ sampleRate: 1000, bufferSize: 600 });
            const wobbled = createTape({ sampleRate: 1000, bufferSize: 600 });

            configureTiming(steady, { time: 0.45, wow: 0 });
            configureTiming(wobbled, { time: 0.45, wow: 1 });
            for (let i = 0; i < steady.inputs.audio.length; i++) {
                const sample = Math.sin(2 * Math.PI * 8 * i / 1000) * 4;
                steady.inputs.audio[i] = sample;
                wobbled.inputs.audio[i] = sample;
            }

            steady.process();
            wobbled.process();

            let diff = 0;
            for (let i = 250; i < 600; i++) {
                diff += Math.abs(steady.outputs.out[i] - wobbled.outputs.out[i]);
            }

            expect(wobbled.outputs.out.every(Number.isFinite)).toBe(true);
            expect(diff).toBeGreaterThan(0.05);
        });

        it('crinkle creates deterministic wet dropouts and drives the dropout LED', () => {
            const a = createTape({ sampleRate: 1000, bufferSize: 100 });
            const b = createTape({ sampleRate: 1000, bufferSize: 100 });

            [a, b].forEach(dsp => configureTiming(dsp, { crinkle: 1 }));

            let sawDropout = false;
            for (let block = 0; block < 8; block++) {
                a.inputs.audio.fill(4);
                b.inputs.audio.fill(4);
                a.process();
                b.process();

                expect([...a.outputs.out]).toEqual([...b.outputs.out]);
                sawDropout = sawDropout || a.leds.dropout > 0;
            }

            expect(sawDropout).toBe(true);
        });
    });

    describe('CV inputs', () => {
        it('maps time CV as +/-5V to about +/-0.5 normalized time', () => {
            const low = createTape({ sampleRate: 1000, bufferSize: 2800 });
            const high = createTape({ sampleRate: 1000, bufferSize: 2800 });

            configureTiming(low, { time: 0.5 });
            configureTiming(high, { time: 0.5 });
            low.inputs.timeCV.fill(-5);
            high.inputs.timeCV.fill(5);
            low.inputs.audio[0] = 5;
            high.inputs.audio[0] = 5;

            low.process();
            high.process();

            expect(peakIndex(low.outputs.out, 30, 100)).toBeGreaterThanOrEqual(49);
            expect(peakIndex(low.outputs.out, 30, 100)).toBeLessThanOrEqual(51);
            expect(peakIndex(high.outputs.out, 2400, 2600)).toBeGreaterThanOrEqual(2498);
            expect(peakIndex(high.outputs.out, 2400, 2600)).toBeLessThanOrEqual(2502);
        });

        it('maps speed CV with 1V/oct varispeed behavior', () => {
            const base = createTape({ sampleRate: 1000, bufferSize: 900 });
            const up = createTape({ sampleRate: 1000, bufferSize: 900 });
            const down = createTape({ sampleRate: 1000, bufferSize: 900 });

            [base, up, down].forEach(dsp => {
                configureTiming(dsp, { time: 0.5 });
                dsp.inputs.audio[0] = 5;
            });
            up.inputs.speedCV.fill(1);
            down.inputs.speedCV.fill(-1);

            base.process();
            up.process();
            down.process();

            const basePeak = peakIndex(base.outputs.out, 300, 410);
            const upPeak = peakIndex(up.outputs.out, 150, 210);
            const downPeak = peakIndex(down.outputs.out, 650, 760);

            expect(Math.abs(upPeak - basePeak / 2)).toBeLessThanOrEqual(1);
            expect(Math.abs(downPeak - basePeak * 2)).toBeLessThanOrEqual(1);
        });

        it('applies feedback and mix CV while clamping safely', () => {
            const lowMix = createTape({ sampleRate: 1000, bufferSize: 130 });
            const highMix = createTape({ sampleRate: 1000, bufferSize: 130 });
            const highFeedback = createTape({ sampleRate: 1000, bufferSize: 180 });

            [lowMix, highMix, highFeedback].forEach(dsp => configureTiming(dsp, { mix: 0.5, feedback: 0.5 }));
            lowMix.inputs.mixCV.fill(-5);
            highMix.inputs.mixCV.fill(5);
            highFeedback.inputs.feedbackCV.fill(10);

            [lowMix, highMix, highFeedback].forEach(dsp => {
                dsp.inputs.audio[0] = 5;
                dsp.process();
            });

            expect(localPeak(highMix.outputs.out, 50, 2)).toBeGreaterThan(localPeak(lowMix.outputs.out, 50, 2));
            expect(highFeedback.outputs.out.every(Number.isFinite)).toBe(true);
            expect(Math.max(...highFeedback.outputs.out)).toBeLessThanOrEqual(5);
        });
    });

    describe('tap, gate, clock, and freeze', () => {
        it('uses only rising tap edges above 2.5V and ignores bounce intervals', () => {
            const tapped = createTape({ sampleRate: 1000, bufferSize: 500 });
            configureTiming(tapped, { time: 0.5 });
            tapped.inputs.tap[0] = 5;
            tapped.inputs.tap[120] = 5;
            tapped.inputs.audio[0] = 5;
            tapped.process();

            expect(localPeak(tapped.outputs.out, 120, 2)).toBeGreaterThan(3);

            const subThreshold = createTape({ sampleRate: 1000, bufferSize: 500 });
            configureTiming(subThreshold, { time: 0.5 });
            subThreshold.inputs.tap[0] = 2.5;
            subThreshold.inputs.tap[120] = 2.5;
            subThreshold.inputs.audio[0] = 5;
            subThreshold.process();

            expect(localPeak(subThreshold.outputs.out, 120, 2)).toBeLessThan(0.1);
            expect(localPeak(subThreshold.outputs.out, 354, 3)).toBeGreaterThan(2);

            const bounce = createTape({ sampleRate: 1000, bufferSize: 120 });
            configureTiming(bounce, { time: 0.5 });
            bounce.inputs.tap[0] = 5;
            bounce.inputs.tap[5] = 5;
            bounce.inputs.audio[0] = 5;
            bounce.process();

            expect(localPeak(bounce.outputs.out, 50, 2)).toBeLessThan(0.1);
        });

        it('engages freeze from the panel switch or freeze gate', () => {
            const panel = createTape({ sampleRate: 1000, bufferSize: 80 });
            configureTiming(panel, { freeze: 1 });
            panel.process();
            expect(panel.leds.freeze).toBe(1);

            const gate = createTape({ sampleRate: 1000, bufferSize: 80 });
            configureTiming(gate);
            gate.inputs.freezeGate.fill(1);
            gate.process();
            expect(gate.leds.freeze).toBe(1);

            gate.inputs.freezeGate.fill(0);
            gate.process();
            expect(gate.leds.freeze).toBe(0);
        });

        it('prevents new wet writes while frozen but keeps the dry path available', () => {
            const frozen = createTape({ sampleRate: 1000, bufferSize: 80 });
            const live = createTape({ sampleRate: 1000, bufferSize: 80 });

            [frozen, live].forEach(dsp => configureTiming(dsp, { mix: 1 }));
            frozen.inputs.audio[0] = 5;
            live.inputs.audio[0] = 5;
            frozen.process();
            live.process();

            frozen.params.freeze = 1;
            frozen.inputs.audio[0] = 5;
            live.inputs.audio[0] = 5;
            frozen.process();
            live.process();

            expect(localPeak(frozen.outputs.out, 50, 2)).toBeLessThan(0.1);
            expect(localPeak(live.outputs.out, 50, 2)).toBeGreaterThan(3);

            frozen.params.mix = 0;
            frozen.inputs.audio.fill(2);
            frozen.process();
            expect(frozen.outputs.out[0]).toBeCloseTo(2, 5);
        });

        it('emits 10V clock pulses with 5ms width at the current head-4 period', () => {
            const tape = createTape({ sampleRate: 1000, bufferSize: 130 });
            configureTiming(tape, { time: 0 });

            tape.process();

            const highIndices = [];
            for (let i = 0; i < tape.outputs.clock.length; i++) {
                if (tape.outputs.clock[i] > 0) highIndices.push(i);
                expect([0, 10]).toContain(tape.outputs.clock[i]);
            }

            expect(highIndices.slice(0, 5)).toEqual([49, 50, 51, 52, 53]);
            expect(highIndices.slice(5, 10)).toEqual([99, 100, 101, 102, 103]);
        });
    });

    describe('reset and input normalization', () => {
        it('clears buffers, outputs, LEDs, tap history, clock state, and crinkle state', () => {
            const tape = createTape({ sampleRate: 1000, bufferSize: 120 });
            configureTiming(tape, { feedback: 0.8, crinkle: 1 });
            tape.inputs.audio.fill(5);
            tape.inputs.tap[0] = 5;
            tape.inputs.tap[80] = 5;
            tape.process();

            expect(peak(tape.outputs.out)).toBeGreaterThan(0);

            tape.reset();

            expect(tape.outputs.out.every(value => value === 0)).toBe(true);
            expect(tape.outputs.clock.every(value => value === 0)).toBe(true);
            expect(tape.leds).toEqual({ level: 0, freeze: 0, clock: 0, dropout: 0 });

            tape.process();
            expect(tape.outputs.out.every(value => value === 0)).toBe(true);
            expect(tape.outputs.clock.slice(0, 48).every(value => value === 0)).toBe(true);
        });

        it('restores routed input buffers to silent owned buffers after processing', () => {
            const tape = createTape({ sampleRate: 1000, bufferSize: 80 });
            const externalAudio = new Float32Array(80).fill(2);
            const externalCV = new Float32Array(80).fill(5);

            tape.inputs.audio = externalAudio;
            tape.inputs.timeCV = externalCV;
            tape.process();

            expect(tape.inputs.audio).not.toBe(externalAudio);
            expect(tape.inputs.timeCV).not.toBe(externalCV);
            expect(tape.inputs.audio.every(value => value === 0)).toBe(true);
            expect(tape.inputs.timeCV.every(value => value === 0)).toBe(true);
        });
    });
});
