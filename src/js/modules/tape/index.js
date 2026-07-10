/**
 * TAPE - Tape-style delay
 *
 * Inspired-by mono tape echo with record saturation, multi-head reads,
 * wow/flutter, crinkle/dropouts, tap timing, clock output, and freeze.
 */

import { clamp, expMap } from '../../utils/math.js';

const MIN_DELAY_MS = 50;
const MAX_DELAY_MS = 2500;
const MAX_BUFFER_SECONDS = 4;
const TAP_THRESHOLD = 2.5;
const FREEZE_THRESHOLD = 1;
const OUTPUT_LIMIT = 5;
const CLOCK_HIGH = 10;
const TWO_PI = Math.PI * 2;
const PRNG_SEED = 0x51f15eED;

const HEAD_CONFIGS = [
    {
        ratios: [1],
        gains: [1]
    },
    {
        ratios: [0.25, 0.5, 0.75, 1],
        gains: [0.35, 0.45, 0.65, 1]
    },
    {
        ratios: [1 / 6, 1 / 3, 2 / 3, 1],
        gains: [0.35, 0.5, 0.75, 1]
    }
].map(config => {
    const sum = config.gains.reduce((total, value) => total + value, 0);
    return {
        ratios: config.ratios,
        gains: config.gains.map(value => value / sum)
    };
});

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function clampFinite(value, lo = 0, hi = 1, fallback = 0) {
    return clamp(finite(value, fallback), lo, hi);
}

function onePoleCoeff(cutoffHz, sampleRate) {
    const cutoff = clamp(finite(cutoffHz), 1, sampleRate * 0.45);
    return clamp(1 - Math.exp(-TWO_PI * cutoff / sampleRate), 0, 1);
}

function highpassAlpha(cutoffHz, sampleRate) {
    const cutoff = clamp(finite(cutoffHz), 1, sampleRate * 0.45);
    return clamp(Math.exp(-TWO_PI * cutoff / sampleRate), 0, 1);
}

function outputLimit(value) {
    if (!Number.isFinite(value)) return 0;
    return clamp(value, -OUTPUT_LIMIT, OUTPUT_LIMIT);
}

function softSaturateVolts(value, driveAmount) {
    const input = finite(value);
    const drive = clampFinite(driveAmount);
    const gain = 1 + drive * 8;
    const driven = Math.tanh((input / OUTPUT_LIMIT) * gain) / Math.tanh(gain) * OUTPUT_LIMIT;

    return input * (1 - drive * 0.35) + driven * drive * 0.35;
}

function feedbackSaturate(value) {
    return Math.tanh(finite(value) / OUTPUT_LIMIT * 1.5) / Math.tanh(1.5) * OUTPUT_LIMIT;
}

function delayMsFromNorm(norm) {
    return expMap(clampFinite(norm), MIN_DELAY_MS, MAX_DELAY_MS);
}

function headModeFromParam(value) {
    return Math.round(clampFinite(value, 0, 2, 1));
}

