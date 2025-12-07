/**
 * Test - Wavefolder
 *
 * Demonstrates wavefolding:
 * - VCO triangle wave through wavefolder
 * - LFO modulates fold amount for evolving timbre
 *
 * Try adjusting the Fold knob to hear the harmonics change.
 */
export default {
    name: 'Test - Fold',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'fold', instanceId: 'fold', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rate: 0.25, shape: 0.5 },
            vco: { coarse: 0.35, fine: 0 },
            fold: { fold: 0.4, sym: 0 },
            vcf: { cutoff: 0.6, res: 0.3 },
            out: { volume: 0.5 }
        },
        switches: {
            lfo: { range: 0 }
        },
        cables: [
            // LFO modulates fold amount
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'fold', toPort: 'foldCV' },
            // VCO triangle to folder
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'fold', toPort: 'audio' },
            // Folder through filter to tame highs
            { fromModule: 'fold', fromPort: 'out', toModule: 'vcf', toPort: 'audio' },
            // Filter to output
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'out', toPort: 'L' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'out', toPort: 'R' }
        ]
    }
};
