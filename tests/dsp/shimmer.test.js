import { describe, expect, it } from 'vitest';
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

function renderImpulse({ route, shimmer = 1, seconds = 1.5, sampleRate = 12000 } = {}) {
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
        modDepth: 0
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
        expect(shimmerModule.ui.knobs).toHaveLength(9);
        expect(shimmerModule.ui.switches).toEqual([
            { id: 'route', label: 'ROUTE', param: 'route', default: 1 }
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

    it('keeps Mix zero sample-exactly dry and normalizes mono by cable state', () => {
        const dsp = shimmerModule.createDSP({ sampleRate: 48000, bufferSize: 8 });
        dsp.params.mix = 0;
        dsp.reset();
        const left = [-4.8, -3, -1, 0, 1, 3, 4.7, 4.8];

        processBlock(dsp, { inL: i => left[i] });
        expect(Array.from(dsp.outputs.outL)).toEqual(left);
        expect(Array.from(dsp.outputs.outR)).toEqual(left);

        dsp.onInputConnected('inR');
        processBlock(dsp, { inL: i => left[i], inR: 0 });
        expect(dsp.outputs.outR.every(value => value === 0)).toBe(true);

        dsp.onInputDisconnected('inR');
        processBlock(dsp, { inL: i => left[i], inR: 0 });
        expect(Array.from(dsp.outputs.outR)).toEqual(left);
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

        expect(dsp.outputs.outL[0]).toBe(4.79);
        expect(dsp.outputs.outL[1]).toBe(4.8);
        expect(dsp.outputs.outL[2]).toBeCloseTo(softLimitVoltage(4.81, 5), 6);
        expect(dsp.outputs.outL.every(Number.isFinite)).toBe(true);
        expect(dsp.outputs.outL.every(value => Math.abs(value) <= 5)).toBe(true);
        Object.values(dsp.leds).forEach(value => {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        });
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

    it('freezes a settled tail without accepting new wet input while dry remains live', () => {
        const sampleRate = 12000;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize: 120 });
        Object.assign(dsp.params, { mix: 1, preDelay: 0, decay: 0.8, shimmer: 0.7, route: 1 });
        dsp.reset();
        processBlock(dsp, { inL: i => i === 0 ? 3 : 0 });
        processSilence(dsp, 80);
        dsp.params.freeze = 1;
        processSilence(dsp, 20);
        const before = dsp.getDebugState().tankEnergy;
        processSilence(dsp, 500);
        const after = dsp.getDebugState().tankEnergy;
        expect(dsp.leds.frozen).toBe(1);
        expect(after).toBeGreaterThan(0);
        expect(10 * Math.log10(after / before)).toBeGreaterThanOrEqual(-3);
        expect(10 * Math.log10(after / before)).toBeLessThanOrEqual(3);

        dsp.params.mix = 0;
        processBlock(dsp, { inL: 2 });
        expect(dsp.outputs.outL.every(value => value > 0)).toBe(true);
    });

    it('clears once on a rising edge, preserves controls, and finishes within the timing bound', () => {
        const sampleRate = 12000;
        const bufferSize = 128;
        const dsp = shimmerModule.createDSP({ sampleRate, bufferSize });
        Object.assign(dsp.params, { mix: 1, preDelay: 0, decay: 0.8, freeze: 1 });
        dsp.reset();
        processBlock(dsp, { inL: i => i === 0 ? 3 : 0 });
        processSilence(dsp, 80);

        processBlock(dsp, { clearTrig: 1, freezeGate: 10 });
        const firstCount = dsp.getDebugState().clearCount;
        expect(firstCount).toBe(1);
        for (let i = 0; i < 4; i++) processBlock(dsp, { clearTrig: 10, freezeGate: 10 });
        expect(dsp.getDebugState().clearCount).toBe(firstCount);

        const maxBlocks = Math.ceil((sampleRate * 0.01) / bufferSize) + 2;
        processSilence(dsp, maxBlocks);
        expect(dsp.getDebugState().tankEnergy).toBe(0);
        expect(dsp.params.freeze).toBe(1);
        expect(dsp.params.decay).toBe(0.8);
    });

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
