/**
 * Test Patch: OCHD
 *
 * Demonstrates the 8x free-running LFO module with organic modulation.
 * Creates a warm evolving drone with rolling filter sweeps.
 * - Out3 (medium) modulates filter cutoff
 * - Out1 (fast) modulates filter resonance
 */
export default {
    name: 'Test: OCHD',
    factory: true,
    state: {
        modules: [
            { type: 'ochd', instanceId: 'ochd', row: 1 },
            { type: 'atten', instanceId: 'atten', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            ochd: { rate: 0.72 },
            atten: { atten1: 1, offset1: 0.5, atten2: 1, offset2: 0.5 },
            vco: { coarse: 0.37, fine: 0, glide: 13.33 },
            vcf: { cutoff: 0.45, resonance: 0.3 },
            vca: { ch1Gain: 0.8, ch2Gain: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            // Out3 (medium LFO) to filter cutoff via attenuverter
            { fromModule: 'ochd', fromPort: 'out3', toModule: 'atten', toPort: 'in1' },
            { fromModule: 'atten', fromPort: 'out1', toModule: 'vcf', toPort: 'cutoffCV' },
            // Out1 (fast LFO) to filter resonance via attenuverter
            { fromModule: 'ochd', fromPort: 'out1', toModule: 'atten', toPort: 'in2' },
            { fromModule: 'atten', fromPort: 'out2', toModule: 'vcf', toPort: 'resCV' },
            // Audio path
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
