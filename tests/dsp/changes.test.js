import { describe, expect, it } from 'vitest';
import changesModule, {
    PROGRESSION_DEGREES,
    SCALE_INTERVALS,
    VOICE_PERMUTATIONS,
    GENERATED_PLAN_TABLE_CHECKSUM,
    GENERATED_PLAN_TABLE_LENGTH,
    checksumPlanTable,
    chooseCyclicVoicingPlan,
    chooseMotionPaths,
    compareCyclicVoicingPlans,
    compareMotionPaths,
    computeChangesIndex,
    constructSeventhChord,
    createGeneratedPlanTableSnapshot,
    createInversionCandidates,
    generateRelativePlanTable,
    getPlanTableIndex,
    scoreCyclicVoicingPlan,
    scoreMotionPath
} from '../../src/js/modules/changes/index.js';
import cascadeModule from '../../src/js/modules/cascade/index.js';
import { expectExhaustivePanelCoverage } from './panel-test-helpers.js';

const DEFAULT_SAMPLE_RATE = 1000;
const DEFAULT_BUFFER_SIZE = 32;

function createChanges(options = {}) {
    return changesModule.createDSP({
        sampleRate: DEFAULT_SAMPLE_RATE,
        bufferSize: DEFAULT_BUFFER_SIZE,
        ...options
    });
}

function clearInputs(dsp) {
    Object.values(dsp.inputs).forEach(input => input.fill(0));
}

function clockOnce(dsp, {
    voltage = 10,
    keyCV = 0,
    changesCV = 0,
    reset = 0
} = {}) {
    clearInputs(dsp);
    dsp.inputs.keyCV.fill(keyCV);
    dsp.inputs.changesCV.fill(changesCV);
    dsp.inputs.clock[0] = voltage;
    dsp.inputs.reset[0] = reset;
    dsp.process();
    return {
        pitch: dsp.outputs.pitch[0],
        root: dsp.outputs.root[0],
        change: dsp.outputs.change[0],
        leds: { ...dsp.leds }
    };
}

function collectPhrase(dsp, options = {}) {
    return Array.from({ length: 16 }, () => clockOnce(dsp, options));
}

function compareNumbers(a, b) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i++) {
        const difference = (a[i] ?? 0) - (b[i] ?? 0);
        if (difference !== 0) return difference;
    }
    return 0;
}

function independentVoicingScore(plan) {
    let totalMotion = 0;
    let maximumLeap = 0;
    let absolutePitchSum = 0;
    for (let chord = 0; chord < 4; chord++) {
        for (let voice = 0; voice < 4; voice++) {
            const leap = Math.abs(plan[(chord + 1) % 4][voice] - plan[chord][voice]);
            totalMotion += leap;
            maximumLeap = Math.max(maximumLeap, leap);
            absolutePitchSum += Math.abs(plan[chord][voice]);
        }
    }
    return [totalMotion, maximumLeap, absolutePitchSum, ...plan.flat()];
}

function independentCompareVoicings(a, b) {
    return compareNumbers(independentVoicingScore(a), independentVoicingScore(b));
}

function bruteBestVoicing(rawChords) {
    const candidates = rawChords.map(createInversionCandidates);
    let best = null;
    for (const first of candidates[0]) {
        for (const second of candidates[1]) {
            for (const third of candidates[2]) {
                for (const fourth of candidates[3]) {
                    const plan = [first, second, third, fourth];
                    if (best === null || independentCompareVoicings(plan, best) < 0) {
                        best = plan;
                    }
                }
            }
        }
    }
    return best;
}

function independentMotionScore(notes, permutationIndices) {
    let totalMotion = 0;
    let maximumLeap = 0;
    for (let note = 0; note < 16; note++) {
        const leap = Math.abs(notes[(note + 1) % 16] - notes[note]);
        totalMotion += leap;
        maximumLeap = Math.max(maximumLeap, leap);
    }
    return { totalMotion, maximumLeap, notes, permutationIndices };
}

function independentCompareMotions(a, b) {
    return a.totalMotion - b.totalMotion ||
        a.maximumLeap - b.maximumLeap ||
        compareNumbers(a.notes, b.notes) ||
        compareNumbers(a.permutationIndices, b.permutationIndices);
}

