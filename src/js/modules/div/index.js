/**
 * DIV - Dual Clock Divider/Multiplier
 *
 * Based on the 2hp Div module specifications:
 * - 2 independent channels
 * - Division/Multiplication: /16, /8, /7, /6, /5, /4, /3, /2, x1, x2, x3, x4, x5, x6, x7, x8, x16
 * - CV input per channel: 0V to 5V
 * - Clock input threshold: 2.5V
 * - Output matches input pulse height
 */

import { clamp } from '../../utils/math.js';

/**
 * Division/multiplication ratio names for UI display
 */
export const DIV_RATIO_NAMES = [
    '/16', '/8', '/7', '/6', '/5', '/4', '/3', '/2',
    'x1',
    'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x16'
];

export default {
    id: 'div',
    name: 'DIV',
    hp: 2,
    color: '#5a6a2a',
    category: 'utility',

    /**
     * Create DSP instance
     */
    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);

        // Division/multiplication ratios (17 steps)
        const RATIOS = [
            1/16, 1/8, 1/7, 1/6, 1/5, 1/4, 1/3, 1/2,
            1,
            2, 3, 4, 5, 6, 7, 8, 16
        ];

        // State
        let lastClockState = false;
        let inputPulseHeight = 10;

        // Channel 1 state
        let ch1Counter = 0;
        let ch1LastPeriod = sampleRate;
        let ch1SamplesSinceLastClock = 0;

        // Channel 2 state
        let ch2Counter = 0;
        let ch2LastPeriod = sampleRate;
        let ch2SamplesSinceLastClock = 0;

        // Pulse state (1ms pulse)
        const pulseWidth = Math.floor(0.001 * sampleRate);
        let ch1PulseSamples = 0;
        let ch2PulseSamples = 0;

        function rateToRatioIndex(rate) {
            return Math.round(clamp(rate, 0, 1) * (RATIOS.length - 1));
        }

        return {
            params: {
                rate1: 0.5,
                rate2: 0.5
            },

            inputs: {
                clock: new Float32Array(bufferSize),
                rate1CV: new Float32Array(bufferSize),
                rate2CV: new Float32Array(bufferSize)
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
                const baseRate1 = this.params.rate1;
                const baseRate2 = this.params.rate2;
                const clockIn = this.inputs.clock;
                const rate1CVIn = this.inputs.rate1CV;
                const rate2CVIn = this.inputs.rate2CV;

                for (let i = 0; i < bufferSize; i++) {
                    const clockHigh = clockIn[i] > 2.5;
                    const clockEdge = clockHigh && !lastClockState;

                    if (clockHigh) {
                        inputPulseHeight = clockIn[i];
                    }

                    if (clockEdge) {
                        if (ch1SamplesSinceLastClock > 0) {
                            ch1LastPeriod = ch1SamplesSinceLastClock;
                            ch2LastPeriod = ch2SamplesSinceLastClock;
                        }
                        ch1Counter++;
                        ch2Counter++;
                        ch1SamplesSinceLastClock = 0;
                        ch2SamplesSinceLastClock = 0;
                    }

                    lastClockState = clockHigh;

                    // Apply CV modulation
                    const cv1 = clamp(rate1CVIn[i], 0, 5) / 5;
                    const cv2 = clamp(rate2CVIn[i], 0, 5) / 5;
                    const rate1 = clamp(baseRate1 + cv1, 0, 1);
                    const rate2 = clamp(baseRate2 + cv2, 0, 1);

                    const ratio1 = RATIOS[rateToRatioIndex(rate1)];
                    const ratio2 = RATIOS[rateToRatioIndex(rate2)];

                    // Channel 1 processing
                    if (ratio1 < 1) {
                        const divideBy = Math.round(1 / ratio1);
                        if (clockEdge && ch1Counter % divideBy === 0) {
                            ch1PulseSamples = pulseWidth;
                        }
                    } else if (ratio1 > 1) {
                        const multiplyBy = Math.round(ratio1);
                        const phasePerPulse = ch1LastPeriod / multiplyBy;
                        if (ch1SamplesSinceLastClock % Math.floor(phasePerPulse) === 0) {
                            ch1PulseSamples = pulseWidth;
                        }
                    } else {
                        if (clockEdge) {
                            ch1PulseSamples = pulseWidth;
                        }
                    }

                    // Channel 2 processing
                    if (ratio2 < 1) {
                        const divideBy = Math.round(1 / ratio2);
                        if (clockEdge && ch2Counter % divideBy === 0) {
                            ch2PulseSamples = pulseWidth;
                        }
                    } else if (ratio2 > 1) {
                        const multiplyBy = Math.round(ratio2);
                        const phasePerPulse = ch2LastPeriod / multiplyBy;
                        if (ch2SamplesSinceLastClock % Math.floor(phasePerPulse) === 0) {
                            ch2PulseSamples = pulseWidth;
                        }
                    } else {
                        if (clockEdge) {
                            ch2PulseSamples = pulseWidth;
                        }
                    }

                    // Output pulses
                    out1[i] = ch1PulseSamples > 0 ? inputPulseHeight : 0;
                    out2[i] = ch2PulseSamples > 0 ? inputPulseHeight : 0;

                    if (ch1PulseSamples > 0) ch1PulseSamples--;
                    if (ch2PulseSamples > 0) ch2PulseSamples--;

                    ch1SamplesSinceLastClock++;
                    ch2SamplesSinceLastClock++;
                }

                this.leds.ch1 = ch1PulseSamples > 0 ? 1 : 0;
                this.leds.ch2 = ch2PulseSamples > 0 ? 1 : 0;
            },

            reset() {
                ch1Counter = 0;
                ch2Counter = 0;
                ch1SamplesSinceLastClock = 0;
                ch2SamplesSinceLastClock = 0;
                ch1PulseSamples = 0;
                ch2PulseSamples = 0;
                lastClockState = false;
                this.leds.ch1 = 0;
                this.leds.ch2 = 0;
            },

            getRatios() {
                return RATIOS;
            }
        };
    },

    ui: {
        leds: ['ch1', 'ch2'],
        knobs: [
            { id: 'rate1', label: 'Rate1', param: 'rate1', min: 0, max: 1, default: 0.5 },
            { id: 'rate2', label: 'Rate2', param: 'rate2', min: 0, max: 1, default: 0.5 }
        ],
        inputs: [
            { id: 'clock', label: 'In', port: 'clock', type: 'trigger' },
            { id: 'rate1CV', label: 'CV1', port: 'rate1CV', type: 'cv' },
            { id: 'rate2CV', label: 'CV2', port: 'rate2CV', type: 'cv' }
        ],
        outputs: [
            { id: 'out1', label: 'Out1', port: 'out1', type: 'trigger' },
            { id: 'out2', label: 'Out2', port: 'out2', type: 'trigger' }
        ]
    }
};
