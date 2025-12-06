/**
 * Test - S&H → Pitch
 * Sample & Hold controlling VCO pitch
 */
export default {
    name: 'Test - S&H → Pitch',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'nse', instanceId: 'nse', row: 1 },
            { type: 'sh', instanceId: 'sh', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            nse: { rate: 1 },
            sh: { slew1: 0.2, slew2: 0 },
            clk: { rate: 0.25 },
            vco: { coarse: 0.35, fine: 0, glide: 10 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'nse', fromPort: 'noise', toModule: 'sh', toPort: 'in1' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'sh', toPort: 'trig1' },
            { fromModule: 'sh', fromPort: 'out1', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
