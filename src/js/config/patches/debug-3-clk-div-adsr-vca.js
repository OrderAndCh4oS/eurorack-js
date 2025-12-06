/**
 * Debug 3 - Clk→Div→ADSR→VCA
 * Signal chain: Clock through divider to ADSR controlling VCA
 */
export default {
    name: 'Debug 3 - Clk→Div→ADSR→VCA',
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
            clk: { rate: 0.25 },
            div: { rate1: 0.4375, rate2: 0.5 },
            vco: { coarse: 0.3, fine: 0, glide: 5 },
            adsr: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.3 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
