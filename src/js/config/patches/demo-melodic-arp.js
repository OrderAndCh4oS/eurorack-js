/**
 * Demo - Melodic Arp
 * Melodic arpeggiator patch with modulation
 */
export default {
    name: 'Demo - Melodic Arp',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'arp', instanceId: 'arp', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.23 },
            lfo: { rateKnob: 0.44, waveKnob: 0.66 },
            arp: { root: 2, chord: 3, mode: 2 },
            vco: { coarse: 0.4, fine: -1.84, glide: 32 },
            vca: { ch1Gain: 0.7, ch2Gain: 0.27 },
            out: { volume: 0.67 }
        },
        switches: {
            lfo: { range: 0 },
            arp: { octaves: 1 }
        },
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },
            { fromModule: 'arp', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'lfo', fromPort: 'secondary', toModule: 'vco', toPort: 'pwm' },
            { fromModule: 'lfo', fromPort: 'secondary', toModule: 'vca', toPort: 'ch2CV' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'vco', fromPort: 'pulse', toModule: 'vca', toPort: 'ch2In' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
