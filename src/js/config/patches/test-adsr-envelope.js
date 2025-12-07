/**
 * Test - ADSR Envelope
 * Demonstrates ADSR envelope shaping with clear attack, decay, sustain, release phases
 *
 * Clock triggers the ADSR gate directly
 * VCO audio is shaped by the envelope through VCA
 * Slow clock rate allows hearing each envelope stage clearly
 */
export default {
    name: 'Test - ADSR Envelope',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.2 },
            vco: { coarse: 0.4, fine: 0, glide: 5 },
            adsr: { attack: 0.073, decay: 0.41, sustain: 0, release: 0.753 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            clk: { pause: false }
        },
        buttons: {},
        cables: [
            { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' },
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vca', toPort: 'ch1In' }
        ]
    }
};
