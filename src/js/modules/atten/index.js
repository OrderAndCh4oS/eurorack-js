/**
 * ATTEN - Dual Attenuverter with Offset
 *
 * Based on Mutable Instruments Shades (simplified to 2 channels).
 * A utility module for scaling, inverting, and offsetting CV signals.
 *
 * Features:
 * - 2 independent channels
 * - Attenuverter: gain from -1 (inverted) through 0 (muted) to +1 (unity)
 * - Offset: adds ±5V DC offset to output
 * - LED shows output level (0=negative, 0.5=zero, 1=positive)
 *
 * Common uses:
 * - Scale CV to appropriate ranges
 * - Invert modulation direction
 * - Convert bipolar (±5V) to unipolar (0-10V)
 * - Generate DC voltage (with unpatched input)
 *
 * Source: https://pichenettes.github.io/mutable-instruments-documentation/modules/shades_2020/manual/
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'atten',
    name: 'ATTN',
    hp: 4,
    color: '#6a5a6a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);

        return {
            params: {
                // Attenuverter: 0-1 maps to gain -1 to +1 (0.5 = muted)
                atten1: 1,    // Default to unity (full CW)
                atten2: 1,
                // Offset: 0-1 maps to -5V to +5V (0.5 = no offset)
                offset1: 0.5,
                offset2: 0.5
            },

            inputs: {
                in1: new Float32Array(bufferSize),
                in2: new Float32Array(bufferSize)
            },

            outputs: {
                out1,
                out2
            },

            leds: {
                ch1: 0.5,
                ch2: 0.5
            },

            process() {
                const in1 = this.inputs.in1;
                const in2 = this.inputs.in2;
                const { atten1, atten2, offset1, offset2 } = this.params;

                // Convert knob positions to actual values
                // Attenuverter: 0->-1, 0.5->0, 1->+1
                const att1 = (atten1 - 0.5) * 2;
                const att2 = (atten2 - 0.5) * 2;

                // Offset: 0->-5V, 0.5->0V, 1->+5V
                const off1 = (offset1 - 0.5) * 10;
                const off2 = (offset2 - 0.5) * 10;

                let sum1 = 0;
                let sum2 = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Apply attenuation/inversion and offset, clamp to ±10V
                    out1[i] = clamp(in1[i] * att1 + off1, -10, 10);
                    out2[i] = clamp(in2[i] * att2 + off2, -10, 10);

                    sum1 += out1[i];
                    sum2 += out2[i];
                }

                // LED shows average output level
                // Maps -5V to +5V onto 0 to 1 (0.5 = zero voltage)
                const avg1 = sum1 / bufferSize;
                const avg2 = sum2 / bufferSize;
                this.leds.ch1 = clamp((avg1 + 5) / 10, 0, 1);
                this.leds.ch2 = clamp((avg2 + 5) / 10, 0, 1);
            },

            reset() {
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
            { id: 'atten1', label: 'Att1', param: 'atten1', min: 0, max: 1, default: 1 },
            { id: 'offset1', label: 'Off1', param: 'offset1', min: 0, max: 1, default: 0.5 },
            { id: 'atten2', label: 'Att2', param: 'atten2', min: 0, max: 1, default: 1 },
            { id: 'offset2', label: 'Off2', param: 'offset2', min: 0, max: 1, default: 0.5 }
        ],
        inputs: [
            { id: 'in1', label: 'In1', port: 'in1', type: 'buffer' },
            { id: 'in2', label: 'In2', port: 'in2', type: 'buffer' }
        ],
        outputs: [
            { id: 'out1', label: 'Out1', port: 'out1', type: 'buffer' },
            { id: 'out2', label: 'Out2', port: 'out2', type: 'buffer' }
        ]
    }
};
