/**
 * Test - Snare Only
 * Isolated snare drum test
 */
export default {
    name: 'Test - Snare Only',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.25 },
            snare: { snap: 0.5, decay: 0.5, pitch: 0.5 },
            mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
            out: { volume: 0.7 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
