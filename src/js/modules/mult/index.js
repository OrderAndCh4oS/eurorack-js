/**
 * Mult Module
 *
 * Based on: 2hp Mult
 * 2-input, 6-output passive signal splitter.
 * Each input is copied to 3 outputs.
 *
 * Inputs:
 * - IN 1: Signal input for channel 1
 * - IN 2: Signal input for channel 2
 *
 * Outputs:
 * - OUT 1A/1B/1C: Copies of IN 1
 * - OUT 2A/2B/2C: Copies of IN 2
 *
 * References:
 * - https://www.twohp.com/modules/p/mult
 * - https://modulargrid.net/e/2hp-mult
 */

export default {
    id: 'mult',
    name: 'MULT',
    hp: 4,
    color: '#5a5a5a',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Channel 1 outputs
        const out1a = new Float32Array(bufferSize);
        const out1b = new Float32Array(bufferSize);
        const out1c = new Float32Array(bufferSize);

        // Channel 2 outputs
        const out2a = new Float32Array(bufferSize);
        const out2b = new Float32Array(bufferSize);
        const out2c = new Float32Array(bufferSize);

        return {
            params: {},

            inputs: {
                in1: new Float32Array(bufferSize),
                in2: new Float32Array(bufferSize)
            },

            outputs: {
                out1a,
                out1b,
                out1c,
                out2a,
                out2b,
                out2c
            },

            leds: {},

            process() {
                const { in1, in2 } = this.inputs;

                for (let i = 0; i < bufferSize; i++) {
                    // Channel 1: copy input to all 3 outputs
                    out1a[i] = in1[i];
                    out1b[i] = in1[i];
                    out1c[i] = in1[i];

                    // Channel 2: copy input to all 3 outputs
                    out2a[i] = in2[i];
                    out2b[i] = in2[i];
                    out2c[i] = in2[i];
                }
            },

            reset() {
                out1a.fill(0);
                out1b.fill(0);
                out1c.fill(0);
                out2a.fill(0);
                out2b.fill(0);
                out2c.fill(0);
            }
        };
    },

    ui: {
        inputs: [
            { id: 'in1', label: 'In 1', port: 'in1', type: 'buffer' },
            { id: 'in2', label: 'In 2', port: 'in2', type: 'buffer' }
        ],
        outputs: [
            { id: 'out1a', label: '1A', port: 'out1a', type: 'buffer' },
            { id: 'out1b', label: '1B', port: 'out1b', type: 'buffer' },
            { id: 'out1c', label: '1C', port: 'out1c', type: 'buffer' },
            { id: 'out2a', label: '2A', port: 'out2a', type: 'buffer' },
            { id: 'out2b', label: '2B', port: 'out2b', type: 'buffer' },
            { id: 'out2c', label: '2C', port: 'out2c', type: 'buffer' }
        ]
    }
};
