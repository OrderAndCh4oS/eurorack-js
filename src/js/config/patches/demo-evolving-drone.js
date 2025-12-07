/**
 * Demo - Evolving Rhythmic Drone
 *
 * Complex patch using all module types with random melody generation.
 * Two voices: filtered lead + bass, with S&H random pitch through arpeggiator.
 *
 * Signal flow:
 * - CLK -> DIV (two divisions for rhythmic variation)
 * - NSE -> S&H (random voltages sampled on clock)
 * - S&H -> QUANT -> ARP (quantized random notes arpeggiated)
 * - ARP -> VCO1 (lead) and VCO2 (bass, -1 octave)
 * - LFO -> VCF (slow filter sweep on lead)
 * - DIV out1 -> ADSR1 -> VCA1 (lead envelope)
 * - DIV out2 -> ADSR2 -> VCA2 (bass envelope, slower)
 * - MIX combines both voices -> OUT
 */
export default {
    name: 'Demo - Evolving Drone',
    factory: true,
    state: {
        modules: [
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'nse', instanceId: 'nse', row: 1 },
            { type: 'sh', instanceId: 'sh', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'arp', instanceId: 'arp', row: 1 },
            { type: 'vco', instanceId: 'vco1', row: 1 },
            { type: 'vcf', instanceId: 'vcf', row: 1 },
            { type: 'adsr', instanceId: 'adsr1', row: 1 },
            { type: 'vca', instanceId: 'vca1', row: 1 },
            { type: 'vco', instanceId: 'vco2', row: 1 },
            { type: 'adsr', instanceId: 'adsr2', row: 1 },
            { type: 'vca', instanceId: 'vca2', row: 1 },
            { type: 'mix', instanceId: 'mix', row: 1 },
            { type: 'out', instanceId: 'out', row: 1 }
        ],
        knobs: {
            clk: { rate: 0.79 },
            div: { rate1: 0.7833333333333333, rate2: 0.5516666666666666 },
            lfo: { rateKnob: 0.27, waveKnob: 0.2733333333333333 },
            nse: { rate: 1 },
            sh: { slew1: 0, slew2: 0 },
            quant: { scale: 4, octave: 0, semitone: 0 },
            arp: { root: 0, chord: 3, mode: 0 },
            vco1: { coarse: 0.45, fine: 0, glide: 15 },
            vcf: { cutoff: 0.38333333333333336, resonance: 0.35 },
            adsr1: { attack: 0.11, decay: 0.25, sustain: 0.4, release: 0.3933333333333333 },
            vca1: { ch1Gain: 0.8, ch2Gain: 0.8 },
            vco2: { coarse: 0.32, fine: 0, glide: 25 },
            adsr2: { attack: 0.09, decay: 0.35, sustain: 0.6, release: 0.6833333333333333 },
            vca2: { ch1Gain: 0.8, ch2Gain: 0.8 },
            mix: { lvl1: 0.7, lvl2: 0.5, lvl3: 0, lvl4: 0 },
            out: { volume: 0.65 }
        },
        switches: {
            clk: { pause: false },
            lfo: { range: false },
            nse: { vcaMode: false },
            arp: { octaves: true }
        },
        buttons: {},
        cables: [
            // Clock distribution
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'sh', toPort: 'trig1' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },

            // Random pitch generation: Noise -> S&H -> Quantizer -> Arp
            { fromModule: 'nse', fromPort: 'noise', toModule: 'sh', toPort: 'in1' },
            { fromModule: 'sh', fromPort: 'out1', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'arp', toPort: 'rootCV' },

            // Pitch CV to oscillators
            { fromModule: 'arp', fromPort: 'cv', toModule: 'vco1', toPort: 'vOct' },
            { fromModule: 'arp', fromPort: 'cv', toModule: 'vco2', toPort: 'vOct' },

            // Voice 1 (lead): VCO -> VCF -> VCA (with LFO modulating filter)
            { fromModule: 'vco1', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vcf', toPort: 'cutoffCV' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca1', toPort: 'ch2In' },

            // Voice 1 envelope: DIV out1 -> ADSR1 -> VCA1
            { fromModule: 'div', fromPort: 'out1', toModule: 'adsr1', toPort: 'gate' },
            { fromModule: 'adsr1', fromPort: 'env', toModule: 'vca1', toPort: 'ch2CV' },

            // Voice 2 (bass): VCO -> VCA (unfiltered triangle for warmth)
            { fromModule: 'vco2', fromPort: 'triangle', toModule: 'vca2', toPort: 'ch2In' },

            // Voice 2 envelope: DIV out2 -> ADSR2 -> VCA2
            { fromModule: 'div', fromPort: 'out2', toModule: 'adsr2', toPort: 'gate' },
            { fromModule: 'adsr2', fromPort: 'env', toModule: 'vca2', toPort: 'ch2CV' },

            // Mix both voices to output
            { fromModule: 'vca1', fromPort: 'ch2Out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'vca2', fromPort: 'ch2Out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
        ]
    }
};
