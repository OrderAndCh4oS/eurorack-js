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
import { clamp } from '../../utils/math.js';

// Re-export for external use
export { SCALES, SCALE_NAMES, quantizeVoltage };

export default {
    id: 'quant',
    name: 'QUANT',
    hp: 4,
    color: 'module-color-nine',
    category: 'quantizer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const cvInput = new Float32Array(bufferSize);
        const output = new Float32Array(bufferSize);
        const triggerOut = new Float32Array(bufferSize);
        let lastQuantized = 0;
        let triggerSamplesRemaining = 0;
        const triggerSamples = Math.max(1, Math.round(sampleRate * 0.008));
        const ledDecay = Math.exp(-bufferSize / (sampleRate * 0.1));

        return {
            params: {
                scale: 1,
                octave: 0,
                semitone: 0
            },

            inputs: {
                cv: cvInput
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
                const scaleIndex = Number.isFinite(scale)
                    ? clamp(Math.round(scale), 0, SCALE_NAMES.length - 1)
                    : 1;
                const octaveOffset = Number.isFinite(octave)
                    ? clamp(Math.round(octave), -2, 2)
                    : 0;
                const semitoneOffset = Number.isFinite(semitone)
                    ? clamp(Math.round(semitone), 0, 11)
                    : 0;
                const scaleNotes = SCALES[SCALE_NAMES[scaleIndex]];

                let noteChanged = false;

                for (let i = 0; i < bufferSize; i++) {
                    const inputVoltage = Number.isFinite(cvInput[i])
                        ? clamp(cvInput[i], -5, 5)
                        : 0;
                    const quantized = quantizeVoltage(
                        inputVoltage,
                        scaleNotes,
                        octaveOffset,
                        semitoneOffset
                    );
                    output[i] = quantized;

                    if (Math.abs(quantized - lastQuantized) > 0.001) {
                        lastQuantized = quantized;
                        triggerSamplesRemaining = triggerSamples;
                        noteChanged = true;
                    }
                    triggerOut[i] = triggerSamplesRemaining > 0 ? 5 : 0;
                    if (triggerSamplesRemaining > 0) triggerSamplesRemaining--;
                }

                this.leds.active = noteChanged ? 1 : this.leds.active * ledDecay;
            },

            reset() {
                lastQuantized = 0;
                triggerSamplesRemaining = 0;
                cvInput.fill(0);
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
            { id: 'cv', label: 'In', port: 'cv', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'cv', label: 'Out', port: 'cv', signal: 'cv', voltage: { min: -7, max: 95 / 12 } },
            { id: 'trigger', label: 'Trig', port: 'trigger', signal: 'trigger', voltage: { min: 0, max: 5 } }
        ]
    }
};
