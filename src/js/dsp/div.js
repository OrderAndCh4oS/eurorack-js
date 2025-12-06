import { clamp } from '../utils/math.js';

/**
 * 2HP Div – Dual Clock Divider/Multiplier
 *
 * Based on the 2hp Div module specifications:
 * - 2 independent channels
 * - Division/Multiplication: /16, /8, /7, /6, /5, /4, /3, /2, x1, x2, x3, x4, x5, x6, x7, x8, x16
 * - CV input per channel: 0V to 5V
 * - Clock input threshold: 2.5V
 * - Output matches input pulse height
 *
 * Params:
 *   rate1: 0-1 (maps to /16 through x16)
 *   rate2: 0-1 (maps to /16 through x16)
 *
 * Inputs:
 *   clock: Clock input buffer (2.5V threshold)
 *   rate1CV: 0-5V CV for channel 1
 *   rate2CV: 0-5V CV for channel 2
 *
 * Outputs:
 *   out1: Channel 1 output buffer
 *   out2: Channel 2 output buffer
 *
 * @param {Object} options
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @returns {Object} Div module
 */
export function createDiv({ bufferSize = 512, sampleRate = 44100 } = {}) {
    const out1 = new Float32Array(bufferSize);
    const out2 = new Float32Array(bufferSize);

    // Division/multiplication ratios (17 steps)
    // Left side = divide, center = pass-through, right side = multiply
    const RATIOS = [
        1/16, 1/8, 1/7, 1/6, 1/5, 1/4, 1/3, 1/2,  // divisions
        1,                                          // pass-through
        2, 3, 4, 5, 6, 7, 8, 16                    // multiplications
    ];

    // State for each channel
    let lastClockState = false;
    let inputPulseHeight = 10;

    // Channel 1 state
    let ch1Counter = 0;
    let ch1MultiplyPhase = 0;
    let ch1LastPeriod = sampleRate; // Default 1 second
    let ch1SamplesSinceLastClock = 0;

    // Channel 2 state
    let ch2Counter = 0;
    let ch2MultiplyPhase = 0;
    let ch2LastPeriod = sampleRate;
    let ch2SamplesSinceLastClock = 0;

    // Pulse state (1ms pulse for high-frequency compatibility)
    const pulseWidth = Math.floor(0.001 * sampleRate); // 1ms pulse
    let ch1PulseSamples = 0;
    let ch2PulseSamples = 0;

    /**
     * Map rate value (0-1) to ratio index (0-16)
     */
    function rateToRatioIndex(rate) {
        return Math.round(clamp(rate, 0, 1) * (RATIOS.length - 1));
    }

    /**
     * Process a channel's division/multiplication logic
     */
    function processChannel(ratio, clockEdge, samplesSinceClock, lastPeriod) {
        let triggerOutput = false;

        if (ratio < 1) {
            // Division mode: output every N input clocks
            const divideBy = Math.round(1 / ratio);
            if (clockEdge) {
                if ((Math.floor(samplesSinceClock / lastPeriod) + 1) % divideBy === 0) {
                    triggerOutput = true;
                }
            }
        } else if (ratio > 1) {
            // Multiplication mode: output N times per input clock period
            const multiplyBy = Math.round(ratio);
            const phasePerPulse = lastPeriod / multiplyBy;
            const currentPhase = samplesSinceClock % phasePerPulse;

            // Trigger at the start of each sub-period
            if (currentPhase < 1) {
                triggerOutput = true;
            }
        } else {
            // Pass-through mode (ratio === 1)
            if (clockEdge) {
                triggerOutput = true;
            }
        }

        return triggerOutput;
    }

    return {
        params: {
            rate1: 0.5,     // Rate 1 knob (0-1, center = pass-through)
            rate2: 0.5      // Rate 2 knob (0-1, center = pass-through)
        },

        inputs: {
            clock: new Float32Array(bufferSize),    // Clock input
            rate1CV: new Float32Array(bufferSize),  // Rate 1 CV (0-5V)
            rate2CV: new Float32Array(bufferSize)   // Rate 2 CV (0-5V)
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
                // Detect clock edge (2.5V threshold per 2hp spec)
                const clockHigh = clockIn[i] > 2.5;
                const clockEdge = clockHigh && !lastClockState;

                if (clockHigh) {
                    inputPulseHeight = clockIn[i];
                }

                if (clockEdge) {
                    // Store period for multiplication calculations
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

                // Apply CV modulation (0-5V maps to 0-1)
                const cv1 = clamp(rate1CVIn[i], 0, 5) / 5;
                const cv2 = clamp(rate2CVIn[i], 0, 5) / 5;
                const rate1 = clamp(baseRate1 + cv1, 0, 1);
                const rate2 = clamp(baseRate2 + cv2, 0, 1);

                // Get ratios
                const ratio1 = RATIOS[rateToRatioIndex(rate1)];
                const ratio2 = RATIOS[rateToRatioIndex(rate2)];

                // Channel 1 processing
                if (ratio1 < 1) {
                    // Division: count clocks
                    const divideBy = Math.round(1 / ratio1);
                    if (clockEdge && ch1Counter % divideBy === 0) {
                        ch1PulseSamples = pulseWidth;
                    }
                } else if (ratio1 > 1) {
                    // Multiplication: generate pulses within period
                    const multiplyBy = Math.round(ratio1);
                    const phasePerPulse = ch1LastPeriod / multiplyBy;
                    if (ch1SamplesSinceLastClock % Math.floor(phasePerPulse) === 0) {
                        ch1PulseSamples = pulseWidth;
                    }
                } else {
                    // Pass-through
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

                // Output pulses (match input pulse height)
                out1[i] = ch1PulseSamples > 0 ? inputPulseHeight : 0;
                out2[i] = ch2PulseSamples > 0 ? inputPulseHeight : 0;

                if (ch1PulseSamples > 0) ch1PulseSamples--;
                if (ch2PulseSamples > 0) ch2PulseSamples--;

                ch1SamplesSinceLastClock++;
                ch2SamplesSinceLastClock++;
            }

            // LED indicators
            this.leds.ch1 = ch1PulseSamples > 0 ? 1 : 0;
            this.leds.ch2 = ch2PulseSamples > 0 ? 1 : 0;
        },

        /**
         * Reset all counters
         */
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

        /**
         * Get the ratio array for testing/display
         */
        getRatios() {
            return RATIOS;
        }
    };
}

/**
 * Division/multiplication ratio names for UI display
 */
export const DIV_RATIO_NAMES = [
    '/16', '/8', '/7', '/6', '/5', '/4', '/3', '/2',
    'x1',
    'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x16'
];
