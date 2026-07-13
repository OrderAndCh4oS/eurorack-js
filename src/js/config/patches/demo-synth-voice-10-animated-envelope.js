import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 10 - Animated Envelope', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('attackLfo', 'lfo', 1, 2),
    moduleAt('releaseLfo', 'lfo', 1, 3), moduleAt('env', 'adsr', 1, 4),
    moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1), moduleAt('vca', 'vca', 2, 2),
    moduleAt('out', 'out', 2, 3)
], {
    clk: { rate: 0.25, pause: 0 }, seq: sequenceParams({ length: 6, direction: 1 }),
    attackLfo: { rateKnob: 0.11, waveKnob: 0, range: 0 },
    releaseLfo: { rateKnob: 0.17, waveKnob: 0.3, range: 0 },
    env: { attack: 0.04, decay: 0.4599999999999999, sustain: 0.36, release: 0.5933333333333335 },
    vco: { coarse: 0.29, fine: 0, glide: 10 }, vcf: { cutoff: 0.31, resonance: 0.7 },
    vca: { ch1Gain: 0.72, ch2Gain: 0 }, out: { volume: 0.58 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('attackLfo', 'primary', 'env', 'attackCV'),
    cable('releaseLfo', 'secondary', 'env', 'releaseCV'), cable('vco', 'ramp', 'vcf', 'audio'),
    cable('env', 'env', 'vcf', 'cutoffCV'), cable('env', 'inv', 'vcf', 'resCV'),
    cable('vcf', 'lpf', 'vca', 'ch1In'), cable('env', 'env', 'vca', 'ch1CV'),
    ...stereo('vca', 'ch1Out')
]);
