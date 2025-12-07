/**
 * Test - Clock Divisions
 * Demonstrates clock divider with drum sounds
 *
 * Kick triggers on /4 division (every 4 beats)
 * Hat triggers on x2 multiplication (twice per beat)
 * This makes the rhythmic relationship clearly audible
 */
export default {
    name: 'Test - Clock Divisions',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.353 },
            div: { rate1: 0.337, rate2: 0.529 },
            kick: { pitch: 0.3, decay: 0.5, tone: 0.4, click: 0.5 },
            hat: { decay: 0.3, sizzle: 0.5, blend: 0.5 },
            mix: { lvl1: 0.8, lvl2: 0.5, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false }
        },
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
