/**
 * Logic Module
 *
 * Based on: 2hp Logic
 * 2-channel boolean gate operator with AND and OR outputs.
 *
 * Inputs:
 * - IN 1: Gate/trigger input 1
 * - IN 2: Gate/trigger input 2
 *
 * Outputs:
 * - AND: High (10V) when both inputs are high
 * - OR: High (10V) when either input is high
 *
 * Threshold: Signals >= 1V are considered HIGH
 *
 * References:
 * - https://www.twohp.com/modules/p/logic
 * - https://modulargrid.net/e/2hp-logic
 */

export default {
    id: 'logic',
    name: 'LOGIC',
    hp: 4,
    color: '#4a7c59',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const andOut = new Float32Array(bufferSize);
        const orOut = new Float32Array(bufferSize);

        // Gate threshold (1V)
        const THRESHOLD = 1;
        // Output gate voltage
        const GATE_HIGH = 10;

        return {
            params: {},

            inputs: {
                in1: new Float32Array(bufferSize),
                in2: new Float32Array(bufferSize)
            },

            outputs: {
                and: andOut,
                or: orOut
            },

            leds: {
                and: 0,
                or: 0
            },

            process() {
                const { in1, in2 } = this.inputs;

                let andHigh = false;
                let orHigh = false;

                for (let i = 0; i < bufferSize; i++) {
                    const a = in1[i] >= THRESHOLD;
                    const b = in2[i] >= THRESHOLD;

                    // AND: both must be high
                    andOut[i] = (a && b) ? GATE_HIGH : 0;

                    // OR: either must be high
                    orOut[i] = (a || b) ? GATE_HIGH : 0;

                    // Track if any sample was high (for LEDs)
                    if (andOut[i] > 0) andHigh = true;
                    if (orOut[i] > 0) orHigh = true;
                }

                // Update LEDs based on last state in buffer
                this.leds.and = andHigh ? 1 : 0;
                this.leds.or = orHigh ? 1 : 0;
            },

            reset() {
                andOut.fill(0);
                orOut.fill(0);
                this.leds.and = 0;
                this.leds.or = 0;
            }
        };
    },

    ui: {
        leds: ['and', 'or'],
        inputs: [
            { id: 'in1', label: 'In 1', port: 'in1', type: 'gate' },
            { id: 'in2', label: 'In 2', port: 'in2', type: 'gate' }
        ],
        outputs: [
            { id: 'and', label: 'AND', port: 'and', type: 'gate' },
            { id: 'or', label: 'OR', port: 'or', type: 'gate' }
        ]
    }
};
