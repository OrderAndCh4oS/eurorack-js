import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';

const BAND_COUNT = 12;
const BAND_FREQUENCIES = [120, 170, 250, 370, 550, 820, 1220, 1810, 2690, 4000, 5950, 8500];
const BAND_TYPES = ['lowpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'bandpass', 'highpass'];
const BUTTERWORTH_Q = 0.70710678;
const BANDPASS_Q = 2;
const FOLLOWER_SCALE = Math.sqrt(BAND_COUNT);
const BANK_GAIN = 1.4 / FOLLOWER_SCALE;
const LOG_ONE_PERCENT = Math.log(0.01);

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function makeCoefficients(type, frequency, q, sampleRate) {
    const safeFrequency = Math.min(frequency, sampleRate * 0.42);
    const omega = 2 * Math.PI * safeFrequency / sampleRate;
    const cosine = Math.cos(omega);
    const alpha = Math.sin(omega) / (2 * q);
    const a0 = 1 + alpha;
    let b0;
    let b1;
    let b2;

    if (type === 'lowpass') {
        b0 = (1 - cosine) * 0.5;
        b1 = 1 - cosine;
        b2 = b0;
    } else if (type === 'highpass') {
        b0 = (1 + cosine) * 0.5;
        b1 = -(1 + cosine);
        b2 = b0;
    } else {
        // RBJ constant-0-dB-peak band-pass form.
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
    }

    return [b0 / a0, b1 / a0, b2 / a0, -2 * cosine / a0, (1 - alpha) / a0];
}

export default {
    id: 'vocoder',
    name: 'VOCODER',
    hp: 10,
    color: 'module-color-eight',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const modulator = new Float32Array(bufferSize);
        const carrier = new Float32Array(bufferSize);
        const shiftCv = new Float32Array(bufferSize);
        const mixCv = new Float32Array(bufferSize);

        const coefficients = new Float64Array(BAND_COUNT * 5);
        for (let band = 0; band < BAND_COUNT; band++) {
            const values = makeCoefficients(
                BAND_TYPES[band],
                BAND_FREQUENCIES[band],
                BAND_TYPES[band] === 'bandpass' ? BANDPASS_Q : BUTTERWORTH_Q,
                sampleRate
            );
            const offset = band * 5;
            for (let index = 0; index < 5; index++) coefficients[offset + index] = values[index];
        }
        const sibilanceCoefficients = makeCoefficients('highpass', 5000, BUTTERWORTH_Q, sampleRate);

        const analysisState1 = new Float64Array(BAND_COUNT);
        const analysisState2 = new Float64Array(BAND_COUNT);
        const synthesisState1 = new Float64Array(BAND_COUNT);
        const synthesisState2 = new Float64Array(BAND_COUNT);
        const envelopes = new Float64Array(BAND_COUNT);
        let sibilanceState1 = 0;
        let sibilanceState2 = 0;

        const analysisGainSlew = createSlew({ sampleRate, timeMs: 5 });
        const carrierGainSlew = createSlew({ sampleRate, timeMs: 5 });
        const shiftSlew = createSlew({ sampleRate, timeMs: 5 });
        const sibilanceSlew = createSlew({ sampleRate, timeMs: 5 });
        const mixSlew = createSlew({ sampleRate, timeMs: 5 });
        let hydrated = false;

        const leds = { analysis: 0, carrier: 0, output: 0 };

        return {
            params: {
                analysisGain: 1,
                carrierGain: 1,
                attackMs: 5,
                releaseMs: 120,
                shift: 0,
                sibilance: 0.25,
                mix: 1
            },
            inputs: { modulator, carrier, shiftCv, mixCv },
            outputs: { out },
            leds,

            process() {
                const analysisGainTarget = clamp(finiteOr(this.params.analysisGain, 1), 0, 2);
                const carrierGainTarget = clamp(finiteOr(this.params.carrierGain, 1), 0, 2);
                const shiftTarget = clamp(finiteOr(this.params.shift, 0), -1, 1);
                const sibilanceTarget = clamp(finiteOr(this.params.sibilance, 0.25), 0, 1);
                const mixTarget = clamp(finiteOr(this.params.mix, 1), 0, 1);
                const attackMs = clamp(finiteOr(this.params.attackMs, 5), 1, 50);
                const releaseMs = clamp(finiteOr(this.params.releaseMs, 120), 20, 500);
                const attackCoefficient = Math.exp(LOG_ONE_PERCENT / (attackMs * 0.001 * sampleRate));
                const releaseCoefficient = Math.exp(LOG_ONE_PERCENT / (releaseMs * 0.001 * sampleRate));

                if (!hydrated) {
                    const initialShiftCv = finiteOr(shiftCv[0], 0);
                    const initialMixCv = finiteOr(mixCv[0], 0);
                    analysisGainSlew.reset(analysisGainTarget);
                    carrierGainSlew.reset(carrierGainTarget);
                    shiftSlew.reset(clamp(shiftTarget + initialShiftCv / 5, -1, 1));
                    sibilanceSlew.reset(sibilanceTarget);
                    mixSlew.reset(clamp(mixTarget + initialMixCv / 5, 0, 1));
                    hydrated = true;
                }

                let analysisPeak = 0;
                let carrierPeak = 0;
                let outputPeak = 0;

                for (let sample = 0; sample < bufferSize; sample++) {
                    const rawModulator = finiteOr(modulator[sample], 0);
                    const rawCarrier = finiteOr(carrier[sample], 0);
                    const absoluteModulator = Math.abs(rawModulator);
                    const absoluteCarrier = Math.abs(rawCarrier);
                    if (absoluteModulator > analysisPeak) analysisPeak = absoluteModulator;
                    if (absoluteCarrier > carrierPeak) carrierPeak = absoluteCarrier;

                    const smoothedAnalysisGain = analysisGainSlew.process(analysisGainTarget);
                    const smoothedCarrierGain = carrierGainSlew.process(carrierGainTarget);
                    const smoothedShift = shiftSlew.process(clamp(
                        shiftTarget + finiteOr(shiftCv[sample], 0) / 5,
                        -1,
                        1
                    ));
                    const smoothedSibilance = sibilanceSlew.process(sibilanceTarget);
                    const smoothedMix = mixSlew.process(clamp(
                        mixTarget + finiteOr(mixCv[sample], 0) / 5,
                        0,
                        1
                    ));

                    const analysisInput = softLimitVoltage(rawModulator * smoothedAnalysisGain, 5) / 5;
                    const carrierInput = softLimitVoltage(rawCarrier * smoothedCarrierGain, 5) / 5;
                    const dry = softLimitVoltage(rawModulator, 5) / 5;

                    for (let band = 0; band < BAND_COUNT; band++) {
                        const offset = band * 5;
                        const analysisBand = coefficients[offset] * analysisInput + analysisState1[band];
                        analysisState1[band] = coefficients[offset + 1] * analysisInput
                            - coefficients[offset + 3] * analysisBand
                            + analysisState2[band];
                        analysisState2[band] = coefficients[offset + 2] * analysisInput
                            - coefficients[offset + 4] * analysisBand;
                        const target = Math.min(Math.abs(analysisBand) * FOLLOWER_SCALE, 2);
                        const followerCoefficient = target > envelopes[band]
                            ? attackCoefficient
                            : releaseCoefficient;
                        envelopes[band] = followerCoefficient * (envelopes[band] - target) + target;
                    }

                    const shiftBands = smoothedShift * 4;
                    let bandSum = 0;
                    for (let band = 0; band < BAND_COUNT; band++) {
                        const offset = band * 5;
                        const synthesisBand = coefficients[offset] * carrierInput + synthesisState1[band];
                        synthesisState1[band] = coefficients[offset + 1] * carrierInput
                            - coefficients[offset + 3] * synthesisBand
                            + synthesisState2[band];
                        synthesisState2[band] = coefficients[offset + 2] * carrierInput
                            - coefficients[offset + 4] * synthesisBand;

                        const sourceIndex = band - shiftBands;
                        let shiftedEnvelope = 0;
                        if (sourceIndex >= 0 && sourceIndex <= BAND_COUNT - 1) {
                            const lower = Math.floor(sourceIndex);
                            const fraction = sourceIndex - lower;
                            shiftedEnvelope = envelopes[lower];
                            if (fraction > 0 && lower + 1 < BAND_COUNT) {
                                shiftedEnvelope += fraction * (envelopes[lower + 1] - shiftedEnvelope);
                            }
                        }
                        bandSum += synthesisBand * shiftedEnvelope;
                    }

                    const sibilanceOutput = sibilanceCoefficients[0] * analysisInput + sibilanceState1;
                    sibilanceState1 = sibilanceCoefficients[1] * analysisInput
                        - sibilanceCoefficients[3] * sibilanceOutput
                        + sibilanceState2;
                    sibilanceState2 = sibilanceCoefficients[2] * analysisInput
                        - sibilanceCoefficients[4] * sibilanceOutput;

                    const wet = bandSum * BANK_GAIN + 0.35 * smoothedSibilance * sibilanceOutput;
                    const outputSample = softLimitVoltage(
                        (dry * (1 - smoothedMix) + wet * smoothedMix) * 5,
                        5
                    );
                    out[sample] = outputSample;
                    const absoluteOutput = Math.abs(outputSample);
                    if (absoluteOutput > outputPeak) outputPeak = absoluteOutput;
                }

                const ledDecay = Math.exp(-bufferSize / (0.1 * sampleRate));
                leds.analysis = Math.max(Math.min(analysisPeak / 5, 1), leds.analysis * ledDecay);
                leds.carrier = Math.max(Math.min(carrierPeak / 5, 1), leds.carrier * ledDecay);
                leds.output = Math.max(Math.min(outputPeak / 5, 1), leds.output * ledDecay);
            },

            reset() {
                modulator.fill(0);
                carrier.fill(0);
                shiftCv.fill(0);
                mixCv.fill(0);
                out.fill(0);
                analysisState1.fill(0);
                analysisState2.fill(0);
                synthesisState1.fill(0);
                synthesisState2.fill(0);
                envelopes.fill(0);
                sibilanceState1 = 0;
                sibilanceState2 = 0;
                analysisGainSlew.reset(0);
                carrierGainSlew.reset(0);
                shiftSlew.reset(0);
                sibilanceSlew.reset(0);
                mixSlew.reset(0);
                hydrated = false;
                leds.analysis = 0;
                leds.carrier = 0;
                leds.output = 0;
            }
        };
    },

    ui: {
        leds: ['analysis', 'carrier', 'output'],
        knobs: [
            { id: 'analysisGain', label: 'Analysis', param: 'analysisGain', min: 0, max: 2, default: 1, step: 0.01 },
            { id: 'carrierGain', label: 'Carrier', param: 'carrierGain', min: 0, max: 2, default: 1, step: 0.01 },
            { id: 'attackMs', label: 'Attack', param: 'attackMs', min: 1, max: 50, default: 5, step: 1 },
            { id: 'releaseMs', label: 'Release', param: 'releaseMs', min: 20, max: 500, default: 120, step: 1 },
            { id: 'shift', label: 'Shift', param: 'shift', min: -1, max: 1, default: 0, step: 0.01 },
            { id: 'sibilance', label: 'Sibilance', param: 'sibilance', min: 0, max: 1, default: 0.25, step: 0.01 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 1, step: 0.01 }
        ],
        inputs: [
            { id: 'modulator', label: 'Mod', port: 'modulator', signal: 'audio', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'carrier', label: 'Car', port: 'carrier', signal: 'audio', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'shiftCv', label: 'Shift', port: 'shiftCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'mixCv', label: 'Mix', port: 'mixCv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'audio', voltage: { min: -5, max: 5 } }
        ]
    }
};
