import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

const DEFAULT_PARAMS = {
    vowel: 0.25,
    resonance: 0.55,
    shift: 0.5,
    drive: 0.25,
    mix: 1
};

const VOWEL_TARGETS = [
    [1000, 1400, 2700, 3600], // A
    [500, 2300, 3000, 3800],  // E
    [320, 3200, 3300, 4200],  // I
    [500, 1000, 2600, 3600],  // O
    [320, 800, 2400, 3500]    // U
];

const BAND_GAINS = [1.0, 0.8, 0.45, 0.25];
const MIN_FORMANT_HZ = 80;
const MAX_FORMANT_HZ = 8000;
const CONTROL_SLEW_MS = 5;
const WET_GAIN = 0.72;
const LIMIT_KNEE_VOLTS = 4.8;
const LIMIT_KNEE_WIDTH = 0.2;

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function interpolateLogFrequency(a, b, fraction) {
    return Math.exp(Math.log(a) * (1 - fraction) + Math.log(b) * fraction);
}

function softLimitVolts(value) {
    const v = finite(value);
    const abs = Math.abs(v);

    if (abs <= LIMIT_KNEE_VOLTS) return v;

    const limited = LIMIT_KNEE_VOLTS + LIMIT_KNEE_WIDTH * Math.tanh((abs - LIMIT_KNEE_VOLTS) / LIMIT_KNEE_WIDTH);
    return Math.sign(v) * limited;
}

