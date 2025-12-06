/**
 * Drums - Punchy Kick
 * Focused kick drum with LFO modulation
 */
export default {
    name: 'Drums - Punchy Kick',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.32 },
            lfo: { rateKnob: 0.2, waveKnob: 0.5 },
            kick: { pitch: 0.35, decay: 0.55, tone: 0.5 },
            mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
            out: { volume: 0.7 }
        },
        switches: {
            lfo: { range: 0 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'kick', toPort: 'toneCV' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
