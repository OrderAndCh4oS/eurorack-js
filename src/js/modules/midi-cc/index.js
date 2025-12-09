/**
 * MIDI-CC - MIDI CC to CV Converter
 *
 * Converts 4 MIDI CC messages to CV outputs.
 * Inspired by Expert Sleepers FH-2 CC mapping.
 *
 * Outputs:
 * - CV 1-4: 0-10V (mapped from CC 0-127)
 *
 * Features:
 * - Channel selection (1-16)
 * - Configurable CC number per output (0-127)
 * - Smooth slew for value changes
 */

export default {
    id: 'midi-cc',
    name: 'MIDI-CC',
    hp: 4,
    color: '#5a4a8a',
    category: 'midi',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const cv1 = new Float32Array(bufferSize);
        const cv2 = new Float32Array(bufferSize);
        const cv3 = new Float32Array(bufferSize);
        const cv4 = new Float32Array(bufferSize);

        // Current smoothed values
        let current1 = 0;
        let current2 = 0;
        let current3 = 0;
        let current4 = 0;

        // Slew coefficient (for smoothing)
        const slewCoeff = 1 - Math.exp(-1 / (0.005 * sampleRate)); // 5ms slew

        return {
            params: {
                channel: 0,     // MIDI channel 0-15
                cc1: 1,         // CC number for output 1 (default: mod wheel)
                cc2: 7,         // CC number for output 2 (default: volume)
                cc3: 74,        // CC number for output 3 (default: brightness/cutoff)
                cc4: 71         // CC number for output 4 (default: resonance)
            },

            inputs: {},

            outputs: {
                cv1, cv2, cv3, cv4
            },

            leds: {
                active: 0
            },

            midiManager: null,

            process() {
                const channel = Math.floor(this.params.channel);
                const ccNums = [
                    Math.floor(this.params.cc1),
                    Math.floor(this.params.cc2),
                    Math.floor(this.params.cc3),
                    Math.floor(this.params.cc4)
                ];

                const midi = this.midiManager || window.midiManager;
                if (!midi) {
                    cv1.fill(0); cv2.fill(0); cv3.fill(0); cv4.fill(0);
                    return;
                }

                // Get target values from CC
                const targets = ccNums.map(cc => (midi.getCCValue(channel, cc) / 127) * 10);
                const currents = [current1, current2, current3, current4];
                const outputs = [cv1, cv2, cv3, cv4];

                // Fill buffers with slewed values
                for (let i = 0; i < bufferSize; i++) {
                    for (let c = 0; c < 4; c++) {
                        currents[c] += (targets[c] - currents[c]) * slewCoeff;
                        outputs[c][i] = currents[c];
                    }
                }

                // Store back
                current1 = currents[0];
                current2 = currents[1];
                current3 = currents[2];
                current4 = currents[3];

                // LED shows activity (any CC above 0)
                this.leds.active = targets.some(t => t > 0.1) ? 1 : 0;
            },

            reset() {
                current1 = current2 = current3 = current4 = 0;
                cv1.fill(0); cv2.fill(0); cv3.fill(0); cv4.fill(0);
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'channel', label: 'Chan', param: 'channel', min: 0, max: 15, default: 0, step: 1 },
            { id: 'cc1', label: 'CC1', param: 'cc1', min: 0, max: 127, default: 1, step: 1 },
            { id: 'cc2', label: 'CC2', param: 'cc2', min: 0, max: 127, default: 7, step: 1 },
            { id: 'cc3', label: 'CC3', param: 'cc3', min: 0, max: 127, default: 74, step: 1 },
            { id: 'cc4', label: 'CC4', param: 'cc4', min: 0, max: 127, default: 71, step: 1 }
        ],
        switches: [],
        inputs: [],
        outputs: [
            { id: 'cv1', label: 'CV1', port: 'cv1', type: 'cv' },
            { id: 'cv2', label: 'CV2', port: 'cv2', type: 'cv' },
            { id: 'cv3', label: 'CV3', port: 'cv3', type: 'cv' },
            { id: 'cv4', label: 'CV4', port: 'cv4', type: 'cv' }
        ]
    }
};
