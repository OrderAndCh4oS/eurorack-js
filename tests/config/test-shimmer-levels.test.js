import { describe, expect, it } from 'vitest';
import clockModule from '../../src/js/modules/clk/index.js';
import gateDelayModule from '../../src/js/modules/gate-delay/index.js';
import adsrModule from '../../src/js/modules/adsr/index.js';
import ensembleModule from '../../src/js/modules/ensemble-vco/index.js';
import vcaModule from '../../src/js/modules/vca/index.js';
import shimmerModule from '../../src/js/modules/shimmer/index.js';
import mixModule from '../../src/js/modules/mix/index.js';
import patch from '../../src/js/config/patches/test-shimmer.js';

const SAMPLE_RATE = 48000;
const BUFFER_SIZE = 128;
const RENDER_SECONDS = 6;

function createDSP(definition, params) {
    const dsp = definition.createDSP({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER_SIZE });
    Object.assign(dsp.params, params);
    return dsp;
}

function createMeter() {
    return { sumSquares: 0, sampleCount: 0, peak: 0, finite: true };
}

function meterBuffers(meter, buffers, gain = 1) {
    buffers.forEach(buffer => buffer.forEach(value => {
        const sample = value * gain;
        if (!Number.isFinite(sample)) meter.finite = false;
        meter.sumSquares += sample * sample;
        meter.sampleCount++;
        meter.peak = Math.max(meter.peak, Math.abs(sample));
    }));
}

function rms(meter) {
    return Math.sqrt(meter.sumSquares / meter.sampleCount);
}

describe('Test - Shimmer gain staging', () => {
    it('keeps every critical stage audible without changing Ensemble Warp mode', () => {
        const params = structuredClone(patch.state.params);
        const clock = createDSP(clockModule, params.clock);
        const gateStretcher = createDSP(gateDelayModule, params.gateStretcher);
        const envelope = createDSP(adsrModule, params.envelope);
        const ensemble = createDSP(ensembleModule, params.ensemble);
        const vca = createDSP(vcaModule, params.vca);
        const inputShimmer = createDSP(shimmerModule, params.inputShimmer);
        const regenShimmer = createDSP(shimmerModule, params.regenShimmer);
        const leftMix = createDSP(mixModule, params.leftMix);
        const rightMix = createDSP(mixModule, params.rightMix);
        inputShimmer.onInputConnected('inR');
        regenShimmer.onInputConnected('inR');

        const meters = Object.fromEntries([
            'ensemble', 'envelope', 'vca', 'inputShimmer', 'regenShimmer', 'mix', 'output'
        ].map(name => [name, createMeter()]));
        const blocks = Math.ceil(RENDER_SECONDS * SAMPLE_RATE / BUFFER_SIZE);

        for (let block = 0; block < blocks; block++) {
            clock.process();
            gateStretcher.inputs.trig1.set(clock.outputs.clock);
            gateStretcher.process();
            envelope.inputs.gate.set(gateStretcher.outputs.gate1);
            envelope.process();
            ensemble.process();

            vca.inputs.ch1In.set(ensemble.outputs.outA);
            vca.inputs.ch2In.set(ensemble.outputs.outB);
            vca.inputs.ch1CV.set(envelope.outputs.env);
            vca.inputs.ch2CV.set(envelope.outputs.env);
            vca.process();

            inputShimmer.inputs.inL.set(vca.outputs.ch1Out);
            inputShimmer.inputs.inR.set(vca.outputs.ch2Out);
            regenShimmer.inputs.inL.set(vca.outputs.ch1Out);
            regenShimmer.inputs.inR.set(vca.outputs.ch2Out);
            inputShimmer.process();
            regenShimmer.process();

            leftMix.inputs.in1.set(inputShimmer.outputs.outL);
            leftMix.inputs.in2.set(regenShimmer.outputs.outL);
            rightMix.inputs.in1.set(inputShimmer.outputs.outR);
            rightMix.inputs.in2.set(regenShimmer.outputs.outR);
            leftMix.process();
            rightMix.process();

            meterBuffers(meters.ensemble, [ensemble.outputs.outA, ensemble.outputs.outB]);
            meterBuffers(meters.envelope, [envelope.outputs.env]);
            meterBuffers(meters.vca, [vca.outputs.ch1Out, vca.outputs.ch2Out]);
            meterBuffers(meters.inputShimmer, [inputShimmer.outputs.outL, inputShimmer.outputs.outR]);
            meterBuffers(meters.regenShimmer, [regenShimmer.outputs.outL, regenShimmer.outputs.outR]);
            meterBuffers(meters.mix, [leftMix.outputs.out, rightMix.outputs.out]);
            meterBuffers(meters.output, [leftMix.outputs.out, rightMix.outputs.out], params.out.volume);
        }

        expect(params.ensemble.warpMode).toBe(0);
        Object.values(meters).forEach(meter => expect(meter.finite).toBe(true));
        expect(rms(meters.ensemble)).toBeGreaterThan(1);
        expect(rms(meters.envelope)).toBeGreaterThan(1);
        expect(rms(meters.vca)).toBeGreaterThan(0.3);
        expect(rms(meters.inputShimmer)).toBeGreaterThan(0.15);
        expect(rms(meters.regenShimmer)).toBeGreaterThan(0.15);
        expect(rms(meters.mix)).toBeGreaterThan(0.15);
        expect(rms(meters.output)).toBeGreaterThan(0.1);
        expect(meters.ensemble.peak).toBeLessThanOrEqual(5);
        expect(meters.inputShimmer.peak).toBeLessThanOrEqual(5);
        expect(meters.regenShimmer.peak).toBeLessThanOrEqual(5);
        expect(meters.output.peak).toBeLessThan(5);
    });
});
