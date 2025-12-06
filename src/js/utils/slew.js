/**
 * Capacitor Slew – RC low-pass filter for CV smoothing
 *
 * Simulates capacitor charging/discharging in real analog circuits.
 * Creates a one-pole IIR filter with configurable time constant.
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.timeMs - Rise/fall time constant in milliseconds (default: 5)
 * @returns {Object} Slew processor with process(), processBuffer(), and reset() methods
 */
export function createSlew({ sampleRate = 44100, timeMs = 5 } = {}) {
    let state = 0;
    /* RC coefficient: how much of the difference to apply per sample */
    let coeff = 1 - Math.exp(-1000 / (sampleRate * timeMs));

    return {
        /**
         * Update slew rate at runtime
         */
        set timeMs(ms) {
            coeff = 1 - Math.exp(-1000 / (sampleRate * Math.max(0.1, ms)));
        },

        /**
         * Process a single sample
         * @param {number} input - Input value
         * @returns {number} Smoothed output value
         */
        process(input) {
            state += coeff * (input - state);
            return state;
        },

        /**
         * Process an entire buffer
         * @param {Float32Array} inputBuf - Input buffer
         * @param {Float32Array} outputBuf - Output buffer (modified in place)
         */
        processBuffer(inputBuf, outputBuf) {
            for (let i = 0; i < inputBuf.length; i++) {
                state += coeff * (inputBuf[i] - state);
                outputBuf[i] = state;
            }
        },

        /**
         * Reset the slew state
         * @param {number} value - Value to reset to (default: 0)
         */
        reset(value = 0) {
            state = value;
        }
    };
}
