/**
 * Module definitions for UI rendering and audio creation
 *
 * Each module definition contains:
 *   - name: Display name
 *   - hp: Width in HP (horizontal pitch) units
 *   - color: Module background color
 *   - create: Factory function to create DSP instance
 *   - knobs: Array of knob definitions
 *   - switches: Array of switch definitions
 *   - buttons: Array of button bank definitions
 *   - inputs: Array of input jack definitions
 *   - outputs: Array of output jack definitions
 *   - leds: Array of LED identifiers
 */

import { SAMPLE_RATE, BUFFER } from './constants.js';
import { create2hpLFO } from '../dsp/lfo.js';
import { create2hpVCO } from '../dsp/vco.js';
import { create2hpDualVCA } from '../dsp/vca.js';
import { createSimpleQuantizer, SCALE_NAMES } from '../dsp/simple-quantizer.js';
import { createArp, CHORD_NAMES, ARP_MODE_NAMES } from '../dsp/arp.js';
import { createVCF } from '../dsp/vcf.js';
import { createADSR } from '../dsp/adsr.js';
import { createNoiseSH } from '../dsp/noise.js';
import { createClockDiv } from '../dsp/clock.js';
import { create2hpOut } from '../dsp/output.js';

/**
 * Create module definitions with factory functions
 * @param {AudioContext} audioCtx - Web Audio context for output module
 * @returns {Object} Module definitions object
 */
