/**
 * Test patch for MIDI-4 module
 * 4-voice polyphonic MIDI → 4 VCOs → Mixer → VCF → Output
 *
 * Play chords on a MIDI keyboard to hear 4-voice polyphony.
 */
export default {
    name: 'Test: MIDI-4 Poly',
    factory: true,
    state: {
        modules: [
            { type: 'midi-4', instanceId: 'midi', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'vco', instanceId: 'vco3', row: 1 },
            { type: 'vco', instanceId: 'vco4', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 2 },
            { type: 'adsr', instanceId: 'adsr1', row: 2 },
            { type: 'adsr', instanceId: 'adsr2', row: 2 },
            { type: 'adsr', instanceId: 'adsr3', row: 2 },
            { type: 'adsr', instanceId: 'adsr4', row: 2 },
            { type: 'vca', instanceId: 'vca', row: 2 },
            { type: 'out', instanceId: 'out', row: 2 }
        ],
        knobs: {
            midi: { channel: 0, transpose: 0, mode: 0 },
            vco1: { coarse: 0.5, fine: 0, pw: 0.5 },
            vco2: { coarse: 0.5, fine: 0, pw: 0.5 },
            vco3: { coarse: 0.5, fine: 0, pw: 0.5 },
            vco4: { coarse: 0.5, fine: 0, pw: 0.5 },
            mix: { level1: 0.7, level2: 0.7, level3: 0.7, level4: 0.7 },
            vcf: { cutoff: 0.65, resonance: 0.2, env: 0.3 },
            adsr1: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 },
            adsr2: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 },
            adsr3: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 },
            adsr4: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 },
            vca: { ch1Level: 0.8, ch2Level: 0 },
            out: { levelL: 0.6, levelR: 0.6 }
        },
        switches: {},
        cables: [
            // Voice 1: Pitch → VCO, Gate → ADSR
            { fromModule: 'midi', fromPort: 'pitch1', toModule: 'vco1', toPort: 'vOct' },
            { fromModule: 'midi', fromPort: 'gate1', toModule: 'adsr1', toPort: 'gate' },
            // Voice 2
            { fromModule: 'midi', fromPort: 'pitch2', toModule: 'vco2', toPort: 'vOct' },
            { fromModule: 'midi', fromPort: 'gate2', toModule: 'adsr2', toPort: 'gate' },
            // Voice 3
            { fromModule: 'midi', fromPort: 'pitch3', toModule: 'vco3', toPort: 'vOct' },
            { fromModule: 'midi', fromPort: 'gate3', toModule: 'adsr3', toPort: 'gate' },
            // Voice 4
            { fromModule: 'midi', fromPort: 'pitch4', toModule: 'vco4', toPort: 'vOct' },
            { fromModule: 'midi', fromPort: 'gate4', toModule: 'adsr4', toPort: 'gate' },
            // VCOs to mixer (using triangle for softer poly sound)
            { fromModule: 'vco1', fromPort: 'triangle', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vco2', fromPort: 'triangle', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'vco3', fromPort: 'triangle', toModule: 'mix', toPort: 'in3' },
            { fromModule: 'vco4', fromPort: 'triangle', toModule: 'mix', toPort: 'in4' },
            // Mixer to VCF
            { fromModule: 'mix', fromPort: 'out', toModule: 'vcf', toPort: 'audio' },
            // VCF to VCA
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // Use first ADSR for overall amplitude (simple approach)
            { fromModule: 'adsr1', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            // VCA to output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
