import { clamp } from '../../utils/math.js';
import { createLinearCircularReader } from '../../utils/interpolation.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';

// Independently specified from the published FDN and moving-delay equations in
// research/modules/shimmer.md. No proprietary or GPL implementation is copied.

const DEFAULTS = Object.freeze({
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
});

const FDN_DELAY_MS = Object.freeze([29.7, 33.1, 37.9, 41.3, 43.7, 47.9, 53.3, 59.9]);
const MOD_RATES_HZ = Object.freeze([0.071, 0.089, 0.113, 0.137, 0.163, 0.191, 0.223, 0.257]);
const DIFFUSER_DELAYS_L_MS = Object.freeze([4.3, 6.1, 8.9, 12.7]);
const DIFFUSER_DELAYS_R_MS = Object.freeze([4.9, 6.7, 9.7, 13.7]);

const H8_SCALE = 1 / Math.sqrt(8);
const H8_ROWS = new Int8Array([
    1, 1, 1, 1, 1, 1, 1, 1,
    1, -1, 1, -1, 1, -1, 1, -1,
    1, 1, -1, -1, 1, 1, -1, -1,
    1, -1, -1, 1, 1, -1, -1, 1,
    1, 1, 1, 1, -1, -1, -1, -1,
    1, -1, 1, -1, -1, 1, -1, 1,
    1, 1, -1, -1, -1, -1, 1, 1,
    1, -1, -1, 1, -1, 1, 1, -1
]);

// Fixed lookup: -12 through +12 semitones. No exponential runs in process().
export const SHIMMER_INTERVAL_RATIOS = Object.freeze([
    0.5,
    0.5297315471796477,
    0.5612310241546865,
    0.5946035575013605,
    0.6299605249474366,
    0.6674199270850172,
    0.7071067811865476,
    0.7491535384383408,
    0.7937005259840998,
    0.8408964152537145,
    0.8908987181403393,
    0.9438743126816935,
    1,
    1.0594630943592953,
    1.122462048309373,
    1.189207115002721,
    1.2599210498948732,
    1.3348398541700344,
    1.4142135623730951,
    1.4983070768766815,
    1.5874010519681994,
    1.681792830507429,
    1.7817974362806785,
    1.887748625363387,
    2
]);

export function applyNormalizedHadamard8(values) {
    if (!values || values.length !== 8) {
        throw new RangeError('Shimmer Hadamard transform requires eight values');
    }
    for (let width = 1; width < 8; width <<= 1) {
        const stride = width << 1;
        for (let base = 0; base < 8; base += stride) {
            for (let offset = 0; offset < width; offset++) {
                const index = base + offset;
                const a = values[index];
                const b = values[index + width];
                values[index] = a + b;
                values[index + width] = a - b;
            }
        }
    }
    for (let i = 0; i < 8; i++) values[i] *= H8_SCALE;
    return values;
}

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function finiteAudio(value) {
    return finite(value, 0);
}

function normalizedParam(value, fallback) {
    return clamp(finite(value, fallback), 0, 1);
}

function binaryParam(value, fallback) {
    return finite(value, fallback) >= 0.5 ? 1 : 0;
}

function semitoneParam(value, fallback) {
    return clamp(Math.round(finite(value, fallback)), -12, 12);
}

function flushTiny(value) {
    if (!Number.isFinite(value) || Math.abs(value) < 1e-20) return 0;
    return value;
}

function guardInternal(value) {
    return clamp(finite(value, 0), -20, 20);
}

function wrapUnit(value) {
    if (value >= 1) return value - 1;
    if (value < 0) return value + 1;
    return value;
}

function rowProjection(values, row) {
    const offset = row * 8;
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += values[i] * H8_ROWS[offset + i];
    return sum * H8_SCALE;
}

function rowValue(row, column) {
    return H8_ROWS[row * 8 + column] * H8_SCALE;
}

function createPeriodicSineTable() {
    const table = new Float32Array(2048);
    for (let i = 0; i < table.length; i++) {
        table[i] = Math.sin((i / table.length) * Math.PI * 2);
    }
    return table;
}

function lookupPeriodic(table, phase) {
    const wrapped = phase - Math.floor(phase);
    const position = wrapped * table.length;
    const index = Math.floor(position);
    const next = index + 1 === table.length ? 0 : index + 1;
    const fraction = position - index;
    return table[index] + (table[next] - table[index]) * fraction;
}

function dampingCutoff(damp, sampleRate) {
    const cutoff = 18000 * Math.pow(500 / 18000, clamp(damp, 0, 1));
    return Math.min(cutoff, sampleRate * 0.45);
}

