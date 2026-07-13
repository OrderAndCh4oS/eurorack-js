import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 08 - Filter Modes', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('env', 'adsr', 1, 2),
    moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1), moduleAt('modes', 'mix', 2, 2),
    moduleAt('vca', 'vca', 2, 3), moduleAt('out', 'out', 2, 4)
], {
    clk: { rate: 0.27, pause: 0 }, seq: sequenceParams({ direction: 2 }),
    env: { attack: 0.02, decay: 0.4733333333333334, sustain: 0.38, release: 0.7199999999999999 },
    vco: { coarse: 0.29, fine: 0, glide: 7 }, vcf: { cutoff: 0.38, resonance: 0.58 },
    modes: { lvl1: 0.42, lvl2: 0.5, lvl3: 0.2, lvl4: 0 },
    vca: { ch1Gain: 0.68, ch2Gain: 0 }, out: { volume: 0.58 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('vco', 'ramp', 'vcf', 'audio'),
    cable('env', 'env', 'vcf', 'cutoffCV'), cable('vcf', 'lpf', 'modes', 'in1'),
    cable('vcf', 'bpf', 'modes', 'in2'), cable('vcf', 'hpf', 'modes', 'in3'),
    cable('modes', 'out', 'vca', 'ch1In'), cable('env', 'env', 'vca', 'ch1CV'),
    ...stereo('vca', 'ch1Out')
]);
