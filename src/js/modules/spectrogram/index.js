/**
 * SPECTROGRAM - Frequency Over Time Module
 *
 * 2D visualization showing how frequency content evolves over time.
 * X-axis = time, Y-axis = frequency, color = magnitude.
 *
 * Features:
 * - Scrolling spectrogram display (2-30 seconds)
 * - Adjustable dB floor for dynamic range
 * - Freeze to capture and examine
 * - Export: PNG image, CSV data snapshot
 * - Passthrough audio output
 */

export default {
    id: 'spectrogram',
    name: 'SPECTRO',
    hp: 14,
    color: '#4a1a2a',
    category: 'utility',

    css: `
        .spectrogram-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            height: 100%;
            padding: 4px;
        }
        .spectrogram-display-area {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .spectrogram-canvas {
            background: #0a0a0a;
            border: 1px solid #4a1a2a;
            border-radius: 3px;
            width: 100%;
        }
        .spectrogram-labels {
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            color: #666;
            padding: 0 2px;
            width: 100%;
        }
        .spectrogram-controls {
            display: flex;
            flex-direction: row;
            gap: 4px;
            flex: 1;
        }
        .spectrogram-io-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
        }
        .spectrogram-knob-column {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
        }
        .spectrogram-section-label {
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 2px;
        }
        .spectrogram-led-row {
            display: flex;
            gap: 8px;
            justify-content: center;
            padding: 2px 0;
            margin-bottom: 4px;
        }
        .spectrogram-knob-row {
            display: flex;
            gap: 4px;
            justify-content: center;
        }
        .spectrogram-button-row {
            display: flex;
            gap: 3px;
            justify-content: center;
            margin-top: 4px;
        }
        .spectrogram-button {
            padding: 3px 5px;
            font-size: 7px;
            background: #333;
            border: 1px solid #555;
            border-radius: 3px;
            color: #aaa;
            cursor: pointer;
            text-transform: uppercase;
        }
        .spectrogram-button:hover {
            background: #444;
            border-color: #666;
        }
        .spectrogram-button:active {
            background: #555;
        }
        .spectrogram-button.success {
            background: #2a4a2a;
            border-color: #4a8a4a;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // FFT settings
        const FFT_SIZE = 1024;
        const NUM_BINS = FFT_SIZE / 2;

        // History settings - store snapshots for scrolling display
        const MAX_HISTORY = 300; // Max number of FFT snapshots
        const SNAPSHOT_INTERVAL = 2048; // Samples between snapshots

        // Buffers
        const inputBuffer = new Float32Array(FFT_SIZE);
        const windowBuffer = new Float32Array(FFT_SIZE);
        const realBuffer = new Float32Array(FFT_SIZE);
        const imagBuffer = new Float32Array(FFT_SIZE);

        // History: array of magnitude arrays
        const history = [];
        let historyIndex = 0;
        let sampleCounter = 0;
        let writeIndex = 0;

        // Pre-compute Hann window
        for (let i = 0; i < FFT_SIZE; i++) {
            windowBuffer[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
        }

        // Pre-compute bit-reversal indices
        const bitReversed = new Uint16Array(FFT_SIZE);
        const bits = Math.log2(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            let reversed = 0;
            let n = i;
            for (let j = 0; j < bits; j++) {
                reversed = (reversed << 1) | (n & 1);
                n >>= 1;
            }
            bitReversed[i] = reversed;
        }

        // Pre-compute twiddle factors
        const twiddleReal = new Float32Array(FFT_SIZE / 2);
        const twiddleImag = new Float32Array(FFT_SIZE / 2);
        for (let i = 0; i < FFT_SIZE / 2; i++) {
            const angle = -2 * Math.PI * i / FFT_SIZE;
            twiddleReal[i] = Math.cos(angle);
            twiddleImag[i] = Math.sin(angle);
        }

        function performFFT() {
            // Apply window and bit-reverse
            // Read from circular buffer: oldest sample is at writeIndex
            for (let i = 0; i < FFT_SIZE; i++) {
                const circularIdx = (writeIndex + i) % FFT_SIZE;
                realBuffer[bitReversed[i]] = inputBuffer[circularIdx] * windowBuffer[i];
                imagBuffer[bitReversed[i]] = 0;
            }

            // FFT butterfly
            for (let size = 2; size <= FFT_SIZE; size *= 2) {
                const halfSize = size / 2;
                const step = FFT_SIZE / size;

                for (let i = 0; i < FFT_SIZE; i += size) {
                    for (let j = 0; j < halfSize; j++) {
                        const twiddleIdx = j * step;
                        const evenIdx = i + j;
                        const oddIdx = i + j + halfSize;

                        const tReal = twiddleReal[twiddleIdx];
                        const tImag = twiddleImag[twiddleIdx];

                        const oddReal = realBuffer[oddIdx];
                        const oddImag = imagBuffer[oddIdx];

                        const tOddReal = oddReal * tReal - oddImag * tImag;
                        const tOddImag = oddReal * tImag + oddImag * tReal;

                        realBuffer[oddIdx] = realBuffer[evenIdx] - tOddReal;
                        imagBuffer[oddIdx] = imagBuffer[evenIdx] - tOddImag;
                        realBuffer[evenIdx] = realBuffer[evenIdx] + tOddReal;
                        imagBuffer[evenIdx] = imagBuffer[evenIdx] + tOddImag;
                    }
                }
            }

            // Calculate magnitudes (dB)
            const magnitudes = new Float32Array(NUM_BINS);
            const scale = 2 / FFT_SIZE;
            for (let i = 0; i < NUM_BINS; i++) {
                const re = realBuffer[i] * scale;
                const im = imagBuffer[i] * scale;
                const mag = Math.sqrt(re * re + im * im);
                magnitudes[i] = mag > 0.00001 ? 20 * Math.log10(mag) : -100;
            }
            return magnitudes;
        }

        const ownAudio = new Float32Array(bufferSize);
        const out = new Float32Array(bufferSize);

        return {
            params: {
                time: 0.5,    // Time window (0=2s, 1=30s)
                floor: 0.5,   // dB floor
                freeze: 0     // 0=running, 1=frozen
            },
            inputs: { audio: ownAudio },
            outputs: { out },
            leds: { signal: 0 },

            history,

            getFFTSize() { return FFT_SIZE; },
            getSampleRate() { return sampleRate; },

            getTimeWindow() {
                return 2 + this.params.time * 28; // 2-30 seconds
            },

            getHistoryCount() {
                return history.length;
            },

            getLatestSnapshot() {
                return history.length > 0 ? history[history.length - 1] : null;
            },

            getExportData() {
                return {
                    history: history.map(h => Array.from(h)),
                    timeWindow: this.getTimeWindow(),
                    fftSize: FFT_SIZE,
                    numBins: NUM_BINS,
                    sampleRate: sampleRate,
                    snapshotInterval: SNAPSHOT_INTERVAL,
                    floor: -80 + this.params.floor * 60
                };
            },

            process() {
                const input = this.inputs.audio;
                const frozen = this.params.freeze === 1;

                // Passthrough
                out.set(input);

                if (!frozen) {
                    // Accumulate samples
                    for (let i = 0; i < input.length; i++) {
                        inputBuffer[writeIndex] = input[i];
                        writeIndex = (writeIndex + 1) % FFT_SIZE;
                        sampleCounter++;

                        // Take snapshot at intervals
                        if (sampleCounter >= SNAPSHOT_INTERVAL) {
                            sampleCounter = 0;
                            const snapshot = performFFT();

                            // Add to history, remove old if needed
                            history.push(snapshot);
                            if (history.length > MAX_HISTORY) {
                                history.shift();
                            }
                        }
                    }
                }

                // LED shows signal presence
                let maxAbs = 0;
                for (let i = 0; i < input.length; i++) {
                    const abs = Math.abs(input[i]);
                    if (abs > maxAbs) maxAbs = abs;
                }
                this.leds.signal = maxAbs / 10;

                // Reset input if replaced by routing
                if (this.inputs.audio !== ownAudio) {
                    ownAudio.fill(0);
                    this.inputs.audio = ownAudio;
                }
            },

            reset() {
                inputBuffer.fill(0);
                history.length = 0;
                historyIndex = 0;
                sampleCounter = 0;
                writeIndex = 0;
                this.leds.signal = 0;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        // getModule returns the module object from the modules map
        // mod.instance is the DSP which may be created later when audio starts
        const getModule = instance.getModule;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'spectrogram-container';

        // === DISPLAY ===
        const displayArea = document.createElement('div');
        displayArea.className = 'spectrogram-display-area';

        // LED
        const ledRow = document.createElement('div');
        ledRow.className = 'spectrogram-led-row';
        ledRow.appendChild(toolkit.createLED({ id: 'signal', color: 'green' }));
        displayArea.appendChild(ledRow);

        // Canvas
        const canvas = toolkit.createCanvas({
            width: 200,
            height: 100,
            className: 'spectrogram-canvas'
        });
        const ctx = canvas.getContext('2d');
        displayArea.appendChild(canvas);

        // Frequency labels
        const freqLabels = document.createElement('div');
        freqLabels.className = 'spectrogram-labels';
        freqLabels.innerHTML = '<span>20kHz</span><span>Time &rarr;</span><span>20Hz</span>';
        displayArea.appendChild(freqLabels);

        mainContainer.appendChild(displayArea);

        // === CONTROLS ===
        const controls = document.createElement('div');
        controls.className = 'spectrogram-controls';

        // I/O column
        const ioColumn = document.createElement('div');
        ioColumn.className = 'spectrogram-io-column';

        const inLabel = document.createElement('div');
        inLabel.className = 'spectrogram-section-label';
        inLabel.textContent = 'IN';
        ioColumn.appendChild(inLabel);

        ioColumn.appendChild(toolkit.createJack({
            id: 'audio',
            label: 'Audio',
            direction: 'input',
            type: 'audio'
        }));

        const outLabel = document.createElement('div');
        outLabel.className = 'spectrogram-section-label';
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
        knobColumn.className = 'spectrogram-knob-column';

        const knobRow1 = document.createElement('div');
        knobRow1.className = 'spectrogram-knob-row';

        knobRow1.appendChild(toolkit.createKnob({
            id: 'time',
            label: 'Time',
            param: 'time',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('time', value)
        }));

        knobRow1.appendChild(toolkit.createKnob({
            id: 'floor',
            label: 'Floor',
            param: 'floor',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('floor', value)
        }));

        knobColumn.appendChild(knobRow1);

        const knobRow2 = document.createElement('div');
        knobRow2.className = 'spectrogram-knob-row';

        knobRow2.appendChild(toolkit.createSwitch({
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

        knobColumn.appendChild(knobRow2);

        // Export buttons
        const buttonRow = document.createElement('div');
        buttonRow.className = 'spectrogram-button-row';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'spectrogram-button';
        copyBtn.textContent = 'Copy';
        copyBtn.title = 'Copy CSV data';
        copyBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyDataToClipboard();
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'spectrogram-button';
        saveBtn.textContent = 'Save';
        saveBtn.title = 'Download CSV';
        saveBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadCSV();
        });

        const plotBtn = document.createElement('button');
        plotBtn.className = 'spectrogram-button';
        plotBtn.textContent = 'Plot';
        plotBtn.title = 'Download PNG';
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

        // Color map (black -> purple -> red -> yellow -> white)
        function getColor(value) {
            // value is 0-1
            const v = Math.max(0, Math.min(1, value));

            if (v < 0.25) {
                const t = v / 0.25;
                return `rgb(${Math.floor(t * 80)}, 0, ${Math.floor(t * 120)})`;
            } else if (v < 0.5) {
                const t = (v - 0.25) / 0.25;
                return `rgb(${Math.floor(80 + t * 175)}, 0, ${Math.floor(120 - t * 120)})`;
            } else if (v < 0.75) {
                const t = (v - 0.5) / 0.25;
                return `rgb(255, ${Math.floor(t * 200)}, 0)`;
            } else {
                const t = (v - 0.75) / 0.25;
                return `rgb(255, ${Math.floor(200 + t * 55)}, ${Math.floor(t * 255)})`;
            }
        }

        // Export functions
        function buildCSV() {
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;
            if (!dsp) return null;

            const data = dsp.getExportData();
            const lines = [];

            lines.push('# EURORACK SPECTROGRAM DATA');
            lines.push(`# Time Window: ${data.timeWindow.toFixed(1)}s`);
            lines.push(`# FFT Size: ${data.fftSize}`);
            lines.push(`# Bins: ${data.numBins}`);
            lines.push(`# Sample Rate: ${data.sampleRate}`);
            lines.push(`# Snapshots: ${data.history.length}`);
            lines.push(`# dB Floor: ${data.floor.toFixed(1)}`);
            lines.push(`# Exported: ${new Date().toISOString()}`);

            // Header row: time, freq bins
            const binFreqs = [];
            for (let i = 0; i < data.numBins; i++) {
                binFreqs.push((i * data.sampleRate / data.fftSize).toFixed(1));
            }
            lines.push('time_s,' + binFreqs.join(','));

            // Data rows
            const timePerSnapshot = data.snapshotInterval / data.sampleRate;
            for (let t = 0; t < data.history.length; t++) {
                const time = (t * timePerSnapshot).toFixed(4);
                const mags = data.history[t].map(m => m.toFixed(2)).join(',');
                lines.push(`${time},${mags}`);
            }

            return lines.join('\n');
        }

        async function copyDataToClipboard() {
            const csv = buildCSV();
            if (!csv) return;

            try {
                await navigator.clipboard.writeText(csv);
                copyBtn.classList.add('success');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.classList.remove('success');
                    copyBtn.textContent = 'Copy';
                }, 1500);
            } catch (err) {
                console.error('Copy failed:', err);
                copyBtn.textContent = 'Error';
                setTimeout(() => copyBtn.textContent = 'Copy', 1500);
            }
        }

        function downloadCSV() {
            const csv = buildCSV();
            if (!csv) return;

            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `spectrogram-${timestamp}.csv`;
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
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;
            if (!dsp || dsp.history.length === 0) return;

            const data = dsp.getExportData();

            // Create export canvas
            const exportCanvas = document.createElement('canvas');
            const width = 1000;
            const height = 500;
            const plotLeft = 60;
            const plotRight = width - 20;
            const plotTop = 40;
            const plotBottom = height - 60;
            const plotWidth = plotRight - plotLeft;
            const plotHeight = plotBottom - plotTop;

            exportCanvas.width = width;
            exportCanvas.height = height;
            const ectx = exportCanvas.getContext('2d');

            // Background
            ectx.fillStyle = '#0a0a0a';
            ectx.fillRect(0, 0, width, height);

            // Draw spectrogram
            const history = data.history;
            const numBins = data.numBins;
            const floorDb = data.floor;
            const rangeDb = 0 - floorDb;

            const colWidth = plotWidth / history.length;
            const rowHeight = plotHeight / 64; // Display 64 frequency bands

            for (let t = 0; t < history.length; t++) {
                const snapshot = history[t];
                const x = plotLeft + t * colWidth;

                for (let band = 0; band < 64; band++) {
                    // Map band to frequency bin (log scale)
                    const minLog = Math.log10(20);
                    const maxLog = Math.log10(20000);
                    const freqLog = minLog + (band / 64) * (maxLog - minLog);
                    const freq = Math.pow(10, freqLog);
                    const bin = Math.min(numBins - 1, Math.floor(freq * data.fftSize / data.sampleRate));

                    const mag = snapshot[bin];
                    const norm = Math.max(0, Math.min(1, (mag - floorDb) / rangeDb));

                    const y = plotBottom - (band + 1) * rowHeight;
                    ectx.fillStyle = getColor(norm);
                    ectx.fillRect(x, y, Math.ceil(colWidth) + 1, Math.ceil(rowHeight) + 1);
                }
            }

            // Axes
            ectx.strokeStyle = '#444';
            ectx.lineWidth = 1;
            ectx.strokeRect(plotLeft, plotTop, plotWidth, plotHeight);

            // Frequency labels (Y axis)
            ectx.fillStyle = '#888';
            ectx.font = '12px monospace';
            ectx.textAlign = 'right';
            const freqMarks = [20, 100, 500, 1000, 5000, 10000, 20000];
            for (const freq of freqMarks) {
                const logPos = (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20));
                const y = plotBottom - logPos * plotHeight;
                ectx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, plotLeft - 5, y + 4);
            }
            ectx.save();
            ectx.translate(15, plotTop + plotHeight / 2);
            ectx.rotate(-Math.PI / 2);
            ectx.textAlign = 'center';
            ectx.fillText('Frequency (Hz)', 0, 0);
            ectx.restore();

            // Time labels (X axis)
            ectx.textAlign = 'center';
            const timePerSnapshot = data.snapshotInterval / data.sampleRate;
            const totalTime = history.length * timePerSnapshot;
            for (let t = 0; t <= totalTime; t += Math.ceil(totalTime / 5)) {
                const x = plotLeft + (t / totalTime) * plotWidth;
                ectx.fillText(`${t.toFixed(1)}s`, x, plotBottom + 20);
            }
            ectx.fillText('Time', plotLeft + plotWidth / 2, plotBottom + 40);

            // Title
            ectx.textAlign = 'left';
            ectx.fillText(`EURORACK SPECTROGRAM - ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, plotLeft, 25);

            // Color bar
            const barX = plotRight + 10;
            const barWidth = 15;
            for (let i = 0; i < plotHeight; i++) {
                const v = i / plotHeight;
                ectx.fillStyle = getColor(v);
                ectx.fillRect(barX, plotBottom - i, barWidth, 1);
            }
            ectx.strokeStyle = '#444';
            ectx.strokeRect(barX, plotTop, barWidth, plotHeight);
            ectx.fillStyle = '#888';
            ectx.textAlign = 'left';
            ectx.fillText('0dB', barX + barWidth + 5, plotTop + 10);
            ectx.fillText(`${floorDb.toFixed(0)}dB`, barX + barWidth + 5, plotBottom);

            // Download
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `spectrogram-${timestamp}.png`;
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

        function drawSpectrogram() {
            const width = canvas.width;
            const height = canvas.height;

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);

            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;

            if (!dsp) {
                ctx.fillStyle = '#444';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('START AUDIO', width / 2, height / 2);
                animationId = requestAnimationFrame(drawSpectrogram);
                return;
            }

            const history = dsp.history;
            if (history.length === 0) {
                ctx.fillStyle = '#444';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('WAITING...', width / 2, height / 2);
                animationId = requestAnimationFrame(drawSpectrogram);
                return;
            }

            const floorDb = -80 + dsp.params.floor * 60;
            const rangeDb = 0 - floorDb;
            const numBins = dsp.getFFTSize() / 2;
            const sampleRate = dsp.getSampleRate();

            // Draw from right to left (newest on right)
            const displayCols = Math.min(width, history.length);
            const startIdx = Math.max(0, history.length - displayCols);
            const numBands = 64;
            const bandHeight = height / numBands;

            for (let col = 0; col < displayCols; col++) {
                const snapshot = history[startIdx + col];
                const x = width - displayCols + col;

                for (let band = 0; band < numBands; band++) {
                    // Log frequency mapping
                    const minLog = Math.log10(20);
                    const maxLog = Math.log10(20000);
                    const freqLog = minLog + (band / numBands) * (maxLog - minLog);
                    const freq = Math.pow(10, freqLog);
                    const bin = Math.min(numBins - 1, Math.floor(freq * dsp.getFFTSize() / sampleRate));

                    const mag = snapshot[bin];
                    const norm = Math.max(0, Math.min(1, (mag - floorDb) / rangeDb));

                    ctx.fillStyle = getColor(norm);
                    ctx.fillRect(x, height - (band + 1) * bandHeight, 1, Math.ceil(bandHeight));
                }
            }

            // Frozen indicator
            if (dsp.params.freeze === 1) {
                ctx.fillStyle = '#ff6644';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('FROZEN', 4, 12);
            }

            // Time indicator
            ctx.fillStyle = '#666';
            ctx.font = '8px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${dsp.getTimeWindow().toFixed(0)}s`, width - 2, 10);

            animationId = requestAnimationFrame(drawSpectrogram);
        }

        drawSpectrogram();

        instance.cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    },

    ui: {
        leds: ['signal'],
        knobs: [
            { id: 'time', label: 'Time', param: 'time', min: 0, max: 1, default: 0.5 },
            { id: 'floor', label: 'Floor', param: 'floor', min: 0, max: 1, default: 0.5 }
        ],
        switches: [
            { id: 'freeze', label: 'Freeze', param: 'freeze', default: 0 }
        ],
        inputs: [
            { id: 'audio', label: 'Audio', port: 'audio', type: 'audio' }
        ],
        outputs: [
            { id: 'out', label: 'Thru', port: 'out', type: 'audio' }
        ]
    }
};
