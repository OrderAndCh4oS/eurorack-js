import { describe, expect, it } from 'vitest';
import vocoderModule from '../../src/js/modules/vocoder/index.js';
import { softLimitVoltage } from '../../src/js/utils/voltage.js';

const SAMPLE_RATE = 48000;
const BUFFER_SIZE = 128;

function create(options = {}) {
    return vocoderModule.createDSP({
        sampleRate: SAMPLE_RATE,
        bufferSize: BUFFER_SIZE,
        ...options
    });
}

function rms(samples) {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
}

function fillSine(buffer, frequency, amplitude, phase, sampleRate = SAMPLE_RATE) {
    const increment = 2 * Math.PI * frequency / sampleRate;
    for (let index = 0; index < buffer.length; index++) {
        buffer[index] = Math.sin(phase) * amplitude;
        phase += increment;
        if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
    }
    return phase;
}

function renderPair({
    modFrequency = 820,
    carrierFrequency = 820,
    modAmplitude = 2,
    carrierAmplitude = 2,
    params = {},
    shiftCv = 0,
    mixCv = 0,
    sampleRate = SAMPLE_RATE,
    bufferSize = BUFFER_SIZE,
    blocks = 150,
    captureBlocks = 12
} = {}) {
    const dsp = create({ sampleRate, bufferSize });
    Object.assign(dsp.params, { sibilance: 0, ...params });
    dsp.inputs.shiftCv.fill(shiftCv);
    dsp.inputs.mixCv.fill(mixCv);
    let modPhase = 0;
    let carrierPhase = 0;
    const captured = [];

    for (let block = 0; block < blocks; block++) {
        if (modFrequency === null) dsp.inputs.modulator.fill(0);
        else modPhase = fillSine(
            dsp.inputs.modulator,
            modFrequency,
            modAmplitude,
            modPhase,
            sampleRate
        );
        if (carrierFrequency === null) dsp.inputs.carrier.fill(0);
        else carrierPhase = fillSine(
            dsp.inputs.carrier,
            carrierFrequency,
            carrierAmplitude,
            carrierPhase,
            sampleRate
        );
        dsp.process();
        if (block >= blocks - captureBlocks) captured.push(...dsp.outputs.out);
    }

    return { dsp, samples: captured, rms: rms(captured), modPhase, carrierPhase };
}

function expectValid(dsp) {
    expect(dsp.outputs.out.every(Number.isFinite)).toBe(true);
    expect(dsp.outputs.out.every(sample => sample >= -5 && sample <= 5)).toBe(true);
    for (const led of Object.values(dsp.leds)) {
        expect(Number.isFinite(led)).toBe(true);
        expect(led).toBeGreaterThanOrEqual(0);
        expect(led).toBeLessThanOrEqual(1);
    }
}

function estimateFrequency(samples, sampleRate = SAMPLE_RATE) {
    let crossings = 0;
    for (let index = 1; index < samples.length; index++) {
        if (samples[index - 1] < 0 && samples[index] >= 0) crossings++;
    }
    return crossings * sampleRate / samples.length;
}

