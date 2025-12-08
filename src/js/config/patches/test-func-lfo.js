/**
 * Test - Function Generator LFO
 *
 * Demonstrates FUNC as a complex LFO:
 * - Cycle mode creates continuous waveform
 * - Rise/Fall create asymmetric shapes
 * - Curve morphs between triangle/saw/exp
 *
 * Try: Equal Rise/Fall for triangle,
 * Fast Rise + Slow Fall for ramp down,
 * Slow Rise + Fast Fall for ramp up.
 */
export default {
    name: 'Test - Func LFO',
    factory: true,
    state: {
        modules: [
            { type: 'func', instanceId: 'func', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            func: { rise: 0.3267, fall: 0.64, curve: 0.5 },
            vco: { coarse: 0.3067, fine: 0, glide: 5 },
            vcf: { cutoff: 0.4, resonance: 0.5 },
            vca: { ch1Gain: 1, ch2Gain: 0.8 },
            mix: { lvl1: 0.8, lvl2: 0.8, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            func: { cycle: true }
        },
        cables: [
            // FUNC LFO modulates filter cutoff
            { fromModule: 'func', fromPort: 'out', toModule: 'vcf', toPort: 'cutoffCV' },
            // VCO through modulated filter
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // Output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
