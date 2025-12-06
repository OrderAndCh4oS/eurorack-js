/**
 * QUANT - Simple Quantizer
 *
 * Based on Ladik Q-010 Easy Quantizer concept.
 * A straightforward CV quantizer with 16 preset scales.
 *
 * Features:
 * - 16 preset scales (chromatic, major, minor, pentatonic, etc.)
 * - Octave transpose (±2 octaves)
 * - Semitone transpose (0-11 semitones)
 * - 1V/Oct input and output
 * - Trigger output on note change
 */

import { SCALES, SCALE_NAMES, quantizeVoltage } from './scales.js';

// Re-export for external use
export { SCALES, SCALE_NAMES, quantizeVoltage };

export default {
    id: 'quant',
    name: 'QUANT',
    hp: 4,
    color: '#6b3a6b',
    category: 'utility',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const output = new Float32Array(bufferSize);
        const triggerOut = new Float32Array(bufferSize);
        let lastQuantized = 0;

        return {
            params: {
                scale: 0,
                octave: 0,
                semitone: 0
            },

            inputs: {
                cv: new Float32Array(bufferSize)
            },

            outputs: {
                cv: output,
                trigger: triggerOut
            },

            leds: {
                active: 0
            },

            process() {
                const { scale, octave, semitone } = this.params;
                const scaleNotes = SCALES[SCALE_NAMES[Math.floor(scale) % SCALE_NAMES.length]];
                const cvIn = this.inputs.cv;

                let noteChanged = false;

                for (let i = 0; i < bufferSize; i++) {
                    const inputVoltage = cvIn[i];
                    const quantized = quantizeVoltage(inputVoltage, scaleNotes, octave, semitone);
                    output[i] = quantized;

                    if (Math.abs(quantized - lastQuantized) > 0.001) {
                        triggerOut[i] = 5;
                        lastQuantized = quantized;
                        noteChanged = true;
                    } else {
                        triggerOut[i] = 0;
                    }
                }

                this.leds.active = noteChanged ? 1 : Math.max(0, this.leds.active - 0.1);
            },

            reset() {
                lastQuantized = 0;
                output.fill(0);
                triggerOut.fill(0);
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'scale', label: 'Scale', param: 'scale', min: 0, max: SCALE_NAMES.length - 1, default: 1, step: 1 },
            { id: 'octave', label: 'Oct', param: 'octave', min: -2, max: 2, default: 0, step: 1 },
            { id: 'semitone', label: 'Semi', param: 'semitone', min: 0, max: 11, default: 0, step: 1 }
        ],
        inputs: [
            { id: 'cv', label: 'In', port: 'cv', type: 'cv' }
        ],
        outputs: [
            { id: 'cv', label: 'Out', port: 'cv', type: 'cv' },
            { id: 'trigger', label: 'Trig', port: 'trigger', type: 'trigger' }
        ]
    }
};
