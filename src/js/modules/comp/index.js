/**
 * COMP - Stereo-linked compressor/limiter
 *
 * Clean feed-forward compressor inspired by Eurorack bus compressors such as
 * Cosmotronic Messor and WMD MSCL. Thresholds are dB relative to 5 V peak.
 */

import { clamp, expMap } from '../../utils/math.js';

const FULL_SCALE_V = 5;
const MIN_LEVEL = 1e-8;
const SOFT_KNEE_DB = 6;
const MAX_GR_DB = 30;

function normFromExp(value, min, max) {
    return Math.log(value / min) / Math.log(max / min);
}

function dbToGain(db) {
    return Math.pow(10, db / 20);
}

function clampAudio(value) {
    return clamp(value, -FULL_SCALE_V, FULL_SCALE_V);
}

function safeSample(value) {
    return Number.isFinite(value) ? value : 0;
}

function hasSignal(buffer) {
    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] !== 0) return true;
    }
    return false;
}

function thresholdToDb(norm) {
    return -36 + clamp(norm) * 36;
}

function makeupToDb(norm) {
    return -12 + clamp(norm) * 30;
}

function gainReductionFor(levelDb, thresholdDb, ratio, kneeDb) {
    const overDb = levelDb - thresholdDb;
    const ratioFactor = 1 - 1 / Math.max(1, ratio);

    if (ratioFactor <= 0) return 0;
    if (kneeDb <= 0) return overDb > 0 ? overDb * ratioFactor : 0;
    if (overDb <= -kneeDb / 2) return 0;
    if (overDb >= kneeDb / 2) return overDb * ratioFactor;

    const kneePosition = overDb + kneeDb / 2;
    return (kneePosition * kneePosition / (2 * kneeDb)) * ratioFactor;
}

