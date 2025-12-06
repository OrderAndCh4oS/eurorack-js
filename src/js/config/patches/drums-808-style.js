/**
 * Drums - 808 Style
 * TR-808 inspired drum pattern
 */
export default {
    name: 'Drums - 808 Style',
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
            clk: { rate: 0.28 },
            div: { rate1: 0.4375, rate2: 0.625 },
            kick: { pitch: 0.25, decay: 0.6, tone: 0.2 },
            snare: { snap: 0.5, decay: 0.5, pitch: 0.45 },
            hat: { decay: 0.4, sizzle: 0.6, blend: 0.3 },
            mix: { lvl1: 1.0, lvl2: 0.7, lvl3: 0.4, lvl4: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
