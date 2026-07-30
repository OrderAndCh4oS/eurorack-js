/**
 * Pure planning oracle for CHANGES.
 *
 * These searches are used by tests and by the checked-in table generator. The
 * audio-thread process path only performs indexed reads from the generated
 * table and never calls these functions.
 */

export const SCALE_INTERVALS = Object.freeze([
    Object.freeze([0, 2, 4, 5, 7, 9, 11]),
    Object.freeze([0, 2, 3, 5, 7, 9, 10]),
    Object.freeze([0, 1, 3, 5, 7, 8, 10]),
    Object.freeze([0, 2, 4, 6, 7, 9, 11]),
    Object.freeze([0, 2, 4, 5, 7, 9, 10]),
    Object.freeze([0, 2, 3, 5, 7, 8, 10]),
    Object.freeze([0, 2, 3, 5, 7, 8, 11]),
    Object.freeze([0, 2, 3, 5, 7, 9, 11])
]);

export const PROGRESSION_DEGREES = Object.freeze([
    Object.freeze([0, 0, 0, 0]),
    Object.freeze([0, 3, 4, 0]),
    Object.freeze([0, 5, 3, 4]),
    Object.freeze([0, 4, 5, 3]),
    Object.freeze([5, 3, 0, 4]),
    Object.freeze([0, 5, 1, 4]),
    Object.freeze([1, 4, 0, 5]),
    Object.freeze([0, 6, 5, 4])
]);

export const VOICE_PERMUTATIONS = Object.freeze([
    Object.freeze([0, 1, 2, 3]),
    Object.freeze([0, 1, 3, 2]),
    Object.freeze([0, 2, 1, 3]),
    Object.freeze([0, 2, 3, 1]),
    Object.freeze([0, 3, 1, 2]),
    Object.freeze([0, 3, 2, 1]),
    Object.freeze([1, 0, 2, 3]),
    Object.freeze([1, 0, 3, 2]),
    Object.freeze([1, 2, 0, 3]),
    Object.freeze([1, 2, 3, 0]),
    Object.freeze([1, 3, 0, 2]),
    Object.freeze([1, 3, 2, 0]),
    Object.freeze([2, 0, 1, 3]),
    Object.freeze([2, 0, 3, 1]),
    Object.freeze([2, 1, 0, 3]),
    Object.freeze([2, 1, 3, 0]),
    Object.freeze([2, 3, 0, 1]),
    Object.freeze([2, 3, 1, 0]),
    Object.freeze([3, 0, 1, 2]),
    Object.freeze([3, 0, 2, 1]),
    Object.freeze([3, 1, 0, 2]),
    Object.freeze([3, 1, 2, 0]),
    Object.freeze([3, 2, 0, 1]),
    Object.freeze([3, 2, 1, 0])
]);

function compareNumericArrays(a, b) {
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index++) {
        const difference = (a[index] ?? 0) - (b[index] ?? 0);
        if (difference !== 0) return difference;
    }
    return 0;
}

export function constructSeventhChord(scale, degree) {
    const chord = new Array(4);
    for (let tone = 0; tone < 4; tone++) {
        const scaleIndex = degree + tone * 2;
        chord[tone] = scale[scaleIndex % 7] + 12 * Math.floor(scaleIndex / 7);
    }
    return chord;
}

export function createInversionCandidates(rawChord) {
    const candidates = [];
    const seen = new Set();

    for (let inversion = 0; inversion < 4; inversion++) {
        const inverted = new Array(4);
        for (let voice = 0; voice < 4; voice++) {
            const source = inversion + voice;
            inverted[voice] = rawChord[source % 4] + (source >= 4 ? 12 : 0);
        }

        const minimumOctave = Math.ceil((-12 - inverted[0]) / 12);
        const maximumOctave = Math.floor((24 - inverted[3]) / 12);
        for (let octave = minimumOctave; octave <= maximumOctave; octave++) {
            const shift = octave * 12;
            const candidate = inverted.map(note => note + shift);
            const key = candidate.join(',');
            if (!seen.has(key)) {
                seen.add(key);
                candidates.push(candidate);
            }
        }
    }

    candidates.sort(compareNumericArrays);
    return candidates;
}

