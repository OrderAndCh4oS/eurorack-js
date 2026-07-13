import { cable, moduleAt, sequenceParams, stereo, voiceDemo } from './voice-demo-support.js';

export default voiceDemo('Demo - Synth Voice 05 - Oscillator Stack', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('lfo', 'lfo', 1, 2),
    moduleAt('env', 'adsr', 1, 3), moduleAt('vcoA', 'vco', 2, 0), moduleAt('vcoB', 'vco', 2, 1),
    moduleAt('sub', 'vco', 2, 2), moduleAt('voices', 'mix', 2, 3), moduleAt('vcf', 'vcf', 2, 4),
    moduleAt('vca', 'vca', 2, 5), moduleAt('out', 'out', 2, 6)
], {
    clk: { rate: 0.26, pause: 0 }, seq: sequenceParams({ range: 0 }),
    lfo: { rateKnob: 0.14, waveKnob: 0.25, range: 0 },
    env: { attack: 0.01, decay: 0.66, sustain: 0.45, release: 0.7333333333333333 },
    vcoA: { coarse: 0.3, fine: -0.08, glide: 8 }, vcoB: { coarse: 0.3, fine: 0.08, glide: 8 },
    sub: { coarse: 0.219, fine: 0, glide: 8 },
    voices: { lvl1: 0.4, lvl2: 0.36, lvl3: 0.48, lvl4: 0 },
    vcf: { cutoff: 0.38, resonance: 0.42 }, vca: { ch1Gain: 0.7, ch2Gain: 0 },
    out: { volume: 0.58 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vcoA', 'vOct'),
    cable('seq', 'cv', 'vcoB', 'vOct'), cable('seq', 'cv', 'sub', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('vcoA', 'ramp', 'voices', 'in1'),
    cable('vcoB', 'ramp', 'voices', 'in2'), cable('sub', 'pulse', 'voices', 'in3'),
    cable('voices', 'out', 'vcf', 'audio'), cable('lfo', 'primary', 'vcf', 'cutoffCV'),
    cable('vcf', 'lpf', 'vca', 'ch1In'), cable('env', 'env', 'vca', 'ch1CV'),
    ...stereo('vca', 'ch1Out')
]);
