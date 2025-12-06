/**
 * Test - VCO Only
 * Isolated VCO test with triangle and ramp outputs
 */
export default {
    name: 'Test - VCO Only',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.35, fine: 0, glide: 5 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
