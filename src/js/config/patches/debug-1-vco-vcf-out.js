/**
 * Debug 1 - VCO→VCF→Out
 * Signal chain: VCO through filter to output
 */
export default {
    name: 'Debug 1 - VCO→VCF→Out',
    factory: true,
    state: {
        modules: [
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            vco: { coarse: 0.25, fine: 0, glide: 5 },
            vcf: { cutoff: 0.5, resonance: 0.3 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
