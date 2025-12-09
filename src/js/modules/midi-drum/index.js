/**
 * MIDI-DRUM - MIDI Drum Pad to Trigger Converter
 *
 * Converts MIDI note messages to trigger outputs for drum modules.
 * Standard GM drum mapping with 8 trigger outputs:
 * - Pad 1: Kick (C1/36)
 * - Pad 2: Snare (D1/38)
 * - Pad 3: Closed Hat (F#1/42)
 * - Pad 4: Open Hat (A#1/46)
 * - Pad 5: Low Tom (F1/41)
 * - Pad 6: Mid Tom (B1/47)
 * - Pad 7: Clap (D#1/39)
 * - Pad 8: Ride (D#2/51)
 *
 * Features:
 * - Velocity output for dynamics
 * - Channel select
 * - Configurable note assignments
 */

import { clamp } from '../../utils/math.js';

// Default GM drum mapping
const DEFAULT_NOTES = [36, 38, 42, 46, 41, 47, 39, 51];
const PAD_NAMES = ['Kick', 'Snare', 'CHat', 'OHat', 'LTom', 'MTom', 'Clap', 'Ride'];

export default {
    id: 'midi-drum',
    name: 'MIDI-DRUM',
    hp: 8,
    color: '#6a4c93',
    category: 'midi',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Trigger outputs (8 pads)
        const trig1 = new Float32Array(bufferSize);
        const trig2 = new Float32Array(bufferSize);
        const trig3 = new Float32Array(bufferSize);
        const trig4 = new Float32Array(bufferSize);
        const trig5 = new Float32Array(bufferSize);
        const trig6 = new Float32Array(bufferSize);
        const trig7 = new Float32Array(bufferSize);
        const trig8 = new Float32Array(bufferSize);
        const velocity = new Float32Array(bufferSize);

        const trigOutputs = [trig1, trig2, trig3, trig4, trig5, trig6, trig7, trig8];

        // LED states (one per pad)
        const leds = {
            pad1: 0, pad2: 0, pad3: 0, pad4: 0,
            pad5: 0, pad6: 0, pad7: 0, pad8: 0
        };

        // Trigger state (samples remaining for each trigger pulse)
        const triggerSamples = [0, 0, 0, 0, 0, 0, 0, 0];
        const velocities = [0, 0, 0, 0, 0, 0, 0, 0];

        // Trigger pulse length (~5ms)
        const TRIGGER_LENGTH = Math.floor(sampleRate * 0.005);

        // LED decay
        const ledDecay = Math.exp(-1 / (sampleRate * 0.08) * bufferSize);

        return {
            params: {
                channel: 0,    // MIDI channel (0-15, 0 = omni/all)
                // Note assignments for each pad
                note1: 36, note2: 38, note3: 42, note4: 46,
                note5: 41, note6: 47, note7: 39, note8: 51
            },
            inputs: {},
            outputs: {
                trig1, trig2, trig3, trig4, trig5, trig6, trig7, trig8,
                velocity
            },
            leds,

            process() {
                const midiManager = window.midiManager;
                if (!midiManager) {
                    // No MIDI - clear outputs
                    for (let p = 0; p < 8; p++) {
                        trigOutputs[p].fill(0);
                    }
                    velocity.fill(0);
                    return;
                }

                const channelParam = Math.floor(clamp(this.params.channel, 0, 16));
                const noteAssignments = [
                    Math.floor(this.params.note1),
                    Math.floor(this.params.note2),
                    Math.floor(this.params.note3),
                    Math.floor(this.params.note4),
                    Math.floor(this.params.note5),
                    Math.floor(this.params.note6),
                    Math.floor(this.params.note7),
                    Math.floor(this.params.note8)
                ];

                // Get note events from MIDI manager
                const events = channelParam === 0
                    ? midiManager.consumeNoteEvents()
                    : midiManager.consumeNoteEvents(channelParam - 1);

                // Process note events
                for (const event of events) {
                    if (event.type === 'noteOn') {
                        // Find which pad this note triggers
                        const padIndex = noteAssignments.indexOf(event.note);
                        if (padIndex !== -1) {
                            // Trigger this pad
                            triggerSamples[padIndex] = TRIGGER_LENGTH;
                            velocities[padIndex] = event.velocity / 127;
                            leds[`pad${padIndex + 1}`] = 1;
                        }
                    }
                }

                // Fill output buffers
                for (let i = 0; i < bufferSize; i++) {
                    // Find the highest velocity for combined output
                    let maxVel = 0;

                    for (let p = 0; p < 8; p++) {
                        if (triggerSamples[p] > 0) {
                            trigOutputs[p][i] = 10;  // 10V trigger
                            triggerSamples[p]--;
                            maxVel = Math.max(maxVel, velocities[p]);
                        } else {
                            trigOutputs[p][i] = 0;
                        }
                    }

                    // Velocity output (0-10V based on last triggered pad)
                    velocity[i] = maxVel * 10;
                }

                // Decay LEDs
                for (let p = 1; p <= 8; p++) {
                    leds[`pad${p}`] *= ledDecay;
                    if (leds[`pad${p}`] < 0.01) leds[`pad${p}`] = 0;
                }
            },

            reset() {
                for (let p = 0; p < 8; p++) {
                    trigOutputs[p].fill(0);
                    triggerSamples[p] = 0;
                    velocities[p] = 0;
                }
                velocity.fill(0);
                for (let p = 1; p <= 8; p++) {
                    leds[`pad${p}`] = 0;
                }
            }
        };
    },

    ui: {
        leds: ['pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6', 'pad7', 'pad8'],
        knobs: [
            { id: 'channel', label: 'Chan', param: 'channel', min: 0, max: 16, default: 0, step: 1 },
            { id: 'note1', label: 'N1', param: 'note1', min: 0, max: 127, default: 36, step: 1 },
            { id: 'note2', label: 'N2', param: 'note2', min: 0, max: 127, default: 38, step: 1 },
            { id: 'note3', label: 'N3', param: 'note3', min: 0, max: 127, default: 42, step: 1 },
            { id: 'note4', label: 'N4', param: 'note4', min: 0, max: 127, default: 46, step: 1 },
            { id: 'note5', label: 'N5', param: 'note5', min: 0, max: 127, default: 41, step: 1 },
            { id: 'note6', label: 'N6', param: 'note6', min: 0, max: 127, default: 47, step: 1 },
            { id: 'note7', label: 'N7', param: 'note7', min: 0, max: 127, default: 39, step: 1 },
            { id: 'note8', label: 'N8', param: 'note8', min: 0, max: 127, default: 51, step: 1 }
        ],
        inputs: [],
        outputs: [
            { id: 'trig1', label: 'Kick', port: 'trig1', type: 'trigger' },
            { id: 'trig2', label: 'Snr', port: 'trig2', type: 'trigger' },
            { id: 'trig3', label: 'CHat', port: 'trig3', type: 'trigger' },
            { id: 'trig4', label: 'OHat', port: 'trig4', type: 'trigger' },
            { id: 'trig5', label: 'LTom', port: 'trig5', type: 'trigger' },
            { id: 'trig6', label: 'MTom', port: 'trig6', type: 'trigger' },
            { id: 'trig7', label: 'Clap', port: 'trig7', type: 'trigger' },
            { id: 'trig8', label: 'Ride', port: 'trig8', type: 'trigger' },
            { id: 'velocity', label: 'Vel', port: 'velocity', type: 'cv' }
        ]
    }
};