export function createModuleDefs(audioCtx = null) {
    return {
        lfo: {
            name: 'LFO',
            hp: 4,
            color: '#2d5a27',
            create: () => create2hpLFO({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'rateKnob', label: 'Rate', param: 'rateKnob', min: 0, max: 1, default: 0.3 },
                { id: 'waveKnob', label: 'Wave', param: 'waveKnob', min: 0, max: 1, default: 0 }
            ],
            switches: [
                { id: 'range', label: 'Fast', param: 'range', default: 0 }
            ],
            inputs: [
                { id: 'rateCV', label: 'Rate', input: 'rateCV', type: 'cv' },
                { id: 'waveCV', label: 'Wave', input: 'waveCV', type: 'cv' },
                { id: 'reset', label: 'Reset', input: 'reset', type: 'trigger' }
            ],
            outputs: [
                { id: 'primary', label: 'Pri', output: 'primary', type: 'buffer' },
                { id: 'secondary', label: 'Sec', output: 'secondary', type: 'buffer' }
            ]
        },
        vco: {
            name: 'VCO',
            hp: 4,
            color: '#8b4513',
            create: () => create2hpVCO({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'coarse', label: 'Coarse', param: 'coarse', min: 0, max: 1, default: 0.4 },
                { id: 'fine', label: 'Fine', param: 'fine', min: -6, max: 6, default: 0 },
                { id: 'glide', label: 'Glide', param: 'glide', min: 0, max: 100, default: 5 }
            ],
            inputs: [
                { id: 'vOct', label: 'V/Oct', input: 'vOct', type: 'cv' },
                { id: 'fm', label: 'FM', input: 'fm', type: 'cv' },
                { id: 'pwm', label: 'PWM', input: 'pwm', type: 'cv' },
                { id: 'sync', label: 'Sync', input: 'sync', type: 'trigger' }
            ],
            outputs: [
                { id: 'triangle', label: 'Tri', output: 'triangle', type: 'buffer' },
                { id: 'ramp', label: 'Saw', output: 'ramp', type: 'buffer' },
                { id: 'pulse', label: 'Pls', output: 'pulse', type: 'buffer' }
            ]
        },
        vca: {
            name: 'VCA',
            hp: 4,
            color: '#4a4a8a',
            create: () => create2hpDualVCA({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'ch1Gain', label: 'Ch1', param: 'ch1Gain', min: 0, max: 1, default: 0.8 },
                { id: 'ch2Gain', label: 'Ch2', param: 'ch2Gain', min: 0, max: 1, default: 0.8 }
            ],
            inputs: [
                { id: 'ch1In', label: 'In 1', input: 'ch1In', type: 'buffer' },
                { id: 'ch2In', label: 'In 2', input: 'ch2In', type: 'buffer' },
                { id: 'ch2CV', label: 'CV', input: 'ch2CV', type: 'cv' }
            ],
            outputs: [
                { id: 'ch1Out', label: 'Out1', output: 'ch1Out', type: 'buffer' },
                { id: 'ch2Out', label: 'Out2', output: 'ch2Out', type: 'buffer' }
            ],
            leds: ['ch1', 'ch2']
        },
        quant: {
            name: 'QUANT',
            hp: 4,
            color: '#6b3a6b',
            create: () => createSimpleQuantizer({ bufferSize: BUFFER, sampleRate: SAMPLE_RATE }),
            knobs: [
                { id: 'scale', label: 'Scale', param: 'scale', min: 0, max: SCALE_NAMES.length - 1, default: 1, step: 1 },
                { id: 'octave', label: 'Oct', param: 'octave', min: -2, max: 2, default: 0, step: 1 },
                { id: 'semitone', label: 'Semi', param: 'semitone', min: 0, max: 11, default: 0, step: 1 }
            ],
            switches: [],
            inputs: [
                { id: 'cv', label: 'In', input: 'cv', type: 'buffer' }
            ],
            outputs: [
                { id: 'cv', label: 'Out', output: 'cv', type: 'buffer' },
                { id: 'trigger', label: 'Trig', output: 'trigger', type: 'buffer' }
            ],
            leds: ['active']
        },
        arp: {
            name: 'ARP',
            hp: 4,
            color: '#3a6b5a',
            create: () => createArp({ bufferSize: BUFFER, sampleRate: SAMPLE_RATE }),
            knobs: [
                { id: 'root', label: 'Root', param: 'root', min: 0, max: 11, default: 0, step: 1 },
                { id: 'chord', label: 'Chord', param: 'chord', min: 0, max: CHORD_NAMES.length - 1, default: 1, step: 1 },
                { id: 'mode', label: 'Mode', param: 'mode', min: 0, max: ARP_MODE_NAMES.length - 1, default: 0, step: 1 }
            ],
            switches: [
                { id: 'octaves', label: 'Oct', param: 'octaves', positions: [1, 2, 3, 4], default: 1 }
            ],
            inputs: [
                { id: 'trigger', label: 'Trig', input: 'trigger', type: 'cv' },
                { id: 'reset', label: 'Rst', input: 'reset', type: 'trigger' },
                { id: 'rootCV', label: 'Root', input: 'rootCV', type: 'cv' },
                { id: 'chordCV', label: 'Chrd', input: 'chordCV', type: 'cv' }
            ],
            outputs: [
                { id: 'cv', label: 'V/Oct', output: 'cv', type: 'buffer' }
            ],
            leds: ['step']
        },
        vcf: {
            name: 'VCF',
            hp: 4,
            color: '#4a6a8a',
            create: () => createVCF({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'cutoff', label: 'Freq', param: 'cutoff', min: 0, max: 1, default: 0.5 },
                { id: 'resonance', label: 'Res', param: 'resonance', min: 0, max: 1, default: 0.3 }
            ],
            inputs: [
                { id: 'audio', label: 'In', input: 'audio', type: 'buffer' },
                { id: 'cutoffCV', label: 'Freq', input: 'cutoffCV', type: 'cv' },
                { id: 'resCV', label: 'Res', input: 'resCV', type: 'cv' }
            ],
            outputs: [
                { id: 'lpf', label: 'LP', output: 'lpf', type: 'buffer' },
                { id: 'bpf', label: 'BP', output: 'bpf', type: 'buffer' },
                { id: 'hpf', label: 'HP', output: 'hpf', type: 'buffer' }
            ],
            leds: ['cutoff']
        },
        adsr: {
            name: 'ADSR',
            hp: 4,
            color: '#8a4a4a',
            create: () => createADSR({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'attack', label: 'Atk', param: 'attack', min: 0, max: 1, default: 0.2 },
                { id: 'decay', label: 'Dec', param: 'decay', min: 0, max: 1, default: 0.3 },
                { id: 'sustain', label: 'Sus', param: 'sustain', min: 0, max: 1, default: 0.7 },
                { id: 'release', label: 'Rel', param: 'release', min: 0, max: 1, default: 0.4 }
            ],
            inputs: [
                { id: 'gate', label: 'Gate', input: 'gate', type: 'cv' },
                { id: 'retrig', label: 'Retr', input: 'retrig', type: 'trigger' }
            ],
            outputs: [
                { id: 'env', label: 'Env', output: 'env', type: 'buffer' },
                { id: 'inv', label: 'Inv', output: 'inv', type: 'buffer' },
                { id: 'eoc', label: 'EOC', output: 'eoc', type: 'buffer' }
            ],
            leds: ['env']
        },
        noise: {
            name: 'NOISE',
            hp: 4,
            color: '#5a5a5a',
            create: () => createNoiseSH({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.3 },
                { id: 'slew', label: 'Slew', param: 'slew', min: 0, max: 1, default: 0 }
            ],
            inputs: [
                { id: 'sample', label: 'Samp', input: 'sample', type: 'buffer' },
                { id: 'trigger', label: 'Trig', input: 'trigger', type: 'cv' }
            ],
            outputs: [
                { id: 'white', label: 'Wht', output: 'white', type: 'buffer' },
                { id: 'pink', label: 'Pink', output: 'pink', type: 'buffer' },
                { id: 'sh', label: 'S&H', output: 'sh', type: 'buffer' }
            ],
            leds: ['sh']
        },
        clock: {
            name: 'CLOCK',
            hp: 4,
            color: '#6a5a2a',
            create: () => createClockDiv({ sampleRate: SAMPLE_RATE, bufferSize: BUFFER }),
            knobs: [
                { id: 'bpm', label: 'BPM', param: 'bpm', min: 0, max: 1, default: 0.4 },
                { id: 'swing', label: 'Swng', param: 'swing', min: 0, max: 1, default: 0 }
            ],
            inputs: [
                { id: 'extClock', label: 'Ext', input: 'extClock', type: 'cv' },
                { id: 'reset', label: 'Rst', input: 'reset', type: 'trigger' }
            ],
            outputs: [
                { id: 'clock', label: 'Clk', output: 'clock', type: 'buffer' },
                { id: 'div2', label: '/2', output: 'div2', type: 'buffer' },
                { id: 'div4', label: '/4', output: 'div4', type: 'buffer' },
                { id: 'div8', label: '/8', output: 'div8', type: 'buffer' }
            ],
            leds: ['clock']
        },
        out: {
            name: 'OUT',
            hp: 4,
            color: '#333',
            create: (ctx) => create2hpOut(ctx || audioCtx, { bufferSize: BUFFER }),
            knobs: [
                { id: 'volume', label: 'Vol', param: 'volume', min: 0, max: 1, default: 0.7 }
            ],
            inputs: [
                { id: 'L', label: 'L', input: 'L', type: 'buffer' },
                { id: 'R', label: 'R', input: 'R', type: 'buffer' }
            ],
            outputs: [],
            leds: ['L', 'R']
        }
    };
}

/** Default module processing order */
export const MODULE_ORDER = ['clock', 'lfo', 'noise', 'quant', 'arp', 'vco', 'vcf', 'adsr', 'vca', 'out'];
