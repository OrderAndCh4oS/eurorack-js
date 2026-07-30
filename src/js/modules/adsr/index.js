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
    hp: 6,
    color: 'module-color-eight',
    category: 'modulation',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const gateInput = new Float32Array(bufferSize);
        const retrigInput = new Float32Array(bufferSize);
        const attackCV = new Float32Array(bufferSize);
        const decayCV = new Float32Array(bufferSize);
        const releaseCV = new Float32Array(bufferSize);
        const env = new Float32Array(bufferSize);
        const inv = new Float32Array(bufferSize);
        const eoc = new Float32Array(bufferSize);

        const IDLE = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;
        let stage = IDLE;
        let level = 0;
        let lastGate = 0;
        let lastRetrig = 0;
        let eocPulseSamples = 0;
        const EOC_PULSE_SAMPLES = Math.max(1, Math.round(sampleRate * 0.005));

        function knobToTime(knob, fallback) {
            const normalized = Number.isFinite(knob) ? clamp(knob) : fallback;
            return 0.002 * Math.pow(5000, normalized);
        }

        function calcCoeff(timeSeconds, targetRatio = 0.001) {
            const samples = timeSeconds * sampleRate;
            if (samples < 1) return 1;
            return 1 - Math.exp(-Math.log((1 + targetRatio) / targetRatio) / samples);
        }

        function calcAttackCoeff(timeSeconds) {
            const samples = timeSeconds * sampleRate;
            if (samples < 1) return 1;
            // The attack approaches 5.5V and changes stage at 5V. ln(11)
            // places that crossing at the selected stage time.
            return 1 - Math.exp(-Math.log(11) / samples);
        }

        return {
            params: { attack: 0.2, decay: 0.3, sustain: 0.7, release: 0.4 },
            inputs: {
                gate: gateInput,
                retrig: retrigInput,
                attackCV,
                decayCV,
                releaseCV
            },
            outputs: { env, inv, eoc },
            leds: { env: 0 },

            process() {
                const baseAttack = Number.isFinite(this.params.attack)
                    ? clamp(this.params.attack)
                    : 0.2;
                const baseDecay = Number.isFinite(this.params.decay)
                    ? clamp(this.params.decay)
                    : 0.3;
                const sustainLevel = (Number.isFinite(this.params.sustain)
                    ? clamp(this.params.sustain)
                    : 0.7) * 5;
                const baseRelease = Number.isFinite(this.params.release)
                    ? clamp(this.params.release)
                    : 0.4;

                for (let i = 0; i < bufferSize; i++) {
                    const gateVal = Number.isFinite(gateInput[i]) ? gateInput[i] : 0;
                    const retrigVal = Number.isFinite(retrigInput[i]) ? retrigInput[i] : 0;
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

                    // Per-sample CV modulation of times (±5V = ±0.5 range)
                    const attackCvValue = Number.isFinite(attackCV[i])
                        ? clamp(attackCV[i], -5, 5)
                        : 0;
                    const decayCvValue = Number.isFinite(decayCV[i])
                        ? clamp(decayCV[i], -5, 5)
                        : 0;
                    const releaseCvValue = Number.isFinite(releaseCV[i])
                        ? clamp(releaseCV[i], -5, 5)
                        : 0;
                    const attackMod = clamp(baseAttack + attackCvValue / 10, 0, 1);
                    const decayMod = clamp(baseDecay + decayCvValue / 10, 0, 1);
                    const releaseMod = clamp(baseRelease + releaseCvValue / 10, 0, 1);

                    const attackCoeff = calcAttackCoeff(knobToTime(attackMod, baseAttack));
                    const decayCoeff = calcCoeff(knobToTime(decayMod, baseDecay));
                    const releaseCoeff = calcCoeff(knobToTime(releaseMod, baseRelease));

                    let eocTrig = eocPulseSamples > 0 ? 10 : 0;
                    if (eocPulseSamples > 0) eocPulseSamples--;
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
                                eocTrig = 10;
                                eocPulseSamples = EOC_PULSE_SAMPLES - 1;
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
                eocPulseSamples = 0;
                gateInput.fill(0);
                retrigInput.fill(0);
                attackCV.fill(0);
                decayCV.fill(0);
                releaseCV.fill(0);
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
            { id: 'gate', label: 'Gate', port: 'gate', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'retrig', label: 'Retr', port: 'retrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'attackCV', label: 'Atk', port: 'attackCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'decayCV', label: 'Dec', port: 'decayCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'releaseCV', label: 'Rel', port: 'releaseCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'env', label: 'Env', port: 'env', signal: 'cv', voltage: { min: 0, max: 5 } },
            { id: 'inv', label: 'Inv', port: 'inv', signal: 'cv', voltage: { min: -5, max: 0 } },
            { id: 'eoc', label: 'EOC', port: 'eoc', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
