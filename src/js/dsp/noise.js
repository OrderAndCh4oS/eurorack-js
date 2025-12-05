import { clamp } from '../utils/math.js';

/**
 * Noise / Sample & Hold Module
 *
 * White/Pink noise generator with Sample & Hold circuit
 * Based on classic analog noise sources and S&H designs
 *
 * Params:
 *   rate: 0-1 (internal clock 0.1Hz to 100Hz)
 *   slew: 0-1 (S&H output smoothing)
 *
 * Inputs:
 *   sample: +/-5V (signal to sample, buffer)
 *   trigger: 0-5V (external trigger, >=1V edge)
 *
 * Outputs:
 *   white: +/-5V white noise
 *   pink: +/-5V pink noise (-3dB/octave)
 *   sh: +/-5V sampled & held value
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} Noise/S&H module
 */
export function createNoiseSH({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const white = new Float32Array(bufferSize);
    const pink = new Float32Array(bufferSize);
    const sh = new Float32Array(bufferSize);

    /* Pink noise filter state (Paul Kellet's algorithm) */
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    /* Sample & Hold state */
    let heldValue = 0;
    let lastTrig = 0;
    let internalPhase = 0;

    /* S&H output slew state */
    let slewState = 0;

    /* Track if external sample input is connected */
    let sampleBuffer = null;

    return {
        params: { rate: 0.3, slew: 0 },
        inputs: {
            get sample() { return sampleBuffer; },
            set sample(buf) { sampleBuffer = buf; },
            trigger: 0
        },
        outputs: { white, pink, sh },
        leds: { sh: 0 },
        process() {
            /* Internal clock rate (0.1Hz to 100Hz exponential) */
            const clockHz = 0.1 * Math.pow(1000, clamp(this.params.rate));
            const clockInc = clockHz / sampleRate;

            /* Slew coefficient for S&H smoothing */
            const slewTime = clamp(this.params.slew) * 50 + 0.5; /* 0.5ms to 50ms */
            const slewCoeff = 1 - Math.exp(-1000 / (sampleRate * slewTime));

            /* Check if external sample is connected (has non-zero signal) */
            const useExternal = sampleBuffer && sampleBuffer.some(v => Math.abs(v) > 0.001);

            for (let i = 0; i < bufferSize; i++) {
                /* White noise using fast xorshift */
                const w = (Math.random() * 2 - 1);
                white[i] = w * 5;

                /* Pink noise filter (Paul Kellet's economy method) */
                b0 = 0.99886 * b0 + w * 0.0555179;
                b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.96900 * b2 + w * 0.1538520;
                b3 = 0.86650 * b3 + w * 0.3104856;
                b4 = 0.55000 * b4 + w * 0.5329522;
                b5 = -0.7616 * b5 - w * 0.0168980;
                const pinkSample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
                b6 = w * 0.115926;
                pink[i] = pinkSample * 5;

                /* Sample & Hold */
                /* Check for trigger (external or internal clock) */
                internalPhase += clockInc;
                const internalTrig = internalPhase >= 1 ? 5 : 0;
                if (internalPhase >= 1) internalPhase -= 1;

                const trigIn = Math.max(this.inputs.trigger, internalTrig);
                const trigEdge = trigIn >= 1 && lastTrig < 1;
                lastTrig = trigIn;

                if (trigEdge) {
                    /* Sample from external input or internal white noise */
                    heldValue = useExternal ? sampleBuffer[i] : white[i];
                }

                /* Apply slew to S&H output */
                slewState += slewCoeff * (heldValue - slewState);
                sh[i] = this.params.slew > 0.01 ? slewState : heldValue;
            }

            /* LED shows S&H activity (absolute level) */
            this.leds.sh = Math.abs(heldValue) / 5;
        }
    };
}