function bruteMotionPaths(voicingPlan) {
    const permuted = voicingPlan.map(chord => VOICE_PERMUTATIONS.map(permutation =>
        permutation.map(voice => chord[voice])
    ));
    const internals = permuted.map(chord => chord.map(notes => {
        const leaps = [
            Math.abs(notes[1] - notes[0]),
            Math.abs(notes[2] - notes[1]),
            Math.abs(notes[3] - notes[2])
        ];
        return {
            total: leaps[0] + leaps[1] + leaps[2],
            maximum: Math.max(...leaps)
        };
    }));
    const winners = [];

    for (let first = 0; first < 24; first++) {
        let best = null;
        for (let second = 0; second < 24; second++) {
            const boundary01 = Math.abs(permuted[1][second][0] - permuted[0][first][3]);
            for (let third = 0; third < 24; third++) {
                const boundary12 = Math.abs(permuted[2][third][0] - permuted[1][second][3]);
                for (let fourth = 0; fourth < 24; fourth++) {
                    const boundary23 = Math.abs(permuted[3][fourth][0] - permuted[2][third][3]);
                    const boundary30 = Math.abs(permuted[0][first][0] - permuted[3][fourth][3]);
                    const totalMotion =
                        internals[0][first].total +
                        internals[1][second].total +
                        internals[2][third].total +
                        internals[3][fourth].total +
                        boundary01 +
                        boundary12 +
                        boundary23 +
                        boundary30;
                    const maximumLeap = Math.max(
                        internals[0][first].maximum,
                        internals[1][second].maximum,
                        internals[2][third].maximum,
                        internals[3][fourth].maximum,
                        boundary01,
                        boundary12,
                        boundary23,
                        boundary30
                    );
                    if (best === null ||
                        totalMotion < best.totalMotion ||
                        (totalMotion === best.totalMotion && maximumLeap < best.maximumLeap)) {
                        const choices = [first, second, third, fourth];
                        const notes = choices.flatMap((choice, chord) => permuted[chord][choice]);
                        best = independentMotionScore(notes, choices);
                    }
                }
            }
        }
        winners.push(best);
    }

    return winners.sort(independentCompareMotions).slice(0, 8);
}

function greedyVoicing(rawChords) {
    const chosen = [createInversionCandidates(rawChords[0])[0]];
    for (let chordIndex = 1; chordIndex < rawChords.length; chordIndex++) {
        const previous = chosen[chordIndex - 1];
        const candidates = createInversionCandidates(rawChords[chordIndex]);
        candidates.sort((a, b) => {
            const aMotion = a.reduce((sum, value, voice) => sum + Math.abs(value - previous[voice]), 0);
            const bMotion = b.reduce((sum, value, voice) => sum + Math.abs(value - previous[voice]), 0);
            return aMotion - bMotion || compareNumbers(a, b);
        });
        chosen.push(candidates[0]);
    }
    return chosen;
}

function phraseRawChords(scaleIndex, progressionIndex) {
    const scale = SCALE_INTERVALS[scaleIndex];
    return PROGRESSION_DEGREES[progressionIndex].map(degree =>
        constructSeventhChord(scale, degree)
    );
}

