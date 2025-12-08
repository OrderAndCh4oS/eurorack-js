/**
 * Demo Patch: Trip-Hop
 *
 * Portishead-inspired dark, downtempo atmosphere.
 * Slow tempo, filtered drums, detuned melodies with vinyl degradation.
 *
 * Features:
 * - Slow 85 BPM tempo
 * - Kick and snare with euclidean variation
 * - Detuned VCO melody through filter and crusher for vinyl texture
 * - Heavy reverb for atmosphere
 * - Slow LFO modulation for movement
 */
export default {
    name: 'Demo: Trip-Hop',
    factory: true,
    state: {
        modules: [
            // Clock and rhythm
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'euclid', instanceId: 'euclid', row: 1 },

            // Drums
            { type: 'kick', instanceId: 'kick', row: 1 },
            { type: 'snare', instanceId: 'snare', row: 1 },
            { type: 'hat', instanceId: 'hat', row: 1 },

            // Melodic voice
            { type: 'seq', instanceId: 'seq', row: 2 },
            { type: 'quant', instanceId: 'quant', row: 2 },
            { type: 'vco', instanceId: 'vco', row: 2 },
            { type: 'vcf', instanceId: 'vcf', row: 2 },
            { type: 'adsr', instanceId: 'adsr', row: 2 },
            { type: 'vca', instanceId: 'vca', row: 2 },

            // Modulation
            { type: 'lfo', instanceId: 'lfo', row: 2 },

            // Effects and output
            { type: 'crush', instanceId: 'crush', row: 3 },
            { type: 'mix', instanceId: 'mix', row: 3 },
            { type: 'verb', instanceId: 'verb', row: 3 },
            { type: 'out', instanceId: 'out', row: 3 }
        ],
        knobs: {
            // Slow trip-hop tempo ~85 BPM
            clk: { bpm: 85 },

            // Clock divisions for drums
            div: { rate1: 0.5, rate2: 0.4 },

            // Euclidean rhythm for snare variation (5 hits in 8 steps)
            euclid: { length: 8, hits: 5, rotation: 2 },

            // Deep, boomy kick
            kick: { pitch: 0.35, decay: 0.6, tone: 0.3, volume: 0.85 },

            // Snappy snare
            snare: { tone: 0.4, decay: 0.35, volume: 0.6 },

            // Subtle closed hat
            hat: { decay: 0.15, sizzle: 0.4, blend: 0.5 },

            // Slow, sparse melodic sequence
            seq: {
                step1: 0.3, step2: 0.5, step3: 0.4, step4: 0.6,
                step5: 0.35, step6: 0.55, step7: 0.45, step8: 0.5,
                gate1: 1, gate2: 0, gate3: 1, gate4: 0,
                gate5: 1, gate6: 1, gate7: 0, gate8: 1
            },

            // Minor scale for dark mood
            quant: { scale: 2 },  // Minor

            // Detuned, melancholic VCO
            vco: { coarse: 0.25, fine: -0.15, glide: 0.4 },

            // Dark, muted filter
            vcf: { cutoff: 0.35, resonance: 0.25 },

            // Slow, soft envelope
            adsr: { attack: 0.15, decay: 0.4, sustain: 0.3, release: 0.6 },

            // VCA for melodic voice
            vca: { ch1Gain: 0.7, ch2Gain: 0 },

            // Very slow LFO for subtle movement
            lfo: { rate: 0.15, depth: 0.5 },

            // Bit crusher for vinyl/lo-fi texture (subtle)
            crush: { bits: 0.7, rate: 0.8, mix: 0.3 },

            // Drum mix levels
            mix: { lvl1: 0.8, lvl2: 0.5, lvl3: 0.35, lvl4: 0.7 },

            // Heavy reverb for atmosphere
            verb: { time: 0.75, damp: 0.6, mix: 0.45 },

            // Master output
            out: { volume: 0.65 }
        },
        switches: {
            // Triangle wave for warmer tone
            vco: { waveform: 0 },
            // Slow LFO range
            lfo: { range: 0 },
            // Forward sequence
            seq: { direction: 0 }
        },
        cables: [
            // Clock routing
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'seq', toPort: 'clock' },

            // Drum triggers
            { fromModule: 'div', fromPort: 'out1', toModule: 'kick', toPort: 'trigger' },
            { fromModule: 'euclid', fromPort: 'trig', toModule: 'snare', toPort: 'trigger' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
            { fromModule: 'clk', fromPort: 'clock', toModule: 'euclid', toPort: 'clock' },

            // Melodic voice chain
            { fromModule: 'seq', fromPort: 'cv', toModule: 'quant', toPort: 'cv' },
            { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
            { fromModule: 'vco', fromPort: 'triangle', toModule: 'vcf', toPort: 'audio' },
            { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'adsr', toPort: 'gate' },
            { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch1CV' },

            // LFO to filter for slow movement
            { fromModule: 'lfo', fromPort: 'primary', toModule: 'vcf', toPort: 'cutoffCV' },

            // Mix drums and melody
            { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
            { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
            { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
            { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'mix', toPort: 'in4' },

            // Through crusher for vinyl texture
            { fromModule: 'mix', fromPort: 'out', toModule: 'crush', toPort: 'inL' },
            { fromModule: 'mix', fromPort: 'out', toModule: 'crush', toPort: 'inR' },

            // Into reverb
            { fromModule: 'crush', fromPort: 'outL', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'crush', fromPort: 'outR', toModule: 'verb', toPort: 'audioR' },

            // To output
            { fromModule: 'verb', fromPort: 'outL', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
