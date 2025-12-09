/**
 * Test patch for MIDI-CV module
 * Monophonic MIDI keyboard → VCO → VCF → VCA → Output
 *
 * Play a MIDI keyboard to hear notes. Velocity controls VCA.
 * Mod wheel controls filter cutoff.
 */
export default {
    name: 'Test: MIDI-CV',
    factory: true,
    state: {
        modules: [
            { type: 'midi-cv', instanceId: 'midi', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            midi: { channel: 0, transpose: 0, bendRange: 2 },
            vco: { coarse: 0.5, fine: 0, pw: 0.5 },
            vcf: { cutoff: 0.6, resonance: 0.3, env: 0.4 },
            adsr: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.3 },
            vca: { ch1Level: 0.8, ch2Level: 0 },
            out: { levelL: 0.7, levelR: 0.7 }
        },
        switches: {
            midi: { legato: 0 }
        },
        cables: [
            // Pitch CV to VCO
            { fromModule: 'midi', fromPort: 'pitch', toModule: 'vco', toPort: 'vOct' },
            // Gate to ADSR
            { fromModule: 'midi', fromPort: 'gate', toModule: 'adsr', toPort: 'gate' },
            // Mod wheel to filter cutoff
            { fromModule: 'midi', fromPort: 'mod', toModule: 'vcf', toPort: 'cutoffCV' },
            // VCO to VCF
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
            // VCF to VCA
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // ADSR to VCA CV
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            // VCA to output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
