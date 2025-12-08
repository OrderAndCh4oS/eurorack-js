/**
 * Test Patch: CMP2
 *
 * Demonstrates the dual window comparator extracting gates from LFOs.
 * øchd provides organic modulation, CMP2 converts to rhythmic gates.
 * OR output gives longer sustained gates for smoother sound.
 * Asymmetric windows (shift1=-1, shift2=+1) create interesting rhythms.
 */
export default {
    name: 'Test: CMP2',
    factory: true,
    state: {
        modules: [
            { type: 'ochd', instanceId: 'ochd', row: 1 },
            { type: 'cmp2', instanceId: 'cmp2', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            ochd: { rate: 0.73 },
            cmp2: { shift1: -1, size1: 3.93, shift2: 1, size2: 3.47 },
            vco: { coarse: 0.34, fine: -1.04, glide: 0 },
            vcf: { cutoff: 0.58, resonance: 0.15 },
            adsr: { attack: 0, decay: 0.24, sustain: 0.29, release: 0.49 },
            vca: { ch1Gain: 0.8, ch2Gain: 0 },
            out: { volume: 0.6 }
        },
        switches: {},
        cables: [
            // LFO to comparator inputs - faster LFOs for rhythmic interest
            { fromModule: 'ochd', fromPort: 'out1', toModule: 'cmp2', toPort: 'in1' },
            { fromModule: 'ochd', fromPort: 'out3', toModule: 'cmp2', toPort: 'in2' },
            // OR output - HIGH when either comparator is active
            { fromModule: 'cmp2', fromPort: 'or', toModule: 'adsr', toPort: 'gate' },
            // Audio path
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
