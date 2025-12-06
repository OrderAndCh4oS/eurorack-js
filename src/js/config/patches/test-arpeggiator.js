/**
 * Test - Arpeggiator
 * Arpeggiator module test
 */
export default {
    name: 'Test - Arpeggiator',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'arp', instanceId: 'arp', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.25 },
            arp: { root: 0, chord: 1, mode: 0 },
            vco: { coarse: 0.35, fine: 0, glide: 10 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            arp: { octaves: 2 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },
            { fromModule: 'arp', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
