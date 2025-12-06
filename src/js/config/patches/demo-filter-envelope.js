/**
 * Demo - Filter Envelope
 * Classic filter sweep with envelope
 */
export default {
    name: 'Demo - Filter Envelope',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            vco: { coarse: 0.25, fine: 0, glide: 0 },
            vcf: { cutoff: 0.15, resonance: 0.75 },
            adsr: { attack: 0.0, decay: 0.35, sustain: 0.2, release: 0.4 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' }
        ]
    }
};
