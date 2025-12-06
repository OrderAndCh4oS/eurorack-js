/**
 * Chord definitions for the Arpeggiator module
 * Matches 2hp Arp: 13 chord types from Major to Sus4 Min7
 */

export const CHORDS = {
    major:    [0, 4, 7],
    maj7:     [0, 4, 7, 11],
    dom7:     [0, 4, 7, 10],
    minor:    [0, 3, 7],
    min7:     [0, 3, 7, 10],
    dim:      [0, 3, 6],
    halfDim7: [0, 3, 6, 10],
    fullDim7: [0, 3, 6, 9],
    aug:      [0, 4, 8],
    aug7:     [0, 4, 8, 10],
    sus4:     [0, 5, 7],
    sus4Maj7: [0, 5, 7, 11],
    sus4Min7: [0, 5, 7, 10]
};

export const CHORD_NAMES = Object.keys(CHORDS);

export const ARP_MODES = {
    up: 'up',
    down: 'down',
    upDown: 'upDown',
    random: 'random'
};

export const ARP_MODE_NAMES = Object.keys(ARP_MODES);

/**
 * Build the full arpeggio note sequence for given chord and octave range
 */
export function buildArpSequence(chord, octaves, mode) {
    const notes = [];
    for (let oct = 0; oct < octaves; oct++) {
        for (const interval of chord) {
            notes.push(interval + (oct * 12));
        }
    }

    switch (mode) {
        case 'down':
            return notes.slice().reverse();

        case 'upDown':
            if (notes.length <= 1) return notes;
            const up = notes.slice();
            const down = notes.slice(1, -1).reverse();
            return [...up, ...down];

        case 'random':
            return notes;

        case 'up':
        default:
            return notes;
    }
}
