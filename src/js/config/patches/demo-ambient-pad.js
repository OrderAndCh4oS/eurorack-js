/**
 * Demo - Ambient Pad
 * Lush ambient pad with stereo reverb and evolving modulation.
 * Shows off the stereo spread and long decay of the reverb.
 */
export default {
    name: 'Demo - Ambient Pad',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'lfo', instanceId: 'lfo1', row: 1 },
            { type: 'lfo', instanceId: 'lfo2', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 2 },
            { type: 'vca', instanceId: 'vca', row: 2 },
            { type: 'verb', instanceId: 'verb', row: 2 },
            { type: 'out', instanceId: 'out', row: 2 }
        ],
        knobs: {
            clk: { rate: 0.15 },
            lfo1: { rate: 0.08, depth: 0.4 },
            lfo2: { rate: 0.12, depth: 0.3 },
            vco1: { coarse: 0.35, fine: 0.5, pw: 0.5 },
            vco2: { coarse: 0.35, fine: 0.52, pw: 0.45 },
            vcf: { cutoff: 0.45, resonance: 0.25 },
            adsr: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 0.8 },
            vca: { ch1Gain: 0, ch2Gain: 0.65 },
            verb: { time: 0.85, damp: 0.35, mix: 0.6 },
            out: { volume: 0.5 }
        },
        switches: {
            clk: { pause: false },
            lfo1: { range: 0, waveform: 0 },
            lfo2: { range: 0, waveform: 2 }
        },
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'lfo1', fromPort: 'primary', toModule: 'vco1', toPort: 'pwm' },
            { fromModule: 'lfo2', fromPort: 'primary', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'lfo1', fromPort: 'secondary', toModule: 'vco2', toPort: 'vOct' },
            { fromModule: 'vco1', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vco2', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
