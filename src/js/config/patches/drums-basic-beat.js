/**
 * Drums - Basic Beat
 * Simple kick, snare, and hi-hat pattern
 */
export default {
    name: 'Drums - Basic Beat',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            div: { rate1: 0.4375, rate2: 0.5 },
            kick: { pitch: 0.3, decay: 0.5, tone: 0.3 },
            snare: { snap: 0.6, decay: 0.4, pitch: 0.5 },
            hat: { decay: 0.3, sizzle: 0.5, blend: 0.4 },
            mix: { lvl1: 0.9, lvl2: 0.7, lvl3: 0.5, lvl4: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
