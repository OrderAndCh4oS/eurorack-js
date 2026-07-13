import { clamp, expMap } from '../../utils/math.js';
import { wrapPhase } from '../../utils/oscillator.js';
import { softLimitVoltage } from '../../utils/voltage.js';

const AUDIO_MIN_HZ = 10;
const AUDIO_MAX_HZ = 5000;
const LF_MIN_HZ = 0.003;
const LF_MAX_HZ = 30;
const TRIGGER_THRESHOLD = 1;
const MAX_HARMONIC = 31;

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function frequencyToCoarse(frequency) {
    return clamp(Math.log(frequency / AUDIO_MIN_HZ) / Math.log(AUDIO_MAX_HZ / AUDIO_MIN_HZ));
}

function triangle(phase) {
    return 4 * Math.abs(phase - 0.5) - 1;
}

export default {
    id: 'complex-vco',
    name: 'CPLX VCO',
    hp: 12,
    color: 'module-color-six',
    category: 'source',
    frequencyToCoarse,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        let phase = 0;
        let corePhase = 0;
        let direction = 1;
        let lastReset = 0;
        let lastFlip = 0;
        let hpInput = 0;
        let hpOutput = 0;

        const vOct = new Float32Array(bufferSize);
        const expFm = new Float32Array(bufferSize);
        const tzFm = new Float32Array(bufferSize).fill(5);
        const phaseInput = new Float32Array(bufferSize);
        const reset = new Float32Array(bufferSize);
        const flip = new Float32Array(bufferSize);
        const fundAm = new Float32Array(bufferSize).fill(5);
        const evenAm = new Float32Array(bufferSize).fill(5);
        const oddAm = new Float32Array(bufferSize).fill(5);

        const core = new Float32Array(bufferSize);
        const fund = new Float32Array(bufferSize);
        const even = new Float32Array(bufferSize);
        const odd = new Float32Array(bufferSize);
        const full = new Float32Array(bufferSize);
        const hpCoefficient = Math.exp(-2 * Math.PI * 16 / sampleRate);

        return {
            params: {
                coarse: 0.42,
                fine: 0,
                range: 0,
                expFmAmt: 0,
                tzFmAmt: 0,
                tzFmAc: 0,
                tzFmBias: 0,
                phaseAmt: 0,
                fundLevel: 0.8,
                evenLevel: 0.5,
                oddLevel: 0.5
            },
            inputs: { vOct, expFm, tzFm, phase: phaseInput, reset, flip, fundAm, evenAm, oddAm },
            outputs: { core, fund, even, odd, full },
            leds: { positive: 0, negative: 0 },

            process() {
                const isLow = Math.round(clamp(finite(this.params.range), 0, 1)) === 1;
                const base = expMap(
                    clamp(finite(this.params.coarse, 0.42)),
                    isLow ? LF_MIN_HZ : AUDIO_MIN_HZ,
                    isLow ? LF_MAX_HZ : AUDIO_MAX_HZ
                ) * (2 ** (clamp(finite(this.params.fine), -12, 12) / 12));
                const expAmount = clamp(finite(this.params.expFmAmt), -1, 1);
                const tzAmount = clamp(finite(this.params.tzFmAmt), -1, 1);
                const phaseAmount = clamp(finite(this.params.phaseAmt), -1, 1);
                const fundLevel = clamp(finite(this.params.fundLevel), -1, 1);
                const evenLevel = clamp(finite(this.params.evenLevel), -1, 1);
                const oddLevel = clamp(finite(this.params.oddLevel), -1, 1);
                const ac = finite(this.params.tzFmAc) >= 0.5;
                const bias = finite(this.params.tzFmBias) >= 0.5 ? 5 : 0;

                const resetInput = this.inputs.reset;
                const flipInput = this.inputs.flip;
                const tzInput = this.inputs.tzFm;
                const fundInput = this.inputs.fundAm;
                const evenInput = this.inputs.evenAm;
                const oddInput = this.inputs.oddAm;

                for (let i = 0; i < bufferSize; i++) {
                    const resetValue = finite(resetInput[i]);
                    const flipValue = finite(flipInput[i]);
                    if (resetValue >= TRIGGER_THRESHOLD && lastReset < TRIGGER_THRESHOLD) {
                        phase = 0;
                        corePhase = 0;
                    }
                    if (flipValue >= TRIGGER_THRESHOLD && lastFlip < TRIGGER_THRESHOLD) direction *= -1;
                    lastReset = resetValue;
                    lastFlip = flipValue;

                    let linearInput = finite(tzInput[i], 5) + bias;
                    if (ac) {
                        const next = hpCoefficient * (hpOutput + linearInput - hpInput);
                        hpInput = linearInput;
                        hpOutput = next;
                        linearInput = next;
                    }

                    const pitchOctaves = finite(this.inputs.vOct[i]) + finite(this.inputs.expFm[i]) * expAmount;
                    const pitched = base * (2 ** clamp(pitchOctaves, -10, 10));
                    let frequency = pitched + base * 2 * (linearInput / 5) * tzAmount;
                    frequency = clamp(finite(frequency), -sampleRate * 0.45, sampleRate * 0.45) * direction;
                    const increment = frequency / sampleRate;
                    const modPhase = wrapPhase(phase + finite(this.inputs.phase[i]) / 5 * phaseAmount * 2.5);

                    const fundamental = Math.sin(2 * Math.PI * modPhase);
                    let evenSum = 0;
                    let evenWeight = 0;
                    let oddSum = 0;
                    let oddWeight = 0;
                    const absFrequency = Math.max(0.001, Math.abs(frequency));
                    const maxHarmonic = Math.min(MAX_HARMONIC, Math.floor(sampleRate * 0.45 / absFrequency));
                    for (let harmonic = 2; harmonic <= maxHarmonic; harmonic++) {
                        const weight = 1 / harmonic;
                        const sample = Math.sin(2 * Math.PI * modPhase * harmonic) * weight;
                        if (harmonic % 2 === 0) {
                            evenSum += sample;
                            evenWeight += weight;
                        } else {
                            oddSum += sample;
                            oddWeight += weight;
                        }
                    }
                    if (evenWeight > 0) evenSum /= evenWeight;
                    if (oddWeight > 0) oddSum /= oddWeight;

                    const fundGain = fundLevel * clamp(finite(fundInput[i], 5) / 5, -2, 2);
                    const evenGain = evenLevel * clamp(finite(evenInput[i], 5) / 5, -2, 2);
                    const oddGain = oddLevel * clamp(finite(oddInput[i], 5) / 5, -2, 2);
                    const fundValue = fundamental * fundGain * 5;
                    const evenValue = evenSum * evenGain * 5;
                    const oddValue = oddSum * oddGain * 5;

                    core[i] = softLimitVoltage(triangle(corePhase) * 5, 5);
                    fund[i] = softLimitVoltage(fundValue, 5);
                    even[i] = softLimitVoltage(evenValue, 5);
                    odd[i] = softLimitVoltage(oddValue, 5);
                    full[i] = softLimitVoltage(fundValue + evenValue + oddValue, 5);

                    phase = wrapPhase(phase + increment);
                    corePhase = wrapPhase(corePhase + increment * 0.5);
                }

                const last = full[bufferSize - 1] / 5;
                this.leds.positive = Math.max(0, last);
                this.leds.negative = Math.max(0, -last);

                if (tzInput !== tzFm) { tzFm.fill(5); this.inputs.tzFm = tzFm; }
                if (fundInput !== fundAm) { fundAm.fill(5); this.inputs.fundAm = fundAm; }
                if (evenInput !== evenAm) { evenAm.fill(5); this.inputs.evenAm = evenAm; }
                if (oddInput !== oddAm) { oddAm.fill(5); this.inputs.oddAm = oddAm; }
            },

            getPhase() {
                return phase;
            },

            reset() {
                phase = 0;
                corePhase = 0;
                direction = 1;
                lastReset = 0;
                lastFlip = 0;
                hpInput = 0;
                hpOutput = 0;
                Object.values(this.outputs).forEach(output => output.fill(0));
                this.leds.positive = 0;
                this.leds.negative = 0;
            }
        };
    },

    ui: {
        leds: ['positive', 'negative'],
        knobs: [
            { id: 'coarse', label: 'Coarse', param: 'coarse', min: 0, max: 1, default: 0.42 },
            { id: 'fine', label: 'Fine', param: 'fine', min: -12, max: 12, default: 0 },
            { id: 'expFmAmt', label: 'Exp FM', param: 'expFmAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'tzFmAmt', label: 'TZ FM', param: 'tzFmAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'phaseAmt', label: 'Phase', param: 'phaseAmt', min: -1, max: 1, default: 0, small: true },
            { id: 'fundLevel', label: 'Fund', param: 'fundLevel', min: -1, max: 1, default: 0.8, small: true },
            { id: 'evenLevel', label: 'Even', param: 'evenLevel', min: -1, max: 1, default: 0.5, small: true },
            { id: 'oddLevel', label: 'Odd', param: 'oddLevel', min: -1, max: 1, default: 0.5, small: true }
        ],
        switches: [
            { id: 'range', label: 'LF', param: 'range', default: 0 },
            { id: 'tzFmAc', label: 'AC', param: 'tzFmAc', default: 0 },
            { id: 'tzFmBias', label: 'Bias', param: 'tzFmBias', default: 0 }
        ],
        inputs: [
            { id: 'vOct', label: 'V/Oct', port: 'vOct', signal: 'cv' },
            { id: 'expFm', label: 'Exp', port: 'expFm', signal: 'cv' },
            { id: 'tzFm', label: 'TZ FM', port: 'tzFm', signal: 'cv', voltage: { min: -5, max: 5, normal: 5 } },
            { id: 'phase', label: 'Phase', port: 'phase', signal: 'cv' },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger' },
            { id: 'flip', label: 'Flip', port: 'flip', signal: 'trigger' },
            { id: 'fundAm', label: 'Fund AM', port: 'fundAm', signal: 'cv', voltage: { min: -5, max: 5, normal: 5 } },
            { id: 'evenAm', label: 'Even AM', port: 'evenAm', signal: 'cv', voltage: { min: -5, max: 5, normal: 5 } },
            { id: 'oddAm', label: 'Odd AM', port: 'oddAm', signal: 'cv', voltage: { min: -5, max: 5, normal: 5 } }
        ],
        outputs: ['core', 'fund', 'even', 'odd', 'full'].map(port => ({
            id: port,
            label: port[0].toUpperCase() + port.slice(1),
            port,
            signal: 'audio'
        }))
    }
};
