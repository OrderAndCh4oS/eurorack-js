/**
 * LPG - Low Pass Gate
 *
 * Single-channel, vactrol-inspired low pass gate. It combines an asymmetric
 * pluck/opening response with VCA, low-pass, and combined LPG modes.
 */

import { clamp } from '../../utils/math.js';

const STRIKE_THRESHOLD = 1;
const OUTPUT_LIMIT = 5;
const MODE_LABELS = [
    { value: 0, label: 'VCA' },
    { value: 1, label: 'COMBO' },
    { value: 2, label: 'LP' }
];

const LPG_UI = {
    leds: ['open'],
    knobs: [
        { id: 'level', label: 'Level', param: 'level', min: 0, max: 1, default: 0 },
        { id: 'damp', label: 'Damp', param: 'damp', min: 0, max: 1, default: 0.35 },
        { id: 'tone', label: 'Tone', param: 'tone', min: 0, max: 1, default: 0.65 },
        { id: 'resonance', label: 'Res', param: 'resonance', min: 0, max: 1, default: 0 }
    ],
    buttons: [
        { id: 'mode', label: 'Mode', param: 'mode', values: [0, 1, 2], default: 1 }
    ],
    inputs: [
        { id: 'audio', label: 'In', port: 'audio', signal: 'audio' },
        { id: 'cv', label: 'CV', port: 'cv', signal: 'cv' },
        { id: 'strike', label: 'Strike', port: 'strike', signal: 'trigger' },
        { id: 'dampCV', label: 'Damp', port: 'dampCV', signal: 'cv' }
    ],
    outputs: [
        { id: 'out', label: 'Out', port: 'out', signal: 'audio' }
    ]
};

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function clampFinite(value, lo = 0, hi = 1, fallback = 0) {
    return clamp(finite(value, fallback), lo, hi);
}

function smoothingCoeff(sampleRate, timeMs) {
    return 1 - Math.exp(-1 / (sampleRate * Math.max(0.1, timeMs) / 1000));
}

function decayCoeff(sampleRate, timeMs) {
    return Math.exp(-1 / (sampleRate * Math.max(0.1, timeMs) / 1000));
}

function modeFromParam(value) {
    return Math.round(clampFinite(value, 0, 2, 1));
}

function softLimit(value) {
    if (!Number.isFinite(value)) return 0;

    const sign = value < 0 ? -1 : 1;
    const amount = Math.abs(value);
    const knee = OUTPUT_LIMIT * 0.96;

    if (amount <= knee) return value;

    const over = amount - knee;
    const softened = knee + (OUTPUT_LIMIT - knee) * (1 - Math.exp(-over / (OUTPUT_LIMIT - knee)));
    return sign * Math.min(OUTPUT_LIMIT, softened);
}

function cutoffFromOpen(open, tone) {
    const minHz = 45 + tone * 55;
    const maxHz = 600 + 19000 * Math.pow(tone, 1.35);
    const position = Math.pow(clamp(open, 0, 1), 0.55);

    return minHz * Math.pow(maxHz / minHz, position);
}

