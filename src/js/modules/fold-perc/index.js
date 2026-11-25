import { clamp } from '../../utils/math.js';
import { polyBlep, wrapPhase } from '../../utils/oscillator.js';

const defaults = {
    pitch: 0.25, attack: 0.5, decay: 0.45, morph: 0, harmonic: 0.35,
    spread: 0, fold: 0.15, mode: 0, range: 0, hit: 0
};
const timbre = ['attack', 'decay', 'morph', 'harmonic', 'spread', 'fold'];
const partialLevels = [1, 0.74, 0.52, 0.42, 0.34, 0.29];
const primeRatios = [1, 3, 5, 7, 11, 13];
const operators = partialLevels.length;
const noiseSeed = 0x42d0a531;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const modulate = (knob, cv) => clamp(knob + clamp(finite(cv), 0, 5) / 5);
const middleBand = Math.fround(5 / 3);
const highBand = Math.fround(10 / 3);

function select(knob, cv) {
    const volts = finite(cv);
    return Math.min(2, knob + Number(volts >= middleBand) + Number(volts >= highBand));
}

function wave(phase, increment, morph) {
    const sine = Math.sin(2 * Math.PI * phase);
    if (morph === 0) return sine;
    const position = 3 * morph;
    const half = wrapPhase(phase + 0.5);
    const triangle = 1 - 4 * Math.abs(wrapPhase(phase + 0.25) - 0.5);
    let shaped;
    if (position <= 1) {
        shaped = sine + position * (triangle - sine);
    } else {
        const dt = Math.abs(increment);
        const edge = polyBlep(half, dt);
        const saw = 2 * half - 1 - edge;
        if (position <= 2) {
            shaped = triangle + (position - 1) * (saw - triangle);
        } else {
            const square = (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - edge;
            shaped = saw + (position - 2) * (square - saw);
        }
    }
    // At high pitches only the first few harmonics fit in the host bandwidth.
    return shaped + clamp((Math.abs(increment) - 0.12) / 0.24) * (sine - shaped);
}

// Reflections have a four-unit period. Integrate the piecewise-linear transfer,
// including a narrow bipolar pulse at its extrema, for first-order ADAA.
function reflection(x, buzz, integrated) {
    const u = x + 1 - 4 * Math.floor((x + 1) / 4);
    const tri = 1 - Math.abs(u - 2);
    const tip = Math.max(0, Math.abs(tri) - 0.76);
    if (!integrated) return (tri + buzz * Math.sign(tri) * tip / 0.24) / (1 + buzz);
    const primitive = 0.5 * tri * tri;
    const pulsePrimitive = tip * tip / 0.48;
    return u < 2
        ? (primitive + buzz * pulsePrimitive) / (1 + buzz)
        : (1 - primitive + buzz * (0.24 - pulsePrimitive)) / (1 + buzz);
}

function input(port, label, max = 5, signal = 'cv') {
    return { id: port, port, label, signal, voltage: { min: 0, max, normal: 0 } };
}

function title(name) {
    return name[0].toUpperCase() + name.slice(1);
}

const inputs = [
    input('trigger', 'Trig', 10, 'trigger'),
    input('pitchCV', 'V/Oct', 8),
    ...timbre.map(name => input(name + 'CV', title(name))),
    input('modeCV', 'S/L/M'), input('rangeCV', 'B/A/T')
];

export default {
    id: 'fold-perc',
    name: 'FOLD PERC',
    hp: 16,
    color: 'module-color-seven',
    category: 'voice',
    css: `
        .module-type-fold-perc .jack-row:has(.knob) {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            width: 90%;
            row-gap: 6px;
        }
        .module-type-fold-perc .knob-container:has([data-param="morph"]) {
            grid-column: 1;
        }
        .module-type-fold-perc .knob-label,
        .module-type-fold-perc .jack-label,
        .module-type-fold-perc .socket-column-label {
            font-size: 8px;
        }
        .module-type-fold-perc .fold-perc-jacks {
            display: grid;
            grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
            width: 94%;
        }
        .module-type-fold-perc .socket-grid {
            width: 100%;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ports = Object.fromEntries(inputs.map(({ port }) => [port, new Float32Array(bufferSize)]));
        const out = new Float32Array(bufferSize);
        const leds = { active: 0 };
        const phases = new Float64Array(operators);
        const levels = new Float64Array(operators);
        const envelopes = new Float64Array(operators);
        const partialDecay = new Float64Array(operators);
        const ledDuration = Math.round(0.05 * sampleRate);
        const transitionLength = Math.max(1, Math.round(0.0008 * sampleRate));
        const pitchDecay = Math.exp(-1 / (0.025 * sampleRate));
        const noiseDecay = Math.exp(-1 / (0.009 * sampleRate));

        let halfEnvelope = 0;
        let halfDecay = 0;
        let noiseEnvelope = 0;
        let sweep = 0;
        let randomState = noiseSeed;
        let age = 0;
        let ledSamples = 0;
        let lastTrig = false;
        let lastHit = false;
        let lastOutput = 0;
        let transitionFrom = 0;
        let transitionLeft = 0;
        let previousDriven = 0;
        let cachedPitch = NaN;
        let baseStep = 0;
        let cachedHarmonic = NaN;
        let cachedDecay = NaN;
        let levelSum = 1;

        function setEnvelopeRates(harmonic, decay) {
            if (harmonic !== cachedHarmonic) {
                levels[0] = 1;
                levelSum = 1;
                for (let op = 1; op < operators; op++) {
                    const gain = op === 1 ? clamp(4 * harmonic) : clamp((harmonic - 0.25) * 2 - (op - 2) * 0.1);
                    levels[op] = partialLevels[op] * gain;
                    levelSum += levels[op];
                }
            }
            // The two identical body envelopes multiply to -60 dB at duration.
            const duration = 0.06 * Math.pow(40, decay);
            const exponent = Math.log(0.001) / (duration * sampleRate);
            halfDecay = Math.exp(0.5 * exponent);
            const perPartial = Math.exp(exponent * (1.7 - 1.45 * harmonic));
            partialDecay[0] = 1;
            for (let op = 1; op < operators; op++) partialDecay[op] = partialDecay[op - 1] * perPartial;
            cachedDecay = decay;
            cachedHarmonic = harmonic;
        }

        function strike() {
            transitionFrom = lastOutput;
            transitionLeft = halfEnvelope > 0 ? transitionLength : 0;
            halfEnvelope = 1;
            noiseEnvelope = 1;
            sweep = 1;
            age = 0;
            phases.fill(0);
            envelopes.fill(1);
            previousDriven = 0;
            ledSamples = ledDuration;
        }

        return {
            params: { ...defaults },
            inputs: ports,
            outputs: { out },
            leds,

            process() {
                const p = this.params;
                const pitch = clamp(finite(p.pitch, defaults.pitch));
                const attackKnob = clamp(finite(p.attack, defaults.attack));
                const decayKnob = clamp(finite(p.decay, defaults.decay));
                const harmonicKnob = clamp(finite(p.harmonic, defaults.harmonic));
                const spreadKnob = clamp(finite(p.spread));
                const morphKnob = clamp(finite(p.morph));
                const foldKnob = clamp(finite(p.fold, defaults.fold));
                const modeKnob = clamp(Math.round(finite(p.mode)), 0, 2);
                const rangeKnob = clamp(Math.round(finite(p.range)), 0, 2);
                const hit = p.hit >= 0.5;

                for (let i = 0; i < bufferSize; i++) {
                    const trig = finite(ports.trigger[i]) >= 3;
                    if ((trig && !lastTrig) || (hit && !lastHit)) strike();
                    lastTrig = trig;
                    lastHit = hit;
                    if (ledSamples > 0) ledSamples--;
                    if (halfEnvelope === 0) {
                        out[i] = 0;
                        continue;
                    }
                    const mode = select(modeKnob, ports.modeCV[i]);
                    const range = select(rangeKnob, ports.rangeCV[i]);
                    const octaves = 4 * pitch + 2 * range + clamp(finite(ports.pitchCV[i]), 0, 8);
                    if (octaves !== cachedPitch) {
                        baseStep = 27.5 * Math.pow(2, octaves) / sampleRate;
                        cachedPitch = octaves;
                    }
                    const fundamental = Math.min(0.4, baseStep * (mode === 1 ? 1 + 3 * sweep : 1));
                    const decay = modulate(decayKnob, ports.decayCV[i]);
                    const harmonic = modulate(harmonicKnob, ports.harmonicCV[i]);
                    const morph = modulate(morphKnob, ports.morphCV[i]);
                    const spread = modulate(spreadKnob, ports.spreadCV[i]);
                    if (decay !== cachedDecay || harmonic !== cachedHarmonic) setEnvelopeRates(harmonic, decay);

                    let sum = 0;
                    let modulator = 0;
                    // The higher operator's enveloped audio linearly displaces
                    // its neighbor's frequency; all six taps also reach the mix.
                    for (let op = operators - 1; op >= 0; op--) {
                        const ratio = op + 1 + spread * (primeRatios[op] - op - 1);
                        const nominal = fundamental * ratio;
                        const bandGain = op === 0 ? 1 : clamp((0.46 - nominal) / 0.14);
                        const shift = mode === 2 ? 2.4 * modulator * halfEnvelope : 0;
                        const increment = clamp(nominal * (1 + shift), -0.46, 0.46);
                        phases[op] = wrapPhase(phases[op] + increment);
                        modulator = 0;
                        if (bandGain > 0 && levels[op] > 0) {
                            modulator = wave(phases[op], increment, morph) * levels[op] * envelopes[op] * bandGain;
                            sum += modulator;
                        }
                        envelopes[op] *= partialDecay[op];
                    }
                    let mix = sum / levelSum;
                    const attack = modulate(attackKnob, ports.attackCV[i]);
                    if (attack < 0.5 && noiseEnvelope > 1e-6) {
                        randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
                        const noise = randomState / 2147483648 - 1;
                        const noiseLevel = (0.5 - attack) * 1.4 * noiseEnvelope;
                        mix += noiseLevel * (noise - mix);
                    }
                    const soft = Math.max(0, 2 * attack - 1);
                    const onset = Math.min(1, (age + 1) / (sampleRate * (0.0005 + 0.0995 * soft * soft)));
                    const dry = mix * onset * halfEnvelope;
                    const fold = modulate(foldKnob, ports.foldCV[i]);
                    const driven = dry * (1 + 6 * Math.min(fold / 0.75, 1));
                    let shaped = dry;
                    if (fold > 0) {
                        const buzz = 0.9 * Math.max(0, 4 * fold - 3);
                        const delta = driven - previousDriven;
                        const folded = Math.abs(delta) > 1e-6
                            ? (reflection(driven, buzz, true) - reflection(previousDriven, buzz, true)) / delta
                            : reflection((driven + previousDriven) / 2, buzz, false);
                        shaped += Math.min(1, fold * 12) * (folded - dry);
                    }
                    previousDriven = driven;
                    let value = 5 * shaped * halfEnvelope;
                    if (transitionLeft > 0) {
                        value += (transitionFrom - value) * transitionLeft / transitionLength;
                        transitionLeft--;
                    }
                    out[i] = lastOutput = clamp(value, -5, 5);
                    age++;
                    halfEnvelope *= halfDecay;
                    if (halfEnvelope < 1e-5) halfEnvelope = 0;
                    sweep *= pitchDecay;
                    noiseEnvelope *= noiseDecay;
                }
                leds.active = ledSamples > 0 ? 1 : 0;
            },

            reset() {
                for (const port of Object.values(ports)) port.fill(0);
                out.fill(0);
                phases.fill(0);
                envelopes.fill(0);
                halfEnvelope = 0;
                noiseEnvelope = 0;
                sweep = 0;
                age = 0;
                randomState = noiseSeed;
                ledSamples = 0;
                lastTrig = false;
                lastHit = false;
                lastOutput = 0;
                transitionFrom = 0;
                transitionLeft = 0;
                previousDriven = 0;
                cachedPitch = cachedHarmonic = cachedDecay = NaN;
                this.params.hit = 0;
                leds.active = 0;
            }
        };
    },

    ui: {
        leds: ['active'],
        knobs: ['pitch', 'attack', 'decay', 'morph', 'harmonic', 'spread', 'fold'].map(name => ({
            id: name, param: name, label: title(name), min: 0, max: 1, default: defaults[name], small: true
        })),
        switches: [
            { id: 'mode', param: 'mode', label: 'Mode', positions: ['Skin', 'Liquid', 'Metal'], default: 0 },
            { id: 'range', param: 'range', label: 'Range', positions: ['Bass', 'Alto', 'Treble'], default: 0 }
        ],
        actions: [{ id: 'hit', param: 'hit', label: 'Hit', mode: 'trigger', default: 0 }],
        inputs,
        outputs: [{ id: 'out', port: 'out', label: 'Out', signal: 'audio', voltage: { min: -5, max: 5 } }],
        socketLayout: {
            className: 'fold-perc-jacks',
            columns: [
                { label: 'CV In', columns: 3, ports: ['pitchCV', 'attackCV', 'decayCV', 'morphCV', 'harmonicCV', 'spreadCV', 'foldCV', 'modeCV', 'rangeCV'] },
                { label: 'Strike / Audio', columns: 1, ports: ['trigger', 'out'] }
            ]
        }
    }
};
