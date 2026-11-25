export default {
    name: 'Test - Slice Sampler',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clk', type: 'clk', row: 1, index: 0 },
            { id: 'euclid', type: 'euclid', row: 1, index: 1 },
            { id: 'sampler', type: 'slice-sampler', row: 1, index: 2 },
            { id: 'out', type: 'out', row: 1, index: 3 }
        ],
        params: {
            clk: { rate: 0.34, pause: 0 },
            euclid: { length: 8, hits: 3, rotate: 0 },
            sampler: { playModeB: 1, orderB: 1 },
            out: { volume: 0.8 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'sampler', toPort: 'trigA' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'euclid', toPort: 'clock' },
            { fromModule: 'euclid', fromPort: 'trig', toModule: 'sampler', toPort: 'trigB' },
            { fromModule: 'sampler', fromPort: 'outA', toModule: 'out', toPort: 'L' },
            { fromModule: 'sampler', fromPort: 'outB', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
