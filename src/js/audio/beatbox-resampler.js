// Streaming physical-model transposition. See beatbox research for the
// bandlimited-reader trade-off: bounded rate/cost and sub-2 ms added latency.
const TAPS = 64, HALF = 32, PHASES = 256, BANDS = 17, RING = 256;
const MIN_CUTOFF = .225, MAX_CUTOFF = .45;
let table;
export function prepareBeatboxResampler() {
    if (table) return table;
    table = new Float32Array(BANDS * (PHASES + 1) * TAPS);
    for (let band = 0; band < BANDS; band++) {
        const cutoff = MIN_CUTOFF + band / (BANDS - 1) * (MAX_CUTOFF - MIN_CUTOFF);
        for (let phase = 0; phase <= PHASES; phase++) {
            const start = (band * (PHASES + 1) + phase) * TAPS;
            let sum = 0;
            for (let tap = 0; tap < TAPS; tap++) {
                const x = tap - (HALF - 1) - phase / PHASES;
                const window = Math.abs(x) >= HALF ? 0 : .42 + .5 * Math.cos(Math.PI * x / HALF) + .08 * Math.cos(2 * Math.PI * x / HALF);
                const sinc = Math.abs(x) < 1e-12 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
                table[start + tap] = sinc * window;
                sum += table[start + tap];
            }
            for (let tap = 0; tap < TAPS; tap++) table[start + tap] /= sum;
        }
    }
    return table;
}
export function createBeatboxResampler(source) {
    const coefficients = prepareBeatboxResampler();
    const history = new Float32Array(RING);
    let position = -HALF, produced = 0;
    return {
        next(requestedRatio) {
            const ratio = Number.isFinite(requestedRatio) ? Math.max(.5, Math.min(2, requestedRatio)) : 1;
            const center = Math.floor(position);
            const needed = center + HALF;
            while (produced <= needed) {
                const chunk = source.render(32);
                for (let i = 0; i < 32; i++) history[(produced + i) & (RING - 1)] = chunk[i];
                produced += 32;
            }
            const fractionalPhase = (position - center) * PHASES;
            const phase = Math.min(PHASES - 1, Math.floor(fractionalPhase));
            const phaseMix = fractionalPhase - phase;
            const cutoff = MAX_CUTOFF / Math.max(1, ratio);
            const fractionalBand = (cutoff - MIN_CUTOFF) / (MAX_CUTOFF - MIN_CUTOFF) * (BANDS - 1);
            const band = Math.max(0, Math.min(BANDS - 2, Math.floor(fractionalBand)));
            const bandMix = fractionalBand - band;
            const a = (band * (PHASES + 1) + phase) * TAPS;
            const b = a + (PHASES + 1) * TAPS;
            let value = 0;
            for (let tap = 0; tap < TAPS; tap++) {
                const index = center - (HALF - 1) + tap;
                if (index < 0) continue;
                const low = coefficients[a + tap] + phaseMix * (coefficients[a + TAPS + tap] - coefficients[a + tap]);
                const high = coefficients[b + tap] + phaseMix * (coefficients[b + TAPS + tap] - coefficients[b + tap]);
                value += history[index & (RING - 1)] * (low + bandMix * (high - low));
            }
            position += ratio;
            return value;
        },
        reset() { history.fill(0); position = -HALF; produced = 0; }
    };
}
