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
    hp: 2,
    color: '#5a6a5a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);

        // Held values
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
                slew1: 0,
                slew2: 0
            },

            inputs: {
                in1: new Float32Array(bufferSize),
                in2: new Float32Array(bufferSize),
                trig1: new Float32Array(bufferSize),
                trig2: new Float32Array(bufferSize)
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
                    // Channel 1: Check for trigger edge
                    const trig1High = trig1Buf[i] >= 1;
                    if (trig1High && lastTrig1 < 1) {
                        held1 = in1Buf[i];
                    }
                    lastTrig1 = trig1Buf[i];

                    // Channel 2: Check for trigger edge
                    const trig2High = trig2Buf[i] >= 1;
                    if (trig2High && lastTrig2 < 1) {
                        held2 = in2Buf[i];
                    }
                    lastTrig2 = trig2Buf[i];

                    // Apply slew
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

                // LED indicators
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
    },

    ui: {
        leds: ['ch1', 'ch2'],
        knobs: [
            { id: 'slew1', label: 'Slew1', param: 'slew1', min: 0, max: 1, default: 0 },
            { id: 'slew2', label: 'Slew2', param: 'slew2', min: 0, max: 1, default: 0 }
        ],
        inputs: [
            { id: 'in1', label: 'In1', port: 'in1', type: 'buffer' },
            { id: 'in2', label: 'In2', port: 'in2', type: 'buffer' },
            { id: 'trig1', label: 'Trg1', port: 'trig1', type: 'trigger' },
            { id: 'trig2', label: 'Trg2', port: 'trig2', type: 'trigger' }
        ],
        outputs: [
            { id: 'out1', label: 'Out1', port: 'out1', type: 'buffer' },
            { id: 'out2', label: 'Out2', port: 'out2', type: 'buffer' }
        ]
    }
};
