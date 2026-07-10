/**
 * SWING - Causal clock swing processor
 *
 * App-adapted clock utility based on the documented swing research:
 * immediate straight output, delayed processed output, deterministic
 * humanization, and 0V/10V trigger levels.
 */

import { clamp } from '../../utils/math.js';

export const SWING_TEMPLATE_WEIGHTS = [
    [0, 1],
    [0, 1.33],
    [0, 1, 0.15, 0.70, 0, 0.90, 0.10, 0.60],
    [0.20, 0.85, 0, 0.65, 0.10, 1, 0, 0.55]
];

const CLOCK_THRESHOLD = 2.5;
const TRIGGER_HIGH = 10;
const RANDOM_SEED = 0x5eed1234;

export default {
    id: 'swing',
    name: 'SWING',
    hp: 4,
    color: 'module-color-five',
    category: 'clock',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const swungOut = new Float32Array(bufferSize);
        const straightOut = new Float32Array(bufferSize);

        const minPulseSamples = Math.max(1, Math.round(sampleRate * 0.005));
        const oneMsSamples = Math.max(1, Math.round(sampleRate * 0.001));
        const minClockPeriodSamples = Math.max(1, Math.round(sampleRate * 0.002));
        const defaultPeriodSamples = Math.max(minPulseSamples * 4, Math.round(sampleRate * 0.25));

        let lastClockHigh = false;
        let lastResetHigh = false;
        let hasClockReference = false;
        let samplesSinceLastClock = 0;
        let lastPeriodSamples = defaultPeriodSamples;
        let patternStep = 0;
        let sampleClock = 0;
        let straightPulseSamples = 0;
        let processedPulseSamples = 0;
        let randomState = RANDOM_SEED;
        const pendingEvents = [];

        function nextRandom() {
            randomState = (randomState * 1664525 + 1013904223) >>> 0;
            return randomState / 0x100000000;
        }

        function resetHumanization() {
            randomState = RANDOM_SEED;
        }

        function currentTemplateIndex(params) {
            return Math.round(clamp(params.template, 0, SWING_TEMPLATE_WEIGHTS.length - 1));
        }

        function getPulseWidthSamples(params) {
            const period = Math.max(1, lastPeriodSamples);
            const maxPulseSamples = Math.max(1, Math.floor(period * 0.5));

            if (maxPulseSamples <= minPulseSamples) {
                return maxPulseSamples;
            }

            return Math.round(
                minPulseSamples + clamp(params.width, 0, 1) * (maxPulseSamples - minPulseSamples)
            );
        }

        function getEffectiveParam(knobValue, cvValue) {
            return clamp(clamp(knobValue, 0, 1) + clamp(cvValue, 0, 5) / 5, 0, 1);
        }

        function getTemplateWeight(params) {
            const weights = SWING_TEMPLATE_WEIGHTS[currentTemplateIndex(params)];
            return weights[patternStep % weights.length];
        }

        function computeDelaySamples(params, swingCV, humanCV, pulseWidthSamples) {
            const period = Math.max(1, lastPeriodSamples);
            const swingAmount = getEffectiveParam(params.swing, swingCV);
            const humanAmount = getEffectiveParam(params.human, humanCV);
            const baseSwingDelay = swingAmount * 0.5 * period;
            const maxSwingDelay = 0.5 * period;
            const templateDelay = Math.min(baseSwingDelay * getTemplateWeight(params), maxSwingDelay);

            const humanRange = humanAmount * Math.min(period * 0.10, sampleRate * 0.030);
            const humanDelay = humanRange > 0
                ? humanRange + (nextRandom() * 2 - 1) * humanRange
                : 0;

            const maxAllowedDelay = Math.max(0, period - pulseWidthSamples - oneMsSamples);
            return Math.round(clamp(templateDelay + humanDelay, 0, maxAllowedDelay));
        }

        function scheduleProcessedPulse(delaySamples, pulseWidthSamples) {
            pendingEvents.push({
                dueSample: sampleClock + delaySamples,
                width: pulseWidthSamples
            });
        }

        function fireDueEvents() {
            for (let i = pendingEvents.length - 1; i >= 0; i--) {
                const event = pendingEvents[i];
                if (event.dueSample <= sampleClock) {
                    processedPulseSamples = Math.max(processedPulseSamples, event.width);
                    pendingEvents.splice(i, 1);
                }
            }
        }

        function clearScheduledState({ resetPattern = true } = {}) {
            pendingEvents.length = 0;
            straightPulseSamples = 0;
            processedPulseSamples = 0;
            if (resetPattern) patternStep = 0;
            resetHumanization();
        }

        return {
            params: {
                swing: 0,
                human: 0,
                width: 0.1,
                template: 0
            },

            inputs: {
                clock: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize),
                swingCV: new Float32Array(bufferSize),
                humanCV: new Float32Array(bufferSize)
            },

            outputs: {
                swung: swungOut,
                straight: straightOut
            },

            leds: {
                in: 0,
                out: 0
            },

            process() {
                const clockIn = this.inputs.clock;
                const resetIn = this.inputs.reset;
                const swingCVIn = this.inputs.swingCV;
                const humanCVIn = this.inputs.humanCV;
                let inputActivity = false;
                let outputActivity = false;

                for (let i = 0; i < bufferSize; i++) {
                    const resetHigh = resetIn[i] > CLOCK_THRESHOLD;
                    const resetEdge = resetHigh && !lastResetHigh;
                    const clockHigh = clockIn[i] > CLOCK_THRESHOLD;
                    const clockEdge = clockHigh && !lastClockHigh;

                    if (resetEdge) {
                        clearScheduledState({ resetPattern: true });
                        swungOut[i] = 0;
                        straightOut[i] = 0;
                        lastResetHigh = resetHigh;
                        lastClockHigh = clockHigh;
                        if (hasClockReference) samplesSinceLastClock++;
                        sampleClock++;
                        continue;
                    }

                    if (clockEdge) {
                        if (!hasClockReference) {
                            hasClockReference = true;
                            samplesSinceLastClock = 0;
                        } else if (samplesSinceLastClock >= minClockPeriodSamples) {
                            lastPeriodSamples = samplesSinceLastClock;
                            samplesSinceLastClock = 0;
                        }

                        const pulseWidthSamples = getPulseWidthSamples(this.params);
                        straightPulseSamples = Math.max(straightPulseSamples, pulseWidthSamples);
                        const delaySamples = computeDelaySamples(
                            this.params,
                            swingCVIn[i],
                            humanCVIn[i],
                            pulseWidthSamples
                        );

                        scheduleProcessedPulse(delaySamples, pulseWidthSamples);
                        patternStep++;
                    }

                    fireDueEvents();

                    swungOut[i] = processedPulseSamples > 0 ? TRIGGER_HIGH : 0;
                    straightOut[i] = straightPulseSamples > 0 ? TRIGGER_HIGH : 0;
                    if (straightOut[i] > 0) inputActivity = true;
                    if (swungOut[i] > 0) outputActivity = true;

                    if (processedPulseSamples > 0) processedPulseSamples--;
                    if (straightPulseSamples > 0) straightPulseSamples--;

                    lastResetHigh = resetHigh;
                    lastClockHigh = clockHigh;
                    if (hasClockReference) samplesSinceLastClock++;
                    sampleClock++;
                }

                this.leds.in = inputActivity ? 1 : 0;
                this.leds.out = outputActivity ? 1 : 0;
            },

            reset() {
                swungOut.fill(0);
                straightOut.fill(0);
                clearScheduledState({ resetPattern: true });
                lastClockHigh = false;
                lastResetHigh = false;
                hasClockReference = false;
                samplesSinceLastClock = 0;
                lastPeriodSamples = defaultPeriodSamples;
                sampleClock = 0;
                this.leds.in = 0;
                this.leds.out = 0;
            },

            onInputDisconnected(port) {
                if (port !== 'clock') return;
                swungOut.fill(0);
                straightOut.fill(0);
                clearScheduledState({ resetPattern: false });
                lastClockHigh = false;
                hasClockReference = false;
                samplesSinceLastClock = 0;
                this.leds.in = 0;
                this.leds.out = 0;
            }
        };
    },

    ui: {
        leds: ['in', 'out'],
        knobs: [
            { id: 'swing', label: 'Swing', param: 'swing', min: 0, max: 1, default: 0 },
            { id: 'human', label: 'Human', param: 'human', min: 0, max: 1, default: 0 },
            { id: 'width', label: 'Width', param: 'width', min: 0, max: 1, default: 0.1 },
            { id: 'template', label: 'Tmpl', param: 'template', min: 0, max: 3, default: 0, step: 1 }
        ],
        inputs: [
            { id: 'clock', label: 'Clk', port: 'clock', signal: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', signal: 'trigger' },
            { id: 'swingCV', label: 'SwCV', port: 'swingCV', signal: 'cv' },
            { id: 'humanCV', label: 'HmCV', port: 'humanCV', signal: 'cv' }
        ],
        outputs: [
            { id: 'swung', label: 'Swg', port: 'swung', signal: 'trigger' },
            { id: 'straight', label: 'Str', port: 'straight', signal: 'trigger' }
        ]
    }
};