export default {
    id: 'comp',
    name: 'COMP',
    hp: 8,
    color: 'module-color-eleven',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);
        const env = new Float32Array(bufferSize);
        const gr = new Float32Array(bufferSize);

        const ownInL = new Float32Array(bufferSize);
        const ownInR = new Float32Array(bufferSize);
        const ownSidechain = new Float32Array(bufferSize);
        const ownThresholdCV = new Float32Array(bufferSize);
        const ownAttackCV = new Float32Array(bufferSize);
        const ownReleaseCV = new Float32Array(bufferSize);
        const ownMakeupCV = new Float32Array(bufferSize);
        const ownFilterCV = new Float32Array(bufferSize);

        const leds = { level: 0, gainReduction: 0, limit: 0 };
        const ledDecay = Math.exp(-bufferSize / (sampleRate * 0.12));
        const rmsCoef = Math.exp(-1 / (sampleRate * 0.01));

        let reductionDb = 0;
        let rmsState = 0;
        let lpState = 0;
        let hpState = 0;
        let hpPrevInput = 0;

        function timeCoeff(timeMs) {
            return Math.exp(-1 / Math.max(1, sampleRate * timeMs * 0.001));
        }

        function resetInput(instance, name, ownBuffer) {
            if (instance.inputs[name] !== ownBuffer) {
                ownBuffer.fill(0);
                instance.inputs[name] = ownBuffer;
            }
        }

        const dsp = {
            params: {
                threshold: 24 / 36,                  // -12 dB
                ratio: normFromExp(4, 1, 20),        // about 4:1
                attack: normFromExp(10, 0.1, 100),   // about 10 ms
                release: normFromExp(250, 10, 4000), // about 250 ms
                makeup: 12 / 30,                     // 0 dB
                sideFilter: normFromExp(120, 20, 8000),
                mix: 1,
                mode: 0,
                detector: 0,
                filterMode: 0,
                bypass: 0
            },

            inputs: {
                inL: ownInL,
                inR: ownInR,
                sidechain: ownSidechain,
                thresholdCV: ownThresholdCV,
                attackCV: ownAttackCV,
                releaseCV: ownReleaseCV,
                makeupCV: ownMakeupCV,
                filterCV: ownFilterCV
            },

            outputs: { outL, outR, env, gr },
            leds,

            clearAudioInputs() {
                ownInL.fill(0);
                ownInR.fill(0);
                ownSidechain.fill(0);
                this.inputs.inL = ownInL;
                this.inputs.inR = ownInR;
                this.inputs.sidechain = ownSidechain;
            },

            process() {
                const inputL = this.inputs.inL;
                const inputR = this.inputs.inR;
                const sidechain = this.inputs.sidechain;
                const thresholdCV = this.inputs.thresholdCV;
                const attackCV = this.inputs.attackCV;
                const releaseCV = this.inputs.releaseCV;
                const makeupCV = this.inputs.makeupCV;
                const filterCV = this.inputs.filterCV;

                const rightPatched = inputR !== ownInR || hasSignal(inputR);
                const sidechainPatched = sidechain !== ownSidechain || hasSignal(sidechain);
                const isLimitMode = this.params.mode >= 0.5;
                const usePeakDetector = isLimitMode || this.params.detector >= 0.5;
                const filterMode = Math.round(clamp(this.params.filterMode, 0, 2));
                const isBypassed = this.params.bypass >= 0.5;
                const wet = clamp(this.params.mix);

                let peakOut = 0;
                let maxReductionDb = 0;
                let clipped = false;

                if (isBypassed) {
                    reductionDb = 0;
                    rmsState = 0;
                }

                for (let i = 0; i < bufferSize; i++) {
                    const dryL = safeSample(inputL[i]);
                    const dryR = rightPatched ? safeSample(inputR[i]) : dryL;

                    if (isBypassed) {
                        const clippedL = clampAudio(dryL);
                        const clippedR = clampAudio(dryR);
                        outL[i] = clippedL;
                        outR[i] = clippedR;
                        env[i] = 0;
                        gr[i] = 0;

                        if (clippedL !== dryL || clippedR !== dryR) clipped = true;
                        peakOut = Math.max(peakOut, Math.abs(clippedL), Math.abs(clippedR));
                        continue;
                    }

                    let detectorSample = sidechainPatched
                        ? safeSample(sidechain[i])
                        : (Math.abs(dryL) >= Math.abs(dryR) ? dryL : dryR);

                    const cutoff = clamp(expMap(this.params.sideFilter, 20, 8000) * Math.pow(2, safeSample(filterCV[i])), 20, 8000);
                    const lpAlpha = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);

                    if (filterMode === 1) {
                        const hpAlpha = 1 / (1 + 2 * Math.PI * cutoff / sampleRate);
                        const nextHp = hpAlpha * (hpState + detectorSample - hpPrevInput);
                        hpPrevInput = detectorSample;
                        hpState = nextHp;
                        detectorSample = nextHp;
                    } else if (filterMode === 2) {
                        lpState += lpAlpha * (detectorSample - lpState);
                        detectorSample = lpState;
                    }

                    const detectorMagnitude = Math.abs(detectorSample);
                    let detectorLevel = detectorMagnitude;
                    if (!usePeakDetector) {
                        rmsState = rmsCoef * rmsState + (1 - rmsCoef) * detectorMagnitude * detectorMagnitude;
                        detectorLevel = Math.sqrt(Math.max(0, rmsState));
                    }

                    const levelDb = 20 * Math.log10(Math.max(detectorLevel, MIN_LEVEL) / FULL_SCALE_V);
                    const thresholdDb = clamp(thresholdToDb(this.params.threshold) + safeSample(thresholdCV[i]) * 6, -48, 6);
                    const ratio = isLimitMode ? 20 : expMap(this.params.ratio, 1, 20);
                    const kneeDb = isLimitMode ? 0 : SOFT_KNEE_DB;
                    const targetReductionDb = gainReductionFor(levelDb, thresholdDb, ratio, kneeDb);

                    const attackNorm = clamp(this.params.attack + safeSample(attackCV[i]) / 10);
                    const releaseNorm = clamp(this.params.release + safeSample(releaseCV[i]) / 10);
                    let attackMs = expMap(attackNorm, 0.1, 100);
                    const releaseMs = expMap(releaseNorm, 10, 4000);
                    if (isLimitMode) attackMs = Math.min(attackMs, 1);

                    const coeff = targetReductionDb > reductionDb ? timeCoeff(attackMs) : timeCoeff(releaseMs);
                    reductionDb = coeff * reductionDb + (1 - coeff) * targetReductionDb;

                    const makeupDb = clamp(makeupToDb(this.params.makeup) + safeSample(makeupCV[i]) * 6, -24, 24);
                    const gain = dbToGain(makeupDb - reductionDb);
                    const processedL = dryL * gain;
                    const processedR = dryR * gain;
                    const mixedL = dryL * (1 - wet) + processedL * wet;
                    const mixedR = dryR * (1 - wet) + processedR * wet;
                    const clippedL = clampAudio(mixedL);
                    const clippedR = clampAudio(mixedR);

                    outL[i] = clippedL;
                    outR[i] = clippedR;
                    env[i] = clamp(detectorLevel / FULL_SCALE_V, 0, 1) * 10;
                    gr[i] = clamp(reductionDb / MAX_GR_DB, 0, 1) * 10;

                    if (clippedL !== mixedL || clippedR !== mixedR) clipped = true;
                    peakOut = Math.max(peakOut, Math.abs(clippedL), Math.abs(clippedR));
                    maxReductionDb = Math.max(maxReductionDb, reductionDb);
                }

                leds.level = Math.max(clamp(peakOut / FULL_SCALE_V), leds.level * ledDecay);
                leds.gainReduction = isBypassed ? 0 : Math.max(clamp(maxReductionDb / MAX_GR_DB), leds.gainReduction * ledDecay);
                leds.limit = isLimitMode ? 1 : Math.max(clipped ? 1 : 0, leds.limit * ledDecay);

                resetInput(this, 'inL', ownInL);
                resetInput(this, 'inR', ownInR);
                resetInput(this, 'sidechain', ownSidechain);
                resetInput(this, 'thresholdCV', ownThresholdCV);
                resetInput(this, 'attackCV', ownAttackCV);
                resetInput(this, 'releaseCV', ownReleaseCV);
                resetInput(this, 'makeupCV', ownMakeupCV);
                resetInput(this, 'filterCV', ownFilterCV);
            },

            reset() {
                reductionDb = 0;
                rmsState = 0;
                lpState = 0;
                hpState = 0;
                hpPrevInput = 0;

                ownInL.fill(0);
                ownInR.fill(0);
                ownSidechain.fill(0);
                ownThresholdCV.fill(0);
                ownAttackCV.fill(0);
                ownReleaseCV.fill(0);
                ownMakeupCV.fill(0);
                ownFilterCV.fill(0);

                this.inputs.inL = ownInL;
                this.inputs.inR = ownInR;
                this.inputs.sidechain = ownSidechain;
                this.inputs.thresholdCV = ownThresholdCV;
                this.inputs.attackCV = ownAttackCV;
                this.inputs.releaseCV = ownReleaseCV;
                this.inputs.makeupCV = ownMakeupCV;
                this.inputs.filterCV = ownFilterCV;

                outL.fill(0);
                outR.fill(0);
                env.fill(0);
                gr.fill(0);
                leds.level = 0;
                leds.gainReduction = 0;
                leds.limit = 0;
            }
        };

        return dsp;
    },

    ui: {
        leds: ['level', 'gainReduction', 'limit'],
        knobs: [
            { id: 'threshold', label: 'Thrs', param: 'threshold', min: 0, max: 1, default: 24 / 36 },
            { id: 'ratio', label: 'Ratio', param: 'ratio', min: 0, max: 1, default: normFromExp(4, 1, 20) },
            { id: 'attack', label: 'Atk', param: 'attack', min: 0, max: 1, default: normFromExp(10, 0.1, 100) },
            { id: 'release', label: 'Rel', param: 'release', min: 0, max: 1, default: normFromExp(250, 10, 4000) },
            { id: 'makeup', label: 'Make', param: 'makeup', min: 0, max: 1, default: 12 / 30 },
            { id: 'sideFilter', label: 'SCF', param: 'sideFilter', min: 0, max: 1, default: normFromExp(120, 20, 8000) },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 1 }
        ],
        switches: [
            { id: 'mode', label: 'Mode', param: 'mode', positions: ['Comp', 'Limit'], default: 0 },
            { id: 'detector', label: 'Det', param: 'detector', positions: ['RMS', 'Peak'], default: 0 },
            { id: 'filterMode', label: 'Filt', param: 'filterMode', positions: ['Off', 'HP', 'LP'], default: 0 },
            { id: 'bypass', label: 'Byp', param: 'bypass', positions: ['On', 'Byp'], default: 0 }
        ],
        inputs: [
            { id: 'inL', label: 'L', port: 'inL', type: 'audio' },
            { id: 'inR', label: 'R', port: 'inR', type: 'audio' },
            { id: 'sidechain', label: 'SC', port: 'sidechain', type: 'audio' },
            { id: 'thresholdCV', label: 'Thr', port: 'thresholdCV', type: 'cv' },
            { id: 'attackCV', label: 'Atk', port: 'attackCV', type: 'cv' },
            { id: 'releaseCV', label: 'Rel', port: 'releaseCV', type: 'cv' },
            { id: 'makeupCV', label: 'Mak', port: 'makeupCV', type: 'cv' },
            { id: 'filterCV', label: 'Flt', port: 'filterCV', type: 'cv' }
        ],
        outputs: [
            { id: 'outL', label: 'L', port: 'outL', type: 'audio' },
            { id: 'outR', label: 'R', port: 'outR', type: 'audio' },
            { id: 'env', label: 'Env', port: 'env', type: 'cv' },
            { id: 'gr', label: 'GR', port: 'gr', type: 'cv' }
        ]
    }
};
