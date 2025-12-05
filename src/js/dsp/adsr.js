import { clamp } from '../utils/math.js';

/**
 * ADSR Envelope Generator
 *
 * Classic 4-stage envelope: Attack, Decay, Sustain, Release
 * Based on CEM3310 / AS3310 style envelope generators
 *
 * Params:
 *   attack: 0-1 (2ms to 10s, exponential)
 *   decay: 0-1 (2ms to 10s, exponential)
 *   sustain: 0-1 (0-100% level)
 *   release: 0-1 (2ms to 10s, exponential)
 *
 * Inputs:
 *   gate: 0-5V (triggers on >=1V rising edge)
 *   retrig: 0-5V (retrigger input)
 *
 * Outputs:
 *   env: 0-5V (envelope CV output)
 *   inv: 0 to -5V (inverted envelope)
 *   eoc: 0/5V (end of cycle trigger)
 *
 * @param {Object} options
 * @param {number} options.sampleRate - Sample rate in Hz (default: 44100)
 * @param {number} options.bufferSize - Buffer size in samples (default: 512)
 * @returns {Object} ADSR module
 */
export function createADSR({ sampleRate = 44100, bufferSize = 512 } = {}) {
    const env = new Float32Array(bufferSize);
    const inv = new Float32Array(bufferSize);
    const eoc = new Float32Array(bufferSize);

    /* Envelope state */
    const IDLE = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;
    let stage = IDLE;
    let level = 0;
    let lastGate = 0;
    let lastRetrig = 0;

    /* Convert knob 0-1 to time in seconds (2ms to 10s, exponential) */
    function knobToTime(knob) {
        return 0.002 * Math.pow(5000, clamp(knob));
    }

    /* Calculate coefficient for exponential envelope */
    function calcCoeff(timeSeconds, targetRatio = 0.001) {
        const samples = timeSeconds * sampleRate;
        if (samples < 1) return 1;
        return 1 - Math.exp(-Math.log((1 + targetRatio) / targetRatio) / samples);
    }

    /* Input buffers for sample-accurate gate/retrig detection */
    const gateIn = new Float32Array(bufferSize);
    const retrigIn = new Float32Array(bufferSize);

    return {
        params: { attack: 0.2, decay: 0.3, sustain: 0.7, release: 0.4 },
        inputs: { gate: gateIn, retrig: retrigIn },
        outputs: { env, inv, eoc },
        leds: { env: 0 },
        process() {
            const attackTime = knobToTime(this.params.attack);
            const decayTime = knobToTime(this.params.decay);
            const sustainLevel = clamp(this.params.sustain) * 5; /* 0-5V */
            const releaseTime = knobToTime(this.params.release);

            const attackCoeff = calcCoeff(attackTime);
            const decayCoeff = calcCoeff(decayTime);
            const releaseCoeff = calcCoeff(releaseTime);

            for (let i = 0; i < bufferSize; i++) {
                const gateVal = this.inputs.gate[i];
                const retrigVal = this.inputs.retrig[i];
                const gateHigh = gateVal >= 1;
                const gateEdge = gateHigh && lastGate < 1;
                const retrigEdge = retrigVal >= 1 && lastRetrig < 1;

                /* Gate on - start attack */
                if (gateEdge || (retrigEdge && gateHigh)) {
                    stage = ATTACK;
                }

                /* Gate off - start release */
                if (!gateHigh && lastGate >= 1) {
                    stage = RELEASE;
                }

                lastGate = gateVal;
                lastRetrig = retrigVal;

                /* Process envelope stages */
                let eocTrig = 0;
                switch (stage) {
                    case ATTACK:
                        level += attackCoeff * (5.5 - level); /* Overshoot slightly for snappy attack */
                        if (level >= 5) {
                            level = 5;
                            stage = DECAY;
                        }
                        break;
                    case DECAY:
                        level += decayCoeff * (sustainLevel - level);
                        if (Math.abs(level - sustainLevel) < 0.001) {
                            level = sustainLevel;
                            stage = SUSTAIN;
                        }
                        break;
                    case SUSTAIN:
                        level = sustainLevel;
                        break;
                    case RELEASE:
                        level += releaseCoeff * (0 - level);
                        if (level < 0.001) {
                            level = 0;
                            stage = IDLE;
                            eocTrig = 5; /* End of cycle trigger */
                        }
                        break;
                    case IDLE:
                    default:
                        level = 0;
                        break;
                }

                env[i] = level;
                inv[i] = -level;
                eoc[i] = eocTrig;
            }

            /* LED shows envelope level */
            this.leds.env = level / 5;
        }
    };
}
