/**
 * Test - VCF Resonance
 * Filter resonance test with LFO modulating cutoff
 */
export default {
    name: 'Test - VCF Resonance',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rateKnob: 0.4, waveKnob: 0.5 },
            vco: { coarse: 0.25, fine: 0, glide: 5 },
            vcf: { cutoff: 0.4, resonance: 0.7 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            lfo: { range: 0 }
        },
        cables: [
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
