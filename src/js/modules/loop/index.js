/**
 * LOOP - Minimal Looper
 *
 * Based on 2hp Loop.
 * A compact mono looper with four recording modes, reverse, and half-speed playback.
 */

const MAX_LOOP_SECONDS = 60;
const TRIGGER_THRESHOLD = 2.5;
const AUDIO_LIMIT = 5;
const MODE_SETTINGS = [
    { label: 'SOS', title: 'Sound on Sound', feedback: 1.0, inputGain: 0.8, replace: false },
    { label: 'DUB', title: 'Dub Overdub', feedback: 0.85, inputGain: 0.9, replace: false },
    { label: 'RPL', title: 'Replace Recording', feedback: 0, inputGain: 1.0, replace: true },
    { label: 'INF', title: 'Infinite Overdub', feedback: 0.97, inputGain: 0.7, replace: false }
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function wrap(position, length) {
    if (length <= 0) return 0;
    while (position >= length) position -= length;
    while (position < 0) position += length;
    return position;
}

function readInterpolated(buffer, position, length) {
    if (length <= 0) return 0;
    const wrapped = wrap(position, length);
    const i0 = Math.floor(wrapped);
    const frac = wrapped - i0;
    const i1 = (i0 + 1) % length;
    return buffer[i0] + (buffer[i1] - buffer[i0]) * frac;
}

export default {
    id: 'loop',
    name: 'LOOP',
    hp: 6,
    color: 'module-color-ten',
    category: 'effect',

    css: `
        .loop-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 5px 2px;
            gap: 5px;
            align-items: center;
        }
        .loop-leds,
        .loop-mode,
        .loop-switches {
            display: flex;
            justify-content: center;
            gap: 4px;
            width: 100%;
        }
        .loop-mode {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 3px;
            width: 88px;
        }
        .loop-mode .octave-btn {
            width: 100%;
            height: 18px;
            min-width: 0;
            max-width: 20px;
            justify-self: center;
            padding: 0;
            font-size: 6px;
            overflow: hidden;
        }
        .loop-clear {
            width: 30px;
            height: 20px;
            padding: 0;
            font-size: 8px;
        }
        .loop-record-area {
            display: flex;
            justify-content: center;
            width: 100%;
        }
        .loop-record-button {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: linear-gradient(145deg, #333, #222);
            border: 3px solid #444;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            transition: all 0.1s;
        }
        .loop-record-button:hover {
            border-color: #666;
        }
        .loop-record-button:active {
            transform: scale(0.95);
        }
        .loop-record-button.recording {
            border-color: #ff0000;
            box-shadow: 0 0 10px #ff000044;
        }
        .loop-record-button-inner {
            width: 19px;
            height: 19px;
            border-radius: 50%;
            background: #cc0000;
            transition: all 0.1s;
        }
        .loop-record-button.recording .loop-record-button-inner {
            width: 15px;
            height: 15px;
            border-radius: 4px;
            background: #ff0000;
        }
        .loop-knobs {
            display: flex;
            justify-content: center;
            gap: 8px;
            width: 100%;
        }
        .loop-switches .knob-container,
        .loop-container .knob-container {
            gap: 2px;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ownIn = new Float32Array(bufferSize);
        const ownRecTrig = new Float32Array(bufferSize);
        const ownReverseTrig = new Float32Array(bufferSize);
        const out = new Float32Array(bufferSize);

        const maxSamples = Math.max(2, Math.ceil(sampleRate * MAX_LOOP_SECONDS));
        const loopBuffer = new Float32Array(maxSamples);

        let hasLoop = false;
        let recording = false;
        let recordHead = 0;
        let playHead = 0;
        let loopLength = 0;
        let lastRecordParam = 0;
        let lastRecTrigHigh = false;
        let lastReverseTrigHigh = false;

        function clearLoop(dsp) {
            loopBuffer.fill(0);
            out.fill(0);
            hasLoop = false;
            recording = false;
            recordHead = 0;
            playHead = 0;
            loopLength = 0;
            lastRecordParam = 0;
            dsp.params.record = 0;
            dsp.params.clear = 0;
        }

        function resetTransport(dsp) {
            out.fill(0);
            recording = false;
            recordHead = hasLoop ? loopLength : 0;
            playHead = 0;
            lastRecordParam = 0;
            lastRecTrigHigh = false;
            lastReverseTrigHigh = false;
            dsp.params.record = 0;
            dsp.params.clear = 0;
            dsp.leds.recording = 0;
            dsp.leds.playing = hasLoop ? 1 : 0;
            dsp.leds.hasLoop = hasLoop ? 1 : 0;
        }

        function restoreLoopState(state) {
            if (!state?.hasLoop || !state.loopLength || !state.buffer) return;

            const restoredLength = Math.min(state.loopLength, maxSamples, state.buffer.length);
            if (restoredLength <= 1) return;

            loopBuffer.fill(0);
            loopBuffer.set(state.buffer.slice(0, restoredLength));
            hasLoop = true;
            recording = false;
            loopLength = restoredLength;
            recordHead = restoredLength;
            playHead = wrap(state.playHead || 0, loopLength);
        }

        function getRecordingLimitSamples(dsp) {
            return Math.floor(clamp(dsp.params.length ?? 1, 0, 1) * maxSamples);
        }

        function finishFirstRecording(dsp) {
            if (!hasLoop && recordHead > 1) {
                loopLength = Math.min(recordHead, maxSamples);
                hasLoop = true;
                playHead = 0;
            }
            recording = false;
            dsp.params.record = 0;
            lastRecordParam = 0;
        }

        function syncRecordState(dsp) {
            const recordParam = dsp.params.record ? 1 : 0;
            if (recordParam === lastRecordParam) return;

            if (recordParam) {
                recording = true;
                if (!hasLoop) {
                    loopBuffer.fill(0);
                    recordHead = 0;
                    playHead = 0;
                    loopLength = 0;
                }
            } else if (recording) {
                if (!hasLoop) {
                    finishFirstRecording(dsp);
                } else {
                    recording = false;
                }
            }

            lastRecordParam = dsp.params.record ? 1 : 0;
        }

        return {
            params: {
                mode: 0,
                record: 0,
                reverse: 0,
                halfSpeed: 0,
                level: 0.8,
                length: 1,
                mix: 1,
                clear: 0
            },

            inputs: {
                in: ownIn,
                recTrig: ownRecTrig,
                reverseTrig: ownReverseTrig
            },

            outputs: { out },

            leds: {
                recording: 0,
                playing: 0,
                hasLoop: 0
            },

            process() {
                if (this.params.clear) {
                    clearLoop(this);
                }

                const input = this.inputs.in;
                const recTrig = this.inputs.recTrig;
                const reverseTrig = this.inputs.reverseTrig;
                const level = clamp(this.params.level, 0, 1);
                const mix = clamp(this.params.mix ?? 1, 0, 1);

                for (let i = 0; i < bufferSize; i++) {
                    const recHigh = recTrig[i] > TRIGGER_THRESHOLD;
                    if (recHigh && !lastRecTrigHigh) {
                        this.params.record = this.params.record ? 0 : 1;
                    }
                    lastRecTrigHigh = recHigh;

                    const reverseHigh = reverseTrig[i] > TRIGGER_THRESHOLD;
                    if (reverseHigh && !lastReverseTrigHigh) {
                        this.params.reverse = this.params.reverse ? 0 : 1;
                    }
                    lastReverseTrigHigh = reverseHigh;

                    syncRecordState(this);

                    const inputSample = clamp(input[i], -AUDIO_LIMIT, AUDIO_LIMIT);

                    if (!hasLoop && recording) {
                        const recordingLimit = getRecordingLimitSamples(this);
                        if (recordingLimit <= 1) {
                            recording = false;
                            recordHead = 0;
                            this.params.record = 0;
                            lastRecordParam = 0;
                            out[i] = 0;
                            continue;
                        }

                        loopBuffer[recordHead] = inputSample;
                        out[i] = inputSample * level;
                        recordHead++;
                        if (recordHead >= recordingLimit) {
                            finishFirstRecording(this);
                        }
                        continue;
                    }

                    if (!hasLoop || loopLength <= 1) {
                        out[i] = inputSample * (1 - mix) * level;
                        continue;
                    }

                    const loopSample = readInterpolated(loopBuffer, playHead, loopLength);
                    out[i] = (inputSample * (1 - mix) + loopSample * mix) * level;

                    if (recording) {
                        const writeIndex = Math.floor(wrap(playHead, loopLength));
                        const mode = MODE_SETTINGS[clamp(Math.round(this.params.mode), 0, MODE_SETTINGS.length - 1)];
                        if (mode.replace) {
                            loopBuffer[writeIndex] = inputSample;
                        } else {
                            loopBuffer[writeIndex] = clamp(
                                loopBuffer[writeIndex] * mode.feedback + inputSample * mode.inputGain,
                                -AUDIO_LIMIT,
                                AUDIO_LIMIT
                            );
                        }
                    }

                    const direction = this.params.reverse ? -1 : 1;
                    const ratio = this.params.halfSpeed ? 0.5 : 1;
                    playHead = wrap(playHead + direction * ratio, loopLength);
                }

                this.leds.recording = recording ? 1 : 0;
                this.leds.playing = hasLoop ? 1 : 0;
                this.leds.hasLoop = hasLoop ? 1 : 0;

                if (this.inputs.in !== ownIn) {
                    ownIn.fill(0);
                    this.inputs.in = ownIn;
                }
                if (this.inputs.recTrig !== ownRecTrig) {
                    ownRecTrig.fill(0);
                    this.inputs.recTrig = ownRecTrig;
                }
                if (this.inputs.reverseTrig !== ownReverseTrig) {
                    ownReverseTrig.fill(0);
                    this.inputs.reverseTrig = ownReverseTrig;
                }
            },

            reset() {
                resetTransport(this);
            },

            getRuntimeState() {
                return {
                    hasLoop,
                    loopLength,
                    recordHead,
                    playHead,
                    buffer: Array.from(loopBuffer.slice(0, loopLength))
                };
            },

            restoreRuntimeState(state) {
                restoreLoopState(state);
                resetTransport(this);
            },

            getLoopInfo() {
                return {
                    hasLoop,
                    recording,
                    loopLength,
                    recordHead,
                    playHead,
                    maxSamples
                };
            },

            getBufferSample(index) {
                return loopBuffer[index] || 0;
            }
        };
    },

    captureRuntimeState(dsp) {
        return dsp?.getRuntimeState?.() || null;
    },

    restoreRuntimeState(dsp, state) {
        dsp?.restoreRuntimeState?.(state);
    },

    render(container, { instance, toolkit, onParamChange }) {
        const dsp = instance.dsp;
        const getModule = instance.getModule;
        const main = document.createElement('div');
        main.className = 'loop-container';

        const ledRow = document.createElement('div');
        ledRow.className = 'loop-leds';
        ledRow.appendChild(toolkit.createLED({ id: 'recording', color: 'red' }));
        ledRow.appendChild(toolkit.createLED({ id: 'playing', color: 'green' }));
        ledRow.appendChild(toolkit.createLED({ id: 'hasLoop', color: 'blue' }));
        main.appendChild(ledRow);

        const modeBank = document.createElement('div');
        modeBank.className = 'loop-mode button-bank';
        modeBank.dataset.module = instance.id;
        modeBank.dataset.param = 'mode';
        MODE_SETTINGS.forEach((mode, index) => {
            const btn = document.createElement('button');
            btn.className = `octave-btn${index === (dsp?.params.mode ?? 0) ? ' active' : ''}`;
            btn.dataset.value = index;
            btn.textContent = mode.label;
            btn.title = mode.title;
            btn.addEventListener('click', () => {
                modeBank.querySelectorAll('.octave-btn').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                onParamChange('mode', index);
            });
            modeBank.appendChild(btn);
        });
        main.appendChild(modeBank);

        const recordArea = document.createElement('div');
        recordArea.className = 'loop-record-area';

        const recordButton = document.createElement('button');
        recordButton.className = `loop-record-button${dsp?.params.record ? ' recording' : ''}`;
        recordButton.dataset.module = instance.id;
        recordButton.dataset.param = 'record';
        recordButton.dataset.rendererManaged = 'true';
        recordButton.title = 'Record Loop';

        const recordButtonInner = document.createElement('span');
        recordButtonInner.className = 'loop-record-button-inner';
        recordButton.appendChild(recordButtonInner);

        recordButton.addEventListener('mousedown', event => {
            event.stopPropagation();
        });
        recordButton.addEventListener('click', event => {
            event.stopPropagation();
            const value = recordButton.classList.contains('recording') ? 0 : 1;
            recordButton.classList.toggle('recording', value === 1);
            onParamChange('record', value);
        });

        recordArea.appendChild(recordButton);
        main.appendChild(recordArea);

        const switchRow = document.createElement('div');
        switchRow.className = 'loop-switches';
        switchRow.appendChild(toolkit.createSwitch({
            id: 'reverse',
            label: 'Rev',
            value: dsp?.params.reverse || 0
        }));
        switchRow.appendChild(toolkit.createSwitch({
            id: 'halfSpeed',
            label: '1/2',
            value: dsp?.params.halfSpeed || 0
        }));
        main.appendChild(switchRow);

        const knobRow = document.createElement('div');
        knobRow.className = 'loop-knobs';
        knobRow.appendChild(toolkit.createKnob({
            id: 'length',
            label: 'Len',
            value: dsp?.params.length ?? 1,
            min: 0,
            max: 1,
            small: true
        }));
        knobRow.appendChild(toolkit.createKnob({
            id: 'mix',
            label: 'Mix',
            value: dsp?.params.mix ?? 1,
            min: 0,
            max: 1,
            small: true
        }));
        knobRow.appendChild(toolkit.createKnob({
            id: 'level',
            label: 'Lvl',
            value: dsp?.params.level ?? 0.8,
            min: 0,
            max: 1,
            small: true
        }));
        main.appendChild(knobRow);

        const clearButton = document.createElement('button');
        clearButton.className = 'toggle-btn loop-clear';
        clearButton.dataset.module = instance.id;
        clearButton.dataset.param = 'clear';
        clearButton.dataset.rendererManaged = 'true';
        clearButton.textContent = 'CLR';
        clearButton.title = 'Clear Loop';
        clearButton.addEventListener('click', () => {
            clearButton.classList.add('active');
            onParamChange('clear', 1);
            setTimeout(() => {
                clearButton.classList.remove('active');
                onParamChange('clear', 0);
            }, 80);
        });
        main.appendChild(clearButton);

        main.appendChild(toolkit.createSpacer());
        main.appendChild(toolkit.createSection('Out'));

        const outRow = toolkit.createRow();
        outRow.appendChild(toolkit.createJack({ id: 'out', label: 'Out', direction: 'output', type: 'audio' }));
        main.appendChild(outRow);

        main.appendChild(toolkit.createSection('In'));

        const inRow = toolkit.createRow();
        inRow.appendChild(toolkit.createJack({ id: 'in', label: 'In', direction: 'input', type: 'audio' }));
        inRow.appendChild(toolkit.createJack({ id: 'recTrig', label: 'Rec', direction: 'input', type: 'trigger' }));
        inRow.appendChild(toolkit.createJack({ id: 'reverseTrig', label: 'Rev', direction: 'input', type: 'trigger' }));
        main.appendChild(inRow);

        container.appendChild(main);

        let animationId = null;

        function syncRecordButton() {
            const mod = getModule ? getModule() : null;
            const liveDsp = mod?.instance || dsp;
            const liveValue = liveDsp?.params?.record ?? mod?.params?.record ?? 0;
            const value = liveValue ? 1 : 0;

            recordButton.classList.toggle('recording', value === 1);

            if (mod?.params && mod.params.record !== value) {
                onParamChange('record', value);
            }
        }

        function animate() {
            syncRecordButton();
            animationId = requestAnimationFrame(animate);
        }

        animate();

        instance.cleanup = () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
    },

    ui: {
        leds: ['recording', 'playing', 'hasLoop'],
        knobs: [
            { id: 'length', label: 'Len', param: 'length', min: 0, max: 1, default: 1, small: true },
            { id: 'mix', label: 'Mix', param: 'mix', min: 0, max: 1, default: 1, small: true },
            { id: 'level', label: 'Lvl', param: 'level', min: 0, max: 1, default: 0.8, small: true }
        ],
        switches: [
            { id: 'record', label: 'Rec', param: 'record', default: 0 },
            { id: 'reverse', label: 'Rev', param: 'reverse', default: 0 },
            { id: 'halfSpeed', label: '1/2', param: 'halfSpeed', default: 0 },
            { id: 'clear', label: 'Clr', param: 'clear', default: 0 }
        ],
        buttons: [
            { id: 'mode', label: 'Mode', param: 'mode', values: [0, 1, 2, 3], default: 0 }
        ],
        inputs: [
            { id: 'in', label: 'In', port: 'in', type: 'audio' },
            { id: 'recTrig', label: 'Rec', port: 'recTrig', type: 'trigger' },
            { id: 'reverseTrig', label: 'Rev', port: 'reverseTrig', type: 'trigger' }
        ],
        outputs: [
            { id: 'out', label: 'Out', port: 'out', type: 'audio' }
        ]
    }
};
