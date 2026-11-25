export default {
    name: 'Test - Stereo DJ Filter',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'bass', type: 'vco', row: 1, index: 0 },
            { id: 'clock', type: 'clk', row: 1, index: 1 },
            { id: 'div', type: 'div', row: 1, index: 2 },
            { id: 'kick', type: 'kick', row: 1, index: 3 },
            { id: 'hat', type: 'hat', row: 1, index: 4 },
            { id: 'drums', type: 'mix', row: 1, index: 5 },
            { id: 'filter', type: 'dj-filter', row: 1, index: 6 },
            { id: 'out', type: 'out', row: 1, index: 7 }
        ],
        params: {
            bass: { coarse: 0.3 }, clock: { rate: 0.38 }, div: { rate1: 5 / 16 },
            kick: { decay: 0.3 }, hat: { decay: 0.24 },
            drums: { lvl1: 0.7, lvl2: 0.48 }, out: { volume: 0.4 }
        },
        cables: [
            { fromModule: 'bass', fromPort: 'ramp', toModule: 'filter', toPort: 'inL' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'drums', toPort: 'in1' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'drums', toPort: 'in2' },
            { fromModule: 'drums', fromPort: 'out', toModule: 'filter', toPort: 'inR' },
            { fromModule: 'filter', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'filter', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
