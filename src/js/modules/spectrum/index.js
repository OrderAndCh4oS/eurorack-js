/**
 * SPECTRUM - FFT Spectrum Analyzer Module
 *
 * Real-time frequency analysis for evaluating synthesis quality.
 * Uses FFT to display frequency content as a bar graph.
 *
 * Features:
 * - Real-time FFT analysis with configurable resolution
 * - Peak hold with adjustable decay
 * - Logarithmic or linear frequency scale
 * - Adjustable dB floor for dynamic range
 * - Passthrough audio output
 */

export default {
    id: 'spectrum',
    name: 'SPECTRUM',
    hp: 12,
    color: '#2a1a4a',
    category: 'utility',

    css: `
        .spectrum-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            height: 100%;
            padding: 4px;
        }
        .spectrum-display-area {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .spectrum-canvas {
            background: #0a0a14;
            border: 1px solid #2a1a4a;
            border-radius: 3px;
            width: 100%;
            margin-bottom: 8px;
        }
        .spectrum-controls {
            display: flex;
            flex-direction: row;
            gap: 4px;
            flex: 1;
        }
        .spectrum-io-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
        }
        .spectrum-knob-column {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
        }
        .spectrum-section-label {
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 2px;
        }
        .spectrum-led-row {
            display: flex;
            gap: 8px;
            justify-content: center;
            padding: 2px 0;
            margin-bottom: 8px;
        }
        .spectrum-knob-row {
            display: flex;
            gap: 4px;
            justify-content: center;
        }
        .spectrum-freq-labels {
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            color: #666;
            padding: 0 2px;
            margin-top: -6px;
            margin-bottom: 4px;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // FFT size - use power of 2 for efficient FFT
        const FFT_SIZE = 2048;
        const NUM_BINS = FFT_SIZE / 2;

        // Buffers for FFT
        const inputBuffer = new Float32Array(FFT_SIZE);
        const windowBuffer = new Float32Array(FFT_SIZE);
        const realBuffer = new Float32Array(FFT_SIZE);
        const imagBuffer = new Float32Array(FFT_SIZE);
        const magnitudes = new Float32Array(NUM_BINS);
        const peaks = new Float32Array(NUM_BINS);

        let writeIndex = 0;

        // Pre-compute Hann window
        for (let i = 0; i < FFT_SIZE; i++) {
            windowBuffer[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
        }

        // Pre-compute bit-reversal indices for FFT
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

        // Cooley-Tukey FFT implementation
        function performFFT() {
            // Apply window and copy to real buffer, clear imag
            for (let i = 0; i < FFT_SIZE; i++) {
                realBuffer[bitReversed[i]] = inputBuffer[i] * windowBuffer[i];
                imagBuffer[bitReversed[i]] = 0;
            }

            // FFT butterfly operations
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

            // Calculate magnitudes (in dB)
            const scale = 2 / FFT_SIZE;
            for (let i = 0; i < NUM_BINS; i++) {
                const re = realBuffer[i] * scale;
                const im = imagBuffer[i] * scale;
                const mag = Math.sqrt(re * re + im * im);
                // Convert to dB, with floor at -100dB
                magnitudes[i] = mag > 0.00001 ? 20 * Math.log10(mag) : -100;
            }
        }

        const ownAudio = new Float32Array(bufferSize);
        const out = new Float32Array(bufferSize);

        return {
            params: {
                floor: 0.5,   // dB floor (0=-80dB, 1=-20dB)
                decay: 0.5,   // Peak decay rate
                scale: 0      // 0=log freq, 1=linear freq
            },
            inputs: { audio: ownAudio },
            outputs: { out },
            leds: { signal: 0 },

            // Expose for visualization and testing
            magnitudes,
            peaks,

            getFFTSize() { return FFT_SIZE; },

            binToFreq(bin) {
                return bin * sampleRate / FFT_SIZE;
            },

            freqToBin(freq) {
                return Math.round(freq * FFT_SIZE / sampleRate);
            },

            process() {
                const input = this.inputs.audio;

                // Passthrough
                out.set(input);

                // Accumulate samples into FFT input buffer
                for (let i = 0; i < input.length; i++) {
                    inputBuffer[writeIndex] = input[i];
                    writeIndex = (writeIndex + 1) % FFT_SIZE;
                }

                // Perform FFT when buffer is ready (every FFT_SIZE/bufferSize calls)
                // For simplicity, run FFT every process call with overlapping windows
                performFFT();

                // Update peaks with decay
                // Higher decay param = faster fall (lower hold time)
                const decayRate = 0.995 - this.params.decay * 0.15; // 0.995 to 0.845
                for (let i = 0; i < NUM_BINS; i++) {
                    // Peaks track the maximum, decay over time
                    if (magnitudes[i] > peaks[i]) {
                        peaks[i] = magnitudes[i];
                    } else {
                        // Decay towards current magnitude
                        peaks[i] = peaks[i] * decayRate + magnitudes[i] * (1 - decayRate);
                    }
                }

                // LED shows signal presence
                let maxAbs = 0;
                for (let i = 0; i < input.length; i++) {
                    const abs = Math.abs(input[i]);
                    if (abs > maxAbs) maxAbs = abs;
                }
                this.leds.signal = maxAbs / 10; // +-10V range

                // Reset input if replaced by routing
                if (this.inputs.audio !== ownAudio) {
                    ownAudio.fill(0);
                    this.inputs.audio = ownAudio;
                }
            },

            reset() {
                inputBuffer.fill(0);
                magnitudes.fill(0);
                peaks.fill(0);
                writeIndex = 0;
                this.leds.signal = 0;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        const getModule = instance.getModule;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'spectrum-container';

        // === TOP: Display ===
        const displayArea = document.createElement('div');
        displayArea.className = 'spectrum-display-area';

        // LED indicator
        const ledRow = document.createElement('div');
        ledRow.className = 'spectrum-led-row';
        const signalLed = toolkit.createLED({ id: 'signal', color: 'green' });
        ledRow.appendChild(signalLed);
        displayArea.appendChild(ledRow);

        // Canvas for spectrum display
        const canvas = toolkit.createCanvas({
            width: 180,
            height: 100,
            className: 'spectrum-canvas'
        });
        const ctx = canvas.getContext('2d');
        displayArea.appendChild(canvas);

        // Frequency labels
        const freqLabels = document.createElement('div');
        freqLabels.className = 'spectrum-freq-labels';
        freqLabels.innerHTML = '<span>20</span><span>100</span><span>1k</span><span>10k</span><span>20k</span>';
        displayArea.appendChild(freqLabels);

        mainContainer.appendChild(displayArea);

        // === BOTTOM: Controls ===
        const controls = document.createElement('div');
        controls.className = 'spectrum-controls';

        // I/O column
        const ioColumn = document.createElement('div');
        ioColumn.className = 'spectrum-io-column';

        const inLabel = document.createElement('div');
        inLabel.className = 'spectrum-section-label';
        inLabel.textContent = 'IN';
        ioColumn.appendChild(inLabel);

        ioColumn.appendChild(toolkit.createJack({
            id: 'audio',
            label: 'Audio',
            direction: 'input',
            type: 'audio'
        }));

        const outLabel = document.createElement('div');
        outLabel.className = 'spectrum-section-label';
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
        knobColumn.className = 'spectrum-knob-column';

        const knobRow1 = document.createElement('div');
        knobRow1.className = 'spectrum-knob-row';

        knobRow1.appendChild(toolkit.createKnob({
            id: 'floor',
            label: 'Floor',
            param: 'floor',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('floor', value)
        }));

        knobRow1.appendChild(toolkit.createKnob({
            id: 'decay',
            label: 'Decay',
            param: 'decay',
            value: 0.5,
            min: 0,
            max: 1,
            onChange: (value) => onParamChange('decay', value)
        }));

        knobColumn.appendChild(knobRow1);

        const knobRow2 = document.createElement('div');
        knobRow2.className = 'spectrum-knob-row';

        knobRow2.appendChild(toolkit.createSwitch({
            id: 'scale',
            label: 'Log/Lin',
            param: 'scale',
            value: 0,
            onChange: (value) => {
                const mod = getModule ? getModule() : null;
                if (mod && mod.instance) {
                    mod.instance.params.scale = value;
                }
                onParamChange('scale', value);
            }
        }));

        knobColumn.appendChild(knobRow2);
        controls.appendChild(knobColumn);

        mainContainer.appendChild(controls);
        container.appendChild(mainContainer);

        // Animation loop
        let animationId = null;

        function drawSpectrum() {
            const width = canvas.width;
            const height = canvas.height;

            // Clear
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, width, height);

            // Draw grid lines
            ctx.strokeStyle = '#1a1a2a';
            ctx.lineWidth = 0.5;

            // Horizontal dB lines
            for (let db = -60; db <= 0; db += 20) {
                const y = height * (1 - (db + 80) / 80);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;

            if (!dsp) {
                ctx.fillStyle = '#444';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('START AUDIO', width / 2, height / 2);
                animationId = requestAnimationFrame(drawSpectrum);
                return;
            }

            const magnitudes = dsp.magnitudes;
            const peaks = dsp.peaks;
            const numBins = magnitudes.length;
            const isLog = dsp.params.scale === 0;

            // dB floor: 0=-80dB, 1=-20dB
            const floorDb = -80 + dsp.params.floor * 60;
            const rangeDb = 0 - floorDb;

            // Number of display bars
            const numBars = 64;
            const barWidth = width / numBars - 1;

            // Map bins to bars
            const sampleRate = 44100;
            const fftSize = dsp.getFFTSize();
            const nyquist = sampleRate / 2;

            for (let bar = 0; bar < numBars; bar++) {
                let startFreq, endFreq;

                if (isLog) {
                    // Logarithmic frequency scale (20Hz to 20kHz)
                    const minLog = Math.log10(20);
                    const maxLog = Math.log10(20000);
                    const logRange = maxLog - minLog;
                    startFreq = Math.pow(10, minLog + (bar / numBars) * logRange);
                    endFreq = Math.pow(10, minLog + ((bar + 1) / numBars) * logRange);
                } else {
                    // Linear frequency scale
                    startFreq = (bar / numBars) * nyquist;
                    endFreq = ((bar + 1) / numBars) * nyquist;
                }

                // Find max magnitude in this frequency range
                const startBin = Math.max(1, Math.floor(startFreq * fftSize / sampleRate));
                const endBin = Math.min(numBins - 1, Math.ceil(endFreq * fftSize / sampleRate));

                let maxMag = -100;
                let maxPeak = -100;
                for (let bin = startBin; bin <= endBin; bin++) {
                    if (magnitudes[bin] > maxMag) maxMag = magnitudes[bin];
                    if (peaks[bin] > maxPeak) maxPeak = peaks[bin];
                }

                // Normalize to display range
                const normMag = Math.max(0, Math.min(1, (maxMag - floorDb) / rangeDb));
                const normPeak = Math.max(0, Math.min(1, (maxPeak - floorDb) / rangeDb));

                const x = bar * (width / numBars);
                const barHeight = normMag * height;
                const peakY = height - normPeak * height;

                // Draw bar with gradient
                const gradient = ctx.createLinearGradient(0, height, 0, 0);
                gradient.addColorStop(0, '#2a4a2a');
                gradient.addColorStop(0.5, '#4a8a4a');
                gradient.addColorStop(0.8, '#8aca4a');
                gradient.addColorStop(1, '#cafa4a');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);

                // Draw peak line
                ctx.fillStyle = '#ff8844';
                ctx.fillRect(x, peakY - 1, barWidth, 2);
            }

            // Draw dB scale on left
            ctx.fillStyle = '#666';
            ctx.font = '8px monospace';
            ctx.textAlign = 'left';
            for (let db = -60; db <= 0; db += 20) {
                const y = height * (1 - (db - floorDb) / rangeDb);
                if (y > 10 && y < height - 5) {
                    ctx.fillText(`${db}`, 2, y + 3);
                }
            }

            animationId = requestAnimationFrame(drawSpectrum);
        }

        drawSpectrum();

        instance.cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    },

    ui: {
        leds: ['signal'],
        knobs: [
            { id: 'floor', label: 'Floor', param: 'floor', min: 0, max: 1, default: 0.5 },
            { id: 'decay', label: 'Decay', param: 'decay', min: 0, max: 1, default: 0.5 }
        ],
        switches: [
            { id: 'scale', label: 'Log/Lin', param: 'scale', default: 0 }
        ],
        inputs: [
            { id: 'audio', label: 'Audio', port: 'audio', type: 'audio' }
        ],
        outputs: [
            { id: 'out', label: 'Thru', port: 'out', type: 'audio' }
        ]
    }
};
