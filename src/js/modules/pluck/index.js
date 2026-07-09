/**
 * PLUCK - Four-voice plucked string voice
 *
 * Inspired by 2hp Pluck's Karplus-Strong voice contract:
 * trigger-created four-voice overlap, 1V/oct pitch, sampled damp/decay,
 * and 10Vpp audio output. The position control is an app adaptation from
 * extended Karplus-Strong / Rings-style pick-position controls.
 */

import { clamp } from '../../utils/math.js';

const VOICE_COUNT = 4;
const PITCH_MIN_HZ = 55;
const PITCH_OCTAVES = 5;
const MIN_FREQ_HZ = 20;
const QUIET_THRESHOLD = 1e-5;
const QUIET_SAMPLES = 4096;
const MAX_VOCT = 8;
const MIN_VOCT = -8;

function nextPowerOfTwo(value) {
    let size = 1;
    while (size < value) size *= 2;
    return size;
}

function safeFinite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function paramWithBipolarCv(param, cv) {
    return clamp(safeFinite(param) + safeFinite(cv) / 5, 0, 1);
}

function pitchToFrequency(pitch, vOct, sampleRate) {
    const base = PITCH_MIN_HZ * Math.pow(2, clamp(safeFinite(pitch), 0, 1) * PITCH_OCTAVES);
    const octaveOffset = clamp(safeFinite(vOct), MIN_VOCT, MAX_VOCT);
    return clamp(base * Math.pow(2, octaveOffset), MIN_FREQ_HZ, sampleRate * 0.25);
}

function decayToSeconds(decay) {
    return 0.04 * Math.pow(300, clamp(decay, 0, 1));
}

function createVoice(delayBufferSize) {
    return {
        active: false,
        buffer: new Float32Array(delayBufferSize),
        writeIndex: 0,
        delaySamples: 0,
        frequency: 0,
        decay: 0,
        decaySeconds: 0,
        damp: 0,
        position: 0.5,
        loopGain: 0,
        dampingCoeff: 0,
        dampingState: 0,
        energy: 0,
        quietSamples: 0,
        ageSamples: 0
    };
}

