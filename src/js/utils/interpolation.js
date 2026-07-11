/** Interpolate between two samples. Fractions outside 0..1 extrapolate. */
export function linearInterpolate(a, b, fraction) {
    return a * (1 - fraction) + b * fraction;
}

/**
 * Create a fractional reader for a fixed circular sample buffer.
 * The returned hot-path function accepts absolute positions in either direction.
 */
export function createLinearCircularReader(buffer) {
    if (!ArrayBuffer.isView(buffer) || buffer.length === 0) {
        throw new TypeError('Circular interpolation requires a non-empty typed-array buffer');
    }
    const size = buffer.length;
    return position => {
        if (!Number.isFinite(position)) throw new TypeError('Circular interpolation position must be finite');
        const indexFloor = Math.floor(position);
        const fraction = position - indexFloor;
        let index0 = indexFloor % size;
        if (index0 < 0) index0 += size;
        const index1 = index0 + 1 === size ? 0 : index0 + 1;
        return linearInterpolate(buffer[index0], buffer[index1], fraction);
    };
}
