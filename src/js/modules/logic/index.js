/**
 * Logic Module
 *
 * Based on: 2hp Logic
 * Two independent boolean operators with AND and OR outputs.
 *
 * Inputs:
 * - AND A/B: Gate/trigger inputs for AND
 * - OR A/B: Gate/trigger inputs for OR, normalled from AND A/B
 *
 * Outputs:
 * - AND: High (5V) when both AND inputs are high
 * - OR: High (5V) when either OR input is high
 *
 * Threshold: Signals >2.5V are considered HIGH
 *
 * References:
 * - https://www.twohp.com/modules/p/logic
 * - https://modulargrid.net/e/2hp-logic
 */

export default {
    id: 'logic',
    name: 'LOGIC',
    hp: 4,
    color: 'module-color-four',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const andOut = new Float32Array(bufferSize);
        const orOut = new Float32Array(bufferSize);
        const andA = new Float32Array(bufferSize);
        const andB = new Float32Array(bufferSize);
        const orA = new Float32Array(bufferSize);
        const orB = new Float32Array(bufferSize);
        let orAConnected = false;
        let orBConnected = false;

        // Comparator and output levels from the 2hp Logic manual.
        const THRESHOLD = 2.5;
        // Output gate voltage
        const GATE_HIGH = 5;

        return {
            params: {},

            inputs: {
                andA,
                andB,
                orA,
                orB
            },

            outputs: {
                and: andOut,
                or: orOut
            },

            leds: {
                and: 0,
                or: 0
            },

            onInputConnectionChange(port, connected) {
                if (port === 'orA') orAConnected = Boolean(connected);
                if (port === 'orB') orBConnected = Boolean(connected);
            },

            process() {
                const orInputA = orAConnected ? orA : andA;
                const orInputB = orBConnected ? orB : andB;

                let andHigh = false;
                let orHigh = false;

                for (let i = 0; i < bufferSize; i++) {
                    const a = andA[i] > THRESHOLD;
                    const b = andB[i] > THRESHOLD;
                    const c = orInputA[i] > THRESHOLD;
                    const d = orInputB[i] > THRESHOLD;

                    // AND: both must be high
                    andOut[i] = (a && b) ? GATE_HIGH : 0;

                    // OR: either must be high
                    orOut[i] = (c || d) ? GATE_HIGH : 0;

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
                andA.fill(0);
                andB.fill(0);
                orA.fill(0);
                orB.fill(0);
                this.leds.and = 0;
                this.leds.or = 0;
            }
        };
    },

    ui: {
        leds: ['and', 'or'],
        inputs: [
            { id: 'andA', label: 'AND A', port: 'andA', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'andB', label: 'AND B', port: 'andB', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'orA', label: 'OR A', port: 'orA', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'orB', label: 'OR B', port: 'orB', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'and', label: 'AND', port: 'and', signal: 'gate', voltage: { min: 0, max: 5 } },
            { id: 'or', label: 'OR', port: 'or', signal: 'gate', voltage: { min: 0, max: 5 } }
        ]
    }
};
