import { clamp } from '../../utils/math.js';

const EMPTY = 0;
const ARM = 1;
const REC = 2;
const PLAY = 3;
const PAUSE = 4;

const FREE = 0;
const CLOCK = 1;
const STEP = 0;
const SMOOTH = 1;
const LOOP = 0;
const ONE = 1;

const ARM_NONE = 0;
const ARM_START = 1;
const ARM_STOP = 2;

const FREE_FRAME_RATE = 1000;
const MAX_FREE_FRAMES = 60000;
const MAX_CLOCK_STEPS = 1024;
const CV_LIMIT = 10;
const GATE_HIGH = 10;
const GATE_THRESHOLD = 1;
const CLOCK_THRESHOLD = 2.5;
const EOL_SECONDS = 0.008;
const CLOCK_LED_SECONDS = 0.05;
const RUNTIME_STATE_VERSION = 1;

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function finiteCv(value) {
    return clamp(finite(value), -CV_LIMIT, CV_LIMIT);
}

function binaryParam(value, fallback = 0) {
    return finite(value, fallback) >= 0.5 ? 1 : 0;
}

function gateByte(value) {
    return finite(value) >= GATE_THRESHOLD ? 1 : 0;
}

function wrapPosition(position, length) {
    if (length <= 0) return 0;
    let wrapped = position % length;
    if (wrapped < 0) wrapped += length;
    return wrapped;
}

function isTypedRuntimeState(state, length) {
    return state.cv1 instanceof Float32Array
        && state.cv2 instanceof Float32Array
        && state.gate1 instanceof Uint8Array
        && state.gate2 instanceof Uint8Array
        && state.cv1.length === length
        && state.cv2.length === length
        && state.gate1.length === length
        && state.gate2.length === length;
}

