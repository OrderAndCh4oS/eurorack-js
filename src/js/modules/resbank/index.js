import { clamp, expMap } from '../../utils/math.js';
import { softLimitVoltage } from '../../utils/voltage.js';

const MAX_VOICES = 4;
const MAX_MODES = 60;
const TRIGGER_THRESHOLD = 1;
const MIN_FREQUENCY = 20;

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function voiceCount(param) {
    return [1, 2, 4][Math.round(clamp(finite(param), 0, 2))];
}

function modeCount(polyphony) {
    return polyphony === 1 ? 60 : polyphony === 2 ? 28 : 12;
}

function createVoice(sampleRate) {
    const maxDelay = Math.ceil(sampleRate / MIN_FREQUENCY) + 4;
    return {
        active: false,
        frequency: 110,
        modalY1: new Float64Array(MAX_MODES),
        modalY2: new Float64Array(MAX_MODES),
        modalA1: new Float64Array(MAX_MODES),
        modalA2: new Float64Array(MAX_MODES),
        modalGain: new Float64Array(MAX_MODES),
        modalCount: 0,
        delays: Array.from({ length: 4 }, () => new Float32Array(maxDelay)),
        writes: new Int32Array(4),
        losses: new Float64Array(4),
        dispersions: new Float64Array(4),
        lastEnergy: 0
    };
}

function clearVoice(voice) {
    voice.active = false;
    voice.frequency = 110;
    voice.modalY1.fill(0);
    voice.modalY2.fill(0);
    voice.modalA1.fill(0);
    voice.modalA2.fill(0);
    voice.modalGain.fill(0);
    voice.modalCount = 0;
    voice.delays.forEach(delay => delay.fill(0));
    voice.writes.fill(0);
    voice.losses.fill(0);
    voice.dispersions.fill(0);
    voice.lastEnergy = 0;
}

function readDelay(buffer, writeIndex, delaySamples) {
    let position = writeIndex - delaySamples;
    while (position < 0) position += buffer.length;
    const index = Math.floor(position) % buffer.length;
    const next = (index + 1) % buffer.length;
    const fraction = position - Math.floor(position);
    return buffer[index] + (buffer[next] - buffer[index]) * fraction;
}

function modalCoefficients(voice, sampleRate, frequency, structure, brightness, damping, position, resolution) {
    const decaySeconds = 0.08 * (125 ** clamp(damping));
    let count = 0;
    for (let mode = 0; mode < resolution; mode++) {
        const harmonic = mode + 1;
        const bend = (structure - 0.5) * harmonic * harmonic * 0.035;
        const ratio = Math.max(0.5, harmonic + bend);
        const partial = frequency * ratio;
        if (partial >= sampleRate * 0.45) break;
        const highLoss = 1 + mode * (1 - brightness) * 0.08;
        const radius = Math.exp(-1 / Math.max(1, decaySeconds * sampleRate / highLoss));
        voice.modalA1[mode] = 2 * radius * Math.cos(2 * Math.PI * partial / sampleRate);
        voice.modalA2[mode] = -(radius * radius);
        const pickup = Math.sin(Math.PI * harmonic * clamp(position, 0.02, 0.98));
        voice.modalGain[mode] = pickup * (0.15 + brightness * 0.85) ** (mode * 0.12) / Math.sqrt(resolution);
        count++;
    }
    return count;
}

function processModal(voice, input, modeIndex, modeTotal) {
    let odd = 0;
    let even = 0;
    for (let mode = 0; mode < modeTotal; mode++) {
        const y = voice.modalA1[mode] * voice.modalY1[mode] +
            voice.modalA2[mode] * voice.modalY2[mode] + input * voice.modalGain[mode];
        voice.modalY2[mode] = voice.modalY1[mode];
        voice.modalY1[mode] = finite(y);
        if (mode % 2 === 0) odd += y;
        else even += y;
    }
    voice.lastEnergy = voice.lastEnergy * 0.999 + (odd * odd + even * even) * 0.001;
    if (voice.lastEnergy < 1e-10 && modeIndex > 32) voice.active = false;
    return [odd, even];
}

