/**
 * VERB - Stereo Reverb
 *
 * Based on 2hp Verb specifications.
 * A lush stereo reverb with adjustable time, damping, and mix.
 *
 * Features:
 * - Time knob (reverb decay length)
 * - Damp knob (high frequency damping)
 * - Mix knob (dry/wet balance)
 * - CV input for Mix
 * - Stereo I/O with mono normalization
 */

// Freeverb-style comb filter delay times (in samples at 44100Hz)
const COMB_DELAYS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_DELAYS = [556, 441, 341, 225];

// Stereo spread (offset for right channel)
const STEREO_SPREAD = 23;

export default {
    id: 'verb',
    name: 'VERB',
    hp: 4,
    color: '#5a4a7b',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Scale delay times for sample rate
        const rateScale = sampleRate / 44100;

        // Create comb filters for left and right channels
        const combsL = COMB_DELAYS.map(delay => ({
            buffer: new Float32Array(Math.floor(delay * rateScale) + 1),
            index: 0,
            filterStore: 0
        }));

        const combsR = COMB_DELAYS.map(delay => ({
            buffer: new Float32Array(Math.floor((delay + STEREO_SPREAD) * rateScale) + 1),
            index: 0,
            filterStore: 0
        }));

        // Create allpass filters for left and right channels
        const allpassL = ALLPASS_DELAYS.map(delay => ({
            buffer: new Float32Array(Math.floor(delay * rateScale) + 1),
            index: 0
        }));

        const allpassR = ALLPASS_DELAYS.map(delay => ({
            buffer: new Float32Array(Math.floor((delay + STEREO_SPREAD) * rateScale) + 1),
            index: 0
        }));

        // Own input buffers (for reset pattern)
        const ownAudioL = new Float32Array(bufferSize);
        const ownAudioR = new Float32Array(bufferSize);

        return {
            params: {
                time: 0.5,   // 0-1 (reverb decay time)
                damp: 0.5,   // 0-1 (high frequency damping)
                mix: 0.5     // 0-1 (0 = dry, 1 = wet)
            },

            inputs: {
                audioL: ownAudioL,
                audioR: ownAudioR,
                mixCV: new Float32Array(bufferSize)
            },

            outputs: {
                outL,
                outR
            },

            leds: {
                active: 0
            },

            process() {
                const { time, damp, mix } = this.params;
                const audioL = this.inputs.audioL;
                const audioR = this.inputs.audioR;
                const mixCV = this.inputs.mixCV;

                // Convert time (0-1) to feedback coefficient (0.7 - 0.99)
                const feedback = 0.7 + time * 0.28;

                // Convert damp (0-1) to damping coefficient
                const damp1 = damp * 0.4;
                const damp2 = 1 - damp1;

                let peakLevel = 0;

                for (let i = 0; i < bufferSize; i++) {
                    // Get input (mono normalization: if R is silent, use L)
                    let inputL = audioL[i];
                    let inputR = audioR[i];

                    // Check if right channel has significant signal
                    const rHasSignal = Math.abs(inputR) > 0.0001;
                    if (!rHasSignal) {
                        inputR = inputL; // Normalize mono to stereo
                    }

                    // Mix modulation
                    const modulatedMix = Math.max(0, Math.min(1, mix + (mixCV[i] / 10)));

                    // Scale input for reverb (prevent clipping in feedback)
                    const inputScaled = (inputL + inputR) * 0.015;

                    // Process through parallel comb filters
                    let wetL = 0;
                    let wetR = 0;

                    for (let c = 0; c < combsL.length; c++) {
                        // Left channel comb
                        const combL = combsL[c];
                        const bufLenL = combL.buffer.length;
                        const outputL = combL.buffer[combL.index];

                        // Apply damping (lowpass filter on feedback)
                        combL.filterStore = (outputL * damp2) + (combL.filterStore * damp1);

                        // Write to buffer with feedback
                        combL.buffer[combL.index] = inputScaled + (combL.filterStore * feedback);
                        combL.index = (combL.index + 1) % bufLenL;
                        wetL += outputL;

                        // Right channel comb
                        const combR = combsR[c];
                        const bufLenR = combR.buffer.length;
                        const outputR = combR.buffer[combR.index];

                        combR.filterStore = (outputR * damp2) + (combR.filterStore * damp1);
                        combR.buffer[combR.index] = inputScaled + (combR.filterStore * feedback);
                        combR.index = (combR.index + 1) % bufLenR;
                        wetR += outputR;
                    }

                    // Process through series allpass filters
                    for (let a = 0; a < allpassL.length; a++) {
                        // Left allpass
                        const apL = allpassL[a];
                        const bufLenL = apL.buffer.length;
                        const bufOutL = apL.buffer[apL.index];
                        apL.buffer[apL.index] = wetL + (bufOutL * 0.5);
                        wetL = bufOutL - wetL;
                        apL.index = (apL.index + 1) % bufLenL;

                        // Right allpass
                        const apR = allpassR[a];
                        const bufLenR = apR.buffer.length;
                        const bufOutR = apR.buffer[apR.index];
                        apR.buffer[apR.index] = wetR + (bufOutR * 0.5);
                        wetR = bufOutR - wetR;
                        apR.index = (apR.index + 1) % bufLenR;
                    }

                    // Scale wet output
                    wetL *= 1.5;
                    wetR *= 1.5;

                    // Mix dry and wet
                    outL[i] = inputL * (1 - modulatedMix) + wetL * modulatedMix;
                    outR[i] = inputR * (1 - modulatedMix) + wetR * modulatedMix;

                    // Soft clip to prevent excessive levels
                    if (Math.abs(outL[i]) > 5) {
                        outL[i] = Math.tanh(outL[i] / 5) * 5;
                    }
                    if (Math.abs(outR[i]) > 5) {
                        outR[i] = Math.tanh(outR[i] / 5) * 5;
                    }

                    // Track peak for LED
                    peakLevel = Math.max(peakLevel, Math.abs(outL[i]), Math.abs(outR[i]));
                }

                // Update LED (normalized to 0-1)
                this.leds.active = Math.min(1, peakLevel / 5);

                // Reset inputs if they were replaced by routing
                if (this.inputs.audioL !== ownAudioL) {
                    ownAudioL.fill(0);
                    this.inputs.audioL = ownAudioL;
                }
                if (this.inputs.audioR !== ownAudioR) {
                    ownAudioR.fill(0);
                    this.inputs.audioR = ownAudioR;
                }
            },

            reset() {
                // Clear all comb filter buffers
                for (const comb of combsL) {
                    comb.buffer.fill(0);
                    comb.index = 0;
                    comb.filterStore = 0;
                }
                for (const comb of combsR) {
                    comb.buffer.fill(0);
                    comb.index = 0;
                    comb.filterStore = 0;
                }

                // Clear all allpass filter buffers
                for (const ap of allpassL) {
                    ap.buffer.fill(0);
                    ap.index = 0;
                }
                for (const ap of allpassR) {
                    ap.buffer.fill(0);
                    ap.index = 0;
                }

                outL.fill(0);
                outR.fill(0);
                this.leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'time', label: 'Time', param: 'time', min: 0, max: 1, default: 0.5 },
            { id: 'damp', label: 'Damp', param: 'damp', min: 0, max: 1, default: 0.5 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 0.5 }
        ],
        switches: [],
        inputs: [
            { id: 'audioL', label: 'L', port: 'audioL', type: 'audio' },
            { id: 'audioR', label: 'R', port: 'audioR', type: 'audio' },
            { id: 'mixCV', label: 'Mix', port: 'mixCV', type: 'cv' }
        ],
        outputs: [
            { id: 'outL', label: 'L', port: 'outL', type: 'audio' },
            { id: 'outR', label: 'R', port: 'outR', type: 'audio' }
        ]
    }
};