export default {
    id: 'cv-rec',
    name: 'CV REC',
    hp: 12,
    color: 'module-color-seven',
    category: 'modulation',

    telemetry: {
        fields: ['transportState', 'recordedMode', 'recordedLength', 'playProgress'],
        methods: []
    },

    css: `
        .cv-rec-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
            padding: 4px 3px;
            gap: 4px;
        }
        .cv-rec-display {
            box-sizing: border-box;
            width: calc(100% - 8px);
            min-height: 25px;
            padding: 5px 4px;
            border: 1px solid rgba(255, 255, 255, 0.24);
            border-radius: 3px;
            background: rgba(8, 12, 14, 0.86);
            color: #9fffb5;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 8px;
            line-height: 1.2;
            letter-spacing: 0.03em;
            text-align: center;
            white-space: nowrap;
        }
        .cv-rec-led-row,
        .cv-rec-switch-row,
        .cv-rec-action-row,
        .cv-rec-lane-row,
        .cv-rec-transport-row {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            gap: 4px;
        }
        .cv-rec-led-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
            min-width: 14px;
            color: inherit;
            font-size: 6px;
        }
        .cv-rec-switch-row .knob-container {
            gap: 1px;
        }
        .cv-rec-switch-row .knob-label {
            max-width: 42px;
            font-size: 6px;
            text-align: center;
        }
        .cv-rec-action-row .action-btn {
            min-width: 31px;
            height: 20px;
            padding: 0 3px;
            font-size: 7px;
        }
        .cv-rec-lane {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: end;
            gap: 3px;
            width: 50%;
            padding: 3px 2px;
            border: 1px solid rgba(255, 255, 255, 0.13);
            border-radius: 3px;
        }
        .cv-rec-lane-title,
        .cv-rec-note {
            grid-column: 1 / -1;
            text-align: center;
            font-size: 6px;
            letter-spacing: 0.06em;
        }
        .cv-rec-container .jack-label {
            max-width: 35px;
            font-size: 6px;
        }
        .cv-rec-note {
            width: 100%;
            opacity: 0.76;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
            throw new RangeError('CV Recorder sampleRate must be a positive finite number');
        }
        if (!Number.isInteger(bufferSize) || bufferSize <= 0) {
            throw new RangeError('CV Recorder bufferSize must be a positive integer');
        }

        const cv1In = new Float32Array(bufferSize);
        const gate1In = new Float32Array(bufferSize);
        const cv2In = new Float32Array(bufferSize);
        const gate2In = new Float32Array(bufferSize);
        const clockIn = new Float32Array(bufferSize);
        const recordTrigIn = new Float32Array(bufferSize);
        const resetIn = new Float32Array(bufferSize);

        const cv1Out = new Float32Array(bufferSize);
        const gate1Out = new Float32Array(bufferSize);
        const cv2Out = new Float32Array(bufferSize);
        const gate2Out = new Float32Array(bufferSize);
        const eolOut = new Float32Array(bufferSize);

        const cv1Store = new Float32Array(MAX_FREE_FRAMES);
        const cv2Store = new Float32Array(MAX_FREE_FRAMES);
        const gate1Store = new Uint8Array(MAX_FREE_FRAMES);
        const gate2Store = new Uint8Array(MAX_FREE_FRAMES);

        const eolSamples = Math.max(1, Math.round(sampleRate * EOL_SECONDS));
        const clockLedSamples = Math.max(1, Math.round(sampleRate * CLOCK_LED_SECONDS));

        let transport = EMPTY;
        let memoryMode = -1;
        let memoryLength = 0;
        let transactionMode = -1;
        let workingLength = 0;
        let armKind = ARM_NONE;
        let armResumeState = EMPTY;

        let freePhase = 0;
        let freeCount = 0;
        let freeCv1Sum = 0;
        let freeCv2Sum = 0;
        let freeGate1Any = 0;
        let freeGate2Any = 0;
        let playHead = 0;
        let currentStep = 0;

        let heldCv1 = 0;
        let heldCv2 = 0;
        let heldGate1 = 0;
        let heldGate2 = 0;

        let clockInterpStart1 = 0;
        let clockInterpStart2 = 0;
        let clockInterpTarget1 = 0;
        let clockInterpTarget2 = 0;
        let clockInterpElapsed = 0;
        let clockInterpActive = false;
        let clockPeriodSamples = 0;
        let lastAcceptedClockSample = -1;
        let absoluteSample = 0;

        let lastRecordParamHigh = false;
        let lastRecordTrigHigh = false;
        let lastPlayParamHigh = false;
        let lastResetParamHigh = false;
        let lastResetTrigHigh = false;
        let lastClearParamHigh = false;
        let lastClockHigh = false;

        let eolRemaining = 0;
        let eolTriggeredThisBlock = false;
        let clockLedRemaining = 0;
        let lastOutputGate1 = 0;
        let lastOutputGate2 = 0;

        function sanitizeParams(dsp) {
            dsp.params.mode = binaryParam(dsp.params.mode, FREE);
            dsp.params.shape = binaryParam(dsp.params.shape, SMOOTH);
            dsp.params.playMode = binaryParam(dsp.params.playMode, LOOP);
            dsp.params.record = binaryParam(dsp.params.record, 0);
            dsp.params.play = binaryParam(dsp.params.play, 0);
            dsp.params.resetAction = binaryParam(dsp.params.resetAction, 0);
            dsp.params.clear = binaryParam(dsp.params.clear, 0);
        }

        function resetFreeAccumulator() {
            freePhase = 0;
            freeCount = 0;
            freeCv1Sum = 0;
            freeCv2Sum = 0;
            freeGate1Any = 0;
            freeGate2Any = 0;
        }

        function clearPlaybackHelpers() {
            playHead = 0;
            currentStep = 0;
            heldCv1 = 0;
            heldCv2 = 0;
            heldGate1 = 0;
            heldGate2 = 0;
            clockInterpStart1 = 0;
            clockInterpStart2 = 0;
            clockInterpTarget1 = 0;
            clockInterpTarget2 = 0;
            clockInterpElapsed = 0;
            clockInterpActive = false;
        }

        function clearTransaction() {
            transactionMode = -1;
            workingLength = 0;
            armKind = ARM_NONE;
            armResumeState = EMPTY;
            resetFreeAccumulator();
        }

        function clearCommittedMetadata() {
            memoryMode = -1;
            memoryLength = 0;
            clearPlaybackHelpers();
        }

        function eraseAllMemory() {
            cv1Store.fill(0);
            cv2Store.fill(0);
            gate1Store.fill(0);
            gate2Store.fill(0);
            clearCommittedMetadata();
            clearTransaction();
            transport = EMPTY;
            eolRemaining = 0;
            eolTriggeredThisBlock = false;
            clockLedRemaining = 0;
            clockPeriodSamples = 0;
            lastAcceptedClockSample = -1;
        }

        function writeFrame(index, cv1, gate1, cv2, gate2) {
            cv1Store[index] = cv1;
            cv2Store[index] = cv2;
            gate1Store[index] = gate1;
            gate2Store[index] = gate2;
        }

        function currentLimit() {
            return transactionMode === CLOCK ? MAX_CLOCK_STEPS : MAX_FREE_FRAMES;
        }

        function readFreeCv(buffer, position, shape, playMode) {
            if (memoryLength <= 0) return 0;
            const bounded = playMode === LOOP
                ? wrapPosition(position, memoryLength)
                : clamp(position, 0, memoryLength - 1);
            const index = Math.floor(bounded);
            if (shape === STEP || memoryLength === 1) return buffer[index];
            const fraction = bounded - index;
            const next = index + 1 < memoryLength
                ? index + 1
                : playMode === LOOP ? 0 : index;
            return buffer[index] + (buffer[next] - buffer[index]) * fraction;
        }

        function readFreeGate(buffer, position, playMode) {
            if (memoryLength <= 0) return 0;
            const bounded = playMode === LOOP
                ? wrapPosition(position, memoryLength)
                : clamp(position, 0, memoryLength - 1);
            return buffer[Math.floor(bounded)] ? 1 : 0;
        }

        function nextClockStep(step, playMode) {
            if (memoryLength <= 1) return 0;
            if (step + 1 < memoryLength) return step + 1;
            return playMode === LOOP ? 0 : memoryLength - 1;
        }

        function installClockStep(step, playMode, interpolate) {
            currentStep = clamp(Math.round(step), 0, Math.max(0, memoryLength - 1));
            const target = nextClockStep(currentStep, playMode);
            clockInterpStart1 = cv1Store[currentStep] || 0;
            clockInterpStart2 = cv2Store[currentStep] || 0;
            clockInterpTarget1 = cv1Store[target] || 0;
            clockInterpTarget2 = cv2Store[target] || 0;
            clockInterpElapsed = 0;
            clockInterpActive = interpolate && clockPeriodSamples > 0;
            heldCv1 = clockInterpStart1;
            heldCv2 = clockInterpStart2;
            heldGate1 = gate1Store[currentStep] ? 1 : 0;
            heldGate2 = gate2Store[currentStep] ? 1 : 0;
        }

        function refreshClockTarget(playMode) {
            if (memoryMode !== CLOCK || memoryLength <= 0) return;
            const target = nextClockStep(currentStep, playMode);
            clockInterpTarget1 = cv1Store[target] || 0;
            clockInterpTarget2 = cv2Store[target] || 0;
        }

        function captureHeldPlayback(dsp) {
            if (memoryLength <= 0) {
                heldCv1 = 0;
                heldCv2 = 0;
                heldGate1 = 0;
                heldGate2 = 0;
                return;
            }
            if (memoryMode === FREE) {
                heldCv1 = finiteCv(readFreeCv(cv1Store, playHead, dsp.params.shape, dsp.params.playMode));
                heldCv2 = finiteCv(readFreeCv(cv2Store, playHead, dsp.params.shape, dsp.params.playMode));
                heldGate1 = readFreeGate(gate1Store, playHead, dsp.params.playMode);
                heldGate2 = readFreeGate(gate2Store, playHead, dsp.params.playMode);
                return;
            }
            let cv1 = clockInterpStart1;
            let cv2 = clockInterpStart2;
            if (dsp.params.shape === SMOOTH && clockInterpActive && clockPeriodSamples > 0) {
                const amount = clamp(clockInterpElapsed / clockPeriodSamples, 0, 1);
                cv1 += (clockInterpTarget1 - clockInterpStart1) * amount;
                cv2 += (clockInterpTarget2 - clockInterpStart2) * amount;
            }
            heldCv1 = finiteCv(cv1);
            heldCv2 = finiteCv(cv2);
            heldGate1 = gate1Store[currentStep] ? 1 : 0;
            heldGate2 = gate2Store[currentStep] ? 1 : 0;
        }

        function beginFreeRecording(cv1, gate1, cv2, gate2) {
            clearCommittedMetadata();
            transactionMode = FREE;
            workingLength = 0;
            armKind = ARM_NONE;
            armResumeState = EMPTY;
            resetFreeAccumulator();
            transport = REC;
            writeFrame(workingLength, cv1, gate1, cv2, gate2);
            workingLength++;
        }

        function beginClockArm() {
            transactionMode = CLOCK;
            workingLength = 0;
            armKind = ARM_START;
            armResumeState = transport;
            transport = ARM;
            resetFreeAccumulator();
        }

        function beginClockRecording(cv1, gate1, cv2, gate2) {
            clearCommittedMetadata();
            transactionMode = CLOCK;
            workingLength = 0;
            armKind = ARM_NONE;
            armResumeState = EMPTY;
            transport = REC;
            writeFrame(workingLength, cv1, gate1, cv2, gate2);
            workingLength++;
        }

        function finalizeRecording(dsp) {
            const minimum = transactionMode === FREE ? 2 : 1;
            if (workingLength < minimum) {
                clearCommittedMetadata();
                clearTransaction();
                transport = EMPTY;
                return false;
            }

            memoryMode = transactionMode;
            memoryLength = workingLength;
            transactionMode = -1;
            workingLength = 0;
            armKind = ARM_NONE;
            armResumeState = EMPTY;
            resetFreeAccumulator();
            transport = PLAY;
            playHead = 0;
            if (memoryMode === CLOCK) installClockStep(0, dsp.params.playMode, true);
            else captureHeldPlayback(dsp);
            return true;
        }

        function abortRecording() {
            clearCommittedMetadata();
            clearTransaction();
            transport = EMPTY;
        }

        function handleRecordCommand(dsp, cv1, gate1, cv2, gate2) {
            if (transport === ARM) {
                if (armKind === ARM_START) {
                    transport = armResumeState;
                    clearTransaction();
                } else {
                    transport = REC;
                    armKind = ARM_NONE;
                    armResumeState = EMPTY;
                }
                return false;
            }

            if (transport === REC) {
                if (transactionMode === FREE) {
                    finalizeRecording(dsp);
                } else {
                    armKind = ARM_STOP;
                    armResumeState = REC;
                    transport = ARM;
                }
                return false;
            }

            if (dsp.params.mode === FREE) {
                beginFreeRecording(cv1, gate1, cv2, gate2);
                return true;
            }

            beginClockArm();
            return false;
        }

        function rewindCommitted(dsp, preserveState) {
            if (memoryLength <= 0) {
                transport = EMPTY;
                clearPlaybackHelpers();
                return;
            }
            transport = preserveState === PAUSE ? PAUSE : PLAY;
            playHead = 0;
            if (memoryMode === CLOCK) {
                installClockStep(0, dsp.params.playMode, false);
            } else {
                captureHeldPlayback(dsp);
            }
        }

        function handleResetCommand(dsp) {
            eolRemaining = 0;
            eolTriggeredThisBlock = false;
            clockLedRemaining = 0;
            clockPeriodSamples = 0;
            lastAcceptedClockSample = -1;
            clockInterpElapsed = 0;
            clockInterpActive = false;
            resetFreeAccumulator();

            if (transport === ARM) {
                if (armKind === ARM_STOP) {
                    abortRecording();
                    return;
                }
                const resume = armResumeState;
                clearTransaction();
                rewindCommitted(dsp, resume);
                return;
            }

            if (transport === REC) {
                abortRecording();
                return;
            }

            rewindCommitted(dsp, transport);
        }

        function handlePlayCommand(dsp) {
            if (memoryLength <= 0 || transport === ARM || transport === REC) return;
            if (transport === PLAY) {
                captureHeldPlayback(dsp);
                transport = PAUSE;
            } else if (transport === PAUSE) {
                transport = PLAY;
                if (memoryMode === CLOCK) {
                    installClockStep(currentStep, dsp.params.playMode, false);
                }
            }
        }

        function clockContext() {
            return transactionMode === CLOCK || memoryMode === CLOCK;
        }

        function acceptClockTiming() {
            if (lastAcceptedClockSample >= 0) {
                const measured = absoluteSample - lastAcceptedClockSample;
                if (measured > 0) clockPeriodSamples = measured;
            }
            lastAcceptedClockSample = absoluteSample;
            clockLedRemaining = clockLedSamples;
        }

        function triggerEol() {
            eolRemaining = eolSamples;
            eolTriggeredThisBlock = true;
        }

        function advanceClockPlayback(dsp) {
            if (memoryLength <= 0 || memoryMode !== CLOCK || transport !== PLAY) return;
            if (currentStep + 1 < memoryLength) {
                installClockStep(currentStep + 1, dsp.params.playMode, true);
                return;
            }

            if (dsp.params.playMode === LOOP) {
                installClockStep(0, dsp.params.playMode, true);
                triggerEol();
            } else {
                installClockStep(memoryLength - 1, dsp.params.playMode, false);
                captureHeldPlayback(dsp);
                transport = PAUSE;
                triggerEol();
            }
        }

        function handleClockEdge(dsp, cv1, gate1, cv2, gate2) {
            if (!clockContext()) return false;
            if (transport === ARM && armKind === ARM_START) {
                clockPeriodSamples = 0;
                lastAcceptedClockSample = -1;
            }
            acceptClockTiming();

            if (transport === ARM && armKind === ARM_START) {
                beginClockRecording(cv1, gate1, cv2, gate2);
                if (workingLength >= MAX_CLOCK_STEPS) finalizeRecording(dsp);
                return true;
            }

            if (transport === ARM && armKind === ARM_STOP) {
                finalizeRecording(dsp);
                return true;
            }

            if (transport === REC && transactionMode === CLOCK) {
                writeFrame(workingLength, cv1, gate1, cv2, gate2);
                workingLength++;
                if (workingLength >= MAX_CLOCK_STEPS) finalizeRecording(dsp);
                return true;
            }

            if (memoryMode === CLOCK) {
                if (transport === PLAY) advanceClockPlayback(dsp);
                return true;
            }

            return false;
        }

        function accumulateFreeSample(dsp, cv1, gate1, cv2, gate2) {
            freeCv1Sum += cv1;
            freeCv2Sum += cv2;
            freeGate1Any |= gate1;
            freeGate2Any |= gate2;
            freeCount++;
            freePhase += FREE_FRAME_RATE;

            if (freePhase < sampleRate) return;
            freePhase -= sampleRate;
            if (freeCount > 0 && workingLength < MAX_FREE_FRAMES) {
                writeFrame(
                    workingLength,
                    freeCv1Sum / freeCount,
                    freeGate1Any,
                    freeCv2Sum / freeCount,
                    freeGate2Any
                );
                workingLength++;
            }
            freeCount = 0;
            freeCv1Sum = 0;
            freeCv2Sum = 0;
            freeGate1Any = 0;
            freeGate2Any = 0;

            if (workingLength >= MAX_FREE_FRAMES) finalizeRecording(dsp);
        }

        function effectiveTransport() {
            if (transport !== ARM) return transport;
            return armKind === ARM_START ? armResumeState : REC;
        }

        function writeMonitoredOutputs(index, cv1, gate1, cv2, gate2) {
            cv1Out[index] = cv1;
            gate1Out[index] = gate1 ? GATE_HIGH : 0;
            cv2Out[index] = cv2;
            gate2Out[index] = gate2 ? GATE_HIGH : 0;
        }

        function writePlaybackOutputs(dsp, index) {
            if (memoryMode === FREE) {
                const cv1 = finiteCv(readFreeCv(cv1Store, playHead, dsp.params.shape, dsp.params.playMode));
                const cv2 = finiteCv(readFreeCv(cv2Store, playHead, dsp.params.shape, dsp.params.playMode));
                const gate1 = readFreeGate(gate1Store, playHead, dsp.params.playMode);
                const gate2 = readFreeGate(gate2Store, playHead, dsp.params.playMode);
                writeMonitoredOutputs(index, cv1, gate1, cv2, gate2);
                return;
            }

            let cv1 = clockInterpStart1;
            let cv2 = clockInterpStart2;
            if (dsp.params.shape === SMOOTH && clockInterpActive && clockPeriodSamples > 0) {
                const amount = clamp(clockInterpElapsed / clockPeriodSamples, 0, 1);
                cv1 += (clockInterpTarget1 - clockInterpStart1) * amount;
                cv2 += (clockInterpTarget2 - clockInterpStart2) * amount;
            }
            writeMonitoredOutputs(
                index,
                finiteCv(cv1),
                gate1Store[currentStep] ? 1 : 0,
                finiteCv(cv2),
                gate2Store[currentStep] ? 1 : 0
            );
        }

        function writePausedOutputs(index) {
            writeMonitoredOutputs(index, heldCv1, heldGate1, heldCv2, heldGate2);
        }

        function advanceFreePlayback(dsp) {
            if (memoryMode !== FREE || memoryLength <= 0 || effectiveTransport() !== PLAY) return;
            playHead += FREE_FRAME_RATE / sampleRate;
            if (playHead < memoryLength) return;

            if (dsp.params.playMode === LOOP) {
                playHead = wrapPosition(playHead, memoryLength);
                triggerEol();
            } else {
                playHead = memoryLength - 1;
                captureHeldPlayback(dsp);
                if (transport === ARM && armKind === ARM_START) armResumeState = PAUSE;
                else transport = PAUSE;
                triggerEol();
            }
        }

        function currentProgress() {
            if (transport === REC || (transport === ARM && armKind === ARM_STOP)) {
                const limit = currentLimit();
                return limit > 0 ? clamp(workingLength / limit, 0, 1) : 0;
            }
            if (memoryLength <= 0) return 0;
            if (memoryLength === 1) return 0;
            if (memoryMode === FREE) return clamp(playHead / (memoryLength - 1), 0, 1);
            return clamp(currentStep / (memoryLength - 1), 0, 1);
        }

        function syncFeedback(dsp) {
            const active = effectiveTransport();
            dsp.transportState = transport;
            dsp.recordedMode = transport === ARM || transport === REC ? transactionMode : memoryMode;
            dsp.recordedLength = transport === REC || (transport === ARM && armKind === ARM_STOP)
                ? workingLength
                : memoryLength;
            dsp.playProgress = finite(currentProgress());

            dsp.leds.recording = transport === REC ? 1 : transport === ARM ? 0.5 : 0;
            dsp.leds.playing = memoryLength <= 0 ? 0 : active === PLAY ? 1 : active === PAUSE ? 0.5 : 0;
            dsp.leds.memory = memoryLength > 0 ? 1 : 0;
            dsp.leds.clock = clockLedRemaining > 0 ? 1 : 0;
            dsp.leds.eol = eolRemaining > 0 || eolTriggeredThisBlock ? 1 : 0;
            dsp.leds.gate1 = lastOutputGate1 ? 1 : 0;
            dsp.leds.gate2 = lastOutputGate2 ? 1 : 0;
            dsp.leds.phase = clamp(dsp.playProgress, 0, 1);
        }

        function resetEdgeHistories() {
            lastRecordParamHigh = false;
            lastRecordTrigHigh = false;
            lastPlayParamHigh = false;
            lastResetParamHigh = false;
            lastResetTrigHigh = false;
            lastClearParamHigh = false;
            lastClockHigh = false;
        }

        function resetRuntimeHelpers(dsp) {
            clearTransaction();
            resetEdgeHistories();
            eolRemaining = 0;
            eolTriggeredThisBlock = false;
            clockLedRemaining = 0;
            clockPeriodSamples = 0;
            lastAcceptedClockSample = -1;
            absoluteSample = 0;
            lastOutputGate1 = 0;
            lastOutputGate2 = 0;
            dsp.params.record = 0;
            dsp.params.play = 0;
            dsp.params.resetAction = 0;
            dsp.params.clear = 0;

            cv1In.fill(0);
            gate1In.fill(0);
            cv2In.fill(0);
            gate2In.fill(0);
            clockIn.fill(0);
            recordTrigIn.fill(0);
            resetIn.fill(0);
            cv1Out.fill(0);
            gate1Out.fill(0);
            cv2Out.fill(0);
            gate2Out.fill(0);
            eolOut.fill(0);

            if (memoryLength > 0) {
                transport = PLAY;
                playHead = 0;
                if (memoryMode === CLOCK) installClockStep(0, dsp.params.playMode, false);
                else captureHeldPlayback(dsp);
            } else {
                transport = EMPTY;
                clearPlaybackHelpers();
            }
            syncFeedback(dsp);
        }

        function snapshotSource() {
            if ((transport === REC || (transport === ARM && armKind === ARM_STOP))
                && transactionMode >= FREE) {
                const minimum = transactionMode === FREE ? 2 : 1;
                if (workingLength >= minimum) {
                    return {
                        mode: transactionMode,
                        length: workingLength,
                        position: 0,
                        playbackState: PLAY
                    };
                }
                return null;
            }

            if (memoryLength <= 0) return null;
            let playbackState = transport;
            if (transport === ARM && armKind === ARM_START) playbackState = armResumeState;
            if (playbackState !== PAUSE) playbackState = PLAY;
            return {
                mode: memoryMode,
                length: memoryLength,
                position: memoryMode === FREE ? playHead : currentStep,
                playbackState
            };
        }

        function getRuntimeState() {
            const source = snapshotSource();
            if (!source) {
                return {
                    version: RUNTIME_STATE_VERSION,
                    freeFrameRate: FREE_FRAME_RATE,
                    recordedMode: -1,
                    recordedLength: 0,
                    cv1: new Float32Array(0),
                    cv2: new Float32Array(0),
                    gate1: new Uint8Array(0),
                    gate2: new Uint8Array(0),
                    playPosition: 0,
                    playbackState: EMPTY
                };
            }
            return {
                version: RUNTIME_STATE_VERSION,
                freeFrameRate: FREE_FRAME_RATE,
                recordedMode: source.mode,
                recordedLength: source.length,
                cv1: cv1Store.slice(0, source.length),
                cv2: cv2Store.slice(0, source.length),
                gate1: gate1Store.slice(0, source.length),
                gate2: gate2Store.slice(0, source.length),
                playPosition: source.position,
                playbackState: source.playbackState
            };
        }

        function validateRuntimeState(state) {
            if (!state || typeof state !== 'object') return false;
            if (state.version !== RUNTIME_STATE_VERSION || state.freeFrameRate !== FREE_FRAME_RATE) return false;
            if (state.recordedMode !== FREE && state.recordedMode !== CLOCK) return false;
            if (!Number.isInteger(state.recordedLength)) return false;
            const limit = state.recordedMode === FREE ? MAX_FREE_FRAMES : MAX_CLOCK_STEPS;
            const minimum = state.recordedMode === FREE ? 2 : 1;
            if (state.recordedLength < minimum || state.recordedLength > limit) return false;
            if (!isTypedRuntimeState(state, state.recordedLength)) return false;
            if (state.playbackState !== PLAY && state.playbackState !== PAUSE) return false;
            if (!Number.isFinite(state.playPosition)) return false;
            if (state.recordedMode === CLOCK && !Number.isInteger(state.playPosition)) return false;
            if (state.playPosition < 0 || state.playPosition >= state.recordedLength) return false;

            for (let i = 0; i < state.recordedLength; i++) {
                if (!Number.isFinite(state.cv1[i]) || state.cv1[i] < -CV_LIMIT || state.cv1[i] > CV_LIMIT) return false;
                if (!Number.isFinite(state.cv2[i]) || state.cv2[i] < -CV_LIMIT || state.cv2[i] > CV_LIMIT) return false;
                if (state.gate1[i] !== 0 && state.gate1[i] !== 1) return false;
                if (state.gate2[i] !== 0 && state.gate2[i] !== 1) return false;
            }
            return true;
        }

        function restoreState(dsp, state) {
            sanitizeParams(dsp);
            if (!validateRuntimeState(state)) {
                eraseAllMemory();
                resetRuntimeHelpers(dsp);
                return;
            }

            cv1Store.set(state.cv1, 0);
            cv2Store.set(state.cv2, 0);
            gate1Store.set(state.gate1, 0);
            gate2Store.set(state.gate2, 0);
            memoryMode = state.recordedMode;
            memoryLength = state.recordedLength;
            clearTransaction();
            resetEdgeHistories();
            eolRemaining = 0;
            eolTriggeredThisBlock = false;
            clockLedRemaining = 0;
            clockPeriodSamples = 0;
            lastAcceptedClockSample = -1;
            absoluteSample = 0;
            playHead = memoryMode === FREE ? state.playPosition : 0;
            currentStep = memoryMode === CLOCK ? state.playPosition : 0;
            transport = state.playbackState;
            dsp.params.record = 0;
            dsp.params.play = 0;
            dsp.params.resetAction = 0;
            dsp.params.clear = 0;

            if (memoryMode === CLOCK) installClockStep(currentStep, dsp.params.playMode, false);
            captureHeldPlayback(dsp);
            lastOutputGate1 = 0;
            lastOutputGate2 = 0;
            syncFeedback(dsp);
        }

        const dsp = {
            params: {
                mode: FREE,
                shape: SMOOTH,
                playMode: LOOP,
                record: 0,
                play: 0,
                resetAction: 0,
                clear: 0
            },

            inputs: {
                cv1In,
                gate1In,
                cv2In,
                gate2In,
                clock: clockIn,
                recordTrig: recordTrigIn,
                reset: resetIn
            },

            outputs: {
                cv1Out,
                gate1Out,
                cv2Out,
                gate2Out,
                eol: eolOut
            },

            leds: {
                recording: 0,
                playing: 0,
                memory: 0,
                clock: 0,
                eol: 0,
                gate1: 0,
                gate2: 0,
                phase: 0
            },

            transportState: EMPTY,
            recordedMode: -1,
            recordedLength: 0,
            playProgress: 0,

            process() {
                sanitizeParams(this);
                refreshClockTarget(this.params.playMode);
                eolTriggeredThisBlock = false;
                const panelRecordHigh = this.params.record >= 1;
                const panelPlayHigh = this.params.play >= 1;
                const panelResetHigh = this.params.resetAction >= 1;
                const panelClearHigh = this.params.clear >= 1;

                for (let i = 0; i < bufferSize; i++) {
                    const cv1 = finiteCv(cv1In[i]);
                    const cv2 = finiteCv(cv2In[i]);
                    const gate1 = gateByte(gate1In[i]);
                    const gate2 = gateByte(gate2In[i]);
                    const recordTrigHigh = finite(recordTrigIn[i]) >= GATE_THRESHOLD;
                    const resetTrigHigh = finite(resetIn[i]) >= GATE_THRESHOLD;
                    const clockHigh = finite(clockIn[i]) > CLOCK_THRESHOLD;

                    const recordEdge = (panelRecordHigh && !lastRecordParamHigh)
                        || (recordTrigHigh && !lastRecordTrigHigh);
                    const playEdge = panelPlayHigh && !lastPlayParamHigh;
                    const resetEdge = (panelResetHigh && !lastResetParamHigh)
                        || (resetTrigHigh && !lastResetTrigHigh);
                    const clearEdge = panelClearHigh && !lastClearParamHigh;
                    const clockEdge = clockHigh && !lastClockHigh;

                    let freeStarted = false;
                    if (clearEdge) {
                        eraseAllMemory();
                    } else if (resetEdge) {
                        handleResetCommand(this);
                    } else {
                        if (recordEdge) {
                            freeStarted = handleRecordCommand(this, cv1, gate1, cv2, gate2);
                        } else if (playEdge) {
                            handlePlayCommand(this);
                        }
                        if (clockEdge) handleClockEdge(this, cv1, gate1, cv2, gate2);
                    }

                    lastRecordParamHigh = panelRecordHigh;
                    lastRecordTrigHigh = recordTrigHigh;
                    lastPlayParamHigh = panelPlayHigh;
                    lastResetParamHigh = panelResetHigh;
                    lastResetTrigHigh = resetTrigHigh;
                    lastClearParamHigh = panelClearHigh;
                    lastClockHigh = clockHigh;

                    if (transport === REC && transactionMode === FREE && !freeStarted) {
                        accumulateFreeSample(this, cv1, gate1, cv2, gate2);
                    }

                    const active = effectiveTransport();
                    if (active === REC || active === EMPTY) {
                        writeMonitoredOutputs(i, cv1, gate1, cv2, gate2);
                    } else if (active === PAUSE) {
                        writePausedOutputs(i);
                    } else {
                        writePlaybackOutputs(this, i);
                    }

                    lastOutputGate1 = gate1Out[i] >= GATE_THRESHOLD ? 1 : 0;
                    lastOutputGate2 = gate2Out[i] >= GATE_THRESHOLD ? 1 : 0;

                    if (active === PLAY && memoryMode === FREE) {
                        advanceFreePlayback(this);
                    } else if (active === PLAY && memoryMode === CLOCK && clockInterpActive) {
                        clockInterpElapsed++;
                    }

                    eolOut[i] = eolRemaining > 0 ? GATE_HIGH : 0;
                    if (eolRemaining > 0) eolRemaining--;
                    if (clockLedRemaining > 0) clockLedRemaining--;
                    absoluteSample++;
                }

                syncFeedback(this);
            },

            reset() {
                sanitizeParams(this);
                resetRuntimeHelpers(this);
            },

            getRuntimeState,

            restoreRuntimeState(state) {
                restoreState(this, state);
            },

            getRecordedFrame(index) {
                const length = transport === REC || (transport === ARM && armKind === ARM_STOP)
                    ? workingLength
                    : memoryLength;
                if (!Number.isInteger(index) || index < 0 || index >= length) return null;
                return {
                    cv1: cv1Store[index],
                    gate1: gate1Store[index],
                    cv2: cv2Store[index],
                    gate2: gate2Store[index]
                };
            },

            getTransportInfo() {
                return {
                    transportState: transport,
                    memoryMode,
                    memoryLength,
                    transactionMode,
                    workingLength,
                    armKind,
                    playHead,
                    currentStep,
                    clockPeriodSamples,
                    maxFrames: MAX_FREE_FRAMES,
                    maxClockSteps: MAX_CLOCK_STEPS,
                    freeFrameRate: FREE_FRAME_RATE
                };
            }
        };

        syncFeedback(dsp);
        return dsp;
    },

    captureRuntimeState(dsp) {
        return dsp?.getRuntimeState?.() || null;
    },

    restoreRuntimeState(dsp, state) {
        dsp?.restoreRuntimeState?.(state);
    },

    render(container, { instance, toolkit }) {
        const dsp = instance.dsp;
        const root = document.createElement('div');
        root.className = 'cv-rec-container';

        const display = document.createElement('div');
        display.className = 'cv-rec-display';
        display.textContent = 'EMPTY';
        root.appendChild(display);

        const ledRow = toolkit.createRow('cv-rec-led-row');
        [
            ['recording', 'REC', 'red'],
            ['playing', 'PLAY', 'green'],
            ['memory', 'MEM', 'blue'],
            ['clock', 'CLK', 'green'],
            ['eol', 'EOL', 'red'],
            ['gate1', 'G1', 'green'],
            ['gate2', 'G2', 'green'],
            ['phase', 'PH', 'blue']
        ].forEach(([id, label, color]) => {
            const item = document.createElement('span');
            item.className = 'cv-rec-led-item';
            const text = document.createElement('small');
            text.textContent = label;
            item.append(toolkit.createLED({ id, color }), text);
            ledRow.appendChild(item);
        });
        root.appendChild(ledRow);

        const switchRow = toolkit.createRow('cv-rec-switch-row');
        switchRow.appendChild(toolkit.createSwitch({
            id: 'mode',
            param: 'mode',
            label: 'FREE / CLOCK',
            value: dsp?.params?.mode ?? FREE
        }));
        switchRow.appendChild(toolkit.createSwitch({
            id: 'shape',
            param: 'shape',
            label: 'STEP / SMOOTH',
            value: dsp?.params?.shape ?? SMOOTH
        }));
        switchRow.appendChild(toolkit.createSwitch({
            id: 'playMode',
            param: 'playMode',
            label: 'LOOP / ONE',
            value: dsp?.params?.playMode ?? LOOP
        }));
        root.appendChild(switchRow);

        const actionRow = toolkit.createRow('cv-rec-action-row');
        [
            ['record', 'REC'],
            ['play', 'PLAY'],
            ['resetAction', 'RESET'],
            ['clear', 'CLEAR']
        ].forEach(([id, label]) => {
            actionRow.appendChild(toolkit.createActionButton({
                id,
                param: id,
                label,
                mode: 'trigger',
                value: 0
            }));
        });
        root.appendChild(actionRow);

        const lanes = toolkit.createRow('cv-rec-lane-row');
        [
            ['1', 'cv1In', 'gate1In', 'cv1Out', 'gate1Out'],
            ['2', 'cv2In', 'gate2In', 'cv2Out', 'gate2Out']
        ].forEach(([lane, cvInPort, gateInPort, cvOutPort, gateOutPort]) => {
            const lanePanel = document.createElement('div');
            lanePanel.className = 'cv-rec-lane';
            const title = document.createElement('div');
            title.className = 'cv-rec-lane-title';
            title.textContent = `LANE ${lane}`;
            lanePanel.appendChild(title);
            lanePanel.appendChild(toolkit.createJack({
                id: cvInPort, label: 'CV IN', direction: 'input', signal: 'cv'
            }));
            lanePanel.appendChild(toolkit.createJack({
                id: gateInPort, label: 'GATE IN', direction: 'input', signal: 'gate'
            }));
            lanePanel.appendChild(toolkit.createJack({
                id: cvOutPort, label: 'CV OUT', direction: 'output', signal: 'cv'
            }));
            lanePanel.appendChild(toolkit.createJack({
                id: gateOutPort, label: 'GATE OUT', direction: 'output', signal: 'gate'
            }));
            lanes.appendChild(lanePanel);
        });
        root.appendChild(lanes);

        const transportRow = toolkit.createRow('cv-rec-transport-row');
        transportRow.appendChild(toolkit.createJack({
            id: 'clock', label: 'CLOCK', direction: 'input', signal: 'trigger'
        }));
        transportRow.appendChild(toolkit.createJack({
            id: 'recordTrig', label: 'REC', direction: 'input', signal: 'trigger'
        }));
        transportRow.appendChild(toolkit.createJack({
            id: 'reset', label: 'RESET', direction: 'input', signal: 'trigger'
        }));
        transportRow.appendChild(toolkit.createJack({
            id: 'eol', label: 'EOL', direction: 'output', signal: 'trigger'
        }));
        root.appendChild(transportRow);

        const note = document.createElement('div');
        note.className = 'cv-rec-note';
        note.textContent = 'RUNTIME · MOD ONLY';
        note.title = 'Recorded lanes survive supported audio stop/start only; they are not stored in patches or page reloads.';
        root.appendChild(note);

        container.appendChild(root);

        const updateDisplay = () => {
            const state = Number.isFinite(dsp?.transportState) ? dsp.transportState : EMPTY;
            const mode = dsp?.recordedMode === CLOCK ? 'C' : 'F';
            const length = Number.isFinite(dsp?.recordedLength)
                ? clamp(Math.round(dsp.recordedLength), 0, MAX_FREE_FRAMES)
                : 0;
            if (state === EMPTY || length === 0 && state !== ARM && state !== REC) {
                display.textContent = 'EMPTY';
            } else if (state === ARM) {
                display.textContent = `ARM ${mode}`;
            } else if (state === REC) {
                display.textContent = `REC ${mode}`;
            } else {
                const label = state === PAUSE ? 'PAUSE' : 'PLAY';
                display.textContent = dsp?.recordedMode === CLOCK
                    ? `${label} C ${String(length).padStart(4, '0')}`
                    : `${label} F ${(length / FREE_FRAME_RATE).toFixed(3)}s`;
            }
        };

        updateDisplay();
        toolkit.animate(updateDisplay);
    },

    ui: {
        leds: ['recording', 'playing', 'memory', 'clock', 'eol', 'gate1', 'gate2', 'phase'],
        knobs: [],
        switches: [
            { id: 'mode', label: 'FREE / CLOCK', param: 'mode', default: FREE },
            { id: 'shape', label: 'STEP / SMOOTH', param: 'shape', default: SMOOTH },
            { id: 'playMode', label: 'LOOP / ONE', param: 'playMode', default: LOOP }
        ],
        actions: [
            { id: 'record', label: 'REC', param: 'record', mode: 'trigger', default: 0 },
            { id: 'play', label: 'PLAY', param: 'play', mode: 'trigger', default: 0 },
            { id: 'resetAction', label: 'RESET', param: 'resetAction', mode: 'trigger', default: 0 },
            { id: 'clear', label: 'CLEAR', param: 'clear', mode: 'trigger', default: 0 }
        ],
        inputs: [
            { id: 'cv1In', label: 'CV 1 IN', port: 'cv1In', signal: 'cv', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'gate1In', label: 'GATE 1 IN', port: 'gate1In', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'cv2In', label: 'CV 2 IN', port: 'cv2In', signal: 'cv', voltage: { min: -10, max: 10, normal: 0 } },
            { id: 'gate2In', label: 'GATE 2 IN', port: 'gate2In', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'clock', label: 'CLOCK', port: 'clock', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'recordTrig', label: 'REC', port: 'recordTrig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
            { id: 'reset', label: 'RESET', port: 'reset', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } }
        ],
        outputs: [
            { id: 'cv1Out', label: 'CV 1 OUT', port: 'cv1Out', signal: 'cv', voltage: { min: -10, max: 10 } },
            { id: 'gate1Out', label: 'GATE 1 OUT', port: 'gate1Out', signal: 'gate', voltage: { min: 0, max: 10 } },
            { id: 'cv2Out', label: 'CV 2 OUT', port: 'cv2Out', signal: 'cv', voltage: { min: -10, max: 10 } },
            { id: 'gate2Out', label: 'GATE 2 OUT', port: 'gate2Out', signal: 'gate', voltage: { min: 0, max: 10 } },
            { id: 'eol', label: 'EOL', port: 'eol', signal: 'trigger', voltage: { min: 0, max: 10 } }
        ]
    }
};
