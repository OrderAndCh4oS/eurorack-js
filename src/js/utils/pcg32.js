const DEFAULT_SEED = 0;
const MULTIPLIER_HIGH = 0x5851f42d;
const MULTIPLIER_LOW = 0x4c957f2d;
const INCREMENT_HIGH = 0x14057b7e;
const INCREMENT_LOW = 0xf767814f;

function normalizeSeed(value) {
    if (!Number.isFinite(value)) return DEFAULT_SEED;
    return Math.max(0, Math.min(65535, Math.round(value)));
}

function multiplyHigh32(a, b) {
    const aLow = a & 0xffff;
    const aHigh = a >>> 16;
    const bLow = b & 0xffff;
    const bHigh = b >>> 16;
    const lowProduct = aLow * bLow;
    const middle = (lowProduct >>> 16) + aHigh * bLow + aLow * bHigh;
    return (aHigh * bHigh + Math.floor(middle / 0x10000)) >>> 0;
}

/**
 * PCG XSH-RR 64/32 with one fixed stream. State is held as unsigned 32-bit
 * halves so results do not depend on browser floating-point random sources.
 */
export function createPcg32(seed = DEFAULT_SEED) {
    let stateHigh = 0;
    let stateLow = 0;

    function nextUint32() {
        const oldHigh = stateHigh;
        const oldLow = stateLow;

        const shifted27 = ((oldLow >>> 27) | (oldHigh << 5)) >>> 0;
        const xorshifted = ((oldHigh >>> 13) ^ shifted27) >>> 0;
        const rotation = oldHigh >>> 27;
        const output = (
            (xorshifted >>> rotation) |
            (xorshifted << ((-rotation) & 31))
        ) >>> 0;

        const productLow = Math.imul(oldLow, MULTIPLIER_LOW) >>> 0;
        const productHigh = (
            multiplyHigh32(oldLow, MULTIPLIER_LOW) +
            Math.imul(oldLow, MULTIPLIER_HIGH) +
            Math.imul(oldHigh, MULTIPLIER_LOW)
        ) >>> 0;
        const lowWithIncrement = productLow + INCREMENT_LOW;
        const carry = lowWithIncrement >= 0x100000000 ? 1 : 0;
        stateLow = lowWithIncrement >>> 0;
        stateHigh = (productHigh + INCREMENT_HIGH + carry) >>> 0;

        return output;
    }

    function reseed(nextSeed = DEFAULT_SEED) {
        const visibleSeed = normalizeSeed(nextSeed);
        stateHigh = 0;
        stateLow = 0;
        nextUint32();
        const lowWithSeed = stateLow + visibleSeed;
        const carry = lowWithSeed >= 0x100000000 ? 1 : 0;
        stateLow = lowWithSeed >>> 0;
        stateHigh = (stateHigh + carry) >>> 0;
        nextUint32();
    }

    function bounded(bound) {
        if (!Number.isInteger(bound) || bound < 1 || bound > 0x100000000) {
            throw new RangeError('PCG32 bound must be an integer in [1, 2^32]');
        }
        const threshold = 0x100000000 % bound;
        let draw;
        do {
            draw = nextUint32();
        } while (draw < threshold);
        return draw % bound;
    }

    function getStateWords(target = null) {
        if (target) {
            target[0] = stateHigh;
            target[1] = stateLow;
            return target;
        }
        return [stateHigh, stateLow];
    }

    function setStateWords(high, low) {
        stateHigh = Number.isFinite(high) ? high >>> 0 : 0;
        stateLow = Number.isFinite(low) ? low >>> 0 : 0;
    }

    reseed(seed);
    return {
        nextUint32,
        bounded,
        reseed,
        getStateWords,
        setStateWords
    };
}
