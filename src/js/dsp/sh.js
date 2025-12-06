import { clamp } from '../utils/math.js';
import { createSlew } from '../utils/slew.js';

/**
 * 2HP S+H – Dual Sample & Hold
 *
 * Based on the 2hp S+H module specifications:
 * - 2 independent channels
 * - Wide input range: ±12V
 * - Clocks fast enough to downsample audio
 * - Trigger threshold: standard Eurorack (≥1V)
 *
 * Params:
 *   slew1: 0-1 (channel 1 output smoothing, 0-50ms)
 *   slew2: 0-1 (channel 2 output smoothing, 0-50ms)
 *
 * Inputs:
 *   in1: ±12V signal to sample (channel 1)
 *   in2: ±12V signal to sample (channel 2)
 *   trig1: 0-10V trigger for channel 1 (≥1V threshold)
 *   trig2: 0-10V trigger for channel 2 (≥1V threshold)
 *
 * Outputs:
 *   out1: Sampled & held value (channel 1)
 *   out2: Sampled & held value (channel 2)
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} S+H module
 */
export function createSH({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const out1 = new Float32Array(bufferSize);
    const out2 = new Float32Array(bufferSize);

    // Held values for each channel
    let held1 = 0;
    let held2 = 0;

    // Trigger edge detection
    let lastTrig1 = 0;
    let lastTrig2 = 0;

    // Slew for each channel
    const slew1 = createSlew({ sampleRate, timeMs: 0.5 });
    const slew2 = createSlew({ sampleRate, timeMs: 0.5 });

    return {
        params: {
            slew1: 0,   // Channel 1 slew (0-1 maps to 0-50ms)
            slew2: 0    // Channel 2 slew (0-1 maps to 0-50ms)
        },

        inputs: {
            in1: new Float32Array(bufferSize),     // Channel 1 input (±12V)
            in2: new Float32Array(bufferSize),     // Channel 2 input (±12V)
            trig1: new Float32Array(bufferSize),   // Channel 1 trigger
            trig2: new Float32Array(bufferSize)    // Channel 2 trigger
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
            const in1Buf = this.inputs.in1;
            const in2Buf = this.inputs.in2;
            const trig1Buf = this.inputs.trig1;
            const trig2Buf = this.inputs.trig2;

            // Update slew times (0 to 50ms)
            slew1.timeMs = clamp(this.params.slew1, 0, 1) * 50;
            slew2.timeMs = clamp(this.params.slew2, 0, 1) * 50;

            for (let i = 0; i < bufferSize; i++) {
                // Channel 1: Check for trigger edge (≥1V threshold)
                const trig1High = trig1Buf[i] >= 1;
                if (trig1High && lastTrig1 < 1) {
                    // Sample on rising edge
                    held1 = in1Buf[i];
                }
                lastTrig1 = trig1Buf[i];

                // Channel 2: Check for trigger edge
                const trig2High = trig2Buf[i] >= 1;
                if (trig2High && lastTrig2 < 1) {
                    held2 = in2Buf[i];
                }
                lastTrig2 = trig2Buf[i];

                // Apply slew to outputs
                if (this.params.slew1 > 0.01) {
                    out1[i] = slew1.process(held1);
                } else {
                    out1[i] = held1;
                }

                if (this.params.slew2 > 0.01) {
                    out2[i] = slew2.process(held2);
                } else {
                    out2[i] = held2;
                }
            }

            // LED indicators (normalized 0-1 from ±5V range)
            this.leds.ch1 = clamp(Math.abs(held1) / 5, 0, 1);
            this.leds.ch2 = clamp(Math.abs(held2) / 5, 0, 1);
        },

        reset() {
            held1 = 0;
            held2 = 0;
            lastTrig1 = 0;
            lastTrig2 = 0;
            out1.fill(0);
            out2.fill(0);
            this.leds.ch1 = 0;
            this.leds.ch2 = 0;
        }
    };
}
