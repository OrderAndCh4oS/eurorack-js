import { cable, moduleAt, sequenceParams, stereo, synthVoiceDemo } from './synth-voice-support.js';

export default synthVoiceDemo('Demo - Synth Voice 09 - Envelopes and Accents', [
    moduleAt('clk', 'clk', 1, 0), moduleAt('div', 'div', 1, 1), moduleAt('seq', 'seq', 1, 2),
    moduleAt('filterEnv', 'adsr', 1, 3), moduleAt('ampEnv', 'adsr', 1, 4),
    moduleAt('accentEnv', 'adsr', 1, 5), moduleAt('lfo', 'lfo', 1, 6), moduleAt('modMix', 'mix', 1, 7),
    moduleAt('vco', 'vco', 2, 0), moduleAt('vcf', 'vcf', 2, 1), moduleAt('vca', 'vca', 2, 2),
    moduleAt('out', 'out', 2, 3)
], {
    clk: { rate: 0.29, pause: 0 }, div: { rate1: 0.35, rate2: 0.62 },
    seq: sequenceParams({ gate3: 0, gate7: 0 }),
    filterEnv: { attack: 0, decay: 0.3, sustain: 0.08, release: 0.6933333333333334 },
    ampEnv: { attack: 0.01, decay: 0.43333333333333335, sustain: 0.42, release: 0.7333333333333334 },
    accentEnv: { attack: 0, decay: 0.5533333333333333, sustain: 0, release: 0.6066666666666667 },
    lfo: { rateKnob: 0.13, waveKnob: 0.2, range: 0 },
    modMix: { lvl1: 0.56, lvl2: 0.32, lvl3: 0.1, lvl4: 0 },
    vco: { coarse: 0.28, fine: 0, glide: 5 }, vcf: { cutoff: 0.27, resonance: 0.54 },
    vca: { ch1Gain: 0.72, ch2Gain: 0 }, out: { volume: 0.6 }
}, [
    cable('clk', 'clock', 'div', 'clock'), cable('clk', 'clock', 'seq', 'clock'),
    cable('seq', 'cv', 'vco', 'vOct'), cable('seq', 'gate', 'filterEnv', 'gate'),
    cable('seq', 'gate', 'ampEnv', 'gate'), cable('div', 'out2', 'accentEnv', 'gate'),
    cable('filterEnv', 'env', 'modMix', 'in1'), cable('accentEnv', 'env', 'modMix', 'in2'),
    cable('lfo', 'primary', 'modMix', 'in3'), cable('vco', 'pulse', 'vcf', 'audio'),
    cable('modMix', 'out', 'vcf', 'cutoffCV'), cable('vcf', 'lpf', 'vca', 'ch1In'),
    cable('ampEnv', 'env', 'vca', 'ch1CV'), ...stereo('vca', 'ch1Out')
]);