describe('Vocoder', () => {
    it('declares the exact metadata and declarative panel contract', () => {
        expect(vocoderModule).toMatchObject({
            id: 'vocoder',
            name: 'VOCODER',
            hp: 10,
            color: 'module-color-eight',
            category: 'effect'
        });
        expect(vocoderModule.ui.knobs).toEqual([
            { id: 'analysisGain', label: 'Analysis', param: 'analysisGain', min: 0, max: 2, default: 1, step: 0.01 },
            { id: 'carrierGain', label: 'Carrier', param: 'carrierGain', min: 0, max: 2, default: 1, step: 0.01 },
            { id: 'attackMs', label: 'Attack', param: 'attackMs', min: 1, max: 50, default: 5, step: 1 },
            { id: 'releaseMs', label: 'Release', param: 'releaseMs', min: 20, max: 500, default: 120, step: 1 },
            { id: 'shift', label: 'Shift', param: 'shift', min: -1, max: 1, default: 0, step: 0.01 },
            { id: 'sibilance', label: 'Sibilance', param: 'sibilance', min: 0, max: 1, default: 0.25, step: 0.01 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 1, step: 0.01 }
        ]);
        expect(vocoderModule.ui.inputs).toEqual([
            { id: 'modulator', label: 'Mod', port: 'modulator', signal: 'audio', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'carrier', label: 'Car', port: 'carrier', signal: 'audio', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'shiftCv', label: 'Shift', port: 'shiftCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'mixCv', label: 'Mix', port: 'mixCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ]);
        expect(vocoderModule.ui.outputs).toEqual([
            { id: 'out', label: 'Out', port: 'out', signal: 'audio', voltage: { min: -5, max: 5 } }
        ]);
        expect(vocoderModule.ui.leds).toEqual(['analysis', 'carrier', 'output']);
        for (const key of ['switches', 'buttons', 'actions', 'state']) {
            expect(vocoderModule.ui[key]).toBeUndefined();
        }
        for (const key of ['render', 'telemetry', 'captureRuntimeState', 'restoreRuntimeState']) {
            expect(vocoderModule[key]).toBeUndefined();
        }
    });

    it('initializes exact defaults and separate stable zero-normal buffers', () => {
        const dsp = create({ bufferSize: 37 });
        expect(dsp.params).toEqual({
            analysisGain: 1,
            carrierGain: 1,
            attackMs: 5,
            releaseMs: 120,
            shift: 0,
            sibilance: 0.25,
            mix: 1
        });
        expect(dsp.inputs).toEqual({
            modulator: expect.any(Float32Array),
            carrier: expect.any(Float32Array),
            shiftCv: expect.any(Float32Array),
            mixCv: expect.any(Float32Array)
        });
        expect(dsp.outputs).toEqual({ out: expect.any(Float32Array) });
        const buffers = [...Object.values(dsp.inputs), dsp.outputs.out];
        expect(new Set(buffers).size).toBe(buffers.length);
        for (const buffer of buffers) {
            expect(buffer).toHaveLength(37);
            expect(buffer.every(sample => sample === 0)).toBe(true);
        }
        expect(dsp.leds).toEqual({ analysis: 0, carrier: 0, output: 0 });
    });

    it('keeps disconnected and silent inputs silent', () => {
        const dsp = create();
        for (let block = 0; block < 20; block++) dsp.process();
        expect(dsp.outputs.out.every(sample => sample === 0)).toBe(true);
        expect(dsp.leds).toEqual({ analysis: 0, carrier: 0, output: 0 });
    });

    it('hydrates Mix on the first block and returns the bounded dry modulator', () => {
        const dsp = create();
        dsp.params.mix = 0;
        dsp.params.analysisGain = 0;
        dsp.inputs.modulator.fill(1.25);
        dsp.inputs.carrier.fill(5);
        dsp.process();
        expect(dsp.outputs.out.every(sample => Math.abs(sample - 1.25) < 1e-6)).toBe(true);
        expect(dsp.outputs.out[0]).toBeCloseTo(1.25, 6);
    });

    it('uses matching bands so on-band carriers dominate off-band carriers', () => {
        const onBand = renderPair({ modFrequency: 820, carrierFrequency: 820 }).rms;
        const offBand = renderPair({ modFrequency: 820, carrierFrequency: 4000 }).rms;
        expect(onBand).toBeGreaterThan(offBand * 2);
    });

    it('covers low-pass, representative band-pass, and high-pass bands', () => {
        const probes = [
            { center: 80, off: 500 },
            { center: 170, off: 300 },
            { center: 820, off: 1450 },
            { center: 1810, off: 3200 },
            { center: 5950, off: 3300 },
            { center: 10000, off: 2500 }
        ];
        for (const { center, off } of probes) {
            const onBand = renderPair({ modFrequency: center, carrierFrequency: center }).rms;
            const offBand = renderPair({ modFrequency: center, carrierFrequency: off }).rms;
            expect(onBand, `${center} Hz band`).toBeGreaterThan(offBand * 1.05);
        }
    });

    it('retains carrier pitch rather than modulator pitch', () => {
        const rendered = renderPair({
            modFrequency: 820,
            carrierFrequency: 900,
            blocks: 180,
            captureBlocks: 30
        });
        expect(estimateFrequency(rendered.samples)).toBeCloseTo(900, -1);
        expect(Math.abs(estimateFrequency(rendered.samples) - 820)).toBeGreaterThan(40);
    });

    it('requires carrier energy for the filter-bank wet path', () => {
        const modOnly = renderPair({ carrierFrequency: null, params: { sibilance: 0, mix: 1 } });
        expect(modOnly.rms).toBeLessThan(1e-8);

        const dsp = create();
        dsp.params.sibilance = 0;
        let modPhase = 0;
        let carrierPhase = 0;
        for (let block = 0; block < 150; block++) {
            modPhase = fillSine(dsp.inputs.modulator, 820, 2, modPhase);
            carrierPhase = fillSine(dsp.inputs.carrier, 820, 2, carrierPhase);
            dsp.process();
        }
        const active = rms(dsp.outputs.out);
        for (let block = 0; block < 180; block++) {
            dsp.inputs.modulator.fill(0);
            carrierPhase = fillSine(dsp.inputs.carrier, 820, 2, carrierPhase);
            dsp.process();
        }
        expect(rms(dsp.outputs.out)).toBeLessThan(active * 0.02);
    });

    it('applies Analysis and Carrier gains independently', () => {
        const quiet = { modAmplitude: 0.25, carrierAmplitude: 0.25 };
        const normal = renderPair({ ...quiet, params: { analysisGain: 1, carrierGain: 1 } }).rms;
        const boostedAnalysis = renderPair({ ...quiet, params: { analysisGain: 2, carrierGain: 1 } }).rms;
        const boostedCarrier = renderPair({ ...quiet, params: { analysisGain: 1, carrierGain: 2 } }).rms;
        const noAnalysis = renderPair({ ...quiet, params: { analysisGain: 0, carrierGain: 1 } }).rms;
        const noCarrier = renderPair({ ...quiet, params: { analysisGain: 1, carrierGain: 0 } }).rms;
        expect(boostedAnalysis).toBeGreaterThan(normal * 1.7);
        expect(boostedCarrier).toBeGreaterThan(normal * 1.7);
        expect(noAnalysis).toBeLessThan(1e-8);
        expect(noCarrier).toBeLessThan(1e-8);
    });

    it('implements faster 99%-time attack and release settings', () => {
        const attackResponse = attackMs => {
            const dsp = create();
            Object.assign(dsp.params, { attackMs, sibilance: 0, mix: 1 });
            let carrierPhase = 0;
            let modPhase = 0;
            for (let block = 0; block < 50; block++) {
                dsp.inputs.modulator.fill(0);
                carrierPhase = fillSine(dsp.inputs.carrier, 820, 2, carrierPhase);
                dsp.process();
            }
            for (let block = 0; block < 4; block++) {
                modPhase = fillSine(dsp.inputs.modulator, 820, 2, modPhase);
                carrierPhase = fillSine(dsp.inputs.carrier, 820, 2, carrierPhase);
                dsp.process();
            }
            return rms(dsp.outputs.out);
        };
        expect(attackResponse(1)).toBeGreaterThan(attackResponse(50) * 1.25);

        const releaseResponse = releaseMs => {
            const dsp = create();
            Object.assign(dsp.params, { releaseMs, sibilance: 0, mix: 1 });
            let carrierPhase = 0;
            let modPhase = 0;
            for (let block = 0; block < 150; block++) {
                modPhase = fillSine(dsp.inputs.modulator, 820, 2, modPhase);
                carrierPhase = fillSine(dsp.inputs.carrier, 820, 2, carrierPhase);
                dsp.process();
            }
            for (let block = 0; block < 12; block++) {
                dsp.inputs.modulator.fill(0);
                carrierPhase = fillSine(dsp.inputs.carrier, 820, 2, carrierPhase);
                dsp.process();
            }
            return rms(dsp.outputs.out);
        };
        expect(releaseResponse(500)).toBeGreaterThan(releaseResponse(20) * 2);
    });

    it('keeps physical-time response comparable across sample rates and blocks', () => {
        const renders = [
            renderPair({ sampleRate: 44100, bufferSize: 128, blocks: 140, captureBlocks: 10 }).rms,
            renderPair({ sampleRate: 48000, bufferSize: 512, blocks: 38, captureBlocks: 3 }).rms,
            renderPair({ sampleRate: 96000, bufferSize: 128, blocks: 280, captureBlocks: 20 }).rms
        ];
        const minimum = Math.min(...renders);
        const maximum = Math.max(...renders);
        expect(minimum).toBeGreaterThan(0);
        expect(maximum / minimum).toBeLessThan(1.2);
    });

    it('uses the documented Shift polarity and full four-band range', () => {
        const upUnshifted = renderPair({ modFrequency: 170, carrierFrequency: 820, params: { shift: 0 } }).rms;
        const shiftedUp = renderPair({ modFrequency: 170, carrierFrequency: 820, params: { shift: 1 } }).rms;
        expect(shiftedUp).toBeGreaterThan(upUnshifted * 2);

        const downUnshifted = renderPair({ modFrequency: 820, carrierFrequency: 170, params: { shift: 0 } }).rms;
        const shiftedDown = renderPair({ modFrequency: 820, carrierFrequency: 170, params: { shift: -1 } }).rms;
        expect(shiftedDown).toBeGreaterThan(downUnshifted * 2);
    });

    it('maps Shift CV additively, clamps over-range values, and interpolates continuously', () => {
        const renderBlock = ({ shift = 0, cv = 0 }) => {
            const dsp = create();
            dsp.params.shift = shift;
            dsp.params.sibilance = 0;
            dsp.inputs.shiftCv.fill(cv);
            fillSine(dsp.inputs.modulator, 170, 1, 0);
            fillSine(dsp.inputs.carrier, 820, 1, 0);
            dsp.process();
            return Array.from(dsp.outputs.out);
        };
        expect(renderBlock({ shift: 1 })).toEqual(renderBlock({ cv: 5 }));
        expect(renderBlock({ cv: 5 })).toEqual(renderBlock({ cv: 10 }));
        expect(renderBlock({ shift: -1 })).toEqual(renderBlock({ cv: -5 }));
        expect(renderBlock({ cv: -5 })).toEqual(renderBlock({ cv: -10 }));

        const low = renderPair({ modFrequency: 170, carrierFrequency: 820, params: { shift: 0.75 }, modAmplitude: 0.5, carrierAmplitude: 0.5 }).rms;
        const middle = renderPair({ modFrequency: 170, carrierFrequency: 820, params: { shift: 0.875 }, modAmplitude: 0.5, carrierAmplitude: 0.5 }).rms;
        const high = renderPair({ modFrequency: 170, carrierFrequency: 820, params: { shift: 1 }, modAmplitude: 0.5, carrierAmplitude: 0.5 }).rms;
        expect(middle).toBeGreaterThan(Math.min(low, high));
        expect(middle).toBeLessThan(Math.max(low, high));
        expect(middle).toBeCloseTo((low + high) / 2, 2);
    });

    it('adds only high-frequency direct sibilance when the carrier is absent', () => {
        const high = renderPair({
            modFrequency: 8000,
            carrierFrequency: null,
            params: { sibilance: 1, mix: 1 }
        });
        const low = renderPair({
            modFrequency: 500,
            carrierFrequency: null,
            params: { sibilance: 1, mix: 1 }
        });
        const off = renderPair({
            modFrequency: 8000,
            carrierFrequency: null,
            params: { sibilance: 0, mix: 1 }
        });
        const noAnalysis = renderPair({
            modFrequency: 8000,
            carrierFrequency: null,
            params: { analysisGain: 0, sibilance: 1, mix: 1 }
        });
        const noCarrierGain = renderPair({
            modFrequency: 8000,
            carrierFrequency: null,
            params: { carrierGain: 0, sibilance: 1, mix: 1 }
        });
        expect(high.rms).toBeGreaterThan(low.rms * 5);
        expect(off.rms).toBeLessThan(1e-8);
        expect(noAnalysis.rms).toBeLessThan(1e-8);
        expect(noCarrierGain.rms).toBeGreaterThan(high.rms * 0.99);
        expectValid(high.dsp);
    });

    it('blends dry and wet coherently and maps Mix CV additively', () => {
        const options = {
            modFrequency: 820,
            carrierFrequency: 820,
            modAmplitude: 0.3,
            carrierAmplitude: 0.3,
            blocks: 120,
            captureBlocks: 1
        };
        const dry = renderPair({ ...options, params: { mix: 0 } }).samples;
        const half = renderPair({ ...options, params: { mix: 0.5 } }).samples;
        const wet = renderPair({ ...options, params: { mix: 1 } }).samples;
        for (let index = 0; index < half.length; index++) {
            expect(half[index]).toBeCloseTo((dry[index] + wet[index]) / 2, 5);
        }

        const wetCv = renderPair({ ...options, params: { mix: 0.5 }, mixCv: 5 }).samples;
        const dryCv = renderPair({ ...options, params: { mix: 0.5 }, mixCv: -5 }).samples;
        expect(wetCv).toEqual(wet);
        expect(dryCv).toEqual(dry);
    });

    it('slews live Mix changes instead of introducing a raw discontinuity', () => {
        const dsp = create();
        dsp.params.mix = 0;
        dsp.params.sibilance = 0;
        dsp.inputs.modulator.fill(1);
        dsp.process();
        const before = dsp.outputs.out[BUFFER_SIZE - 1];
        dsp.params.mix = 1;
        dsp.process();
        expect(dsp.outputs.out[0]).toBeGreaterThan(before * 0.95);
        expect(dsp.outputs.out[0]).toBeLessThan(before);
        for (let block = 0; block < 20; block++) dsp.process();
        expect(Math.abs(dsp.outputs.out[BUFFER_SIZE - 1])).toBeLessThan(0.01);
    });

    it('maps block peaks to LEDs and applies the exact 100 ms decay', () => {
        const dsp = create();
        dsp.params.mix = 0;
        dsp.params.analysisGain = 2;
        dsp.params.carrierGain = 0;
        dsp.inputs.modulator.fill(2.5);
        dsp.inputs.carrier.fill(3);
        dsp.process();
        expect(dsp.leds.analysis).toBeCloseTo(softLimitVoltage(5, 5) / 5, 6);
        expect(dsp.leds.carrier).toBe(0);
        expect(dsp.leds.output).toBeCloseTo(0.5, 6);

        const previous = { ...dsp.leds };
        dsp.inputs.modulator.fill(0);
        dsp.inputs.carrier.fill(0);
        dsp.process();
        const decay = Math.exp(-BUFFER_SIZE / (0.1 * SAMPLE_RATE));
        expect(dsp.leds.analysis).toBeCloseTo(previous.analysis * decay, 7);
        expect(dsp.leds.carrier).toBeCloseTo(previous.carrier * decay, 7);
        expect(dsp.leds.output).toBeCloseTo(previous.output * decay, 7);
    });

    it('meters live Analysis and Carrier gain slews instead of raw or target input levels', () => {
        const dsp = create();
        dsp.params.analysisGain = 0;
        dsp.params.carrierGain = 0;
        dsp.inputs.modulator.fill(1);
        dsp.inputs.carrier.fill(1);
        dsp.process();
        expect(dsp.leds.analysis).toBe(0);
        expect(dsp.leds.carrier).toBe(0);

        dsp.params.analysisGain = 2;
        dsp.params.carrierGain = 2;
        dsp.process();
        const finalSmoothedGain = 2 * (1 - Math.exp(-BUFFER_SIZE / (0.005 * SAMPLE_RATE)));
        const expected = softLimitVoltage(finalSmoothedGain, 5) / 5;
        expect(dsp.leds.analysis).toBeCloseTo(expected, 6);
        expect(dsp.leds.carrier).toBeCloseTo(expected, 6);
    });

    it('sanitizes params, CV, and malformed audio while preserving rails', () => {
        const dsp = create();
        Object.assign(dsp.params, {
            analysisGain: Number.NaN,
            carrierGain: Number.POSITIVE_INFINITY,
            attackMs: Number.NEGATIVE_INFINITY,
            releaseMs: Number.NaN,
            shift: Number.POSITIVE_INFINITY,
            sibilance: Number.NaN,
            mix: Number.NEGATIVE_INFINITY
        });
        for (let index = 0; index < BUFFER_SIZE; index++) {
            dsp.inputs.modulator[index] = index % 3 === 0 ? Number.NaN : index % 2 === 0 ? 100 : -100;
            dsp.inputs.carrier[index] = index % 3 === 0 ? Number.POSITIVE_INFINITY : index % 2 === 0 ? -100 : 100;
            dsp.inputs.shiftCv[index] = index % 2 === 0 ? Number.NaN : 100;
            dsp.inputs.mixCv[index] = index % 2 === 0 ? Number.NEGATIVE_INFINITY : -100;
        }
        for (let block = 0; block < 100; block++) dsp.process();
        expectValid(dsp);

        Object.assign(dsp.params, {
            analysisGain: -10,
            carrierGain: 10,
            attackMs: -10,
            releaseMs: 10000,
            shift: 10,
            sibilance: 10,
            mix: 10
        });
        dsp.process();
        expectValid(dsp);
    });

    it('remains finite and buffer-stable across the strict audit matrix', () => {
        for (const sampleRate of [44100, 48000, 96000]) {
            for (const bufferSize of [128, 512]) {
                const dsp = create({ sampleRate, bufferSize });
                const inputRefs = Object.fromEntries(Object.entries(dsp.inputs));
                const outputRef = dsp.outputs.out;
                for (let block = 0; block < 80; block++) {
                    for (let index = 0; index < bufferSize; index++) {
                        const cursor = block * bufferSize + index;
                        dsp.inputs.modulator[index] = ((cursor * 1103515245 + 12345) & 1023) / 102.3 - 5;
                        dsp.inputs.carrier[index] = Math.sin(2 * Math.PI * 5950 * cursor / sampleRate) * 5;
                        dsp.inputs.shiftCv[index] = block % 2 === 0 ? -5 : 5;
                        dsp.inputs.mixCv[index] = block % 3 === 0 ? -5 : 5;
                    }
                    dsp.params.attackMs = block % 2 === 0 ? 1 : 50;
                    dsp.params.releaseMs = block % 2 === 0 ? 20 : 500;
                    dsp.process();
                    expectValid(dsp);
                    expect(dsp.outputs.out).toBe(outputRef);
                    for (const [port, ref] of Object.entries(inputRefs)) expect(dsp.inputs[port]).toBe(ref);
                }
            }
        }
    });

    it('resets every observable state in place and rehydrates preserved params and CV', () => {
        const dsp = create();
        const inputRefs = Object.fromEntries(Object.entries(dsp.inputs));
        const outputRef = dsp.outputs.out;
        Object.assign(dsp.params, {
            analysisGain: 1.7,
            carrierGain: 1.4,
            attackMs: 12,
            releaseMs: 230,
            shift: 0.25,
            sibilance: 0.6,
            mix: 0.7
        });
        for (const input of Object.values(dsp.inputs)) input.fill(2);
        for (let block = 0; block < 100; block++) dsp.process();
        const params = { ...dsp.params };

        dsp.reset();
        expect(dsp.params).toEqual(params);
        for (const [port, ref] of Object.entries(inputRefs)) {
            expect(dsp.inputs[port]).toBe(ref);
            expect(ref.every(sample => sample === 0)).toBe(true);
        }
        expect(dsp.outputs.out).toBe(outputRef);
        expect(outputRef.every(sample => sample === 0)).toBe(true);
        expect(dsp.leds).toEqual({ analysis: 0, carrier: 0, output: 0 });

        const fresh = create();
        Object.assign(fresh.params, params);
        for (const instance of [dsp, fresh]) {
            instance.inputs.modulator.fill(1.5);
            instance.inputs.carrier.fill(-1.25);
            instance.inputs.shiftCv.fill(-2);
            instance.inputs.mixCv.fill(1);
            instance.process();
        }
        expect(Array.from(dsp.outputs.out)).toEqual(Array.from(fresh.outputs.out));
        expect(dsp.leds).toEqual(fresh.leds);
    });
});
