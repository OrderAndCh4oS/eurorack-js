import { clamp } from '../../utils/math.js';
import {
    PROGRESSION_DEGREES,
    SCALE_INTERVALS,
    checksumPlanTable,
    chooseCyclicVoicingPlan,
    chooseMotionPaths,
    compareCyclicVoicingPlans,
    compareMotionPaths,
    constructSeventhChord,
    createInversionCandidates,
    generateRelativePlanTable,
    getPlanTableIndex,
    scoreCyclicVoicingPlan,
    scoreMotionPath,
    VOICE_PERMUTATIONS
} from './planning.js';
import {
    createGeneratedPlanTableSnapshot,
    GENERATED_PLAN_TABLE_CHECKSUM,
    GENERATED_PLAN_TABLE_LENGTH,
    getGeneratedPlanValue
} from './generated-plan-table.js';

export {
    PROGRESSION_DEGREES,
    SCALE_INTERVALS,
    VOICE_PERMUTATIONS,
    checksumPlanTable,
    chooseCyclicVoicingPlan,
    chooseMotionPaths,
    compareCyclicVoicingPlans,
    compareMotionPaths,
    constructSeventhChord,
    createGeneratedPlanTableSnapshot,
    createInversionCandidates,
    generateRelativePlanTable,
    GENERATED_PLAN_TABLE_CHECKSUM,
    GENERATED_PLAN_TABLE_LENGTH,
    getPlanTableIndex,
    scoreCyclicVoicingPlan,
    scoreMotionPath
};

const DEFAULT_KEY = 0;
const DEFAULT_SCALE = 0;
const DEFAULT_CHANGES = 1;
const DEFAULT_MOTION = 0;
const CLOCK_THRESHOLD = 2.5;
const RESET_THRESHOLD = 1;

function finiteRounded(value, fallback, minimum, maximum) {
    return Number.isFinite(value)
        ? clamp(Math.round(value), minimum, maximum)
        : fallback;
}

export function computeChangesIndex(changes, changesCV) {
    const base = Number.isFinite(changes) ? clamp(changes, 0, 7) : DEFAULT_CHANGES;
    const modulation = Number.isFinite(changesCV) ? clamp(changesCV, -5, 5) : 0;
    return clamp(Math.round(base + modulation * 7 / 5), 0, 7);
}

