const CELL_COUNT = 8;
const LANE_COUNT = 4;
const CLOCKS_PER_CELL = 16;
const CLOCK_THRESHOLD = 2.5;
const RESET_THRESHOLD = 1;

const DEFAULT_SEED = 0;
const DEFAULT_LENGTH = 4;
const DEFAULT_AMOUNT = 1;
const DEFAULT_CHANCE = 20;

const PCG_MULTIPLIER_HIGH = 0x5851f42d;
const PCG_MULTIPLIER_LOW = 0x4c957f2d;
const PCG_INCREMENT_HIGH = 0x14057b7e;
const PCG_INCREMENT_LOW = 0xf767814f;

const LANE_MINIMUMS = Object.freeze([-12, 0, -20, -20]);
const LANE_MAXIMUMS = Object.freeze([12, 20, 20, 20]);
const LANE_MAX_DELTAS = Object.freeze([4, 3, 4, 4]);

function finiteInteger(value, fallback, minimum, maximum) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function finiteSwitch(value, fallback) {
    return Number.isFinite(value) ? value >= 0.5 : fallback;
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
 * halves so the worklet never needs arbitrary-precision arithmetic.
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

        const productLow = Math.imul(oldLow, PCG_MULTIPLIER_LOW) >>> 0;
        const productHigh = (
            multiplyHigh32(oldLow, PCG_MULTIPLIER_LOW) +
            Math.imul(oldLow, PCG_MULTIPLIER_HIGH) +
            Math.imul(oldHigh, PCG_MULTIPLIER_LOW)
        ) >>> 0;
        const lowWithIncrement = productLow + PCG_INCREMENT_LOW;
        const carry = lowWithIncrement >= 0x100000000 ? 1 : 0;
        stateLow = lowWithIncrement >>> 0;
        stateHigh = (productHigh + PCG_INCREMENT_HIGH + carry) >>> 0;

        return output;
    }

    function reseed(nextSeed = DEFAULT_SEED) {
        const visibleSeed = finiteInteger(nextSeed, DEFAULT_SEED, 0, 65535);
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

function createPatternBuffers() {
    const key = new Int8Array(CELL_COUNT);
    const harm = new Int8Array(CELL_COUNT);
    const energy = new Int8Array(CELL_COUNT);
    const mod = new Int8Array(CELL_COUNT);
    return {
        key,
        harm,
        energy,
        mod,
        lanes: [key, harm, energy, mod]
    };
}

function copyPattern(source, destination) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
        destination.lanes[lane].set(source.lanes[lane]);
    }
}

function clearPattern(pattern) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
        pattern.lanes[lane].fill(0);
    }
}

function fillBasePattern(pattern, prng) {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
        pattern.key[cell] = prng.bounded(25) - 12;
        pattern.harm[cell] = prng.bounded(21);
        pattern.energy[cell] = prng.bounded(41) - 20;
        pattern.mod[cell] = prng.bounded(41) - 20;
    }
}

function patternSnapshot(pattern) {
    return Array.from({ length: CELL_COUNT }, (_, cell) => ({
        key: pattern.key[cell],
        harm: pattern.harm[cell],
        energy: pattern.energy[cell],
        mod: pattern.mod[cell]
    }));
}

export function createRefrainBaseSnapshot(seed = DEFAULT_SEED) {
    const prng = createPcg32(seed);
    const pattern = createPatternBuffers();
    fillBasePattern(pattern, prng);
    return {
        cells: patternSnapshot(pattern),
        prngState: prng.getStateWords()
    };
}

export function applyRefrainDelta(value, delta, minimum, maximum) {
    const forward = Math.max(minimum, Math.min(maximum, value + delta));
    if (forward !== value) return forward;

    const reflected = Math.max(minimum, Math.min(maximum, value - delta));
    if (reflected !== value) return reflected;

    return value >= maximum ? maximum - 1 : minimum + 1;
}