export function scoreCyclicVoicingPlan(plan) {
    let totalMotion = 0;
    let maximumLeap = 0;
    let absolutePitchSum = 0;
    const flattened = new Array(16);

    for (let chord = 0; chord < 4; chord++) {
        const nextChord = (chord + 1) % 4;
        for (let voice = 0; voice < 4; voice++) {
            const pitch = plan[chord][voice];
            const leap = Math.abs(plan[nextChord][voice] - pitch);
            totalMotion += leap;
            if (leap > maximumLeap) maximumLeap = leap;
            absolutePitchSum += Math.abs(pitch);
            flattened[chord * 4 + voice] = pitch;
        }
    }

    return { totalMotion, maximumLeap, absolutePitchSum, flattened };
}

function compareVoicingScores(a, b) {
    return a.totalMotion - b.totalMotion ||
        a.maximumLeap - b.maximumLeap ||
        a.absolutePitchSum - b.absolutePitchSum ||
        compareNumericArrays(a.flattened, b.flattened);
}

export function compareCyclicVoicingPlans(a, b) {
    return compareVoicingScores(scoreCyclicVoicingPlan(a), scoreCyclicVoicingPlan(b));
}

export function chooseCyclicVoicingPlan(rawChords) {
    const candidates0 = createInversionCandidates(rawChords[0]);
    const candidates1 = createInversionCandidates(rawChords[1]);
    const candidates2 = createInversionCandidates(rawChords[2]);
    const candidates3 = createInversionCandidates(rawChords[3]);
    let bestPlan = null;
    let bestScore = null;

    for (let first = 0; first < candidates0.length; first++) {
        for (let second = 0; second < candidates1.length; second++) {
            for (let third = 0; third < candidates2.length; third++) {
                for (let fourth = 0; fourth < candidates3.length; fourth++) {
                    const plan = [
                        candidates0[first],
                        candidates1[second],
                        candidates2[third],
                        candidates3[fourth]
                    ];
                    const score = scoreCyclicVoicingPlan(plan);
                    if (bestScore === null || compareVoicingScores(score, bestScore) < 0) {
                        bestPlan = plan;
                        bestScore = score;
                    }
                }
            }
        }
    }

    return bestPlan.map(chord => [...chord]);
}

export function scoreMotionPath(notes, permutationIndices) {
    let totalMotion = 0;
    let maximumLeap = 0;
    for (let note = 0; note < 16; note++) {
        const leap = Math.abs(notes[(note + 1) % 16] - notes[note]);
        totalMotion += leap;
        if (leap > maximumLeap) maximumLeap = leap;
    }
    return {
        totalMotion,
        maximumLeap,
        notes: [...notes],
        permutationIndices: [...permutationIndices]
    };
}

function asMotionScore(path) {
    if (Number.isFinite(path.totalMotion) && Number.isFinite(path.maximumLeap)) return path;
    return scoreMotionPath(path.notes, path.permutationIndices);
}

export function compareMotionPaths(a, b) {
    const aScore = asMotionScore(a);
    const bScore = asMotionScore(b);
    return aScore.totalMotion - bScore.totalMotion ||
        aScore.maximumLeap - bScore.maximumLeap ||
        compareNumericArrays(aScore.notes, bScore.notes) ||
        compareNumericArrays(aScore.permutationIndices, bScore.permutationIndices);
}

function createPermutedChordNotes(voicingPlan) {
    return voicingPlan.map(chord => VOICE_PERMUTATIONS.map(permutation => [
        chord[permutation[0]],
        chord[permutation[1]],
        chord[permutation[2]],
        chord[permutation[3]]
    ]));
}

function internalMotion(notes) {
    const leap1 = Math.abs(notes[1] - notes[0]);
    const leap2 = Math.abs(notes[2] - notes[1]);
    const leap3 = Math.abs(notes[3] - notes[2]);
    return {
        total: leap1 + leap2 + leap3,
        maximum: Math.max(leap1, leap2, leap3)
    };
}

