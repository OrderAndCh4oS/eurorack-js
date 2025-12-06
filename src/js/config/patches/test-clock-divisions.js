/**
 * Test - Clock Divisions
 * Clock divider test
 */
export default {
    name: 'Test - Clock Divisions',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.28 },
            div: { rate1: 0.5, rate2: 0.3125 },
            vco: { coarse: 0.3, fine: 0, glide: 2 },
            adsr: { attack: 0.05, decay: 0.2, sustain: 0.0, release: 0.15 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
