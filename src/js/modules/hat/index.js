/**
 * HAT - Hi-Hat Cymbal Synthesizer
 *
 * Based on 2hp Hat module specifications.
 * - 6 oscillators + noise generator + filters for metallic cymbal sounds
 * - Decay: controls length of both open and closed hats
 * - Sizzle: affects oscillator and filter frequencies
 * - Blend: mixes between metallic and robotic sounds
 * - Separate triggers for Open and Closed (closed chokes open)
 *
 * Synthesis: Multiple square wave oscillators at non-harmonic ratios + filtered noise
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'hat',
    name: 'HAT',
    hp: 3,
    color: '#8a7a20',
    category: 'voice',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const leds = { active: 0 };

        // 6 oscillator phases (metallic/cymbal sound)
        const oscPhases = [0, 0, 0, 0, 0, 0];

        // Base frequencies for the 6 oscillators (non-harmonic ratios for metallic sound)
        const baseFreqs = [205, 295, 370, 523, 620, 840];

        // Envelope state
        let ampEnv = 0;
        let isOpen = false;

        // Trigger detection
        let lastTrigOpen = 0;
        let lastTrigClosed = 0;

        // Noise state
        let noiseState = 12345;

        // Filter states (bandpass for metallic character)
        let bpState1 = 0;
        let bpState2 = 0;

        // LED decay
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        // Envelope rate
        let decayRate = 0;

        return {
            params: {
                decay: 0.5,   // Overall decay time (0-1)
                sizzle: 0.5,  // Affects oscillator/filter frequencies (0-1)
                blend: 0.5    // Mix between metallic and noise (0-1)
            },
            inputs: {
                trigOpen: new Float32Array(bufferSize),
                trigClosed: new Float32Array(bufferSize)
            },
            outputs: { out },
            leds,

            process() {
                const decayParam = clamp(this.params.decay, 0, 1);
                const sizzleParam = clamp(this.params.sizzle, 0, 1);
                const blendParam = clamp(this.params.blend, 0, 1);

                // Sizzle affects frequency multiplier
                const freqMult = 0.5 + sizzleParam * 1.5; // 0.5x to 2x

                // Bandpass filter coefficients affected by sizzle
                const bpFreq = 4000 + sizzleParam * 8000; // 4kHz to 12kHz
                const bpQ = 2 + sizzleParam * 4;
                const w0 = (2 * Math.PI * bpFreq) / sampleRate;
                const alpha = Math.sin(w0) / (2 * bpQ);
                const b0 = alpha;
                const a1 = -2 * Math.cos(w0);
                const a2 = 1 - alpha;
                const norm = 1 + alpha;

                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const trigOpen = this.inputs.trigOpen[i];
                    const trigClosed = this.inputs.trigClosed[i];

                    // Open hat trigger
                    if (trigOpen >= 1 && lastTrigOpen < 1) {
                        ampEnv = 1;
                        isOpen = true;

                        // Open hat: longer decay (100ms to 800ms)
                        const decayMs = 100 + decayParam * 700;
                        const decaySamples = (decayMs / 1000) * sampleRate;
                        decayRate = Math.exp(-4.5 / decaySamples);
                    }
                    lastTrigOpen = trigOpen;

                    // Closed hat trigger (also chokes open hat)
                    if (trigClosed >= 1 && lastTrigClosed < 1) {
                        ampEnv = 1;
                        isOpen = false;

                        // Closed hat: short decay (10ms to 80ms)
                        const decayMs = 10 + decayParam * 70;
                        const decaySamples = (decayMs / 1000) * sampleRate;
                        decayRate = Math.exp(-4.5 / decaySamples);
                    }
                    lastTrigClosed = trigClosed;

                    // Generate 6 square wave oscillators
                    let metallic = 0;
                    for (let o = 0; o < 6; o++) {
                        const freq = baseFreqs[o] * freqMult;
                        const phaseInc = freq / sampleRate;
                        oscPhases[o] += phaseInc;
                        if (oscPhases[o] > 1) oscPhases[o] -= 1;

                        // Square wave
                        metallic += oscPhases[o] < 0.5 ? 1 : -1;
                    }
                    metallic /= 6; // Normalize

                    // Generate noise
                    noiseState = noiseState * 1664525 + 1013904223;
                    const noise = ((noiseState >>> 16) / 32768 - 1);

                    // Bandpass filter the mixed signal for cymbal character
                    const input = metallic * (1 - blendParam * 0.5) + noise * blendParam;

                    // Simple 2-pole bandpass
                    const filtered = (b0 * input - a1 * bpState1 - a2 * bpState2) / norm;
                    bpState2 = bpState1;
                    bpState1 = filtered;

                    // Apply envelope
                    let sample = filtered * ampEnv;

                    // Soft clip
                    sample = Math.tanh(sample * 2);

                    // Scale to audio range
                    out[i] = sample * 5;

                    peak = Math.max(peak, Math.abs(out[i]));

                    // Decay envelope
                    ampEnv *= decayRate;
                    if (ampEnv < 1e-6) ampEnv = 0;
                }

                // Update LED
                leds.active = Math.max(peak / 10, leds.active * ledDecay);
            },

            reset() {
                out.fill(0);
                for (let i = 0; i < 6; i++) oscPhases[i] = 0;
                ampEnv = 0;
                isOpen = false;
                lastTrigOpen = 0;
                lastTrigClosed = 0;
                bpState1 = 0;
                bpState2 = 0;
                leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'decay', label: 'Decay', param: 'decay', min: 0, max: 1, default: 0.5 },
            { id: 'sizzle', label: 'Sizzle', param: 'sizzle', min: 0, max: 1, default: 0.5 },
            { id: 'blend', label: 'Blend', param: 'blend', min: 0, max: 1, default: 0.5 }
        ],
        inputs: [
            { id: 'trigOpen', label: 'Open', port: 'trigOpen', type: 'trigger' },
            { id: 'trigClosed', label: 'Clsd', port: 'trigClosed', type: 'trigger' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
