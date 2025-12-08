/**
 * Test - Function Generator Envelope
 *
 * Demonstrates FUNC as an envelope generator:
 * - Clock triggers FUNC
 * - FUNC envelope controls VCA
 * - Adjust Rise/Fall for attack/decay
 * - Curve shapes the envelope response
 *
 * Try: Fast rise + slow fall for plucky sounds,
 * or slow rise + fast fall for reversed effects.
 */
export default {
    name: 'Test - Func Envelope',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'func', instanceId: 'func', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'atten', instanceId: 'atten', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.2967 },
            func: { rise: 0.35, fall: 0.6967, curve: 0.54 },
            vco: { coarse: 0.35, fine: 0, glide: 5 },
            vca: { ch1Gain: 1, ch2Gain: 0.8 },
            atten: { atten1: 1, offset1: 0, atten2: 0.5, offset2: 0 },
            mix: { lvl1: 0.8, lvl2: 0.8, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            clk: { pause: false },
            func: { cycle: false }
        },
        cables: [
            // Clock triggers FUNC envelope
            { fromModule: 'clk', fromPort: 'clock', toModule: 'func', toPort: 'trig' },
            // Scale envelope for VCA (0-10V to 0-5V)
            { fromModule: 'func', fromPort: 'out', toModule: 'atten', toPort: 'in1' },
            // VCO through envelope-controlled VCA
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'atten', fromPort: 'out1', toModule: 'vca', toPort: 'ch1CV' },
            // Output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
