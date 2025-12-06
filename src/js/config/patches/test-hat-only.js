/**
 * Test - Hat Only
 * Isolated hi-hat test with open and closed triggers
 */
export default {
    name: 'Test - Hat Only',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            div: { rate1: 0.4375, rate2: 0.5 },
            hat: { decay: 0.5, sizzle: 0.5, blend: 0.5 },
            mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