function mutatePattern(
    source,
    candidate,
    activeLength,
    amount,
    prng,
    shuffle,
    lastMutationIndices,
    lastMutationDeltas
) {
    copyPattern(source, candidate);
    for (let cell = 0; cell < activeLength; cell++) shuffle[cell] = cell;

    const selectedCount = Math.min(amount, activeLength);
    lastMutationIndices.fill(-1);
    lastMutationDeltas.fill(0);

    for (let selection = 0; selection < selectedCount; selection++) {
        const swapIndex = selection + prng.bounded(activeLength - selection);
        const selectedCell = shuffle[swapIndex];
        shuffle[swapIndex] = shuffle[selection];
        shuffle[selection] = selectedCell;
        lastMutationIndices[selection] = selectedCell;
    }

    for (let selection = 0; selection < selectedCount; selection++) {
        const cell = lastMutationIndices[selection];
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            const magnitude = 1 + prng.bounded(LANE_MAX_DELTAS[lane]);
            const signedDelta = prng.bounded(2) === 0 ? -magnitude : magnitude;
            const current = source.lanes[lane][cell];
            candidate.lanes[lane][cell] = applyRefrainDelta(
                current,
                signedDelta,
                LANE_MINIMUMS[lane],
                LANE_MAXIMUMS[lane]
            );
            lastMutationDeltas[selection * LANE_COUNT + lane] = signedDelta;
        }
    }

    return selectedCount;
}

function fillHeldOutputs(outputs, pattern, cellIndex) {
    outputs.key.fill(pattern.key[cellIndex] / 12);
    outputs.harm.fill(pattern.harm[cellIndex] / 4);
    outputs.energy.fill(pattern.energy[cellIndex] / 4);
    outputs.mod.fill(pattern.mod[cellIndex] / 4);
}

