/**
 * Test - Envelope Follower Sidechain
 *
 * Demonstrates sidechain ducking effect:
 * - Kick drum triggers envelope follower
 * - Attenuverter scales inverted envelope to VCA range
 * - Creates classic sidechain pumping effect
 *
 * Try adjusting slope for different ducking response.
 */
export default {
    name: 'Test - Envf Sidechain',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'envf', instanceId: 'envf', row: 1 },
            { type: 'atten', instanceId: 'atten', row: 1 },
            { type: 'vco', instanceId: 'vco', row: 1 },
            { type: 'vca', instanceId: 'vca', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.3033 },
            kick: { pitch: 0.3133, decay: 0.5, tone: 0.5, click: 0.5 },
            envf: { threshold: 0.5733, gain: 0.9667 },
            atten: { atten1: 1, offset1: 0, atten2: 1, offset2: 0.5 },
            vco: { coarse: 0.32, fine: 0, glide: 5 },
            vcf: { cutoff: 0.5533, resonance: 0.5267 },
            vca: { ch1Gain: 1, ch2Gain: 0.8 },
            mix: { lvl1: 0.5867, lvl2: 0.34, lvl3: 0.8, lvl4: 0.8 },
            out: { volume: 0.6 }
        },
        switches: {
            clk: { pause: false },
            envf: { slope: true }
        },
        cables: [
            // Clock triggers kick
            { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
            // Kick audio to envelope follower
            { fromModule: 'kick', fromPort: 'out', toModule: 'envf', toPort: 'audio' },
            // Inverted envelope through attenuverter to scale 0-10V to 0-5V
            { fromModule: 'envf', fromPort: 'inv', toModule: 'atten', toPort: 'in1' },
            // VCO through filter for pad sound
            { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            // Scaled envelope controls VCA (sidechain ducking)
            { fromModule: 'atten', fromPort: 'out1', toModule: 'vca', toPort: 'ch1CV' },
            // Mix kick and ducked pad
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in2' },
            // Mix to output
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
