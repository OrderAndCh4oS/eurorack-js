/**
 * KICK - Bass Drum Synthesizer
 *
 * Based on 2hp Kick module specifications.
 * - Pitch with 1V/Oct tracking across 5 octaves
 * - Decay control for envelope length
 * - Tone control for harmonic content (soft clipping)
 * - CV over all parameters
 * - Trigger input
 *
 * Synthesis: Sine oscillator with pitch envelope sweep + amplitude envelope
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'kick',
    name: 'KICK',
    hp: 4,
    color: '#8b4513',
    category: 'voice',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const leds = { active: 0 };

        // Oscillator state
        let phase = 0;
        let ampEnv = 0;
        let pitchEnv = 0;

        // Trigger detection
        let lastTrig = 0;

        // LED decay
        const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

        // Envelope rates (calculated per trigger)
        let ampDecayRate = 0;
        let pitchDecayRate = 0;

        // Base frequencies for kick (Hz)
        const BASE_FREQ_MIN = 30;   // Low kick
        const BASE_FREQ_MAX = 150;  // High kick

        // Pitch envelope settings
        const PITCH_SWEEP_OCTAVES = 2; // How many octaves pitch sweeps down

        return {
            params: {
                pitch: 0.3,   // Base pitch (0-1)
                decay: 0.5,   // Decay time (0-1)
                tone: 0.3     // Harmonic content / distortion (0-1)
            },
            inputs: {
                trigger: new Float32Array(bufferSize),
                pitchCV: new Float32Array(bufferSize),
                decayCV: new Float32Array(bufferSize),
                toneCV: new Float32Array(bufferSize)
            },
            outputs: { out },
            leds,

            process() {
                const basePitch = clamp(this.params.pitch, 0, 1);
                const decayParam = clamp(this.params.decay, 0, 1);
                const toneParam = clamp(this.params.tone, 0, 1);

                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const trig = this.inputs.trigger[i];

                    // Rising edge detection (threshold ~1V)
                    if (trig >= 1 && lastTrig < 1) {
                        // Trigger new kick
                        ampEnv = 1;
                        pitchEnv = 1;

                        // Calculate decay rates based on decay param + CV
                        const decayCV = this.inputs.decayCV[i] / 5; // 0-5V -> 0-1
                        const totalDecay = clamp(decayParam + decayCV * 0.5, 0.05, 1);

                        // Amplitude decay: 20ms to 500ms
                        const ampDecayMs = 20 + totalDecay * 480;
                        const ampDecaySamples = (ampDecayMs / 1000) * sampleRate;
                        ampDecayRate = Math.exp(-4.5 / ampDecaySamples);

                        // Pitch decay: faster than amplitude (5ms to 100ms)
                        const pitchDecayMs = 5 + totalDecay * 95;
                        const pitchDecaySamples = (pitchDecayMs / 1000) * sampleRate;
                        pitchDecayRate = Math.exp(-4.5 / pitchDecaySamples);
                    }
                    lastTrig = trig;

                    // Calculate frequency with pitch envelope
                    const pitchCV = this.inputs.pitchCV[i];
                    const baseFreq = BASE_FREQ_MIN + basePitch * (BASE_FREQ_MAX - BASE_FREQ_MIN);

                    // Apply 1V/Oct from CV
                    const freqWithCV = baseFreq * Math.pow(2, pitchCV);

                    // Apply pitch envelope (sweeps from higher to base)
                    const pitchSweepMult = 1 + pitchEnv * PITCH_SWEEP_OCTAVES;
                    const freq = freqWithCV * pitchSweepMult;

                    // Sine oscillator
                    const phaseInc = (freq / sampleRate) * Math.PI * 2;
                    phase += phaseInc;
                    if (phase > Math.PI * 2) phase -= Math.PI * 2;

                    let sample = Math.sin(phase);

                    // Apply tone (soft clipping / distortion)
                    const toneCV = this.inputs.toneCV[i] / 5; // 0-5V -> 0-1
                    const totalTone = clamp(toneParam + toneCV * 0.5, 0, 1);

                    if (totalTone > 0) {
                        // Soft clipping using tanh
                        const drive = 1 + totalTone * 4; // 1x to 5x drive
                        sample = Math.tanh(sample * drive) / Math.tanh(drive);
                    }

                    // Apply amplitude envelope
                    sample *= ampEnv;

                    // Scale to audio range
                    out[i] = sample * 5;

                    peak = Math.max(peak, Math.abs(out[i]));

                    // Decay envelopes
                    ampEnv *= ampDecayRate;
                    pitchEnv *= pitchDecayRate;

                    // Kill denormals
                    if (ampEnv < 1e-6) ampEnv = 0;
                    if (pitchEnv < 1e-6) pitchEnv = 0;
                }

                // Update LED
                leds.active = Math.max(peak / 10, leds.active * ledDecay);
            },

            reset() {
                out.fill(0);
                phase = 0;
                ampEnv = 0;
                pitchEnv = 0;
                lastTrig = 0;
                leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'pitch', label: 'Pitch', param: 'pitch', min: 0, max: 1, default: 0.3 },
            { id: 'decay', label: 'Decay', param: 'decay', min: 0, max: 1, default: 0.5 },
            { id: 'tone', label: 'Tone', param: 'tone', min: 0, max: 1, default: 0.3 }
        ],
        inputs: [
            { id: 'trigger', label: 'Trig', port: 'trigger', type: 'trigger' },
            { id: 'pitchCV', label: 'V/O', port: 'pitchCV', type: 'cv' },
            { id: 'decayCV', label: 'Dcy', port: 'decayCV', type: 'cv' },
            { id: 'toneCV', label: 'Tone', port: 'toneCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