export default {
    id: 'formant',
    name: 'FORMANT',
    hp: 6,
    color: 'module-color-ten',
    category: 'filter',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const ownAudio = new Float32Array(bufferSize);
        const z1 = new Float32Array(4);
        const z2 = new Float32Array(4);
        const vowelSlew = createSlew({ sampleRate, timeMs: CONTROL_SLEW_MS });
        const shiftSlew = createSlew({ sampleRate, timeMs: CONTROL_SLEW_MS });
        const resonanceSlew = createSlew({ sampleRate, timeMs: CONTROL_SLEW_MS });
        const ledDecay = Math.exp(-bufferSize / (sampleRate * 0.1));

        vowelSlew.reset(DEFAULT_PARAMS.vowel);
        shiftSlew.reset(0);
        resonanceSlew.reset(DEFAULT_PARAMS.resonance);

        function processBand(input, band, frequency, q) {
            const omega = 2 * Math.PI * frequency / sampleRate;
            const sin = Math.sin(omega);
            const cos = Math.cos(omega);
            const alpha = sin / (2 * q);
            const invA0 = 1 / (1 + alpha);
            const b0 = alpha * invA0;
            const b2 = -b0;
            const a1 = -2 * cos * invA0;
            const a2 = (1 - alpha) * invA0;

            const y = b0 * input + z1[band];
            z1[band] = -a1 * y + z2[band];
            z2[band] = b2 * input - a2 * y;

            if (!Number.isFinite(y) || !Number.isFinite(z1[band]) || !Number.isFinite(z2[band])) {
                z1[band] = 0;
                z2[band] = 0;
                return 0;
            }

            return y;
        }

        return {
            params: { ...DEFAULT_PARAMS },
            inputs: {
                audio: ownAudio,
                vowelCV: new Float32Array(bufferSize),
                shiftCV: new Float32Array(bufferSize),
                resCV: new Float32Array(bufferSize)
            },
            outputs: { out },
            leds: { level: 0 },

            process() {
                const audio = this.inputs.audio;
                const vowelCV = this.inputs.vowelCV;
                const shiftCV = this.inputs.shiftCV;
                const resCV = this.inputs.resCV;
                const vowelKnob = clamp(finite(this.params.vowel, DEFAULT_PARAMS.vowel));
                const resonanceKnob = clamp(finite(this.params.resonance, DEFAULT_PARAMS.resonance));
                const shiftKnob = clamp(finite(this.params.shift, DEFAULT_PARAMS.shift));
                const driveKnob = clamp(finite(this.params.drive, DEFAULT_PARAMS.drive));
                const mix = clamp(finite(this.params.mix, DEFAULT_PARAMS.mix));
                const driveGain = 0.75 + driveKnob * 2.25;
                const maxFormantHz = Math.max(MIN_FORMANT_HZ, Math.min(MAX_FORMANT_HZ, sampleRate * 0.45));
                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const dryVolts = finite(audio[i]);
                    const dry = dryVolts / 5;
                    const driven = Math.tanh(dry * driveGain);
                    const targetVowel = clamp(vowelKnob + finite(vowelCV[i]) / 5);
                    const targetShift = clamp((shiftKnob * 24 - 12) + finite(shiftCV[i]) / 5 * 12, -24, 24);
                    const targetResonance = clamp(resonanceKnob + finite(resCV[i]) / 5);
                    const smoothedVowel = clamp(vowelSlew.process(targetVowel));
                    const smoothedShift = clamp(shiftSlew.process(targetShift), -24, 24);
                    const smoothedResonance = clamp(resonanceSlew.process(targetResonance));
                    const q = 2 * Math.pow(9, smoothedResonance);
                    const vowelPosition = smoothedVowel * (VOWEL_TARGETS.length - 1);
                    const vowelIndex = Math.min(VOWEL_TARGETS.length - 2, Math.floor(vowelPosition));
                    const vowelFraction = vowelPosition - vowelIndex;
                    const lower = VOWEL_TARGETS[vowelIndex];
                    const upper = VOWEL_TARGETS[vowelIndex + 1];
                    const shiftRatio = 2 ** (smoothedShift / 12);
                    let wet = 0;

                    for (let band = 0; band < 4; band++) {
                        const baseFrequency = interpolateLogFrequency(lower[band], upper[band], vowelFraction);
                        const frequency = clamp(baseFrequency * shiftRatio, MIN_FORMANT_HZ, maxFormantHz);
                        wet += processBand(driven, band, frequency, q) * BAND_GAINS[band];
                    }

                    const compensatedWet = wet * WET_GAIN * (1 - smoothedResonance * 0.12);
                    const mixed = dry * (1 - mix) + compensatedWet * mix;
                    const sample = softLimitVolts(mixed * 5);
                    out[i] = sample;
                    peak = Math.max(peak, Math.abs(sample));
                }

                this.leds.level = Math.max(clamp(peak / 5), this.leds.level * ledDecay);
            },

            reset() {
                z1.fill(0);
                z2.fill(0);
                out.fill(0);
                ownAudio.fill(0);
                this.leds.level = 0;
                vowelSlew.reset(clamp(finite(this.params.vowel, DEFAULT_PARAMS.vowel)));
                shiftSlew.reset(clamp(finite(this.params.shift, DEFAULT_PARAMS.shift)) * 24 - 12);
                resonanceSlew.reset(clamp(finite(this.params.resonance, DEFAULT_PARAMS.resonance)));
            }
        };
    },

    ui: {
        leds: ['level'],
        knobs: [
            { id: 'vowel', label: 'Vowel', param: 'vowel', min: 0, max: 1, default: 0.25 },
            { id: 'resonance', label: 'Res', param: 'resonance', min: 0, max: 1, default: 0.55 },
            { id: 'shift', label: 'Shift', param: 'shift', min: 0, max: 1, default: 0.5 },
            { id: 'drive', label: 'Drive', param: 'drive', min: 0, max: 1, default: 0.25 },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 1 }
        ],
        inputs: [
            { id: 'audio', label: 'In', port: 'audio', signal: 'audio' },
            { id: 'vowelCV', label: 'Vowel', port: 'vowelCV', signal: 'cv' },
            { id: 'shiftCV', label: 'Shift', port: 'shiftCV', signal: 'cv' },
            { id: 'resCV', label: 'Res', port: 'resCV', signal: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', signal: 'audio' }
        ]
    }
};
