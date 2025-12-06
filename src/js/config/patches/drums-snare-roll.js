/**
 * Drums - Snare Roll
 * Fast snare roll pattern
 */
export default {
    name: 'Drums - Snare Roll',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.4 },
            div: { rate1: 0.485, rate2: 0.5 },
            snare: { snap: 0.5, decay: 0.2, pitch: 0.4 },
            mix: { lvl1: 0.9, lvl2: 0, lvl3: 0, lvl4: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
