import { cable, moduleAt, sequenceParams, stereo, voiceDemo } from './voice-demo-support.js';

export default voiceDemo('Demo - Synth Voice 06 - Post-filter Noise', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('env', 'adsr', 1, 2),
    moduleAt('noise', 'nse', 1, 3), moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1),
    moduleAt('postMix', 'mix', 2, 2), moduleAt('vca', 'vca', 2, 3), moduleAt('out', 'out', 2, 4)
], {
    clk: { rate: 0.29, pause: 0 }, seq: sequenceParams({ step2: 0.125, step6: 0.625 }),
    env: { attack: 0, decay: 0.4866666666666667, sustain: 0.3, release: 0.64 },
    noise: { rate: 1, vcaMode: 0 }, vco: { coarse: 0.29, fine: 0, glide: 5 },
    vcf: { cutoff: 0.3, resonance: 0.5 },
    postMix: { lvl1: 0.72, lvl2: 0.09, lvl3: 0, lvl4: 0 },
    vca: { ch1Gain: 0.72, ch2Gain: 0 }, out: { volume: 0.58 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('vco', 'ramp', 'vcf', 'audio'),
    cable('env', 'env', 'vcf', 'cutoffCV'), cable('vcf', 'lpf', 'postMix', 'in1'),
    cable('noise', 'noise', 'postMix', 'in2'), cable('postMix', 'out', 'vca', 'ch1In'),
    cable('env', 'env', 'vca', 'ch1CV'), ...stereo('vca', 'ch1Out')
]);
