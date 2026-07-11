export function createRealFft({ size, referenceVoltage = 5, floorDb = -100 } = {}) {
    if (!Number.isInteger(size) || size < 8 || (size & (size - 1)) !== 0) {
        throw new Error('FFT size must be a power of two of at least 8');
    }
    if (!Number.isFinite(referenceVoltage) || referenceVoltage <= 0) {
        throw new RangeError('FFT referenceVoltage must be a positive finite number');
    }
    if (!Number.isFinite(floorDb)) throw new TypeError('FFT floorDb must be finite');

    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    const window = new Float64Array(size);
    const bitReversed = new Uint32Array(size);
    const twiddleReal = new Float64Array(size / 2);
    const twiddleImag = new Float64Array(size / 2);
    const bits = Math.log2(size);
    let windowSum = 0;

    for (let index = 0; index < size; index++) {
        window[index] = 0.5 * (1 - Math.cos(2 * Math.PI * index / (size - 1)));
        windowSum += window[index];
        let value = index;
        let reversed = 0;
        for (let bit = 0; bit < bits; bit++) {
            reversed = (reversed << 1) | (value & 1);
            value >>= 1;
        }
        bitReversed[index] = reversed;
        if (index < size / 2) {
            const angle = -2 * Math.PI * index / size;
            twiddleReal[index] = Math.cos(angle);
            twiddleImag[index] = Math.sin(angle);
        }
    }

    function analyzeCircular(samples, writeIndex, output) {
        if (!ArrayBuffer.isView(samples) || samples.length < size) {
            throw new TypeError(`FFT input must be a typed array with at least ${size} samples`);
        }
        if (!Number.isInteger(writeIndex)) throw new TypeError('FFT writeIndex must be a finite integer');
        if (!(output instanceof Float32Array) || output.length !== size / 2) {
            throw new Error(`FFT output must be a Float32Array of length ${size / 2}`);
        }
        for (let index = 0; index < size; index++) {
            const sourceIndex = (writeIndex + index) % size;
            real[bitReversed[index]] = (Number.isFinite(samples[sourceIndex]) ? samples[sourceIndex] : 0) * window[index];
            imag[bitReversed[index]] = 0;
        }

        for (let width = 2; width <= size; width *= 2) {
            const half = width / 2;
            const twiddleStep = size / width;
            for (let start = 0; start < size; start += width) {
                for (let offset = 0; offset < half; offset++) {
                    const twiddleIndex = offset * twiddleStep;
                    const cos = twiddleReal[twiddleIndex];
                    const sin = twiddleImag[twiddleIndex];
                    const even = start + offset;
                    const odd = even + half;
                    const oddReal = real[odd] * cos - imag[odd] * sin;
                    const oddImag = real[odd] * sin + imag[odd] * cos;
                    real[odd] = real[even] - oddReal;
                    imag[odd] = imag[even] - oddImag;
                    real[even] += oddReal;
                    imag[even] += oddImag;
                }
            }
        }

        const amplitudeScale = 2 / windowSum;
        for (let bin = 0; bin < output.length; bin++) {
            const amplitude = Math.hypot(real[bin], imag[bin]) * amplitudeScale;
            const db = amplitude > 0
                ? 20 * Math.log10(amplitude / referenceVoltage)
                : floorDb;
            output[bin] = Math.max(floorDb, db);
        }
        return output;
    }

    return { size, bins: size / 2, analyzeCircular };
}
