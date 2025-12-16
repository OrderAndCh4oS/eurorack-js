/**
 * Whale Song
 *
 * Dark, cavernous atmosphere with slow melancholic melody.
 * Inspired by Lorn's brooding electronic sound and Dreadbox Nyx's
 * thick analog character.
 *
 * - Detuned drone oscillators through dark filter
 * - Slow melodic sequence weaving through
 * - Deep chorus for Nyx-style depth
 * - Reverb and delay for space
 */
export default {
    name: 'Whale Song',
    factory: true,
    state: {
        modules: [
            // Row 1: Clock and modulation
            { type: 'clk', instanceId: 'clk', row: 1 },
            { type: 'div', instanceId: 'div', row: 1 },
            { type: 'lfo', instanceId: 'lfo1', row: 1 },
            { type: 'lfo', instanceId: 'lfo2', row: 1 },
            { type: 'ochd', instanceId: 'ochd', row: 1 },

            // Row 2: Drone voice - detuned oscillators
            { type: 'vco', instanceId: 'drone1', row: 2 },
            { type: 'vco', instanceId: 'drone2', row: 2 },
            { type: 'mix', instanceId: 'droneMix', row: 2 },
            { type: 'vcf', instanceId: 'droneFilter', row: 2 },
            { type: 'vca', instanceId: 'droneVca', row: 2 },

            // Row 3: Melody voice
            { type: 'seq', instanceId: 'seq', row: 3 },
            { type: 'slew', instanceId: 'slew', row: 3 },
            { type: 'vco', instanceId: 'melody', row: 3 },
            { type: 'vcf', instanceId: 'melodyFilter', row: 3 },
            { type: 'adsr', instanceId: 'env', row: 3 },
            { type: 'vca', instanceId: 'melodyVca', row: 3 },

            // Row 4: Effects and output
            { type: 'mix', instanceId: 'mainMix', row: 4 },
            { type: 'chorus', instanceId: 'chorus', row: 4 },
            { type: 'verb', instanceId: 'verb', row: 4 },
            { type: 'dly', instanceId: 'dly', row: 4 },
            { type: 'out', instanceId: 'out', row: 4 }
        ],
        knobs: {
            // Slow clock for brooding pace
            clk: { rate: 0.18 },

            // Divider for different rhythmic elements
            div: { rate1: 0.3, rate2: 0.5 },

            // Very slow LFOs for glacial movement
            lfo1: { rateKnob: 0.08, waveKnob: 0.2 },
            lfo2: { rateKnob: 0.12, waveKnob: 0.3 },

            // OCHD for complex modulation
            ochd: { rate: 0.15 },

            // Drone oscillators - slightly detuned for thickness
            drone1: { coarse: 0.2, fine: -0.5, glide: 5 },
            drone2: { coarse: 0.2, fine: 0.5, glide: 5 },

            // Drone mix
            droneMix: { lvl1: 0.7, lvl2: 0.7, lvl3: 0, lvl4: 0 },

            // Dark filter - low cutoff, some resonance
            droneFilter: { cutoff: 0.25, resonance: 0.4 },

            // Drone level
            droneVca: { ch1Gain: 0.6, ch2Gain: 0 },

            // Slow sequence - pentatonic minor feel
            seq: {
                step1: 0.3, step2: 0.35, step3: 0.4, step4: 0.35,
                step5: 0.45, step6: 0.4, step7: 0.35, step8: 0.3,
                length: 8, direction: 0
            },

            // Portamento for smooth melody
            slew: { rate1: 0.6, rate2: 0.6 },

            // Melody oscillator - triangle for purity
            melody: { coarse: 0.35, fine: 0, glide: 10 },

            // Melody filter - slightly open
            melodyFilter: { cutoff: 0.35, resonance: 0.3 },

            // Slow envelope
            env: { attack: 0.4, decay: 0.5, sustain: 0.4, release: 0.7 },

            // Melody level
            melodyVca: { ch1Gain: 0.5, ch2Gain: 0 },

            // Main mix
            mainMix: { lvl1: 0.8, lvl2: 0.6, lvl3: 0, lvl4: 0 },

            // Thick chorus - Nyx style
            chorus: { rate: 0.3, depth: 0.6, mix: 0.5 },

            // Deep reverb
            verb: { time: 0.8, mix: 0.5, damp: 0.4 },

            // Delay for space
            dly: { time: 0.45, feedback: 0.5, mix: 0.3 },

            // Output
            out: { volume: 0.7 }
        },
        switches: {
            lfo1: { range: 1 },  // Slow range
            lfo2: { range: 1 }
        },
        cables: [
            // Clock routing
            { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
            { fromModule: 'div', fromPort: 'out2', toModule: 'seq', toPort: 'clock' },
            { fromModule: 'seq', fromPort: 'gate', toModule: 'env', toPort: 'gate' },

            // LFO modulation
            { fromModule: 'lfo1', fromPort: 'primary', toModule: 'droneFilter', toPort: 'cutoffCV' },
            { fromModule: 'lfo2', fromPort: 'primary', toModule: 'drone1', toPort: 'fm' },
            { fromModule: 'ochd', fromPort: 'out1', toModule: 'drone2', toPort: 'fm' },
            { fromModule: 'ochd', fromPort: 'out3', toModule: 'melodyFilter', toPort: 'cutoffCV' },

            // Drone voice
            { fromModule: 'drone1', fromPort: 'pulse', toModule: 'droneMix', toPort: 'in1' },
            { fromModule: 'drone2', fromPort: 'pulse', toModule: 'droneMix', toPort: 'in2' },
            { fromModule: 'droneMix', fromPort: 'out', toModule: 'droneFilter', toPort: 'audio' },
            { fromModule: 'droneFilter', fromPort: 'lpf', toModule: 'droneVca', toPort: 'ch1In' },

            // Melody voice
            { fromModule: 'seq', fromPort: 'cv', toModule: 'slew', toPort: 'in1' },
            { fromModule: 'slew', fromPort: 'out1', toModule: 'melody', toPort: 'vOct' },
            { fromModule: 'melody', fromPort: 'triangle', toModule: 'melodyFilter', toPort: 'audio' },
            { fromModule: 'melodyFilter', fromPort: 'lpf', toModule: 'melodyVca', toPort: 'ch1In' },
            { fromModule: 'env', fromPort: 'env', toModule: 'melodyVca', toPort: 'ch1CV' },
            { fromModule: 'env', fromPort: 'env', toModule: 'melodyFilter', toPort: 'cutoffCV' },

            // Mix voices
            { fromModule: 'droneVca', fromPort: 'ch1Out', toModule: 'mainMix', toPort: 'in1' },
            { fromModule: 'melodyVca', fromPort: 'ch1Out', toModule: 'mainMix', toPort: 'in2' },

            // Effects chain (delay is mono, so split after)
            { fromModule: 'mainMix', fromPort: 'out', toModule: 'chorus', toPort: 'inL' },
            { fromModule: 'mainMix', fromPort: 'out', toModule: 'chorus', toPort: 'inR' },
            { fromModule: 'chorus', fromPort: 'outL', toModule: 'verb', toPort: 'audioL' },
            { fromModule: 'chorus', fromPort: 'outR', toModule: 'verb', toPort: 'audioR' },
            { fromModule: 'verb', fromPort: 'outL', toModule: 'dly', toPort: 'audio' },

            // Output (verb R direct, delay mixed with L)
            { fromModule: 'dly', fromPort: 'out', toModule: 'out', toPort: 'L' },
            { fromModule: 'verb', fromPort: 'outR', toModule: 'out', toPort: 'R' }
        ]
    }
};
