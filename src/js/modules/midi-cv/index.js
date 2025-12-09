/**
 * MIDI-CV - Monophonic MIDI to CV Converter
 *
 * Converts MIDI note messages to CV/Gate signals.
 * Inspired by Mutable Instruments Yarns monophonic mode.
 *
 * Outputs:
 * - Pitch CV: 1V/octave (0V = C4/MIDI note 60)
 * - Gate: 0V/10V
 * - Velocity: 0-10V
 * - Mod: 0-10V (mod wheel CC1)
 *
 * Features:
 * - Channel selection (1-16)
 * - Transpose (-24 to +24 semitones)
 * - Pitch bend support (±2 semitones default)
 * - Legato mode (gate stays high for overlapping notes)
 * - Note priority: Last note wins
 */

export default {
    id: 'midi-cv',
    name: 'MIDI-CV',
    hp: 4,
    color: '#5a4a8a',
    category: 'midi',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const pitchOut = new Float32Array(bufferSize);
        const gateOut = new Float32Array(bufferSize);
        const velocityOut = new Float32Array(bufferSize);
        const modOut = new Float32Array(bufferSize);

        // Note state
        let currentNote = -1;      // -1 = no note held
        let currentVelocity = 0;
        let heldNotes = [];        // Stack of held notes for note priority

        // Gate state for trigger generation
        let gateHigh = false;
        let retriggerSamples = 0;
        const retriggerLength = Math.floor(0.005 * sampleRate); // 5ms retrigger

        return {
            params: {
                channel: 0,        // MIDI channel 0-15 (display as 1-16)
                transpose: 0,      // -24 to +24 semitones
                bendRange: 2,      // Pitch bend range in semitones
                legato: 0          // 0 = retrigger, 1 = legato
            },

            inputs: {},

            outputs: {
                pitch: pitchOut,
                gate: gateOut,
                velocity: velocityOut,
                mod: modOut
            },

            leds: {
                gate: 0
            },

            // Reference to MIDI manager (set by rack)
            midiManager: null,

            process() {
                const channel = Math.floor(this.params.channel);
                const transpose = Math.floor(this.params.transpose);
                const bendRange = this.params.bendRange;
                const legato = this.params.legato > 0.5;

                // Get MIDI manager from global (set by rack initialization)
                const midi = this.midiManager || window.midiManager;
                if (!midi) {
                    // No MIDI available, output silence
                    pitchOut.fill(0);
                    gateOut.fill(0);
                    velocityOut.fill(0);
                    modOut.fill(0);
                    return;
                }

                // Process MIDI events
                const events = midi.consumeNoteEvents(channel);

                for (const event of events) {
                    if (event.type === 'noteOn') {
                        // Add to held notes stack
                        heldNotes.push({ note: event.note, velocity: event.velocity });

                        // Update current note (last note priority)
                        const wasPlaying = currentNote >= 0;
                        currentNote = event.note;
                        currentVelocity = event.velocity;

                        // Handle retriggering
                        if (!legato || !wasPlaying) {
                            retriggerSamples = retriggerLength;
                        }
                        gateHigh = true;
                    }
                    else if (event.type === 'noteOff') {
                        // Remove from held notes
                        const idx = heldNotes.findIndex(n => n.note === event.note);
                        if (idx >= 0) {
                            heldNotes.splice(idx, 1);
                        }

                        // If this was the current note, fall back to previous held note
                        if (event.note === currentNote) {
                            if (heldNotes.length > 0) {
                                const prev = heldNotes[heldNotes.length - 1];
                                currentNote = prev.note;
                                currentVelocity = prev.velocity;
                            } else {
                                currentNote = -1;
                                currentVelocity = 0;
                                gateHigh = false;
                            }
                        }
                    }
                }

                // Get pitch bend and mod wheel
                const pitchBend = midi.getPitchBend(channel);
                const modWheel = midi.getModWheel(channel);

                // Calculate CV values
                // Pitch: 1V/octave, 0V = C4 (MIDI note 60)
                const noteWithTranspose = currentNote >= 0 ? currentNote + transpose : 60;
                const bendSemitones = (pitchBend / 8192) * bendRange;
                const pitchCV = (noteWithTranspose - 60 + bendSemitones) / 12;

                // Velocity: 0-10V
                const velocityCV = (currentVelocity / 127) * 10;

                // Mod wheel: 0-10V
                const modCV = (modWheel / 127) * 10;

                // Fill output buffers
                for (let i = 0; i < bufferSize; i++) {
                    pitchOut[i] = currentNote >= 0 ? pitchCV : 0;

                    // Gate with retrigger gap
                    if (retriggerSamples > 0) {
                        gateOut[i] = 0;
                        retriggerSamples--;
                    } else {
                        gateOut[i] = gateHigh ? 10 : 0;
                    }

                    velocityOut[i] = velocityCV;
                    modOut[i] = modCV;
                }

                // LED follows gate
                this.leds.gate = gateHigh ? 1 : 0;
            },

            reset() {
                currentNote = -1;
                currentVelocity = 0;
                heldNotes = [];
                gateHigh = false;
                retriggerSamples = 0;
                pitchOut.fill(0);
                gateOut.fill(0);
                velocityOut.fill(0);
                modOut.fill(0);
            }
        };
    },

    ui: {
        leds: ['gate'],
        knobs: [
            { id: 'channel', label: 'Chan', param: 'channel', min: 0, max: 15, default: 0, step: 1 },
            { id: 'transpose', label: 'Trans', param: 'transpose', min: -24, max: 24, default: 0, step: 1 },
            { id: 'bendRange', label: 'Bend', param: 'bendRange', min: 0, max: 12, default: 2, step: 1 }
        ],
        switches: [
            { id: 'legato', label: 'Legato', param: 'legato', default: 0 }
        ],
        inputs: [],
        outputs: [
            { id: 'pitch', label: 'Pitch', port: 'pitch', type: 'cv' },
            { id: 'gate', label: 'Gate', port: 'gate', type: 'gate' },
            { id: 'velocity', label: 'Vel', port: 'velocity', type: 'cv' },
            { id: 'mod', label: 'Mod', port: 'mod', type: 'cv' }
        ]
    }
};
