/**
 * Test - Attenuverter
 *
 * Demonstrates the attenuverter module:
 * - LFO → Attenuverter → VCO pitch (scaled modulation)
 * - Attenuverter set to reduce LFO range for subtle vibrato
 *
 * Try adjusting the Att1 knob:
 * - Center (0.5): No modulation
 * - Right of center: Subtle to full vibrato
 * - Left of center: Inverted vibrato
 */
export default {
    name: 'Test - Attenuverter',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'atten', instanceId: 'atten', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rateKnob: 0.6, waveKnob: 0 },
            atten: { atten1: 0.55, offset1: 0.5, atten2: 0.5, offset2: 0.5 },
            vco: { coarse: 0.35, fine: 0, glide: 0 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            lfo: { range: 0 }
        },
        cables: [
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'atten', toPort: 'in1' },
            { fromModule: 'atten', fromPort: 'out1', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
