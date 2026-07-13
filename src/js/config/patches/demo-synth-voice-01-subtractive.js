import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 01 - Subtractive', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('env', 'adsr', 1, 2),
    moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1), moduleAt('vca', 'vca', 2, 2),
    moduleAt('out', 'out', 2, 3)
], {
    clk: { rate: 0.28, pause: 0 },
    seq: sequenceParams(),
    env: { attack: 0, decay: 0.5066666666666666, sustain: 0.15666666666666668, release: 0.6900000000000001 },
    vco: { coarse: 0.3, fine: 0, glide: 8 },
    vcf: { cutoff: 0.6, resonance: 0.32 },
    vca: { ch1Gain: 0.8, ch2Gain: 0 },
    out: { volume: 0.65 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('vco', 'ramp', 'vcf', 'audio'),
    cable('env', 'env', 'vcf', 'cutoffCV'), cable('vcf', 'lpf', 'vca', 'ch1In'),
    cable('env', 'env', 'vca', 'ch1CV'), ...stereo('vca', 'ch1Out')
]);
