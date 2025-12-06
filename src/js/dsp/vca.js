import { clamp } from '../utils/math.js';
import { createSlew } from '../utils/slew.js';

/**
 * 2HP Dual VCA – Linear Response (SSM2164 architecture)
 *
 * Uses linear CV response per 2HP hardware specs.
 * CV input is capacitor-smoothed to prevent clicks/pops.
 * LED meters have smooth decay like real hardware.
 * 0V = silence, 5V = unity gain (linear relationship)
 *
 * Params:
 *   ch1Gain: 0→1 (channel 1 manual gain)
 *   ch2Gain: 0→1 (channel 2 manual gain)
 *
 * Inputs:
 *   ch1In: Audio buffer for channel 1
 *   ch2In: Audio buffer for channel 2
 *   ch2CV: 0-5V CV for channel 2 VCA (default: 5V = fully open)
 *
 * Outputs:
 *   ch1Out: Processed audio buffer
 *   ch2Out: Processed audio buffer
 *
 * @param {Object} options
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @returns {Object} VCA module
 */
export function create2hpDualVCA({ bufferSize = 512, sampleRate = 44100 } = {}) {
    const ch1Out = new Float32Array(bufferSize);
    const ch2Out = new Float32Array(bufferSize);
    const leds = { ch1: 0, ch2: 0 };

    // Own input buffers - reset after process() for silence when unpatched
    const ownCh1In = new Float32Array(bufferSize);
    const ownCh2In = new Float32Array(bufferSize);

    /* CV smoothing: prevents clicks when CV changes abruptly (~3ms) */
    const cvSlew = createSlew({ sampleRate, timeMs: 3 });

    /* LED decay: ~100ms time constant (typical hardware response) */
    const ledDecay = Math.exp(-1 / (sampleRate * 0.1) * bufferSize);

    /**
     * Linear response: 0-5V maps directly to 0-1 gain (per 2HP SSM2164 specs)
     */
    function linearResponse(cv) {
        return clamp(cv, 0, 5) / 5;
    }

    return {
        params: { ch1Gain: 1, ch2Gain: 1 },
        inputs: {
            ch1In: ownCh1In,
            ch2In: ownCh2In,
            ch2CV: 5
        },
        outputs: { ch1Out, ch2Out },
        leds,
        clearAudioInputs() {
            ownCh1In.fill(0);
            ownCh2In.fill(0);
            this.inputs.ch1In = ownCh1In;
            this.inputs.ch2In = ownCh2In;
        },
        process() {
            const g1 = clamp(this.params.ch1Gain);
            const g2 = clamp(this.params.ch2Gain);
            let pk1 = 0, pk2 = 0;

            const in1 = this.inputs.ch1In;
            const in2 = this.inputs.ch2In;

            for (let i = 0; i < bufferSize; i++) {
                /* Smooth CV per-sample to prevent clicks */
                const smoothedCV = cvSlew.process(this.inputs.ch2CV);
                const cvGain = linearResponse(smoothedCV);

                const s1 = in1[i] * g1;
                const s2 = in2[i] * g2 * cvGain;
                ch1Out[i] = s1;
                ch2Out[i] = s2;
                pk1 = Math.max(pk1, Math.abs(s1));
                pk2 = Math.max(pk2, Math.abs(s2));
            }

            /* LED smoothing with decay */
            leds.ch1 = Math.max(pk1 / 10, leds.ch1 * ledDecay);
            leds.ch2 = Math.max(pk2 / 10, leds.ch2 * ledDecay);

            // Reset to zeroed own buffers if input was replaced by routing
            if (this.inputs.ch1In !== ownCh1In) {
                ownCh1In.fill(0);
                this.inputs.ch1In = ownCh1In;
            }
            if (this.inputs.ch2In !== ownCh2In) {
                ownCh2In.fill(0);
                this.inputs.ch2In = ownCh2In;
            }
        }
    };
}