function processStrings(voice, input, sampleRate, structure, brightness, damping, position, sympathetic) {
    const strings = sympathetic ? 4 : 1;
    let left = 0;
    let right = 0;
    for (let index = 0; index < strings; index++) {
        const ratios = sympathetic
            ? [1, 1.5 + structure * 0.5, 2 + structure, 3 + structure * 2]
            : [1];
        const frequency = clamp(voice.frequency * ratios[index], MIN_FREQUENCY, sampleRate * 0.4);
        const delay = clamp(sampleRate / frequency, 2, voice.delays[index].length - 2);
        const buffer = voice.delays[index];
        const writeIndex = voice.writes[index];
        let delayed = readDelay(buffer, writeIndex, delay);

        if (!sympathetic) {
            const dispersion = (structure - 0.5) * 0.75;
            const allpass = -dispersion * delayed + voice.dispersions[index];
            voice.dispersions[index] = delayed + dispersion * allpass;
            delayed = allpass;
        }

        const lossCutoff = 0.03 + brightness * 0.45;
        voice.losses[index] += (delayed - voice.losses[index]) * lossCutoff;
        const feedback = 0.86 + clamp(damping) * 0.135;
        const coupled = sympathetic && index > 0 ? left * (0.01 + position * 0.025) : 0;
        const excitation = index === 0 ? input : input * 0.15;
        buffer[writeIndex] = softLimitVoltage(excitation * 0.35 + voice.losses[index] * feedback + coupled, 5) / 5;
        voice.writes[index] = (writeIndex + 1) % buffer.length;

        const pickupOffset = clamp(delay * (0.15 + position * 0.7), 1, buffer.length - 2);
        const pickup = readDelay(buffer, voice.writes[index], pickupOffset);
        left += delayed / Math.sqrt(strings);
        right += (delayed - pickup * 0.7) / Math.sqrt(strings);
    }
    voice.lastEnergy = voice.lastEnergy * 0.999 + (left * left + right * right) * 0.001;
    return [left, right];
}

