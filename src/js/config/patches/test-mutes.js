export default {
    name: 'Test - Performance Mutes',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: [
            { id: 'clock', type: 'clk', row: 1, index: 0 },
            { id: 'div', type: 'div', row: 1, index: 1 },
            { id: 'kick', type: 'kick', row: 1, index: 2 },
            { id: 'hat', type: 'hat', row: 1, index: 3 },
            { id: 'bars', type: 'lfo', row: 1, index: 4 },
            { id: 'stems', type: 'mutes', row: 1, index: 5 },
            { id: 'mix', type: 'mix', row: 1, index: 6 },
            { id: 'out', type: 'out', row: 1, index: 7 }
        ],
        params: {
            clock: { rate: Math.log(80) / Math.log(100000) }, // Sixteenths at 120 BPM.
            div: { rate1: 5 / 16 },
            bars: { rateKnob: Math.log(6.75) / Math.log(540), waveKnob: 1 },
            kick: { decay: 0.32 }, hat: { decay: 0.22 },
            mix: { lvl1: 0.8, lvl2: 0.45 }, out: { volume: 0.6 }
        },
        cables: [
            { fromModule: 'clock', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'clock', fromPort: 'clock', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'stems', toPort: 'in1' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'stems', toPort: 'in2' },
            { fromModule: 'bars', fromPort: 'primary', toModule: 'stems', toPort: 'mute2' },
            { fromModule: 'stems', fromPort: 'out1', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'stems', fromPort: 'out2', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ],
        midiMappings: {}
    }
};
