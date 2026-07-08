/**
 * MATRIX - 4x4 DC-Coupled Matrix Mixer
 *
 * Inspired by manual Eurorack matrix mixers such as the Doepfer A-138m and
 * AI Synthesis AI008. Each output column can be unipolar or bipolar.
 */

import { clamp } from '../../utils/math.js';

const OUTPUTS = [
    {
        port: 'outA',
        led: 'outA',
        mode: 'modeA',
        params: ['a1', 'a2', 'a3', 'a4']
    },
    {
        port: 'outB',
        led: 'outB',
        mode: 'modeB',
        params: ['b1', 'b2', 'b3', 'b4']
    },
    {
        port: 'outC',
        led: 'outC',
        mode: 'modeC',
        params: ['c1', 'c2', 'c3', 'c4']
    },
    {
        port: 'outD',
        led: 'outD',
        mode: 'modeD',
        params: ['d1', 'd2', 'd3', 'd4']
    }
];

function gainFor(value, mode) {
    const amount = clamp(value, 0, 1);
    return mode >= 0.5 ? (amount - 0.5) * 2 : amount;
}

function createRouteKnobs() {
    const knobs = [];
    ['A', 'B', 'C', 'D'].forEach(output => {
        [1, 2, 3, 4].forEach(input => {
            const param = `${output.toLowerCase()}${input}`;
            knobs.push({
                id: param,
                label: `${input}>${output}`,
                param,
                min: 0,
                max: 1,
                default: 0
            });
        });
    });
    return knobs;
}

export default {
    id: 'matrix',
    name: 'MATRIX',
    hp: 8,
    color: 'module-color-ten',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ownIn1 = new Float32Array(bufferSize);
        const ownIn2 = new Float32Array(bufferSize);
        const ownIn3 = new Float32Array(bufferSize);
        const ownIn4 = new Float32Array(bufferSize);
        const inputs = [ownIn1, ownIn2, ownIn3, ownIn4];

        const outA = new Float32Array(bufferSize);
        const outB = new Float32Array(bufferSize);
        const outC = new Float32Array(bufferSize);
        const outD = new Float32Array(bufferSize);

        const leds = {
            outA: 0,
            outB: 0,
            outC: 0,
            outD: 0
        };

        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        return {
            params: {
                a1: 0,
                a2: 0,
                a3: 0,
                a4: 0,
                b1: 0,
                b2: 0,
                b3: 0,
                b4: 0,
                c1: 0,
                c2: 0,
                c3: 0,
                c4: 0,
                d1: 0,
                d2: 0,
                d3: 0,
                d4: 0,
                modeA: 0,
                modeB: 0,
                modeC: 0,
                modeD: 0
            },

            inputs: {
                in1: ownIn1,
                in2: ownIn2,
                in3: ownIn3,
                in4: ownIn4
            },

            outputs: {
                outA,
                outB,
                outC,
                outD
            },

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
                const routedInputs = [
                    this.inputs.in1,
                    this.inputs.in2,
                    this.inputs.in3,
                    this.inputs.in4
                ];

                OUTPUTS.forEach(outputConfig => {
                    const output = this.outputs[outputConfig.port];
                    const mode = this.params[outputConfig.mode];
                    const gains = outputConfig.params.map(param => gainFor(this.params[param], mode));
                    let peak = 0;

                    for (let i = 0; i < bufferSize; i++) {
                        const sum =
                            routedInputs[0][i] * gains[0] +
                            routedInputs[1][i] * gains[1] +
                            routedInputs[2][i] * gains[2] +
                            routedInputs[3][i] * gains[3];

                        output[i] = sum;
                        peak = Math.max(peak, Math.abs(sum));
                    }

                    leds[outputConfig.led] = Math.max(clamp(peak / 10, 0, 1), leds[outputConfig.led] * ledDecay);
                });

                if (this.inputs.in1 !== inputs[0]) {
                    ownIn1.fill(0);
                    this.inputs.in1 = ownIn1;
                }
                if (this.inputs.in2 !== inputs[1]) {
                    ownIn2.fill(0);
                    this.inputs.in2 = ownIn2;
                }
                if (this.inputs.in3 !== inputs[2]) {
                    ownIn3.fill(0);
                    this.inputs.in3 = ownIn3;
                }
                if (this.inputs.in4 !== inputs[3]) {
                    ownIn4.fill(0);
                    this.inputs.in4 = ownIn4;
                }
            },

            reset() {
                outA.fill(0);
                outB.fill(0);
                outC.fill(0);
                outD.fill(0);
                leds.outA = 0;
                leds.outB = 0;
                leds.outC = 0;
                leds.outD = 0;
            }
        };
    },

    ui: {
        leds: ['outA', 'outB', 'outC', 'outD'],
        knobs: createRouteKnobs(),
        switches: [
            { id: 'modeA', label: 'A Pol', param: 'modeA', default: 0 },
            { id: 'modeB', label: 'B Pol', param: 'modeB', default: 0 },
            { id: 'modeC', label: 'C Pol', param: 'modeC', default: 0 },
            { id: 'modeD', label: 'D Pol', param: 'modeD', default: 0 }
        ],
        inputs: [
            { id: 'in1', label: 'In1', port: 'in1', type: 'buffer' },
            { id: 'in2', label: 'In2', port: 'in2', type: 'buffer' },
            { id: 'in3', label: 'In3', port: 'in3', type: 'buffer' },
            { id: 'in4', label: 'In4', port: 'in4', type: 'buffer' }
        ],
        outputs: [
            { id: 'outA', label: 'A', port: 'outA', type: 'buffer' },
            { id: 'outB', label: 'B', port: 'outB', type: 'buffer' },
            { id: 'outC', label: 'C', port: 'outC', type: 'buffer' },
            { id: 'outD', label: 'D', port: 'outD', type: 'buffer' }
        ]
    }
};
