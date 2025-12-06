/**
 * Test - Noise Output
 * Noise generator test
 */
export default {
    name: 'Test - Noise Output',
    factory: true,
    state: {
        modules: [
            { type: 'nse', instanceId: 'nse', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            nse: { rate: 0.8 },
            vca: { ch1Gain: 0.5, ch2Gain: 0.5 },
            out: { volume: 0.4 }
        },
        switches: {
            nse: { vcaMode: 0 }
        },
        cables: [
            { fromModule: 'nse', fromPort: 'noise', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'nse', fromPort: 'noise', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
