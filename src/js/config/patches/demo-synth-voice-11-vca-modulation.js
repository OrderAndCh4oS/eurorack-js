import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 11 - VCA Modulation', [
    moduleAt('env', 'adsr', 1, 0), moduleAt('clk', 'clk', 1, 1), moduleAt('seq', 'seq', 1, 2),
    moduleAt('fastLfo', 'lfo', 1, 3), moduleAt('slowLfo', 'lfo', 1, 4), moduleAt('modVca', 'vca', 1, 5),
    moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1), moduleAt('ampVca', 'vca', 2, 2),
    moduleAt('out', 'out', 2, 3)
], {
    clk: { rate: 0.27, pause: 0 }, seq: sequenceParams(),
    fastLfo: { rateKnob: 0.72, waveKnob: 0, range: 1 },
    slowLfo: { rateKnob: 0.15, waveKnob: 0.25, range: 0 },
    modVca: { ch1Gain: 0.28, ch2Gain: 0 },
    env: { attack: 0.01, decay: 0.5266666666666666, sustain: 0.32999999999999996, release: 0.74 },
    vco: { coarse: 0.29, fine: 0, glide: 6 }, vcf: { cutoff: 0.32, resonance: 0.62 },
    ampVca: { ch1Gain: 0.7, ch2Gain: 0 }, out: { volume: 0.56 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('fastLfo', 'primary', 'modVca', 'ch1In'),
    cable('slowLfo', 'primary', 'modVca', 'ch1CV'), cable('modVca', 'ch1Out', 'vcf', 'cutoffCV'),
    cable('vco', 'ramp', 'vcf', 'audio'), cable('vcf', 'lpf', 'ampVca', 'ch1In'),
    cable('env', 'env', 'ampVca', 'ch1CV'), ...stereo('ampVca', 'ch1Out')
]);
