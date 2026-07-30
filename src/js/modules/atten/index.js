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
    color: 'module-color-eleven',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const in1 = new Float32Array(bufferSize);
        const in2 = new Float32Array(bufferSize);
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
                in1,
                in2
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
                const { atten1, atten2, offset1, offset2 } = this.params;

                // Convert knob positions to actual values
                // Attenuverter: 0->-1, 0.5->0, 1->+1
                const safeAtten1 = Number.isFinite(atten1) ? clamp(atten1, 0, 1) : 0.5;
                const safeAtten2 = Number.isFinite(atten2) ? clamp(atten2, 0, 1) : 0.5;
                const att1 = (safeAtten1 - 0.5) * 2;
                const att2 = (safeAtten2 - 0.5) * 2;

                // Offset: 0->-5V, 0.5->0V, 1->+5V
                const safeOffset1 = Number.isFinite(offset1) ? clamp(offset1, 0, 1) : 0.5;
                const safeOffset2 = Number.isFinite(offset2) ? clamp(offset2, 0, 1) : 0.5;
                const off1 = (safeOffset1 - 0.5) * 10;
                const off2 = (safeOffset2 - 0.5) * 10;

                let sum1 = 0;
                let sum2 = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Apply attenuation/inversion and offset, clamp to ±10V
                    const sample1 = Number.isFinite(in1[i]) ? in1[i] : 0;
                    const sample2 = Number.isFinite(in2[i]) ? in2[i] : 0;
                    out1[i] = clamp(sample1 * att1 + off1, -10, 10);
                    out2[i] = clamp(sample2 * att2 + off2, -10, 10);

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
                in1.fill(0);
                in2.fill(0);
                out1.fill(0);
                out2.fill(0);
                this.leds.ch1 = 0.5;
                this.leds.ch2 = 0.5;
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
            { id: 'in1', label: 'In1', port: 'in1', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in2', label: 'In2', port: 'in2', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'out1', label: 'Out1', port: 'out1', signal: 'any', voltage: { min: -10, max: 10 } },
            { id: 'out2', label: 'Out2', port: 'out2', signal: 'any', voltage: { min: -10, max: 10 } }
        ]
    }
};