export function chooseMotionPaths(voicingPlan) {
    const permuted = createPermutedChordNotes(voicingPlan);
    const internal = permuted.map(chord => chord.map(internalMotion));
    const conditionalWinners = new Array(24);

    for (let first = 0; first < 24; first++) {
        let bestTotal = Infinity;
        let bestMaximum = Infinity;
        let bestSecond = 0;
        let bestThird = 0;
        let bestFourth = 0;
        const firstNotes = permuted[0][first];
        const firstInternal = internal[0][first];

        for (let second = 0; second < 24; second++) {
            const secondNotes = permuted[1][second];
            const secondInternal = internal[1][second];
            const boundary01 = Math.abs(secondNotes[0] - firstNotes[3]);

            for (let third = 0; third < 24; third++) {
                const thirdNotes = permuted[2][third];
                const thirdInternal = internal[2][third];
                const boundary12 = Math.abs(thirdNotes[0] - secondNotes[3]);

                for (let fourth = 0; fourth < 24; fourth++) {
                    const fourthNotes = permuted[3][fourth];
                    const fourthInternal = internal[3][fourth];
                    const boundary23 = Math.abs(fourthNotes[0] - thirdNotes[3]);
                    const boundary30 = Math.abs(firstNotes[0] - fourthNotes[3]);
                    const total = firstInternal.total + secondInternal.total +
                        thirdInternal.total + fourthInternal.total +
                        boundary01 + boundary12 + boundary23 + boundary30;
                    const maximum = Math.max(
                        firstInternal.maximum,
                        secondInternal.maximum,
                        thirdInternal.maximum,
                        fourthInternal.maximum,
                        boundary01,
                        boundary12,
                        boundary23,
                        boundary30
                    );

                    // Iteration follows lexicographic permutation/note order,
                    // so an exact score tie keeps the normative first tuple.
                    if (total < bestTotal || (total === bestTotal && maximum < bestMaximum)) {
                        bestTotal = total;
                        bestMaximum = maximum;
                        bestSecond = second;
                        bestThird = third;
                        bestFourth = fourth;
                    }
                }
            }
        }

        const permutationIndices = [first, bestSecond, bestThird, bestFourth];
        const notes = [
            ...permuted[0][first],
            ...permuted[1][bestSecond],
            ...permuted[2][bestThird],
            ...permuted[3][bestFourth]
        ];
        conditionalWinners[first] = {
            totalMotion: bestTotal,
            maximumLeap: bestMaximum,
            notes,
            permutationIndices
        };
    }

    conditionalWinners.sort(compareMotionPaths);
    return conditionalWinners.slice(0, 8).map(path => ({
        totalMotion: path.totalMotion,
        maximumLeap: path.maximumLeap,
        notes: [...path.notes],
        permutationIndices: [...path.permutationIndices]
    }));
}

export function getPlanTableIndex(scale, progression, motion, step) {
    return (((scale * 8) + progression) * 8 + motion) * 16 + step;
}

export function generateRelativePlanTable() {
    const table = new Int8Array(8 * 8 * 8 * 16);

    for (let scale = 0; scale < 8; scale++) {
        for (let progression = 0; progression < 8; progression++) {
            const rawChords = PROGRESSION_DEGREES[progression].map(degree =>
                constructSeventhChord(SCALE_INTERVALS[scale], degree)
            );
            const voicingPlan = chooseCyclicVoicingPlan(rawChords);
            const motionPaths = chooseMotionPaths(voicingPlan);
            for (let motion = 0; motion < 8; motion++) {
                for (let step = 0; step < 16; step++) {
                    table[getPlanTableIndex(scale, progression, motion, step)] =
                        motionPaths[motion].notes[step];
                }
            }
        }
    }

    return table;
}

export function checksumPlanTable(table) {
    let checksum = 0x811c9dc5;
    for (let index = 0; index < table.length; index++) {
        checksum ^= table[index] & 0xff;
        checksum = Math.imul(checksum, 0x01000193);
    }
    return checksum >>> 0;
}
