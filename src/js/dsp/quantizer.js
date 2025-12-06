/**
 * Simple Quantizer - Based on Ladik Q-010 Easy Quantizer
 *
 * A straightforward CV quantizer with 16 preset scales.
 * Quantizes incoming CV to the nearest note in the selected scale.
 *
 * Features:
 * - 16 preset scales (chromatic, major, minor, pentatonic, etc.)
 * - Octave transpose (±2 octaves)
 * - Semitone transpose (0-11 semitones)
 * - 1V/Oct input and output
 *
 * @module dsp/simple-quantizer
 */

/**
 * Scale definitions - each array contains semitone offsets from root (0-11)
 * Based on common musical scales
 */
export const SCALES = {
    chromatic:    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major:        [0, 2, 4, 5, 7, 9, 11],
    minor:        [0, 2, 3, 5, 7, 8, 10],
    harmonicMin:  [0, 2, 3, 5, 7, 8, 11],
    melodicMin:   [0, 2, 3, 5, 7, 9, 11],
    dorian:       [0, 2, 3, 5, 7, 9, 10],
    phrygian:     [0, 1, 3, 5, 7, 8, 10],
    lydian:       [0, 2, 4, 6, 7, 9, 11],
    mixolydian:   [0, 2, 4, 5, 7, 9, 10],
    locrian:      [0, 1, 3, 5, 6, 8, 10],
    pentatonicMaj:[0, 2, 4, 7, 9],
    pentatonicMin:[0, 3, 5, 7, 10],
    blues:        [0, 3, 5, 6, 7, 10],
    wholetone:    [0, 2, 4, 6, 8, 10],
    diminished:   [0, 2, 3, 5, 6, 8, 9, 11],
    augmented:    [0, 3, 4, 7, 8, 11]
};

export const SCALE_NAMES = Object.keys(SCALES);

/**
 * Quantize a voltage to the nearest note in a scale
 *
 * @param {number} voltage - Input voltage (1V/Oct, 0V = C0)
 * @param {number[]} scale - Array of semitone offsets in the scale
 * @param {number} octaveOffset - Octave transpose (-2 to +2)
 * @param {number} semitoneOffset - Semitone transpose (0-11)
 * @returns {number} Quantized voltage
 */
export function quantizeVoltage(voltage, scale, octaveOffset = 0, semitoneOffset = 0) {
    // Convert voltage to semitones (1V = 12 semitones)
    const semitones = voltage * 12;

    // Get octave and note within octave
    const octave = Math.floor(semitones / 12);
    const noteInOctave = semitones - (octave * 12);

    // Find nearest note in scale
    let nearestNote = scale[0];
    let minDistance = Math.abs(noteInOctave - scale[0]);

    for (const scaleNote of scale) {
        const distance = Math.abs(noteInOctave - scaleNote);
        if (distance < minDistance) {
            minDistance = distance;
            nearestNote = scaleNote;
        }
        // Also check wrapping to next octave
        const wrapDistance = Math.abs(noteInOctave - (scaleNote - 12));
        if (wrapDistance < minDistance) {
            minDistance = wrapDistance;
            nearestNote = scaleNote - 12;
        }
    }

    // Apply transposition
    const quantizedSemitones = (octave * 12) + nearestNote + semitoneOffset + (octaveOffset * 12);

    // Convert back to voltage
    return quantizedSemitones / 12;
}

/**
 * Create a Simple Quantizer instance
 *
 * @param {Object} options - Configuration options
 * @param {number} options.bufferSize - Audio buffer size (default 128)
 * @param {number} options.sampleRate - Sample rate (default 48000)
 * @returns {Object} Quantizer instance
 */
export function createQuantizer({ bufferSize = 128, sampleRate = 48000 } = {}) {
    // Output buffer
    const output = new Float32Array(bufferSize);

    // Track last quantized value for trigger detection
    let lastQuantized = 0;

    // Trigger output buffer
    const triggerOut = new Float32Array(bufferSize);

    return {
        params: {
            scale: 0,           // Scale index (0-15)
            octave: 0,          // Octave transpose (-2 to +2)
            semitone: 0         // Semitone transpose (0-11)
        },

        inputs: {
            cv: new Float32Array(bufferSize)  // CV input buffer
        },

        outputs: {
            cv: output,         // Quantized CV output
            trigger: triggerOut // Trigger on note change
        },

        leds: {
            active: 0           // Lights when note changes
        },

        /**
         * Process a buffer of samples
         */
        process() {
            const { scale, octave, semitone } = this.params;
            const scaleNotes = SCALES[SCALE_NAMES[Math.floor(scale) % SCALE_NAMES.length]];
            const cvIn = this.inputs.cv;

            let noteChanged = false;

            for (let i = 0; i < bufferSize; i++) {
                // Get input voltage
                const inputVoltage = cvIn[i];

                // Quantize
                const quantized = quantizeVoltage(inputVoltage, scaleNotes, octave, semitone);
                output[i] = quantized;

                // Detect note change for trigger
                if (Math.abs(quantized - lastQuantized) > 0.001) {
                    triggerOut[i] = 5; // 5V trigger
                    lastQuantized = quantized;
                    noteChanged = true;
                } else {
                    triggerOut[i] = 0;
                }
            }

            // Update LED
            this.leds.active = noteChanged ? 1 : Math.max(0, this.leds.active - 0.1);
        }
    };
}
