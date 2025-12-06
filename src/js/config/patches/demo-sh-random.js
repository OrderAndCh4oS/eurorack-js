/**
 * Demo - S&H Random
 * Random melody using sample & hold with quantizer
 */
export default {
    name: 'Demo - S&H Random',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'nse', instanceId: 'nse', row: 1 },
            { type: 'sh', instanceId: 'sh', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rateKnob: 0.4, waveKnob: 0 },
            nse: { rate: 1 },
            sh: { slew1: 0.25, slew2: 0 },
            quant: { scale: 10, octave: 0, semitone: 0 },
            vco: { coarse: 0.35, fine: 0, glide: 20 },
            vcf: { cutoff: 0.5, resonance: 0.4 },
            vca: { ch1Gain: 0.7, ch2Gain: 0.7 },
            out: { volume: 0.65 }
        },
        switches: {
            lfo: { range: 0 }
        },
        cables: [
            { fromModule: 'nse', fromPort: 'noise', toModule: 'sh', toPort: 'in1' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'sh', toPort: 'trig1' },
            { fromModule: 'sh', fromPort: 'out1', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
