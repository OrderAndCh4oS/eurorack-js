/**
 * Quad LFO - Quadrature sine LFO
 *
 * Adapted from the researched Doepfer A-143-9 and Xaoc Batumi quadrature
 * behavior: one DDS-style phase accumulator with fixed 0/90/180/270 degree
 * sine taps, app-standard +/-5V CV outputs, reset, and hold.
 */

import { clamp, expMap } from '../../utils/math.js';
import { wrapPhase } from '../../utils/oscillator.js';

export const QUAD_LFO_RANGES = [
    { min: 0.1, max: 10 },
    { min: 1, max: 150 },
    { min: 30, max: 3500 }
];

const TWO_PI = Math.PI * 2;
const MIN_FREQUENCY = 1 / 600;
const MAX_FREQUENCY = 5000;
const RESET_THRESHOLD = 1;
const HOLD_THRESHOLD = 2;
const OUTPUT_SCALE = 5;

function getRange(params) {
    return QUAD_LFO_RANGES[Math.round(clamp(params.range, 0, QUAD_LFO_RANGES.length - 1))];
}

export default {
    id: 'quad-lfo',
    name: 'Quad LFO',
    hp: 8,
    color: 'module-color-eight',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out0 = new Float32Array(bufferSize);
        const out90 = new Float32Array(bufferSize);
        const out180 = new Float32Array(bufferSize);
        const out270 = new Float32Array(bufferSize);

        let phase = 0;
        let lastReset = 0;

        function baseFrequency(params) {
            const range = getRange(params);
            return expMap(params.rate, range.min, range.max);
        }

        function effectiveFrequency(params, rateCV, rateMod) {
            const cvOctaves = clamp(rateCV || 0, -5, 5);
            const modOctaves = clamp(rateMod || 0, -5, 5) * clamp(params.rateCvAmt, -1, 1);
            const frequency = baseFrequency(params) * 2 ** (cvOctaves + modOctaves);
            return clamp(frequency, MIN_FREQUENCY, Math.min(MAX_FREQUENCY, sampleRate * 0.45));
        }

        return {
            params: {
                rate: 0.35,
                range: 0,
                rateCvAmt: 0
            },

            inputs: {
                rateCV: new Float32Array(bufferSize),
                rateMod: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize),
                hold: new Float32Array(bufferSize)
            },

            outputs: {
                out0,
                out90,
                out180,
                out270
            },

            leds: {
                led0: 0,
                led90: 0,
                led180: 0,
                led270: 0
            },

            process() {
                const rateCV = this.inputs.rateCV;
                const rateMod = this.inputs.rateMod;
                const reset = this.inputs.reset;
                const hold = this.inputs.hold;

                for (let i = 0; i < bufferSize; i++) {
                    const resetValue = reset[i] || 0;
                    const resetRising = resetValue >= RESET_THRESHOLD && lastReset < RESET_THRESHOLD;
                    if (resetRising) phase = 0;

                    const phase0 = phase;
                    const phase90 = wrapPhase(phase + 0.25);
                    const phase180 = wrapPhase(phase + 0.5);
                    const phase270 = wrapPhase(phase + 0.75);

                    out0[i] = Math.sin(phase0 * TWO_PI) * OUTPUT_SCALE;
                    out90[i] = Math.sin(phase90 * TWO_PI) * OUTPUT_SCALE;
                    out180[i] = Math.sin(phase180 * TWO_PI) * OUTPUT_SCALE;
                    out270[i] = Math.sin(phase270 * TWO_PI) * OUTPUT_SCALE;

                    if ((hold[i] || 0) <= HOLD_THRESHOLD) {
                        const inc = effectiveFrequency(this.params, rateCV[i], rateMod[i]) / sampleRate;
                        phase = wrapPhase(phase + inc);
                    }

                    lastReset = resetValue;
                }

                const last = bufferSize - 1;
                this.leds.led0 = out0[last] / OUTPUT_SCALE;
                this.leds.led90 = out90[last] / OUTPUT_SCALE;
                this.leds.led180 = out180[last] / OUTPUT_SCALE;
                this.leds.led270 = out270[last] / OUTPUT_SCALE;
            },

            reset() {
                phase = 0;
                lastReset = 0;
                out0.fill(0);
                out90.fill(0);
                out180.fill(0);
                out270.fill(0);
                this.leds.led0 = 0;
                this.leds.led90 = 0;
                this.leds.led180 = 0;
                this.leds.led270 = 0;
            }
        };
    },

    ui: {
        leds: ['led0', 'led90', 'led180', 'led270'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.35 },
            { id: 'range', label: 'Range', param: 'range', min: 0, max: 2, default: 0, step: 1 },
            { id: 'rateCvAmt', label: 'CV Amt', param: 'rateCvAmt', min: -1, max: 1, default: 0 }
        ],
        inputs: [
            { id: 'rateCV', label: '1V/Oct', port: 'rateCV', signal: 'cv' },
            { id: 'rateMod', label: 'FM', port: 'rateMod', signal: 'cv' },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger' },
            { id: 'hold', label: 'Hold', port: 'hold', signal: 'gate' }
        ],
        outputs: [
            { id: 'out0', label: '0', port: 'out0', signal: 'cv' },
            { id: 'out90', label: '90', port: 'out90', signal: 'cv' },
            { id: 'out180', label: '180', port: 'out180', signal: 'cv' },
            { id: 'out270', label: '270', port: 'out270', signal: 'cv' }
        ]
    }
};
