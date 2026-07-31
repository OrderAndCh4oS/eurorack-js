import { describe, expect, it } from 'vitest';
import clockModule from '../../src/js/modules/clk/index.js';
import kickModule from '../../src/js/modules/kick/index.js';
import noiseModule from '../../src/js/modules/nse/index.js';
import mixModule from '../../src/js/modules/mix/index.js';
import vcoModule from '../../src/js/modules/vco/index.js';
import vocoderModule from '../../src/js/modules/vocoder/index.js';
import patch from '../../src/js/config/patches/test-vocoder.js';

const SAMPLE_RATE = 48000;
const BUFFER_SIZE = 128;
const RENDER_SECONDS = 6;

function seededRandom(seed = 0x51b11a) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function createDSP(definition, params, options = {}) {
    const dsp = definition.createDSP({
        sampleRate: SAMPLE_RATE,
        bufferSize: BUFFER_SIZE,
        ...options
    });
    Object.assign(dsp.params, params);
    return dsp;
}

function createMeter() {
    return { sumSquares: 0, sampleCount: 0, peak: 0, finite: true };
}

function meterBuffer(meter, buffer, gain = 1) {
    buffer.forEach(value => {
        const sample = value * gain;
        if (!Number.isFinite(sample)) meter.finite = false;
        meter.sumSquares += sample * sample;
        meter.sampleCount++;
        meter.peak = Math.max(meter.peak, Math.abs(sample));
    });
}

function rms(meter) {
    return Math.sqrt(meter.sumSquares / meter.sampleCount);
}

describe('Test - Vocoder Sibilance staging', () => {
    it('provides an audible high-frequency path while remaining rail-safe', () => {
        const params = structuredClone(patch.state.params);
        const clock = createDSP(clockModule, params.clk);
        const kick = createDSP(kickModule, params.kick);
        const noise = createDSP(noiseModule, params.noise, { random: seededRandom() });
        const modMix = createDSP(mixModule, params.modMix);
        const vco = createDSP(vcoModule, params.vco);
        const vocoderOff = createDSP(vocoderModule, { ...params.vocoder, sibilance: 0 });
        const vocoderOn = createDSP(vocoderModule, { ...params.vocoder, sibilance: 1 });
        const difference = new Float32Array(BUFFER_SIZE);
        const meters = Object.fromEntries([
            'kick', 'noise', 'modulator', 'carrier', 'off', 'on', 'difference', 'output'
        ].map(name => [name, createMeter()]));
        const blocks = Math.ceil(RENDER_SECONDS * SAMPLE_RATE / BUFFER_SIZE);

        for (let block = 0; block < blocks; block++) {
            clock.process();
            kick.inputs.trigger.set(clock.outputs.clock);
            noise.inputs.trigger.set(clock.outputs.clock);
            kick.process();
            noise.process();

            modMix.inputs.in1.set(kick.outputs.out);
            modMix.inputs.in2.set(noise.outputs.noise);
            modMix.process();
            vco.process();

            vocoderOff.inputs.modulator.set(modMix.outputs.out);
            vocoderOn.inputs.modulator.set(modMix.outputs.out);
            vocoderOff.inputs.carrier.set(vco.outputs.ramp);
            vocoderOn.inputs.carrier.set(vco.outputs.ramp);
            vocoderOff.process();
            vocoderOn.process();
            for (let sample = 0; sample < BUFFER_SIZE; sample++) {
                difference[sample] = vocoderOn.outputs.out[sample] - vocoderOff.outputs.out[sample];
            }

            meterBuffer(meters.kick, kick.outputs.out);
            meterBuffer(meters.noise, noise.outputs.noise);
            meterBuffer(meters.modulator, modMix.outputs.out);
            meterBuffer(meters.carrier, vco.outputs.ramp);
            meterBuffer(meters.off, vocoderOff.outputs.out);
            meterBuffer(meters.on, vocoderOn.outputs.out);
            meterBuffer(meters.difference, difference);
            meterBuffer(meters.output, vocoderOn.outputs.out, params.out.volume);
        }

        Object.values(meters).forEach(meter => expect(meter.finite).toBe(true));
        expect(params.vocoder.sibilance).toBe(0.35);
        expect(rms(meters.kick)).toBeGreaterThan(0.5);
        expect(rms(meters.noise)).toBeGreaterThan(0.5);
        expect(rms(meters.modulator)).toBeGreaterThan(0.5);
        expect(rms(meters.carrier)).toBeGreaterThan(2);
        expect(rms(meters.off)).toBeGreaterThan(0.2);
        expect(rms(meters.difference)).toBeGreaterThan(0.1);
        expect(rms(meters.difference)).toBeGreaterThan(rms(meters.off) * 0.15);
        expect(rms(meters.on)).toBeGreaterThan(rms(meters.off));
        expect(rms(meters.output)).toBeGreaterThan(0.3);
        expect(meters.off.peak).toBeLessThanOrEqual(5);
        expect(meters.on.peak).toBeLessThanOrEqual(5);
        expect(meters.output.peak).toBeLessThan(5);
    });
});
