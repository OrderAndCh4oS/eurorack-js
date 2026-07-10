/**
 * JOY - Joystick Controller
 *
 * Inspired by Intellijel Planar 2 and Flight of Harmony Choices.
 * V1 scope is performance CV generation, gate/trigger output, CV automation,
 * and runtime gesture recording/playback without Planar-style audio mixing.
 */

import { clamp } from '../../utils/math.js';
import { createSlew } from '../../utils/slew.js';

const TRIGGER_THRESHOLD = 2.5;
const GATE_HIGH = 10;
const TRIGGER_MS = 8;
const SMOOTH_TIME_MS = 0.5;
const GESTURE_RATE_HZ = 500;
const MAX_RECORD_SECONDS = 64;
const MOVEMENT_EPSILON = 0.0025;
const TAU = Math.PI * 2;

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function boolParam(value) {
    return finite(value) >= 0.5 ? 1 : 0;
}

function clampParam(value, min, max, fallback = min) {
    return clamp(finite(value, fallback), min, max);
}

function clampIntParam(value, min, max, fallback = min) {
    return clamp(Math.round(finite(value, fallback)), min, max);
}

function wrapPosition(position, length) {
    if (length <= 0) return 0;
    let wrapped = position % length;
    if (wrapped < 0) wrapped += length;
    return wrapped;
}

function applyScanCurve(position, curve) {
    const centered = clamp(curve, 0, 1);
    if (Math.abs(centered - 0.5) < 0.001) return position;

    const exponent = Math.pow(2, (centered - 0.5) * 4);
    return Math.pow(clamp(position, 0, 1), exponent);
}

function sanitizeParams(params) {
    params.x = clampParam(params.x, -1, 1, 0);
    params.y = clampParam(params.y, -1, 1, 0);
    params.range = clampIntParam(params.range, 0, 1, 0);
    params.cvMode = clampIntParam(params.cvMode, 0, 2, 0);
    params.cv1Amt = clampParam(params.cv1Amt, 0, 1, 0.5);
    params.cv2Amt = clampParam(params.cv2Amt, 0, 1, 0.5);
    params.sense = boolParam(params.sense);
    params.gateButton = boolParam(params.gateButton);
    params.record = boolParam(params.record);
    params.play = boolParam(params.play);
    params.loopMode = clampIntParam(params.loopMode, 0, 2, 1);
}

