import { createSlew } from '../../utils/slew.js';

const C4_HZ = 261.6255653005986;
const FAST_MIN_HZ = 82.4068892282175;
const LOW_MIN_HZ = 41.20344461410875;
const MAX_HZ = 2093.004522404789;
const RANGE_MARGIN = 0.02;
const YIN_THRESHOLD = 0.15;
const ANALYSIS_TARGET_RATE = 16000;
const ANALYSIS_HOP = 128;
const RING_LENGTH = 1024;

function finiteClamp(value, minimum, maximum, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, value));
}

export function pitchTrackLevelThreshold(level) {
    const normalized = finiteClamp(level, 0, 1, 0.5);
    return 0.01 * Math.pow(100, normalized);
}

export function pitchTrackNextInvalidCount(currentCount, valid) {
    if (valid) return 0;
    return currentCount >= 1 ? 2 : 1;
}

export function createPitchTrackAnalysisPlan(sampleRate, range = 0) {
    const safeSampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100;
    const lowRange = Number.isFinite(range) && range >= 0.5;
    const decimationFactor = Math.max(1, Math.round(safeSampleRate / ANALYSIS_TARGET_RATE));
    const analysisRate = safeSampleRate / decimationFactor;
    const frameLength = lowRange ? 1024 : 512;
    const minimumFrequency = lowRange ? LOW_MIN_HZ : FAST_MIN_HZ;
    const minLag = Math.max(2, Math.floor(analysisRate / (MAX_HZ * (1 + RANGE_MARGIN))));
    const maxLag = Math.min(
        frameLength - 2,
        Math.ceil(analysisRate / (minimumFrequency * (1 - RANGE_MARGIN)))
    );
    const comparisonLength = frameLength - maxLag;
    const lagsPerAnalysisSample = Math.ceil(maxLag / ANALYSIS_HOP);

    return {
        decimationFactor,
        analysisRate,
        frameLength,
        hop: ANALYSIS_HOP,
        minimumFrequency,
        maximumFrequency: MAX_HZ,
        minLag,
        maxLag,
        comparisonLength,
        lagsPerAnalysisSample,
        pairEvaluations: maxLag * comparisonLength,
        comparisonsPerTick: lagsPerAnalysisSample * comparisonLength
    };
}

function createLowPassCoefficients(sampleRate) {
    const cutoff = 3000;
    const q = 1 / Math.sqrt(2);
    const omega = 2 * Math.PI * cutoff / sampleRate;
    const cosine = Math.cos(omega);
    const sine = Math.sin(omega);
    const alpha = sine / (2 * q);
    const a0 = 1 + alpha;

    return {
        b0: (1 - cosine) * 0.5 / a0,
        b1: (1 - cosine) / a0,
        b2: (1 - cosine) * 0.5 / a0,
        a1: -2 * cosine / a0,
        a2: (1 - alpha) / a0
    };
}

