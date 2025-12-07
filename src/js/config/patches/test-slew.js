/**
 * Test - Slew Limiter
 *
 * Demonstrates the slew limiter module for portamento:
 * - SEQ → Slew → VCO pitch (smooth glides between notes)
 * - Clock drives the sequencer
 *
 * Try adjusting the Rate1 knob:
 * - Low values: Fast/snappy transitions
 * - High values: Slow glides between notes
 */
export default {
    name: 'Test - Slew Limiter',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'seq', instanceId: 'seq', row: 1 },
            { type: 'slew', instanceId: 'slew', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { bpm: 0.4 },
            seq: {
                step1: 0, step2: 0.25, step3: 0.5, step4: 0.75,
                step5: 1, step6: 0.75, step7: 0.5, step8: 0.25,
                length: 8, range: 1, direction: 0
            },
            slew: { rate1: 0.15, rate2: 0.1 },
            vco: { coarse: 0.35, fine: 0, glide: 0 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'cv', toModule: 'slew', toPort: 'in1' },
            { fromModule: 'slew', fromPort: 'out1', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