function renderModeBank({ moduleId, dsp, onParamChange }) {
    const container = document.createElement('div');
    const label = document.createElement('div');
    const bank = document.createElement('div');

    label.className = 'section-label';
    label.textContent = 'Mode';

    bank.className = 'button-bank lpg-mode-bank';
    bank.dataset.module = moduleId;
    bank.dataset.param = 'mode';

    const currentMode = modeFromParam(dsp?.params?.mode ?? 1);

    MODE_LABELS.forEach(({ value, label: modeLabel }) => {
        const button = document.createElement('button');
        button.className = `octave-btn${value === currentMode ? ' active' : ''}`;
        button.dataset.value = value;
        button.textContent = modeLabel;

        button.addEventListener('click', () => {
            bank.querySelectorAll('.octave-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            if (dsp?.params) dsp.params.mode = value;
            onParamChange?.('mode', value);
        });

        bank.appendChild(button);
    });

    container.appendChild(label);
    container.appendChild(bank);
    return container;
}

export default {
    id: 'lpg',
    name: 'LPG',
    hp: 6,
    color: 'module-color-three',
    category: 'filter',
    telemetry: { fields: [], methods: [] },

    css: `
        .lpg-mode-bank .octave-btn {
            min-width: 30px;
            padding-left: 4px;
            padding-right: 4px;
            font-size: 9px;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const out = new Float32Array(bufferSize);
        const ownAudio = new Float32Array(bufferSize);
        const ownCV = new Float32Array(bufferSize);
        const ownStrike = new Float32Array(bufferSize);
        const ownDampCV = new Float32Array(bufferSize);
        const inputs = {
            audio: ownAudio,
            cv: ownCV,
            strike: ownStrike,
            dampCV: ownDampCV
        };
        const leds = { open: 0 };

        const controlSmoothing = smoothingCoeff(sampleRate, 4);

        let strikeEnvelope = 0;
        let vactrol = 0;
        let memory = 0;
        let dampState = 0.35;
        let toneState = 0.65;
        let lastStrikeHigh = false;
        let ic1eq = 0;
        let ic2eq = 0;

        function clearFilterState() {
            ic1eq = 0;
            ic2eq = 0;
        }

        function restoreInputBuffers() {
            ownAudio.fill(0);
            ownCV.fill(0);
            ownStrike.fill(0);
            ownDampCV.fill(0);
            inputs.audio = ownAudio;
            inputs.cv = ownCV;
            inputs.strike = ownStrike;
            inputs.dampCV = ownDampCV;
            lastStrikeHigh = false;
        }

        function processLowpass(input, cutoffHz, resonanceAmount) {
            const normalizedCutoff = clamp(cutoffHz / sampleRate, 0.00001, 0.45);
            const g = Math.tan(Math.PI * normalizedCutoff);
            const q = 0.55 + resonanceAmount * 5.2;
            const k = 1 / q;
            const a1 = 1 / (1 + g * (g + k));
            const v1 = (ic1eq + g * (input - ic2eq)) * a1;
            const v2 = ic2eq + g * v1;

            ic1eq = 2 * v1 - ic1eq;
            ic2eq = 2 * v2 - ic2eq;

            return v2 * (1 + resonanceAmount * 0.08);
        }

        return {
            params: {
                level: 0,
                damp: 0.35,
                tone: 0.65,
                resonance: 0,
                mode: 1
            },

            inputs,
            outputs: { out },
            leds,

            process() {
                const mode = modeFromParam(this.params.mode);
                const level = clampFinite(this.params.level);
                const resonance = clampFinite(this.params.resonance);
                const audio = this.inputs.audio;
                const cv = this.inputs.cv;
                const strike = this.inputs.strike;
                const dampCV = this.inputs.dampCV;

                for (let i = 0; i < bufferSize; i++) {
                    const dampTarget = clampFinite(this.params.damp + finite(dampCV[i]) / 5);
                    const toneTarget = clampFinite(this.params.tone, 0, 1, 0.65);

                    dampState += controlSmoothing * (dampTarget - dampState);
                    toneState += controlSmoothing * (toneTarget - toneState);

                    const strikeHigh = finite(strike[i]) >= STRIKE_THRESHOLD;
                    if (strikeHigh && !lastStrikeHigh) {
                        strikeEnvelope = 1;
                        memory = clamp(memory + 0.12 + (1 - dampState) * 0.08, 0, 1);
                    }
                    lastStrikeHigh = strikeHigh;

                    const strikeAmount = strikeEnvelope * (1 - dampState * 0.15);
                    const memoryAmount = memory * 0.08 * (1 - dampState);
                    const cvAmount = clampFinite(cv[i], 0, 5) / 5;
                    const openTarget = clamp(level + cvAmount + strikeAmount + memoryAmount, 0, 1);

                    const attackMs = 2 + (1 - openTarget) * 10;
                    const decayMs = 80 + Math.pow(1 - dampState, 2) * 1120;
                    const followMs = openTarget > vactrol ? attackMs : decayMs;
                    const followCoeff = smoothingCoeff(sampleRate, followMs);

                    vactrol += followCoeff * (openTarget - vactrol);

                    const strikeDecayMs = 45 + Math.pow(1 - dampState, 2) * 850;
                    const memoryDecayMs = 1200 + (1 - dampState) * 1800;
                    strikeEnvelope *= decayCoeff(sampleRate, strikeDecayMs);
                    memory *= decayCoeff(sampleRate, memoryDecayMs);

                    const gain = Math.pow(clamp(vactrol, 0, 1), 1.35);
                    const cutoffOpen = Math.pow(clamp(vactrol, 0, 1), 0.82);
                    const cutoffHz = cutoffFromOpen(cutoffOpen, toneState);
                    const resonanceAmount = mode === 2 ? resonance * 0.85 : mode === 1 ? resonance * 0.42 : 0;
                    const sample = finite(audio[i]);
                    const filtered = processLowpass(sample, cutoffHz, resonanceAmount);

                    let output;
                    if (mode === 0) {
                        output = sample * gain;
                    } else if (mode === 1) {
                        output = filtered * gain;
                    } else {
                        output = filtered;
                    }

                    out[i] = softLimit(output);
                }

                leds.open = clamp(vactrol, 0, 1);

            },

            reset() {
                strikeEnvelope = 0;
                vactrol = 0;
                memory = 0;
                dampState = 0.35;
                toneState = 0.65;
                lastStrikeHigh = false;
                clearFilterState();
                out.fill(0);
                leds.open = 0;
            }
        };
    },

    ui: LPG_UI,

    render(container, { instance, toolkit, onParamChange }) {
        const { id: moduleId, dsp } = instance;
        const ledRow = toolkit.createRow();
        const knobRowA = toolkit.createRow();
        const knobRowB = toolkit.createRow();
        const outRow = toolkit.createRow();
        const inputRow = toolkit.createRow();

        ledRow.appendChild(toolkit.createLED({ id: 'open', color: 'green' }));
        container.appendChild(ledRow);

        LPG_UI.knobs.slice(0, 2).forEach(knob => {
            knobRowA.appendChild(toolkit.createKnob({
                id: knob.id,
                label: knob.label,
                value: knob.default,
                min: knob.min,
                max: knob.max,
                param: knob.param
            }));
        });
        container.appendChild(knobRowA);

        LPG_UI.knobs.slice(2).forEach(knob => {
            knobRowB.appendChild(toolkit.createKnob({
                id: knob.id,
                label: knob.label,
                value: knob.default,
                min: knob.min,
                max: knob.max,
                param: knob.param
            }));
        });
        container.appendChild(knobRowB);

        container.appendChild(renderModeBank({ moduleId, dsp, onParamChange }));
        container.appendChild(toolkit.createSpacer());

        container.appendChild(toolkit.createSection('Out'));
        LPG_UI.outputs.forEach(output => {
            outRow.appendChild(toolkit.createJack({
                id: output.port,
                label: output.label,
                direction: 'output',
                signal: output.signal
            }));
        });
        container.appendChild(outRow);

        container.appendChild(toolkit.createSection('In'));
        LPG_UI.inputs.forEach(input => {
            inputRow.appendChild(toolkit.createJack({
                id: input.port,
                label: input.label,
                direction: 'input',
                signal: input.signal
            }));
        });
        container.appendChild(inputRow);
    }
};
