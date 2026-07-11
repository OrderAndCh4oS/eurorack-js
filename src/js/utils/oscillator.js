/** Wrap a normalized oscillator phase into the half-open range [0, 1). */
export function wrapPhase(phase) {
    return phase - Math.floor(phase);
}

/**
 * Return the PolyBLEP correction for a discontinuity at normalized phase zero.
 * `phaseIncrement` is cycles per sample and must be positive.
 */
export function polyBlep(phase, phaseIncrement) {
    if (!Number.isFinite(phaseIncrement) || phaseIncrement <= 0) return 0;
    if (phase < phaseIncrement) {
        const x = phase / phaseIncrement;
        return x + x - x * x - 1;
    }
    if (phase > 1 - phaseIncrement) {
        const x = (phase - 1) / phaseIncrement;
        return x * x + x + x + 1;
    }
    return 0;
}
