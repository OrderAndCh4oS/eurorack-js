/**
 * Test - Plot Waveform
 *
 * Plots VCO waveform over time for quality analysis.
 * Set Time knob to minimum (1s) to see individual cycles.
 * Use Freeze to pause and examine waveform shape.
 * Try different VCO outputs: triangle, ramp, pulse.
 */
export default {
    name: 'Test - Plot Waveform',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'plot', instanceId: 'plot', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            // VCO: very low frequency so we can see individual cycles
            vco: { coarse: 0.08, fine: 0 },
            // Plot: minimum time window (1s) to see waveform detail
            plot: { time: 0 },
            // Output
            out: { volume: 0.4 }
        },
        switches: {
            // Plot running (not frozen)
            plot: { freeze: 0 }
        },
        cables: [
            // VCO to plot - see the waveform shape
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'plot', toPort: 'audio' },
            // Plot passthrough to output
            { fromModule: 'plot', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'plot', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
