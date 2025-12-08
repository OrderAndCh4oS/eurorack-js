/**
 * Test - Function Generator Slew
 *
 * Demonstrates FUNC as a slew limiter / portamento:
 * - Sequencer CV goes through FUNC
 * - FUNC smooths the steps into glides
 * - Rise = glide up speed, Fall = glide down speed
 *
 * Try: Equal Rise/Fall for symmetric glide,
 * or different values for asymmetric portamento.
 */
export default {
    name: 'Test - Func Slew',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'seq', instanceId: 'seq', row: 1 },
            { type: 'func', instanceId: 'func', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.35 },
            seq: { step1: 0.2, step2: 0.5, step3: 0.3, step4: 0.7, step5: 0.4, step6: 0.6, step7: 0.35, step8: 0.8, length: 8, range: 1, direction: 0 },
            func: { rise: 0.3833, fall: 0.62, curve: 0.3 },
            vco: { coarse: 0.35, fine: 0, glide: 0 },
            vcf: { cutoff: 0.6, resonance: 0.3 },
            vca: { ch1Gain: 1, ch2Gain: 0.8 },
            mix: { lvl1: 0.8, lvl2: 0.8, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            clk: { pause: false },
            func: { cycle: false }
        },
        buttons: {
            seq: { gate1: 1, gate2: 1, gate3: 1, gate4: 1, gate5: 1, gate6: 1, gate7: 1, gate8: 1 }
        },
        cables: [
            // Clock drives sequencer
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            // Sequencer CV through FUNC slew limiter
            { fromModule: 'seq', fromPort: 'cv', toModule: 'func', toPort: 'in' },
            // Slewed CV to VCO pitch
            { fromModule: 'func', fromPort: 'out', toModule: 'vco', toPort: 'vOct' },
            // VCO through filter
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // Output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