export default {
    id: 'changes',
    name: 'CHANGES',
    hp: 8,
    color: 'module-color-nine',
    category: 'sequencer',

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const clock = new Float32Array(bufferSize);
        const reset = new Float32Array(bufferSize);
        const keyCV = new Float32Array(bufferSize);
        const changesCV = new Float32Array(bufferSize);
        const pitch = new Float32Array(bufferSize);
        const root = new Float32Array(bufferSize);
        const change = new Float32Array(bufferSize);

        const changePulseSamples = Math.max(1, Math.round(sampleRate * 0.008));
        let step = -1;
        let lastClockHigh = false;
        let lastResetHigh = false;
        let lastResetActionHigh = false;
        let restartPending = false;
        let changeCounter = 0;
        let heldPitch = 0;
        let heldRoot = 0;
        let activeKey = DEFAULT_KEY;
        let activeScale = DEFAULT_SCALE;
        let activeChanges = DEFAULT_CHANGES;
        let activeChangesControl = DEFAULT_CHANGES;
        let activeChangesCV = 0;
        let activeMotion = DEFAULT_MOTION;
        let sampledRequestedChanges = DEFAULT_CHANGES;
        let sampledRequestedChangesCV = 0;

        return {
            params: {
                key: DEFAULT_KEY,
                scale: DEFAULT_SCALE,
                changes: DEFAULT_CHANGES,
                motion: DEFAULT_MOTION,
                resetAction: 0
            },

            inputs: { clock, reset, keyCV, changesCV },
            outputs: { pitch, root, change },
            leds: {
                chord1: 0,
                chord2: 0,
                chord3: 0,
                chord4: 0,
                pending: 0
            },

            process() {
                const requestedKey = finiteRounded(this.params.key, DEFAULT_KEY, 0, 11);
                const requestedScale = finiteRounded(this.params.scale, DEFAULT_SCALE, 0, 7);
                const requestedChanges = Number.isFinite(this.params.changes)
                    ? clamp(this.params.changes, 0, 7)
                    : DEFAULT_CHANGES;
                const requestedMotion = finiteRounded(this.params.motion, DEFAULT_MOTION, 0, 7);
                const resetActionHigh = Number.isFinite(this.params.resetAction) &&
                    this.params.resetAction >= 0.5;

                for (let sample = 0; sample < bufferSize; sample++) {
                    const resetHigh = Number.isFinite(reset[sample]) &&
                        reset[sample] >= RESET_THRESHOLD;
                    const resetRising = resetHigh && !lastResetHigh;
                    const resetActionRising = resetActionHigh && !lastResetActionHigh;
                    if (resetRising || resetActionRising) {
                        changeCounter = 0;
                        restartPending = true;
                    }

                    const clockHigh = Number.isFinite(clock[sample]) &&
                        clock[sample] > CLOCK_THRESHOLD;
                    const clockRising = clockHigh && !lastClockHigh;
                    lastResetHigh = resetHigh;
                    lastResetActionHigh = resetActionHigh;
                    lastClockHigh = clockHigh;

                    if (clockRising) {
                        if (restartPending) {
                            step = 0;
                        } else {
                            step = (step + 1) & 15;
                        }

                        sampledRequestedChangesCV = Number.isFinite(changesCV[sample])
                            ? clamp(changesCV[sample], -5, 5)
                            : 0;
                        sampledRequestedChanges = computeChangesIndex(
                            requestedChanges,
                            sampledRequestedChangesCV
                        );

                        if (step === 0) {
                            activeKey = requestedKey;
                            activeScale = requestedScale;
                            activeChanges = sampledRequestedChanges;
                            activeChangesControl = requestedChanges;
                            activeChangesCV = sampledRequestedChangesCV;
                            activeMotion = requestedMotion;
                            restartPending = false;
                        }

                        const transpose = Number.isFinite(keyCV[sample])
                            ? clamp(keyCV[sample], -5, 5)
                            : 0;
                        const relativePitch = getGeneratedPlanValue(getPlanTableIndex(
                            activeScale,
                            activeChanges,
                            activeMotion,
                            step
                        ));
                        const chordSlot = step >> 2;
                        const degree = PROGRESSION_DEGREES[activeChanges][chordSlot];
                        heldPitch = transpose + (activeKey + relativePitch) / 12;
                        heldRoot = transpose + (activeKey + SCALE_INTERVALS[activeScale][degree]) / 12;

                        this.leds.chord1 = chordSlot === 0 ? 1 : 0;
                        this.leds.chord2 = chordSlot === 1 ? 1 : 0;
                        this.leds.chord3 = chordSlot === 2 ? 1 : 0;
                        this.leds.chord4 = chordSlot === 3 ? 1 : 0;
                        if ((step & 3) === 0) changeCounter = changePulseSamples;
                    }

                    pitch[sample] = heldPitch;
                    root[sample] = heldRoot;
                    if (changeCounter > 0) {
                        change[sample] = 10;
                        changeCounter--;
                    } else {
                        change[sample] = 0;
                    }
                }

                const structuralChangePending = (
                    requestedKey !== activeKey ||
                    requestedScale !== activeScale ||
                    requestedChanges !== activeChangesControl ||
                    sampledRequestedChangesCV !== activeChangesCV ||
                    requestedMotion !== activeMotion
                );
                this.leds.pending = restartPending || structuralChangePending ? 1 : 0;
            },

            reset() {
                clock.fill(0);
                reset.fill(0);
                keyCV.fill(0);
                changesCV.fill(0);
                pitch.fill(0);
                root.fill(0);
                change.fill(0);
                step = -1;
                lastClockHigh = false;
                lastResetHigh = false;
                lastResetActionHigh = false;
                restartPending = false;
                changeCounter = 0;
                heldPitch = 0;
                heldRoot = 0;
                activeKey = DEFAULT_KEY;
                activeScale = DEFAULT_SCALE;
                activeChanges = DEFAULT_CHANGES;
                activeChangesControl = DEFAULT_CHANGES;
                activeChangesCV = 0;
                activeMotion = DEFAULT_MOTION;
                sampledRequestedChanges = DEFAULT_CHANGES;
                sampledRequestedChangesCV = 0;
                this.params.resetAction = 0;
                this.leds.chord1 = 0;
                this.leds.chord2 = 0;
                this.leds.chord3 = 0;
                this.leds.chord4 = 0;
                this.leds.pending = 0;
            }
        };
    },

    ui: {
        leds: ['chord1', 'chord2', 'chord3', 'chord4', 'pending'],
        knobs: [
            { id: 'key', label: 'Key', param: 'key', min: 0, max: 11, default: 0, step: 1 },
            { id: 'scale', label: 'Scale', param: 'scale', min: 0, max: 7, default: 0, step: 1 },
            { id: 'changes', label: 'Changes', param: 'changes', min: 0, max: 7, default: 1, step: 1 },
            { id: 'motion', label: 'Motion', param: 'motion', min: 0, max: 7, default: 0, step: 1 }
        ],
        actions: [
            { id: 'resetAction', label: 'Reset', param: 'resetAction', mode: 'trigger', default: 0 }
        ],
        inputs: [
            { id: 'clock', label: 'Clock', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'Reset', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'keyCV', label: 'Key', port: 'keyCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
            { id: 'changesCV', label: 'Changes', port: 'changesCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
        ],
        outputs: [
            { id: 'pitch', label: 'Pitch', port: 'pitch', signal: 'cv', voltage: { min: -6, max: 95 / 12 } },
            { id: 'root', label: 'Root', port: 'root', signal: 'cv', voltage: { min: -5, max: 41 / 6 } },
            { id: 'change', label: 'Change', port: 'change', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
