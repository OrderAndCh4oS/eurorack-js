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
                lfo: { range: 0 }
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
    'Debug 3 - Clk→Div→ADSR→VCA': {
        name: 'Debug 3 - Clk→Div→ADSR→VCA',
        factory: true,
        state: {
            knobs: {
                clk: { rate: 0.25 },
                div: { rate1: 0.4375, rate2: 0.5 },  // rate1=/2, rate2=x1
                vco: { coarse: 0.3, fine: 0, glide: 5 },
                adsr: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.3 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'adsr', toPort: 'gate' },
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
                lfo: { range: 0 }
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
                lfo: { range: 0 }
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
                clk: { rate: 0.22 },
                div: { rate1: 0.4375, rate2: 0.5 },  // rate1=/2
                vco: { coarse: 0.35, fine: 0, glide: 5 },
                adsr: { attack: 0.15, decay: 0.3, sustain: 0.5, release: 0.35 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'adsr', toPort: 'gate' },
                { fromModule: 'vco', fromPort: 'triangle', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Noise Output': {
        name: 'Test - Noise Output',
        factory: true,
        state: {
            knobs: {
                nse: { rate: 0.8 },
                vca: { ch1Gain: 0.5, ch2Gain: 0.5 },
                out: { volume: 0.4 }
            },
            switches: {
                nse: { vcaMode: 0 }
            },
            cables: [
                { fromModule: 'nse', fromPort: 'noise', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'nse', fromPort: 'noise', toModule: 'vca', toPort: 'ch2In' },
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
                nse: { rate: 1 },
                sh: { slew1: 0.2, slew2: 0 },
                clk: { rate: 0.25 },
                vco: { coarse: 0.35, fine: 0, glide: 10 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'nse', fromPort: 'noise', toModule: 'sh', toPort: 'in1' },
                { fromModule: 'clk', fromPort: 'clock', toModule: 'sh', toPort: 'trig1' },
                { fromModule: 'sh', fromPort: 'out1', toModule: 'vco', toPort: 'vOct' },
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
                clk: { rate: 0.28 },
                div: { rate1: 0.5, rate2: 0.3125 },  // rate1=x1, rate2=/4
                vco: { coarse: 0.3, fine: 0, glide: 2 },
                adsr: { attack: 0.05, decay: 0.2, sustain: 0.0, release: 0.15 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'adsr', toPort: 'gate' },
                { fromModule: 'div', fromPort: 'out2', toModule: 'vco', toPort: 'vOct' },
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
                lfo: { range: 0 }
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
                clk: { rate: 0.25 },
                arp: { root: 0, chord: 1, mode: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 10 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.5 }
            },
            switches: {
                arp: { octaves: 2 }
            },
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },
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
                clk: { rate: 0.23 },
                lfo: { rateKnob: 0.44, waveKnob: 0.66 },
                quant: { scale: 8, octave: 0, semitone: 5 },
                arp: { root: 2, chord: 3, mode: 2 },
                vco: { coarse: 0.4, fine: -1.84, glide: 32 },
                vcf: { cutoff: 0.37, resonance: 0.3 },
                adsr: { attack: 0.2, decay: 0.3, sustain: 0.7, release: 0.47 },
                vca: { ch1Gain: 0.7, ch2Gain: 0.27 },
                out: { volume: 0.67 }
            },
            switches: {
                lfo: { range: 0 },
                arp: { octaves: 1 }
            },
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'arp', toPort: 'trigger' },
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
                clk: { rate: 0.4 },
                div: { rate1: 0.4375, rate2: 0.5 },  // rate1=/2
                vco: { coarse: 0.3, fine: 0, glide: 5 },
                vcf: { cutoff: 0.36, resonance: 0.69 },
                adsr: { attack: 0, decay: 0.26, sustain: 0.71, release: 0.84 },
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'adsr', toPort: 'gate' },
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
                clk: { rate: 0.28 },
                lfo: { rateKnob: 0.4, waveKnob: 0 },
                nse: { rate: 1 },
                sh: { slew1: 0.25, slew2: 0 },
                quant: { scale: 10, octave: 0, semitone: 0 },
                vco: { coarse: 0.35, fine: 0, glide: 20 },
                vcf: { cutoff: 0.5, resonance: 0.4 },
                adsr: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.25 },
                vca: { ch1Gain: 0.7, ch2Gain: 0.7 },
                out: { volume: 0.65 }
            },
            switches: {
                lfo: { range: 0 }
            },
            cables: [
                { fromModule: 'nse', fromPort: 'noise', toModule: 'sh', toPort: 'in1' },
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'sh', toPort: 'trig1' },
                { fromModule: 'sh', fromPort: 'out1', toModule: 'quant', toPort: 'cv' },
                { fromModule: 'quant', fromPort: 'cv', toModule: 'vco', toPort: 'vOct' },
                { fromModule: 'vco', fromPort: 'pulse', toModule: 'vcf', toPort: 'audio' },
                { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Demo - Filter Envelope': {
        name: 'Demo - Filter Envelope',
        factory: true,
        // This patch demonstrates dynamic processing order:
        // ADSR → VCF cutoff requires ADSR to process BEFORE VCF.
        // Old fixed order: VCF processed before ADSR (12ms latency on filter response)
        // New dynamic order: ADSR processes first because cable creates dependency
        state: {
            knobs: {
                clk: { rate: 0.3 },
                div: { rate1: 0.5, rate2: 0.5 },
                vco: { coarse: 0.25, fine: 0, glide: 0 },
                vcf: { cutoff: 0.15, resonance: 0.75 },  // Low cutoff, high res for obvious sweep
                adsr: { attack: 0.0, decay: 0.35, sustain: 0.2, release: 0.4 },  // Snappy attack
                vca: { ch1Gain: 0.8, ch2Gain: 0.8 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                // Clock → ADSR gate
                { fromModule: 'clk', fromPort: 'clock', toModule: 'adsr', toPort: 'gate' },
                // VCO → VCF → VCA → Out (audio path)
                { fromModule: 'vco', fromPort: 'ramp', toModule: 'vcf', toPort: 'audio' },
                { fromModule: 'vcf', fromPort: 'lpf', toModule: 'vca', toPort: 'ch1In' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'L' },
                { fromModule: 'vca', fromPort: 'ch1Out', toModule: 'out', toPort: 'R' },
                // ADSR → VCF cutoff (the key cable - creates ADSR before VCF dependency)
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vcf', toPort: 'cutoffCV' },
                // ADSR → VCA (amplitude envelope)
                { fromModule: 'adsr', fromPort: 'env', toModule: 'vca', toPort: 'ch2CV' }
            ]
        }
    },

    /* === Drum Test Patches === */
    'Test - Snare Only': {
        name: 'Test - Snare Only',
        factory: true,
        // Simple snare test patch for tuning the sound
        state: {
            knobs: {
                clk: { rate: 0.25 },
                snare: { snap: 0.5, decay: 0.5, pitch: 0.5 },
                mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
                out: { volume: 0.7 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'snare', toPort: 'trigger' },
                { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Kick Only': {
        name: 'Test - Kick Only',
        factory: true,
        state: {
            knobs: {
                clk: { rate: 0.25 },
                kick: { pitch: 0.3, decay: 0.5, tone: 0.3 },
                mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
                out: { volume: 0.7 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
                { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Test - Hat Only': {
        name: 'Test - Hat Only',
        factory: true,
        state: {
            knobs: {
                clk: { rate: 0.3 },
                div: { rate1: 0.4375, rate2: 0.5 },  // /2 for open hat
                hat: { decay: 0.5, sizzle: 0.5, blend: 0.5 },
                mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'clk', fromPort: 'clock', toModule: 'hat', toPort: 'trigClosed' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
                { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },

    /* === Drum Patches === */
    'Drums - Basic Beat': {
        name: 'Drums - Basic Beat',
        factory: true,
        // Simple 4/4 beat: kick on quarters, snare on 2&4, closed hat on 8ths
        state: {
            knobs: {
                clk: { rate: 0.3 },
                div: { rate1: 0.4375, rate2: 0.5 },  // rate1=/2 (half time for snare)
                kick: { pitch: 0.3, decay: 0.5, tone: 0.3 },
                snare: { snap: 0.6, decay: 0.4, pitch: 0.5 },
                hat: { decay: 0.3, sizzle: 0.5, blend: 0.4 },
                mix: { lvl1: 0.9, lvl2: 0.7, lvl3: 0.5, lvl4: 0 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                // Clock distribution
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                // Kick on every beat (clock directly)
                { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
                // Snare on half time (/2)
                { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
                // Closed hat on clock (every beat for now)
                { fromModule: 'clk', fromPort: 'clock', toModule: 'hat', toPort: 'trigClosed' },
                // Mix all drums
                { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
                { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
                // Output
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Drums - 808 Style': {
        name: 'Drums - 808 Style',
        factory: true,
        // Classic 808 house beat with open/closed hats
        state: {
            knobs: {
                clk: { rate: 0.28 },
                div: { rate1: 0.4375, rate2: 0.625 },  // rate1=/2, rate2=x2 for double-time hats
                kick: { pitch: 0.25, decay: 0.6, tone: 0.2 },
                snare: { snap: 0.5, decay: 0.5, pitch: 0.45 },
                hat: { decay: 0.4, sizzle: 0.6, blend: 0.3 },
                mix: { lvl1: 1.0, lvl2: 0.7, lvl3: 0.4, lvl4: 0 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                // Clock distribution
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                // Kick on every beat
                { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
                // Snare on half time
                { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
                // Hats on double time - closed on out2, open on half
                { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
                // Mix
                { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
                { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
                // Output
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Drums - Punchy Kick': {
        name: 'Drums - Punchy Kick',
        factory: true,
        // Focus on kick drum with pitch and tone modulation
        state: {
            knobs: {
                clk: { rate: 0.32 },
                lfo: { rateKnob: 0.2, waveKnob: 0.5 },
                kick: { pitch: 0.35, decay: 0.55, tone: 0.5 },
                mix: { lvl1: 1.0, lvl2: 0, lvl3: 0, lvl4: 0 },
                out: { volume: 0.7 }
            },
            switches: {
                lfo: { range: 0 }
            },
            cables: [
                // Kick triggered by clock
                { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
                // LFO modulates tone for evolving character
                { fromModule: 'lfo', fromPort: 'primary', toModule: 'kick', toPort: 'toneCV' },
                // Output
                { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Drums - Snare Roll': {
        name: 'Drums - Snare Roll',
        factory: true,
        // Fast snare rolls - consistent pitch for realistic roll sound
        state: {
            knobs: {
                clk: { rate: 0.4 },
                div: { rate1: 0.485, rate2: 0.5 },
                snare: { snap: 0.5, decay: 0.2, pitch: 0.4 },
                mix: { lvl1: 0.9, lvl2: 0, lvl3: 0, lvl4: 0 },
                out: { volume: 0.6 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
                { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Drums - Hat Patterns': {
        name: 'Drums - Hat Patterns',
        factory: true,
        // Open and closed hat interplay
        state: {
            knobs: {
                clk: { rate: 0.35 },
                div: { rate1: 0.368, rate2: 0.505 },
                hat: { decay: 0.333, sizzle: 0.42, blend: 0.32 },
                mix: { lvl1: 0.8, lvl2: 0, lvl3: 0, lvl4: 0 },
                out: { volume: 0.5 }
            },
            switches: {},
            cables: [
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
                { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    },
    'Drums - Full Kit': {
        name: 'Drums - Full Kit',
        factory: true,
        // Complete drum kit with all percussion
        state: {
            knobs: {
                clk: { rate: 0.28 },
                div: { rate1: 0.4375, rate2: 0.625 },  // /2 and x2
                kick: { pitch: 0.3, decay: 0.5, tone: 0.25 },
                snare: { snap: 0.6, decay: 0.4, pitch: 0.5 },
                hat: { decay: 0.35, sizzle: 0.5, blend: 0.4 },
                mix: { lvl1: 1.0, lvl2: 0.65, lvl3: 0.4, lvl4: 0 },
                out: { volume: 0.65 }
            },
            switches: {},
            cables: [
                // Clock distribution
                { fromModule: 'clk', fromPort: 'clock', toModule: 'div', toPort: 'clock' },
                // Kick on quarter notes
                { fromModule: 'clk', fromPort: 'clock', toModule: 'kick', toPort: 'trigger' },
                // Snare on backbeats (half time)
                { fromModule: 'div', fromPort: 'out1', toModule: 'snare', toPort: 'trigger' },
                // Hi-hats - closed on 8ths, open chokes on backbeat
                { fromModule: 'div', fromPort: 'out2', toModule: 'hat', toPort: 'trigClosed' },
                { fromModule: 'div', fromPort: 'out1', toModule: 'hat', toPort: 'trigOpen' },
                // Mix all three
                { fromModule: 'kick', fromPort: 'out', toModule: 'mix', toPort: 'in1' },
                { fromModule: 'snare', fromPort: 'out', toModule: 'mix', toPort: 'in2' },
                { fromModule: 'hat', fromPort: 'out', toModule: 'mix', toPort: 'in3' },
                // Stereo output
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'L' },
                { fromModule: 'mix', fromPort: 'out', toModule: 'out', toPort: 'R' }
            ]
        }
    }
};
