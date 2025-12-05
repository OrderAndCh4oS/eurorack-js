/**
 * Clamp a value between minimum and maximum bounds.
 * @param {number} v - Value to clamp
 * @param {number} lo - Lower bound (default: 0)
 * @param {number} hi - Upper bound (default: 1)
 * @returns {number} Clamped value
 */
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/**
 * Exponential mapping for frequency/logarithmic controls.
 * Maps a normalized 0-1 value to an exponential range.
 * @param {number} norm - Normalized input (0-1)
 * @param {number} min - Minimum output value
 * @param {number} max - Maximum output value
 * @returns {number} Exponentially mapped value
 */
export const expMap = (norm, min, max) => min * Math.pow(max / min, clamp(norm));
