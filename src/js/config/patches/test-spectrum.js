/**
 * Test - Spectrum Analyzer
 *
 * Demonstrates the FFT spectrum analyzer with a VCO.
 * Shows harmonic content of different waveforms.
 * Use the VCO wave selector to see how triangle, saw, and pulse
 * have different harmonic structures.
 */
export default {
    name: 'Test - Spectrum Analyzer',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'spectrum', instanceId: 'spectrum', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            // VCO: mid-range frequency to show clear harmonics
            vco: { coarse: 0.4, fine: 0, glide: 0 },
            // Spectrum: moderate floor, medium decay
            spectrum: { floor: 0.5, decay: 0.5 },
            // Output: moderate volume
            out: { volume: 0.5 }
        },
        switches: {
            // Spectrum: logarithmic scale (default)
            spectrum: { scale: 0 }
        },
        cables: [
            // VCO ramp (rich harmonics) to spectrum
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'spectrum', toPort: 'audio' },
            // Spectrum passthrough to output (mono)
            { fromModule: 'spectrum', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'spectrum', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