export default {
    id: 'tape',
    name: 'TAPE',
    hp: 10,
    color: 'module-color-three',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const clock = new Float32Array(bufferSize);

        const ownAudio = new Float32Array(bufferSize);
        const ownTimeCV = new Float32Array(bufferSize);
        const ownSpeedCV = new Float32Array(bufferSize);
        const ownFeedbackCV = new Float32Array(bufferSize);
        const ownMixCV = new Float32Array(bufferSize);
        const ownTap = new Float32Array(bufferSize);
        const ownFreezeGate = new Float32Array(bufferSize);

        const inputs = {
            audio: ownAudio,
            timeCV: ownTimeCV,
            speedCV: ownSpeedCV,
            feedbackCV: ownFeedbackCV,
            mixCV: ownMixCV,
            tap: ownTap,
            freezeGate: ownFreezeGate
        };

        const leds = {
            level: 0,
            freeze: 0,
            clock: 0,
            dropout: 0
        };

        const delayBufferSize = Math.ceil(sampleRate * MAX_BUFFER_SECONDS) + 4;
        const maxDelaySamples = delayBufferSize - 4;
        const minNominalDelaySamples = MIN_DELAY_MS * sampleRate / 1000;
        const maxNominalDelaySamples = MAX_DELAY_MS * sampleRate / 1000;
        const tapDebounceSamples = Math.max(1, Math.floor(sampleRate * 0.01));
        const clockPulseSamples = Math.max(1, Math.floor(sampleRate * 0.005));

        const delayBuffer = new Float32Array(delayBufferSize);

        let writeIndex = 0;
        let hpInputState = 0;
        let hpOutputState = 0;
        let lpState = 0;
        let wowPhase = 0;
        let flutterPhase = 0;
        let crinkleNoise = 0;
        let dropoutSamples = 0;
        let dropoutTotalSamples = 1;
        let dropoutDepth = 0;
        let dropoutCountdown = Math.max(1, Math.floor(sampleRate * 0.05));
        let randomState = PRNG_SEED;
        let sampleCounter = 0;
        let lastTapHigh = false;
        let lastTapEdgeSample = -Infinity;
        let lastTapSample = null;
        let tappedDelayMs = null;
        let clockPhaseSamples = 0;
        let clockPulseRemaining = 0;

        function random() {
            randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
            return randomState / 0x100000000;
        }

        function wrapIndex(index) {
            let wrapped = index % delayBufferSize;
            if (wrapped < 0) wrapped += delayBufferSize;
            return wrapped;
        }

        function readInterpolated(delaySamples) {
            const readIndex = writeIndex - delaySamples;
            const idx0Raw = Math.floor(readIndex);
            const frac = readIndex - idx0Raw;
            const idx0 = wrapIndex(idx0Raw);
            const idx1 = wrapIndex(idx0Raw + 1);

            return delayBuffer[idx0] * (1 - frac) + delayBuffer[idx1] * frac;
        }

        function clearInputBuffers() {
            ownAudio.fill(0);
            ownTimeCV.fill(0);
            ownSpeedCV.fill(0);
            ownFeedbackCV.fill(0);
            ownMixCV.fill(0);
            ownTap.fill(0);
            ownFreezeGate.fill(0);
        }

        function clearState() {
            writeIndex = 0;
            hpInputState = 0;
            hpOutputState = 0;
            lpState = 0;
            wowPhase = 0;
            flutterPhase = 0;
            crinkleNoise = 0;
            dropoutSamples = 0;
            dropoutTotalSamples = 1;
            dropoutDepth = 0;
            dropoutCountdown = Math.max(1, Math.floor(sampleRate * 0.05));
            randomState = PRNG_SEED;
            sampleCounter = 0;
            lastTapHigh = false;
            lastTapEdgeSample = -Infinity;
            lastTapSample = null;
            tappedDelayMs = null;
            clockPhaseSamples = 0;
            clockPulseRemaining = 0;
        }

        function processTone(input, age, lowCut) {
            const hpCutoff = 20 * Math.pow(1000 / 20, clampFinite(lowCut));
            const lpCutoff = 18000 * Math.pow(1200 / 18000, clampFinite(age));
            const hpAlpha = highpassAlpha(hpCutoff, sampleRate);
            const lpCoeff = onePoleCoeff(lpCutoff, sampleRate);

            const highpassed = hpAlpha * (hpOutputState + input - hpInputState);
            hpInputState = input;
            hpOutputState = highpassed;
            lpState += lpCoeff * (highpassed - lpState);

            return lpState;
        }

        function updateCrinkle(crinkle) {
            const amount = clampFinite(crinkle);

            if (amount <= 0) {
                crinkleNoise *= 0.995;
                return { wetGain: 1, dropout: 0, jitter: 0 };
            }

            const jitterTarget = random() * 2 - 1;
            const jitterCoeff = 0.002 + amount * 0.018;
            crinkleNoise += jitterCoeff * (jitterTarget - crinkleNoise);

            if (dropoutSamples > 0) {
                dropoutSamples--;
            } else {
                dropoutDepth = 0;
                dropoutTotalSamples = 1;
                dropoutCountdown--;

                if (dropoutCountdown <= 0) {
                    if (amount > 0.1) {
                        dropoutTotalSamples = Math.max(1, Math.floor((0.01 + random() * 0.07) * sampleRate));
                        dropoutSamples = dropoutTotalSamples;
                        dropoutDepth = clamp((0.12 + random() * 0.72) * amount, 0, 0.95);
                        dropoutCountdown = Math.max(
                            1,
                            Math.floor((0.03 + (1 - amount) * 0.55 + random() * 0.08) * sampleRate)
                        );
                    } else {
                        dropoutCountdown = Math.max(1, Math.floor((0.45 + random() * 0.5) * sampleRate));
                    }
                }
            }

            if (dropoutSamples <= 0) {
                return { wetGain: 1, dropout: 0, jitter: crinkleNoise };
            }

            const progress = 1 - dropoutSamples / dropoutTotalSamples;
            const edge = Math.sin(Math.PI * clamp(progress, 0, 1));
            const dropout = dropoutDepth * (0.35 + edge * 0.65);

            return {
                wetGain: clamp(1 - dropout, 0.05, 1),
                dropout,
                jitter: crinkleNoise
            };
        }

        function maybeUpdateTap(tapValue) {
            const high = finite(tapValue) > TAP_THRESHOLD;
            const now = sampleCounter;

            if (high && !lastTapHigh && now - lastTapEdgeSample >= tapDebounceSamples) {
                if (lastTapSample !== null) {
                    const intervalSamples = now - lastTapSample;
                    const intervalMs = intervalSamples * 1000 / sampleRate;
                    tappedDelayMs = clamp(intervalMs, MIN_DELAY_MS, MAX_DELAY_MS);
                }

                lastTapSample = now;
                lastTapEdgeSample = now;
            }

            lastTapHigh = high;
        }

        function baseDelayMs(time, timeCV) {
            if (tappedDelayMs !== null) return tappedDelayMs;
            return delayMsFromNorm(clampFinite(time + finite(timeCV) / 10));
        }

        function nextClockSample(periodSamples) {
            clockPhaseSamples += 1;
            if (clockPhaseSamples >= periodSamples) {
                clockPhaseSamples -= periodSamples;
                clockPulseRemaining = clockPulseSamples;
            }

            const value = clockPulseRemaining > 0 ? CLOCK_HIGH : 0;
            if (clockPulseRemaining > 0) clockPulseRemaining--;
            return value;
        }

        return {
            params: {
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
            },

            inputs,
            outputs: { out, clock },
            leds,

            process() {
                const audio = this.inputs.audio;
                const timeCV = this.inputs.timeCV;
                const speedCV = this.inputs.speedCV;
                const feedbackCV = this.inputs.feedbackCV;
                const mixCV = this.inputs.mixCV;
                const tap = this.inputs.tap;
                const freezeGate = this.inputs.freezeGate;

                const drive = clampFinite(this.params.drive);
                const age = clampFinite(this.params.age);
                const lowCut = clampFinite(this.params.lowCut);
                const wow = clampFinite(this.params.wow);
                const crinkle = clampFinite(this.params.crinkle);
                const headMode = headModeFromParam(this.params.headMode);
                const headConfig = HEAD_CONFIGS[headMode];

                let peak = 0;
                let lastDropout = 0;
                let lastFreeze = 0;
                let lastClock = 0;

                for (let i = 0; i < bufferSize; i++) {
                    maybeUpdateTap(tap[i]);

                    const delayMs = baseDelayMs(this.params.time, timeCV[i]);
                    const speedRatio = Math.pow(2, clamp(finite(speedCV[i]), -3, 3));
                    const head4Delay = clamp(delayMs * sampleRate / 1000 / speedRatio, 1, maxDelaySamples);
                    const feedback = clamp(this.params.feedback + finite(feedbackCV[i]) / 10, 0, 0.98);
                    const mix = clamp(this.params.mix + finite(mixCV[i]) / 10, 0, 1);
                    const freezeActive = this.params.freeze === 1 || finite(freezeGate[i]) >= FREEZE_THRESHOLD;
                    const crinkleState = updateCrinkle(crinkle);

                    const wowDepth = Math.min(head4Delay * 0.025, sampleRate * 0.025) * wow +
                        crinkle * sampleRate * 0.0015;
                    const wowOffset = wowDepth * (
                        Math.sin(wowPhase) * 0.65 +
                        Math.sin(flutterPhase) * 0.25 +
                        crinkleState.jitter * 0.10
                    );

                    let wet = 0;
                    for (let head = 0; head < headConfig.ratios.length; head++) {
                        const headDelay = clamp(head4Delay * headConfig.ratios[head] + wowOffset, 1, maxDelaySamples);
                        wet += readInterpolated(headDelay) * headConfig.gains[head];
                    }

                    wet *= crinkleState.wetGain;
                    const tonedWet = processTone(wet, age, lowCut);
                    const input = finite(audio[i]);
                    const record = softSaturateVolts(input, drive);
                    const hissAmount = Math.max(0, age - 0.5) * Math.max(0, crinkle - 0.2) * 0.015;
                    const hiss = hissAmount > 0 ? (random() * 2 - 1) * hissAmount : 0;

                    if (!freezeActive) {
                        delayBuffer[writeIndex] = outputLimit(record + feedbackSaturate(tonedWet) * feedback + hiss);
                    }

                    const mixed = outputLimit(input * (1 - mix) + tonedWet * mix);
                    out[i] = mixed;

                    const clockValue = nextClockSample(head4Delay);
                    clock[i] = clockValue;

                    writeIndex = (writeIndex + 1) % delayBufferSize;
                    wowPhase += TWO_PI * (0.18 + wow * 0.32) / sampleRate;
                    flutterPhase += TWO_PI * (5.2 + wow * 2.1) / sampleRate;
                    if (wowPhase >= TWO_PI) wowPhase -= TWO_PI;
                    if (flutterPhase >= TWO_PI) flutterPhase -= TWO_PI;
                    sampleCounter++;

                    peak = Math.max(peak, Math.abs(mixed));
                    lastDropout = crinkleState.dropout;
                    lastFreeze = freezeActive ? 1 : 0;
                    lastClock = clockValue > 0 ? 1 : 0;
                }

                leds.level = clamp(peak / OUTPUT_LIMIT, 0, 1);
                leds.freeze = lastFreeze;
                leds.clock = lastClock;
                leds.dropout = clamp(lastDropout, 0, 1);

            },

            reset() {
                delayBuffer.fill(0);
                out.fill(0);
                clock.fill(0);
                clearInputBuffers();
                clearState();
                leds.level = 0;
                leds.freeze = 0;
                leds.clock = 0;
                leds.dropout = 0;
            },

            get delayRange() {
                return {
                    minSamples: minNominalDelaySamples,
                    maxSamples: Math.min(maxNominalDelaySamples, maxDelaySamples)
                };
            }
        };
    },

    ui: {
        leds: ['level', 'freeze', 'clock', 'dropout'],
        knobs: [
            { id: 'time', label: 'Time', param: 'time', min: 0, max: 1, default: 0.45 },
            { id: 'feedback', label: 'Fdbk', param: 'feedback', min: 0, max: 1, default: 0.35 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 0.45 },
            { id: 'drive', label: 'Drive', param: 'drive', min: 0, max: 1, default: 0.25 },
            { id: 'age', label: 'Age', param: 'age', min: 0, max: 1, default: 0.35 },
            { id: 'lowCut', label: 'Low Cut', param: 'lowCut', min: 0, max: 1, default: 0.2 },
            { id: 'wow', label: 'Wow', param: 'wow', min: 0, max: 1, default: 0.15 },
            { id: 'crinkle', label: 'Crnk', param: 'crinkle', min: 0, max: 1, default: 0.05 }
        ],
        switches: [
            { id: 'freeze', label: 'Freeze', param: 'freeze', default: 0 }
        ],
        buttons: [
            { id: 'headMode', label: 'Heads', param: 'headMode', values: [0, 1, 2], default: 1 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', signal: 'audio' },
            { id: 'timeCV', label: 'Time', port: 'timeCV', signal: 'cv' },
            { id: 'speedCV', label: 'Speed', port: 'speedCV', signal: 'cv' },
            { id: 'feedbackCV', label: 'Fdbk', port: 'feedbackCV', signal: 'cv' },
            { id: 'mixCV', label: 'Mix', port: 'mixCV', signal: 'cv' },
            { id: 'tap', label: 'Tap', port: 'tap', signal: 'trigger' },
            { id: 'freezeGate', label: 'Freeze', port: 'freezeGate', signal: 'gate' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'audio' },
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'gate' }
        ],
        socketLayout: {
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
        }
    }
};
