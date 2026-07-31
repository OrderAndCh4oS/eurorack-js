import { clamp, expMap } from '../../utils/math.js';
import { softLimitVoltage } from '../../utils/voltage.js';

const DEFAULT_RATE = 0.5;
const DEFAULT_CHARACTER = 1 / 3;
const DEFAULT_DEPTH = 1;

const INITIAL_X = 13.79322908927515;
const INITIAL_Y = 12.951847112857063;
const INITIAL_Z = 34.901636990308354;

const SIGMA = 10;
const BETA = 8 / 3;
const MIN_SPEED = 0.000625;
const MAX_SPEED = 20;
const RESET_THRESHOLD = 1;

function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

export default {
    id: 'chaos',
    name: 'Chaos',
    hp: 8,
    color: 'module-color-ten',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const safeSampleRate = Number.isFinite(sampleRate) && sampleRate > 0
            ? sampleRate
            : 44100;

        const rateCV = new Float32Array(bufferSize);
        const characterCV = new Float32Array(bufferSize);
        const resetInput = new Float32Array(bufferSize);
        const xOutput = new Float32Array(bufferSize);
        const yOutput = new Float32Array(bufferSize);
        const zOutput = new Float32Array(bufferSize);
        const lobeOutput = new Float32Array(bufferSize);

        let x = INITIAL_X;
        let y = INITIAL_Y;
        let z = INITIAL_Z;
        let lastResetHigh = false;

        function restoreState() {
            x = INITIAL_X;
            y = INITIAL_Y;
            z = INITIAL_Z;
        }

        return {
            params: {
                rate: DEFAULT_RATE,
                character: DEFAULT_CHARACTER,
                depth: DEFAULT_DEPTH
            },
            inputs: {
                rateCV,
                characterCV,
                reset: resetInput
            },
            outputs: {
                x: xOutput,
                y: yOutput,
                z: zOutput,
                lobe: lobeOutput
            },
            leds: {
                xLed: 0.5,
                yLed: 0.5,
                zLed: 0.5,
                lobeLed: 0
            },

            process() {
                const rateKnob = clamp(finite(this.params.rate, DEFAULT_RATE), 0, 1);
                const characterKnob = clamp(
                    finite(this.params.character, DEFAULT_CHARACTER),
                    0,
                    1
                );
                const depth = clamp(finite(this.params.depth, DEFAULT_DEPTH), 0, 1);
                const knobSpeed = expMap(rateKnob, 0.02, MAX_SPEED);

                for (let index = 0; index < bufferSize; index++) {
                    const resetVoltage = finite(resetInput[index], 0);
                    const resetHigh = resetVoltage >= RESET_THRESHOLD;
                    if (resetHigh && !lastResetHigh) restoreState();
                    lastResetHigh = resetHigh;

                    const rateVoltage = clamp(finite(rateCV[index], 0), -5, 5);
                    const characterVoltage = clamp(finite(characterCV[index], 0), -5, 5);
                    const speed = clamp(
                        knobSpeed * Math.pow(2, rateVoltage),
                        MIN_SPEED,
                        MAX_SPEED
                    );
                    const effectiveCharacter = clamp(
                        characterKnob + characterVoltage / 5,
                        0,
                        1
                    );
                    const rho = 24 + 12 * effectiveCharacter;
                    const dt = speed / safeSampleRate;

                    // Classical fixed-step RK4 for the Lorenz system. Scalar
                    // stages keep the AudioWorklet sample loop allocation-free.
                    const k1x = SIGMA * (y - x);
                    const k1y = x * (rho - z) - y;
                    const k1z = x * y - BETA * z;

                    const x2 = x + k1x * dt * 0.5;
                    const y2 = y + k1y * dt * 0.5;
                    const z2 = z + k1z * dt * 0.5;
                    const k2x = SIGMA * (y2 - x2);
                    const k2y = x2 * (rho - z2) - y2;
                    const k2z = x2 * y2 - BETA * z2;

                    const x3 = x + k2x * dt * 0.5;
                    const y3 = y + k2y * dt * 0.5;
                    const z3 = z + k2z * dt * 0.5;
                    const k3x = SIGMA * (y3 - x3);
                    const k3y = x3 * (rho - z3) - y3;
                    const k3z = x3 * y3 - BETA * z3;

                    const x4 = x + k3x * dt;
                    const y4 = y + k3y * dt;
                    const z4 = z + k3z * dt;
                    const k4x = SIGMA * (y4 - x4);
                    const k4y = x4 * (rho - z4) - y4;
                    const k4z = x4 * y4 - BETA * z4;

                    x += dt * (k1x + 2 * k2x + 2 * k3x + k4x) / 6;
                    y += dt * (k1y + 2 * k2y + 2 * k3y + k4y) / 6;
                    z += dt * (k1z + 2 * k2z + 2 * k3z + k4z) / 6;

                    if (
                        !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
                        || Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000
                    ) {
                        restoreState();
                    }

                    if (depth === 0) {
                        xOutput[index] = 0;
                        yOutput[index] = 0;
                        zOutput[index] = 0;
                    } else {
                        xOutput[index] = depth * softLimitVoltage(0.25 * x, 5, 0.9);
                        yOutput[index] = depth * softLimitVoltage(0.20 * y, 5, 0.9);
                        zOutput[index] = depth * softLimitVoltage(0.20 * (z - (rho - 1)), 5, 0.9);
                    }
                    lobeOutput[index] = x >= 0 ? 10 : 0;
                }

                const last = bufferSize - 1;
                if (last >= 0) {
                    this.leds.xLed = clamp(xOutput[last] / 10 + 0.5, 0, 1);
                    this.leds.yLed = clamp(yOutput[last] / 10 + 0.5, 0, 1);
                    this.leds.zLed = clamp(zOutput[last] / 10 + 0.5, 0, 1);
                    this.leds.lobeLed = lobeOutput[last] === 10 ? 1 : 0;
                }
            },

            reset() {
                restoreState();
                lastResetHigh = false;
                rateCV.fill(0);
                characterCV.fill(0);
                resetInput.fill(0);
                xOutput.fill(0);
                yOutput.fill(0);
                zOutput.fill(0);
                lobeOutput.fill(0);
                this.leds.xLed = 0.5;
                this.leds.yLed = 0.5;
                this.leds.zLed = 0.5;
                this.leds.lobeLed = 0;
            }
        };
    },

    ui: {
        leds: ['xLed', 'yLed', 'zLed', 'lobeLed'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: DEFAULT_RATE },
            { id: 'character', label: 'Character', param: 'character', min: 0, max: 1, default: DEFAULT_CHARACTER },
            { id: 'depth', label: 'Depth', param: 'depth', min: 0, max: 1, default: DEFAULT_DEPTH }
        ],
        inputs: [
            { id: 'rateCV', label: 'Rate', port: 'rateCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'characterCV', label: 'Char', port: 'characterCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'x', label: 'X', port: 'x', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'y', label: 'Y', port: 'y', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'z', label: 'Z', port: 'z', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'lobe', label: 'Lobe', port: 'lobe', signal: 'gate', voltage: { min: 0, max: 10 } }
        ]
    }
};
