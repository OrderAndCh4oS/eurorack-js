/**
 * Test - Function Generator EOC Clock
 *
 * Demonstrates FUNC's End of Cycle output:
 * - FUNC cycles as master clock source
 * - EOC triggers kick drum
 * - Rise/Fall control tempo and swing
 *
 * Try: Asymmetric Rise/Fall creates swing feel.
 * Fast Rise + Slow Fall = lazy swing.
 */
export default {
    name: 'Test - Func EOC',
    factory: true,
    state: {
        modules: [
            { type: 'func', instanceId: 'func', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'atten', instanceId: 'atten', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            func: { rise: 0.61, fall: 0.4067, curve: 0.7667 },
            kick: { pitch: 0.35, decay: 0.5, tone: 0.5, click: 0.5 },
            vco: { coarse: 0.25, fine: 0, glide: 5 },
            vcf: { cutoff: 0.5, resonance: 0.4 },
            vca: { ch1Gain: 1, ch2Gain: 0.8 },
            atten: { atten1: 0.5, offset1: 0, atten2: 0.5, offset2: 0 },
            mix: { lvl1: 0.7, lvl2: 0.5, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            func: { cycle: true }
        },
        cables: [
            // FUNC cycling - EOC triggers kick
            { fromModule: 'func', fromPort: 'eoc', toModule: 'kick', toPort: 'trigger' },
            // FUNC envelope also controls VCA for bass
            { fromModule: 'func', fromPort: 'out', toModule: 'atten', toPort: 'in1' },
            { fromModule: 'atten', fromPort: 'out1', toModule: 'vca', toPort: 'ch1CV' },
            // Bass voice
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // Mix kick and bass
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in2' },
            // Output
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
