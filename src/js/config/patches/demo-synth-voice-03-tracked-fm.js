import { cable, moduleAt, sequenceParams, stereo, voiceDemo } from './voice-demo-support.js';

export default voiceDemo('Demo - Synth Voice 03 - Tracked FM', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('env', 'adsr', 1, 2),
    moduleAt('mod', 'vco', 2, 0), moduleAt('fmDepth', 'atten', 2, 1), moduleAt('carrier', 'vco', 2, 2),
    moduleAt('vcf', 'vcf', 2, 3), moduleAt('vca', 'vca', 2, 4), moduleAt('out', 'out', 2, 5)
], {
    clk: { rate: 0.27, pause: 0 }, seq: sequenceParams({ step5: 0.5, step8: 0.75 }),
    env: { attack: 0, decay: 0.66, sustain: 0.35, release: 0.7866666666666667 },
    mod: { coarse: 0.36, fine: 0, glide: 4 },
    fmDepth: { atten1: 0.56, offset1: 0.5, atten2: 1, offset2: 0.5 },
    carrier: { coarse: 0.28, fine: 0, glide: 4 },
    vcf: { cutoff: 0.48, resonance: 0.22 }, vca: { ch1Gain: 0.72, ch2Gain: 0 },
    out: { volume: 0.58 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'mod', 'vOct'),
    cable('seq', 'cv', 'carrier', 'vOct'), cable('seq', 'gate', 'env', 'gate'),
    cable('mod', 'triangle', 'fmDepth', 'in1'), cable('fmDepth', 'out1', 'carrier', 'fm'),
    cable('carrier', 'triangle', 'vcf', 'audio'), cable('env', 'env', 'vcf', 'cutoffCV'),
    cable('vcf', 'lpf', 'vca', 'ch1In'), cable('env', 'env', 'vca', 'ch1CV'),
    ...stereo('vca', 'ch1Out')
]);
