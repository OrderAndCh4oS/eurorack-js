/**
 * PLOT - Waveform Plotter Module
 *
 * Time-domain amplitude visualization over 1-10 seconds.
 * Useful for visualizing envelopes, LFO shapes, and debugging.
 *
 * Features:
 * - Configurable time window (1-10 seconds)
 * - Continuous scroll or triggered capture
 * - Freeze to pause and examine
 * - Stats overlay: peak, RMS, DC offset
 * - Export: copy PNG to clipboard, download PNG
 * - Passthrough audio output
 */

export default {
    id: 'plot',
    name: 'PLOT',
    hp: 12,
    color: '#1a2a4a',
    category: 'utility',

    css: `
        .plot-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            height: 100%;
            padding: 4px;
        }
        .plot-display-area {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .plot-canvas {
            background: #0a0a14;
            border: 1px solid #1a2a4a;
            border-radius: 3px;
            width: 100%;
            cursor: crosshair;
        }
        .plot-stats {
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            color: #666;
            padding: 2px 4px;
            width: 100%;
            font-family: monospace;
        }
        .plot-controls {
            display: flex;
            flex-direction: row;
            gap: 4px;
            flex: 1;
        }
        .plot-io-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
        }
        .plot-knob-column {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
        }
        .plot-section-label {
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 2px;
        }
        .plot-led-row {
            display: flex;
            gap: 8px;
            justify-content: center;
            padding: 2px 0;
            margin-bottom: 4px;
        }
        .plot-knob-row {
            display: flex;
            gap: 4px;
            justify-content: center;
        }
        .plot-button-row {
            display: flex;
            gap: 4px;
            justify-content: center;
            margin-top: 4px;
        }
        .plot-button {
            padding: 3px 6px;
            font-size: 8px;
            background: #333;
            border: 1px solid #555;
            border-radius: 3px;
            color: #aaa;
            cursor: pointer;
            text-transform: uppercase;
        }
        .plot-button:hover {
            background: #444;
            border-color: #666;
        }
        .plot-button:active {
            background: #555;
        }
        .plot-button.success {
            background: #2a4a2a;
            border-color: #4a8a4a;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // Display resolution - number of points to show
        const DISPLAY_POINTS = 400;

        // Maximum capture buffer (10 seconds at sample rate, downsampled)
        const MAX_TIME = 10;
        const CAPTURE_RATE = 1000; // Samples per second for capture (downsampled)
        const MAX_CAPTURE = MAX_TIME * CAPTURE_RATE;

        const captureBuffer = new Float32Array(MAX_CAPTURE);
        const displayBuffer = new Float32Array(DISPLAY_POINTS);

        let captureIndex = 0;
        let sampleAccumulator = 0;
        let sampleCount = 0;
        let downsampleRatio = Math.floor(sampleRate / CAPTURE_RATE);

        // Statistics
        let peakPos = 0;
        let peakNeg = 0;
        let sumSquares = 0;
        let sum = 0;
        let statSamples = 0;

        // Trigger state
        let lastTrig = 0;
        let capturing = true;
        let captureComplete = false;
        let triggerArmed = false;

        const ownAudio = new Float32Array(bufferSize);
        const ownTrig = new Float32Array(bufferSize);
        const out = new Float32Array(bufferSize);

        function updateDisplayBuffer(timeWindow) {
            // Map capture buffer to display buffer based on time window
            const capturePoints = Math.floor(timeWindow * CAPTURE_RATE);
            const startIdx = Math.max(0, captureIndex - capturePoints);

            for (let i = 0; i < DISPLAY_POINTS; i++) {
                const capturePos = startIdx + Math.floor((i / DISPLAY_POINTS) * capturePoints);
                const wrappedPos = ((capturePos % MAX_CAPTURE) + MAX_CAPTURE) % MAX_CAPTURE;
                displayBuffer[i] = captureBuffer[wrappedPos];
            }
        }

        return {
            params: {
                time: 0.5,    // Time window (0=1s, 1=10s)
                freeze: 0     // 0=running, 1=frozen
            },
            inputs: { audio: ownAudio, trig: ownTrig },
            outputs: { out },
            leds: { signal: 0 },

            displayBuffer,
            captureBuffer,

            getTimeWindow() {
                // Map 0-1 to 1-10 seconds
                return 1 + this.params.time * 9;
            },

            getStats() {
                const rms = statSamples > 0 ? Math.sqrt(sumSquares / statSamples) : 0;
                const dc = statSamples > 0 ? sum / statSamples : 0;
                return { peakPos, peakNeg, rms, dc };
            },

            isCapturing() {
                return capturing;
            },

            // Arm trigger for one-shot capture
            armTrigger() {
                triggerArmed = true;
                capturing = false;
                captureComplete = false;
            },

            process() {
                const input = this.inputs.audio;
                const trig = this.inputs.trig;
                const frozen = this.params.freeze === 1;

                // Passthrough
                out.set(input);

                // Check for trigger
                for (let i = 0; i < trig.length; i++) {
                    const trigVal = trig[i];
                    if (trigVal >= 1 && lastTrig < 1) {
                        // Rising edge - start capture
                        if (triggerArmed || !capturing) {
                            capturing = true;
                            captureComplete = false;
                            triggerArmed = false;
                            // Reset capture position for triggered mode
                            captureIndex = 0;
                            // Reset stats
                            peakPos = 0;
                            peakNeg = 0;
                            sumSquares = 0;
                            sum = 0;
                            statSamples = 0;
                        }
                    }
                    lastTrig = trigVal;
                }

                if (!frozen && capturing) {
                    // Capture audio with downsampling
                    for (let i = 0; i < input.length; i++) {
                        const sample = input[i];

                        // Update statistics
                        if (sample > peakPos) peakPos = sample;
                        if (sample < peakNeg) peakNeg = sample;
                        sumSquares += sample * sample;
                        sum += sample;
                        statSamples++;

                        // Accumulate for downsampling
                        sampleAccumulator += sample;
                        sampleCount++;

                        if (sampleCount >= downsampleRatio) {
                            const avgSample = sampleAccumulator / sampleCount;
                            captureBuffer[captureIndex % MAX_CAPTURE] = avgSample;
                            captureIndex++;
                            sampleAccumulator = 0;
                            sampleCount = 0;

                            // Check if triggered capture is complete
                            const timeWindow = this.getTimeWindow();
                            const capturePoints = Math.floor(timeWindow * CAPTURE_RATE);
                            if (triggerArmed === false && captureIndex >= capturePoints) {
                                // For continuous mode, just keep wrapping
                                // For triggered mode (if we add it), we'd stop here
                            }
                        }
                    }

                    // Update display buffer
                    updateDisplayBuffer(this.getTimeWindow());
                }

                // LED shows signal presence
                let maxAbs = 0;
                for (let i = 0; i < input.length; i++) {
                    const abs = Math.abs(input[i]);
                    if (abs > maxAbs) maxAbs = abs;
                }
                this.leds.signal = maxAbs / 10;

                // Reset inputs if replaced by routing
                if (this.inputs.audio !== ownAudio) {
                    ownAudio.fill(0);
                    this.inputs.audio = ownAudio;
                }
                if (this.inputs.trig !== ownTrig) {
                    ownTrig.fill(0);
                    this.inputs.trig = ownTrig;
                }
            },

            reset() {
                captureBuffer.fill(0);
                displayBuffer.fill(0);
                captureIndex = 0;
                sampleAccumulator = 0;
                sampleCount = 0;
                peakPos = 0;
                peakNeg = 0;
                sumSquares = 0;
                sum = 0;
                statSamples = 0;
                lastTrig = 0;
                capturing = true;
                captureComplete = false;
                triggerArmed = false;
                this.leds.signal = 0;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        const getModule = instance.getModule;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'plot-container';

        // === TOP: Display ===
        const displayArea = document.createElement('div');
        displayArea.className = 'plot-display-area';

        // LED indicator
        const ledRow = document.createElement('div');
        ledRow.className = 'plot-led-row';
        const signalLed = toolkit.createLED({ id: 'signal', color: 'green' });
        ledRow.appendChild(signalLed);
        displayArea.appendChild(ledRow);

        // Canvas for waveform display
        const canvas = toolkit.createCanvas({
            width: 180,
            height: 80,
            className: 'plot-canvas'
        });
        const ctx = canvas.getContext('2d');
        displayArea.appendChild(canvas);

        // Stats display
        const statsDiv = document.createElement('div');
        statsDiv.className = 'plot-stats';
        statsDiv.innerHTML = '<span>Pk: --</span><span>RMS: --</span><span>DC: --</span>';
        displayArea.appendChild(statsDiv);

        mainContainer.appendChild(displayArea);

        // === CONTROLS ===
        const controls = document.createElement('div');
        controls.className = 'plot-controls';

        // I/O column
        const ioColumn = document.createElement('div');
        ioColumn.className = 'plot-io-column';

        const inLabel = document.createElement('div');
        inLabel.className = 'plot-section-label';
        inLabel.textContent = 'IN';
        ioColumn.appendChild(inLabel);

        ioColumn.appendChild(toolkit.createJack({
            id: 'audio',
            label: 'Audio',
            direction: 'input',
            type: 'audio'
        }));

        ioColumn.appendChild(toolkit.createJack({
            id: 'trig',
            label: 'Trig',
            direction: 'input',
            type: 'trigger'
        }));

        const outLabel = document.createElement('div');
        outLabel.className = 'plot-section-label';
        outLabel.textContent = 'OUT';
        ioColumn.appendChild(outLabel);

        ioColumn.appendChild(toolkit.createJack({
            id: 'out',
            label: 'Thru',
            direction: 'output',
            type: 'audio'
        }));

        controls.appendChild(ioColumn);

        // Knob column
        const knobColumn = document.createElement('div');
        knobColumn.className = 'plot-knob-column';

        const knobRow = document.createElement('div');
        knobRow.className = 'plot-knob-row';

        knobRow.appendChild(toolkit.createKnob({
            id: 'time',
            label: 'Time',
            param: 'time',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('time', value)
        }));

        knobRow.appendChild(toolkit.createSwitch({
            id: 'freeze',
            label: 'Freeze',
            param: 'freeze',
            value: 0,
            onChange: (value) => {
                const mod = getModule ? getModule() : null;
                if (mod && mod.instance) {
                    mod.instance.params.freeze = value;
                }
                onParamChange('freeze', value);
            }
        }));

        knobColumn.appendChild(knobRow);

        // Export buttons
        const buttonRow = document.createElement('div');
        buttonRow.className = 'plot-button-row';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'plot-button';
        copyBtn.textContent = 'Copy';
        copyBtn.title = 'Copy CSV data to clipboard';
        copyBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyDataToClipboard();
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'plot-button';
        saveBtn.textContent = 'Save';
        saveBtn.title = 'Download CSV data';
        saveBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadCSV();
        });

        const plotBtn = document.createElement('button');
        plotBtn.className = 'plot-button';
        plotBtn.textContent = 'Plot';
        plotBtn.title = 'Download PNG image';
        plotBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        plotBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadPNG();
        });

        buttonRow.appendChild(copyBtn);
        buttonRow.appendChild(saveBtn);
        buttonRow.appendChild(plotBtn);
        knobColumn.appendChild(buttonRow);

        controls.appendChild(knobColumn);
        mainContainer.appendChild(controls);
        container.appendChild(mainContainer);

        // Export functions
        function createExportCanvas() {
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;
            if (!dsp) return null;

            // Create larger canvas for export
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = 800;
            exportCanvas.height = 400;
            const ectx = exportCanvas.getContext('2d');

            const width = exportCanvas.width;
            const height = exportCanvas.height;
            const plotHeight = height - 60; // Reserve space for stats

            // Background
            ectx.fillStyle = '#0a0a14';
            ectx.fillRect(0, 0, width, height);

            // Grid
            ectx.strokeStyle = '#1a2a3a';
            ectx.lineWidth = 1;

            // Horizontal grid (voltage levels)
            for (let v = -10; v <= 10; v += 2) {
                const y = 30 + (plotHeight / 2) - (v / 10) * (plotHeight / 2);
                ectx.beginPath();
                ectx.moveTo(50, y);
                ectx.lineTo(width - 20, y);
                ectx.stroke();

                // Labels
                ectx.fillStyle = '#666';
                ectx.font = '12px monospace';
                ectx.textAlign = 'right';
                ectx.fillText(`${v}V`, 45, y + 4);
            }

            // Vertical grid (time)
            const timeWindow = dsp.getTimeWindow();
            const timeStep = timeWindow > 5 ? 1 : 0.5;
            for (let t = 0; t <= timeWindow; t += timeStep) {
                const x = 50 + (t / timeWindow) * (width - 70);
                ectx.beginPath();
                ectx.moveTo(x, 30);
                ectx.lineTo(x, 30 + plotHeight);
                ectx.stroke();

                // Labels
                ectx.fillStyle = '#666';
                ectx.font = '12px monospace';
                ectx.textAlign = 'center';
                ectx.fillText(`${t.toFixed(1)}s`, x, 30 + plotHeight + 15);
            }

            // Zero line
            ectx.strokeStyle = '#2a3a4a';
            ectx.lineWidth = 1;
            ectx.beginPath();
            ectx.moveTo(50, 30 + plotHeight / 2);
            ectx.lineTo(width - 20, 30 + plotHeight / 2);
            ectx.stroke();

            // Waveform
            const displayBuffer = dsp.displayBuffer;
            ectx.strokeStyle = '#4a9fff';
            ectx.lineWidth = 2;
            ectx.beginPath();

            for (let i = 0; i < displayBuffer.length; i++) {
                const x = 50 + (i / displayBuffer.length) * (width - 70);
                const sample = displayBuffer[i];
                const y = 30 + (plotHeight / 2) - (sample / 10) * (plotHeight / 2);
                const clampedY = Math.max(30, Math.min(30 + plotHeight, y));

                if (i === 0) {
                    ectx.moveTo(x, clampedY);
                } else {
                    ectx.lineTo(x, clampedY);
                }
            }
            ectx.stroke();

            // Stats box
            const stats = dsp.getStats();
            ectx.fillStyle = '#1a1a2a';
            ectx.fillRect(10, height - 50, width - 20, 40);
            ectx.strokeStyle = '#3a3a5a';
            ectx.strokeRect(10, height - 50, width - 20, 40);

            ectx.fillStyle = '#aaa';
            ectx.font = '14px monospace';
            ectx.textAlign = 'left';

            const peakText = `Peak: +${stats.peakPos.toFixed(2)}V / ${stats.peakNeg.toFixed(2)}V`;
            const rmsText = `RMS: ${stats.rms.toFixed(3)}V`;
            const dcText = `DC Offset: ${stats.dc.toFixed(3)}V`;
            const timeText = `Time: ${timeWindow.toFixed(1)}s`;

            ectx.fillText(peakText, 20, height - 30);
            ectx.fillText(rmsText, 280, height - 30);
            ectx.fillText(dcText, 450, height - 30);
            ectx.fillText(timeText, 650, height - 30);

            // Title
            ectx.fillStyle = '#888';
            ectx.font = '14px monospace';
            ectx.textAlign = 'left';
            ectx.fillText('EURORACK PLOT - ' + new Date().toISOString().slice(0, 19).replace('T', ' '), 50, 20);

            return exportCanvas;
        }

        async function copyDataToClipboard() {
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;
            if (!dsp) return;

            const displayBuffer = dsp.displayBuffer;
            const timeWindow = dsp.getTimeWindow();
            const stats = dsp.getStats();

            // Build CSV with header
            const lines = [];
            lines.push('# EURORACK PLOT DATA');
            lines.push(`# Time Window: ${timeWindow.toFixed(2)}s`);
            lines.push(`# Peak+: ${stats.peakPos.toFixed(4)}V`);
            lines.push(`# Peak-: ${stats.peakNeg.toFixed(4)}V`);
            lines.push(`# RMS: ${stats.rms.toFixed(4)}V`);
            lines.push(`# DC Offset: ${stats.dc.toFixed(4)}V`);
            lines.push(`# Exported: ${new Date().toISOString()}`);
            lines.push('time_s,amplitude_v');

            for (let i = 0; i < displayBuffer.length; i++) {
                const time = (i / displayBuffer.length) * timeWindow;
                const amplitude = displayBuffer[i];
                lines.push(`${time.toFixed(6)},${amplitude.toFixed(6)}`);
            }

            const csv = lines.join('\n');

            try {
                await navigator.clipboard.writeText(csv);
                copyBtn.classList.add('success');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.classList.remove('success');
                    copyBtn.textContent = 'Copy';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy:', err);
                copyBtn.textContent = 'Error';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 1500);
            }
        }

        function downloadCSV() {
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;
            if (!dsp) return;

            const displayBuffer = dsp.displayBuffer;
            const timeWindow = dsp.getTimeWindow();
            const stats = dsp.getStats();

            // Build CSV with header
            const lines = [];
            lines.push('# EURORACK PLOT DATA');
            lines.push(`# Time Window: ${timeWindow.toFixed(2)}s`);
            lines.push(`# Peak+: ${stats.peakPos.toFixed(4)}V`);
            lines.push(`# Peak-: ${stats.peakNeg.toFixed(4)}V`);
            lines.push(`# RMS: ${stats.rms.toFixed(4)}V`);
            lines.push(`# DC Offset: ${stats.dc.toFixed(4)}V`);
            lines.push(`# Exported: ${new Date().toISOString()}`);
            lines.push('time_s,amplitude_v');

            for (let i = 0; i < displayBuffer.length; i++) {
                const time = (i / displayBuffer.length) * timeWindow;
                const amplitude = displayBuffer[i];
                lines.push(`${time.toFixed(6)},${amplitude.toFixed(6)}`);
            }

            const csv = lines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `plot-${timestamp}.csv`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);

            saveBtn.classList.add('success');
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.classList.remove('success');
                saveBtn.textContent = 'Save';
            }, 1500);
        }

        function downloadPNG() {
            const exportCanvas = createExportCanvas();
            if (!exportCanvas) return;

            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `plot-${timestamp}.png`;
            link.href = exportCanvas.toDataURL('image/png');
            link.click();

            plotBtn.classList.add('success');
            plotBtn.textContent = 'Saved!';
            setTimeout(() => {
                plotBtn.classList.remove('success');
                plotBtn.textContent = 'Plot';
            }, 1500);
        }

        // Animation loop
        let animationId = null;

        function drawPlot() {
            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            // Clear
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, width, height);

            // Grid
            ctx.strokeStyle = '#1a2a3a';
            ctx.lineWidth = 0.5;

            // Horizontal center line (0V)
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(width, centerY);
            ctx.stroke();

            // +5V and -5V lines
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(0, centerY - height / 4);
            ctx.lineTo(width, centerY - height / 4);
            ctx.moveTo(0, centerY + height / 4);
            ctx.lineTo(width, centerY + height / 4);
            ctx.stroke();
            ctx.setLineDash([]);

            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;

            if (!dsp) {
                ctx.fillStyle = '#444';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('START AUDIO', width / 2, height / 2);
                animationId = requestAnimationFrame(drawPlot);
                return;
            }

            const displayBuffer = dsp.displayBuffer;

            // Draw waveform
            ctx.strokeStyle = '#4a9fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            for (let i = 0; i < displayBuffer.length; i++) {
                const x = (i / displayBuffer.length) * width;
                const sample = displayBuffer[i];
                // Map +-10V to canvas height
                const y = centerY - (sample / 10) * centerY;
                const clampedY = Math.max(0, Math.min(height, y));

                if (i === 0) {
                    ctx.moveTo(x, clampedY);
                } else {
                    ctx.lineTo(x, clampedY);
                }
            }
            ctx.stroke();

            // Update stats display
            const stats = dsp.getStats();
            const peakMax = Math.max(Math.abs(stats.peakPos), Math.abs(stats.peakNeg));
            statsDiv.innerHTML = `<span>Pk:${peakMax.toFixed(1)}V</span><span>RMS:${stats.rms.toFixed(2)}V</span><span>DC:${stats.dc.toFixed(2)}V</span>`;

            // Show time window
            const timeWindow = dsp.getTimeWindow();
            ctx.fillStyle = '#666';
            ctx.font = '8px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${timeWindow.toFixed(1)}s`, width - 2, 10);

            // Frozen indicator
            if (dsp.params.freeze === 1) {
                ctx.fillStyle = '#ff6644';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('FROZEN', 4, 12);
            }

            animationId = requestAnimationFrame(drawPlot);
        }

        drawPlot();

        instance.cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    },

    ui: {
        leds: ['signal'],
        knobs: [
            { id: 'time', label: 'Time', param: 'time', min: 0, max: 1, default: 0.5 }
        ],
        switches: [
            { id: 'freeze', label: 'Freeze', param: 'freeze', default: 0 }
        ],
        inputs: [
            { id: 'audio', label: 'Audio', port: 'audio', type: 'audio' },
            { id: 'trig', label: 'Trig', port: 'trig', type: 'trigger' }
        ],
        outputs: [
            { id: 'out', label: 'Thru', port: 'out', type: 'audio' }
        ]
    }
};
