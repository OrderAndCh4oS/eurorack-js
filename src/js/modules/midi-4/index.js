/**
 * MIDI-4 - 4-Voice Polyphonic MIDI to CV Converter
 *
 * Converts MIDI note messages to 4 voices of CV/Gate.
 * Inspired by Mutable Instruments Yarns 4-voice polyphonic mode.
 *
 * Outputs (per voice):
 * - Pitch CV 1-4: 1V/octave (0V = C4/MIDI note 60)
 * - Gate 1-4: 0V/10V
 *
 * Features:
 * - Channel selection (1-16)
 * - Voice allocation modes: Rotate, Lowest, Reassign
 * - Transpose (-24 to +24 semitones)
 * - Pitch bend support (affects all voices)
 */

export default {
    id: 'midi-4',
    name: 'MIDI-4',
    hp: 6,
    color: '#5a4a8a',
    category: 'midi',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Output buffers for 4 voices
        const pitch1 = new Float32Array(bufferSize);
        const pitch2 = new Float32Array(bufferSize);
        const pitch3 = new Float32Array(bufferSize);
        const pitch4 = new Float32Array(bufferSize);
        const gate1 = new Float32Array(bufferSize);
        const gate2 = new Float32Array(bufferSize);
        const gate3 = new Float32Array(bufferSize);
        const gate4 = new Float32Array(bufferSize);

        // Voice state
        const voices = [
            { note: -1, velocity: 0, age: 0 },
            { note: -1, velocity: 0, age: 0 },
            { note: -1, velocity: 0, age: 0 },
            { note: -1, velocity: 0, age: 0 }
        ];

        let nextVoice = 0;  // For rotate mode
        let ageCounter = 0; // For tracking voice age

        // Retrigger state per voice
        const retriggerSamples = [0, 0, 0, 0];
        const retriggerLength = Math.floor(0.003 * sampleRate); // 3ms retrigger

        /**
         * Find voice to allocate for new note
         * @param {number} mode - 0: rotate, 1: lowest, 2: reassign (steal oldest)
         * @returns {number} Voice index 0-3
         */
        function findVoice(mode) {
            // First, try to find a free voice
            for (let i = 0; i < 4; i++) {
                if (voices[i].note < 0) {
                    return i;
                }
            }

            // No free voice, use allocation strategy
            switch (mode) {
                case 0: // Rotate
                    const v = nextVoice;
                    nextVoice = (nextVoice + 1) % 4;
                    return v;

                case 1: // Lowest numbered available
                    return 0;

                case 2: // Reassign (steal oldest)
                    let oldest = 0;
                    let maxAge = voices[0].age;
                    for (let i = 1; i < 4; i++) {
                        if (voices[i].age > maxAge) {
                            maxAge = voices[i].age;
                            oldest = i;
                        }
                    }
                    return oldest;

                default:
                    return 0;
            }
        }

        /**
         * Find voice playing a specific note
         * @param {number} note - MIDI note number
         * @returns {number} Voice index or -1 if not found
         */
        function findVoiceWithNote(note) {
            for (let i = 0; i < 4; i++) {
                if (voices[i].note === note) {
                    return i;
                }
            }
            return -1;
        }

        return {
            params: {
                channel: 0,        // MIDI channel 0-15
                transpose: 0,      // -24 to +24 semitones
                bendRange: 2,      // Pitch bend range in semitones
                mode: 0            // 0: rotate, 1: lowest, 2: reassign
            },

            inputs: {},

            outputs: {
                pitch1, pitch2, pitch3, pitch4,
                gate1, gate2, gate3, gate4
            },

            leds: {
                v1: 0, v2: 0, v3: 0, v4: 0
            },

            midiManager: null,

            process() {
                const channel = Math.floor(this.params.channel);
                const transpose = Math.floor(this.params.transpose);
                const bendRange = this.params.bendRange;
                const mode = Math.floor(this.params.mode);

                const midi = this.midiManager || window.midiManager;
                if (!midi) {
                    pitch1.fill(0); pitch2.fill(0); pitch3.fill(0); pitch4.fill(0);
                    gate1.fill(0); gate2.fill(0); gate3.fill(0); gate4.fill(0);
                    return;
                }

                // Process MIDI events
                const events = midi.consumeNoteEvents(channel);

                for (const event of events) {
                    if (event.type === 'noteOn') {
                        // Check if note is already playing (retrigger it)
                        let voiceIdx = findVoiceWithNote(event.note);

                        if (voiceIdx < 0) {
                            // Allocate new voice
                            voiceIdx = findVoice(mode);
                        }

                        voices[voiceIdx].note = event.note;
                        voices[voiceIdx].velocity = event.velocity;
                        voices[voiceIdx].age = ageCounter++;
                        retriggerSamples[voiceIdx] = retriggerLength;
                    }
                    else if (event.type === 'noteOff') {
                        const voiceIdx = findVoiceWithNote(event.note);
                        if (voiceIdx >= 0) {
                            voices[voiceIdx].note = -1;
                            voices[voiceIdx].velocity = 0;
                        }
                    }
                }

                // Get pitch bend
                const pitchBend = midi.getPitchBend(channel);
                const bendSemitones = (pitchBend / 8192) * bendRange;

                // Calculate CV outputs
                const pitchOuts = [pitch1, pitch2, pitch3, pitch4];
                const gateOuts = [gate1, gate2, gate3, gate4];

                for (let v = 0; v < 4; v++) {
                    const voice = voices[v];
                    const noteWithTranspose = voice.note >= 0 ? voice.note + transpose : 60;
                    const pitchCV = (noteWithTranspose - 60 + bendSemitones) / 12;
                    const gateHigh = voice.note >= 0;

                    for (let i = 0; i < bufferSize; i++) {
                        pitchOuts[v][i] = voice.note >= 0 ? pitchCV : 0;

                        // Gate with retrigger gap
                        if (retriggerSamples[v] > 0) {
                            gateOuts[v][i] = 0;
                            retriggerSamples[v]--;
                        } else {
                            gateOuts[v][i] = gateHigh ? 10 : 0;
                        }
                    }

                    // Update LED
                    this.leds[`v${v + 1}`] = gateHigh ? 1 : 0;
                }
            },

            reset() {
                for (let v = 0; v < 4; v++) {
                    voices[v].note = -1;
                    voices[v].velocity = 0;
                    voices[v].age = 0;
                    retriggerSamples[v] = 0;
                }
                nextVoice = 0;
                ageCounter = 0;
                pitch1.fill(0); pitch2.fill(0); pitch3.fill(0); pitch4.fill(0);
                gate1.fill(0); gate2.fill(0); gate3.fill(0); gate4.fill(0);
            }
        };
    },

    ui: {
        leds: ['v1', 'v2', 'v3', 'v4'],
        knobs: [
            { id: 'channel', label: 'Chan', param: 'channel', min: 0, max: 15, default: 0, step: 1 },
            { id: 'transpose', label: 'Trans', param: 'transpose', min: -24, max: 24, default: 0, step: 1 },
            { id: 'mode', label: 'Mode', param: 'mode', min: 0, max: 2, default: 0, step: 1 }
        ],
        switches: [],
        inputs: [],
        outputs: [
            { id: 'pitch1', label: 'P1', port: 'pitch1', type: 'cv' },
            { id: 'gate1', label: 'G1', port: 'gate1', type: 'gate' },
            { id: 'pitch2', label: 'P2', port: 'pitch2', type: 'cv' },
            { id: 'gate2', label: 'G2', port: 'gate2', type: 'gate' },
            { id: 'pitch3', label: 'P3', port: 'pitch3', type: 'cv' },
            { id: 'gate3', label: 'G3', port: 'gate3', type: 'gate' },
            { id: 'pitch4', label: 'P4', port: 'pitch4', type: 'cv' },
            { id: 'gate4', label: 'G4', port: 'gate4', type: 'gate' }
        ]
    }
};
