/**
 * Test - Envelope Follower
 *
 * Simple demonstration of envelope follower:
 * - LFO modulates VCO1 creating varying amplitude
 * - Envelope follower tracks VCO1's amplitude
 * - Envelope controls VCA on VCO2
 * - VCO2 plays when VCO1 is loud
 *
 * You should hear VCO2 (higher pitch) follow the dynamics of VCO1.
 */
export default {
    name: 'Test - Envf',
    factory: true,
    state: {
        modules: [
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vca', instanceId: 'vca1', row: 1 },
            { type: 'envf', instanceId: 'envf', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'vca', instanceId: 'vca2', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            lfo: { rateKnob: 0.25, waveKnob: 0 },
            vco1: { coarse: 0.35, fine: 0, glide: 5 },
            vca1: { ch1Gain: 1, ch2Gain: 0.8 },
            envf: { threshold: 0.34, gain: 1 },
            vco2: { coarse: 0.55, fine: 0, glide: 5 },
            vca2: { ch1Gain: 1, ch2Gain: 0.8 },
            mix: { lvl1: 0.8, lvl2: 0.8, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.5 }
        },
        switches: {
            lfo: { range: false },
            envf: { slope: false }
        },
        cables: [
            // LFO controls VCO1 amplitude (tremolo)
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vca1', toPort: 'ch1CV' },
            { fromModule: 'vco1', fromPort: 'triangle', toModule: 'vca1', toPort: 'ch1In' },
            // VCO1 output feeds envelope follower
            { fromModule: 'vca1', fromPort: 'ch1Out', toModule: 'envf', toPort: 'audio' },
            // Envelope follower controls VCO2's VCA
            { fromModule: 'vco2', fromPort: 'triangle', toModule: 'vca2', toPort: 'ch1In' },
            { fromModule: 'envf', fromPort: 'env', toModule: 'vca2', toPort: 'ch1CV' },
            // Mix both VCOs
            { fromModule: 'vca1', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vca2', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in2' },
            // Mix to output
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
