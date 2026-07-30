/**
 * S+H - Dual Sample & Hold
 *
 * Based on the 2hp S+H module specifications:
 * - 2 independent channels
 * - Wide input range: ±12V
 * - Clocks fast enough to downsample audio
 * - Trigger threshold: standard Eurorack (≥1V)
 */

import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'sh',
    name: 'S+H',
    hp: 4,
    color: 'module-color-twelve',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const in1 = new Float32Array(bufferSize);
        const in2 = new Float32Array(bufferSize);
        const trig1 = new Float32Array(bufferSize);
        const trig2 = new Float32Array(bufferSize);
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);

        // Held values
        let held1 = 0;
        let held2 = 0;

        // Trigger edge detection
        let lastTrig1High = false;
        let lastTrig2High = false;

        // Slew for each channel
        const slew1 = createSlew({ sampleRate, timeMs: 0.5 });
        const slew2 = createSlew({ sampleRate, timeMs: 0.5 });

        return {
            params: {
                slew1: 0,
                slew2: 0
            },

            inputs: {
                in1,
                in2,
                trig1,
                trig2
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
                const safeSlew1 = Number.isFinite(this.params.slew1)
                    ? clamp(this.params.slew1, 0, 1)
                    : 0;
                const safeSlew2 = Number.isFinite(this.params.slew2)
                    ? clamp(this.params.slew2, 0, 1)
                    : 0;

                // Update slew times (0 to 50ms)
                slew1.timeMs = safeSlew1 * 50;
                slew2.timeMs = safeSlew2 * 50;

                for (let i = 0; i < bufferSize; i++) {
                    // Channel 1: Check for trigger edge
                    const trig1High = Number.isFinite(trig1[i]) && trig1[i] >= 1;
                    if (trig1High && !lastTrig1High) {
                        held1 = Number.isFinite(in1[i]) ? clamp(in1[i], -12, 12) : 0;
                    }
                    lastTrig1High = trig1High;

                    // Channel 2: Check for trigger edge
                    const trig2High = Number.isFinite(trig2[i]) && trig2[i] >= 1;
                    if (trig2High && !lastTrig2High) {
                        held2 = Number.isFinite(in2[i]) ? clamp(in2[i], -12, 12) : 0;
                    }
                    lastTrig2High = trig2High;

                    // Apply slew
                    if (safeSlew1 > 0) {
                        out1[i] = slew1.process(held1);
                    } else {
                        slew1.reset(held1);
                        out1[i] = held1;
                    }

                    if (safeSlew2 > 0) {
                        out2[i] = slew2.process(held2);
                    } else {
                        slew2.reset(held2);
                        out2[i] = held2;
                    }
                }

                // LED indicators
                this.leds.ch1 = clamp(Math.abs(held1) / 5, 0, 1);
                this.leds.ch2 = clamp(Math.abs(held2) / 5, 0, 1);
            },

            reset() {
                held1 = 0;
                held2 = 0;
                lastTrig1High = false;
                lastTrig2High = false;
                in1.fill(0);
                in2.fill(0);
                trig1.fill(0);
                trig2.fill(0);
                out1.fill(0);
                out2.fill(0);
                slew1.reset(0);
                slew2.reset(0);
                this.leds.ch1 = 0;
                this.leds.ch2 = 0;
            }
        };
    },

    ui: {
        leds: ['ch1', 'ch2'],
        knobs: [
            { id: 'slew1', label: 'Slew1', param: 'slew1', min: 0, max: 1, default: 0 },
            { id: 'slew2', label: 'Slew2', param: 'slew2', min: 0, max: 1, default: 0 }
        ],
        inputs: [
            { id: 'in1', label: 'In1', port: 'in1', signal: 'any', voltage: { min: -12, max: 12, normal: 0 } },
            { id: 'in2', label: 'In2', port: 'in2', signal: 'any', voltage: { min: -12, max: 12, normal: 0 } },
            { id: 'trig1', label: 'Trg1', port: 'trig1', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'trig2', label: 'Trg2', port: 'trig2', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'out1', label: 'Out1', port: 'out1', signal: 'any', voltage: { min: -12, max: 12 } },
            { id: 'out2', label: 'Out2', port: 'out2', signal: 'any', voltage: { min: -12, max: 12 } }
        ]
    }
};
