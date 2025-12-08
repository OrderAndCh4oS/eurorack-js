/**
 * PHASER - Phaser Effect
 *
 * Creates sweeping notches using cascaded allpass filters with LFO modulation.
 * Classic phasing sound with adjustable rate, depth, and feedback.
 *
 * Features:
 * - Rate knob (LFO speed)
 * - Depth knob (sweep range)
 * - Feedback knob (resonance)
 * - Mix knob (dry/wet balance)
 * - Stereo inputs/outputs
 * - LFO LED indicator
 */

// Number of allpass stages (more stages = more notches)
const NUM_STAGES = 6;

export default {
    id: 'phaser',
    name: 'PHASER',
    hp: 6,
    color: '#7b6b9f',
    category: 'effect',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        // Allpass filter states for L and R channels
        const allpassStatesL = [];
        const allpassStatesR = [];
        for (let i = 0; i < NUM_STAGES; i++) {
            allpassStatesL.push({ x1: 0, y1: 0 });
            allpassStatesR.push({ x1: 0, y1: 0 });
        }

        // Feedback state
        let feedbackL = 0;
        let feedbackR = 0;

        // LFO state
        let lfoPhase = 0;

        // Frequency range for sweep (Hz)
        const MIN_FREQ = 200;
        const MAX_FREQ = 4000;

        return {
            params: {
                rate: 0.3,      // 0-1 (maps to 0.1-5 Hz)
                depth: 0.7,     // 0-1 (sweep range)
                feedback: 0.5,  // 0-1 (resonance)
                mix: 0.5        // 0-1 (dry/wet)
            },

            inputs: {
                inL: new Float32Array(bufferSize),
                inR: new Float32Array(bufferSize)
            },

            outputs: {
                outL,
                outR
            },

            leds: {
                lfo: 0
            },

            process() {
                const { rate, depth, feedback, mix } = this.params;
                const inL = this.inputs.inL;
                const inR = this.inputs.inR;

                // Map rate to Hz (0.1-5 Hz)
                const lfoFreq = 0.1 + rate * 4.9;
                const phaseIncrement = (2 * Math.PI * lfoFreq) / sampleRate;

                // Map feedback (limit to prevent instability)
                const fb = feedback * 0.9;

                for (let i = 0; i < bufferSize; i++) {
                    // Calculate LFO (0 to 1 range)
                    const lfoValue = (Math.sin(lfoPhase) + 1) / 2;

                    // Calculate allpass coefficient based on LFO
                    // Exponential frequency sweep
                    const freqRatio = Math.pow(MAX_FREQ / MIN_FREQ, lfoValue * depth);
                    const freq = MIN_FREQ * freqRatio;

                    // First-order allpass coefficient
                    const tanVal = Math.tan(Math.PI * freq / sampleRate);
                    const coef = (tanVal - 1) / (tanVal + 1);

                    // Input with feedback
                    let wetL = inL[i] + feedbackL * fb;
                    let wetR = inR[i] + feedbackR * fb;

                    // Process through allpass chain
                    for (let s = 0; s < NUM_STAGES; s++) {
                        wetL = processAllpass(wetL, allpassStatesL[s], coef);
                        wetR = processAllpass(wetR, allpassStatesR[s], coef);
                    }

                    // Store feedback
                    feedbackL = wetL;
                    feedbackR = wetR;

                    // Mix dry and wet
                    outL[i] = inL[i] * (1 - mix) + wetL * mix;
                    outR[i] = inR[i] * (1 - mix) + wetR * mix;

                    // Advance LFO phase
                    lfoPhase += phaseIncrement;
                    if (lfoPhase >= 2 * Math.PI) {
                        lfoPhase -= 2 * Math.PI;
                    }
                }

                // Update LED
                this.leds.lfo = (Math.sin(lfoPhase) + 1) / 2;
            },

            reset() {
                for (let i = 0; i < NUM_STAGES; i++) {
                    allpassStatesL[i].x1 = 0;
                    allpassStatesL[i].y1 = 0;
                    allpassStatesR[i].x1 = 0;
                    allpassStatesR[i].y1 = 0;
                }
                feedbackL = 0;
                feedbackR = 0;
                lfoPhase = 0;
                outL.fill(0);
                outR.fill(0);
                this.leds.lfo = 0;
            }
        };

        // First-order allpass filter
        function processAllpass(x, state, coef) {
            const y = coef * x + state.x1 - coef * state.y1;
            state.x1 = x;
            state.y1 = y;
            return y;
        }
    },

    ui: {
        leds: ['lfo'],
        knobs: [
            { id: 'rate', label: 'Rate', param: 'rate', min: 0, max: 1, default: 0.3 },
            { id: 'depth', label: 'Depth', param: 'depth', min: 0, max: 1, default: 0.7 },
            { id: 'feedback', label: 'Fdbk', param: 'feedback', min: 0, max: 1, default: 0.5 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 0.5 }
        ],
        switches: [],
        inputs: [
            { id: 'inL', label: 'In L', port: 'inL', type: 'audio' },
            { id: 'inR', label: 'In R', port: 'inR', type: 'audio' }
        ],
        outputs: [
            { id: 'outL', label: 'Out L', port: 'outL', type: 'audio' },
            { id: 'outR', label: 'Out R', port: 'outR', type: 'audio' }
        ]
    }
};
