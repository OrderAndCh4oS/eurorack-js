/**
 * SLEW - Dual Slew Limiter
 *
 * Based on Doepfer A-170 (simplified).
 * Limits the rate of change of a signal, creating smooth transitions.
 *
 * Features:
 * - 2 independent channels
 * - Adjustable slew rate (0ms to 2000ms)
 * - CV control of slew rate
 * - One-pole RC filter implementation
 *
 * Common uses:
 * - Portamento/glide between notes
 * - Smoothing stepped CV from sequencers
 * - Converting gates to simple envelopes
 * - Taming abrupt modulation
 *
 * Source: https://doepfer.de/a170.htm
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'slew',
    name: 'SLEW',
    hp: 4,
    color: '#5a6a7a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);

        // Slew state (current smoothed value)
        let state1 = 0;
        let state2 = 0;

        // Maximum slew time in ms
        const MAX_SLEW_MS = 2000;
        // CV scaling: 5V = 1000ms
        const CV_SCALE = 200;

        return {
            params: {
                rate1: 0.1,  // 0-1 maps to 0-2000ms
                rate2: 0.1
            },

            inputs: {
                in1: new Float32Array(bufferSize),
                in2: new Float32Array(bufferSize),
                cv1: new Float32Array(bufferSize),
                cv2: new Float32Array(bufferSize)
            },

            outputs: {
                out1,
                out2
            },

            leds: {
                ch1: 0,
                ch2: 0
            },

            process() {
                const in1 = this.inputs.in1;
                const in2 = this.inputs.in2;
                const cv1 = this.inputs.cv1;
                const cv2 = this.inputs.cv2;
                const { rate1, rate2 } = this.params;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate slew time for channel 1
                    // Knob: 0-1 maps to 0-2000ms
                    // CV: ±5V adds ±1000ms
                    const timeMs1 = clamp(rate1 * MAX_SLEW_MS + cv1[i] * CV_SCALE, 0.1, MAX_SLEW_MS * 2);
                    const coeff1 = 1 - Math.exp(-1000 / (sampleRate * timeMs1));
                    state1 += coeff1 * (in1[i] - state1);
                    out1[i] = state1;

                    // Calculate slew time for channel 2
                    const timeMs2 = clamp(rate2 * MAX_SLEW_MS + cv2[i] * CV_SCALE, 0.1, MAX_SLEW_MS * 2);
                    const coeff2 = 1 - Math.exp(-1000 / (sampleRate * timeMs2));
                    state2 += coeff2 * (in2[i] - state2);
                    out2[i] = state2;
                }

                // LED shows output level (bipolar: -5V=0, 0V=0.5, +5V=1)
                this.leds.ch1 = clamp((state1 + 5) / 10, 0, 1);
                this.leds.ch2 = clamp((state2 + 5) / 10, 0, 1);
            },

            reset() {
                state1 = 0;
                state2 = 0;
                out1.fill(0);
                out2.fill(0);
                this.leds.ch1 = 0;
                this.leds.ch2 = 0;
            }
        };
    },

    ui: {
        leds: ['ch1', 'ch2'],
        knobs: [
            { id: 'rate1', label: 'Rate1', param: 'rate1', min: 0, max: 1, default: 0.1 },
            { id: 'rate2', label: 'Rate2', param: 'rate2', min: 0, max: 1, default: 0.1 }
        ],
        inputs: [
            { id: 'in1', label: 'In1', port: 'in1', type: 'buffer' },
            { id: 'cv1', label: 'CV1', port: 'cv1', type: 'cv' },
            { id: 'in2', label: 'In2', port: 'in2', type: 'buffer' },
            { id: 'cv2', label: 'CV2', port: 'cv2', type: 'cv' }
        ],
        outputs: [
            { id: 'out1', label: 'Out1', port: 'out1', type: 'buffer' },
            { id: 'out2', label: 'Out2', port: 'out2', type: 'buffer' }
        ]
    }
};
