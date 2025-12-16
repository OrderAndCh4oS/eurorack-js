/**
 * Test - Kick Only
 * Isolated kick drum test with plot for waveform consistency verification
 * (Plot shows actual waveforms triggered on transients, better than spectrogram
 * for verifying identical hits since spectrogram has FFT windowing artifacts)
 */
export default {
    name: 'Test - Kick Only',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'plot', instanceId: 'plot', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.25 },
            kick: { pitch: 0.3, decay: 0.5, tone: 0.3, click: 0.5 },
            out: { volume: 0.7 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'plot', toPort: 'trig' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'plot', toPort: 'audio' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'kick', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
