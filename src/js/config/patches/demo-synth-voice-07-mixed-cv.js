import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 07 - Mixed CV', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('seq', 'seq', 1, 1), moduleAt('slowLfo', 'lfo', 1, 2),
    moduleAt('fastLfo', 'lfo', 1, 3), moduleAt('env', 'adsr', 1, 4), moduleAt('modMix', 'mix', 1, 5),
    moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1), moduleAt('vca', 'vca', 2, 2),
    moduleAt('out', 'out', 2, 3)
], {
    clk: { rate: 0.27, pause: 0 }, seq: sequenceParams(),
    slowLfo: { rateKnob: 0.16, waveKnob: 0, range: 0 },
    fastLfo: { rateKnob: 0.42, waveKnob: 0.5, range: 0 },
    env: { attack: 0, decay: 0.48000000000000004, sustain: 0.48000000000000004, release: 0.74 },
    modMix: { lvl1: 0.5, lvl2: 0.14, lvl3: 0.05, lvl4: 0 },
    vco: { coarse: 0.29, fine: 0, glide: 6 },
    vcf: { cutoff: 0.40666666666666673, resonance: 0.48 },
    vca: { ch1Gain: 0.72, ch2Gain: 0 }, out: { volume: 0.6 }
}, [
    cable('clk', 'clock', 'seq', 'clock'), cable('seq', 'cv', 'vco', 'vOct'),
    cable('seq', 'gate', 'env', 'gate'), cable('env', 'env', 'modMix', 'in1'),
    cable('slowLfo', 'primary', 'modMix', 'in2'), cable('fastLfo', 'secondary', 'modMix', 'in3'),
    cable('vco', 'ramp', 'vcf', 'audio'), cable('modMix', 'out', 'vcf', 'cutoffCV'),
    cable('vcf', 'lpf', 'vca', 'ch1In'), cable('env', 'env', 'vca', 'ch1CV'),
    ...stereo('vca', 'ch1Out')
]);
