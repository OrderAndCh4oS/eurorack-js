/**
 * Test - Probability Sequencer
 * Probability, conditional steps, and ratchets driving a closed hi-hat.
 */
export default {
    name: 'Test - Probability Sequencer',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'probSeq', type: 'prob-seq', row: 1, index: 1 },
            { id: 'hat', type: 'hat', row: 1, index: 2 },
            { id: 'scope', type: 'scope', row: 1, index: 3 },
            { id: 'out', type: 'out', row: 1, index: 4 }
        ],
        params: {
            clk: {
                rate: 0.42,
                pause: 0
            },
            probSeq: {
                seed: 73,
                length: 8,
                fallbackBpm: 120,
                steps: [
                    { enabled: 1, probability: 100, ratchets: 1, condition: 0 },
                    { enabled: 1, probability: 72, ratchets: 2, condition: 1 },
                    { enabled: 1, probability: 86, ratchets: 3, condition: 5 },
                    { enabled: 1, probability: 100, ratchets: 1, condition: 2 },
                    { enabled: 1, probability: 55, ratchets: 4, condition: 6 },
                    { enabled: 0, probability: 100, ratchets: 1, condition: 0 },
                    { enabled: 1, probability: 68, ratchets: 2, condition: 7 },
                    { enabled: 1, probability: 92, ratchets: 6, condition: 10 }
                ]
            },
            hat: {
                decay: 0.26,
                sizzle: 0.72,
                blend: 0.64
            },
            scope: {
                time: 0.24,
                trigger: 0.5,
                gain1: 0.5,
                gain2: 0.5,
                offset1: 0.5,
                offset2: 0.5,
                mode: 0
            },
            out: {
                volume: 0.55
            }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'probSeq', toPort: 'clock' },
            { fromModule: 'probSeq', fromPort: 'gate', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'probSeq', fromPort: 'gate', toModule: 'scope', toPort: 'in1' },
            { fromModule: 'probSeq', fromPort: 'eoc', toModule: 'scope', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
