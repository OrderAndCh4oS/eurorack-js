/**
 * Arpeggiator - Based on 2hp Arp
 *
 * A gate-driven arpeggiator that cycles through chord notes.
 * Each trigger advances to the next note in the arpeggio pattern.
 *
 * Features:
 * - 8 chord types (single, maj, min, dim, aug, sus4, 7th, maj7)
 * - 4 arpeggio modes (up, down, up-down, random)
 * - 1-4 octave range
 * - Root note CV input
 * - Trigger input for advancing
 *
 * @module dsp/arp
 */

/**
 * Chord definitions - semitone intervals from root
 */
export const CHORDS = {
    single:   [0],                      // Just root
    major:    [0, 4, 7],                // Major triad
    minor:    [0, 3, 7],                // Minor triad
    dim:      [0, 3, 6],                // Diminished
    aug:      [0, 4, 8],                // Augmented
    sus4:     [0, 5, 7],                // Suspended 4th
    dom7:     [0, 4, 7, 10],            // Dominant 7th
    maj7:     [0, 4, 7, 11]             // Major 7th
};

export const CHORD_NAMES = Object.keys(CHORDS);

/**
 * Arpeggio mode patterns
 */
export const ARP_MODES = {
    up: 'up',
    down: 'down',
    upDown: 'upDown',
    random: 'random'
};

export const ARP_MODE_NAMES = Object.keys(ARP_MODES);

/**
 * Build the full arpeggio note sequence for given chord and octave range
 *
 * @param {number[]} chord - Chord intervals
 * @param {number} octaves - Number of octaves (1-4)
 * @param {string} mode - Arpeggio mode
 * @returns {number[]} Sequence of semitone offsets
 */
export function buildArpSequence(chord, octaves, mode) {
    // Build notes across all octaves
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
            // Up then down, excluding repeated top/bottom notes
            const up = notes.slice();
            const down = notes.slice(1, -1).reverse();
            return [...up, ...down];

        case 'random':
            // Return original - randomization happens at step time
            return notes;

        case 'up':
        default:
            return notes;
    }
}

/**
 * Create an Arpeggiator instance
 *
 * @param {Object} options - Configuration options
 * @param {number} options.bufferSize - Audio buffer size (default 128)
 * @param {number} options.sampleRate - Sample rate (default 48000)
 * @returns {Object} Arpeggiator instance
 */
export function createArp({ bufferSize = 128, sampleRate = 48000 } = {}) {
    // Output buffer
    const output = new Float32Array(bufferSize);

    // State
    let currentStep = 0;
    let lastTriggerState = false;
    let currentNote = 0;
    let sequence = [0];

    // Simple random for random mode
    const random = () => Math.random();

    return {
        params: {
            root: 0,            // Root note (0-11, C-B) - controlled by knob
            chord: 0,           // Chord type index (0-7)
            mode: 0,            // Arp mode index (0-3)
            octaves: 1          // Octave range (1-4)
        },

        inputs: {
            trigger: new Float32Array(bufferSize),  // Trigger input (advances arp)
            reset: new Float32Array(bufferSize),    // Reset input (returns to first note)
            rootCV: new Float32Array(bufferSize),   // Root note CV input
            chordCV: new Float32Array(bufferSize)   // Chord type CV input
        },

        outputs: {
            cv: output          // V/Oct output
        },

        leds: {
            step: 0             // Pulses on each step
        },

        /**
         * Process a buffer of samples
         */
        process() {
            let { root, chord, mode, octaves } = this.params;
            const trigIn = this.inputs.trigger;
            const resetIn = this.inputs.reset;
            const rootCV = this.inputs.rootCV;
            const chordCV = this.inputs.chordCV;

            // Get chord and mode
            const chordIndex = Math.floor(chord) % CHORD_NAMES.length;
            const chordIntervals = CHORDS[CHORD_NAMES[chordIndex]];
            const modeIndex = Math.floor(mode) % ARP_MODE_NAMES.length;
            const modeName = ARP_MODE_NAMES[modeIndex];

            // Clamp octaves
            octaves = Math.max(1, Math.min(4, Math.floor(octaves)));

            // Build sequence
            sequence = buildArpSequence(chordIntervals, octaves, modeName);

            let stepped = false;

            for (let i = 0; i < bufferSize; i++) {
                // Check for reset
                if (resetIn[i] > 2.5 && !lastTriggerState) {
                    currentStep = 0;
                }

                // Check for trigger (rising edge)
                const triggerActive = trigIn[i] > 2.5;

                if (triggerActive && !lastTriggerState) {
                    // Advance step
                    if (modeName === 'random') {
                        currentStep = Math.floor(random() * sequence.length);
                    } else {
                        currentStep = (currentStep + 1) % sequence.length;
                    }
                    stepped = true;
                }
                lastTriggerState = triggerActive;

                // Get current note from sequence
                const sequenceNote = sequence[currentStep % sequence.length] || 0;

                // Apply root (from knob + CV)
                let rootNote = root;
                if (rootCV[i]) {
                    // CV adds to root (1V = 12 semitones)
                    rootNote += rootCV[i] * 12;
                }

                // Calculate output voltage (1V/Oct)
                currentNote = (rootNote + sequenceNote) / 12;
                output[i] = currentNote;
            }

            // Update LED
            this.leds.step = stepped ? 1 : Math.max(0, this.leds.step - 0.15);
        },

        /**
         * Reset arpeggiator to first step
         */
        reset() {
            currentStep = 0;
        },

        /**
         * Get current step index (for UI display)
         */
        getCurrentStep() {
            return currentStep;
        }
    };
}
