/**
 * Demo - S&H Random
 * Random melody using sample & hold with quantizer
 * Clock triggers S&H and ADSR for rhythmic random bleeps
 */
export default {
    name: 'Demo - S&H Random',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'nse', instanceId: 'nse', row: 1 },
            { type: 'sh', instanceId: 'sh', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.35 },
            nse: { color: 0.5 },
            sh: { slew1: 0.1, slew2: 0 },
            quant: { scale: 10, octave: 0, semitone: 0 },
            vco: { coarse: 0.4, fine: 0, glide: 0.1 },
            vcf: { cutoff: 0.6, resonance: 0.3 },
            adsr: { attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.3 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false }
        },
        buttons: {},
        cables: [
            { fromModule: 'nse', fromPort: 'noise', toModule: 'sh', toPort: 'in1' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'sh', toPort: 'trig1' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'sh', fromPort: 'out1', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
