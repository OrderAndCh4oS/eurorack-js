import { describe, expect, it, vi } from 'vitest';
import shimmerModule, {
    SHIMMER_INTERVAL_RATIOS,
    applyNormalizedHadamard8
} from '../../src/js/modules/shimmer/index.js';
import { softLimitVoltage } from '../../src/js/utils/voltage.js';

const DEFAULTS = {
    decay: 0.55,
    size: 0.5,
    diffusion: 0.75,
    preDelay: 0.15,
    damp: 0.35,
    modDepth: 0.25,
    interval: 12,
    shimmer: 0.35,
    mix: 0.35,
    route: 1,
    freeze: 0,
    clear: 0
};

function fillInputs(dsp, values = {}) {
    Object.entries(dsp.inputs).forEach(([name, buffer]) => {
        const value = values[name] ?? 0;
        if (typeof value === 'function') {
            for (let i = 0; i < buffer.length; i++) buffer[i] = value(i);
        } else {
            buffer.fill(value);
        }
    });
}

function processBlock(dsp, values = {}) {
    fillInputs(dsp, values);
    dsp.process();
}

function processSilence(dsp, blocks) {
    for (let block = 0; block < blocks; block++) processBlock(dsp);
}

function renderImpulse({ route, shimmer = 1, seconds = 1.5, sampleRate = 12000, params = {} } = {}) {
    const bufferSize = 128;
    const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
    Object.assign(dsp.params, {
        mix: 1,
        route,
        shimmer,
        interval: 12,
        preDelay: 0,
        diffusion: 0.75,
        damp: 0.25,
        decay: 0.75,
        modDepth: 0,
        ...params
    });
    dsp.reset();
    const output = new Float32Array(Math.ceil(seconds * sampleRate));
    let write = 0;
    let first = true;
    while (write < output.length) {
        processBlock(dsp, { inL: i => first && i === 0 ? 3 : 0 });
        first = false;
        const count = Math.min(bufferSize, output.length - write);
        output.set(dsp.outputs.outL.subarray(0, count), write);
        write += count;
    }
    return output;
}

function energy(buffer, start = 0, end = buffer.length) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += buffer[i] * buffer[i];
    return sum;
}

function renderStream({ sampleRate = 12000, bufferSize, samples = 6000, params = {} }) {
    const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
    Object.assign(dsp.params, { mix: 1, preDelay: 0, modDepth: 0, ...params });
    dsp.reset();
    const output = new Float32Array(samples);
    let absolute = 0;
    while (absolute < samples) {
        processBlock(dsp, {
            inL: index => {
                const sample = absolute + index;
                return sample < samples ? Math.sin(sample * 0.071) * (sample < 1000 ? 2 : 0) : 0;
            }
        });
        const count = Math.min(bufferSize, samples - absolute);
        output.set(dsp.outputs.outL.subarray(0, count), absolute);
        absolute += count;
    }
    return output;
}

function estimateFrequency(buffer, sampleRate, start) {
    let crossings = 0;
    for (let i = start + 1; i < buffer.length; i++) {
        if (buffer[i - 1] <= 0 && buffer[i] > 0) crossings++;
    }
    return crossings * sampleRate / (buffer.length - start);
}

function rms(buffer, start = 0) {
    return Math.sqrt(energy(buffer, start) / Math.max(1, buffer.length - start));
}

function dampingCutoffAtHalf(sampleRate) {
    return Math.min(Math.sqrt(18000 * 500), sampleRate * 0.45);
}

function singleBinMagnitude(buffer, sampleRate, frequency, startSeconds, durationSeconds = 0.05) {
    const start = Math.round(startSeconds * sampleRate);
    const end = Math.min(buffer.length, start + Math.round(durationSeconds * sampleRate));
    let real = 0;
    let imaginary = 0;
    for (let i = start; i < end; i++) {
        const phase = 2 * Math.PI * frequency * i / sampleRate;
        real += buffer[i] * Math.cos(phase);
        imaginary -= buffer[i] * Math.sin(phase);
    }
    return Math.hypot(real, imaginary) / Math.max(1, end - start);
}

