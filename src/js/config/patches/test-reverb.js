/**
 * Test - Reverb
 * VCO through VCF through stereo reverb
 */
export default {
    name: 'Test - Reverb',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'verb', instanceId: 'verb', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            adsr: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 0.5 },
            vco: { coarse: 0.4, fine: 0.5 },
            vcf: { cutoff: 0.6, resonance: 0.3 },
            vca: { ch1Gain: 0, ch2Gain: 0.8 },
            verb: { time: 0.7, damp: 0.4, mix: 0.5 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false }
        },
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
