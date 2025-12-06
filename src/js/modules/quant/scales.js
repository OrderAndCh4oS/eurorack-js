/**
 * Scale definitions for the Quantizer module
 * Each array contains semitone offsets from root (0-11)
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
    const semitones = voltage * 12;
    const octave = Math.floor(semitones / 12);
    const noteInOctave = semitones - (octave * 12);

    let nearestNote = scale[0];
    let minDistance = Math.abs(noteInOctave - scale[0]);

    for (const scaleNote of scale) {
        const distance = Math.abs(noteInOctave - scaleNote);
        if (distance < minDistance) {
            minDistance = distance;
            nearestNote = scaleNote;
        }
        const wrapDistance = Math.abs(noteInOctave - (scaleNote - 12));
        if (wrapDistance < minDistance) {
            minDistance = wrapDistance;
            nearestNote = scaleNote - 12;
        }
    }

    const quantizedSemitones = (octave * 12) + nearestNote + semitoneOffset + (octaveOffset * 12);
    return quantizedSemitones / 12;
}
