import { clamp } from '../../utils/math.js';

export const CASCADE_PRIORITY = Object.freeze([
    0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15
]);

export const CASCADE_RANK = Object.freeze([
    0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15
]);

const DEFAULT_FILL = 8;
const DEFAULT_ROTATE = 0;
const CLOCK_THRESHOLD = 2.5;
const RESET_THRESHOLD = 1;

function finiteRounded(value, fallback, minimum, maximum) {
    return Number.isFinite(value)
        ? clamp(Math.round(value), minimum, maximum)
        : fallback;
}

export function computeCascadeFill(fill, fillCV) {
    const base = finiteRounded(fill, DEFAULT_FILL, 0, 16);
    const modulation = Number.isFinite(fillCV) ? clamp(fillCV, -5, 5) : 0;
    return clamp(Math.round(base + modulation * 8 / 5), 0, 16);
}

export function getCascadeLaneCount(fill, lane) {
    const safeFill = finiteRounded(fill, DEFAULT_FILL, 0, 16);
    const safeLane = finiteRounded(lane, 1, 1, 4);
    return Math.floor(safeLane * safeFill / 4);
}

export function isCascadeHit(step, rotate, fill, lane) {
    const safeStep = finiteRounded(step, 0, 0, 15);
    const safeRotate = finiteRounded(rotate, DEFAULT_ROTATE, 0, 15);
    const rankedStep = (safeStep - safeRotate + 16) & 15;
    return CASCADE_RANK[rankedStep] < getCascadeLaneCount(fill, lane);
}

export function createCascadeMask(fill, rotate, lane) {
    return Array.from({ length: 16 }, (_, step) =>
        isCascadeHit(step, rotate, fill, lane)
    );
}

export default {
    id: 'cascade',
    name: 'CASCADE',
    hp: 6,
    color: 'module-color-five',
    category: 'clock',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clock = new Float32Array(bufferSize);
        const reset = new Float32Array(bufferSize);
        const fillCV = new Float32Array(bufferSize);
        const lane1 = new Float32Array(bufferSize);
        const lane2 = new Float32Array(bufferSize);
        const lane3 = new Float32Array(bufferSize);
        const lane4 = new Float32Array(bufferSize);
        const laneOutputs = [lane1, lane2, lane3, lane4];
        const triggerCounters = new Int32Array(4);
        const ledCounters = new Int32Array(4);

        const triggerSamples = Math.max(1, Math.round(sampleRate * 0.008));
        const ledSamples = Math.max(1, Math.round(sampleRate * 0.05));
        let step = -1;
        let lastClockHigh = false;
        let lastResetHigh = false;
        let lastResetActionHigh = false;
        let restartPending = false;
        let activeInitialized = false;
        let activeRotate = DEFAULT_ROTATE;

        return {
            params: {
                fill: DEFAULT_FILL,
                rotate: DEFAULT_ROTATE,
                resetAction: 0
            },

            inputs: { clock, reset, fillCV },
            outputs: { lane1, lane2, lane3, lane4 },
            leds: {
                lane1: 0,
                lane2: 0,
                lane3: 0,
                lane4: 0,
                pending: 0
            },

            process() {
                const requestedRotate = finiteRounded(
                    this.params.rotate,
                    DEFAULT_ROTATE,
                    0,
                    15
                );
                const resetActionHigh = Number.isFinite(this.params.resetAction) &&
                    this.params.resetAction >= 0.5;

                for (let sample = 0; sample < bufferSize; sample++) {
                    const resetHigh = Number.isFinite(reset[sample]) &&
                        reset[sample] >= RESET_THRESHOLD;
                    const resetRising = resetHigh && !lastResetHigh;
                    const resetActionRising = resetActionHigh && !lastResetActionHigh;
                    if (resetRising || resetActionRising) {
                        triggerCounters.fill(0);
                        ledCounters.fill(0);
                        restartPending = true;
                    }

                    const clockHigh = Number.isFinite(clock[sample]) &&
                        clock[sample] > CLOCK_THRESHOLD;
                    const clockRising = clockHigh && !lastClockHigh;
                    lastResetHigh = resetHigh;
                    lastResetActionHigh = resetActionHigh;
                    lastClockHigh = clockHigh;

                    if (clockRising) {
                        if (restartPending) {
                            step = 0;
                        } else {
                            step = (step + 1) & 15;
                        }
                        if (step === 0) {
                            activeRotate = requestedRotate;
                            activeInitialized = true;
                            restartPending = false;
                        }

                        const effectiveFill = computeCascadeFill(
                            this.params.fill,
                            fillCV[sample]
                        );
                        const rankedStep = (step - activeRotate + 16) & 15;
                        const rank = CASCADE_RANK[rankedStep];
                        for (let lane = 0; lane < 4; lane++) {
                            const count = Math.floor((lane + 1) * effectiveFill / 4);
                            if (rank < count) {
                                triggerCounters[lane] = triggerSamples;
                                ledCounters[lane] = ledSamples;
                            }
                        }
                    }

                    for (let lane = 0; lane < 4; lane++) {
                        if (triggerCounters[lane] > 0) {
                            laneOutputs[lane][sample] = 10;
                            triggerCounters[lane]--;
                        } else {
                            laneOutputs[lane][sample] = 0;
                        }
                        if (ledCounters[lane] > 0) ledCounters[lane]--;
                    }
                }

                this.leds.lane1 = ledCounters[0] > 0 ? 1 : 0;
                this.leds.lane2 = ledCounters[1] > 0 ? 1 : 0;
                this.leds.lane3 = ledCounters[2] > 0 ? 1 : 0;
                this.leds.lane4 = ledCounters[3] > 0 ? 1 : 0;
                this.leds.pending = restartPending ||
                    (activeInitialized && requestedRotate !== activeRotate) ? 1 : 0;
            },

            reset() {
                clock.fill(0);
                reset.fill(0);
                fillCV.fill(0);
                lane1.fill(0);
                lane2.fill(0);
                lane3.fill(0);
                lane4.fill(0);
                triggerCounters.fill(0);
                ledCounters.fill(0);
                step = -1;
                lastClockHigh = false;
                lastResetHigh = false;
                lastResetActionHigh = false;
                restartPending = false;
                activeInitialized = false;
                activeRotate = DEFAULT_ROTATE;
                this.params.resetAction = 0;
                this.leds.lane1 = 0;
                this.leds.lane2 = 0;
                this.leds.lane3 = 0;
                this.leds.lane4 = 0;
                this.leds.pending = 0;
            }
        };
    },

    ui: {
        leds: ['lane1', 'lane2', 'lane3', 'lane4', 'pending'],
        knobs: [
            { id: 'fill', label: 'Fill', param: 'fill', min: 0, max: 16, default: 8, step: 1 },
            { id: 'rotate', label: 'Rotate', param: 'rotate', min: 0, max: 15, default: 0, step: 1 }
        ],
        actions: [
            { id: 'resetAction', label: 'Reset', param: 'resetAction', mode: 'trigger', default: 0 }
        ],
        inputs: [
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'fillCV', label: 'Fill', port: 'fillCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'lane1', label: '1', port: 'lane1', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'lane2', label: '2', port: 'lane2', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'lane3', label: '3', port: 'lane3', signal: 'trigger', voltage: { min: 0, max: 10 } },
            { id: 'lane4', label: '4', port: 'lane4', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