export default {
    id: 'pitch-track',
    name: 'PITCH TRACK',
    hp: 6,
    color: 'module-color-twelve',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const safeSampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100;
        const safeBufferSize = Number.isInteger(bufferSize) && bufferSize > 0 ? bufferSize : 512;
        const audio = new Float32Array(safeBufferSize);
        const pitch = new Float32Array(safeBufferSize);
        const gate = new Float32Array(safeBufferSize);

        const fastPlan = createPitchTrackAnalysisPlan(safeSampleRate, 0);
        const lowPlan = createPitchTrackAnalysisPlan(safeSampleRate, 1);
        const coefficients = createLowPassCoefficients(safeSampleRate);
        const ring = new Float64Array(RING_LENGTH);
        const frame = new Float64Array(RING_LENGTH);
        const difference = new Float64Array(RING_LENGTH);
        const cmndf = new Float64Array(RING_LENGTH);
        const slew = createSlew({ sampleRate: safeSampleRate, timeMs: 15 });

        const attackCoefficient = 1 - Math.exp(-1 / (safeSampleRate * 0.001));
        const releaseCoefficient = 1 - Math.exp(-1 / (safeSampleRate * 0.020));

        let filterOneZ1 = 0;
        let filterOneZ2 = 0;
        let filterTwoZ1 = 0;
        let filterTwoZ2 = 0;
        let envelope = 0;
        let levelOpen = false;
        let selectedRange = 0;
        let decimationPhase = 0;
        let ringWrite = 0;
        let ringFill = 0;
        let jobActive = false;
        let nextLag = 1;
        let hopCounter = 0;
        let hasSubmittedFrame = false;
        let invalidResults = 0;
        let targetPitch = 0;
        let outputPitch = 0;
        let gateVoltage = 0;

        function clearAnalysis() {
            ring.fill(0);
            frame.fill(0);
            difference.fill(0);
            cmndf.fill(0);
            ringWrite = 0;
            ringFill = 0;
            jobActive = false;
            nextLag = 1;
            hopCounter = 0;
            hasSubmittedFrame = false;
            invalidResults = 0;
        }

        function beginFrame(plan) {
            let source = ringWrite - plan.frameLength;
            if (source < 0) source += RING_LENGTH;
            for (let index = 0; index < plan.frameLength; index++) {
                frame[index] = ring[source];
                source++;
                if (source === RING_LENGTH) source = 0;
            }
            difference.fill(0);
            cmndf.fill(0);
            jobActive = true;
            nextLag = 1;
            hopCounter = 0;
            hasSubmittedFrame = true;
        }

        function finishFrame(plan) {
            cmndf[0] = 1;
            let runningSum = 0;
            for (let lag = 1; lag <= plan.maxLag; lag++) {
                runningSum += difference[lag];
                cmndf[lag] = runningSum > 0
                    ? difference[lag] * lag / runningSum
                    : 1;
            }

            let selectedLag = -1;
            if (runningSum > 0) {
                for (let lag = plan.minLag; lag < plan.maxLag; lag++) {
                    if (cmndf[lag] < YIN_THRESHOLD) {
                        selectedLag = lag;
                        while (
                            selectedLag < plan.maxLag - 1
                            && cmndf[selectedLag + 1] < cmndf[selectedLag]
                        ) {
                            selectedLag++;
                        }
                        break;
                    }
                }
            }

            let valid = selectedLag >= plan.minLag && selectedLag <= plan.maxLag;
            let estimatedFrequency = 0;
            if (valid) {
                let offset = 0;
                if (selectedLag > 0 && selectedLag < plan.maxLag) {
                    const left = cmndf[selectedLag - 1];
                    const center = cmndf[selectedLag];
                    const right = cmndf[selectedLag + 1];
                    const denominator = left - 2 * center + right;
                    if (Number.isFinite(denominator) && Math.abs(denominator) > 1e-15) {
                        offset = 0.5 * (left - right) / denominator;
                        if (offset < -0.5) offset = -0.5;
                        else if (offset > 0.5) offset = 0.5;
                    }
                }
                const refinedLag = selectedLag + offset;
                estimatedFrequency = plan.analysisRate / refinedLag;
                valid = Number.isFinite(estimatedFrequency)
                    && estimatedFrequency >= plan.minimumFrequency * (1 - RANGE_MARGIN)
                    && estimatedFrequency <= plan.maximumFrequency * (1 + RANGE_MARGIN);
            }

            if (valid) {
                if (estimatedFrequency < plan.minimumFrequency) {
                    estimatedFrequency = plan.minimumFrequency;
                } else if (estimatedFrequency > plan.maximumFrequency) {
                    estimatedFrequency = plan.maximumFrequency;
                }
                targetPitch = Math.log2(estimatedFrequency / C4_HZ);
                invalidResults = pitchTrackNextInvalidCount(invalidResults, true);
                gateVoltage = 10;
            } else {
                invalidResults = pitchTrackNextInvalidCount(invalidResults, false);
                if (invalidResults >= 2) gateVoltage = 0;
            }

            jobActive = false;
            nextLag = 1;
        }

        function runAnalysisRows(plan) {
            let rows = plan.lagsPerAnalysisSample;
            while (rows > 0 && nextLag <= plan.maxLag) {
                let sum = 0;
                const lag = nextLag;
                for (let index = 0; index < plan.comparisonLength; index++) {
                    const delta = frame[index] - frame[index + lag];
                    sum += delta * delta;
                }
                difference[lag] = sum;
                nextLag++;
                rows--;
            }
            if (nextLag > plan.maxLag) finishFrame(plan);
        }

        const dsp = {
            params: { level: 0.5, smooth: 15, range: 0 },
            inputs: { audio },
            outputs: { pitch, gate },
            leds: { signal: 0, lock: 0 },

            process() {
                const levelThreshold = pitchTrackLevelThreshold(this.params.level);
                const closeThreshold = levelThreshold * 0.7;
                const smooth = finiteClamp(this.params.smooth, 0, 250, 15);
                const requestedRange = Number.isFinite(this.params.range)
                    && this.params.range >= 0.5 ? 1 : 0;
                const plan = requestedRange === 1 ? lowPlan : fastPlan;

                if (requestedRange !== selectedRange) {
                    selectedRange = requestedRange;
                    clearAnalysis();
                    gateVoltage = 0;
                }
                if (smooth > 0) slew.timeMs = smooth;

                for (let index = 0; index < safeBufferSize; index++) {
                    let inputSample = audio[index];
                    if (!Number.isFinite(inputSample)) inputSample = 0;
                    else if (inputSample > 5) inputSample = 5;
                    else if (inputSample < -5) inputSample = -5;

                    const magnitude = Math.abs(inputSample);
                    const envelopeCoefficient = magnitude > envelope
                        ? attackCoefficient
                        : releaseCoefficient;
                    envelope += envelopeCoefficient * (magnitude - envelope);

                    let filtered = coefficients.b0 * inputSample + filterOneZ1;
                    filterOneZ1 = coefficients.b1 * inputSample
                        - coefficients.a1 * filtered + filterOneZ2;
                    filterOneZ2 = coefficients.b2 * inputSample - coefficients.a2 * filtered;
                    const firstStage = filtered;
                    filtered = coefficients.b0 * firstStage + filterTwoZ1;
                    filterTwoZ1 = coefficients.b1 * firstStage
                        - coefficients.a1 * filtered + filterTwoZ2;
                    filterTwoZ2 = coefficients.b2 * firstStage - coefficients.a2 * filtered;

                    decimationPhase++;
                    let analysisTick = false;
                    if (decimationPhase >= plan.decimationFactor) {
                        decimationPhase = 0;
                        analysisTick = true;
                    }

                    if (!levelOpen && envelope >= levelThreshold) {
                        levelOpen = true;
                        clearAnalysis();
                    } else if (levelOpen && envelope < closeThreshold) {
                        levelOpen = false;
                        clearAnalysis();
                        gateVoltage = 0;
                    }

                    if (levelOpen && analysisTick) {
                        // Canonicalize to the rack's Float32 signal precision.
                        // This also makes a settled DC frame exactly constant,
                        // preserving YIN's literal runningSum > 0 rejection rule.
                        ring[ringWrite] = Math.fround(filtered);
                        ringWrite++;
                        if (ringWrite === RING_LENGTH) ringWrite = 0;
                        if (ringFill < RING_LENGTH) ringFill++;

                        if (hasSubmittedFrame) hopCounter++;
                        if (jobActive) {
                            runAnalysisRows(plan);
                        } else {
                            if (
                                ringFill >= plan.frameLength
                                && (!hasSubmittedFrame || hopCounter >= plan.hop)
                            ) {
                                beginFrame(plan);
                                runAnalysisRows(plan);
                            }
                        }
                    }

                    if (smooth <= 0) {
                        outputPitch = targetPitch;
                        slew.reset(outputPitch);
                    } else {
                        outputPitch = slew.process(targetPitch);
                    }
                    pitch[index] = outputPitch;
                    gate[index] = gateVoltage;
                }

                this.leds.signal = Math.min(1, Math.max(0, envelope / (2 * levelThreshold)));
                this.leds.lock = gateVoltage === 10 ? 1 : 0;
            },

            reset() {
                audio.fill(0);
                pitch.fill(0);
                gate.fill(0);
                clearAnalysis();
                filterOneZ1 = 0;
                filterOneZ2 = 0;
                filterTwoZ1 = 0;
                filterTwoZ2 = 0;
                envelope = 0;
                levelOpen = false;
                selectedRange = Number.isFinite(this.params.range) && this.params.range >= 0.5 ? 1 : 0;
                decimationPhase = 0;
                targetPitch = 0;
                outputPitch = 0;
                gateVoltage = 0;
                slew.reset(0);
                this.leds.signal = 0;
                this.leds.lock = 0;
            }
        };

        return dsp;
    },

    ui: {
        leds: ['signal', 'lock'],
        knobs: [
            { id: 'level', label: 'MIN LEVEL', param: 'level', min: 0, max: 1, default: 0.5 },
            { id: 'smooth', label: 'SMOOTH', param: 'smooth', min: 0, max: 250, default: 15 }
        ],
        switches: [
            {
                id: 'range', label: 'FAST / LOW', param: 'range',
                positions: ['FAST', 'LOW'], default: 0
            }
        ],
        inputs: [
            {
                id: 'audio', label: 'IN', port: 'audio', signal: 'audio',
                voltage: { min: -5, max: 5, normal: 0 }
            }
        ],
        outputs: [
            {
                id: 'pitch', label: 'PITCH', port: 'pitch', signal: 'cv',
                voltage: { min: -8 / 3, max: 3 }
            },
            {
                id: 'gate', label: 'GATE', port: 'gate', signal: 'gate',
                voltage: { min: 0, max: 10 }
            }
        ]
    }
};