describe('shimmer', () => {
    it('declares the exact metadata, controls, ports, LEDs, and defaults', () => {
        expect(shimmerModule).toMatchObject({
            id: 'shimmer',
            name: 'SHIMMER',
            hp: 16,
            color: 'module-color-eight',
            category: 'effect'
        });
        expect(shimmerModule.render).toBeUndefined();
        expect(shimmerModule.telemetry).toBeUndefined();
        expect(shimmerModule.ui.knobs).toEqual([
            { id: 'decay', label: 'DECAY', param: 'decay', min: 0, max: 1, default: 0.55 },
            { id: 'size', label: 'SIZE', param: 'size', min: 0, max: 1, default: 0.5 },
            { id: 'diffusion', label: 'DIFF', param: 'diffusion', min: 0, max: 1, default: 0.75 },
            { id: 'preDelay', label: 'PRE', param: 'preDelay', min: 0, max: 1, default: 0.15 },
            { id: 'damp', label: 'DAMP', param: 'damp', min: 0, max: 1, default: 0.35 },
            { id: 'modDepth', label: 'MOD', param: 'modDepth', min: 0, max: 1, default: 0.25 },
            { id: 'interval', label: 'INT', param: 'interval', min: -12, max: 12, step: 1, default: 12 },
            { id: 'shimmer', label: 'SHIM', param: 'shimmer', min: 0, max: 1, default: 0.35 },
            { id: 'mix', label: 'MIX', param: 'mix', min: 0, max: 1, default: 0.35 }
        ]);
        expect(shimmerModule.ui.switches).toEqual([
            {
                id: 'route',
                label: 'INPUT / REGEN',
                param: 'route',
                positions: ['INPUT', 'REGEN'],
                default: 1
            }
        ]);
        expect(shimmerModule.ui.actions).toEqual([
            { id: 'freeze', label: 'FREEZE', param: 'freeze', mode: 'toggle', default: 0 },
            { id: 'clear', label: 'CLEAR', param: 'clear', mode: 'trigger', default: 0 }
        ]);
        expect(shimmerModule.ui.inputs.map(input => input.port)).toEqual([
            'inL', 'inR', 'decayCV', 'dampCV', 'shimmerCV', 'intervalCV', 'mixCV',
            'freezeGate', 'clearTrig'
        ]);
        expect(shimmerModule.ui.outputs.map(output => output.port)).toEqual(['outL', 'outR']);
        expect(shimmerModule.ui.leds).toEqual(['input', 'tail', 'pitched', 'frozen']);

        const dsp = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 128 });
        expect(dsp.params).toEqual(DEFAULTS);
    });

    it('allocates stable normalized port buffers and stays below the fixed 96 kHz memory cap', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 96000, bufferSize: 512 });
        const inputs = { ...dsp.inputs };
        const outputs = { ...dsp.outputs };
        Object.values(inputs).forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(512);
            expect(buffer.every(value => value === 0)).toBe(true);
        });
        Object.values(outputs).forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(512);
        });
        expect(dsp.getDebugState().allocatedDelayBytes).toBeLessThan(1024 * 1024);

        processBlock(dsp, { inL: 1, inR: -1 });
        Object.entries(inputs).forEach(([name, buffer]) => expect(dsp.inputs[name]).toBe(buffer));
        Object.entries(outputs).forEach(([name, buffer]) => expect(dsp.outputs[name]).toBe(buffer));
    });

    it('uses an energy-preserving normalized H8 transform', () => {
        const vector = Float64Array.from([1, -2, 3, -4, 5, -6, 7, -8]);
        const before = energy(vector);
        applyNormalizedHadamard8(vector);
        expect(energy(vector)).toBeCloseTo(before, 11);
        applyNormalizedHadamard8(vector);
        expect(Array.from(vector)).toEqual(expect.arrayContaining([
            expect.closeTo(1, 10), expect.closeTo(-2, 10), expect.closeTo(3, 10),
            expect.closeTo(-4, 10), expect.closeTo(5, 10), expect.closeTo(-6, 10),
            expect.closeTo(7, 10), expect.closeTo(-8, 10)
        ]));
    });

    it('provides the exact fixed semitone ratios without runtime exponentiation', () => {
        expect(SHIMMER_INTERVAL_RATIOS).toHaveLength(25);
        expect(SHIMMER_INTERVAL_RATIOS[0]).toBeCloseTo(0.5, 12);
        expect(SHIMMER_INTERVAL_RATIOS[12]).toBe(1);
        expect(SHIMMER_INTERVAL_RATIOS[19]).toBeCloseTo(2 ** (7 / 12), 12);
        expect(SHIMMER_INTERVAL_RATIOS[24]).toBeCloseTo(2, 12);
    });

    it('performs no trigonometric calls in the audio-rate process path', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 64 });
        dsp.reset();
        const sin = vi.spyOn(Math, 'sin');
        const cos = vi.spyOn(Math, 'cos');

        try {
            processBlock(dsp, {
                inL: index => index === 0 ? 3 : 0,
                dampCV: index => index / 64 * 10 - 5,
                mixCV: index => index / 64 * 10 - 5
            });

            expect(sin).not.toHaveBeenCalled();
            expect(cos).not.toHaveBeenCalled();
        } finally {
            sin.mockRestore();
            cos.mockRestore();
        }
    });

    it('maps Size, Pre-delay, Decay, and Damp to their exact endpoint contracts', () => {
        const low = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 64 });
        Object.assign(low.params, {
            size: 0,
            diffusion: 0,
            preDelay: 0,
            decay: 0,
            damp: 0,
            modDepth: 0
        });
        low.reset();
        processBlock(low);
        const lowState = low.getDebugState();
        expect(lowState.sizeScale).toBeCloseTo(Math.SQRT1_2, 12);
        expect(lowState.preDelaySamples).toBe(0);
        expect(lowState.diffusion).toBe(0);
        expect(lowState.modDepth).toBe(0);
        expect(lowState.activeDelaySamples[0]).toBeCloseTo(29.7 * 48 * Math.SQRT1_2, 6);
        expect(lowState.maxFeedbackGain).toBeLessThan(1);

        const high = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 64 });
        Object.assign(high.params, {
            size: 1,
            diffusion: 1,
            preDelay: 1,
            decay: 1,
            damp: 1,
            modDepth: 0
        });
        high.reset();
        processBlock(high);
        const highState = high.getDebugState();
        expect(highState.sizeScale).toBeCloseTo(Math.SQRT2, 12);
        expect(highState.preDelaySamples).toBe(24000);
        expect(highState.diffusion).toBe(1);
        expect(highState.modDepth).toBe(0);
        expect(highState.activeDelaySamples[0]).toBeCloseTo(29.7 * 48 * Math.SQRT2, 6);
        expect(highState.dampCutoff).toBeCloseTo(500, 6);
        expect(highState.maxFeedbackGain).toBeGreaterThan(lowState.maxFeedbackGain);
        expect(highState.maxFeedbackGain).toBeLessThan(1);

        const modulated = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 64 });
        modulated.params.modDepth = 1;
        modulated.reset();
        processBlock(modulated);
        const modulatedState = modulated.getDebugState();
        expect(modulatedState.modDepth).toBe(1);
        expect(modulatedState.activeDelaySamples[1]).not.toBeCloseTo(33.1 * 48, 4);
    });

    it('samples bipolar CV per sample, rounds Interval CV, and clamps every target', () => {
        const sampleRate = 12000;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize: 120 });
        Object.assign(dsp.params, { interval: 0, decay: 0.5, damp: 0.5, shimmer: 0.5, mix: 0.5 });
        dsp.reset();

        processSilence(dsp, 6);
        processBlock(dsp, { intervalCV: 0.2 });
        expect(dsp.getDebugState().intervalSemitones).toBe(0);
        processBlock(dsp, { intervalCV: 0.21 });
        expect(dsp.getDebugState().intervalSemitones).toBe(1);
        processBlock(dsp, { intervalCV: 5, decayCV: 5, dampCV: 5, shimmerCV: 5, mixCV: 5 });
        const positive = dsp.getDebugState();
        expect(positive.intervalSemitones).toBe(12);
        expect(positive.decay).toBeGreaterThan(0.5);
        expect(positive.dampCutoff).toBeLessThan(dampingCutoffAtHalf(sampleRate));
        expect(positive.shimmer).toBeGreaterThan(0.5);
        expect(positive.mix).toBeGreaterThan(0.5);
        processBlock(dsp, { intervalCV: -5, decayCV: -5, dampCV: -5, shimmerCV: -5, mixCV: -5 });
        const negative = dsp.getDebugState();
        expect(negative.intervalSemitones).toBe(-12);
        expect(negative.decay).toBeLessThan(0.5);
        expect(negative.dampCutoff).toBeGreaterThan(dampingCutoffAtHalf(sampleRate));
        expect(negative.shimmer).toBeLessThan(0.5);
        expect(negative.mix).toBeLessThan(0.5);
        expect(Object.values(dsp.leds).every(Number.isFinite)).toBe(true);
    });

    it('makes Diffusion and Mod depth audibly change the late impulse response', () => {
        const diffuseOff = renderImpulse({ route: 0, shimmer: 0, params: { diffusion: 0 } });
        const diffuseOn = renderImpulse({ route: 0, shimmer: 0, params: { diffusion: 1 } });
        const modOff = renderImpulse({ route: 0, shimmer: 0, params: { modDepth: 0 } });
        const modOn = renderImpulse({ route: 0, shimmer: 0, params: { modDepth: 1 } });
        const lateStart = Math.floor(diffuseOff.length * 0.25);

        expect(energy(diffuseOff, lateStart)).toBeGreaterThan(0);
        expect(energy(diffuseOn, lateStart)).toBeGreaterThan(0);
        expect(diffuseOn).not.toEqual(diffuseOff);
        expect(modOn).not.toEqual(modOff);
    });

    it.each([
        [-12, 110],
        [7, 220 * (2 ** (7 / 12))],
        [12, 440]
    ])('moves a steady pitch by %i semitones through the overlapping heads', (semitones, expectedHz) => {
        const sampleRate = 12000;
        const samples = sampleRate * 2;
        const output = new Float32Array(samples);
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize: 64 });
        dsp.params.damp = 0;
        for (let i = 0; i < samples; i++) {
            output[i] = dsp.processPitchProbe(Math.sin(2 * Math.PI * 220 * i / sampleRate), semitones);
        }
        expect(Math.abs(estimateFrequency(output, sampleRate, sampleRate / 2) - expectedHz)).toBeLessThan(5);
        expect(output.every(Number.isFinite)).toBe(true);
    });

    it('bypasses Interval zero and attenuates the upward-shift stopband before the heads', () => {
        const sampleRate = 12000;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize: 64 });
        const direct = [];
        for (let i = 0; i < 100; i++) {
            const input = Math.sin(2 * Math.PI * 220 * i / sampleRate);
            direct.push(dsp.processPitchProbe(input, 0) - input);
        }
        expect(direct.every(value => Math.abs(value) < 1e-12)).toBe(true);

        dsp.reset();
        dsp.params.damp = 0;
        const filtered = new Float32Array(sampleRate);
        const raw = new Float32Array(sampleRate);
        for (let i = 0; i < raw.length; i++) {
            raw[i] = Math.sin(2 * Math.PI * sampleRate * 0.4 * i / sampleRate);
            dsp.processPitchProbe(raw[i], 12);
            filtered[i] = dsp.getPitchFilterSample();
        }
        const attenuationDb = 20 * Math.log10(rms(filtered, 2000) / rms(raw, 2000));
        expect(attenuationDb).toBeLessThanOrEqual(-18);
    });

    it('keeps Mix zero sample-exactly dry and normalizes mono by cable state', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 8 });
        dsp.params.mix = 0;
        dsp.reset();
        const left = [-4.8, -3, -1, 0, 1, 3, 4.7, 4.8];

        processBlock(dsp, { inL: i => left[i] });
        expect(dsp.outputs.outL).toEqual(Float32Array.from(left));
        expect(dsp.outputs.outR).toEqual(Float32Array.from(left));

        dsp.onInputConnected('inR');
        processBlock(dsp, { inL: i => left[i], inR: 0 });
        expect(dsp.outputs.outR.every(value => value === 0)).toBe(true);

        dsp.onInputDisconnected('inR');
        processBlock(dsp, { inL: i => left[i], inR: 0 });
        expect(dsp.outputs.outR).toEqual(Float32Array.from(left));
    });

    it('uses the equal-power law at an intermediate Mix setting', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 8 });
        dsp.params.mix = 0.5;
        dsp.params.preDelay = 0;
        dsp.reset();
        processBlock(dsp, { inL: 1 });

        const expected = Math.SQRT1_2;
        expect(dsp.outputs.outL[0]).toBeCloseTo(expected, 6);
        expect(dsp.outputs.outR[0]).toBeCloseTo(expected, 6);
    });

    it('uses continuous five-volt rails and recovers from non-finite input and params', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 8 });
        dsp.params.mix = 0;
        dsp.params.decay = NaN;
        dsp.params.damp = Infinity;
        dsp.params.shimmer = -Infinity;
        dsp.reset();
        const values = [4.79, 4.8, 4.81, 5, 6, NaN, Infinity, -Infinity];
        processBlock(dsp, { inL: i => values[i] });

        expect(dsp.outputs.outL[0]).toBeCloseTo(4.79, 6);
        expect(dsp.outputs.outL[1]).toBeCloseTo(4.8, 6);
        expect(dsp.outputs.outL[2]).toBeCloseTo(softLimitVoltage(4.81, 5), 6);
        expect(dsp.outputs.outL.every(Number.isFinite)).toBe(true);
        expect(dsp.outputs.outL.every(value => Math.abs(value) <= 5)).toBe(true);
        Object.values(dsp.leds).forEach(value => {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        });
    });

    it('drives Input, Tail, and Pitched LEDs from their documented signal paths', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 12000, bufferSize: 120 });
        Object.assign(dsp.params, {
            mix: 1,
            route: 0,
            shimmer: 1,
            interval: 12,
            preDelay: 0,
            modDepth: 0
        });
        dsp.reset();

        processBlock(dsp, { inL: index => Math.sin(index * 0.2) * 3 });
        expect(dsp.leds.input).toBeGreaterThan(0);
        for (let block = 0; block < 30; block++) {
            processBlock(dsp, {
                inL: index => Math.sin((block * 120 + index) * 0.2) * 3
            });
        }
        expect(dsp.leds.tail).toBeGreaterThan(0);
        expect(dsp.leds.pitched).toBeGreaterThan(0);
        Object.values(dsp.leds).forEach(value => {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        });

        dsp.reset();
        expect(dsp.leds).toEqual({ input: 0, tail: 0, pitched: 0, frozen: 0 });
    });

    it('distinguishes INPUT from REGEN only when shimmer is active', () => {
        const bypassInput = renderImpulse({ route: 0, shimmer: 0 });
        const bypassRegen = renderImpulse({ route: 1, shimmer: 0 });
        expect(bypassInput).toEqual(bypassRegen);

        const input = renderImpulse({ route: 0, shimmer: 1 });
        const regen = renderImpulse({ route: 1, shimmer: 1 });
        expect(energy(input)).toBeGreaterThan(0);
        expect(energy(regen)).toBeGreaterThan(0);
        expect(regen).not.toEqual(input);
        const lateStart = Math.floor(input.length * 0.65);
        expect(Math.abs(energy(regen, lateStart) - energy(input, lateStart))).toBeGreaterThan(1e-8);
    });

    it('builds successive octave generations only through REGEN feedback', () => {
        const sampleRate = 48000;
        const bufferSize = 128;
        const totalSamples = Math.round(sampleRate * 1.2);
        const sourceSamples = Math.round(sampleRate * 0.08);
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
        Object.assign(dsp.params, {
            mix: 1,
            route: 1,
            shimmer: 1,
            interval: 12,
            preDelay: 0,
            diffusion: 0.75,
            damp: 0,
            decay: 1,
            modDepth: 0
        });
        dsp.reset();

        const output = new Float32Array(totalSamples);
        let absolute = 0;
        while (absolute < totalSamples) {
            processBlock(dsp, {
                inL: index => {
                    const sample = absolute + index;
                    return sample < sourceSamples
                        ? Math.sin(2 * Math.PI * 220 * sample / sampleRate) * 2
                        : 0;
                }
            });
            const count = Math.min(bufferSize, totalSamples - absolute);
            output.set(dsp.outputs.outL.subarray(0, count), absolute);
            absolute += count;
        }

        const frequencies = [220, 440, 880, 1760, 3520];
        const generations = [
            { start: 0.10, bin: 0, floor: 0.1 },
            { start: 0.20, bin: 1, floor: 0.02 },
            { start: 0.30, bin: 2, floor: 0.005 },
            { start: 0.45, bin: 3, floor: 0.001 },
            { start: 0.55, bin: 4, floor: 0.0002 }
        ];
        generations.forEach(({ start, bin, floor }) => {
            const magnitudes = frequencies.map(frequency => (
                singleBinMagnitude(output, sampleRate, frequency, start)
            ));
            expect(magnitudes[bin]).toBeGreaterThan(floor);
            expect(magnitudes[bin]).toBe(Math.max(...magnitudes));
        });
    });

    it('freezes a settled tail without accepting new wet input while dry remains live', () => {
        const sampleRate = 12000;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize: 120 });
        const control = shimmerModule.createDSP({ sampleRate, bufferSize: 120 });
        const params = { mix: 1, preDelay: 0, decay: 0.8, shimmer: 0.7, route: 1 };
        Object.assign(dsp.params, params);
        Object.assign(control.params, params);
        dsp.reset();
        control.reset();
        processBlock(dsp, { inL: i => i === 0 ? 3 : 0 });
        processBlock(control, { inL: i => i === 0 ? 3 : 0 });
        for (let block = 0; block < 80; block++) {
            processBlock(dsp);
            processBlock(control);
        }
        dsp.params.freeze = 1;
        control.params.freeze = 1;
        for (let block = 0; block < 20; block++) {
            processBlock(dsp);
            processBlock(control);
        }
        const frozenState = dsp.getDebugState();
        const before = frozenState.tankEnergy;
        expect(frozenState.freezeMorph).toBe(1);
        expect(frozenState.activeDelaySamples.every(Number.isInteger)).toBe(true);
        for (let block = 0; block < 500; block++) {
            processBlock(dsp);
            processBlock(control);
        }
        const after = dsp.getDebugState().tankEnergy;
        expect(dsp.leds.frozen).toBe(1);
        expect(after).toBeGreaterThan(0);
        expect(10 * Math.log10(after / before)).toBeGreaterThanOrEqual(-3);
        expect(10 * Math.log10(after / before)).toBeLessThanOrEqual(3);

        for (let block = 0; block < 20; block++) {
            processBlock(dsp, { inL: 4, inR: -4 });
            processBlock(control);
            expect(dsp.outputs.outL).toEqual(control.outputs.outL);
            expect(dsp.outputs.outR).toEqual(control.outputs.outR);
        }
        expect(dsp.getDebugState().tankEnergy).toBe(control.getDebugState().tankEnergy);

        dsp.params.mix = 0;
        processBlock(dsp, { inL: 2 });
        expect(dsp.outputs.outL.every(value => value > 0)).toBe(true);
    });

    it('uses exact Freeze threshold and panel-OR-gate semantics', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 12000, bufferSize: 120 });
        processBlock(dsp, { freezeGate: 0.999 });
        expect(dsp.leds.frozen).toBe(0);
        processBlock(dsp, { freezeGate: 1 });
        expect(dsp.leds.frozen).toBe(1);
        processBlock(dsp, { freezeGate: 0 });
        expect(dsp.leds.frozen).toBe(0);

        dsp.params.freeze = 1;
        processBlock(dsp, { freezeGate: 0 });
        expect(dsp.leds.frozen).toBe(1);
        processBlock(dsp, { freezeGate: 10 });
        expect(dsp.leds.frozen).toBe(1);
        dsp.params.freeze = 0;
        processBlock(dsp, { freezeGate: 0 });
        expect(dsp.leds.frozen).toBe(0);
    });

    it('clears once on a rising edge, preserves controls, and finishes within the timing bound', () => {
        const sampleRate = 12000;
        const bufferSize = 128;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
        Object.assign(dsp.params, { mix: 1, preDelay: 0, decay: 0.8, freeze: 0 });
        dsp.reset();
        processBlock(dsp, { inL: i => i === 0 ? 3 : 0 });
        processSilence(dsp, 80);

        dsp.params.freeze = 1;
        processSilence(dsp, 2);
        expect(dsp.getDebugState().tankEnergy).toBeGreaterThan(0);

        dsp.params.clear = 1;
        processBlock(dsp, { clearTrig: 1, freezeGate: 10 });
        const firstCount = dsp.getDebugState().clearCount;
        expect(firstCount).toBe(1);
        dsp.params.clear = 0;
        for (let i = 0; i < 4; i++) processBlock(dsp, { clearTrig: 10, freezeGate: 10 });
        expect(dsp.getDebugState().clearCount).toBe(firstCount);

        const maxBlocks = Math.ceil((sampleRate * 0.01) / bufferSize) + 2;
        processSilence(dsp, maxBlocks);
        expect(dsp.getDebugState().tankEnergy).toBe(0);
        expect(dsp.params.freeze).toBe(1);
        expect(dsp.params.decay).toBe(0.8);

        processBlock(dsp, { clearTrig: 1 });
        expect(dsp.getDebugState().clearCount).toBe(firstCount + 1);
    });

    it('uses the exact Clear fade, block-boundary erase, priority, and empty fade-in', () => {
        const sampleRate = 12000;
        const fadeSamples = 60;
        const bufferSize = 20;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
        Object.assign(dsp.params, {
            mix: 1,
            preDelay: 0,
            decay: 0.9,
            shimmer: 1,
            interval: -12,
            route: 0,
            freeze: 0
        });
        dsp.reset();
        for (let block = 0; block < 100; block++) {
            processBlock(dsp, {
                inL: index => block < 10 ? Math.sin((block * bufferSize + index) * 0.31) * 4 : 0
            });
        }
        expect(dsp.getDebugState().stateEnergy).toBeGreaterThan(0);

        // Start route/interval glides and overload on the same sample as both
        // Clear sources and Freeze. Clear must still erase into an empty freeze.
        Object.assign(dsp.params, { clear: 1, route: 1, interval: 12 });
        processBlock(dsp, { inL: 20, clearTrig: 10, freezeGate: 10 });
        let state = dsp.getDebugState();
        expect(state.clearCount).toBe(1);
        expect(state.clearStage).toBe(1);
        expect(state.clearGain).toBeCloseTo((fadeSamples - bufferSize) / fadeSamples, 12);

        dsp.params.clear = 0;
        processBlock(dsp, { clearTrig: 10, freezeGate: 10 });
        state = dsp.getDebugState();
        expect(state.clearCount).toBe(1);
        expect(state.clearGain).toBeCloseTo((fadeSamples - 2 * bufferSize) / fadeSamples, 12);
        processBlock(dsp, { clearTrig: 10, freezeGate: 10 });
        state = dsp.getDebugState();
        expect(state.clearStage).toBe(2);
        expect(state.clearGain).toBe(0);
        expect(state.stateEnergy).toBeGreaterThan(0);

        // The following process-block boundary performs the bulk erase, then
        // begins the exact 5 ms fade-in without accepting frozen input.
        processBlock(dsp, { inL: -20, clearTrig: 10, freezeGate: 10 });
        state = dsp.getDebugState();
        expect(state.clearStage).toBe(3);
        expect(state.clearGain).toBeCloseTo(bufferSize / fadeSamples, 12);
        expect(state.stateEnergy).toBe(0);
        expect(state.freezeMorph).toBe(1);
        expect(dsp.leds.frozen).toBe(1);
        expect(dsp.outputs.outL.every(Number.isFinite)).toBe(true);

        processBlock(dsp, { clearTrig: 10, freezeGate: 10 });
        expect(dsp.getDebugState().clearGain).toBeCloseTo(2 * bufferSize / fadeSamples, 12);
        processBlock(dsp, { clearTrig: 10, freezeGate: 10 });
        state = dsp.getDebugState();
        expect(state.clearStage).toBe(0);
        expect(state.clearGain).toBe(1);
        expect(state.stateEnergy).toBe(0);
        expect(state.clearCount).toBe(1);
        expect(dsp.params).toMatchObject({ decay: 0.9, shimmer: 1, interval: 12, route: 1, freeze: 0 });

        // A fresh instance held frozen for the same 60 fade-in samples must
        // render identically after release. This locks delay indices, filter
        // state, modulation/pitch phases, smoothers, and LEDs—not only FDN RAM.
        const fresh = shimmerModule.createDSP({ sampleRate, bufferSize });
        Object.assign(fresh.params, {
            mix: 1,
            preDelay: 0,
            decay: 0.9,
            shimmer: 1,
            interval: 12,
            route: 1,
            freeze: 1
        });
        fresh.reset();
        processSilence(fresh, fadeSamples / bufferSize);
        fresh.params.freeze = 0;
        for (let block = 0; block < 30; block++) {
            const input = { inL: index => block === 0 && index === 0 ? 3 : 0 };
            processBlock(dsp, input);
            processBlock(fresh, input);
            expect(dsp.outputs.outL).toEqual(fresh.outputs.outL);
            expect(dsp.outputs.outR).toEqual(fresh.outputs.outR);
        }
    });

    it('is sample-identical across block segmentation when Clear is absent', () => {
        const shortBlocks = renderStream({ bufferSize: 64 });
        const longBlocks = renderStream({ bufferSize: 256 });
        expect(longBlocks).toEqual(shortBlocks);
    });

    it('keeps 30-second extreme recursive operation finite, rail-bounded, and allocation-stable', () => {
        const sampleRate = 44100;
        const bufferSize = 128;
        const blocks = Math.ceil(30 * sampleRate / bufferSize);
        for (const [route, interval] of [[0, -12], [1, 12]]) {
            const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
            Object.assign(dsp.params, {
                decay: 1,
                size: 1,
                diffusion: 1,
                preDelay: 0,
                damp: 0,
                modDepth: 1,
                interval,
                shimmer: 1,
                mix: 1,
                route
            });
            dsp.reset();
            const inputRefs = { ...dsp.inputs };
            const outputRefs = { ...dsp.outputs };
            let allFinite = true;
            let peak = 0;
            for (let block = 0; block < blocks; block++) {
                processBlock(dsp, {
                    inL: index => index === 0 && block % 17 === 0 ? 20 : 0,
                    inR: index => index === 0 && block % 29 === 0 ? -20 : 0,
                    decayCV: block % 31 === 0 ? NaN : 5,
                    shimmerCV: 5,
                    dampCV: -5,
                    intervalCV: block % 47 === 0 ? Infinity : 0,
                    freezeGate: block % 101 < 3 ? 10 : 0
                });
                for (let sample = 0; sample < bufferSize; sample++) {
                    const left = dsp.outputs.outL[sample];
                    const right = dsp.outputs.outR[sample];
                    allFinite = allFinite && Number.isFinite(left) && Number.isFinite(right);
                    peak = Math.max(peak, Math.abs(left), Math.abs(right));
                }
            }
            expect(allFinite).toBe(true);
            expect(peak).toBeLessThanOrEqual(5);
            Object.entries(inputRefs).forEach(([name, buffer]) => expect(dsp.inputs[name]).toBe(buffer));
            Object.entries(outputRefs).forEach(([name, buffer]) => expect(dsp.outputs[name]).toBe(buffer));
        }
    }, 15000);

    it('reset clears all state in place and matches a fresh default impulse render', () => {
        const options = { sampleRate: 16000, bufferSize: 128 };
        const used = shimmerModule.createDSP(options);
        const inputRefs = { ...used.inputs };
        const outputRefs = { ...used.outputs };
        processBlock(used, { inL: i => i === 0 ? 4 : Math.sin(i * 0.2) });
        processSilence(used, 50);
        used.reset();
        Object.entries(inputRefs).forEach(([name, buffer]) => expect(used.inputs[name]).toBe(buffer));
        Object.entries(outputRefs).forEach(([name, buffer]) => expect(used.outputs[name]).toBe(buffer));
        Object.values(used.inputs).forEach(buffer => expect(buffer.every(value => value === 0)).toBe(true));
        Object.values(used.outputs).forEach(buffer => expect(buffer.every(value => value === 0)).toBe(true));
        expect(used.leds).toEqual({ input: 0, tail: 0, pitched: 0, frozen: 0 });

        const fresh = shimmerModule.createDSP(options);
        processBlock(used, { inL: i => i === 0 ? 3 : 0 });
        processBlock(fresh, { inL: i => i === 0 ? 3 : 0 });
        expect(used.outputs.outL).toEqual(fresh.outputs.outL);
        expect(used.outputs.outR).toEqual(fresh.outputs.outR);
    });
});