export default {
    id: 'pluck',
    name: 'PLUCK',
    hp: 6,
    color: 'module-color-eight',
    category: 'voice',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const leds = { active: 0 };
        const delayBufferSize = nextPowerOfTwo(Math.ceil(sampleRate / MIN_FREQ_HZ) + 8);
        const voices = Array.from({ length: VOICE_COUNT }, () => createVoice(delayBufferSize));

        let lastTrigger = 0;
        let nextVoiceIndex = 0;
        let latestVoiceIndex = -1;
        let noiseSeed = 0x1234abcd;
        let dcX1 = 0;
        let dcY1 = 0;

        const ledDecay = Math.exp(-bufferSize / (sampleRate * 0.18));

        function randomBipolar() {
            noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
            return noiseSeed / 0x80000000 - 1;
        }

        function setVoicePitch(voice, frequency) {
            voice.frequency = clamp(safeFinite(frequency, PITCH_MIN_HZ), MIN_FREQ_HZ, sampleRate * 0.25);
            voice.delaySamples = clamp(sampleRate / voice.frequency, 2.5, delayBufferSize - 4);
            voice.loopGain = clamp(
                Math.exp(-voice.delaySamples / (voice.decaySeconds * sampleRate)),
                0,
                0.99995
            );
        }

        function readDelay(voice, delaySamples) {
            let readPos = voice.writeIndex - delaySamples;
            while (readPos < 0) readPos += delayBufferSize;
            while (readPos >= delayBufferSize) readPos -= delayBufferSize;

            const index0 = Math.floor(readPos);
            const index1 = (index0 + 1) & (delayBufferSize - 1);
            const frac = readPos - index0;
            return voice.buffer[index0] * (1 - frac) + voice.buffer[index1] * frac;
        }

        function deactivateVoice(voice) {
            voice.active = false;
            voice.buffer.fill(0);
            voice.writeIndex = 0;
            voice.delaySamples = 0;
            voice.frequency = 0;
            voice.energy = 0;
            voice.quietSamples = 0;
            voice.ageSamples = 0;
            voice.dampingState = 0;
        }

        function triggerVoice(params, vOct, decayCV, dampCV, positionCV) {
            const voice = voices[nextVoiceIndex];

            voice.buffer.fill(0);
            voice.active = true;
            voice.decay = paramWithBipolarCv(params.decay, decayCV);
            voice.decaySeconds = decayToSeconds(voice.decay);
            voice.damp = paramWithBipolarCv(params.damp, dampCV);
            voice.position = clamp(paramWithBipolarCv(params.position, positionCV), 0.02, 0.98);
            voice.dampingCoeff = 0.035 + Math.pow(voice.damp, 1.45) * 0.89;
            voice.dampingState = 0;
            voice.energy = 1;
            voice.quietSamples = 0;
            voice.ageSamples = 0;

            setVoicePitch(voice, pitchToFrequency(params.pitch, vOct, sampleRate));

            const excitationLength = Math.min(delayBufferSize - 4, Math.ceil(voice.delaySamples) + 2);
            const pickOffset = Math.max(1, Math.floor(excitationLength * voice.position));
            const excitationCoeff = 0.045 + Math.pow(voice.damp, 1.35) * 0.82;
            const amplitude = 0.42 + voice.damp * 0.16;
            let excitationState = 0;

            for (let i = 0; i < excitationLength; i++) {
                excitationState += excitationCoeff * (randomBipolar() - excitationState);
                const pickTap = i >= pickOffset ? voice.buffer[i - pickOffset] : 0;
                const envelope = Math.sin(Math.PI * (i + 0.5) / excitationLength);
                voice.buffer[i] = (excitationState - pickTap * 0.55) * envelope * amplitude;
            }

            voice.writeIndex = excitationLength & (delayBufferSize - 1);
            latestVoiceIndex = nextVoiceIndex;
            nextVoiceIndex = (nextVoiceIndex + 1) % VOICE_COUNT;
        }

        function processVoice(voice, voiceIndex, params, vOct) {
            if (!voice.active) return 0;

            if (voiceIndex === latestVoiceIndex) {
                setVoicePitch(voice, pitchToFrequency(params.pitch, vOct, sampleRate));
            }

            const main = readDelay(voice, voice.delaySamples);
            const tapDelay = clamp(voice.delaySamples * voice.position, 1.5, voice.delaySamples - 1);
            const positionTap = readDelay(voice, tapDelay);
            const bridgeTap = readDelay(voice, clamp(voice.delaySamples * 0.5, 1.5, voice.delaySamples - 1));

            voice.dampingState += voice.dampingCoeff * (main - voice.dampingState);
            const feedback = voice.dampingState * voice.loopGain;
            voice.buffer[voice.writeIndex] = safeFinite(feedback);
            voice.writeIndex = (voice.writeIndex + 1) & (delayBufferSize - 1);

            const positionColor = main - positionTap * 0.42;
            const bodyColor = positionColor * 0.82 + bridgeTap * 0.18;
            const sample = safeFinite(bodyColor);

            voice.energy = Math.max(Math.abs(sample), voice.energy * 0.9995);
            voice.quietSamples = voice.energy < QUIET_THRESHOLD ? voice.quietSamples + 1 : 0;
            voice.ageSamples++;

            if (voice.quietSamples > QUIET_SAMPLES || voice.ageSamples > sampleRate * 30) {
                deactivateVoice(voice);
            }

            return sample;
        }

        return {
            params: {
                pitch: 0.4,
                decay: 0.65,
                damp: 0.65,
                position: 0.35
            },

            inputs: {
                trigger: new Float32Array(bufferSize),
                vOct: new Float32Array(bufferSize),
                decayCV: new Float32Array(bufferSize),
                dampCV: new Float32Array(bufferSize),
                positionCV: new Float32Array(bufferSize)
            },

            outputs: { out },
            leds,

            process() {
                const trigger = this.inputs.trigger;
                const vOct = this.inputs.vOct;
                const decayCV = this.inputs.decayCV;
                const dampCV = this.inputs.dampCV;
                const positionCV = this.inputs.positionCV;
                const params = this.params;
                let peak = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const trig = safeFinite(trigger[i]);
                    if (trig >= 1 && lastTrigger < 1) {
                        triggerVoice(params, vOct[i], decayCV[i], dampCV[i], positionCV[i]);
                    }
                    lastTrigger = trig;

                    let mix = 0;
                    for (let voiceIndex = 0; voiceIndex < VOICE_COUNT; voiceIndex++) {
                        mix += processVoice(voices[voiceIndex], voiceIndex, params, vOct[i]);
                    }

                    const dcBlocked = mix - dcX1 + 0.995 * dcY1;
                    dcX1 = mix;
                    dcY1 = dcBlocked;

                    const sample = 5 * Math.tanh(dcBlocked * 0.72);
                    out[i] = safeFinite(sample);
                    peak = Math.max(peak, Math.abs(out[i]));
                }

                leds.active = clamp(Math.max(peak / 5, leds.active * ledDecay), 0, 1);
            },

            reset() {
                out.fill(0);
                voices.forEach(deactivateVoice);
                lastTrigger = 0;
                nextVoiceIndex = 0;
                latestVoiceIndex = -1;
                noiseSeed = 0x1234abcd;
                dcX1 = 0;
                dcY1 = 0;
                leds.active = 0;
            },

            getDebugState() {
                return {
                    activeVoiceCount: voices.filter(voice => voice.active).length,
                    latestVoiceIndex,
                    nextVoiceIndex,
                    voices: voices.map(voice => ({
                        active: voice.active,
                        frequency: voice.frequency,
                        delaySamples: voice.delaySamples,
                        decay: voice.decay,
                        damp: voice.damp,
                        position: voice.position,
                        energy: voice.energy,
                        ageSamples: voice.ageSamples
                    }))
                };
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: [
            { id: 'pitch', label: 'Pitch', param: 'pitch', min: 0, max: 1, default: 0.4 },
            { id: 'decay', label: 'Decay', param: 'decay', min: 0, max: 1, default: 0.65 },
            { id: 'damp', label: 'Damp', param: 'damp', min: 0, max: 1, default: 0.65 },
            { id: 'position', label: 'Pos', param: 'position', min: 0, max: 1, default: 0.35 }
        ],
        inputs: [
            { id: 'trigger', label: 'Trig', port: 'trigger', type: 'trigger' },
            { id: 'vOct', label: 'V/O', port: 'vOct', type: 'cv' },
            { id: 'decayCV', label: 'Dcy', port: 'decayCV', type: 'cv' },
            { id: 'dampCV', label: 'Dmp', port: 'dampCV', type: 'cv' },
            { id: 'positionCV', label: 'Pos', port: 'positionCV', type: 'cv' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
