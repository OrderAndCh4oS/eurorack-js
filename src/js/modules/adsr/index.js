/**
 * ADSR - Envelope Generator
 *
 * Classic 4-stage envelope: Attack, Decay, Sustain, Release
 * Based on CEM3310 / AS3310 style envelope generators
 */

import { clamp } from '../../utils/math.js';

export default {
    id: 'adsr',
    name: 'ADSR',
    hp: 4,
    color: '#8a4a4a',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const env = new Float32Array(bufferSize);
        const inv = new Float32Array(bufferSize);
        const eoc = new Float32Array(bufferSize);

        const IDLE = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;
        let stage = IDLE;
        let level = 0;
        let lastGate = 0;
        let lastRetrig = 0;

        function knobToTime(knob) {
            return 0.002 * Math.pow(5000, clamp(knob));
        }

        function calcCoeff(timeSeconds, targetRatio = 0.001) {
            const samples = timeSeconds * sampleRate;
            if (samples < 1) return 1;
            return 1 - Math.exp(-Math.log((1 + targetRatio) / targetRatio) / samples);
        }

        return {
            params: { attack: 0.2, decay: 0.3, sustain: 0.7, release: 0.4 },
            inputs: {
                gate: new Float32Array(bufferSize),
                retrig: new Float32Array(bufferSize)
            },
            outputs: { env, inv, eoc },
            leds: { env: 0 },

            process() {
                const attackTime = knobToTime(this.params.attack);
                const decayTime = knobToTime(this.params.decay);
                const sustainLevel = clamp(this.params.sustain) * 5;
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

                    if (gateEdge || (retrigEdge && gateHigh)) {
                        stage = ATTACK;
                    }

                    if (!gateHigh && lastGate >= 1) {
                        stage = RELEASE;
                    }

                    lastGate = gateVal;
                    lastRetrig = retrigVal;

                    let eocTrig = 0;
                    switch (stage) {
                        case ATTACK:
                            level += attackCoeff * (5.5 - level);
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
                                eocTrig = 5;
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

                this.leds.env = level / 5;
            },

            reset() {
                stage = IDLE;
                level = 0;
                lastGate = 0;
                lastRetrig = 0;
                env.fill(0);
                inv.fill(0);
                eoc.fill(0);
                this.leds.env = 0;
            }
        };
    },

    ui: {
        leds: ['env'],
        knobs: [
            { id: 'attack', label: 'Atk', param: 'attack', min: 0, max: 1, default: 0.2 },
            { id: 'decay', label: 'Dec', param: 'decay', min: 0, max: 1, default: 0.3 },
            { id: 'sustain', label: 'Sus', param: 'sustain', min: 0, max: 1, default: 0.7 },
            { id: 'release', label: 'Rel', param: 'release', min: 0, max: 1, default: 0.4 }
        ],
        inputs: [
            { id: 'gate', label: 'Gate', port: 'gate', type: 'trigger' },
            { id: 'retrig', label: 'Retr', port: 'retrig', type: 'trigger' }
        ],
        outputs: [
            { id: 'env', label: 'Env', port: 'env', type: 'cv' },
            { id: 'inv', label: 'Inv', port: 'inv', type: 'cv' },
            { id: 'eoc', label: 'EOC', port: 'eoc', type: 'trigger' }
        ]
    }
};