describe('CHANGES panel and initialization', () => {
    it('declares the exact metadata, controls, ports, voltages, normals, and LEDs', () => {
        expect(changesModule).toMatchObject({
            id: 'changes',
            name: 'CHANGES',
            hp: 8,
            color: 'module-color-nine',
            category: 'sequencer'
        });
        expect(changesModule.render).toBeUndefined();
        expect(changesModule.ui.knobs).toEqual([
            { id: 'key', label: 'Key', param: 'key', min: 0, max: 11, default: 0, step: 1 },
            { id: 'scale', label: 'Scale', param: 'scale', min: 0, max: 7, default: 0, step: 1 },
            { id: 'changes', label: 'Changes', param: 'changes', min: 0, max: 7, default: 1, step: 1 },
            { id: 'motion', label: 'Motion', param: 'motion', min: 0, max: 7, default: 0, step: 1 }
        ]);
        expect(changesModule.ui.actions).toEqual([
            { id: 'resetAction', label: 'Reset', param: 'resetAction', mode: 'trigger', default: 0 }
        ]);
        expect(changesModule.ui.inputs).toEqual([
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'keyCV', label: 'Key', port: 'keyCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'changesCV', label: 'Changes', port: 'changesCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ]);
        expect(changesModule.ui.outputs).toEqual([
            { id: 'pitch', label: 'Pitch', port: 'pitch', signal: 'cv', voltage: { min: -6, max: 95 / 12 } },
            { id: 'root', label: 'Root', port: 'root', signal: 'cv', voltage: { min: -5, max: 41 / 6 } },
            { id: 'change', label: 'Change', port: 'change', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]);
        expect(changesModule.ui.leds).toEqual(['chord1', 'chord2', 'chord3', 'chord4', 'pending']);

        expectExhaustivePanelCoverage(changesModule, {
            knobs: ['key', 'scale', 'changes', 'motion'],
            actions: ['resetAction'],
            inputs: ['clock', 'reset', 'keyCV', 'changesCV'],
            outputs: ['pitch', 'root', 'change'],
            leds: ['chord1', 'chord2', 'chord3', 'chord4', 'pending']
        });
    });

    it('creates exact defaults and stable block-sized zero buffers', () => {
        const dsp = createChanges({ sampleRate: 48000, bufferSize: 17 });
        expect(dsp.params).toEqual({
            key: 0,
            scale: 0,
            changes: 1,
            motion: 0,
            resetAction: 0
        });
        expect(Object.keys(dsp.inputs)).toEqual(['clock', 'reset', 'keyCV', 'changesCV']);
        expect(Object.keys(dsp.outputs)).toEqual(['pitch', 'root', 'change']);
        [...Object.values(dsp.inputs), ...Object.values(dsp.outputs)].forEach(buffer => {
            expect(buffer).toBeInstanceOf(Float32Array);
            expect(buffer).toHaveLength(17);
            expect([...buffer]).toEqual(Array(17).fill(0));
        });
        expect(dsp.leds).toEqual({
            chord1: 0,
            chord2: 0,
            chord3: 0,
            chord4: 0,
            pending: 0
        });
        expect(typeof dsp.process).toBe('function');
        expect(typeof dsp.reset).toBe('function');
    });

    it('fully writes finite outputs and preserves every buffer identity through process and reset', () => {
        const dsp = createChanges({ bufferSize: 19 });
        const inputRefs = { ...dsp.inputs };
        const outputRefs = { ...dsp.outputs };
        Object.values(dsp.inputs).forEach(input => input.fill(Number.NaN));
        Object.values(dsp.outputs).forEach(output => output.fill(Number.NaN));
        Object.assign(dsp.params, {
            key: Number.NaN,
            scale: Infinity,
            changes: -Infinity,
            motion: Number.NaN,
            resetAction: Number.NaN
        });

        dsp.process();
        Object.values(dsp.outputs).forEach(output => {
            expect(output.every(Number.isFinite)).toBe(true);
        });
        dsp.reset();

        Object.entries(inputRefs).forEach(([name, ref]) => {
            expect(dsp.inputs[name]).toBe(ref);
            expect([...ref]).toEqual(Array(19).fill(0));
        });
        Object.entries(outputRefs).forEach(([name, ref]) => {
            expect(dsp.outputs[name]).toBe(ref);
            expect([...ref]).toEqual(Array(19).fill(0));
        });
        expect(Object.values(dsp.leds).every(value => value === 0)).toBe(true);
        expect(dsp.params.resetAction).toBe(0);
    });
});

describe('CHANGES pure scale, voicing, motion, and generated-table planning', () => {
    it('contains the exact normative scale and progression data', () => {
        expect(SCALE_INTERVALS).toEqual([
            [0, 2, 4, 5, 7, 9, 11],
            [0, 2, 3, 5, 7, 9, 10],
            [0, 1, 3, 5, 7, 8, 10],
            [0, 2, 4, 6, 7, 9, 11],
            [0, 2, 4, 5, 7, 9, 10],
            [0, 2, 3, 5, 7, 8, 10],
            [0, 2, 3, 5, 7, 8, 11],
            [0, 2, 3, 5, 7, 9, 11]
        ]);
        expect(PROGRESSION_DEGREES).toEqual([
            [0, 0, 0, 0],
            [0, 3, 4, 0],
            [0, 5, 3, 4],
            [0, 4, 5, 3],
            [5, 3, 0, 4],
            [0, 5, 1, 4],
            [1, 4, 0, 5],
            [0, 6, 5, 4]
        ]);
        expect(VOICE_PERMUTATIONS).toHaveLength(24);
        expect(new Set(VOICE_PERMUTATIONS.map(permutation => permutation.join(','))).size).toBe(24);
        expect([...VOICE_PERMUTATIONS].sort(compareNumbers)).toEqual(VOICE_PERMUTATIONS);
    });

    it('constructs seventh chords with octave carry for every scale and degree', () => {
        expect(constructSeventhChord(SCALE_INTERVALS[0], 0)).toEqual([0, 4, 7, 11]);
        expect(constructSeventhChord(SCALE_INTERVALS[0], 1)).toEqual([2, 5, 9, 12]);
        expect(constructSeventhChord(SCALE_INTERVALS[0], 4)).toEqual([7, 11, 14, 17]);
        expect(constructSeventhChord(SCALE_INTERVALS[0], 6)).toEqual([11, 14, 17, 21]);

        SCALE_INTERVALS.forEach(scale => {
            for (let degree = 0; degree < 7; degree++) {
                const chord = constructSeventhChord(scale, degree);
                expect(chord).toHaveLength(4);
                expect(chord.every((note, index) => index === 0 || note > chord[index - 1])).toBe(true);
                expect(new Set(chord.map(note => ((note % 12) + 12) % 12)).size).toBe(4);
                chord.forEach((note, tone) => {
                    const scaleIndex = degree + tone * 2;
                    expect(note).toBe(scale[scaleIndex % 7] + 12 * Math.floor(scaleIndex / 7));
                });
            }
        });
    });

    it('enumerates, deduplicates, bounds, and lexically orders every inversion candidate register', () => {
        for (let scale = 0; scale < 8; scale++) {
            for (let degree = 0; degree < 7; degree++) {
                const raw = constructSeventhChord(SCALE_INTERVALS[scale], degree);
                const candidates = createInversionCandidates(raw);
                expect(candidates.length).toBeGreaterThan(0);
                expect(new Set(candidates.map(candidate => candidate.join(','))).size).toBe(candidates.length);
                expect([...candidates].sort(compareNumbers)).toEqual(candidates);
                candidates.forEach(candidate => {
                    expect(candidate).toHaveLength(4);
                    expect(candidate[0]).toBeGreaterThanOrEqual(-12);
                    expect(candidate[3]).toBeLessThanOrEqual(24);
                    expect(candidate.every((note, index) => index === 0 || note > candidate[index - 1])).toBe(true);
                    expect(candidate.map(note => ((note % 12) + 12) % 12).sort((a, b) => a - b))
                        .toEqual(raw.map(note => note % 12).sort((a, b) => a - b));
                });
            }
        }
    });

    it('scores and compares cyclic voicings using every normative tie-break', () => {
        const compact = [[0, 4, 7, 11], [0, 4, 7, 11], [0, 4, 7, 11], [0, 4, 7, 11]];
        const shifted = compact.map(chord => chord.map(note => note + 12));
        expect(scoreCyclicVoicingPlan(compact)).toEqual({
            totalMotion: 0,
            maximumLeap: 0,
            absolutePitchSum: 88,
            flattened: compact.flat()
        });
        expect(compareCyclicVoicingPlans(compact, shifted)).toBeLessThan(0);

        const lowerTotal = [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 4]];
        const higherTotal = [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 5]];
        expect(compareCyclicVoicingPlans(lowerTotal, higherTotal)).toBeLessThan(0);

        const equalTotalLowerMax = [[0, 0, 0, 0], [2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        const equalTotalHigherMax = [[0, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        expect(scoreCyclicVoicingPlan(equalTotalLowerMax).totalMotion)
            .toBe(scoreCyclicVoicingPlan(equalTotalHigherMax).totalMotion);
        expect(compareCyclicVoicingPlans(equalTotalLowerMax, equalTotalHigherMax)).toBeLessThan(0);

        const flattenedLater = [[-1, 0, 2, 2], [0, 0, 1, 0], [0, 2, 1, 1], [-2, -1, 0, 1]];
        const flattenedEarlier = [[-2, 0, 0, -1], [0, 0, -2, 0], [2, 0, -1, -1], [1, 1, -2, -1]];
        const laterScore = scoreCyclicVoicingPlan(flattenedLater);
        const earlierScore = scoreCyclicVoicingPlan(flattenedEarlier);
        expect([
            earlierScore.totalMotion,
            earlierScore.maximumLeap,
            earlierScore.absolutePitchSum
        ]).toEqual([
            laterScore.totalMotion,
            laterScore.maximumLeap,
            laterScore.absolutePitchSum
        ]);
        expect(compareCyclicVoicingPlans(flattenedEarlier, flattenedLater)).toBeLessThan(0);
    });

    it('matches an independent exhaustive cyclic oracle for all 64 scale/progression plans', () => {
        let greedyLosses = 0;
        for (let scale = 0; scale < 8; scale++) {
            for (let progression = 0; progression < 8; progression++) {
                const rawChords = phraseRawChords(scale, progression);
                const expected = bruteBestVoicing(rawChords);
                const actual = chooseCyclicVoicingPlan(rawChords);
                expect(actual).toEqual(expected);
                if (independentCompareVoicings(actual, greedyVoicing(rawChords)) < 0) greedyLosses++;
            }
        }
        expect(greedyLosses).toBeGreaterThan(0);
    }, 30000);

    it('scores cyclic monophonic paths and applies note then permutation tie-breaks', () => {
        const notes = Array.from({ length: 16 }, (_, index) => index);
        expect(scoreMotionPath(notes, [0, 1, 2, 3])).toEqual({
            totalMotion: 30,
            maximumLeap: 15,
            notes,
            permutationIndices: [0, 1, 2, 3]
        });
        const lexEarlier = { notes: [...notes], permutationIndices: [0, 1, 2, 3] };
        const lexLater = { notes: [...notes.slice(0, 15), 16], permutationIndices: [0, 1, 2, 3] };
        expect(compareMotionPaths(lexEarlier, lexLater)).toBeLessThan(0);
        expect(compareMotionPaths(
            { totalMotion: 10, maximumLeap: 4, notes: [0, 1], permutationIndices: [0] },
            { totalMotion: 10, maximumLeap: 4, notes: [0, 2], permutationIndices: [0] }
        )).toBeLessThan(0);
        expect(compareMotionPaths(
            { notes, permutationIndices: [0, 1, 2, 3] },
            { notes, permutationIndices: [0, 1, 3, 2] }
        )).toBeLessThan(0);
    });

    it('keeps eight deterministic conditional Motion winners with distinct first permutations and sorted score', () => {
        for (let scale = 0; scale < 8; scale++) {
            for (let progression = 0; progression < 8; progression++) {
                const voicing = chooseCyclicVoicingPlan(phraseRawChords(scale, progression));
                const motions = chooseMotionPaths(voicing);
                expect(motions).toEqual(bruteMotionPaths(voicing));
                expect(motions).toHaveLength(8);
                expect(new Set(motions.map(path => path.permutationIndices[0])).size).toBe(8);
                for (let motion = 0; motion < motions.length; motion++) {
                    const path = motions[motion];
                    expect(path.notes).toHaveLength(16);
                    expect(path.permutationIndices).toHaveLength(4);
                    expect(scoreMotionPath(path.notes, path.permutationIndices)).toEqual(path);
                    if (motion > 0) {
                        expect(compareMotionPaths(motions[motion - 1], path)).toBeLessThanOrEqual(0);
                    }
                }
            }
        }
    }, 30000);

    it('regenerates all 8,192 checked-in entries exactly and keeps indexing/checksum deterministic', () => {
        const generated = generateRelativePlanTable();
        const checkedIn = createGeneratedPlanTableSnapshot();
        expect(generated).toBeInstanceOf(Int8Array);
        expect(checkedIn).toBeInstanceOf(Int8Array);
        expect(GENERATED_PLAN_TABLE_LENGTH).toBe(8192);
        expect(generated).toHaveLength(GENERATED_PLAN_TABLE_LENGTH);
        expect(checkedIn).toHaveLength(GENERATED_PLAN_TABLE_LENGTH);
        expect([...checkedIn]).toEqual([...generated]);
        expect(checksumPlanTable(checkedIn)).toBe(GENERATED_PLAN_TABLE_CHECKSUM);
        expect(checksumPlanTable(generated)).toBe(GENERATED_PLAN_TABLE_CHECKSUM);

        for (let scale = 0; scale < 8; scale++) {
            for (let progression = 0; progression < 8; progression++) {
                for (let motion = 0; motion < 8; motion++) {
                    for (let step = 0; step < 16; step++) {
                        const index = getPlanTableIndex(scale, progression, motion, step);
                        expect(index).toBe((((scale * 8) + progression) * 8 + motion) * 16 + step);
                        expect(checkedIn[index]).toBe(generated[index]);
                    }
                }
            }
        }
        expect(Math.min(...checkedIn)).toBeGreaterThanOrEqual(-12);
        expect(Math.max(...checkedIn)).toBeLessThanOrEqual(24);
        const firstValue = checkedIn[0];
        checkedIn[0] = firstValue + 1;
        expect(createGeneratedPlanTableSnapshot()[0]).toBe(firstValue);
    }, 30000);
});

describe('CHANGES clocking, harmony, latching, voltages, LEDs, and triggers', () => {
    it('accepts only genuine rising edges strictly above 2.5V and starts at step zero', () => {
        const atThreshold = createChanges();
        expect(clockOnce(atThreshold, { voltage: 2.5 })).toMatchObject({
            pitch: 0,
            root: 0,
            change: 0,
            leds: { chord1: 0, chord2: 0, chord3: 0, chord4: 0 }
        });

        const aboveThreshold = createChanges({ bufferSize: 8 });
        aboveThreshold.inputs.clock.fill(2.5001);
        aboveThreshold.process();
        expect(aboveThreshold.outputs.change[0]).toBe(10);
        expect(aboveThreshold.leds.chord1).toBe(1);
        const heldPitch = aboveThreshold.outputs.pitch[0];
        aboveThreshold.process();
        expect(aboveThreshold.outputs.pitch[0]).toBe(heldPitch);
        expect(aboveThreshold.leds.chord1).toBe(1);
        aboveThreshold.inputs.clock.fill(0);
        aboveThreshold.process();
        aboveThreshold.inputs.clock.fill(10);
        aboveThreshold.process();
        expect(aboveThreshold.leds.chord1).toBe(1);
    });

    it('plays every generated pitch, exact uninverted root, chord LED group, and 16-step wrap', () => {
        const table = createGeneratedPlanTableSnapshot();
        for (let scale = 0; scale < 8; scale++) {
            for (let progression = 0; progression < 8; progression++) {
                for (let motion = 0; motion < 8; motion++) {
                    const dsp = createChanges();
                    Object.assign(dsp.params, { key: 0, scale, changes: progression, motion });
                    const phrase = collectPhrase(dsp);
                    phrase.forEach((frame, step) => {
                        const relative = table[getPlanTableIndex(scale, progression, motion, step)];
                        const chordSlot = Math.floor(step / 4);
                        const degree = PROGRESSION_DEGREES[progression][chordSlot];
                        expect(frame.pitch).toBeCloseTo(relative / 12, 6);
                        expect(frame.root).toBeCloseTo(SCALE_INTERVALS[scale][degree] / 12, 6);
                        for (let led = 0; led < 4; led++) {
                            expect(frame.leds[`chord${led + 1}`]).toBe(led === chordSlot ? 1 : 0);
                        }
                        const chordPitchClasses = constructSeventhChord(SCALE_INTERVALS[scale], degree)
                            .map(note => note % 12);
                        expect(chordPitchClasses).toContain(((relative % 12) + 12) % 12);
                    });
                    const wrapped = clockOnce(dsp);
                    expect(wrapped.pitch).toBeCloseTo(phrase[0].pitch, 6);
                    expect(wrapped.root).toBeCloseTo(phrase[0].root, 6);
                    expect(wrapped.leds.chord1).toBe(1);
                }
            }
        }
    }, 30000);

    it('phrase-latches Key, Scale, Changes, Motion, and Changes CV atomically with Pending feedback', () => {
        const table = createGeneratedPlanTableSnapshot();
        const dsp = createChanges();
        clockOnce(dsp);
        Object.assign(dsp.params, { key: 11, scale: 7, changes: 0, motion: 7 });
        clearInputs(dsp);
        dsp.inputs.changesCV.fill(5);
        dsp.process();
        expect(dsp.leds.pending).toBe(1);

        for (let step = 1; step < 16; step++) {
            const frame = clockOnce(dsp, { changesCV: 5 });
            const oldRelative = table[getPlanTableIndex(0, 1, 0, step)];
            const oldDegree = PROGRESSION_DEGREES[1][Math.floor(step / 4)];
            expect(frame.pitch).toBeCloseTo(oldRelative / 12, 6);
            expect(frame.root).toBeCloseTo(SCALE_INTERVALS[0][oldDegree] / 12, 6);
            expect(frame.leds.pending).toBe(1);
        }

        const committed = clockOnce(dsp, { changesCV: 5 });
        const newRelative = table[getPlanTableIndex(7, 7, 7, 0)];
        expect(committed.pitch).toBeCloseTo((11 + newRelative) / 12, 6);
        expect(committed.root).toBeCloseTo((11 + SCALE_INTERVALS[7][PROGRESSION_DEGREES[7][0]]) / 12, 6);
        expect(committed.leds.pending).toBe(0);
    });

    it('shows Pending immediately for a Changes knob edit before another clock arrives', () => {
        const dsp = createChanges();
        clockOnce(dsp);
        clearInputs(dsp);
        dsp.params.changes = 2;
        dsp.process();
        expect(dsp.leds.pending).toBe(1);
        dsp.params.changes = 1;
        dsp.process();
        expect(dsp.leds.pending).toBe(0);
    });

    it('shows every pre-clock structural edit as pending and commits it on the first clock', () => {
        const edits = [
            ['key', 11],
            ['scale', 7],
            ['changes', 6],
            ['motion', 5]
        ];

        edits.forEach(([param, value]) => {
            const dsp = createChanges();
            dsp.params[param] = value;
            clearInputs(dsp);
            dsp.process();
            expect(dsp.leds.pending, param).toBe(1);
            expect(clockOnce(dsp).leds.pending, param).toBe(0);
        });
    });

    it('uses exact Changes CV scaling, rounding, clamping, normal, and non-finite fallback', () => {
        expect(computeChangesIndex(0, -5)).toBe(0);
        expect(computeChangesIndex(0, 5)).toBe(7);
        expect(computeChangesIndex(7, -5)).toBe(0);
        expect(computeChangesIndex(7, 5)).toBe(7);
        expect(computeChangesIndex(3, 0)).toBe(3);
        expect(computeChangesIndex(3, 0.35)).toBe(3);
        expect(computeChangesIndex(3, 0.36)).toBe(4);
        expect(computeChangesIndex(3.4, 0.1)).toBe(4);
        expect(computeChangesIndex(5.6, -0.1)).toBe(5);
        expect(computeChangesIndex(Number.NaN, Number.NaN)).toBe(1);
        expect(computeChangesIndex(Infinity, Infinity)).toBe(1);

        const table = createGeneratedPlanTableSnapshot();
        const cases = [
            { knob: 0, cv: -5, expected: 0 },
            { knob: 0, cv: 5, expected: 7 },
            { knob: 7, cv: -5, expected: 0 },
            { knob: 7, cv: 5, expected: 7 },
            { knob: 3, cv: 0, expected: 3 },
            { knob: 3.4, cv: 0.1, expected: 4 },
            { knob: 5.6, cv: -0.1, expected: 5 },
            { knob: Number.NaN, cv: Number.NaN, expected: 1 }
        ];
        cases.forEach(({ knob, cv, expected }) => {
            const dsp = createChanges();
            dsp.params.changes = knob;
            const frame = clockOnce(dsp, { changesCV: cv });
            expect(frame.pitch).toBeCloseTo(table[getPlanTableIndex(0, expected, 0, 0)] / 12, 6);
        });
    });

    it('samples Key CV on every clock, holds between clocks, and transposes Pitch and Root exactly 1V/oct', () => {
        const dsp = createChanges();
        const first = clockOnce(dsp, { keyCV: -5 });
        expect(first.pitch).toBeGreaterThanOrEqual(-6);
        expect(first.root).toBe(-5);

        clearInputs(dsp);
        dsp.inputs.keyCV.fill(5);
        dsp.process();
        expect(dsp.outputs.pitch.every(value => value === first.pitch)).toBe(true);
        expect(dsp.outputs.root.every(value => value === first.root)).toBe(true);

        const transposed = createChanges();
        const second = clockOnce(transposed, { keyCV: -4 });
        expect(second.pitch - first.pitch).toBeCloseTo(1, 6);
        expect(second.root - first.root).toBeCloseTo(1, 6);

        const clamped = clockOnce(dsp, { keyCV: 100 });
        expect(clamped.pitch).toBeLessThanOrEqual(95 / 12);
        expect(clamped.root).toBeLessThanOrEqual(41 / 6);
        const finite = clockOnce(dsp, { keyCV: Number.NaN });
        expect(Number.isFinite(finite.pitch)).toBe(true);
        expect(Number.isFinite(finite.root)).toBe(true);
    });

    it('samples changing Key and Changes CV independently on multiple clock edges in one block', () => {
        const dsp = createChanges({ bufferSize: 6 });
        const table = createGeneratedPlanTableSnapshot();
        dsp.inputs.clock[0] = 10;
        dsp.inputs.clock[2] = 10;
        dsp.inputs.keyCV[0] = -1;
        dsp.inputs.keyCV[1] = -1;
        dsp.inputs.keyCV[2] = 1;
        dsp.inputs.changesCV[0] = 0;
        dsp.inputs.changesCV[2] = 5;
        dsp.process();

        const step0 = table[getPlanTableIndex(0, 1, 0, 0)] / 12 - 1;
        const step1 = table[getPlanTableIndex(0, 1, 0, 1)] / 12 + 1;
        expect(dsp.outputs.pitch[0]).toBeCloseTo(step0, 6);
        expect(dsp.outputs.pitch[1]).toBeCloseTo(step0, 6);
        expect(dsp.outputs.pitch[2]).toBeCloseTo(step1, 6);
        expect(dsp.outputs.pitch[5]).toBeCloseTo(step1, 6);
        expect(dsp.leds.pending).toBe(1);
    });

    it('keeps Root independent of Motion while every Pitch remains within its declared rail', () => {
        const roots = [];
        for (let motion = 0; motion < 8; motion++) {
            const dsp = createChanges();
            Object.assign(dsp.params, { key: 11, scale: 6, changes: 7, motion });
            roots.push(collectPhrase(dsp, { keyCV: 5 }).map(frame => frame.root));
            collectPhrase(dsp, { keyCV: -5 }).forEach(frame => {
                expect(frame.pitch).toBeGreaterThanOrEqual(-6);
                expect(frame.pitch).toBeLessThanOrEqual(95 / 12);
                expect(frame.root).toBeGreaterThanOrEqual(-5);
                expect(frame.root).toBeLessThanOrEqual(41 / 6);
            });
        }
        roots.slice(1).forEach(rootPhrase => expect(rootPhrase).toEqual(roots[0]));
    });

    it('emits scheduled Change pulses at 0/4/8/12 even for Pedal and with exact 8ms duration', () => {
        const pedal = createChanges();
        pedal.params.changes = 0;
        const events = collectPhrase(pedal).map(frame => frame.change);
        expect(events.map((value, step) => value === 10 ? step : -1).filter(step => step >= 0))
            .toEqual([0, 4, 8, 12]);

        for (const sampleRate of [1000, 44100, 48000]) {
            const pulseSamples = Math.max(1, Math.round(sampleRate * 0.008));
            const dsp = createChanges({ sampleRate, bufferSize: pulseSamples + 5 });
            dsp.inputs.clock[0] = 10;
            dsp.process();
            expect([...dsp.outputs.change.slice(0, pulseSamples)]).toEqual(Array(pulseSamples).fill(10));
            expect([...dsp.outputs.change.slice(pulseSamples)]).toEqual(Array(5).fill(0));
        }
    });

    it('retriggering Change restarts its fixed counter', () => {
        const dsp = createChanges({ sampleRate: 2000, bufferSize: 30 });
        for (const sample of [0, 2, 4, 6, 8]) dsp.inputs.clock[sample] = 10;
        dsp.process();
        expect([...dsp.outputs.change.slice(0, 24)]).toEqual(Array(24).fill(10));
        expect([...dsp.outputs.change.slice(24)]).toEqual(Array(6).fill(0));
    });
});

describe('CHANGES reset distinctions and deterministic replay', () => {
    it('external reset cancels Change, holds Pitch/Root/chord LEDs, sets Pending, and restarts on the next clock', () => {
        const dsp = createChanges({ bufferSize: 4 });
        clockOnce(dsp);
        const heldPitch = dsp.outputs.pitch[0];
        const heldRoot = dsp.outputs.root[0];
        clearInputs(dsp);
        dsp.inputs.reset[0] = 1;
        dsp.process();
        expect([...dsp.outputs.change]).toEqual([0, 0, 0, 0]);
        expect([...dsp.outputs.pitch]).toEqual(Array(4).fill(heldPitch));
        expect([...dsp.outputs.root]).toEqual(Array(4).fill(heldRoot));
        expect(dsp.leds.chord1).toBe(1);
        expect(dsp.leds.pending).toBe(1);

        const restarted = clockOnce(dsp);
        expect(restarted.change).toBe(10);
        expect(restarted.leds.chord1).toBe(1);
        expect(restarted.leds.pending).toBe(0);
    });

    it('detects held reset once, waits through an already-high clock, and accepts same-sample Reset+Clock', () => {
        const dsp = createChanges({ bufferSize: 4 });
        clockOnce(dsp);
        clearInputs(dsp);
        dsp.inputs.clock.fill(10);
        dsp.process();
        const beforeReset = dsp.outputs.pitch[0];

        dsp.inputs.reset.fill(10);
        dsp.process();
        expect(dsp.outputs.pitch[0]).toBe(beforeReset);
        expect(dsp.outputs.change.every(value => value === 0)).toBe(true);
        expect(dsp.leds.pending).toBe(1);
        dsp.process();
        expect(dsp.outputs.change.every(value => value === 0)).toBe(true);

        clearInputs(dsp);
        dsp.process();
        const restarted = clockOnce(dsp);
        expect(restarted.change).toBe(10);
        expect(restarted.leds.chord1).toBe(1);

        clockOnce(dsp);
        const simultaneous = clockOnce(dsp, { reset: 10 });
        expect(simultaneous.change).toBe(10);
        expect(simultaneous.leds.chord1).toBe(1);
    });

    it('independently edge-detects Reset action and lifecycle reset clears all runtime state', () => {
        const dsp = createChanges({ bufferSize: 8 });
        collectPhrase(dsp);
        clearInputs(dsp);
        dsp.params.resetAction = 1;
        dsp.process();
        expect(dsp.leds.pending).toBe(1);
        dsp.process();
        expect(dsp.leds.pending).toBe(1);
        dsp.params.resetAction = 0;
        dsp.process();
        const restarted = clockOnce(dsp);
        expect(restarted.change).toBe(10);
        expect(restarted.leds.chord1).toBe(1);

        Object.values(dsp.inputs).forEach(input => input.fill(10));
        Object.values(dsp.outputs).forEach(output => output.fill(10));
        dsp.reset();
        expect(Object.values(dsp.inputs).every(input => input.every(value => value === 0))).toBe(true);
        expect(Object.values(dsp.outputs).every(output => output.every(value => value === 0))).toBe(true);
        expect(Object.values(dsp.leds).every(value => value === 0)).toBe(true);
        expect(clockOnce(dsp).leds.chord1).toBe(1);
    });

    it('fresh instances, lifecycle resets, sample rates, and block sizes replay the same held sequence', () => {
        const options = [
            { sampleRate: 1000, bufferSize: 17 },
            { sampleRate: 44100, bufferSize: 64 },
            { sampleRate: 48000, bufferSize: 257 }
        ];
        const phrases = options.map(option => {
            const dsp = createChanges(option);
            Object.assign(dsp.params, { key: 4, scale: 6, changes: 5, motion: 7 });
            const first = collectPhrase(dsp, { keyCV: -1.25 }).map(({ pitch, root }) => [pitch, root]);
            dsp.reset();
            const replay = collectPhrase(dsp, { keyCV: -1.25 }).map(({ pitch, root }) => [pitch, root]);
            expect(replay).toEqual(first);
            return first;
        });
        phrases.slice(1).forEach(phrase => expect(phrase).toEqual(phrases[0]));
    });
});

describe('CHANGES + CASCADE pair integration', () => {
    function createPair(fill) {
        const changes = createChanges();
        const cascade = cascadeModule.createDSP({
            sampleRate: DEFAULT_SAMPLE_RATE,
            bufferSize: DEFAULT_BUFFER_SIZE
        });
        Object.assign(changes.params, { key: 2, scale: 0, changes: 1, motion: 3 });
        cascade.params.fill = fill;
        return { changes, cascade };
    }

    function collectPairPhrase(pair) {
        const frames = [];
        for (let step = 0; step < 16; step++) {
            clearInputs(pair.changes);
            Object.values(pair.cascade.inputs).forEach(input => input.fill(0));
            pair.changes.inputs.clock[0] = 10;
            pair.cascade.inputs.clock[0] = 10;
            pair.changes.process();
            pair.cascade.process();
            frames.push({
                pitch: pair.changes.outputs.pitch[0],
                root: pair.changes.outputs.root[0],
                change: pair.changes.outputs.change[0],
                lanes: [1, 2, 3, 4].map(lane => pair.cascade.outputs[`lane${lane}`][0])
            });
        }
        return frames;
    }

    it('advances harmony on every common raw clock through Cascade rests', () => {
        const pair = createPair(1);
        const phrase = collectPairPhrase(pair);
        const table = createGeneratedPlanTableSnapshot();
        phrase.forEach((frame, step) => {
            expect(frame.pitch).toBeCloseTo(
                (2 + table[getPlanTableIndex(0, 1, 3, step)]) / 12,
                6
            );
        });
        expect(phrase.filter(frame => frame.lanes[2] === 0)).not.toHaveLength(0);
    });

    it('retains every articulated pitch position as Fill increases', () => {
        const sparse = collectPairPhrase(createPair(4));
        const dense = collectPairPhrase(createPair(12));
        sparse.forEach((frame, step) => {
            if (frame.lanes[2] === 10) {
                expect(dense[step].lanes[2]).toBe(10);
                expect(dense[step].pitch).toBe(frame.pitch);
            }
        });
    });

    it('shared reset exactly replays harmony and all four lanes', () => {
        const pair = createPair(9);
        const first = collectPairPhrase(pair);
        clearInputs(pair.changes);
        Object.values(pair.cascade.inputs).forEach(input => input.fill(0));
        pair.changes.inputs.reset[0] = 10;
        pair.cascade.inputs.reset[0] = 10;
        pair.changes.process();
        pair.cascade.process();
        expect(collectPairPhrase(pair)).toEqual(first);
    });
});