function onePoleCoefficient(cutoff, sampleRate) {
    const frequency = clamp(cutoff, 1, sampleRate * 0.45);
    const cosine = Math.cos(2 * Math.PI * frequency / sampleRate);
    const pole = 2 - cosine - Math.sqrt((2 - cosine) * (2 - cosine) - 1);
    return 1 - pole;
}

function clearTypedBuffers(buffers) {
    for (let i = 0; i < buffers.length; i++) buffers[i].fill(0);
}

export default {
    id: 'shimmer',
    name: 'SHIMMER',
    hp: 16,
    color: 'module-color-eight',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
            throw new RangeError('Shimmer sampleRate must be a positive finite number');
        }
        if (!Number.isInteger(bufferSize) || bufferSize <= 0) {
            throw new RangeError('Shimmer bufferSize must be a positive integer');
        }

        const inL = new Float32Array(bufferSize);
        const inR = new Float32Array(bufferSize);
        const decayCV = new Float32Array(bufferSize);
        const dampCV = new Float32Array(bufferSize);
        const shimmerCV = new Float32Array(bufferSize);
        const intervalCV = new Float32Array(bufferSize);
        const mixCV = new Float32Array(bufferSize);
        const freezeGate = new Float32Array(bufferSize);
        const clearTrig = new Float32Array(bufferSize);
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        const maxPreDelaySamples = Math.ceil(sampleRate * 0.5);
        const preDelayL = new Float32Array(maxPreDelaySamples + 4);
        const preDelayR = new Float32Array(maxPreDelaySamples + 4);
        const readPreDelayL = createLinearCircularReader(preDelayL);
        const readPreDelayR = createLinearCircularReader(preDelayR);
        let preDelayWrite = 0;

        const diffuserBuffersL = new Array(4);
        const diffuserBuffersR = new Array(4);
        const diffuserIndicesL = new Int32Array(4);
        const diffuserIndicesR = new Int32Array(4);
        for (let i = 0; i < 4; i++) {
            diffuserBuffersL[i] = new Float32Array(Math.max(1, Math.round(DIFFUSER_DELAYS_L_MS[i] * sampleRate / 1000)));
            diffuserBuffersR[i] = new Float32Array(Math.max(1, Math.round(DIFFUSER_DELAYS_R_MS[i] * sampleRate / 1000)));
        }

        const fdnBuffers = new Array(8);
        const fdnReaders = new Array(8);
        const fdnWriteIndices = new Int32Array(8);
        const nominalDelaySamples = new Float64Array(8);
        const liveDelaySamples = new Float64Array(8);
        const activeDelaySamples = new Float64Array(8);
        const frozenDelaySamples = new Float64Array(8);
        const fdnReadValues = new Float64Array(8);
        const fdnFeedback = new Float64Array(8);
        const highpassInput = new Float64Array(8);
        const highpassOutput = new Float64Array(8);
        const lowpassState = new Float64Array(8);
        const feedbackGains = new Float64Array(8);
        const modPhases = new Float64Array(8);
        for (let i = 0; i < 8; i++) {
            nominalDelaySamples[i] = FDN_DELAY_MS[i] * sampleRate / 1000;
            const maximum = Math.ceil(nominalDelaySamples[i] * Math.SQRT2 + sampleRate * 0.00125) + 4;
            fdnBuffers[i] = new Float32Array(maximum);
            fdnReaders[i] = createLinearCircularReader(fdnBuffers[i]);
            modPhases[i] = i / 8;
            feedbackGains[i] = 0;
        }

        const pitchWindowSamples = sampleRate * 0.08;
        const pitchMinDelaySamples = sampleRate * 0.002;
        const pitchBufferSize = Math.ceil(sampleRate * 0.082) + 4;
        const pitchBufferL = new Float32Array(pitchBufferSize);
        const pitchBufferR = new Float32Array(pitchBufferSize);
        const readPitchL = createLinearCircularReader(pitchBufferL);
        const readPitchR = createLinearCircularReader(pitchBufferR);
        const pitchFilterL = new Float64Array(4);
        const pitchFilterR = new Float64Array(4);
        const pitchResult = new Float64Array(2);
        let pitchWrite = 0;
        let pitchPhase = 0;

        const sineTable = createPeriodicSineTable();
        let allocatedDelayBytes = preDelayL.byteLength + preDelayR.byteLength
            + pitchBufferL.byteLength + pitchBufferR.byteLength;
        for (let i = 0; i < 4; i++) {
            allocatedDelayBytes += diffuserBuffersL[i].byteLength + diffuserBuffersR[i].byteLength;
        }
        for (let i = 0; i < 8; i++) allocatedDelayBytes += fdnBuffers[i].byteLength;

        const decaySlew = createSlew({ sampleRate, timeMs: 20 });
        const sizeSlew = createSlew({ sampleRate, timeMs: 100 });
        const diffusionSlew = createSlew({ sampleRate, timeMs: 30 });
        const preDelaySlew = createSlew({ sampleRate, timeMs: 30 });
        const dampSlew = createSlew({ sampleRate, timeMs: 10 });
        const modDepthSlew = createSlew({ sampleRate, timeMs: 50 });
        const intervalRatioSlew = createSlew({ sampleRate, timeMs: 30 });
        const pitchShiftMorphSlew = createSlew({ sampleRate, timeMs: 30 });
        const shimmerSlew = createSlew({ sampleRate, timeMs: 20 });
        const mixSlew = createSlew({ sampleRate, timeMs: 5 });
        const routeSlew = createSlew({ sampleRate, timeMs: 50 });

        const freezeRampSamples = Math.max(1, Math.round(sampleRate * 0.01));
        const clearFadeSamples = Math.max(1, Math.round(sampleRate * 0.005));
        const dcPole = Math.exp(-2 * Math.PI * 80 / sampleRate);
        const ledCoefficient = 1 - Math.exp(-1 / (sampleRate * 0.05));

        let rightInputConnected = false;
        let freezeMorph = 0;
        let freezeTarget = 0;
        let lastEffectiveFreeze = false;
        let lastPanelClearHigh = false;
        let lastJackClearHigh = false;
        let clearStage = 0;
        let clearRemaining = 0;
        let clearGain = 1;
        let clearStartGain = 1;
        let clearCount = 0;
        let inputLedState = 0;
        let tailLedState = 0;
        let pitchLedState = 0;
        let lastDecay = DEFAULTS.decay;
        let lastDiffusion = DEFAULTS.diffusion;
        let lastModDepth = DEFAULTS.modDepth;
        let lastShimmerAmount = DEFAULTS.shimmer;
        let lastMix = DEFAULTS.mix;
        let lastRoute = DEFAULTS.route;
        let lastIntervalSemitones = DEFAULTS.interval;
        let lastPitchRatio = 2;
        let lastSizeScale = 1;
        let lastPreDelaySamples = 0;
        let lastDampCutoff = 0;
        let lastPitchFilteredL = 0;
        let maxFeedbackGain = 0;

        function sanitizeParams(dsp) {
            dsp.params.decay = normalizedParam(dsp.params.decay, DEFAULTS.decay);
            dsp.params.size = normalizedParam(dsp.params.size, DEFAULTS.size);
            dsp.params.diffusion = normalizedParam(dsp.params.diffusion, DEFAULTS.diffusion);
            dsp.params.preDelay = normalizedParam(dsp.params.preDelay, DEFAULTS.preDelay);
            dsp.params.damp = normalizedParam(dsp.params.damp, DEFAULTS.damp);
            dsp.params.modDepth = normalizedParam(dsp.params.modDepth, DEFAULTS.modDepth);
            dsp.params.interval = semitoneParam(dsp.params.interval, DEFAULTS.interval);
            dsp.params.shimmer = normalizedParam(dsp.params.shimmer, DEFAULTS.shimmer);
            dsp.params.mix = normalizedParam(dsp.params.mix, DEFAULTS.mix);
            dsp.params.route = binaryParam(dsp.params.route, DEFAULTS.route);
            dsp.params.freeze = binaryParam(dsp.params.freeze, DEFAULTS.freeze);
            dsp.params.clear = binaryParam(dsp.params.clear, DEFAULTS.clear);
        }

        function processDiffusers(value, buffers, indices, coefficient) {
            let output = value;
            for (let stage = 0; stage < 4; stage++) {
                const buffer = buffers[stage];
                const index = indices[stage];
                const delayed = buffer[index];
                const next = guardInternal(delayed - coefficient * output);
                buffer[index] = flushTiny(guardInternal(output + coefficient * next));
                output = next;
                indices[stage] = index + 1 === buffer.length ? 0 : index + 1;
            }
            return flushTiny(output);
        }

        function resetSmoothers(dsp) {
            sanitizeParams(dsp);
            decaySlew.reset(dsp.params.decay);
            sizeSlew.reset(dsp.params.size);
            diffusionSlew.reset(dsp.params.diffusion);
            preDelaySlew.reset(dsp.params.preDelay);
            dampSlew.reset(dsp.params.damp);
            modDepthSlew.reset(dsp.params.modDepth);
            const ratio = SHIMMER_INTERVAL_RATIOS[dsp.params.interval + 12];
            intervalRatioSlew.reset(ratio);
            pitchShiftMorphSlew.reset(dsp.params.interval === 0 ? 0 : 1);
            shimmerSlew.reset(dsp.params.shimmer);
            mixSlew.reset(dsp.params.mix);
            routeSlew.reset(dsp.params.route);
            lastDecay = dsp.params.decay;
            lastDiffusion = dsp.params.diffusion;
            lastModDepth = dsp.params.modDepth;
            lastShimmerAmount = dsp.params.shimmer;
            lastMix = dsp.params.mix;
            lastRoute = dsp.params.route;
            lastIntervalSemitones = dsp.params.interval;
            lastPitchRatio = ratio;
            lastSizeScale = Math.pow(2, dsp.params.size - 0.5);
            lastPreDelaySamples = 0.5 * dsp.params.preDelay * dsp.params.preDelay * sampleRate;
            lastDampCutoff = dampingCutoff(dsp.params.damp, sampleRate);
        }

        function clearDelayAndFilterState() {
            preDelayL.fill(0);
            preDelayR.fill(0);
            preDelayWrite = 0;
            clearTypedBuffers(diffuserBuffersL);
            clearTypedBuffers(diffuserBuffersR);
            diffuserIndicesL.fill(0);
            diffuserIndicesR.fill(0);
            clearTypedBuffers(fdnBuffers);
            fdnWriteIndices.fill(0);
            liveDelaySamples.fill(0);
            activeDelaySamples.fill(0);
            frozenDelaySamples.fill(0);
            fdnReadValues.fill(0);
            fdnFeedback.fill(0);
            highpassInput.fill(0);
            highpassOutput.fill(0);
            lowpassState.fill(0);
            feedbackGains.fill(0);
            pitchBufferL.fill(0);
            pitchBufferR.fill(0);
            pitchFilterL.fill(0);
            pitchFilterR.fill(0);
            pitchWrite = 0;
            pitchPhase = 0;
            lastPitchFilteredL = 0;
            for (let i = 0; i < 8; i++) modPhases[i] = i / 8;
            inputLedState = 0;
            tailLedState = 0;
            pitchLedState = 0;
            maxFeedbackGain = 0;
        }

        function setFreezeImmediately(dsp, gateHigh = false) {
            const effective = dsp.params.freeze >= 1 || gateHigh;
            freezeTarget = effective ? 1 : 0;
            freezeMorph = freezeTarget;
            lastEffectiveFreeze = effective;
            if (effective) {
                for (let i = 0; i < 8; i++) {
                    const fallback = nominalDelaySamples[i] * lastSizeScale;
                    frozenDelaySamples[i] = Math.round(activeDelaySamples[i] || fallback);
                }
            }
        }

        function bulkClear(dsp) {
            clearDelayAndFilterState();
            resetSmoothers(dsp);
            const gateHigh = finite(freezeGate[0]) >= 1;
            setFreezeImmediately(dsp, gateHigh);
            clearGain = 0;
            clearRemaining = clearFadeSamples;
            clearStage = 3;
            dsp.leds.input = 0;
            dsp.leds.tail = 0;
            dsp.leds.pitched = 0;
            dsp.leds.frozen = lastEffectiveFreeze ? 1 : 0;
        }

        function requestClear() {
            clearCount++;
            clearStartGain = clearGain;
            clearRemaining = clearFadeSamples;
            clearStage = 1;
        }

        function updateClearGainAfterSample() {
            if (clearStage === 1) {
                clearRemaining--;
                if (clearRemaining <= 0) {
                    clearGain = 0;
                    clearStage = 2;
                } else {
                    clearGain = clearStartGain * (clearRemaining / clearFadeSamples);
                }
            } else if (clearStage === 3) {
                clearRemaining--;
                if (clearRemaining <= 0) {
                    clearGain = 1;
                    clearStage = 0;
                } else {
                    clearGain = 1 - clearRemaining / clearFadeSamples;
                }
            }
        }

        function updateFreeze(effective) {
            const target = effective ? 1 : 0;
            if (target !== freezeTarget) {
                freezeTarget = target;
                if (target === 1) {
                    for (let i = 0; i < 8; i++) {
                        frozenDelaySamples[i] = Math.round(liveDelaySamples[i]);
                    }
                }
            }
            const step = 1 / freezeRampSamples;
            if (freezeMorph < freezeTarget) freezeMorph = Math.min(freezeTarget, freezeMorph + step);
            else if (freezeMorph > freezeTarget) freezeMorph = Math.max(freezeTarget, freezeMorph - step);
            lastEffectiveFreeze = effective;
        }

        function processPitch(sourceL, sourceR, ratio, shiftMorph, filterCoefficient) {
            let filteredL = sourceL;
            let filteredR = sourceR;
            for (let pole = 0; pole < 4; pole++) {
                pitchFilterL[pole] += filterCoefficient * (filteredL - pitchFilterL[pole]);
                pitchFilterR[pole] += filterCoefficient * (filteredR - pitchFilterR[pole]);
                pitchFilterL[pole] = flushTiny(pitchFilterL[pole]);
                pitchFilterR[pole] = flushTiny(pitchFilterR[pole]);
                filteredL = pitchFilterL[pole];
                filteredR = pitchFilterR[pole];
            }

            pitchBufferL[pitchWrite] = guardInternal(filteredL);
            pitchBufferR[pitchWrite] = guardInternal(filteredR);
            lastPitchFilteredL = filteredL;

            const phase0 = pitchPhase;
            const phase1 = wrapUnit(pitchPhase + 0.5);
            const delay0 = pitchMinDelaySamples + phase0 * pitchWindowSamples;
            const delay1 = pitchMinDelaySamples + phase1 * pitchWindowSamples;
            const window0 = 0.5 - 0.5 * lookupPeriodic(sineTable, phase0 + 0.25);
            const window1 = 1 - window0;
            const shiftedL = readPitchL(pitchWrite - delay0) * window0
                + readPitchL(pitchWrite - delay1) * window1;
            const shiftedR = readPitchR(pitchWrite - delay0) * window0
                + readPitchR(pitchWrite - delay1) * window1;

            pitchWrite++;
            if (pitchWrite === pitchBufferSize) pitchWrite = 0;
            pitchPhase = wrapUnit(pitchPhase + (1 - ratio) / pitchWindowSamples);

            pitchResult[0] = sourceL + (shiftedL - sourceL) * shiftMorph;
            pitchResult[1] = sourceR + (shiftedR - sourceR) * shiftMorph;
        }

        function calculateTankEnergy() {
            let total = 0;
            for (let line = 0; line < 8; line++) {
                const buffer = fdnBuffers[line];
                for (let i = 0; i < buffer.length; i++) total += buffer[i] * buffer[i];
            }
            return total;
        }

        function calculateStateEnergy() {
            let total = calculateTankEnergy();
            for (let i = 0; i < preDelayL.length; i++) {
                total += preDelayL[i] * preDelayL[i] + preDelayR[i] * preDelayR[i];
            }
            for (let stage = 0; stage < 4; stage++) {
                const left = diffuserBuffersL[stage];
                const right = diffuserBuffersR[stage];
                for (let i = 0; i < left.length; i++) total += left[i] * left[i];
                for (let i = 0; i < right.length; i++) total += right[i] * right[i];
                total += pitchFilterL[stage] * pitchFilterL[stage];
                total += pitchFilterR[stage] * pitchFilterR[stage];
            }
            for (let i = 0; i < pitchBufferL.length; i++) {
                total += pitchBufferL[i] * pitchBufferL[i] + pitchBufferR[i] * pitchBufferR[i];
            }
            for (let line = 0; line < 8; line++) {
                total += highpassInput[line] * highpassInput[line];
                total += highpassOutput[line] * highpassOutput[line];
                total += lowpassState[line] * lowpassState[line];
            }
            return total;
        }

        const dsp = {
            params: { ...DEFAULTS },

            inputs: {
                inL,
                inR,
                decayCV,
                dampCV,
                shimmerCV,
                intervalCV,
                mixCV,
                freezeGate,
                clearTrig
            },

            outputs: { outL, outR },

            leds: {
                input: 0,
                tail: 0,
                pitched: 0,
                frozen: 0
            },

            process() {
                sanitizeParams(this);
                if (clearStage === 2) bulkClear(this);

                const panelClearHigh = this.params.clear >= 1;
                const panelFreeze = this.params.freeze >= 1;

                for (let sample = 0; sample < bufferSize; sample++) {
                    const dryL = finiteAudio(inL[sample]);
                    const dryR = rightInputConnected ? finiteAudio(inR[sample]) : dryL;
                    const tankInputL = softLimitVoltage(dryL, 5);
                    const tankInputR = softLimitVoltage(dryR, 5);

                    const jackClearHigh = finite(clearTrig[sample]) >= 1;
                    const clearEdge = (panelClearHigh && !lastPanelClearHigh)
                        || (jackClearHigh && !lastJackClearHigh);
                    if (clearEdge) requestClear();
                    lastPanelClearHigh = panelClearHigh;
                    lastJackClearHigh = jackClearHigh;

                    const decayTarget = clamp(this.params.decay + finite(decayCV[sample]) / 5, 0, 1);
                    const dampTarget = clamp(this.params.damp + finite(dampCV[sample]) / 5, 0, 1);
                    const shimmerTarget = clamp(this.params.shimmer + finite(shimmerCV[sample]) / 5, 0, 1);
                    const mixTarget = clamp(this.params.mix + finite(mixCV[sample]) / 5, 0, 1);
                    const semitones = clamp(
                        Math.round(this.params.interval + finite(intervalCV[sample]) * 12 / 5),
                        -12,
                        12
                    );
                    const ratioTarget = SHIMMER_INTERVAL_RATIOS[semitones + 12];

                    const decay = decaySlew.process(decayTarget);
                    const size = sizeSlew.process(this.params.size);
                    const diffusion = diffusionSlew.process(this.params.diffusion);
                    const preDelay = preDelaySlew.process(this.params.preDelay);
                    const damp = dampSlew.process(dampTarget);
                    const modDepth = modDepthSlew.process(this.params.modDepth);
                    const ratio = intervalRatioSlew.process(ratioTarget);
                    const shiftMorph = pitchShiftMorphSlew.process(semitones === 0 ? 0 : 1);
                    const shimmerAmount = shimmerSlew.process(shimmerTarget);
                    const mix = mixSlew.process(mixTarget);
                    const route = routeSlew.process(this.params.route);

                    const sizeScale = Math.pow(2, size - 0.5);
                    const modulationSamples = modDepth * sampleRate * 0.00125;
                    for (let line = 0; line < 8; line++) {
                        liveDelaySamples[line] = clamp(
                            nominalDelaySamples[line] * sizeScale
                                + lookupPeriodic(sineTable, modPhases[line]) * modulationSamples,
                            2,
                            fdnBuffers[line].length - 2
                        );
                    }

                    const effectiveFreeze = panelFreeze || finite(freezeGate[sample]) >= 1;
                    updateFreeze(effectiveFreeze);
                    for (let line = 0; line < 8; line++) {
                        activeDelaySamples[line] = liveDelaySamples[line]
                            + (frozenDelaySamples[line] - liveDelaySamples[line]) * freezeMorph;
                    }

                    const inputGain = 1 - freezeMorph;
                    preDelayL[preDelayWrite] = tankInputL * inputGain;
                    preDelayR[preDelayWrite] = tankInputR * inputGain;
                    const delaySamples = clamp(0.5 * preDelay * preDelay * sampleRate, 0, maxPreDelaySamples);
                    const delayedL = readPreDelayL(preDelayWrite - delaySamples);
                    const delayedR = readPreDelayR(preDelayWrite - delaySamples);
                    preDelayWrite++;
                    if (preDelayWrite === preDelayL.length) preDelayWrite = 0;

                    const diffuserCoefficient = diffusion * 0.78;
                    const diffusedL = processDiffusers(delayedL, diffuserBuffersL, diffuserIndicesL, diffuserCoefficient);
                    const diffusedR = processDiffusers(delayedR, diffuserBuffersR, diffuserIndicesR, diffuserCoefficient);

                    for (let line = 0; line < 8; line++) {
                        const value = fdnReaders[line](fdnWriteIndices[line] - activeDelaySamples[line]);
                        fdnReadValues[line] = guardInternal(value);
                        fdnFeedback[line] = fdnReadValues[line];
                    }

                    const wetL = rowProjection(fdnReadValues, 1);
                    const wetR = rowProjection(fdnReadValues, 2);
                    const pitchSourceL = diffusedL + (wetL - diffusedL) * route;
                    const pitchSourceR = diffusedR + (wetR - diffusedR) * route;
                    const dampHz = dampingCutoff(damp, sampleRate);
                    const pitchCutoff = ratio > 1
                        ? Math.min(dampHz, sampleRate * 0.45 / ratio)
                        : dampHz;
                    processPitch(
                        pitchSourceL,
                        pitchSourceR,
                        ratio,
                        shiftMorph,
                        onePoleCoefficient(pitchCutoff, sampleRate)
                    );
                    const pitchedL = pitchResult[0];
                    const pitchedR = pitchResult[1];

                    const inputShimmer = shimmerAmount * (1 - route);
                    const inputNormalization = 1 / (1 + inputShimmer);
                    const injectionL = (diffusedL + inputShimmer * pitchedL) * inputNormalization * inputGain;
                    const injectionR = (diffusedR + inputShimmer * pitchedR) * inputNormalization * inputGain;

                    applyNormalizedHadamard8(fdnFeedback);
                    const regenAmount = shimmerAmount * route * (1 - freezeMorph);
                    const rt60 = 0.4 * Math.pow(75, decay);
                    const lowpassCoefficient = onePoleCoefficient(dampHz, sampleRate);
                    maxFeedbackGain = 0;
                    for (let line = 0; line < 8; line++) {
                        const pitchedFeedback = rowValue(3, line) * pitchedL
                            + rowValue(5, line) * pitchedR;
                        const blended = fdnFeedback[line]
                            + (pitchedFeedback - fdnFeedback[line]) * regenAmount;

                        const highpass = flushTiny(
                            blended - highpassInput[line] + dcPole * highpassOutput[line]
                        );
                        highpassInput[line] = blended;
                        highpassOutput[line] = highpass;
                        lowpassState[line] = flushTiny(
                            lowpassState[line] + lowpassCoefficient * (highpass - lowpassState[line])
                        );
                        const filtered = lowpassState[line]
                            + (blended - lowpassState[line]) * freezeMorph;
                        const delaySeconds = activeDelaySamples[line] / sampleRate;
                        const normalGain = Math.pow(10, -3 * delaySeconds / rt60);
                        const feedbackGain = normalGain + (1 - normalGain) * freezeMorph;
                        feedbackGains[line] = feedbackGain;
                        if (feedbackGain > maxFeedbackGain) maxFeedbackGain = feedbackGain;

                        const injection = rowValue(0, line) * injectionL
                            + rowValue(4, line) * injectionR;
                        const write = guardInternal(injection + filtered * feedbackGain);
                        const index = fdnWriteIndices[line];
                        fdnBuffers[line][index] = flushTiny(write);
                        fdnWriteIndices[line] = index + 1 === fdnBuffers[line].length ? 0 : index + 1;

                        modPhases[line] = wrapUnit(modPhases[line] + MOD_RATES_HZ[line] / sampleRate);
                    }

                    let dryGain;
                    let wetGain;
                    if (mix <= 0) {
                        dryGain = 1;
                        wetGain = 0;
                    } else if (mix >= 1) {
                        dryGain = 0;
                        wetGain = 1;
                    } else {
                        dryGain = Math.cos(mix * Math.PI * 0.5);
                        wetGain = Math.sin(mix * Math.PI * 0.5);
                    }
                    const mixedL = guardInternal(dryL * dryGain + wetL * wetGain * clearGain);
                    const mixedR = guardInternal(dryR * dryGain + wetR * wetGain * clearGain);
                    outL[sample] = softLimitVoltage(mixedL, 5);
                    outR[sample] = softLimitVoltage(mixedR, 5);

                    const inputActivity = clamp(Math.max(Math.abs(tankInputL), Math.abs(tankInputR)) / 5, 0, 1);
                    const tailActivity = clamp(Math.max(Math.abs(wetL), Math.abs(wetR)) / 5, 0, 1);
                    const pitchActivity = clamp(Math.max(Math.abs(pitchedL), Math.abs(pitchedR)) / 5, 0, 1);
                    inputLedState += ledCoefficient * (inputActivity - inputLedState);
                    tailLedState += ledCoefficient * (tailActivity - tailLedState);
                    pitchLedState += ledCoefficient * (pitchActivity - pitchLedState);
                    if (inputLedState < 1e-12) inputLedState = 0;
                    if (tailLedState < 1e-12) tailLedState = 0;
                    if (pitchLedState < 1e-12) pitchLedState = 0;

                    lastShimmerAmount = shimmerAmount;
                    lastDecay = decay;
                    lastDiffusion = diffusion;
                    lastModDepth = modDepth;
                    lastMix = mix;
                    lastRoute = route;
                    lastIntervalSemitones = semitones;
                    lastPitchRatio = ratio;
                    lastSizeScale = sizeScale;
                    lastPreDelaySamples = delaySamples;
                    lastDampCutoff = dampHz;
                    updateClearGainAfterSample();
                }

                this.leds.input = clamp(finite(inputLedState), 0, 1);
                this.leds.tail = clamp(finite(tailLedState), 0, 1);
                this.leds.pitched = clamp(finite(pitchLedState * lastShimmerAmount), 0, 1);
                this.leds.frozen = lastEffectiveFreeze ? 1 : 0;
            },

            onInputConnected(port) {
                if (port === 'inR') rightInputConnected = true;
            },

            onInputDisconnected(port) {
                if (port === 'inR') rightInputConnected = false;
            },

            reset() {
                sanitizeParams(this);
                clearDelayAndFilterState();
                resetSmoothers(this);
                freezeGate.fill(0);
                setFreezeImmediately(this, false);
                lastPanelClearHigh = false;
                lastJackClearHigh = false;
                clearStage = 0;
                clearRemaining = 0;
                clearGain = 1;
                clearStartGain = 1;
                clearCount = 0;
                this.params.clear = 0;
                inL.fill(0);
                inR.fill(0);
                decayCV.fill(0);
                dampCV.fill(0);
                shimmerCV.fill(0);
                intervalCV.fill(0);
                mixCV.fill(0);
                clearTrig.fill(0);
                outL.fill(0);
                outR.fill(0);
                this.leds.input = 0;
                this.leds.tail = 0;
                this.leds.pitched = 0;
                this.leds.frozen = this.params.freeze >= 1 ? 1 : 0;
            },

            getDebugState() {
                return {
                    allocatedDelayBytes,
                    tankEnergy: calculateTankEnergy(),
                    stateEnergy: calculateStateEnergy(),
                    clearCount,
                    clearStage,
                    clearGain,
                    freezeMorph,
                    decay: lastDecay,
                    diffusion: lastDiffusion,
                    modDepth: lastModDepth,
                    shimmer: lastShimmerAmount,
                    mix: lastMix,
                    route: lastRoute,
                    sizeScale: lastSizeScale,
                    preDelaySamples: lastPreDelaySamples,
                    intervalSemitones: lastIntervalSemitones,
                    pitchRatio: lastPitchRatio,
                    dampCutoff: lastDampCutoff,
                    maxFeedbackGain,
                    activeDelaySamples: Array.from(activeDelaySamples),
                    feedbackGains: Array.from(feedbackGains)
                };
            },

            processPitchProbe(sampleValue, semitones) {
                const interval = clamp(Math.round(finite(semitones, 0)), -12, 12);
                const ratio = SHIMMER_INTERVAL_RATIOS[interval + 12];
                const dampHz = dampingCutoff(this.params.damp, sampleRate);
                const pitchCutoff = ratio > 1
                    ? Math.min(dampHz, sampleRate * 0.45 / ratio)
                    : dampHz;
                const sample = finiteAudio(sampleValue);
                processPitch(
                    sample,
                    sample,
                    ratio,
                    interval === 0 ? 0 : 1,
                    onePoleCoefficient(pitchCutoff, sampleRate)
                );
                return pitchResult[0];
            },

            getPitchFilterSample() {
                return lastPitchFilteredL;
            }
        };

        resetSmoothers(dsp);
        setFreezeImmediately(dsp, false);
        return dsp;
    },

    ui: {
        leds: ['input', 'tail', 'pitched', 'frozen'],
        knobs: [
            { id: 'decay', label: 'DECAY', param: 'decay', min: 0, max: 1, default: 0.55 },
            { id: 'size', label: 'SIZE', param: 'size', min: 0, max: 1, default: 0.5 },
            { id: 'diffusion', label: 'DIFF', param: 'diffusion', min: 0, max: 1, default: 0.75 },
            { id: 'preDelay', label: 'PRE', param: 'preDelay', min: 0, max: 1, default: 0.15 },
            { id: 'damp', label: 'DAMP', param: 'damp', min: 0, max: 1, default: 0.35 },
            { id: 'modDepth', label: 'MOD', param: 'modDepth', min: 0, max: 1, default: 0.25 },
            { id: 'interval', label: 'INT', param: 'interval', min: -12, max: 12, step: 1, default: 12 },
            { id: 'shimmer', label: 'SHIM', param: 'shimmer', min: 0, max: 1, default: 0.35 },
            { id: 'mix', label: 'MIX', param: 'mix', min: 0, max: 1, default: 0.35 }
        ],
        switches: [
            {
                id: 'route',
                label: 'ROUTE',
                param: 'route',
                positions: ['INPUT', 'REGEN'],
                default: 1
            }
        ],
        actions: [
            { id: 'freeze', label: 'FREEZE', param: 'freeze', mode: 'toggle', default: 0 },
            { id: 'clear', label: 'CLEAR', param: 'clear', mode: 'trigger', default: 0 }
        ],
        inputs: [
            { id: 'inL', label: 'IN L', port: 'inL', signal: 'audio', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'inR', label: 'IN R', port: 'inR', signal: 'audio', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'decayCV', label: 'DECAY', port: 'decayCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'dampCV', label: 'DAMP', port: 'dampCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'shimmerCV', label: 'SHIM', port: 'shimmerCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'intervalCV', label: 'INT', port: 'intervalCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'mixCV', label: 'MIX', port: 'mixCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'freezeGate', label: 'FREEZE', port: 'freezeGate', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'clearTrig', label: 'CLEAR', port: 'clearTrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'outL', label: 'OUT L', port: 'outL', signal: 'audio', voltage: { min: -5, max: 5 } },
            { id: 'outR', label: 'OUT R', port: 'outR', signal: 'audio', voltage: { min: -5, max: 5 } }
        ],
        socketLayout: {
            label: 'STEREO / CV',
            columns: [
                { label: 'AUDIO', columns: 2, ports: ['inL', 'inR', 'outL', 'outR'] },
                { label: 'SPACE', columns: 2, ports: ['decayCV', 'dampCV', 'freezeGate'] },
                { label: 'PITCH', columns: 2, ports: ['shimmerCV', 'intervalCV', 'clearTrig'] },
                { label: 'MIX', ports: ['mixCV'] }
            ]
        }
    }
};
