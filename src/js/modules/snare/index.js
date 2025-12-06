/**
 * SNARE - Snare Drum Synthesizer
 *
 * Based on 2hp Snare module specifications.
 * - Snap: controls attack intensity and noise amount (simulates snare wires)
 * - Decay: controls envelope length
 * - Pitch: controls oscillator frequency with 1V/Oct tracking
 * - CV over all parameters
 * - Trigger input
 *
 * Synthesis: Triangle oscillator + filtered noise mixed together
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'snare',
    name: 'SNARE',
    hp: 2,
    color: '#a04030',
    category: 'voice',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const leds = { active: 0 };

        // Oscillator state
        let phase = 0;
        let ampEnv = 0;
        let noiseEnv = 0;

        // Noise state (simple white noise)
        let noiseState = 0;

        // Trigger detection
        let lastTrig = 0;

        // LED decay
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        // Envelope rates
        let ampDecayRate = 0;
        let noiseDecayRate = 0;

        // Base frequencies for snare body (Hz)
        const BASE_FREQ_MIN = 100;
        const BASE_FREQ_MAX = 400;

        // Simple noise filter state
        let noiseFilterState = 0;
        const noiseFilterCoeff = 0.85; // Highpass-ish character

        return {
            params: {
                snap: 0.5,    // Noise/attack intensity (0-1)
                decay: 0.5,   // Decay time (0-1)
                pitch: 0.5    // Body pitch (0-1)
            },
            inputs: {
                trigger: new Float32Array(bufferSize),
                pitchCV: new Float32Array(bufferSize),
                decayCV: new Float32Array(bufferSize),
                snapCV: new Float32Array(bufferSize)
            },
            outputs: { out },
            leds,

            process() {
                const snapParam = clamp(this.params.snap, 0, 1);
                const decayParam = clamp(this.params.decay, 0, 1);
                const pitchParam = clamp(this.params.pitch, 0, 1);

                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const trig = this.inputs.trigger[i];

                    // Rising edge detection
                    if (trig >= 1 && lastTrig < 1) {
                        ampEnv = 1;
                        noiseEnv = 1;

                        // Calculate decay rates based on decay param + CV
                        const decayCV = this.inputs.decayCV[i] / 5;
                        const totalDecay = clamp(decayParam + decayCV * 0.5, 0.05, 1);

                        // Body amplitude decay: 30ms to 300ms
                        const ampDecayMs = 30 + totalDecay * 270;
                        const ampDecaySamples = (ampDecayMs / 1000) * sampleRate;
                        ampDecayRate = Math.exp(-4.5 / ampDecaySamples);

                        // Noise decay: faster, 10ms to 150ms
                        const noiseDecayMs = 10 + totalDecay * 140;
                        const noiseDecaySamples = (noiseDecayMs / 1000) * sampleRate;
                        noiseDecayRate = Math.exp(-4.5 / noiseDecaySamples);
                    }
                    lastTrig = trig;

                    // Calculate frequency
                    const pitchCV = this.inputs.pitchCV[i];
                    const baseFreq = BASE_FREQ_MIN + pitchParam * (BASE_FREQ_MAX - BASE_FREQ_MIN);
                    const freq = baseFreq * Math.pow(2, pitchCV);

                    // Triangle oscillator for body
                    const phaseInc = (freq / sampleRate);
                    phase += phaseInc;
                    if (phase > 1) phase -= 1;

                    // Triangle wave: 4 * |phase - 0.5| - 1
                    const triSample = 4 * Math.abs(phase - 0.5) - 1;

                    // Generate noise
                    noiseState = noiseState * 1664525 + 1013904223;
                    const noise = ((noiseState >>> 16) / 32768 - 1);

                    // Highpass filter the noise for snare character
                    const filteredNoise = noise - noiseFilterState;
                    noiseFilterState = noise * (1 - noiseFilterCoeff);

                    // Mix body and noise based on snap parameter + CV
                    const snapCV = this.inputs.snapCV[i] / 5;
                    const totalSnap = clamp(snapParam + snapCV * 0.5, 0, 1);

                    // Body with envelope
                    const body = triSample * ampEnv * (1 - totalSnap * 0.5);

                    // Noise with envelope and snap amount
                    const snareNoise = filteredNoise * noiseEnv * totalSnap;

                    // Mix and apply soft clipping
                    let sample = body + snareNoise * 1.5;
                    sample = Math.tanh(sample * 1.2);

                    // Scale to audio range
                    out[i] = sample * 5;

                    peak = Math.max(peak, Math.abs(out[i]));

                    // Decay envelopes
                    ampEnv *= ampDecayRate;
                    noiseEnv *= noiseDecayRate;

                    // Kill denormals
                    if (ampEnv < 1e-6) ampEnv = 0;
                    if (noiseEnv < 1e-6) noiseEnv = 0;
                }

                // Update LED
                leds.active = Math.max(peak / 10, leds.active * ledDecay);
            },

            reset() {
                out.fill(0);
                phase = 0;
                ampEnv = 0;
                noiseEnv = 0;
                lastTrig = 0;
                noiseFilterState = 0;
                leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'snap', label: 'Snap', param: 'snap', min: 0, max: 1, default: 0.5 },
            { id: 'decay', label: 'Decay', param: 'decay', min: 0, max: 1, default: 0.5 },
            { id: 'pitch', label: 'Pitch', param: 'pitch', min: 0, max: 1, default: 0.5 }
        ],
        inputs: [
            { id: 'trigger', label: 'Trig', port: 'trigger', type: 'trigger' },
            { id: 'pitchCV', label: 'V/O', port: 'pitchCV', type: 'cv' },
            { id: 'decayCV', label: 'Dcy', port: 'decayCV', type: 'cv' },
            { id: 'snapCV', label: 'Snp', port: 'snapCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
