/**
 * Drums - Hat Patterns
 * Open and closed hi-hat pattern exploration
 */
export default {
    name: 'Drums - Hat Patterns',
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
            clk: { rate: 0.35 },
            div: { rate1: 0.368, rate2: 0.505 },
            hat: { decay: 0.333, sizzle: 0.42, blend: 0.32 },
            mix: { lvl1: 0.8, lvl2: 0, lvl3: 0, lvl4: 0 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
