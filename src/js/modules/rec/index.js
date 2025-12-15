/**
 * REC - Audio Recorder Module
 *
 * Records stereo audio passing through it and exports as WAV file.
 * Patch inline between your signal chain and the output module.
 *
 * Features:
 * - Stereo pass-through (L/R in → L/R out)
 * - Record button to start/stop recording
 * - LED indicator when recording
 * - Auto-downloads WAV when recording stops
 */

import { encodeWav, downloadWav } from '../../audio/wav-encoder.js';

export default {
    id: 'rec',
    name: 'REC',
    hp: 4,
    color: '#8b0000',
    category: 'utility',

    css: `
        .rec-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 8px 4px;
            gap: 8px;
            align-items: center;
        }
        .rec-led-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .rec-led {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #331111;
            border: 2px solid #444;
            transition: all 0.1s;
        }
        .rec-led.recording {
            background: #ff0000;
            box-shadow: 0 0 12px #ff0000, 0 0 24px #ff000066;
            animation: rec-pulse 1s ease-in-out infinite;
        }
        @keyframes rec-pulse {
            0%, 100% { box-shadow: 0 0 12px #ff0000, 0 0 24px #ff000066; }
            50% { box-shadow: 0 0 20px #ff0000, 0 0 40px #ff000088; }
        }
        .rec-led-label {
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
        }
        .rec-button-area {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .rec-button {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(145deg, #333, #222);
            border: 3px solid #444;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.1s;
        }
        .rec-button:hover {
            border-color: #666;
        }
        .rec-button:active {
            transform: scale(0.95);
        }
        .rec-button.recording {
            border-color: #ff0000;
            box-shadow: 0 0 10px #ff000044;
        }
        .rec-button-inner {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #cc0000;
            transition: all 0.1s;
        }
        .rec-button.recording .rec-button-inner {
            border-radius: 4px;
            width: 16px;
            height: 16px;
            background: #ff0000;
        }
        .rec-time {
            font-size: 11px;
            color: #888;
            font-family: monospace;
            height: 16px;
        }
        .rec-time.recording {
            color: #ff6666;
        }
        .rec-jacks {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
        }
        .rec-jack-row {
            display: flex;
            gap: 8px;
        }
        .rec-jack-label {
            font-size: 8px;
            color: #666;
            text-transform: uppercase;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        const ownL = new Float32Array(bufferSize);
        const ownR = new Float32Array(bufferSize);
        const outL = new Float32Array(bufferSize);
        const outR = new Float32Array(bufferSize);

        let isRecording = false;
        let recordedL = [];
        let recordedR = [];
        let sampleCount = 0;

        // Max recording time: 5 minutes to prevent memory issues
        const maxSamples = sampleRate * 60 * 5;

        return {
            params: { record: 0 },
            inputs: { L: ownL, R: ownR },
            outputs: { outL, outR },
            leds: { recording: 0 },

            // Expose for UI to read recording time
            getRecordingTime() {
                return sampleCount / sampleRate;
            },

            getMaxRecordingTime() {
                return maxSamples / sampleRate;
            },

            process() {
                const inputL = this.inputs.L;
                const inputR = this.inputs.R;

                // Pass-through audio
                outL.set(inputL);
                outR.set(inputR);

                // Handle record state changes
                const shouldRecord = this.params.record === 1;

                if (shouldRecord && !isRecording) {
                    // Start recording
                    isRecording = true;
                    recordedL = [];
                    recordedR = [];
                    sampleCount = 0;
                }

                if (!shouldRecord && isRecording) {
                    // Stop recording - export WAV
                    isRecording = false;
                    this.exportWav();
                }

                // Capture audio if recording (with max time limit)
                if (isRecording) {
                    if (sampleCount < maxSamples) {
                        recordedL.push(new Float32Array(inputL));
                        recordedR.push(new Float32Array(inputR));
                        sampleCount += bufferSize;
                    } else {
                        // Auto-stop at max recording time
                        isRecording = false;
                        this.params.record = 0;
                        this.exportWav();
                    }
                }

                this.leds.recording = isRecording ? 1 : 0;

                // Reset inputs if replaced by routing
                if (this.inputs.L !== ownL) {
                    ownL.fill(0);
                    this.inputs.L = ownL;
                }
                if (this.inputs.R !== ownR) {
                    ownR.fill(0);
                    this.inputs.R = ownR;
                }
            },

            exportWav() {
                if (recordedL.length === 0) return;

                const blob = encodeWav(recordedL, recordedR, sampleRate);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                downloadWav(blob, `recording-${timestamp}.wav`);

                recordedL = [];
                recordedR = [];
                sampleCount = 0;
            },

            reset() {
                ownL.fill(0);
                ownR.fill(0);
                outL.fill(0);
                outR.fill(0);
                isRecording = false;
                recordedL = [];
                recordedR = [];
                sampleCount = 0;
                this.leds.recording = 0;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        const getModule = instance.getModule;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'rec-container';

        // Recording LED
        const ledArea = document.createElement('div');
        ledArea.className = 'rec-led-area';

        const led = document.createElement('div');
        led.className = 'rec-led';
        ledArea.appendChild(led);

        const ledLabel = document.createElement('div');
        ledLabel.className = 'rec-led-label';
        ledLabel.textContent = 'REC';
        ledArea.appendChild(ledLabel);

        mainContainer.appendChild(ledArea);

        // Recording time display
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'rec-time';
        timeDisplay.textContent = '0:00';
        mainContainer.appendChild(timeDisplay);

        // Record button
        const buttonArea = document.createElement('div');
        buttonArea.className = 'rec-button-area';

        const button = document.createElement('div');
        button.className = 'rec-button';

        const buttonInner = document.createElement('div');
        buttonInner.className = 'rec-button-inner';
        button.appendChild(buttonInner);

        let isRecording = false;

        // Prevent drag handler from intercepting button clicks
        button.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            isRecording = !isRecording;
            const mod = getModule ? getModule() : null;
            if (mod && mod.instance) {
                mod.instance.params.record = isRecording ? 1 : 0;
            }
            onParamChange('record', isRecording ? 1 : 0);
            updateUI();
        });

        buttonArea.appendChild(button);
        mainContainer.appendChild(buttonArea);

        // Input/Output jacks
        const jacks = document.createElement('div');
        jacks.className = 'rec-jacks';

        const inLabel = document.createElement('div');
        inLabel.className = 'rec-jack-label';
        inLabel.textContent = 'IN';
        jacks.appendChild(inLabel);

        const inRow = document.createElement('div');
        inRow.className = 'rec-jack-row';
        inRow.appendChild(toolkit.createJack({
            id: 'L',
            label: 'L',
            direction: 'input',
            type: 'audio'
        }));
        inRow.appendChild(toolkit.createJack({
            id: 'R',
            label: 'R',
            direction: 'input',
            type: 'audio'
        }));
        jacks.appendChild(inRow);

        const outLabel = document.createElement('div');
        outLabel.className = 'rec-jack-label';
        outLabel.textContent = 'OUT';
        jacks.appendChild(outLabel);

        const outRow = document.createElement('div');
        outRow.className = 'rec-jack-row';
        outRow.appendChild(toolkit.createJack({
            id: 'outL',
            label: 'L',
            direction: 'output',
            type: 'audio'
        }));
        outRow.appendChild(toolkit.createJack({
            id: 'outR',
            label: 'R',
            direction: 'output',
            type: 'audio'
        }));
        jacks.appendChild(outRow);

        mainContainer.appendChild(jacks);
        container.appendChild(mainContainer);

        // Format time as M:SS
        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        // Update UI state
        function updateUI() {
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;

            if (dsp) {
                const recording = dsp.leds.recording === 1;
                led.classList.toggle('recording', recording);
                button.classList.toggle('recording', recording);
                timeDisplay.classList.toggle('recording', recording);

                if (recording && dsp.getRecordingTime) {
                    const currentTime = dsp.getRecordingTime();
                    const maxTime = dsp.getMaxRecordingTime ? dsp.getMaxRecordingTime() : 300;
                    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(maxTime)}`;
                } else if (!recording) {
                    timeDisplay.textContent = '0:00';
                }

                // Sync local state with DSP state
                isRecording = recording;
            }
        }

        // Animation loop for UI updates
        let animationId = null;

        function animate() {
            updateUI();
            animationId = requestAnimationFrame(animate);
        }

        animate();

        // Cleanup
        instance.cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    },

    ui: {
        leds: ['recording'],
        knobs: [],
        switches: [],
        inputs: [
            { id: 'L', label: 'L', port: 'L', type: 'audio' },
            { id: 'R', label: 'R', port: 'R', type: 'audio' }
        ],
        outputs: [
            { id: 'outL', label: 'L', port: 'outL', type: 'audio' },
            { id: 'outR', label: 'R', port: 'outR', type: 'audio' }
        ]
    }
};
