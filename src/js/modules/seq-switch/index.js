/**
 * SEQ-SWITCH - Sequential Switch
 *
 * App-adapted Doepfer A-151-style switch. The hardware uses bidirectional I/O
 * jacks; eurorack-js cables are directional, so this exposes both 4-to-1 and
 * 1-to-4 routing under the same active stage.
 */

import { clamp } from '../../utils/math.js';

const TRIGGER_THRESHOLD = 2.5;
const OUTPUT_LIMIT = 5;

function clampSignal(value) {
    return clamp(Number.isFinite(value) ? value : 0, -OUTPUT_LIMIT, OUTPUT_LIMIT);
}

function quantizeSteps(value) {
    return Math.round(clamp(value, 2, 4));
}

export default {
    id: 'seq-switch',
    name: 'SEQ-SW',
    hp: 6,
    color: 'module-color-five',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const commonOut = new Float32Array(bufferSize);
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);
        const out3 = new Float32Array(bufferSize);
        const out4 = new Float32Array(bufferSize);

        const ownCommonIn = new Float32Array(bufferSize);
        const ownIn1 = new Float32Array(bufferSize);
        const ownIn2 = new Float32Array(bufferSize);
        const ownIn3 = new Float32Array(bufferSize);
        const ownIn4 = new Float32Array(bufferSize);

        const outputs = [out1, out2, out3, out4];
        const leds = {
            stage1: 1,
            stage2: 0,
            stage3: 0,
            stage4: 0
        };

        const crossfadeSamples = Math.max(1, Math.floor(sampleRate * 0.001));
        let stage = 0;
        let previousStage = 0;
        let fadeRemaining = 0;
        let lastClockHigh = false;
        let lastResetHigh = false;

        function updateLeds(steps) {
            leds.stage1 = stage === 0 ? 1 : 0;
            leds.stage2 = stage === 1 ? 1 : 0;
            leds.stage3 = steps > 2 && stage === 2 ? 1 : 0;
            leds.stage4 = steps > 3 && stage === 3 ? 1 : 0;
        }

        function switchTo(nextStage) {
            if (nextStage === stage) return;
            previousStage = stage;
            stage = nextStage;
            fadeRemaining = crossfadeSamples;
        }

        return {
            params: {
                steps: 4
            },

            inputs: {
                clock: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize),
                commonIn: ownCommonIn,
                in1: ownIn1,
                in2: ownIn2,
                in3: ownIn3,
                in4: ownIn4
            },

            outputs: {
                commonOut,
                out1,
                out2,
                out3,
                out4
            },

            leds,

            process() {
                const inputStages = [this.inputs.in1, this.inputs.in2, this.inputs.in3, this.inputs.in4];
                const clock = this.inputs.clock;
                const reset = this.inputs.reset;
                const commonIn = this.inputs.commonIn;

                for (let i = 0; i < bufferSize; i++) {
                    const steps = quantizeSteps(this.params.steps);
                    if (stage >= steps) switchTo(0);
                    if (previousStage >= steps) previousStage = stage;

                    const clockHigh = clock[i] > TRIGGER_THRESHOLD;
                    const resetHigh = reset[i] > TRIGGER_THRESHOLD;
                    const clockRising = clockHigh && !lastClockHigh;
                    const resetRising = resetHigh && !lastResetHigh;

                    if (resetRising) {
                        switchTo(0);
                    } else if (clockRising) {
                        switchTo((stage + 1) % steps);
                    }

                    lastClockHigh = clockHigh;
                    lastResetHigh = resetHigh;

                    let fade = 1;
                    if (fadeRemaining > 0) {
                        fade = 1 - (fadeRemaining / crossfadeSamples);
                        fadeRemaining--;
                    }

                    outputs[0][i] = 0;
                    outputs[1][i] = 0;
                    outputs[2][i] = 0;
                    outputs[3][i] = 0;

                    const selected = clampSignal(inputStages[stage][i]);
                    const common = clampSignal(commonIn[i]);

                    if (fade < 1) {
                        const previous = clampSignal(inputStages[previousStage][i]);
                        const oldCommon = previousStage < steps ? common * (1 - fade) : 0;
                        commonOut[i] = clampSignal(previous * (1 - fade) + selected * fade);
                        outputs[previousStage][i] = clampSignal(oldCommon);
                        outputs[stage][i] = clampSignal(outputs[stage][i] + common * fade);
                    } else {
                        commonOut[i] = selected;
                        outputs[stage][i] = common;
                    }
                }

                updateLeds(quantizeSteps(this.params.steps));
            },

            reset() {
                stage = 0;
                previousStage = 0;
                fadeRemaining = 0;
                lastClockHigh = false;
                lastResetHigh = false;
                commonOut.fill(0);
                out1.fill(0);
                out2.fill(0);
                out3.fill(0);
                out4.fill(0);
                updateLeds(quantizeSteps(this.params.steps));
            },

            getActiveStage() {
                return stage + 1;
            },

            getActiveSteps() {
                return quantizeSteps(this.params.steps);
            }
        };
    },

    ui: {
        leds: ['stage1', 'stage2', 'stage3', 'stage4'],
        knobs: [
            { id: 'steps', label: 'Steps', param: 'steps', min: 2, max: 4, step: 1, default: 4 }
        ],
        inputs: [
            { id: 'clock', label: 'Clk', port: 'clock', signal: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', signal: 'trigger' },
            { id: 'commonIn', label: 'Com In', port: 'commonIn', signal: 'any' },
            { id: 'in1', label: 'In1', port: 'in1', signal: 'any' },
            { id: 'in2', label: 'In2', port: 'in2', signal: 'any' },
            { id: 'in3', label: 'In3', port: 'in3', signal: 'any' },
            { id: 'in4', label: 'In4', port: 'in4', signal: 'any' }
        ],
        outputs: [
            { id: 'commonOut', label: 'Com Out', port: 'commonOut', signal: 'any' },
            { id: 'out1', label: 'Out1', port: 'out1', signal: 'any' },
            { id: 'out2', label: 'Out2', port: 'out2', signal: 'any' },
            { id: 'out3', label: 'Out3', port: 'out3', signal: 'any' },
            { id: 'out4', label: 'Out4', port: 'out4', signal: 'any' }
        ]
    }
};