export default {
    id: 'resbank',
    name: 'RESBANK',
    hp: 14,
    color: 'module-color-three',
    category: 'filter',

    css: `
        .module-type-resbank .module-content {
            min-height: 0;
            gap: 3px;
            overflow: hidden;
        }
        .resbank-sockets {
            align-items: flex-start;
            gap: 8px;
            flex-shrink: 0;
        }
        .resbank-sockets .socket-column {
            flex: 1 1 0;
        }
        .resbank-sockets .socket-grid {
            gap: 3px;
        }
        .resbank-sockets .jack-container {
            min-width: 0;
            width: auto;
        }
        .resbank-sockets .jack {
            width: 22px;
            height: 22px;
        }
        .resbank-sockets .jack-label {
            font-size: 5px;
            white-space: nowrap;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const vOct = new Float32Array(bufferSize);
        const frequencyNormal = Math.fround(1 / 12);
        const frequencyCv = new Float32Array(bufferSize).fill(frequencyNormal);
        const structureCv = new Float32Array(bufferSize);
        const brightnessCv = new Float32Array(bufferSize);
        const dampingCv = new Float32Array(bufferSize);
        const positionCv = new Float32Array(bufferSize);
        const strum = new Float32Array(bufferSize);
        const audio = new Float32Array(bufferSize);
        const mix = new Float32Array(bufferSize);
        const odd = new Float32Array(bufferSize);
        const even = new Float32Array(bufferSize);
        const voices = Array.from({ length: MAX_VOICES }, () => createVoice(sampleRate));
        let activeVoice = -1;
        let lastStrum = 0;
        let lastPitch = 0;
        let pitchInitialized = false;
        let lastAudio = 0;
        let noiseState = 0x13579bdf;
        let excitationSamples = 0;
        let excitationVoice = 0;

        function random() {
            noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
            return noiseState / 0xffffffff * 2 - 1;
        }

        function allocate(frequency, polyphony) {
            activeVoice = (activeVoice + 1) % polyphony;
            const voice = voices[activeVoice];
            voice.active = true;
            voice.frequency = frequency;
            voice.lastEnergy = Math.max(voice.lastEnergy, 1e-5);
            voice.modalCount = 0;
            excitationVoice = activeVoice;
            excitationSamples = Math.max(1, Math.round(sampleRate * 0.004));
        }

        return {
            params: {
                frequency: 0.45,
                frequencyAmt: 0,
                structure: 0.35,
                structureAmt: 0,
                brightness: 0.6,
                brightnessAmt: 0,
                damping: 0.45,
                dampingAmt: 0,
                position: 0.35,
                positionAmt: 0,
                model: 0,
                polyphony: 0
            },
            inputs: { vOct, frequencyCv, structureCv, brightnessCv, dampingCv, positionCv, strum, audio },
            outputs: { mix, odd, even },
            leds: { model: 0, voice: 0 },

            process() {
                const model = Math.round(clamp(finite(this.params.model), 0, 2));
                const polyphony = voiceCount(this.params.polyphony);
                const resolution = modeCount(polyphony);
                const structure = clamp(finite(this.params.structure, 0.35) +
                    finite(this.inputs.structureCv[0]) / 5 * clamp(finite(this.params.structureAmt), -1, 1));
                const brightness = clamp(finite(this.params.brightness, 0.6) +
                    finite(this.inputs.brightnessCv[0]) / 5 * clamp(finite(this.params.brightnessAmt), -1, 1));
                const damping = clamp(finite(this.params.damping, 0.45) +
                    finite(this.inputs.dampingCv[0]) / 5 * clamp(finite(this.params.dampingAmt), -1, 1));
                const position = clamp(finite(this.params.position, 0.35) +
                    finite(this.inputs.positionCv[0]) / 5 * clamp(finite(this.params.positionAmt), -1, 1));

                const base = expMap(clamp(finite(this.params.frequency, 0.45)), 16.35, 523.25);
                const inputHasAudio = this.inputs.audio.some(value => Math.abs(finite(value)) > 1e-6);
                const explicitStrum = this.inputs.strum.some(value => finite(value) >= TRIGGER_THRESHOLD);

                if (model === 0) {
                    for (let voiceIndex = 0; voiceIndex < polyphony; voiceIndex++) {
                        const voice = voices[voiceIndex];
                        if (!voice.active) continue;
                        voice.modalCount = modalCoefficients(
                            voice, sampleRate, voice.frequency, structure, brightness, damping, position, resolution
                        );
                    }
                }

                for (let i = 0; i < bufferSize; i++) {
                    const pitchCv = finite(this.inputs.vOct[i]);
                    const fineCv = finite(this.inputs.frequencyCv[i], frequencyNormal) * clamp(finite(this.params.frequencyAmt), -1, 1);
                    const frequency = clamp(base * 2 ** clamp(pitchCv + fineCv, -8, 8), MIN_FREQUENCY, sampleRate * 0.4);
                    const strumValue = finite(this.inputs.strum[i]);
                    const rising = strumValue >= TRIGGER_THRESHOLD && lastStrum < TRIGGER_THRESHOLD;
                    const pitchStep = pitchInitialized && !explicitStrum && Math.abs(pitchCv - lastPitch) >= 1 / 24;
                    const input = finite(this.inputs.audio[i]);
                    const audioTransient = !explicitStrum && Math.abs(input) > 0.5 && Math.abs(lastAudio) <= 0.5;
                    if (rising || pitchStep || audioTransient) {
                        allocate(frequency, polyphony);
                        if (model === 0) {
                            const voice = voices[activeVoice];
                            voice.modalCount = modalCoefficients(
                                voice, sampleRate, voice.frequency, structure, brightness, damping, position, resolution
                            );
                        }
                    }
                    lastStrum = strumValue;
                    lastPitch = pitchCv;
                    pitchInitialized = true;
                    lastAudio = input;

                    let excitation = input;
                    if (!inputHasAudio && excitationSamples > 0) {
                        const envelope = excitationSamples / Math.max(1, Math.round(sampleRate * 0.004));
                        excitation = model === 0 ? envelope * 1.5 : random() * envelope * 1.2;
                        excitationSamples--;
                    }

                    let oddSample = 0;
                    let evenSample = 0;
                    for (let voiceIndex = 0; voiceIndex < polyphony; voiceIndex++) {
                        const voice = voices[voiceIndex];
                        if (!voice.active) continue;
                        const voiceInput = voiceIndex === excitationVoice ? excitation : 0;
                        let parts;
                        if (model === 0) {
                            parts = processModal(voice, voiceInput, voice.modalCount, voice.modalCount);
                        } else {
                            parts = processStrings(
                                voice, voiceInput, sampleRate, structure, brightness, damping, position, model === 1
                            );
                        }
                        oddSample += parts[0] / Math.sqrt(polyphony);
                        evenSample += parts[1] / Math.sqrt(polyphony);
                    }

                    odd[i] = softLimitVoltage(oddSample * 4, 5);
                    even[i] = softLimitVoltage(evenSample * 4, 5);
                    mix[i] = softLimitVoltage((oddSample + evenSample) * 3, 5);
                }

                this.leds.model = model / 2;
                this.leds.voice = activeVoice < 0 ? 0 : (activeVoice + 1) / polyphony;
            },

            getVoiceFrequencies() {
                return voices.map(voice => voice.frequency);
            },

            getActiveVoiceCount() {
                return voices.filter(voice => voice.active).length;
            },

            reset() {
                voices.forEach(clearVoice);
                activeVoice = -1;
                lastStrum = 0;
                lastPitch = 0;
                pitchInitialized = false;
                lastAudio = 0;
                noiseState = 0x13579bdf;
                excitationSamples = 0;
                excitationVoice = 0;
                mix.fill(0);
                odd.fill(0);
                even.fill(0);
                this.leds.model = 0;
                this.leds.voice = 0;
            }
        };
    },

    ui: {
        leds: ['model', 'voice'],
        knobs: [
            { id: 'frequency', label: 'Freq', param: 'frequency', min: 0, max: 1, default: 0.45 },
            { id: 'frequencyAmt', label: 'FM', param: 'frequencyAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'structure', label: 'Struct', param: 'structure', min: 0, max: 1, default: 0.35 },
            { id: 'structureAmt', label: 'S CV', param: 'structureAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'brightness', label: 'Bright', param: 'brightness', min: 0, max: 1, default: 0.6 },
            { id: 'brightnessAmt', label: 'B CV', param: 'brightnessAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'damping', label: 'Damp', param: 'damping', min: 0, max: 1, default: 0.45 },
            { id: 'dampingAmt', label: 'D CV', param: 'dampingAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'position', label: 'Pos', param: 'position', min: 0, max: 1, default: 0.35 },
            { id: 'positionAmt', label: 'P CV', param: 'positionAmt', min: -1, max: 1, default: 0, small: true }
        ],
        buttons: [
            { id: 'model', label: 'Model', param: 'model', values: [0, 1, 2], default: 0 },
            { id: 'polyphony', label: 'Poly', param: 'polyphony', values: [0, 1, 2], default: 0 }
        ],
        inputs: [
            { id: 'vOct', label: 'V/Oct', port: 'vOct', signal: 'cv' },
            { id: 'frequencyCv', label: 'Freq', port: 'frequencyCv', signal: 'cv', voltage: { min: -5, max: 5, normal: Math.fround(1 / 12) } },
            { id: 'structureCv', label: 'Struct', port: 'structureCv', signal: 'cv' },
            { id: 'brightnessCv', label: 'Bright', port: 'brightnessCv', signal: 'cv' },
            { id: 'dampingCv', label: 'Damp', port: 'dampingCv', signal: 'cv' },
            { id: 'positionCv', label: 'Pos', port: 'positionCv', signal: 'cv' },
            { id: 'strum', label: 'Strum', port: 'strum', signal: 'trigger' },
            { id: 'audio', label: 'In', port: 'audio', signal: 'audio' }
        ],
        outputs: [
            { id: 'mix', label: 'Mix', port: 'mix', signal: 'audio' },
            { id: 'odd', label: 'Odd', port: 'odd', signal: 'audio' },
            { id: 'even', label: 'Even', port: 'even', signal: 'audio' }
        ],
        socketLayout: {
            label: 'I/O',
            className: 'resbank-sockets',
            columns: [
                { label: 'Out', ports: ['mix', 'odd', 'even'], columns: 3 },
                {
                    label: 'CV',
                    ports: ['vOct', 'frequencyCv', 'structureCv', 'brightnessCv', 'dampingCv', 'positionCv'],
                    columns: 6
                },
                { label: 'Excite', ports: ['strum', 'audio'], columns: 2 }
            ]
        }
    }
};
