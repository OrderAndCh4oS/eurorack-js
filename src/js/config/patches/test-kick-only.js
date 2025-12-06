/**
 * Test - Kick Only
 * Isolated kick drum test
 */
export default {
    name: 'Test - Kick Only',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.25 },
            kick: { pitch: 0.3, decay: 0.5, tone: 0.3 },
            mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
            out: { volume: 0.7 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
