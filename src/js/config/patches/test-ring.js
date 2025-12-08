/**
 * Test - Ring Modulator
 *
 * Demonstrates ring modulation creating bell-like tones:
 * - Clock triggers envelope
 * - Two VCOs at different intervals through ring mod
 * - Envelope shapes amplitude for percussive bells
 *
 * Try adjusting VCO2's coarse tuning for different bell characters.
 */
export default {
    name: 'Test - Ring',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'ring', instanceId: 'ring', row: 1 },
            { type: 'adsr', instanceId: 'adsr', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3 },
            vco1: { coarse: 0.45, fine: 0, glide: 5 },
            vco2: { coarse: 0.7, fine: 0, glide: 5 },
            ring: { mix: 1 },
            adsr: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.707 },
            vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false }
        },
        cables: [
            // Clock triggers envelope
            { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
            // Two VCOs into ring mod
            { fromModule: 'vco1', fromPort: 'triangle', toModule: 'ring', toPort: 'x' },
            { fromModule: 'vco2', fromPort: 'triangle', toModule: 'ring', toPort: 'y' },
            // Ring mod through VCA controlled by envelope
            { fromModule: 'ring', fromPort: 'out', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },
            // VCA to output
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
        ]
    }
};
