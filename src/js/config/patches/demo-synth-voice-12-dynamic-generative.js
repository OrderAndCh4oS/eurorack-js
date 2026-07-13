import { cable, moduleAt, stereo, voiceDemo } from './voice-demo-support.js';

export default voiceDemo('Demo - Synth Voice 12 - Dynamic Generative', [
    moduleAt('cycle', 'func', 1, 0), moduleAt('accent', 'func', 1, 1),
    moduleAt('waveLfo', 'lfo', 1, 2), moduleAt('subLfo', 'lfo', 1, 3), moduleAt('env', 'adsr', 1, 4),
    moduleAt('main', 'vco', 2, 0), moduleAt('subA', 'vco', 2, 1), moduleAt('subB', 'vco', 2, 2),
    moduleAt('waveVca', 'vca', 2, 3), moduleAt('waveMix', 'mix', 2, 4),
    moduleAt('modScale', 'atten', 3, 0), moduleAt('vcf', 'vcf', 3, 1),
    moduleAt('ampVca', 'vca', 3, 2), moduleAt('out', 'out', 3, 3)
], {
    cycle: { rise: 0.52, fall: 0.6, curve: 0.52, cycle: 1 },
    accent: { rise: 0.08, fall: 0.48, curve: 0.7, cycle: 0 },
    waveLfo: { rateKnob: 0.12, waveKnob: 0.18, range: 0 },
    subLfo: { rateKnob: 0.19, waveKnob: 0.42, range: 0 },
    env: { attack: 0, decay: 0.5, sustain: 0.4, release: 0.72 },
    main: { coarse: 0.27, fine: 0, glide: 4 }, subA: { coarse: 0.189, fine: -0.08, glide: 4 },
    subB: { coarse: 0.108, fine: 0.08, glide: 4 },
    waveVca: { ch1Gain: 0.55, ch2Gain: 0.42 },
    waveMix: { lvl1: 0.32, lvl2: 0.38, lvl3: 0.42, lvl4: 0.3 },
    modScale: { atten1: 0.65, offset1: 0.5, atten2: 0.62, offset2: 0.5 },
    vcf: { cutoff: 0.45, resonance: 0.38 }, ampVca: { ch1Gain: 1, ch2Gain: 0 },
    out: { volume: 0.75 }
}, [
    cable('cycle', 'eoc', 'accent', 'trig'), cable('cycle', 'eoc', 'env', 'gate'),
    cable('cycle', 'out', 'modScale', 'in1'), cable('accent', 'out', 'modScale', 'in2'),
    cable('modScale', 'out1', 'vcf', 'cutoffCV'), cable('modScale', 'out2', 'vcf', 'resCV'),
    cable('waveLfo', 'secondary', 'main', 'pwm'),
    cable('main', 'ramp', 'waveVca', 'ch1In'), cable('waveLfo', 'primary', 'waveVca', 'ch1CV'),
    cable('subA', 'pulse', 'waveVca', 'ch2In'), cable('subLfo', 'primary', 'waveVca', 'ch2CV'),
    cable('main', 'triangle', 'waveMix', 'in1'), cable('waveVca', 'ch1Out', 'waveMix', 'in2'),
    cable('waveVca', 'ch2Out', 'waveMix', 'in3'), cable('subB', 'triangle', 'waveMix', 'in4'),
    cable('waveMix', 'out', 'vcf', 'audio'), cable('vcf', 'lpf', 'ampVca', 'ch1In'),
    cable('env', 'env', 'ampVca', 'ch1CV'), ...stereo('ampVca', 'ch1Out')
]);
