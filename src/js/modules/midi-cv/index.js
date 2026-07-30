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
    color: 'module-color-eleven',
    category: 'midi',

    createDSP({ sampleRate = 44100, bufferSize = 512, services = {} } = {}) {
        const midi = services.midiManager || null;
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

            process() {
                const channel = Number.isFinite(this.params.channel)
                    ? Math.max(0, Math.min(15, Math.floor(this.params.channel)))
                    : 0;
                const transpose = Number.isFinite(this.params.transpose)
                    ? Math.max(-24, Math.min(24, Math.floor(this.params.transpose)))
                    : 0;
                const bendRange = Number.isFinite(this.params.bendRange)
                    ? Math.max(0, Math.min(12, this.params.bendRange))
                    : 2;
                const legato = this.params.legato > 0.5;

                if (!midi) {
                    // No MIDI available, output silence
                    pitchOut.fill(0);
                    gateOut.fill(0);
                    velocityOut.fill(0);
                    modOut.fill(0);
                    return;
                }

                // Process MIDI events
                const events = midi.getNoteEvents(channel);
                let eventIndex = 0;

                // Get pitch bend and mod wheel
                const rawPitchBend = midi.getPitchBend(channel);
                const rawModWheel = midi.getModWheel(channel);
                const pitchBend = Number.isFinite(rawPitchBend)
                    ? Math.max(-8192, Math.min(8192, rawPitchBend))
                    : 0;
                const modWheel = Number.isFinite(rawModWheel)
                    ? Math.max(0, Math.min(127, rawModWheel))
                    : 0;

                const bendSemitones = (pitchBend / 8192) * bendRange;
                const modCV = (modWheel / 127) * 10;

                for (let i = 0; i < bufferSize; i++) {
                    while (eventIndex < events.length && events[eventIndex].sampleOffset <= i) {
                        const event = events[eventIndex++];
                        if (event.type === 'noteOn') {
                            const note = Number.isFinite(event.note)
                                ? Math.max(0, Math.min(127, Math.floor(event.note)))
                                : 60;
                            const velocity = Number.isFinite(event.velocity)
                                ? Math.max(0, Math.min(127, event.velocity))
                                : 0;
                            heldNotes.push({ note, velocity });
                            const wasPlaying = currentNote >= 0;
                            currentNote = note;
                            currentVelocity = velocity;
                            if (!legato || !wasPlaying) retriggerSamples = retriggerLength;
                            gateHigh = true;
                        } else if (event.type === 'noteOff') {
                            const index = heldNotes.findIndex(note => note.note === event.note);
                            if (index >= 0) heldNotes.splice(index, 1);
                            if (event.note === currentNote) {
                                const previous = heldNotes[heldNotes.length - 1];
                                currentNote = previous?.note ?? -1;
                                currentVelocity = previous?.velocity ?? 0;
                                gateHigh = Boolean(previous);
                            }
                        }
                    }

                    const noteWithTranspose = currentNote >= 0 ? currentNote + transpose : 60;
                    const pitchCV = (noteWithTranspose - 60 + bendSemitones) / 12;
                    pitchOut[i] = currentNote >= 0 ? pitchCV : 0;

                    // Gate with retrigger gap
                    if (retriggerSamples > 0) {
                        gateOut[i] = 0;
                        retriggerSamples--;
                    } else {
                        gateOut[i] = gateHigh ? 10 : 0;
                    }

                    velocityOut[i] = (currentVelocity / 127) * 10;
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
                this.leds.gate = 0;
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
            { id: 'pitch', label: 'Pitch', port: 'pitch', signal: 'cv', voltage: { min: -8, max: 103 / 12 } },
            { id: 'gate', label: 'Gate', port: 'gate', signal: 'gate' },
            { id: 'velocity', label: 'Vel', port: 'velocity', signal: 'cv', voltage: { min: 0, max: 10 } },
            { id: 'mod', label: 'Mod', port: 'mod', signal: 'cv', voltage: { min: 0, max: 10 } }
        ]
    }
};
