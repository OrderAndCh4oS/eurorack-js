import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 04 - Sync Sweep', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('lfo', 'lfo', 1, 2),
    moduleAt('sweep', 'atten', 1, 3), moduleAt('env', 'adsr', 1, 4),
    moduleAt('syncVco', 'vco', 2, 0), moduleAt('mainVco', 'vco', 2, 1),
    moduleAt('vcf', 'vcf', 2, 2), moduleAt('vca', 'vca', 2, 3), moduleAt('out', 'out', 2, 4)
], {
    clk: { rate: 0.27, pause: 0 }, seq: sequenceParams(),
    lfo: { rateKnob: 0.22, waveKnob: 0, range: 0 },
    sweep: { atten1: 0.47000000000000003, offset1: 0.5, atten2: 1, offset2: 0.5 },
    env: { attack: 0, decay: 0.38, sustain: 0.5133333333333333, release: 0.7833333333333333 },
    syncVco: { coarse: 0.3933333333333333, fine: 0.72, glide: 2 },
    mainVco: { coarse: 0.2766666666666666, fine: 0, glide: 5 },
    vcf: { cutoff: 0.52, resonance: 0.25 }, vca: { ch1Gain: 0.7, ch2Gain: 0 },
    out: { volume: 0.6 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'mainVco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('lfo', 'primary', 'sweep', 'in1'),
    cable('sweep', 'out1', 'syncVco', 'vOct'), cable('syncVco', 'pulse', 'mainVco', 'sync'),
    cable('mainVco', 'ramp', 'vcf', 'audio'), cable('env', 'env', 'vcf', 'cutoffCV'),
    cable('vcf', 'lpf', 'vca', 'ch1In'), cable('env', 'env', 'vca', 'ch1CV'),
    ...stereo('vca', 'ch1Out')
]);
