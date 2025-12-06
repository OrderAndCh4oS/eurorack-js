/**
 * ARP - Arpeggiator
 *
 * Based on 2hp Arp specifications.
 * A gate-driven arpeggiator that cycles through chord notes.
 *
 * Features:
 * - 13 chord types (major, maj7, dom7, minor, min7, etc.)
 * - 4 arpeggio modes (up, down, up-down, random)
 * - 1-2 octave range
 * - Root note CV input (V/Oct tracking)
 * - Trigger input for advancing (0.4V threshold)
 * - Reset input
 */

import { CHORDS, CHORD_NAMES, ARP_MODE_NAMES, buildArpSequence } from './chords.js';

// Re-export for external use
export { CHORDS, CHORD_NAMES, ARP_MODE_NAMES, buildArpSequence };

export default {
    id: 'arp',
    name: 'ARP',
    hp: 4,
    color: '#3a6b5a',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const output = new Float32Array(bufferSize);

        let currentStep = 0;
        let lastTriggerState = false;
        let lastResetState = false;
        let currentNote = 0;
        let sequence = [0];

        const random = () => Math.random();

        return {
            params: {
                root: 0,
                chord: 0,
                mode: 0,
                octaves: 1
            },

            inputs: {
                trigger: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize),
                rootCV: new Float32Array(bufferSize),
                chordCV: new Float32Array(bufferSize)
            },

            outputs: {
                cv: output
            },

            leds: {
                step: 0
            },

            process() {
                let { root, chord, mode, octaves } = this.params;
                const trigIn = this.inputs.trigger;
                const resetIn = this.inputs.reset;
                const rootCV = this.inputs.rootCV;

                const chordIndex = Math.floor(chord) % CHORD_NAMES.length;
                const chordIntervals = CHORDS[CHORD_NAMES[chordIndex]];
                const modeIndex = Math.floor(mode) % ARP_MODE_NAMES.length;
                const modeName = ARP_MODE_NAMES[modeIndex];

                octaves = Math.max(1, Math.min(2, Math.floor(octaves)));
                sequence = buildArpSequence(chordIntervals, octaves, modeName);

                let stepped = false;

                for (let i = 0; i < bufferSize; i++) {
                    const resetActive = resetIn[i] > 0.4;
                    if (resetActive && !lastResetState) {
                        currentStep = 0;
                    }
                    lastResetState = resetActive;

                    const triggerActive = trigIn[i] > 0.4;

                    if (triggerActive && !lastTriggerState) {
                        if (modeName === 'random') {
                            currentStep = Math.floor(random() * sequence.length);
                        } else {
                            currentStep = (currentStep + 1) % sequence.length;
                        }
                        stepped = true;
                    }
                    lastTriggerState = triggerActive;

                    const sequenceNote = sequence[currentStep % sequence.length] || 0;

                    let rootNote = root;
                    if (rootCV[i]) {
                        rootNote += rootCV[i] * 12;
                    }

                    currentNote = (rootNote + sequenceNote) / 12;
                    output[i] = currentNote;
                }

                this.leds.step = stepped ? 1 : Math.max(0, this.leds.step - 0.15);
            },

            reset() {
                currentStep = 0;
                lastTriggerState = false;
                lastResetState = false;
                currentNote = 0;
                output.fill(0);
                this.leds.step = 0;
            },

            getCurrentStep() {
                return currentStep;
            }
        };
    },

    ui: {
        leds: ['step'],
        knobs: [
            { id: 'root', label: 'Root', param: 'root', min: 0, max: 11, default: 0, step: 1 },
            { id: 'chord', label: 'Chord', param: 'chord', min: 0, max: CHORD_NAMES.length - 1, default: 1, step: 1 },
            { id: 'mode', label: 'Mode', param: 'mode', min: 0, max: ARP_MODE_NAMES.length - 1, default: 0, step: 1 }
        ],
        switches: [
            { id: 'octaves', label: 'Oct', param: 'octaves', default: 1 }
        ],
        inputs: [
            { id: 'trigger', label: 'Trig', port: 'trigger', type: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', type: 'trigger' },
            { id: 'rootCV', label: 'Root', port: 'rootCV', type: 'cv' },
            { id: 'chordCV', label: 'Chrd', port: 'chordCV', type: 'cv' }
        ],
        outputs: [
            { id: 'cv', label: 'V/Oct', port: 'cv', type: 'cv' }
        ]
    }
};
