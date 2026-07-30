/**
 * MATRIX - 4x4 DC-Coupled Matrix Mixer
 *
 * Inspired by manual Eurorack matrix mixers such as the Doepfer A-138m and
 * AI Synthesis AI008. Each output column can be unipolar or bipolar.
 */

import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';

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
    const amount = Number.isFinite(value) ? clamp(value, 0, 1) : 0;
    const bipolar = Number.isFinite(mode) && mode >= 0.5;
    return bipolar ? (amount - 0.5) * 2 : amount;
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
        const outA = new Float32Array(bufferSize);
        const outB = new Float32Array(bufferSize);
        const outC = new Float32Array(bufferSize);
        const outD = new Float32Array(bufferSize);
        const routedInputs = [ownIn1, ownIn2, ownIn3, ownIn4];
        const targetGains = OUTPUTS.map(() => new Float64Array(4));
        const routeSlews = Object.fromEntries(
            OUTPUTS.flatMap(outputConfig => outputConfig.params)
                .map(param => [param, createSlew({ sampleRate, timeMs: 5 })])
        );
        let routesInitialized = false;

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

            process() {
                OUTPUTS.forEach((outputConfig, outputIndex) => {
                    const mode = this.params[outputConfig.mode];
                    outputConfig.params.forEach((param, routeIndex) => {
                        targetGains[outputIndex][routeIndex] = gainFor(this.params[param], mode);
                    });
                });
                if (!routesInitialized) {
                    OUTPUTS.forEach((outputConfig, outputIndex) => {
                        outputConfig.params.forEach((param, routeIndex) => {
                            routeSlews[param].reset(targetGains[outputIndex][routeIndex]);
                        });
                    });
                    routesInitialized = true;
                }

                OUTPUTS.forEach((outputConfig, outputIndex) => {
                    const output = this.outputs[outputConfig.port];
                    let peak = 0;

                    for (let i = 0; i < bufferSize; i++) {
                        const gain0 = routeSlews[outputConfig.params[0]].process(targetGains[outputIndex][0]);
                        const gain1 = routeSlews[outputConfig.params[1]].process(targetGains[outputIndex][1]);
                        const gain2 = routeSlews[outputConfig.params[2]].process(targetGains[outputIndex][2]);
                        const gain3 = routeSlews[outputConfig.params[3]].process(targetGains[outputIndex][3]);
                        const sum =
                            (Number.isFinite(routedInputs[0][i]) ? routedInputs[0][i] : 0) * gain0 +
                            (Number.isFinite(routedInputs[1][i]) ? routedInputs[1][i] : 0) * gain1 +
                            (Number.isFinite(routedInputs[2][i]) ? routedInputs[2][i] : 0) * gain2 +
                            (Number.isFinite(routedInputs[3][i]) ? routedInputs[3][i] : 0) * gain3;

                        output[i] = softLimitVoltage(sum, 10);
                        peak = Math.max(peak, Math.abs(output[i]));
                    }

                    leds[outputConfig.led] = Math.max(clamp(peak / 10, 0, 1), leds[outputConfig.led] * ledDecay);
                });
            },

            reset() {
                ownIn1.fill(0);
                ownIn2.fill(0);
                ownIn3.fill(0);
                ownIn4.fill(0);
                outA.fill(0);
                outB.fill(0);
                outC.fill(0);
                outD.fill(0);
                Object.values(routeSlews).forEach(routeSlew => routeSlew.reset(0));
                routesInitialized = false;
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
            { id: 'in1', label: 'In1', port: 'in1', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in2', label: 'In2', port: 'in2', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in3', label: 'In3', port: 'in3', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'in4', label: 'In4', port: 'in4', signal: 'any', voltage: { min: -10, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'outA', label: 'A', port: 'outA', signal: 'any', voltage: { min: -10, max: 10 } },
            { id: 'outB', label: 'B', port: 'outB', signal: 'any', voltage: { min: -10, max: 10 } },
            { id: 'outC', label: 'C', port: 'outC', signal: 'any', voltage: { min: -10, max: 10 } },
            { id: 'outD', label: 'D', port: 'outD', signal: 'any', voltage: { min: -10, max: 10 } }
        ]
    }
};
