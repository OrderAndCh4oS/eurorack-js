/**
 * MIX - 4 Channel DC-Coupled Mixer
 *
 * Based on 2hp Mix module specifications.
 * - 4 inputs with individual level controls
 * - 1 summed output
 * - DC coupled for audio or CV signals
 * - Low noise floor
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'mix',
    name: 'MIX',
    hp: 4,
    color: '#5a5a5a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const leds = { level: 0 };

        // Own input buffers for audio silence pattern
        const ownIn1 = new Float32Array(bufferSize);
        const ownIn2 = new Float32Array(bufferSize);
        const ownIn3 = new Float32Array(bufferSize);
        const ownIn4 = new Float32Array(bufferSize);

        // LED decay coefficient (~100ms decay)
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        return {
            params: {
                lvl1: 1,
                lvl2: 1,
                lvl3: 1,
                lvl4: 1
            },
            inputs: {
                in1: ownIn1,
                in2: ownIn2,
                in3: ownIn3,
                in4: ownIn4
            },
            outputs: { out },
            leds,

            clearAudioInputs() {
                ownIn1.fill(0);
                ownIn2.fill(0);
                ownIn3.fill(0);
                ownIn4.fill(0);
                this.inputs.in1 = ownIn1;
                this.inputs.in2 = ownIn2;
                this.inputs.in3 = ownIn3;
                this.inputs.in4 = ownIn4;
            },

            process() {
                const l1 = clamp(this.params.lvl1, 0, 1);
                const l2 = clamp(this.params.lvl2, 0, 1);
                const l3 = clamp(this.params.lvl3, 0, 1);
                const l4 = clamp(this.params.lvl4, 0, 1);

                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const sum =
                        this.inputs.in1[i] * l1 +
                        this.inputs.in2[i] * l2 +
                        this.inputs.in3[i] * l3 +
                        this.inputs.in4[i] * l4;

                    out[i] = sum;
                    peak = Math.max(peak, Math.abs(sum));
                }

                // Update LED with peak and decay
                leds.level = Math.max(peak / 10, leds.level * ledDecay);

                // Reset replaced input buffers (audio silence pattern)
                if (this.inputs.in1 !== ownIn1) {
                    ownIn1.fill(0);
                    this.inputs.in1 = ownIn1;
                }
                if (this.inputs.in2 !== ownIn2) {
                    ownIn2.fill(0);
                    this.inputs.in2 = ownIn2;
                }
                if (this.inputs.in3 !== ownIn3) {
                    ownIn3.fill(0);
                    this.inputs.in3 = ownIn3;
                }
                if (this.inputs.in4 !== ownIn4) {
                    ownIn4.fill(0);
                    this.inputs.in4 = ownIn4;
                }
            },

            reset() {
                out.fill(0);
                leds.level = 0;
            }
        };
    },

    ui: {
        leds: ['level'],
        knobs: [
            { id: 'lvl1', label: '1', param: 'lvl1', min: 0, max: 1, default: 0.8 },
            { id: 'lvl2', label: '2', param: 'lvl2', min: 0, max: 1, default: 0.8 },
            { id: 'lvl3', label: '3', param: 'lvl3', min: 0, max: 1, default: 0.8 },
            { id: 'lvl4', label: '4', param: 'lvl4', min: 0, max: 1, default: 0.8 }
        ],
        inputs: [
            { id: 'in1', label: '1', port: 'in1', type: 'buffer' },
            { id: 'in2', label: '2', port: 'in2', type: 'buffer' },
            { id: 'in3', label: '3', port: 'in3', type: 'buffer' },
            { id: 'in4', label: '4', port: 'in4', type: 'buffer' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'buffer' }
        ]
    }
};