export default {
    id: 'joystick',
    name: 'JOY',
    hp: 10,
    color: 'module-color-six',
    category: 'utility',
    telemetry: { fields: [], methods: [] },

    css: `
        .joystick-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
            padding: 4px 3px;
            gap: 4px;
        }
        .joystick-led-grid {
            display: grid;
            grid-template-columns: repeat(6, 10px);
            gap: 3px;
            justify-content: center;
            width: 100%;
        }
        .joystick-pad {
            position: relative;
            width: 106px;
            height: 106px;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 6px;
            background:
                linear-gradient(90deg, transparent 49%, rgba(255, 255, 255, 0.16) 50%, transparent 51%),
                linear-gradient(0deg, transparent 49%, rgba(255, 255, 255, 0.16) 50%, transparent 51%),
                linear-gradient(135deg, rgba(60, 70, 80, 0.68), rgba(18, 22, 28, 0.86));
            touch-action: none;
            cursor: crosshair;
        }
        .joystick-pad::before,
        .joystick-pad::after {
            content: '';
            position: absolute;
            pointer-events: none;
            border-color: rgba(255, 255, 255, 0.12);
        }
        .joystick-pad::before {
            inset: 25%;
            border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .joystick-pad::after {
            inset: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .joystick-handle {
            position: absolute;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.88);
            background: rgba(18, 20, 24, 0.92);
            box-shadow: 0 0 9px rgba(90, 190, 255, 0.55);
            transform: translate(-50%, -50%);
            left: 50%;
            top: 50%;
            pointer-events: none;
        }
        .joystick-controls,
        .joystick-knobs,
        .joystick-actions,
        .joystick-jacks {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 4px;
            width: 100%;
        }
        .joystick-controls {
            flex-wrap: wrap;
        }
        .joystick-controls .octave-btn,
        .joystick-actions .octave-btn {
            min-width: 24px;
            height: 18px;
            padding: 0 3px;
            font-size: 7px;
            line-height: 1;
        }
        .joystick-gate {
            border-radius: 50%;
            min-width: 28px;
            width: 28px;
        }
        .joystick-container .knob-container {
            gap: 2px;
        }
        .joystick-container .jack-label {
            max-width: 22px;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const xOut = new Float32Array(bufferSize);
        const yOut = new Float32Array(bufferSize);
        const aOut = new Float32Array(bufferSize);
        const bOut = new Float32Array(bufferSize);
        const cOut = new Float32Array(bufferSize);
        const dOut = new Float32Array(bufferSize);
        const gateOut = new Float32Array(bufferSize);
        const trigOut = new Float32Array(bufferSize);

        const controlRate = Math.max(1, Math.min(GESTURE_RATE_HZ, sampleRate));
        const recordIntervalSamples = Math.max(1, Math.round(sampleRate / controlRate));
        const playbackFrameInc = controlRate / sampleRate;
        const maxFrames = Math.max(2, Math.ceil(MAX_RECORD_SECONDS * controlRate));
        const gestureX = new Float32Array(maxFrames);
        const gestureY = new Float32Array(maxFrames);
        const gestureGate = new Uint8Array(maxFrames);

        const xSlew = createSlew({ sampleRate, timeMs: SMOOTH_TIME_MS });
        const ySlew = createSlew({ sampleRate, timeMs: SMOOTH_TIME_MS });

        const triggerSamples = Math.max(1, Math.round(sampleRate * (TRIGGER_MS / 1000)));
        const movementHoldLimit = Math.max(bufferSize, Math.round(sampleRate * 0.005));

        let gestureLength = 0;
        let recording = false;
        let playing = false;
        let playHead = 0;
        let samplesUntilRecord = 0;
        let triggerSamplesRemaining = 0;
        let movementHoldSamples = 0;
        let previousSmoothedX = 0;
        let previousSmoothedY = 0;
        let lastOutputGateHigh = false;
        let lastTriggerHigh = false;
        let lastResetHigh = false;

        function hasGesture() {
            return gestureLength > 1;
        }

        function readGesture(position, loop = false) {
            if (!hasGesture()) return { x: 0, y: 0, gate: 0 };

            const length = gestureLength;
            const readPosition = loop ? wrapPosition(position, length) : clamp(position, 0, length - 1);
            const i0 = Math.floor(readPosition);
            const frac = readPosition - i0;
            const i1 = loop ? (i0 + 1) % length : Math.min(i0 + 1, length - 1);

            return {
                x: gestureX[i0] + (gestureX[i1] - gestureX[i0]) * frac,
                y: gestureY[i0] + (gestureY[i1] - gestureY[i0]) * frac,
                gate: frac < 0.5 ? gestureGate[i0] : gestureGate[i1]
            };
        }

        function stopPlayback(dsp) {
            playing = false;
            playHead = 0;
            dsp.params.play = 0;
        }

        function beginPlayback(dsp) {
            if (!hasGesture()) {
                stopPlayback(dsp);
                return;
            }
            recording = false;
            dsp.params.record = 0;
            playing = true;
            playHead = 0;
            dsp.params.play = 1;
        }

        function beginRecording(dsp) {
            recording = true;
            playing = false;
            dsp.params.play = 0;
            dsp.params.record = 1;
            gestureLength = 0;
            playHead = 0;
            samplesUntilRecord = 0;
        }

        function finishRecording(dsp) {
            recording = false;
            dsp.params.record = 0;
            if (gestureLength < 2) {
                gestureLength = 0;
            }
        }

        function resetTransport(dsp) {
            recording = false;
            playing = false;
            playHead = 0;
            samplesUntilRecord = 0;
            triggerSamplesRemaining = 0;
            movementHoldSamples = 0;
            lastOutputGateHigh = false;
            dsp.params.record = 0;
            dsp.params.play = 0;
        }

        function writeGestureFrame(x, y, gate, dsp) {
            if (gestureLength >= maxFrames) {
                finishRecording(dsp);
                return;
            }

            gestureX[gestureLength] = clamp(x, -1, 1);
            gestureY[gestureLength] = clamp(y, -1, 1);
            gestureGate[gestureLength] = gate ? 1 : 0;
            gestureLength++;

            if (gestureLength >= maxFrames) {
                finishRecording(dsp);
            }
        }

        function syncTransportParams(dsp) {
            if (dsp.params.record && !recording) {
                beginRecording(dsp);
            } else if (!dsp.params.record && recording) {
                finishRecording(dsp);
            }

            if (dsp.params.play && !playing) {
                beginPlayback(dsp);
            } else if (!dsp.params.play && playing) {
                stopPlayback(dsp);
            }
        }

        function applyCvAutomation(baseX, baseY, cv1, cv2, params) {
            const amount1 = (params.cv1Amt - 0.5) * 2;
            const amount2 = (params.cv2Amt - 0.5) * 2;

            if (params.cvMode === 1) {
                const angle = (cv1 / 5) * amount1 * TAU;
                const radius = clamp((cv2 / 5) * amount2, -1, 1);
                return {
                    x: clamp(baseX + Math.cos(angle) * radius, -1, 1),
                    y: clamp(baseY + Math.sin(angle) * radius, -1, 1),
                    gate: null
                };
            }

            if (params.cvMode === 2 && hasGesture()) {
                const scan = clamp(0.5 + (cv1 / 10) * amount1, 0, 1);
                const curve = clamp(0.5 + (cv2 / 10) * amount2, 0, 1);
                const curved = applyScanCurve(scan, curve);
                const frame = readGesture(curved * (gestureLength - 1), false);
                return {
                    x: clamp(frame.x, -1, 1),
                    y: clamp(frame.y, -1, 1),
                    gate: frame.gate ? 1 : 0
                };
            }

            return {
                x: clamp(baseX + (cv1 / 5) * amount1, -1, 1),
                y: clamp(baseY + (cv2 / 5) * amount2, -1, 1),
                gate: null
            };
        }

        return {
            params: {
                x: 0,
                y: 0,
                range: 0,
                cvMode: 0,
                cv1Amt: 0.5,
                cv2Amt: 0.5,
                sense: 1,
                gateButton: 0,
                record: 0,
                play: 0,
                loopMode: 1
            },

            inputs: {
                cv1: new Float32Array(bufferSize),
                cv2: new Float32Array(bufferSize),
                trigger: new Float32Array(bufferSize),
                reset: new Float32Array(bufferSize)
            },

            outputs: {
                x: xOut,
                y: yOut,
                a: aOut,
                b: bOut,
                c: cOut,
                d: dOut,
                gate: gateOut,
                trig: trigOut
            },

            leds: {
                xPositive: 0,
                xNegative: 0,
                yPositive: 0,
                yNegative: 0,
                a: 0,
                b: 0,
                c: 0,
                d: 0,
                gate: 0,
                record: 0,
                play: 0,
                trigger: 0
            },

            process() {
                sanitizeParams(this.params);
                syncTransportParams(this);

                let triggerActivity = false;
                let lastX = previousSmoothedX;
                let lastY = previousSmoothedY;
                let lastGate = false;

                for (let i = 0; i < bufferSize; i++) {
                    const resetHigh = this.inputs.reset[i] > TRIGGER_THRESHOLD;
                    const resetEdge = resetHigh && !lastResetHigh;
                    const inputTriggerHigh = this.inputs.trigger[i] > TRIGGER_THRESHOLD;
                    const inputTriggerEdge = inputTriggerHigh && !lastTriggerHigh;

                    if (resetEdge) {
                        resetTransport(this);
                    }

                    if (inputTriggerEdge) {
                        triggerActivity = true;
                        if (this.params.record) {
                            beginRecording(this);
                        } else if (hasGesture() && !recording) {
                            beginPlayback(this);
                        }
                    }

                    let baseX = this.params.x;
                    let baseY = this.params.y;
                    let gestureGateHigh = false;

                    if (playing && hasGesture()) {
                        const frame = readGesture(playHead, this.params.loopMode === 1);
                        baseX = frame.x;
                        baseY = frame.y;
                        gestureGateHigh = frame.gate > 0;

                        playHead += playbackFrameInc;
                        if (playHead >= gestureLength) {
                            if (this.params.loopMode === 1) {
                                playHead = wrapPosition(playHead, gestureLength);
                            } else {
                                stopPlayback(this);
                            }
                        }
                    }

                    const automated = applyCvAutomation(
                        baseX,
                        baseY,
                        this.inputs.cv1[i] || 0,
                        this.inputs.cv2[i] || 0,
                        this.params
                    );
                    if (automated.gate !== null) {
                        gestureGateHigh = automated.gate > 0;
                    }

                    const targetX = clamp(automated.x, -1, 1);
                    const targetY = clamp(automated.y, -1, 1);
                    const smoothedX = clamp(xSlew.process(targetX), -1, 1);
                    const smoothedY = clamp(ySlew.process(targetY), -1, 1);
                    const delta = Math.hypot(smoothedX - previousSmoothedX, smoothedY - previousSmoothedY);

                    if (this.params.sense && delta > MOVEMENT_EPSILON) {
                        movementHoldSamples = movementHoldLimit;
                    } else if (movementHoldSamples > 0) {
                        movementHoldSamples--;
                    }

                    const manualGateHigh = this.params.gateButton > 0;
                    const playbackLikeGate = playing || (this.params.cvMode === 2 && hasGesture());
                    const movementGateHigh = this.params.sense && movementHoldSamples > 0;
                    const outputGateHigh = playbackLikeGate
                        ? (manualGateHigh || gestureGateHigh)
                        : (manualGateHigh || movementGateHigh);

                    if (outputGateHigh && !lastOutputGateHigh) {
                        triggerSamplesRemaining = triggerSamples;
                    }

                    if (triggerSamplesRemaining > 0) {
                        trigOut[i] = GATE_HIGH;
                        triggerSamplesRemaining--;
                        triggerActivity = true;
                    } else {
                        trigOut[i] = 0;
                    }

                    const nx = (smoothedX + 1) * 0.5;
                    const ny = (smoothedY + 1) * 0.5;
                    xOut[i] = this.params.range
                        ? clamp((smoothedX + 1) * 5, 0, 10)
                        : clamp(smoothedX * 5, -5, 5);
                    yOut[i] = this.params.range
                        ? clamp((smoothedY + 1) * 5, 0, 10)
                        : clamp(smoothedY * 5, -5, 5);
                    aOut[i] = clamp((1 - nx) * ny * 10, 0, 10);
                    bOut[i] = clamp(nx * ny * 10, 0, 10);
                    cOut[i] = clamp(nx * (1 - ny) * 10, 0, 10);
                    dOut[i] = clamp((1 - nx) * (1 - ny) * 10, 0, 10);
                    gateOut[i] = outputGateHigh ? GATE_HIGH : 0;

                    if (recording) {
                        if (samplesUntilRecord <= 0) {
                            writeGestureFrame(smoothedX, smoothedY, outputGateHigh, this);
                            samplesUntilRecord = recordIntervalSamples - 1;
                        } else {
                            samplesUntilRecord--;
                        }
                    }

                    previousSmoothedX = smoothedX;
                    previousSmoothedY = smoothedY;
                    lastOutputGateHigh = outputGateHigh;
                    lastTriggerHigh = inputTriggerHigh;
                    lastResetHigh = resetHigh;
                    lastX = smoothedX;
                    lastY = smoothedY;
                    lastGate = outputGateHigh;
                }

                this.leds.xPositive = clamp(Math.max(0, lastX), 0, 1);
                this.leds.xNegative = clamp(Math.max(0, -lastX), 0, 1);
                this.leds.yPositive = clamp(Math.max(0, lastY), 0, 1);
                this.leds.yNegative = clamp(Math.max(0, -lastY), 0, 1);
                this.leds.a = clamp(aOut[bufferSize - 1] / 10, 0, 1);
                this.leds.b = clamp(bOut[bufferSize - 1] / 10, 0, 1);
                this.leds.c = clamp(cOut[bufferSize - 1] / 10, 0, 1);
                this.leds.d = clamp(dOut[bufferSize - 1] / 10, 0, 1);
                this.leds.gate = lastGate ? 1 : 0;
                this.leds.record = recording ? 1 : 0;
                this.leds.play = playing ? 1 : 0;
                this.leds.trigger = triggerActivity ? 1 : 0;
            },

            reset() {
                xOut.fill(0);
                yOut.fill(0);
                aOut.fill(0);
                bOut.fill(0);
                cOut.fill(0);
                dOut.fill(0);
                gateOut.fill(0);
                trigOut.fill(0);
                resetTransport(this);
                xSlew.reset(0);
                ySlew.reset(0);
                previousSmoothedX = 0;
                previousSmoothedY = 0;
                lastTriggerHigh = false;
                lastResetHigh = false;
                Object.keys(this.leds).forEach(key => {
                    this.leds[key] = 0;
                });
            },

            getGestureInfo() {
                return {
                    hasRecording: hasGesture(),
                    recording,
                    playing,
                    length: gestureLength,
                    playHead,
                    maxFrames,
                    controlRate,
                    recordIntervalSamples
                };
            },

            getGestureFrame(index) {
                const safeIndex = clampIntParam(index, 0, Math.max(0, gestureLength - 1), 0);
                return {
                    x: gestureX[safeIndex] || 0,
                    y: gestureY[safeIndex] || 0,
                    gate: gestureGate[safeIndex] || 0
                };
            }
        };
    },

    render(container, { instance, toolkit, onParamChange, onCleanup }) {
        const dsp = instance.dsp;
        const getModule = instance.getModule;
        const main = document.createElement('div');
        main.className = 'joystick-container';

        const ledGrid = document.createElement('div');
        ledGrid.className = 'joystick-led-grid';
        [
            'xNegative', 'xPositive', 'yNegative', 'yPositive',
            'a', 'b', 'c', 'd',
            'gate', 'record', 'play', 'trigger'
        ].forEach(id => {
            ledGrid.appendChild(toolkit.createLED({
                id,
                color: ['record', 'trigger'].includes(id) ? 'red' : 'green'
            }));
        });
        main.appendChild(ledGrid);

        const pad = document.createElement('div');
        pad.className = 'joystick-pad';
        pad.title = 'Joystick X/Y';
        const handle = document.createElement('div');
        handle.className = 'joystick-handle';
        pad.appendChild(handle);
        main.appendChild(pad);

        function setPadPosition(x, y) {
            handle.style.left = `${(clamp(x, -1, 1) + 1) * 50}%`;
            handle.style.top = `${(1 - clamp(y, -1, 1)) * 50}%`;
        }

        function getLiveParams() {
            const mod = getModule ? getModule() : null;
            const liveDsp = mod?.instance || dsp;
            return liveDsp?.params || mod?.params || {};
        }

        toolkit.registerParamControl('x', pad, value => {
            const params = getLiveParams();
            setPadPosition(value, params.y ?? 0);
        });
        toolkit.registerParamControl('y', pad, value => {
            const params = getLiveParams();
            setPadPosition(params.x ?? 0, value);
        });

        function updateFromPointer(event) {
            const rect = pad.getBoundingClientRect();
            const x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
            const y = clamp(1 - ((event.clientY - rect.top) / rect.height) * 2, -1, 1);
            setPadPosition(x, y);
            onParamChange('x', x);
            onParamChange('y', y);
        }

        let dragging = false;
        pad.addEventListener('pointerdown', event => {
            dragging = true;
            pad.setPointerCapture?.(event.pointerId);
            updateFromPointer(event);
            event.preventDefault();
        });
        pad.addEventListener('pointermove', event => {
            if (!dragging) return;
            updateFromPointer(event);
            event.preventDefault();
        });
        const stopDragging = event => {
            dragging = false;
            pad.releasePointerCapture?.(event.pointerId);
        };
        pad.addEventListener('pointerup', stopDragging);
        pad.addEventListener('pointercancel', stopDragging);

        const controls = document.createElement('div');
        controls.className = 'joystick-controls';

        function addButton(group, label, value, param, title = label) {
            const button = document.createElement('button');
            button.className = 'octave-btn';
            button.dataset.module = instance.id;
            button.dataset.value = value;
            button.dataset.param = param;
            button.dataset.rendererManaged = 'true';
            button.textContent = label;
            button.title = title;
            button.addEventListener('click', event => {
                event.stopPropagation();
                group.querySelectorAll(`[data-param="${param}"]`).forEach(el => {
                    el.classList.toggle('active', Number(el.dataset.value) === value);
                });
                onParamChange(param, value);
            });
            group.appendChild(button);
            return button;
        }

        const rangeGroup = document.createElement('div');
        rangeGroup.className = 'button-bank';
        addButton(rangeGroup, 'BI', 0, 'range', 'Bipolar X/Y');
        addButton(rangeGroup, 'UNI', 1, 'range', 'Unipolar X/Y');
        controls.appendChild(rangeGroup);

        const modeGroup = document.createElement('div');
        modeGroup.className = 'button-bank';
        addButton(modeGroup, 'XY', 0, 'cvMode', 'Cartesian CV');
        addButton(modeGroup, 'POL', 1, 'cvMode', 'Polar CV');
        addButton(modeGroup, 'SCN', 2, 'cvMode', 'Scan CV');
        controls.appendChild(modeGroup);

        main.appendChild(controls);

        const knobRow = document.createElement('div');
        knobRow.className = 'joystick-knobs';
        knobRow.appendChild(toolkit.createKnob({
            id: 'cv1Amt',
            label: 'CV1',
            value: dsp?.params.cv1Amt ?? 0.5,
            min: 0,
            max: 1,
            small: true
        }));
        knobRow.appendChild(toolkit.createKnob({
            id: 'cv2Amt',
            label: 'CV2',
            value: dsp?.params.cv2Amt ?? 0.5,
            min: 0,
            max: 1,
            small: true
        }));
        knobRow.appendChild(toolkit.createSwitch({
            id: 'sense',
            label: 'Move',
            value: dsp?.params.sense ?? 1
        }));
        main.appendChild(knobRow);

        const actions = document.createElement('div');
        actions.className = 'joystick-actions';
        const gateButton = document.createElement('button');
        gateButton.className = 'octave-btn joystick-gate';
        gateButton.dataset.module = instance.id;
        gateButton.dataset.param = 'gateButton';
        gateButton.dataset.rendererManaged = 'true';
        gateButton.textContent = 'G';
        gateButton.title = 'Manual Gate';
        const setGate = value => {
            gateButton.classList.toggle('active', value === 1);
            onParamChange('gateButton', value);
        };
        toolkit.registerParamControl('gateButton', gateButton, value => {
            gateButton.classList.toggle('active', (value ?? 0) >= 0.5);
        });
        gateButton.addEventListener('pointerdown', event => {
            event.preventDefault();
            setGate(1);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
            gateButton.addEventListener(type, () => setGate(0));
        });
        actions.appendChild(gateButton);

        ['record', 'play'].forEach(param => {
            const button = document.createElement('button');
            button.className = 'octave-btn';
            button.dataset.module = instance.id;
            button.dataset.param = param;
            button.dataset.rendererManaged = 'true';
            button.textContent = param === 'record' ? 'REC' : 'PLAY';
            button.title = param === 'record' ? 'Record Gesture' : 'Play Gesture';
            button.addEventListener('click', event => {
                event.stopPropagation();
                const value = button.classList.contains('active') ? 0 : 1;
                button.classList.toggle('active', value === 1);
                onParamChange(param, value);
            });
            toolkit.registerParamControl(param, button, value => {
                button.classList.toggle('active', (value ?? 0) >= 0.5);
            });
            actions.appendChild(button);
        });

        const loopGroup = document.createElement('div');
        loopGroup.className = 'button-bank';
        addButton(loopGroup, '1', 0, 'loopMode', 'One-shot');
        addButton(loopGroup, 'L', 1, 'loopMode', 'Loop');
        addButton(loopGroup, 'T', 2, 'loopMode', 'Trigger One-shot');
        actions.appendChild(loopGroup);
        main.appendChild(actions);

        main.appendChild(toolkit.createSpacer());
        main.appendChild(toolkit.createSection('Out'));
        const outRowOne = document.createElement('div');
        outRowOne.className = 'joystick-jacks';
        ['x', 'y', 'gate', 'trig'].forEach(port => {
            outRowOne.appendChild(toolkit.createJack({
                id: port,
                label: port.toUpperCase(),
                direction: 'output',
                type: port === 'gate' ? 'gate' : port === 'trig' ? 'trigger' : 'cv'
            }));
        });
        main.appendChild(outRowOne);

        const outRowTwo = document.createElement('div');
        outRowTwo.className = 'joystick-jacks';
        ['a', 'b', 'c', 'd'].forEach(port => {
            outRowTwo.appendChild(toolkit.createJack({
                id: port,
                label: port.toUpperCase(),
                direction: 'output',
                signal: 'cv'
            }));
        });
        main.appendChild(outRowTwo);

        main.appendChild(toolkit.createSection('In'));
        const inRow = document.createElement('div');
        inRow.className = 'joystick-jacks';
        [
            ['cv1', 'CV1', 'cv'],
            ['cv2', 'CV2', 'cv'],
            ['trigger', 'Trig', 'trigger'],
            ['reset', 'Rst', 'trigger']
        ].forEach(([id, label, type]) => {
            inRow.appendChild(toolkit.createJack({ id, label, direction: 'input', type }));
        });
        main.appendChild(inRow);

        container.appendChild(main);

        function syncButtons() {
            const mod = getModule ? getModule() : null;
            const params = getLiveParams();
            setPadPosition(params.x ?? 0, params.y ?? 0);

            [rangeGroup, modeGroup, loopGroup].forEach(group => {
                group.querySelectorAll('.octave-btn').forEach(button => {
                    const param = button.dataset.param;
                    button.classList.toggle('active', Number(button.dataset.value) === (params[param] ?? 0));
                });
            });

            actions.querySelectorAll('[data-param="record"], [data-param="play"]').forEach(button => {
                const param = button.dataset.param;
                const liveValue = (params[param] ?? 0) >= 0.5 ? 1 : 0;
                button.classList.toggle('active', liveValue === 1);
                if (mod?.params && mod.params[param] !== liveValue) {
                    onParamChange(param, liveValue);
                }
            });
            gateButton.classList.toggle('active', (params.gateButton ?? 0) >= 0.5);
        }

        syncButtons();
        toolkit.animate(syncButtons);
        onCleanup?.(() => setGate(0));
    },

    ui: {
        leds: [
            'xPositive', 'xNegative', 'yPositive', 'yNegative',
            'a', 'b', 'c', 'd',
            'gate', 'record', 'play', 'trigger'
        ],
        knobs: [
            { id: 'x', label: 'X', param: 'x', min: -1, max: 1, default: 0 },
            { id: 'y', label: 'Y', param: 'y', min: -1, max: 1, default: 0 },
            { id: 'cv1Amt', label: 'CV1', param: 'cv1Amt', min: 0, max: 1, default: 0.5, small: true },
            { id: 'cv2Amt', label: 'CV2', param: 'cv2Amt', min: 0, max: 1, default: 0.5, small: true }
        ],
        switches: [
            { id: 'range', label: 'Range', param: 'range', default: 0 },
            { id: 'sense', label: 'Move', param: 'sense', default: 1 }
        ],
        buttons: [
            { id: 'cvMode', label: 'CV', param: 'cvMode', values: [0, 1, 2], default: 0 },
            { id: 'loopMode', label: 'Loop', param: 'loopMode', values: [0, 1, 2], default: 1 }
        ],
        actions: [
            { id: 'gateButton', label: 'Gate', param: 'gateButton', mode: 'momentary', default: 0 },
            { id: 'record', label: 'Rec', param: 'record', mode: 'toggle', default: 0 },
            { id: 'play', label: 'Play', param: 'play', mode: 'toggle', default: 0 }
        ],
        inputs: [
            { id: 'cv1', label: 'CV1', port: 'cv1', signal: 'cv' },
            { id: 'cv2', label: 'CV2', port: 'cv2', signal: 'cv' },
            { id: 'trigger', label: 'Trig', port: 'trigger', signal: 'trigger' },
            { id: 'reset', label: 'Rst', port: 'reset', signal: 'trigger' }
        ],
        outputs: [
            { id: 'x', label: 'X', port: 'x', signal: 'cv' },
            { id: 'y', label: 'Y', port: 'y', signal: 'cv' },
            { id: 'a', label: 'A', port: 'a', signal: 'cv' },
            { id: 'b', label: 'B', port: 'b', signal: 'cv' },
            { id: 'c', label: 'C', port: 'c', signal: 'cv' },
            { id: 'd', label: 'D', port: 'd', signal: 'cv' },
            { id: 'gate', label: 'Gate', port: 'gate', signal: 'gate' },
            { id: 'trig', label: 'Trig', port: 'trig', signal: 'trigger' }
        ]
    }
};
