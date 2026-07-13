import { cable, moduleAt, sequenceParams, stereo, voiceDemo } from './voice-demo-support.js';

export default voiceDemo('Demo - Synth Voice 02 - Waveform Blend', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('lfo', 'lfo', 1, 2),
    moduleAt('env', 'adsr', 1, 3), moduleAt('vco', 'vco', 2, 0), moduleAt('waves', 'mix', 2, 1),
    moduleAt('vcf', 'vcf', 2, 2), moduleAt('vca', 'vca', 2, 3), moduleAt('out', 'out', 2, 4)
], {
    clk: { rate: 0.28, pause: 0 }, seq: sequenceParams(),
    lfo: { rateKnob: 0.18, waveKnob: 0.3, range: 0 },
    env: { attack: 0, decay: 0.5466666666666667, sustain: 0.2066666666666667, release: 0.68 },
    vco: { coarse: 0.29, fine: 0, glide: 6 },
    waves: { lvl1: 0.5, lvl2: 0.42, lvl3: 0.28, lvl4: 0 },
    vcf: { cutoff: 0.49000000000000005, resonance: 0.36 }, vca: { ch1Gain: 0.72, ch2Gain: 0 },
    out: { volume: 0.62 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('lfo', 'primary', 'vco', 'pwm'),
    cable('vco', 'triangle', 'waves', 'in1'), cable('vco', 'ramp', 'waves', 'in2'),
    cable('vco', 'pulse', 'waves', 'in3'), cable('waves', 'out', 'vcf', 'audio'),
    cable('env', 'env', 'vcf', 'cutoffCV'), cable('vcf', 'lpf', 'vca', 'ch1In'),
    cable('env', 'env', 'vca', 'ch1CV'), ...stereo('vca', 'ch1Out')
]);
