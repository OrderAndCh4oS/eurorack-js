/**
 * Test - Delay
 * VCO through delay with LFO modulating delay time
 */
export default {
    name: 'Test - Delay',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'dly', instanceId: 'dly', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.4 },
            lfo: { rateKnob: 0.11, waveKnob: 0.2 },
            vco: { coarse: 0.38, fine: 0.5, glide: 5 },
            dly: { time: 0.4, feedback: 0.6, mix: 0.43 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false },
            lfo: { range: false }
        },
        buttons: {},
        cables: [
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'dly', toPort: 'timeCV' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'dly', toPort: 'audio' },
            { fromModule: 'dly', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'dly', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
