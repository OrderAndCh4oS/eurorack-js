/**
 * Test patch for MIDI-CC module
 * Use MIDI CC knobs to control synth parameters in real-time.
 *
 * Default mappings:
 * - CC1 (Mod wheel) → VCF Cutoff
 * - CC7 (Volume) → VCA Level
 * - CC74 (Brightness) → VCO FM amount
 * - CC71 (Resonance) → VCF Resonance
 *
 * Use with the midi-controller.html dashboard or a hardware controller.
 */
export default {
    name: 'Test: MIDI-CC',
    factory: true,
    state: {
        modules: [
            { type: 'midi-cv', instanceId: 'midi', row: 1 },
            { type: 'midi-cc', instanceId: 'cc', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            midi: { channel: 0, transpose: 0, bendRange: 2 },
            cc: { channel: 0, cc1: 1, cc2: 7, cc3: 74, cc4: 71 },
            lfo: { rate: 0.4, shape: 0 },
            vco: { coarse: 0.5, fine: 0, pw: 0.5 },
            vcf: { cutoff: 0.5, resonance: 0.3, env: 0.3 },
            adsr: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.3 },
            vca: { ch1Level: 0.7, ch2Level: 0 },
            out: { levelL: 0.7, levelR: 0.7 }
        },
        switches: {},
        cables: [
            // MIDI-CV for notes
            { fromModule: 'midi', fromPort: 'pitch', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'midi', fromPort: 'gate', toModule: 'adsr', toPort: 'gate' },
            // CC1 (mod wheel) → Filter cutoff CV
            { fromModule: 'cc', fromPort: 'cv1', toModule: 'vcf', toPort: 'cutoffCV' },
            // CC3 (brightness/74) → LFO rate for vibrato depth control
            { fromModule: 'cc', fromPort: 'cv3', toModule: 'vco', toPort: 'fm' },
            // CC4 (resonance/71) → Filter resonance CV
            { fromModule: 'cc', fromPort: 'cv4', toModule: 'vcf', toPort: 'resCV' },
            // LFO for subtle vibrato
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'pwm' },
            // Audio path
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            // Output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
