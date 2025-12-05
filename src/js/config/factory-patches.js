/**
 * Factory preset patches for the eurorack synthesizer
 *
 * Each patch contains:
 *   - name: Display name
 *   - factory: true (marks as read-only factory patch)
 *   - state: Patch state object with knobs, switches, buttons, cables
 */

export const FACTORY_PATCHES = {
    /* === Debug Patches - Signal chain diagnostics === */
    'Debug 1 - VCO→VCF→Out': {
        name: 'Debug 1 - VCO→VCF→Out',
        factory: true,
        state: {
            knobs: {
                vco: { coarse: 0.25, fine: 0, glide: 5 },
                vcf: { cutoff: 0.5, resonance: 0.3 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
                { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Debug 2 - LFO→Quant→VCO': {
        name: 'Debug 2 - LFO→Quant→VCO',
        factory: true,
        state: {
            knobs: {
                lfo: { rateKnob: 0.3, waveKnob: 0.25 },
                quant: { scale: 1, octave: 0, semitone: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 15 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {
                lfo: { range: false }
            },
            cables: [
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'quant', toPort: 'cv' },
                { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Debug 3 - Clock→ADSR→VCA': {
        name: 'Debug 3 - Clock→ADSR→VCA',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.4, swing: 0 },
                vco: { coarse: 0.3, fine: 0, glide: 5 },
                adsr: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.3 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'clock', fromPort: 'div2', toModule: 'adsr', toPort: 'gate' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch2In' },
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },

    /* === Test Patches - Isolated module tests === */
    'Test - VCO Only': {
        name: 'Test - VCO Only',
        factory: true,
        state: {
            knobs: {
                vco: { coarse: 0.35, fine: 0, glide: 5 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vco', fromPort: 'ramp', toModule: 'vca', toPort: 'ch2In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - LFO → VCO Pitch': {
        name: 'Test - LFO → VCO Pitch',
        factory: true,
        state: {
            knobs: {
                lfo: { rateKnob: 0.5, waveKnob: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 5 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {
                lfo: { range: false }
            },
            cables: [
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - VCF Resonance': {
        name: 'Test - VCF Resonance',
        factory: true,
        state: {
            knobs: {
                lfo: { rateKnob: 0.4, waveKnob: 0.5 },
                vco: { coarse: 0.25, fine: 0, glide: 5 },
                vcf: { cutoff: 0.4, resonance: 0.7 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {
                lfo: { range: false }
            },
            cables: [
                { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'vcf', toPort: 'cutoffCV' },
                { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - ADSR Envelope': {
        name: 'Test - ADSR Envelope',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.35, swing: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 5 },
                adsr: { attack: 0.15, decay: 0.3, sustain: 0.5, release: 0.35 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                { fromModule: 'clock', fromPort: 'div2', toModule: 'adsr', toPort: 'gate' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Noise Outputs': {
        name: 'Test - Noise Outputs',
        factory: true,
        state: {
            knobs: {
                noise: { rate: 0.5, slew: 0 },
                vca: { ch1Gain: 0.5, ch2Gain: 0.5 },
                out: { volume: 0.4 }
            },
            switches: {},
            cables: [
                { fromModule: 'noise', fromPort: 'white', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'noise', fromPort: 'pink', toModule: 'vca', toPort: 'ch2In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - S&H → Pitch': {
        name: 'Test - S&H → Pitch',
        factory: true,
        state: {
            knobs: {
                noise: { rate: 0.4, slew: 0.2 },
                vco: { coarse: 0.35, fine: 0, glide: 10 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'noise', fromPort: 'sh', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Clock Divisions': {
        name: 'Test - Clock Divisions',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.45, swing: 0 },
                vco: { coarse: 0.3, fine: 0, glide: 2 },
                adsr: { attack: 0.05, decay: 0.2, sustain: 0.0, release: 0.15 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'clock', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
                { fromModule: 'clock', fromPort: 'div4', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'pulse', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Quantizer Scales': {
        name: 'Test - Quantizer Scales',
        factory: true,
        state: {
            knobs: {
                lfo: { rateKnob: 0.45, waveKnob: 0.25 },
                quant: { scale: 1, octave: 0, semitone: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 15 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {
                lfo: { range: false }
            },
            cables: [
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'quant', toPort: 'cv' },
                { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Arpeggiator': {
        name: 'Test - Arpeggiator',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.4, swing: 0 },
                arp: { root: 0, chord: 1, mode: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 10 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {
                arp: { octaves: 2 }
            },
            cables: [
                { fromModule: 'clock', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },
                { fromModule: 'arp', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },

    /* === Demo Patches === */
    'Demo - Melodic Arp': {
        name: 'Demo - Melodic Arp',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.37, swing: 0 },
                lfo: { rateKnob: 0.44, waveKnob: 0.66 },
                noise: { rate: 0.31, slew: 0 },
                quant: { scale: 8, octave: 0, semitone: 5 },
                arp: { root: 2, chord: 3, mode: 2 },
                vco: { coarse: 0.4, fine: -1.84, glide: 32 },
                vcf: { cutoff: 0.37, resonance: 0.3 },
                adsr: { attack: 0.2, decay: 0.3, sustain: 0.7, release: 0.47 },
                vca: { ch1Gain: 0.7, ch2Gain: 0.27 },
                out: { volume: 0.67 }
            },
            switches: {
                lfo: { range: false },
                arp: { octaves: false }
            },
            cables: [
                { fromModule: 'clock', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },
                { fromModule: 'arp', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'lfo', fromPort: 'secondary', toModule: 'vco', toPort: 'pwm' },
                { fromModule: 'lfo', fromPort: 'secondary', toModule: 'vca', toPort: 'ch2CV' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vco', fromPort: 'pulse', toModule: 'vca', toPort: 'ch2In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Demo - Pulsing Bass': {
        name: 'Demo - Pulsing Bass',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.76, swing: 0 },
                vco: { coarse: 0.3, fine: 0, glide: 5 },
                vcf: { cutoff: 0.36, resonance: 0.69 },
                adsr: { attack: 0, decay: 0.26, sustain: 0.71, release: 0.84 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                { fromModule: 'clock', fromPort: 'div2', toModule: 'adsr', toPort: 'gate' },
                { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
                { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch2In' },
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch2Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Demo - S&H Random': {
        name: 'Demo - S&H Random',
        factory: true,
        state: {
            knobs: {
                clock: { bpm: 0.45, swing: 0 },
                lfo: { rateKnob: 0.4, waveKnob: 0 },
                noise: { rate: 0.35, slew: 0.25 },
                quant: { scale: 10, octave: 0, semitone: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 20 },
                vcf: { cutoff: 0.5, resonance: 0.4 },
                adsr: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.25 },
                vca: { ch1Gain: 0.7, ch2Gain: 0.7 },
                out: { volume: 0.65 }
            },
            switches: {
                lfo: { range: false }
            },
            cables: [
                { fromModule: 'noise', fromPort: 'sh', toModule: 'quant', toPort: 'cv' },
                { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
                { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    }
};
