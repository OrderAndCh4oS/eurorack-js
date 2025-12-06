import { clamp } from '../utils/math.js';
import { createSlew } from '../utils/slew.js';

/**
 * VCF - Moog-style Transistor Ladder Filter
 *
 * 24dB/octave low-pass filter with resonance (self-oscillates)
 * Based on the classic transistor ladder topology
 *
 * Params:
 *   cutoff: 0-1 (20Hz to 20kHz, exponential)
 *   resonance: 0-1 (0% to self-oscillation)
 *
 * Inputs:
 *   audio: +/-5V audio input buffer
 *   cutoffCV: 0-5V (adds to cutoff, 1V/oct style)
 *   resCV: 0-5V (adds to resonance)
 *
 * Outputs:
 *   lpf: +/-5V 24dB/oct low-pass
 *   bpf: +/-5V 12dB/oct band-pass
 *   hpf: +/-5V 12dB/oct high-pass
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} VCF module
 */
export function createVCF({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const lpf = new Float32Array(bufferSize);
    const bpf = new Float32Array(bufferSize);
    const hpf = new Float32Array(bufferSize);

    // Own input buffer - reset after process() for silence when unpatched
    const ownAudio = new Float32Array(bufferSize);

    /* 4-pole ladder filter state */
    let stage = [0, 0, 0, 0];
    let delay = [0, 0, 0, 0];

    /* Cutoff smoothing using shared slew utility (2ms) */
    const cutoffSlew = createSlew({ sampleRate, timeMs: 2 });

    return {
        params: { cutoff: 0.5, resonance: 0.3 },
        inputs: { audio: ownAudio, cutoffCV: 0, resCV: 0 },
        outputs: { lpf, bpf, hpf },
        leds: { cutoff: 0 },
        clearAudioInputs() {
            ownAudio.fill(0);
            this.inputs.audio = ownAudio;
        },
        process() {
            const audioIn = this.inputs.audio;

            /* Base cutoff frequency from knob (20Hz to 20kHz exponential) */
            const cutoffKnob = clamp(this.params.cutoff);
            const cutoffHz = 20 * Math.pow(1000, cutoffKnob);

            /* CV modulation (1V/oct style) */
            const cvMod = clamp(this.inputs.cutoffCV, 0, 5) / 5;
            const modulatedHz = cutoffHz * Math.pow(4, cvMod); /* ~2 octaves per 5V */

            /* Resonance with CV */
            const res = clamp(this.params.resonance + this.inputs.resCV / 10, 0, 1.1);
            const k = res * 4; /* Feedback amount (4 = self-oscillation threshold) */

            for (let i = 0; i < bufferSize; i++) {
                /* Smooth cutoff to prevent zipper noise */
                const cutoffSmooth = cutoffSlew.process(modulatedHz);

                /* Calculate filter coefficient */
                /* Attempt to linearize frequency response across range */
                const fc = clamp(cutoffSmooth / sampleRate, 0.0001, 0.45);
                const g = Math.tan(Math.PI * fc);
                const G = g / (1 + g);

                /* Input with resonance feedback */
                const input = audioIn[i] / 5; /* Normalize to +/-1 */
                const feedback = delay[3];

                /* Soft clip the feedback for musical self-oscillation */
                const clipFeedback = Math.tanh(feedback * k);
                const u = input - clipFeedback;

                /* 4-pole cascade (each pole is a 1-pole lowpass) */
                for (let p = 0; p < 4; p++) {
                    const prevStage = p === 0 ? u : stage[p - 1];
                    const v = G * (prevStage - delay[p]);
                    stage[p] = v + delay[p];
                    delay[p] = stage[p] + v;
                }

                /* Outputs */
                lpf[i] = stage[3] * 5; /* 24dB LP from 4th pole */
                bpf[i] = (stage[1] - stage[3]) * 5; /* BP from difference */
                hpf[i] = (u - stage[1]) * 5; /* HP from input - 2nd pole */
            }

            /* LED shows cutoff frequency */
            this.leds.cutoff = cutoffKnob;

            // Reset to zeroed own buffer if input was replaced by routing
            if (this.inputs.audio !== ownAudio) {
                ownAudio.fill(0);
                this.inputs.audio = ownAudio;
            }
        }
    };
}
