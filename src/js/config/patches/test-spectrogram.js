/**
 * Test - Spectrogram
 *
 * Displays frequency content evolving over time.
 * VCO provides test signal - try different waveforms.
 * Use Freeze to capture and examine a snapshot.
 * Export as PNG or CSV for analysis.
 */
export default {
    name: 'Test - Spectrogram',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'spectrogram', instanceId: 'spec', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            // VCO: moderate frequency to see harmonics
            vco: { coarse: 0.3, fine: 0 },
            // Spectrogram: medium time window
            spec: { time: 0.3, floor: 0.5 },
            // Output
            out: { volume: 0.4 }
        },
        switches: {
            // Running (not frozen)
            spec: { freeze: 0 }
        },
        cables: [
            // VCO to spectrogram - ramp has rich harmonics
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'spec', toPort: 'audio' },
            // Passthrough to output
            { fromModule: 'spec', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'spec', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
