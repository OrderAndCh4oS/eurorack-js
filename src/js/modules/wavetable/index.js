/**
 * WAVE - Procedural Wavetable Oscillator
 *
 * Monophonic wavetable source with procedural banks, octave-spaced
 * bandlimited replicas, smooth/stepped table scanning, linear FM, and sync.
 */

import { clamp, expMap } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

const TWO_PI = Math.PI * 2;
const TABLE_SIZE = 2048;
const TABLE_MASK = TABLE_SIZE - 1;
const WAVE_COUNT = 16;
const BANK_COUNT = 5;
const MAX_HARMONICS = 256;
const HARMONIC_LIMITS = [256, 128, 64, 32, 16, 8, 4, 2, 1];
const COARSE_HZ = { min: 10, max: 10000 };
const FM_HZ_PER_VOLT = 200;
const SYNC_THRESHOLD = 2.5;

let factoryTables = null;
let harmonicBasis = null;

function valueAt(input, index, fallback = 0) {
    if (typeof input === 'number') return Number.isFinite(input) ? input : fallback;
    const value = input?.[index];
    return Number.isFinite(value) ? value : fallback;
}

function paramValue(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function smoothstep(edge0, edge1, value) {
    const x = clamp((value - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
}

function pseudoRandom(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

function getHarmonicBasis() {
    if (harmonicBasis) return harmonicBasis;

    const sin = Array(MAX_HARMONICS + 1);
    const cos = Array(MAX_HARMONICS + 1);

    for (let harmonic = 1; harmonic <= MAX_HARMONICS; harmonic++) {
        const sinTable = new Float32Array(TABLE_SIZE);
        const cosTable = new Float32Array(TABLE_SIZE);
        for (let i = 0; i < TABLE_SIZE; i++) {
            const phase = TWO_PI * harmonic * i / TABLE_SIZE;
            sinTable[i] = Math.sin(phase);
            cosTable[i] = Math.cos(phase);
        }
        sin[harmonic] = sinTable;
        cos[harmonic] = cosTable;
    }

    harmonicBasis = { sin, cos };
    return harmonicBasis;
}

function basicAnchor(anchor, harmonic) {
    switch (anchor) {
        case 0:
            return harmonic === 1 ? [1, 0] : [0, 0];
        case 1:
            if (harmonic % 2 === 0) return [0, 0];
            return [((Math.floor((harmonic - 1) / 2) % 2 === 0) ? 1 : -1) * 1.25 / (harmonic * harmonic), 0];
        case 2:
            return [((harmonic % 2 === 0) ? -1 : 1) * 0.85 / harmonic, 0];
        case 3:
            return harmonic % 2 === 1 ? [1 / harmonic, 0] : [0, 0];
        default: {
            const duty = 0.28;
            const amp = 1.25 * Math.sin(Math.PI * harmonic * duty) / harmonic;
            return [amp, 0];
        }
    }
}

function createBasicSpectrum(waveIndex, sinCoeff, cosCoeff) {
    const position = waveIndex / (WAVE_COUNT - 1) * 4;
    const anchor = Math.min(3, Math.floor(position));
    const frac = position - anchor;

    for (let harmonic = 1; harmonic <= MAX_HARMONICS; harmonic++) {
        const a = basicAnchor(anchor, harmonic);
        const b = basicAnchor(anchor + 1, harmonic);
        sinCoeff[harmonic] = a[0] * (1 - frac) + b[0] * frac;
        cosCoeff[harmonic] = a[1] * (1 - frac) + b[1] * frac;
    }
}

function createBrightSpectrum(waveIndex, sinCoeff, cosCoeff) {
    const t = waveIndex / (WAVE_COUNT - 1);
    const slope = 2.35 - t * 1.65;

    for (let harmonic = 1; harmonic <= MAX_HARMONICS; harmonic++) {
        const ripple = 0.88 + 0.12 * Math.sin(harmonic * (0.35 + t * 1.8));
        const sign = harmonic % 2 === 0 && t < 0.3 ? -1 : 1;
        sinCoeff[harmonic] = sign * ripple / Math.pow(harmonic, slope);
        cosCoeff[harmonic] = 0;
    }
}

function createHollowSpectrum(waveIndex, sinCoeff, cosCoeff) {
    const t = waveIndex / (WAVE_COUNT - 1);
    const duty = 0.5 - t * 0.37;
    const evenMix = smoothstep(0.35, 1, t);

    for (let harmonic = 1; harmonic <= MAX_HARMONICS; harmonic++) {
        let amp = Math.abs(Math.sin(Math.PI * harmonic * duty)) / harmonic;
        if (harmonic % 2 === 0) amp *= 0.12 + evenMix * 0.78;
        const phase = -Math.PI * harmonic * duty;
        sinCoeff[harmonic] = amp * Math.cos(phase);
        cosCoeff[harmonic] = amp * Math.sin(phase);
    }
}

function createFormantSpectrum(waveIndex, sinCoeff, cosCoeff) {
    const vowels = [
        [2.0, 4.5, 9.0],
        [2.8, 6.0, 13.5],
        [4.2, 8.0, 18.0],
        [5.8, 11.5, 24.0],
        [8.5, 16.0, 32.0]
    ];
    const position = waveIndex / (WAVE_COUNT - 1) * (vowels.length - 1);
    const index = Math.min(vowels.length - 2, Math.floor(position));
    const frac = position - index;
    const centers = vowels[index].map((center, i) => center * (1 - frac) + vowels[index + 1][i] * frac);

    for (let harmonic = 1; harmonic <= MAX_HARMONICS; harmonic++) {
        let amp = 0.03 / Math.pow(harmonic, 1.15);
        centers.forEach((center, formantIndex) => {
            const width = 0.9 + center * (0.15 + formantIndex * 0.03);
            const distance = (harmonic - center) / width;
            amp += (1.2 - formantIndex * 0.25) * Math.exp(-distance * distance) / Math.pow(harmonic, 0.35);
        });
        sinCoeff[harmonic] = amp;
        cosCoeff[harmonic] = 0;
    }
}

function createDigitalSpectrum(waveIndex, sinCoeff, cosCoeff) {
    const t = waveIndex / (WAVE_COUNT - 1);
    const noisyMix = smoothstep(0.55, 1, t);
    const comb = 2 + Math.floor(t * 7);

    for (let harmonic = 1; harmonic <= MAX_HARMONICS; harmonic++) {
        const fold = Math.abs(Math.sin(harmonic * (0.72 + t * 5.7)));
        const combBoost = harmonic % comb === 0 ? 1.4 : 0.22;
        const random = pseudoRandom((waveIndex + 1) * 97 + harmonic * 13);
        const orderedAmp = (0.35 + 0.45 * fold + 0.2 * combBoost) / Math.pow(harmonic, 0.82);
        const noisyAmp = (0.18 + random * 0.82) / Math.pow(harmonic, 0.68);
        const amp = orderedAmp * (1 - noisyMix) + noisyAmp * noisyMix;
        const phase = (1 - noisyMix) * harmonic * t * 0.9 + noisyMix * random * TWO_PI;
        sinCoeff[harmonic] = amp * Math.cos(phase);
        cosCoeff[harmonic] = amp * Math.sin(phase);
    }
}

function createSpectrum(bankIndex, waveIndex) {
    const sinCoeff = new Float32Array(MAX_HARMONICS + 1);
    const cosCoeff = new Float32Array(MAX_HARMONICS + 1);

    switch (bankIndex) {
        case 0:
            createBasicSpectrum(waveIndex, sinCoeff, cosCoeff);
            break;
        case 1:
            createBrightSpectrum(waveIndex, sinCoeff, cosCoeff);
            break;
        case 2:
            createHollowSpectrum(waveIndex, sinCoeff, cosCoeff);
            break;
        case 3:
            createFormantSpectrum(waveIndex, sinCoeff, cosCoeff);
            break;
        default:
            createDigitalSpectrum(waveIndex, sinCoeff, cosCoeff);
            break;
    }

    if (Math.hypot(sinCoeff[1], cosCoeff[1]) < 0.001) {
        sinCoeff[1] += 0.05;
    }

    return { sinCoeff, cosCoeff };
}

function centerAndNormalize(table) {
    let mean = 0;
    for (let i = 0; i < TABLE_SIZE; i++) mean += table[i];
    mean /= TABLE_SIZE;

    let peak = 0;
    for (let i = 0; i < TABLE_SIZE; i++) {
        table[i] -= mean;
        peak = Math.max(peak, Math.abs(table[i]));
    }

    if (peak < 1e-8) {
        for (let i = 0; i < TABLE_SIZE; i++) table[i] = Math.sin(TWO_PI * i / TABLE_SIZE);
        return table;
    }

    const gain = 1 / peak;
    for (let i = 0; i < TABLE_SIZE; i++) table[i] = clamp(table[i] * gain, -1, 1);
    return table;
}

function buildTable(spectrum, harmonicLimit, basis) {
    const table = new Float32Array(TABLE_SIZE);
    const maxHarmonic = Math.min(harmonicLimit, MAX_HARMONICS);

    for (let harmonic = 1; harmonic <= maxHarmonic; harmonic++) {
        const sinAmount = spectrum.sinCoeff[harmonic];
        const cosAmount = spectrum.cosCoeff[harmonic];
        if (Math.abs(sinAmount) < 1e-8 && Math.abs(cosAmount) < 1e-8) continue;

        const sinTable = basis.sin[harmonic];
        const cosTable = basis.cos[harmonic];
        for (let i = 0; i < TABLE_SIZE; i++) {
            table[i] += sinTable[i] * sinAmount + cosTable[i] * cosAmount;
        }
    }

    return centerAndNormalize(table);
}

function buildFactoryTables() {
    const basis = getHarmonicBasis();

    return Array.from({ length: BANK_COUNT }, (_, bankIndex) =>
        Array.from({ length: WAVE_COUNT }, (_, waveIndex) => {
            const spectrum = createSpectrum(bankIndex, waveIndex);
            return HARMONIC_LIMITS.map(limit => buildTable(spectrum, limit, basis));
        })
    );
}

function getFactoryTables() {
    if (!factoryTables) factoryTables = buildFactoryTables();
    return factoryTables;
}

function selectReplica(frequency, sampleRate) {
    const safeFrequency = Math.max(0.1, frequency);
    const allowedHarmonics = Math.max(1, Math.floor((sampleRate * 0.45) / safeFrequency));

    for (let i = 0; i < HARMONIC_LIMITS.length; i++) {
        if (HARMONIC_LIMITS[i] <= allowedHarmonics) return i;
    }
    return HARMONIC_LIMITS.length - 1;
}

function readTable(table, phase) {
    const position = phase * TABLE_SIZE;
    const index = Math.floor(position);
    const frac = position - index;
    const i1 = index & TABLE_MASK;
    const i0 = (index - 1) & TABLE_MASK;
    const i2 = (index + 1) & TABLE_MASK;
    const i3 = (index + 2) & TABLE_MASK;

    const y0 = table[i0];
    const y1 = table[i1];
    const y2 = table[i2];
    const y3 = table[i3];
    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const a2 = -0.5 * y0 + 0.5 * y2;

    return ((a0 * frac + a1) * frac + a2) * frac + y1;
}

function readWave(tables, bankIndex, waveIndex, replicaIndex, phase) {
    return readTable(tables[bankIndex][waveIndex][replicaIndex], phase);
}

function readMorphedWave(tables, bankIndex, tablePosition, replicaIndex, phase, smooth) {
    if (!smooth) {
        const waveIndex = Math.round(tablePosition);
        return readWave(tables, bankIndex, waveIndex, replicaIndex, phase);
    }

    const lower = Math.floor(tablePosition);
    const upper = Math.min(WAVE_COUNT - 1, lower + 1);
    const frac = tablePosition - lower;
    if (frac <= 0 || lower === upper) return readWave(tables, bankIndex, lower, replicaIndex, phase);

    const a = readWave(tables, bankIndex, lower, replicaIndex, phase);
    const b = readWave(tables, bankIndex, upper, replicaIndex, phase);
    return a * (1 - frac) + b * frac;
}

export default {
    id: 'wavetable',
    name: 'WAVE',
    hp: 8,
    color: 'module-color-seven',
    category: 'source',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const tables = getFactoryTables();
        const out = new Float32Array(bufferSize);
        const leds = { level: 0, sync: 0 };
        const pitchSlew = createSlew({ sampleRate, timeMs: 4 });
        const positionSlew = createSlew({ sampleRate, timeMs: 2 });
        const levelSlew = createSlew({ sampleRate, timeMs: 2 });
        const ledDecay = Math.exp(-bufferSize / (sampleRate * 0.08));
        const syncLedDecay = Math.exp(-bufferSize / (sampleRate * 0.05));
        const maxFrequency = Math.min(20000, sampleRate * 0.45);
        let phase = 0;
        let lastSync = 0;

        return {
            params: {
                coarse: 0.4,
                fine: 0,
                bank: 0,
                position: 0,
                scanAmt: 0.5,
                fmAmt: 0,
                level: 0.9,
                interp: 1
            },

            inputs: {
                vOct: new Float32Array(bufferSize),
                fm: new Float32Array(bufferSize),
                position: new Float32Array(bufferSize),
                bankCv: new Float32Array(bufferSize),
                sync: new Float32Array(bufferSize)
            },

            outputs: { out },
            leds,

            process() {
                const coarse = clamp(paramValue(this.params.coarse, 0.4));
                const fine = clamp(paramValue(this.params.fine, 0), -6, 6);
                const bankParam = clamp(paramValue(this.params.bank, 0), 0, BANK_COUNT - 1);
                const positionParam = clamp(paramValue(this.params.position, 0));
                const scanAmt = clamp(paramValue(this.params.scanAmt, 0.5));
                const fmAmt = clamp(paramValue(this.params.fmAmt, 0));
                const interp = paramValue(this.params.interp, 1) >= 0.5;
                const targetLevel = clamp(paramValue(this.params.level, 0.9));
                const baseFrequency = expMap(coarse, COARSE_HZ.min, COARSE_HZ.max) * 2 ** (fine / 12);

                let peak = 0;
                let syncEdge = false;

                if (targetLevel <= 0) {
                    out.fill(0);
                    levelSlew.reset(0);

                    for (let i = 0; i < bufferSize; i++) {
                        const syncValue = valueAt(this.inputs.sync, i);
                        if (syncValue > SYNC_THRESHOLD && lastSync <= SYNC_THRESHOLD) {
                            phase = 0;
                            syncEdge = true;
                        }
                        lastSync = syncValue;
                    }

                    leds.level *= ledDecay;
                    if (leds.level < 1e-4) leds.level = 0;
                    leds.sync = syncEdge ? 1 : leds.sync * syncLedDecay;
                    if (leds.sync < 1e-4) leds.sync = 0;
                    return;
                }

                for (let i = 0; i < bufferSize; i++) {
                    const syncValue = valueAt(this.inputs.sync, i);
                    if (syncValue > SYNC_THRESHOLD && lastSync <= SYNC_THRESHOLD) {
                        phase = 0;
                        syncEdge = true;
                    }
                    lastSync = syncValue;

                    const pitchCv = clamp(valueAt(this.inputs.vOct, i), -10, 10);
                    const fmCv = clamp(valueAt(this.inputs.fm, i), -10, 10);
                    const positionCv = clamp(valueAt(this.inputs.position, i), -10, 10);
                    const bankCv = clamp(valueAt(this.inputs.bankCv, i), -10, 10);

                    const smoothedPitch = pitchSlew.process(pitchCv);
                    const fmHz = fmCv * fmAmt * FM_HZ_PER_VOLT;
                    const frequency = clamp(baseFrequency * 2 ** smoothedPitch + fmHz, 0.1, maxFrequency);
                    const replicaIndex = selectReplica(frequency, sampleRate);
                    const bankIndex = Math.round(clamp(bankParam + bankCv, 0, BANK_COUNT - 1));

                    const targetPosition = clamp(positionParam + (positionCv / 5) * scanAmt);
                    const effectivePosition = interp ? positionSlew.process(targetPosition) : targetPosition;
                    const tablePosition = clamp(effectivePosition) * (WAVE_COUNT - 1);
                    const sample = readMorphedWave(tables, bankIndex, tablePosition, replicaIndex, phase, interp);
                    const gain = levelSlew.process(targetLevel);
                    const voltage = clamp(sample * gain * 5, -5, 5);

                    out[i] = voltage;
                    peak = Math.max(peak, Math.abs(voltage));

                    phase += frequency / sampleRate;
                    phase -= Math.floor(phase);
                }

                leds.level = Math.max(peak / 5, leds.level * ledDecay);
                leds.sync = syncEdge ? 1 : leds.sync * syncLedDecay;
                if (leds.sync < 1e-4) leds.sync = 0;
            },

            reset() {
                phase = 0;
                lastSync = 0;
                pitchSlew.reset(0);
                positionSlew.reset(clamp(paramValue(this.params.position, 0)));
                levelSlew.reset(0);
                out.fill(0);
                leds.level = 0;
                leds.sync = 0;
            }
        };
    },

    ui: {
        leds: ['level', 'sync'],
        knobs: [
            { id: 'coarse', label: 'Coarse', param: 'coarse', min: 0, max: 1, default: 0.4 },
            { id: 'fine', label: 'Fine', param: 'fine', min: -6, max: 6, default: 0 },
            { id: 'bank', label: 'Bank', param: 'bank', min: 0, max: 4, default: 0, step: 1 },
            { id: 'position', label: 'Pos', param: 'position', min: 0, max: 1, default: 0 },
            { id: 'scanAmt', label: 'Scan', param: 'scanAmt', min: 0, max: 1, default: 0.5 },
            { id: 'fmAmt', label: 'FM', param: 'fmAmt', min: 0, max: 1, default: 0 },
            { id: 'level', label: 'Level', param: 'level', min: 0, max: 1, default: 0.9 }
        ],
        switches: [
            { id: 'interp', label: 'Morph', param: 'interp', positions: ['Step', 'Smooth'], default: 1 }
        ],
        inputs: [
            { id: 'vOct', label: 'V/Oct', port: 'vOct', type: 'cv' },
            { id: 'fm', label: 'FM', port: 'fm', type: 'cv' },
            { id: 'position', label: 'Pos', port: 'position', type: 'cv' },
            { id: 'bankCv', label: 'Bank', port: 'bankCv', type: 'cv' },
            { id: 'sync', label: 'Sync', port: 'sync', type: 'trigger' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
