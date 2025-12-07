/**
 * SCOPE - Dual Channel Oscilloscope Module
 *
 * Based on Intellijel Zeroscope 1U
 * https://intellijel.com/shop/eurorack/1u/zeroscope-1u/
 *
 * Features:
 * - Dual channel waveform display (CH1 green, CH2 blue)
 * - Three display modes: Scope, X-Y (Lissajous), Tune
 * - Adjustable time base and gain per channel
 * - Trigger with adjustable threshold
 * - Passthrough outputs (signal normalled to output)
 * - DC coupled inputs accepting ±10V
 */

export default {
    id: 'scope',
    name: 'SCOPE',
    hp: 16,
    color: '#1a3a1a',
    category: 'utility',

    // Custom CSS for scope display
    css: `
        .scope-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            height: 100%;
            padding: 4px;
        }
        .scope-display-area {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .scope-canvas {
            background: #0a0f0a;
            border: 1px solid #1a3a1a;
            border-radius: 3px;
            width: 100%;
            margin-bottom: 24px;
        }
        .scope-controls {
            display: flex;
            flex-direction: row;
            gap: 4px;
            flex: 1;
        }
        .scope-io-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
        }
        .scope-ctrl-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
        }
        .scope-section-label {
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 2px;
        }
        .scope-jack-row {
            display: flex;
            gap: 4px;
            justify-content: center;
        }
        .scope-knob-row {
            display: flex;
            gap: 2px;
            justify-content: center;
        }
        .scope-led-row {
            display: flex;
            gap: 8px;
            justify-content: center;
            padding: 2px 0;
            margin-bottom: 12px;
        }
        .scope-knob-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2px;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Display buffer holds multiple frames for visualization
        const displaySize = bufferSize * 4;
        const displayBuffer1 = new Float32Array(displaySize);
        const displayBuffer2 = new Float32Array(displaySize);
        let writeIndex = 0;

        // Trigger state
        let triggered = false;
        let triggerIndex = 0;
        let lastSample = 0;

        // Frequency detection for tune mode
        let lastZeroCrossing = 0;
        let zeroCrossingCount = 0;
        let detectedFreq = 0;
        let freqAccumulator = 0;
        let freqSampleCount = 0;

        const ownIn1 = new Float32Array(bufferSize);
        const ownIn2 = new Float32Array(bufferSize);
        const out1 = new Float32Array(bufferSize);
        const out2 = new Float32Array(bufferSize);

        return {
            params: {
                time: 0.5,      // Time/div (0-1 maps display speed)
                gain1: 0.5,     // CH1 vertical scale
                gain2: 0.5,     // CH2 vertical scale
                offset1: 0.5,   // CH1 vertical offset (0.5 = centered)
                offset2: 0.5,   // CH2 vertical offset (0.5 = centered)
                trigger: 0.5,   // Trigger level (-10V to +10V mapped from 0-1)
                mode: 0         // 0=Scope, 1=X-Y, 2=Tune
            },
            inputs: { in1: ownIn1, in2: ownIn2 },
            outputs: { out1, out2 },
            leds: { ch1: 0, ch2: 0 },

            // Expose display buffers for rendering
            displayBuffer1,
            displayBuffer2,
            displaySize,
            getWriteIndex() { return writeIndex; },
            getTriggerIndex() { return triggerIndex; },
            isTriggered() { return triggered; },
            getDetectedFreq() { return detectedFreq; },

            process() {
                const input1 = this.inputs.in1;
                const input2 = this.inputs.in2;
                const trigLevel = (this.params.trigger - 0.5) * 20; // -10V to +10V

                // Passthrough: copy inputs to outputs (normalled)
                out1.set(input1);
                out2.set(input2);

                // Copy inputs to circular display buffers
                for (let i = 0; i < input1.length; i++) {
                    const sample1 = input1[i];
                    const sample2 = input2[i];

                    displayBuffer1[writeIndex] = sample1;
                    displayBuffer2[writeIndex] = sample2;

                    // Rising edge trigger detection on CH1
                    if (!triggered && lastSample < trigLevel && sample1 >= trigLevel) {
                        triggered = true;
                        triggerIndex = writeIndex;
                    }

                    // Zero-crossing detection for frequency measurement
                    if (lastSample < 0 && sample1 >= 0) {
                        const period = zeroCrossingCount - lastZeroCrossing;
                        if (period > 10 && period < sampleRate) { // Valid range
                            const freq = sampleRate / period;
                            freqAccumulator += freq;
                            freqSampleCount++;
                            if (freqSampleCount >= 4) {
                                detectedFreq = freqAccumulator / freqSampleCount;
                                freqAccumulator = 0;
                                freqSampleCount = 0;
                            }
                        }
                        lastZeroCrossing = zeroCrossingCount;
                    }
                    zeroCrossingCount++;

                    lastSample = sample1;
                    writeIndex = (writeIndex + 1) % displaySize;
                }

                // Reset trigger after one full display cycle
                if (triggered && writeIndex === triggerIndex) {
                    triggered = false;
                }

                // LED shows signal presence per channel
                let max1 = 0, max2 = 0;
                for (let i = 0; i < input1.length; i++) {
                    const abs1 = Math.abs(input1[i]);
                    const abs2 = Math.abs(input2[i]);
                    if (abs1 > max1) max1 = abs1;
                    if (abs2 > max2) max2 = abs2;
                }
                this.leds.ch1 = max1 / 10; // ±10V range
                this.leds.ch2 = max2 / 10;

                // Reset inputs if replaced by routing
                if (this.inputs.in1 !== ownIn1) {
                    ownIn1.fill(0);
                    this.inputs.in1 = ownIn1;
                }
                if (this.inputs.in2 !== ownIn2) {
                    ownIn2.fill(0);
                    this.inputs.in2 = ownIn2;
                }
            },

            reset() {
                displayBuffer1.fill(0);
                displayBuffer2.fill(0);
                writeIndex = 0;
                triggered = false;
                triggerIndex = 0;
                lastSample = 0;
                detectedFreq = 0;
                this.leds.ch1 = 0;
                this.leds.ch2 = 0;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        // Get module reference for dynamic DSP access
        const getModule = instance.getModule;

        // Track current mode for UI updates
        let currentMode = 0;

        // Main vertical container
        const mainContainer = document.createElement('div');
        mainContainer.className = 'scope-container';

        // === TOP: Display ===
        const displayArea = document.createElement('div');
        displayArea.className = 'scope-display-area';

        // LED indicators above canvas
        const ledRow = document.createElement('div');
        ledRow.className = 'scope-led-row';
        const led1 = toolkit.createLED({ id: 'ch1', color: 'green' });
        const led2 = toolkit.createLED({ id: 'ch2', color: 'cyan' });
        ledRow.appendChild(led1);
        ledRow.appendChild(led2);
        displayArea.appendChild(ledRow);

        // Create canvas for waveform display (wide landscape for 16hp)
        const canvas = toolkit.createCanvas({
            width: 240,
            height: 100,
            className: 'scope-canvas'
        });
        const ctx = canvas.getContext('2d');
        displayArea.appendChild(canvas);

        mainContainer.appendChild(displayArea);

        // Track mode label for updates (not displayed, just for internal state)
        let currentModeLabel = 'SCOPE';

        // === BOTTOM: Two-column controls ===
        const controls = document.createElement('div');
        controls.className = 'scope-controls';

        // Left column: I/O
        const ioColumn = document.createElement('div');
        ioColumn.className = 'scope-io-column';

        // Input section
        const inLabel = document.createElement('div');
        inLabel.className = 'scope-section-label';
        inLabel.textContent = 'IN';
        ioColumn.appendChild(inLabel);

        const inputRow = document.createElement('div');
        inputRow.className = 'scope-jack-row';
        inputRow.appendChild(toolkit.createJack({
            id: 'in1',
            label: '1',
            direction: 'input',
            type: 'buffer'
        }));
        inputRow.appendChild(toolkit.createJack({
            id: 'in2',
            label: '2',
            direction: 'input',
            type: 'buffer'
        }));
        ioColumn.appendChild(inputRow);

        // Output section
        const outLabel = document.createElement('div');
        outLabel.className = 'scope-section-label';
        outLabel.textContent = 'OUT';
        ioColumn.appendChild(outLabel);

        const outRow = document.createElement('div');
        outRow.className = 'scope-jack-row';
        outRow.appendChild(toolkit.createJack({
            id: 'out1',
            label: '1',
            direction: 'output',
            type: 'buffer'
        }));
        outRow.appendChild(toolkit.createJack({
            id: 'out2',
            label: '2',
            direction: 'output',
            type: 'buffer'
        }));
        ioColumn.appendChild(outRow);

        controls.appendChild(ioColumn);

        // Right column: Controls (6 knobs in 2 rows of 3)
        const ctrlColumn = document.createElement('div');
        ctrlColumn.className = 'scope-ctrl-column';

        // Knobs grid
        const knobGrid = document.createElement('div');
        knobGrid.className = 'scope-knob-grid';

        // Row 1: Time, Trigger, Mode switch
        knobGrid.appendChild(toolkit.createKnob({
            id: 'time',
            label: 'Time',
            param: 'time',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('time', value)
        }));
        knobGrid.appendChild(toolkit.createKnob({
            id: 'trigger',
            label: 'Trig',
            param: 'trigger',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('trigger', value)
        }));

        // Mode switch in knob grid
        const modeSwitch = toolkit.createSwitch({
            id: 'mode',
            label: 'Mode',
            param: 'mode',
            value: 0,
            onChange: () => {
                currentMode = (currentMode + 1) % 3;
                const mod = getModule ? getModule() : null;
                if (mod && mod.instance) {
                    mod.instance.params.mode = currentMode;
                }
                onParamChange('mode', currentMode);
                const labels = ['SCOPE', 'X-Y', 'TUNE'];
                currentModeLabel = labels[currentMode];
            }
        });
        knobGrid.appendChild(modeSwitch);

        // Row 2: CH1 Gain, CH2 Gain, (empty or future control)
        knobGrid.appendChild(toolkit.createKnob({
            id: 'gain1',
            label: 'Gn 1',
            param: 'gain1',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('gain1', value)
        }));
        knobGrid.appendChild(toolkit.createKnob({
            id: 'gain2',
            label: 'Gn 2',
            param: 'gain2',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('gain2', value)
        }));

        // Row 2 third slot: empty spacer
        const spacer = document.createElement('div');
        knobGrid.appendChild(spacer);

        // Row 3: CH1 Offset, CH2 Offset
        knobGrid.appendChild(toolkit.createKnob({
            id: 'offset1',
            label: 'Off 1',
            param: 'offset1',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('offset1', value)
        }));
        knobGrid.appendChild(toolkit.createKnob({
            id: 'offset2',
            label: 'Off 2',
            param: 'offset2',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('offset2', value)
        }));

        ctrlColumn.appendChild(knobGrid);
        controls.appendChild(ctrlColumn);
        mainContainer.appendChild(controls);
        container.appendChild(mainContainer);

        // Note names for tuner
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        function freqToNote(freq) {
            if (freq < 20 || freq > 20000) return { note: '--', cents: 0 };
            const noteNum = 12 * Math.log2(freq / 440) + 69;
            const roundedNote = Math.round(noteNum);
            const cents = Math.round((noteNum - roundedNote) * 100);
            const octave = Math.floor(roundedNote / 12) - 1;
            const noteName = NOTE_NAMES[roundedNote % 12];
            return { note: `${noteName}${octave}`, cents };
        }

        // Animation loop for rendering
        let animationId = null;

        function drawScope() {
            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            // Clear with dark background
            ctx.fillStyle = '#0a0f0a';
            ctx.fillRect(0, 0, width, height);

            // Draw grid lines
            ctx.strokeStyle = '#1a2a1a';
            ctx.lineWidth = 0.5;

            // Horizontal center line
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(width, centerY);
            ctx.stroke();

            // Vertical center line
            ctx.beginPath();
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width / 2, height);
            ctx.stroke();

            // Get current DSP instance
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;

            // If no DSP yet, just show empty grid
            if (!dsp) {
                ctx.fillStyle = '#333';
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('START AUDIO', width / 2, height / 2);
                animationId = requestAnimationFrame(drawScope);
                return;
            }

            const mode = dsp.params.mode;

            if (mode === 2) {
                // TUNE MODE - show frequency and note (larger fonts for 16hp display)
                const freq = dsp.getDetectedFreq();
                const { note, cents } = freqToNote(freq);

                ctx.fillStyle = '#4f4';
                ctx.font = 'bold 32px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(note, width / 2, height / 2 - 10);

                ctx.font = '16px monospace';
                ctx.fillStyle = '#8f8';
                if (freq > 20) {
                    ctx.fillText(`${freq.toFixed(1)} Hz`, width / 2, height / 2 + 20);
                    // Cents indicator
                    const centsColor = Math.abs(cents) < 5 ? '#4f4' : (Math.abs(cents) < 15 ? '#ff4' : '#f44');
                    ctx.fillStyle = centsColor;
                    ctx.font = '14px monospace';
                    const centsStr = cents >= 0 ? `+${cents}` : `${cents}`;
                    ctx.fillText(`${centsStr}¢`, width / 2, height / 2 + 45);
                }
            } else if (mode === 1) {
                // X-Y MODE (Lissajous) - CH1 drives X, CH2 drives Y
                // Auto-centers signals so Lissajous fills display
                const buffer1 = dsp.displayBuffer1;
                const buffer2 = dsp.displayBuffer2;
                const bufferSize = dsp.displaySize;
                const writeIdx = dsp.getWriteIndex();

                const samplesPerScreen = Math.floor(256 + (1 - dsp.params.time) * 768);

                // Calculate min/max for auto-centering
                let min1 = Infinity, max1 = -Infinity;
                let min2 = Infinity, max2 = -Infinity;
                for (let i = 0; i < samplesPerScreen; i++) {
                    const bufIdx = (writeIdx - samplesPerScreen + i + bufferSize) % bufferSize;
                    const s1 = buffer1[bufIdx];
                    const s2 = buffer2[bufIdx];
                    if (s1 < min1) min1 = s1;
                    if (s1 > max1) max1 = s1;
                    if (s2 < min2) min2 = s2;
                    if (s2 > max2) max2 = s2;
                }
                const center1 = (min1 + max1) / 2;
                const center2 = (min2 + max2) / 2;
                const range1 = Math.max(max1 - min1, 0.1) / 2;
                const range2 = Math.max(max2 - min2, 0.1) / 2;

                // Gain provides additional zoom (0.5=1x, 1=2x, 0=0.5x)
                const zoom1 = 0.5 + dsp.params.gain1;
                const zoom2 = 0.5 + dsp.params.gain2;

                ctx.strokeStyle = '#4f4';
                ctx.lineWidth = 1;
                ctx.beginPath();

                let firstPoint = true;
                for (let i = 0; i < samplesPerScreen; i++) {
                    const bufIdx = (writeIdx - samplesPerScreen + i + bufferSize) % bufferSize;
                    const sample1 = buffer1[bufIdx];
                    const sample2 = buffer2[bufIdx];

                    // Center and scale to fill display
                    const norm1 = (sample1 - center1) / range1;
                    const norm2 = (sample2 - center2) / range2;
                    const x = width / 2 + norm1 * (width / 2 - 2) * zoom1 * 0.95;
                    const y = height / 2 - norm2 * (height / 2 - 2) * zoom2 * 0.95;

                    // Clamp to display bounds
                    const clampedX = Math.max(0, Math.min(width, x));
                    const clampedY = Math.max(0, Math.min(height, y));

                    if (firstPoint) {
                        ctx.moveTo(clampedX, clampedY);
                        firstPoint = false;
                    } else {
                        ctx.lineTo(clampedX, clampedY);
                    }
                }
                ctx.stroke();
            } else {
                // SCOPE MODE - standard time-domain display
                // Display centered at 0V, gain controls vertical zoom, offset shifts position
                const buffer1 = dsp.displayBuffer1;
                const buffer2 = dsp.displayBuffer2;
                const bufferSize = dsp.displaySize;
                const writeIdx = dsp.getWriteIndex();

                // Gain maps to display range:
                // gain=0: ±10V fills display, gain=0.5: ±5V, gain=1: ±2V
                const range1 = 2 + (1 - dsp.params.gain1) * 8;
                const range2 = 2 + (1 - dsp.params.gain2) * 8;

                // Offset maps to vertical shift: 0=-10V, 0.5=0V, 1=+10V
                const offset1 = (dsp.params.offset1 - 0.5) * 20;
                const offset2 = (dsp.params.offset2 - 0.5) * 20;

                const samplesPerScreen = Math.floor(128 + (1 - dsp.params.time) * 896);

                // Always read from behind the write index to avoid discontinuities
                const startIdx = (writeIdx - samplesPerScreen + bufferSize) % bufferSize;

                // Draw trigger level indicator
                const trigLevel = (dsp.params.trigger - 0.5) * 20; // ±10V
                const trigY = centerY - (trigLevel / range1) * (height / 2);
                if (trigY >= 0 && trigY <= height) {
                    ctx.strokeStyle = '#664400';
                    ctx.lineWidth = 0.5;
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath();
                    ctx.moveTo(0, trigY);
                    ctx.lineTo(width, trigY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Draw CH1 (green) with offset
                ctx.strokeStyle = '#4f4';
                ctx.lineWidth = 1.5;
                ctx.beginPath();

                let firstPoint = true;
                let lastY1 = 0;
                for (let i = 0; i < samplesPerScreen; i++) {
                    const bufIdx = (startIdx + i) % bufferSize;
                    const sample = buffer1[bufIdx];

                    const x = (i / samplesPerScreen) * width;
                    const y = centerY - ((sample + offset1) / range1) * (height / 2);
                    const clampedY = Math.max(0, Math.min(height, y));

                    // Detect discontinuity (large jump indicates buffer wrap)
                    const isDiscontinuity = !firstPoint && Math.abs(clampedY - lastY1) > height * 0.5;

                    if (firstPoint || isDiscontinuity) {
                        ctx.moveTo(x, clampedY);
                        firstPoint = false;
                    } else {
                        ctx.lineTo(x, clampedY);
                    }
                    lastY1 = clampedY;
                }
                ctx.stroke();

                // Draw CH2 (cyan/blue) with offset
                ctx.strokeStyle = '#4ff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();

                firstPoint = true;
                let lastY2 = 0;
                for (let i = 0; i < samplesPerScreen; i++) {
                    const bufIdx = (startIdx + i) % bufferSize;
                    const sample = buffer2[bufIdx];

                    const x = (i / samplesPerScreen) * width;
                    const y = centerY - ((sample + offset2) / range2) * (height / 2);
                    const clampedY = Math.max(0, Math.min(height, y));

                    // Detect discontinuity (large jump indicates buffer wrap)
                    const isDiscontinuity = !firstPoint && Math.abs(clampedY - lastY2) > height * 0.5;

                    if (firstPoint || isDiscontinuity) {
                        ctx.moveTo(x, clampedY);
                        firstPoint = false;
                    } else {
                        ctx.lineTo(x, clampedY);
                    }
                    lastY2 = clampedY;
                }
                ctx.stroke();
            }

            animationId = requestAnimationFrame(drawScope);
        }

        // Start animation
        drawScope();

        // Store cleanup function on instance
        instance.cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    },

    // UI definition for registry validation
    ui: {
        leds: ['ch1', 'ch2'],
        inputs: [
            { id: 'in1', label: '1', port: 'in1', type: 'buffer' },
            { id: 'in2', label: '2', port: 'in2', type: 'buffer' }
        ],
        outputs: [
            { id: 'out1', label: '1', port: 'out1', type: 'buffer' },
            { id: 'out2', label: '2', port: 'out2', type: 'buffer' }
        ]
    }
};
