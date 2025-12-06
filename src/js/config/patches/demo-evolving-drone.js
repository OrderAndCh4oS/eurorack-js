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
            // Row 1: Clock, timing, and modulation
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'lfo', instanceId: 'lfo', row: 1 },
            { type: 'nse', instanceId: 'nse', row: 1 },
            { type: 'sh', instanceId: 'sh', row: 1 },
            { type: 'quant', instanceId: 'quant', row: 1 },
            { type: 'arp', instanceId: 'arp', row: 1 },

            // Row 2: Voice 1 (lead) - filtered
            { type: 'vco', instanceId: 'vco1', row: 2 },
            { type: 'vcf', instanceId: 'vcf', row: 2 },
            { type: 'adsr', instanceId: 'adsr1', row: 2 },
            { type: 'vca', instanceId: 'vca1', row: 2 },

            // Row 2: Voice 2 (bass) - unfiltered
            { type: 'vco', instanceId: 'vco2', row: 2 },
            { type: 'adsr', instanceId: 'adsr2', row: 2 },
            { type: 'vca', instanceId: 'vca2', row: 2 },

            // Row 2: Output
            { type: 'mix', instanceId: 'mix', row: 2 },
            { type: 'out', instanceId: 'out', row: 2 }
        ],
        knobs: {
            // Clock: moderate tempo (~3Hz)
            clk: { rate: 0.35 },

            // Divider: out1=/4 (quarter notes), out2=/8 (half notes for bass)
            div: { rate1: 0.25, rate2: 0.125 },

            // LFO: very slow for filter sweep
            lfo: { rateKnob: 0.15, waveKnob: 0 },

            // Noise: full rate for rich random
            nse: { rate: 1 },

            // S&H: no slew for stepped pitches
            sh: { slew1: 0, slew2: 0 },

            // Quantizer: minor pentatonic scale for moody sound
            quant: { scale: 4, octave: 0, semitone: 0 },

            // Arpeggiator: minor chord, up pattern, 2 octaves
            arp: { root: 0, chord: 3, mode: 0 },

            // VCO1 (lead): mid-range saw
            vco1: { coarse: 0.45, fine: 0, glide: 15 },

            // VCO2 (bass): lower octave, triangle for warmth
            vco2: { coarse: 0.32, fine: 0, glide: 25 },

            // Filter: mid cutoff with some resonance
            vcf: { cutoff: 0.45, resonance: 0.35 },

            // ADSR1 (lead): plucky
            adsr1: { attack: 0.05, decay: 0.25, sustain: 0.4, release: 0.3 },

            // ADSR2 (bass): slower, more sustained
            adsr2: { attack: 0.15, decay: 0.35, sustain: 0.6, release: 0.45 },

            // VCAs: balanced levels
            vca1: { ch1Gain: 0.8, ch2Gain: 0.8 },
            vca2: { ch1Gain: 0.8, ch2Gain: 0.8 },

            // Mixer: lead slightly louder than bass
            mix: { lvl1: 0.7, lvl2: 0.5, lvl3: 0, lvl4: 0 },

            // Output: safe level
            out: { volume: 0.65 }
        },
        switches: {
            clk: { pause: 0 },
            lfo: { range: 0 },  // Slow range for filter sweep
            nse: { vcaMode: 0 },
            arp: { octaves: 2 }  // 2 octave range
        },
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