export default {
    id: 'refrain',
    name: 'REFRAIN',
    hp: 10,
    color: 'module-color-ten',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clock = new Float32Array(bufferSize);
        const reset = new Float32Array(bufferSize);
        const key = new Float32Array(bufferSize);
        const harm = new Float32Array(bufferSize);
        const energy = new Float32Array(bufferSize);
        const mod = new Float32Array(bufferSize);
        const outputs = { key, harm, energy, mod };

        const basePattern = createPatternBuffers();
        const livePattern = createPatternBuffers();
        const candidatePattern = createPatternBuffers();
        const anchorPattern = createPatternBuffers();
        const shuffle = new Uint8Array(CELL_COUNT);
        const lastMutationIndices = new Int8Array(CELL_COUNT);
        const lastMutationDeltas = new Int8Array(CELL_COUNT * LANE_COUNT);
        const prngStateScratch = new Uint32Array(2);
        const prng = createPcg32(DEFAULT_SEED);
        const ledHoldSamples = Math.max(1, Math.round(sampleRate * 0.05));

        let activeSeed = DEFAULT_SEED;
        let activeLength = DEFAULT_LENGTH;
        let cellIndex = 0;
        let substepIndex = 0;
        let restartPending = true;
        let lastClockHigh = false;
        let lastResetHigh = false;
        let lastMutateHigh = false;
        let lastRecallHigh = false;
        let lastAnchorHold = false;
        let anchorValid = false;
        let pendingMutate = false;
        let pendingRecall = false;
        let pendingAmount = DEFAULT_AMOUNT;
        let lastMutationCount = 0;
        let firstProcessPending = true;
        let clockLedCounter = 0;
        let mutationLedCounter = 0;

        prng.reseed(activeSeed);
        fillBasePattern(basePattern, prng);
        copyPattern(basePattern, livePattern);
        copyPattern(basePattern, candidatePattern);
        clearPattern(anchorPattern);
        lastMutationIndices.fill(-1);
        fillHeldOutputs(outputs, livePattern, cellIndex);

        const instance = {
            params: {
                seed: DEFAULT_SEED,
                length: DEFAULT_LENGTH,
                amount: DEFAULT_AMOUNT,
                chance: DEFAULT_CHANCE,
                mutate: 0,
                anchor: 0,
                recall: 0
            },

            inputs: { clock, reset },
            outputs,
            leds: {
                cell1: 1,
                cell2: 0,
                cell3: 0,
                cell4: 0,
                cell5: 0,
                cell6: 0,
                cell7: 0,
                cell8: 0,
                substep: 1 / 64,
                anchor: 0,
                pending: 0,
                mutation: 0
            },

            process() {
                const requestedSeed = finiteInteger(
                    this.params.seed,
                    activeSeed,
                    0,
                    65535
                );
                const requestedLength = finiteInteger(
                    this.params.length,
                    activeLength,
                    1,
                    CELL_COUNT
                );
                const requestedAmount = finiteInteger(
                    this.params.amount,
                    DEFAULT_AMOUNT,
                    1,
                    CELL_COUNT
                );
                const requestedChance = finiteInteger(
                    this.params.chance,
                    DEFAULT_CHANCE,
                    0,
                    100
                );
                const anchorHold = finiteSwitch(this.params.anchor, lastAnchorHold);
                const mutateHigh = Number.isFinite(this.params.mutate) &&
                    this.params.mutate >= 0.5;
                const recallHigh = Number.isFinite(this.params.recall) &&
                    this.params.recall >= 0.5;

                // The production worklet assigns persisted params after
                // createDSP() and does not call reset(). Hydrate structural
                // state once before switch edges or clock samples so the
                // first audible tuple and a restored Hold use the saved Seed.
                // Restored high action params establish edge history only;
                // they are not new performance commands.
                if (firstProcessPending) {
                    firstProcessPending = false;
                    activeSeed = requestedSeed;
                    activeLength = requestedLength;
                    prng.reseed(activeSeed);
                    fillBasePattern(basePattern, prng);
                    copyPattern(basePattern, livePattern);
                    copyPattern(basePattern, candidatePattern);
                    cellIndex = 0;
                    substepIndex = 0;
                    restartPending = true;
                    fillHeldOutputs(outputs, livePattern, cellIndex);
                    lastMutateHigh = mutateHigh;
                    lastRecallHigh = recallHigh;
                }

                if (anchorHold && !lastAnchorHold) {
                    copyPattern(livePattern, anchorPattern);
                    anchorValid = true;
                }
                lastAnchorHold = anchorHold;

                if (mutateHigh && !lastMutateHigh) {
                    pendingMutate = true;
                    pendingAmount = requestedAmount;
                }
                if (recallHigh && !lastRecallHigh && anchorValid) {
                    pendingRecall = true;
                }
                lastMutateHigh = mutateHigh;
                lastRecallHigh = recallHigh;

                let acceptedClockThisBlock = false;
                for (let sample = 0; sample < bufferSize; sample++) {
                    const resetHigh = Number.isFinite(reset[sample]) &&
                        reset[sample] >= RESET_THRESHOLD;
                    const clockHigh = Number.isFinite(clock[sample]) &&
                        clock[sample] > CLOCK_THRESHOLD;
                    const resetRising = resetHigh && !lastResetHigh;
                    const clockRising = clockHigh && !lastClockHigh;
                    lastResetHigh = resetHigh;
                    lastClockHigh = clockHigh;

                    if (resetRising) {
                        restartPending = true;
                        if (clockRising) {
                            cellIndex = 0;
                            substepIndex = 0;
                            restartPending = false;
                            acceptedClockThisBlock = true;
                            clockLedCounter = ledHoldSamples;
                        }
                    } else if (clockRising) {
                        acceptedClockThisBlock = true;
                        clockLedCounter = ledHoldSamples;
                        if (restartPending) {
                            cellIndex = 0;
                            substepIndex = 0;
                            restartPending = false;
                        } else {
                            const completeLoopBoundary =
                                cellIndex === activeLength - 1 &&
                                substepIndex === CLOCKS_PER_CELL - 1;

                            if (completeLoopBoundary) {
                                if (requestedSeed !== activeSeed) {
                                    activeSeed = requestedSeed;
                                    prng.reseed(activeSeed);
                                    fillBasePattern(basePattern, prng);
                                    copyPattern(basePattern, livePattern);
                                }
                                if (requestedLength !== activeLength) {
                                    activeLength = requestedLength;
                                }

                                if (pendingRecall && anchorValid) {
                                    copyPattern(anchorPattern, livePattern);
                                    pendingRecall = false;
                                    pendingMutate = false;
                                } else if (pendingMutate) {
                                    lastMutationCount = mutatePattern(
                                        livePattern,
                                        candidatePattern,
                                        activeLength,
                                        Math.min(pendingAmount, activeLength),
                                        prng,
                                        shuffle,
                                        lastMutationIndices,
                                        lastMutationDeltas
                                    );
                                    copyPattern(candidatePattern, livePattern);
                                    pendingMutate = false;
                                    mutationLedCounter = ledHoldSamples;
                                } else if (!anchorHold && prng.bounded(100) < requestedChance) {
                                    lastMutationCount = mutatePattern(
                                        livePattern,
                                        candidatePattern,
                                        activeLength,
                                        Math.min(requestedAmount, activeLength),
                                        prng,
                                        shuffle,
                                        lastMutationIndices,
                                        lastMutationDeltas
                                    );
                                    copyPattern(candidatePattern, livePattern);
                                    mutationLedCounter = ledHoldSamples;
                                }

                                cellIndex = 0;
                                substepIndex = 0;
                            } else {
                                substepIndex++;
                                if (substepIndex === CLOCKS_PER_CELL) {
                                    substepIndex = 0;
                                    cellIndex++;
                                }
                            }
                        }
                    }

                    key[sample] = livePattern.key[cellIndex] / 12;
                    harm[sample] = livePattern.harm[cellIndex] / 4;
                    energy[sample] = livePattern.energy[cellIndex] / 4;
                    mod[sample] = livePattern.mod[cellIndex] / 4;
                    if (clockLedCounter > 0) clockLedCounter--;
                    if (mutationLedCounter > 0) mutationLedCounter--;
                }

                this.leds.cell1 = cellIndex === 0 ? 1 : 0;
                this.leds.cell2 = cellIndex === 1 && activeLength > 1 ? 1 : 0;
                this.leds.cell3 = cellIndex === 2 && activeLength > 2 ? 1 : 0;
                this.leds.cell4 = cellIndex === 3 && activeLength > 3 ? 1 : 0;
                this.leds.cell5 = cellIndex === 4 && activeLength > 4 ? 1 : 0;
                this.leds.cell6 = cellIndex === 5 && activeLength > 5 ? 1 : 0;
                this.leds.cell7 = cellIndex === 6 && activeLength > 6 ? 1 : 0;
                this.leds.cell8 = cellIndex === 7 && activeLength > 7 ? 1 : 0;
                this.leds.substep = acceptedClockThisBlock || clockLedCounter > 0
                    ? 1
                    : ((substepIndex + 1) / CLOCKS_PER_CELL) * 0.25;
                this.leds.anchor = anchorValid ? (anchorHold ? 1 : 0.5) : 0;
                this.leds.pending = pendingRecall ? 1 : (pendingMutate ? 0.5 : 0);
                this.leds.mutation = mutationLedCounter > 0 ? 1 : 0;
            },

            reset() {
                clock.fill(0);
                reset.fill(0);
                activeSeed = finiteInteger(this.params.seed, DEFAULT_SEED, 0, 65535);
                activeLength = finiteInteger(
                    this.params.length,
                    DEFAULT_LENGTH,
                    1,
                    CELL_COUNT
                );
                prng.reseed(activeSeed);
                fillBasePattern(basePattern, prng);
                copyPattern(basePattern, livePattern);
                copyPattern(basePattern, candidatePattern);
                clearPattern(anchorPattern);
                shuffle.fill(0);
                lastMutationIndices.fill(-1);
                lastMutationDeltas.fill(0);
                cellIndex = 0;
                substepIndex = 0;
                restartPending = true;
                lastClockHigh = false;
                lastResetHigh = false;
                lastMutateHigh = false;
                lastRecallHigh = false;
                lastAnchorHold = false;
                anchorValid = false;
                pendingMutate = false;
                pendingRecall = false;
                pendingAmount = DEFAULT_AMOUNT;
                lastMutationCount = 0;
                firstProcessPending = false;
                clockLedCounter = 0;
                mutationLedCounter = 0;
                this.params.mutate = 0;
                this.params.recall = 0;
                fillHeldOutputs(outputs, livePattern, cellIndex);
                this.leds.cell1 = 1;
                this.leds.cell2 = 0;
                this.leds.cell3 = 0;
                this.leds.cell4 = 0;
                this.leds.cell5 = 0;
                this.leds.cell6 = 0;
                this.leds.cell7 = 0;
                this.leds.cell8 = 0;
                this.leds.substep = 1 / 64;
                this.leds.anchor = 0;
                this.leds.pending = 0;
                this.leds.mutation = 0;
            },

            getDebugState() {
                prng.getStateWords(prngStateScratch);
                const mutationIndices = [];
                const mutationDeltas = [];
                for (let selection = 0; selection < lastMutationCount; selection++) {
                    mutationIndices.push(lastMutationIndices[selection]);
                    const deltaOffset = selection * LANE_COUNT;
                    mutationDeltas.push([
                        lastMutationDeltas[deltaOffset],
                        lastMutationDeltas[deltaOffset + 1],
                        lastMutationDeltas[deltaOffset + 2],
                        lastMutationDeltas[deltaOffset + 3]
                    ]);
                }
                return {
                    activeSeed,
                    activeLength,
                    cellIndex,
                    substepIndex,
                    restartPending,
                    anchorValid,
                    pendingMutate,
                    pendingRecall,
                    pendingAmount,
                    prngState: [prngStateScratch[0], prngStateScratch[1]],
                    basePattern: patternSnapshot(basePattern),
                    livePattern: patternSnapshot(livePattern),
                    anchorPattern: patternSnapshot(anchorPattern),
                    lastMutationIndices: mutationIndices,
                    lastMutationDeltas: mutationDeltas
                };
            }
        };

        return instance;
    },

    ui: {
        leds: [
            'cell1', 'cell2', 'cell3', 'cell4', 'cell5', 'cell6', 'cell7', 'cell8',
            'substep', 'anchor', 'pending', 'mutation'
        ],
        knobs: [
            { id: 'seed', label: 'Seed', param: 'seed', min: 0, max: 65535, default: 0, step: 1 },
            { id: 'length', label: 'Length', param: 'length', min: 1, max: 8, default: 4, step: 1 },
            { id: 'amount', label: 'Amount', param: 'amount', min: 1, max: 8, default: 1, step: 1 },
            { id: 'chance', label: 'Chance', param: 'chance', min: 0, max: 100, default: 20, step: 1 }
        ],
        switches: [
            { id: 'anchor', label: 'Anchor Run/Hold', param: 'anchor', default: 0 }
        ],
        actions: [
            { id: 'mutate', label: 'Mutate', param: 'mutate', mode: 'trigger', default: 0 },
            { id: 'recall', label: 'Recall', param: 'recall', mode: 'trigger', default: 0 }
        ],
        inputs: [
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'key', label: 'Key', port: 'key', signal: 'cv', voltage: { min: -1, max: 1 } },
            { id: 'harm', label: 'Harm', port: 'harm', signal: 'cv', voltage: { min: 0, max: 5 } },
            { id: 'energy', label: 'Energy', port: 'energy', signal: 'cv', voltage: { min: -5, max: 5 } },
            { id: 'mod', label: 'Mod', port: 'mod', signal: 'cv', voltage: { min: -5, max: 5 } }
        ]
    }
};
