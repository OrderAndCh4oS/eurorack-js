/**
 * Deep Abyss
 *
 * Subterranean darkness. Massive low-end drone with glacial movement.
 * Sparse, haunting melody fragments emerging from the depths.
 *
 * - Sub-bass drone with slow filter sweeps
 * - Ring mod for metallic tension
 * - Sparse melody with heavy portamento
 * - Cavernous reverb, long delay trails
 */
export default {
    name: 'Demo - Deep Abyss',
    factory: true,
    state: {
        modules: [
            // Row 1: Clock and modulation
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'lfo', instanceId: 'lfo1', row: 1 },
            { type: 'lfo', instanceId: 'lfo2', row: 1 },
            { type: 'nse', instanceId: 'nse', row: 1 },

            // Row 2: Sub drone voice
            { type: 'vco', instanceId: 'sub1', row: 2 },
            { type: 'vco', instanceId: 'sub2', row: 2 },
            { type: 'ring', instanceId: 'ring', row: 2 },
            { type: 'mix', instanceId: 'droneMix', row: 2 },
            { type: 'vcf', instanceId: 'droneFilter', row: 2 },

            // Row 3: Melody voice
            { type: 'seq', instanceId: 'seq', row: 3 },
            { type: 'slew', instanceId: 'slew', row: 3 },
            { type: 'vco', instanceId: 'melody', row: 3 },
            { type: 'vcf', instanceId: 'melodyFilter', row: 3 },
            { type: 'adsr', instanceId: 'env', row: 3 },
            { type: 'vca', instanceId: 'melodyVca', row: 3 },

            // Row 4: Effects and output
            { type: 'mix', instanceId: 'mainMix', row: 4 },
            { type: 'vcf', instanceId: 'masterFilter', row: 4 },
            { type: 'verb', instanceId: 'verb', row: 4 },
            { type: 'dly', instanceId: 'dly', row: 4 },
            { type: 'out', instanceId: 'out', row: 4 }
        ],
        knobs: {
            // Clock
            clk: { rate: 0.273 },

            // Divisions
            div: { rate1: 0.2, rate2: 0.4 },

            // Glacial LFOs
            lfo1: { rateKnob: 0.05, waveKnob: 0.3 },
            lfo2: { rateKnob: 0.03, waveKnob: 0.5 },

            // Noise
            nse: { rate: 1 },

            // Sub oscillators - detuned for thickness
            sub1: { coarse: 0.267, fine: -0.3, glide: 20 },
            sub2: { coarse: 0.34, fine: 0.3, glide: 20 },

            // Ring mod
            ring: { mix: 1 },

            // Drone mix - subs + ring mod texture
            droneMix: { lvl1: 0.8, lvl2: 0.6, lvl3: 0.3, lvl4: 0 },

            // Very dark filter
            droneFilter: { cutoff: 0.15, resonance: 0.5 },

            // Sparse sequence - minor/diminished feel
            seq: {
                step1: 0.25, step2: 0, step3: 0.35, step4: 0,
                step5: 0.3, step6: 0, step7: 0.4, step8: 0.25,
                length: 8, range: 1, direction: 0
            },

            // Heavy portamento
            slew: { rate1: 0.8, rate2: 0.8 },

            // Melody - low register triangle
            melody: { coarse: 0.417, fine: 0, glide: 30 },

            // Dark melody filter
            melodyFilter: { cutoff: 0.24, resonance: 0.4 },

            // Very slow envelope
            env: { attack: 0.6, decay: 0.6, sustain: 0.3, release: 0.8 },

            // Quiet melody
            melodyVca: { ch1Gain: 0.3, ch2Gain: 0 },

            // Main mix - drone heavy
            mainMix: { lvl1: 0.9, lvl2: 0.4, lvl3: 0, lvl4: 0 },

            // Master darkness filter
            masterFilter: { cutoff: 0.3, resonance: 0.2 },

            // Massive reverb
            verb: { time: 0.95, damp: 0.6, mix: 0.6 },

            // Long delay trails
            dly: { time: 0.6, feedback: 0.7, mix: 0.4 },

            // Output
            out: { volume: 0.75 }
        },
        switches: {
            lfo1: { range: 1 },
            lfo2: { range: 1 }
        },
        buttons: {
            seq: {
                gate1: 1, gate2: 1, gate3: 1, gate4: 1,
                gate5: 1, gate6: 1, gate7: 1, gate8: 1
            }
        },
        cables: [
            // Clock routing - very slow
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'env', toPort: 'gate' },

            // LFO modulation - slow filter sweeps
            { fromModule: 'lfo1', fromPort: 'primary', toModule: 'droneFilter', toPort: 'cutoffCV' },
            { fromModule: 'lfo2', fromPort: 'primary', toModule: 'masterFilter', toPort: 'cutoffCV' },

            // Sub drone voice
            { fromModule: 'sub1', fromPort: 'triangle', toModule: 'droneMix', toPort: 'in1' },
            { fromModule: 'sub2', fromPort: 'triangle', toModule: 'droneMix', toPort: 'in2' },

            // Ring mod for metallic texture
            { fromModule: 'sub1', fromPort: 'ramp', toModule: 'ring', toPort: 'x' },
            { fromModule: 'nse', fromPort: 'noise', toModule: 'ring', toPort: 'y' },
            { fromModule: 'ring', fromPort: 'out', toModule: 'droneMix', toPort: 'in3' },

            // Drone through dark filter
            { fromModule: 'droneMix', fromPort: 'out', toModule: 'droneFilter', toPort: 'audio' },

            // Melody voice
            { fromModule: 'seq', fromPort: 'cv', toModule: 'slew', toPort: 'in1' },
            { fromModule: 'slew', fromPort: 'out1', toModule: 'melody', toPort: 'vOct' },
            { fromModule: 'melody', fromPort: 'triangle', toModule: 'melodyFilter', toPort: 'audio' },
            { fromModule: 'melodyFilter', fromPort: 'lpf', toModule: 'melodyVca', toPort: 'ch1In' },
            { fromModule: 'env', fromPort: 'env', toModule: 'melodyVca', toPort: 'ch1CV' },

            // Mix voices
            { fromModule: 'droneFilter', fromPort: 'lpf', toModule: 'mainMix', toPort: 'in1' },
            { fromModule: 'melodyVca', fromPort: 'ch1Out', toModule: 'mainMix', toPort: 'in2' },

            // Master filter for overall darkness
            { fromModule: 'mainMix', fromPort: 'out', toModule: 'masterFilter', toPort: 'audio' },

            // Effects chain
            { fromModule: 'masterFilter', fromPort: 'lpf', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'masterFilter', fromPort: 'lpf', toModule: 'verb', toPort: 'audioR' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'dly', toPort: 'audio' },

            // Output
            { fromModule: 'dly', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
