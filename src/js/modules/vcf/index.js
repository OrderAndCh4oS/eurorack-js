/**
 * VCF - Moog-style Transistor Ladder Filter
 *
 * 24dB/octave low-pass filter with resonance (self-oscillates)
 * Based on the classic transistor ladder topology
 */

import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

export default {
    id: 'vcf',
    name: 'VCF',
    hp: 4,
    color: '#4a6a8a',
    category: 'filter',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const lpf = new Float32Array(bufferSize);
        const bpf = new Float32Array(bufferSize);
        const hpf = new Float32Array(bufferSize);

        const ownAudio = new Float32Array(bufferSize);

        let stage = [0, 0, 0, 0];
        let delay = [0, 0, 0, 0];

        const cutoffSlew = createSlew({ sampleRate, timeMs: 2 });

        return {
            params: { cutoff: 0.5, resonance: 0.3 },
            inputs: {
                audio: ownAudio,
                cutoffCV: new Float32Array(bufferSize),
                resCV: new Float32Array(bufferSize)
            },
            outputs: { lpf, bpf, hpf },
            leds: { cutoff: 0 },

            clearAudioInputs() {
                ownAudio.fill(0);
                this.inputs.audio = ownAudio;
            },

            process() {
                const audioIn = this.inputs.audio;
                const cutoffCV = this.inputs.cutoffCV;
                const resCV = this.inputs.resCV;

                const cutoffKnob = clamp(this.params.cutoff);
                const cutoffHz = 20 * Math.pow(1000, cutoffKnob);
                const baseRes = this.params.resonance;

                for (let i = 0; i < bufferSize; i++) {
                    // Per-sample CV tracking for audio-rate filter modulation
                    const cvModVal = cutoffCV[i] || 0;
                    const cvMod = clamp(cvModVal, 0, 5) / 5;
                    const modulatedHz = cutoffHz * Math.pow(4, cvMod);

                    const resCVVal = resCV[i] || 0;
                    const res = clamp(baseRes + resCVVal / 10, 0, 1.1);
                    const k = res * 4;

                    const cutoffSmooth = cutoffSlew.process(modulatedHz);

                    const fc = clamp(cutoffSmooth / sampleRate, 0.0001, 0.45);
                    const g = Math.tan(Math.PI * fc);
                    const G = g / (1 + g);

                    // Resonance gain compensation - boost input to maintain level at high resonance
                    const compensation = 1 + k * 0.5;
                    const input = (audioIn[i] / 5) * compensation;
                    const feedback = delay[3];

                    const clipFeedback = Math.tanh(feedback * k);
                    const u = input - clipFeedback;

                    for (let p = 0; p < 4; p++) {
                        const prevStage = p === 0 ? u : stage[p - 1];
                        const v = G * (prevStage - delay[p]);
                        stage[p] = v + delay[p];
                        delay[p] = stage[p] + v;
                    }

                    lpf[i] = stage[3] * 5;
                    bpf[i] = (stage[1] - stage[3]) * 5;
                    hpf[i] = (u - stage[1]) * 5;
                }

                this.leds.cutoff = cutoffKnob;

                if (this.inputs.audio !== ownAudio) {
                    ownAudio.fill(0);
                    this.inputs.audio = ownAudio;
                }
            },

            reset() {
                stage = [0, 0, 0, 0];
                delay = [0, 0, 0, 0];
                lpf.fill(0);
                bpf.fill(0);
                hpf.fill(0);
                this.leds.cutoff = 0;
            }
        };
    },

    ui: {
        leds: ['cutoff'],
        knobs: [
            { id: 'cutoff', label: 'Freq', param: 'cutoff', min: 0, max: 1, default: 0.5 },
            { id: 'resonance', label: 'Res', param: 'resonance', min: 0, max: 1, default: 0.3 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', type: 'buffer' },
            { id: 'cutoffCV', label: 'Freq', port: 'cutoffCV', type: 'cv' },
            { id: 'resCV', label: 'Res', port: 'resCV', type: 'cv' }
        ],
        outputs: [
            { id: 'lpf', label: 'LP', port: 'lpf', type: 'buffer' },
            { id: 'bpf', label: 'BP', port: 'bpf', type: 'buffer' },
            { id: 'hpf', label: 'HP', port: 'hpf', type: 'buffer' }
        ]
    }
};
