/**
 * DB - Dual VU Meter Module
 *
 * Based on:
 * - Wavefonix Dual VU Meter (6HP analog VU)
 * - NoisyFruitsLab RGB VU Meter (2HP LED bargraph)
 *
 * Features:
 * - Stereo L/R metering
 * - 8 LEDs per channel (-30dB to +6dB range)
 * - VU mode (300ms averaging) / Peak mode / Combined
 * - Peak hold indicator
 * - Thru outputs for signal pass-through
 */

export default {
    id: 'db',
    name: 'DB',
    hp: 4,
    color: '#1a1a1a',
    category: 'utility',

    // Custom CSS for VU meter display
    css: `
        .db-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 4px;
            gap: 4px;
        }
        .db-meter-area {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex: 1;
            padding: 8px 0;
        }
        .db-channel {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        }
        .db-led-stack {
            display: flex;
            flex-direction: column-reverse;
            gap: 3px;
        }
        .db-led {
            width: 20px;
            height: 8px;
            border-radius: 2px;
            background: #111;
            border: 1px solid #333;
            transition: background-color 0.05s, box-shadow 0.05s;
        }
        .db-led.green { --led-color: #00ff00; --led-glow: #00ff0066; }
        .db-led.yellow { --led-color: #ffff00; --led-glow: #ffff0066; }
        .db-led.red { --led-color: #ff0000; --led-glow: #ff000066; }
        .db-led.lit {
            background: var(--led-color);
            box-shadow: 0 0 6px var(--led-glow), 0 0 2px var(--led-glow);
        }
        .db-led.dim {
            background: color-mix(in srgb, var(--led-color) 40%, #111);
        }
        .db-led.peak-hold {
            border: 1px solid var(--led-color);
        }
        .db-channel-label {
            font-size: 9px;
            color: #888;
            text-transform: uppercase;
            margin-top: 4px;
        }
        .db-controls {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
        }
        .db-switch-row {
            display: flex;
            gap: 8px;
            justify-content: center;
        }
        .db-jack-row {
            display: flex;
            gap: 8px;
            justify-content: center;
        }
        .db-section-label {
            font-size: 8px;
            color: #666;
            text-transform: uppercase;
            text-align: center;
        }
    `,

    createDSP({ sampleRate = 44100, bufferSize = 512 } = {}) {
        // LED arrays for L and R channels (12 LEDs each)
        const leds = {
            L0: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0, L7: 0, L8: 0, L9: 0, L10: 0, L11: 0,
            R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0, R8: 0, R9: 0, R10: 0, R11: 0,
            peakL: 0,
            peakR: 0
        };

        // VU meter time constants (per-buffer, not per-sample)
        // Standard VU: 300ms to reach 99% of steady state
        const buffersFor300ms = (sampleRate * 0.3) / bufferSize;
        const vuCoeff = Math.exp(-1 / buffersFor300ms);

        // Peak meter: instant attack, ~1.5s decay (per-buffer)
        const buffersFor1500ms = (sampleRate * 1.5) / bufferSize;
        const peakReleaseCoeff = Math.exp(-1 / buffersFor1500ms);

        // Peak hold decay (when hold is off): faster for testing ~0.5s
        const buffersFor500ms = (sampleRate * 0.5) / bufferSize;
        const peakHoldDecayCoeff = Math.exp(-1 / buffersFor500ms);

        // Internal state
        let vuLevelL = 0;
        let vuLevelR = 0;
        let peakLevelL = 0;
        let peakLevelR = 0;
        let peakHoldL = 0;
        let peakHoldR = 0;
        let peakHoldTimerL = 0;
        let peakHoldTimerR = 0;

        // Peak hold time in samples (~1.5 seconds)
        const peakHoldTime = Math.floor(sampleRate * 1.5);

        // Reference level: 0dB = 5V peak (our audio standard)
        const refVoltage = 5;

        // dB range: -36dB to +6dB (42dB total, 12 LEDs = 3.5dB per LED)
        const dbMin = -36;
        const dbMax = 6;
        const dbRange = dbMax - dbMin;
        const dbPerLed = dbRange / 12;

        // Convert linear amplitude to dB relative to reference
        function ampToDb(amp) {
            if (amp <= 0) return -Infinity;
            return 20 * Math.log10(amp / refVoltage);
        }

        // Convert dB to LED index (0-11), returns fractional for smooth display
        function dbToLedIndex(db) {
            if (db <= dbMin) return -1;
            if (db >= dbMax) return 11;
            return (db - dbMin) / dbPerLed - 0.5;
        }

        // Update LED array from a level value (0-11 scale)
        // level < 0 = all off, level >= 11 = all on
        function updateLeds(prefix, level) {
            for (let i = 0; i < 12; i++) {
                if (level > i + 1) {
                    // Full brightness for LEDs below the level
                    leds[`${prefix}${i}`] = 1;
                } else if (level > i && level <= i + 1) {
                    // Partial brightness for the LED at the level
                    leds[`${prefix}${i}`] = level - i;
                } else {
                    leds[`${prefix}${i}`] = 0;
                }
            }
        }

        const ownL = new Float32Array(bufferSize);
        const ownR = new Float32Array(bufferSize);

        return {
            params: {
                mode: 0,  // 0 = VU, 1 = Peak, 2 = Both
                hold: 1   // 0 = off, 1 = on
            },

            inputs: {
                L: ownL,
                R: ownR
            },

            outputs: {
                outL: new Float32Array(bufferSize),
                outR: new Float32Array(bufferSize)
            },

            leds,

            process() {
                const { L, R } = this.inputs;
                const { mode, hold } = this.params;

                // Pass through to outputs
                for (let i = 0; i < bufferSize; i++) {
                    this.outputs.outL[i] = L[i];
                    this.outputs.outR[i] = R[i];
                }

                // Calculate levels for this buffer
                let sumSqL = 0;
                let sumSqR = 0;
                let maxL = 0;
                let maxR = 0;

                for (let i = 0; i < bufferSize; i++) {
                    const sampleL = L[i];
                    const sampleR = R[i];

                    sumSqL += sampleL * sampleL;
                    sumSqR += sampleR * sampleR;

                    const absL = Math.abs(sampleL);
                    const absR = Math.abs(sampleR);

                    if (absL > maxL) maxL = absL;
                    if (absR > maxR) maxR = absR;
                }

                // RMS for this buffer
                const rmsL = Math.sqrt(sumSqL / bufferSize);
                const rmsR = Math.sqrt(sumSqR / bufferSize);

                // VU smoothing (exponential moving average on RMS)
                vuLevelL = vuLevelL * vuCoeff + rmsL * (1 - vuCoeff);
                vuLevelR = vuLevelR * vuCoeff + rmsR * (1 - vuCoeff);

                // Peak detection with decay
                if (maxL > peakLevelL) {
                    peakLevelL = maxL;
                } else {
                    peakLevelL *= peakReleaseCoeff;
                }

                if (maxR > peakLevelR) {
                    peakLevelR = maxR;
                } else {
                    peakLevelR *= peakReleaseCoeff;
                }

                // Convert to dB and update LEDs based on mode
                let displayLevelL, displayLevelR;

                if (mode === 0) {
                    // VU mode - show RMS average
                    displayLevelL = vuLevelL;
                    displayLevelR = vuLevelR;
                } else if (mode === 1) {
                    // Peak mode - show peak with decay
                    displayLevelL = peakLevelL;
                    displayLevelR = peakLevelR;
                } else {
                    // Combined mode - show VU on main LEDs
                    displayLevelL = vuLevelL;
                    displayLevelR = vuLevelR;
                }

                const dbL = ampToDb(displayLevelL);
                const dbR = ampToDb(displayLevelR);

                const ledIndexL = dbToLedIndex(dbL);
                const ledIndexR = dbToLedIndex(dbR);

                updateLeds('L', ledIndexL + 1);
                updateLeds('R', ledIndexR + 1);

                // Peak hold indicators - track the displayed level, not raw input
                // This way the peak sits on top of the lit bars
                const displayLedL = ledIndexL + 1;
                const displayLedR = ledIndexR + 1;

                if (hold === 1) {
                    // Update peak hold if display level is higher
                    if (displayLedL >= peakHoldL) {
                        peakHoldL = displayLedL;
                        peakHoldTimerL = peakHoldTime;
                    } else {
                        peakHoldTimerL -= bufferSize;
                        if (peakHoldTimerL <= 0) {
                            peakHoldL = displayLedL;
                            peakHoldTimerL = peakHoldTime;
                        }
                    }

                    if (displayLedR >= peakHoldR) {
                        peakHoldR = displayLedR;
                        peakHoldTimerR = peakHoldTime;
                    } else {
                        peakHoldTimerR -= bufferSize;
                        if (peakHoldTimerR <= 0) {
                            peakHoldR = displayLedR;
                            peakHoldTimerR = peakHoldTime;
                        }
                    }

                    leds.peakL = Math.max(0, Math.min(11, Math.floor(peakHoldL)));
                    leds.peakR = Math.max(0, Math.min(11, Math.floor(peakHoldR)));
                } else {
                    // No hold - peak follows display level
                    leds.peakL = Math.max(0, Math.min(11, Math.floor(displayLedL)));
                    leds.peakR = Math.max(0, Math.min(11, Math.floor(displayLedR)));
                }

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

            reset() {
                vuLevelL = 0;
                vuLevelR = 0;
                peakLevelL = 0;
                peakLevelR = 0;
                peakHoldL = 0;
                peakHoldR = 0;
                peakHoldTimerL = 0;
                peakHoldTimerR = 0;

                for (let i = 0; i < 12; i++) {
                    leds[`L${i}`] = 0;
                    leds[`R${i}`] = 0;
                }
                leds.peakL = 0;
                leds.peakR = 0;
            }
        };
    },

    render(container, { instance, toolkit, onParamChange }) {
        const getModule = instance.getModule;

        // LED colors by index (bottom to top): 8 green, 2 yellow, 2 red
        // -36 to -8dB = green, -8 to -1dB = yellow, -1 to +6dB = red
        const LED_COLORS = ['green', 'green', 'green', 'green', 'green', 'green', 'green', 'green', 'yellow', 'yellow', 'red', 'red'];

        // Main container
        const mainContainer = document.createElement('div');
        mainContainer.className = 'db-container';

        // Meter area with two LED columns
        const meterArea = document.createElement('div');
        meterArea.className = 'db-meter-area';

        // Create LED elements storage for updates
        const ledElements = { L: [], R: [] };

        // Create a channel (L or R)
        function createChannel(channel) {
            const channelDiv = document.createElement('div');
            channelDiv.className = 'db-channel';

            const ledStack = document.createElement('div');
            ledStack.className = 'db-led-stack';

            // Create 12 LEDs (index 0 = bottom, index 11 = top)
            for (let i = 0; i < 12; i++) {
                const led = document.createElement('div');
                led.className = `db-led ${LED_COLORS[i]}`;
                led.dataset.index = i;
                ledStack.appendChild(led);
                ledElements[channel].push(led);
            }

            channelDiv.appendChild(ledStack);

            const label = document.createElement('div');
            label.className = 'db-channel-label';
            label.textContent = channel;
            channelDiv.appendChild(label);

            return channelDiv;
        }

        meterArea.appendChild(createChannel('L'));
        meterArea.appendChild(createChannel('R'));
        mainContainer.appendChild(meterArea);

        // Controls section
        const controls = document.createElement('div');
        controls.className = 'db-controls';

        // Mode/Hold switches row
        const switchRow = document.createElement('div');
        switchRow.className = 'db-switch-row';

        let currentMode = 0;
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
            }
        });
        switchRow.appendChild(modeSwitch);

        let currentHold = 1;
        const holdSwitch = toolkit.createSwitch({
            id: 'hold',
            label: 'Hold',
            param: 'hold',
            value: 1,
            onChange: () => {
                currentHold = currentHold === 1 ? 0 : 1;
                const mod = getModule ? getModule() : null;
                if (mod && mod.instance) {
                    mod.instance.params.hold = currentHold;
                }
                onParamChange('hold', currentHold);
            }
        });
        switchRow.appendChild(holdSwitch);

        controls.appendChild(switchRow);

        // Input jacks
        const inLabel = document.createElement('div');
        inLabel.className = 'db-section-label';
        inLabel.textContent = 'IN';
        controls.appendChild(inLabel);

        const inJackRow = document.createElement('div');
        inJackRow.className = 'db-jack-row';
        inJackRow.appendChild(toolkit.createJack({
            id: 'L',
            label: 'L',
            direction: 'input',
            type: 'audio'
        }));
        inJackRow.appendChild(toolkit.createJack({
            id: 'R',
            label: 'R',
            direction: 'input',
            type: 'audio'
        }));
        controls.appendChild(inJackRow);

        // Output jacks (thru)
        const outLabel = document.createElement('div');
        outLabel.className = 'db-section-label';
        outLabel.textContent = 'THRU';
        controls.appendChild(outLabel);

        const outJackRow = document.createElement('div');
        outJackRow.className = 'db-jack-row';
        outJackRow.appendChild(toolkit.createJack({
            id: 'outL',
            label: 'L',
            direction: 'output',
            type: 'audio'
        }));
        outJackRow.appendChild(toolkit.createJack({
            id: 'outR',
            label: 'R',
            direction: 'output',
            type: 'audio'
        }));
        controls.appendChild(outJackRow);

        mainContainer.appendChild(controls);
        container.appendChild(mainContainer);

        // Animation loop for LED updates
        let animationId = null;

        function updateLEDs() {
            const mod = getModule ? getModule() : null;
            const dsp = mod ? mod.instance : null;

            if (dsp) {
                const leds = dsp.leds;

                // Update L channel LEDs
                for (let i = 0; i < 12; i++) {
                    const ledEl = ledElements.L[i];
                    const value = leds[`L${i}`];
                    const peakIndex = Math.floor(leds.peakL);

                    ledEl.classList.remove('lit', 'dim', 'peak-hold');
                    if (value >= 0.9) {
                        ledEl.classList.add('lit');
                    } else if (value > 0) {
                        ledEl.classList.add('dim');
                    }
                    // Peak hold indicator
                    if (i === peakIndex && dsp.params.hold === 1) {
                        ledEl.classList.add('peak-hold');
                    }
                }

                // Update R channel LEDs
                for (let i = 0; i < 12; i++) {
                    const ledEl = ledElements.R[i];
                    const value = leds[`R${i}`];
                    const peakIndex = Math.floor(leds.peakR);

                    ledEl.classList.remove('lit', 'dim', 'peak-hold');
                    if (value >= 0.9) {
                        ledEl.classList.add('lit');
                    } else if (value > 0) {
                        ledEl.classList.add('dim');
                    }
                    // Peak hold indicator
                    if (i === peakIndex && dsp.params.hold === 1) {
                        ledEl.classList.add('peak-hold');
                    }
                }
            }

            animationId = requestAnimationFrame(updateLEDs);
        }

        // Start animation
        updateLEDs();

        // Cleanup function
        instance.cleanup = () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    },

    // UI definition for registry validation
    ui: {
        leds: [
            'L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11',
            'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11',
            'peakL', 'peakR'
        ],
        knobs: [],
        switches: [
            { id: 'mode', label: 'Mode', param: 'mode', positions: ['VU', 'Peak', 'Both'], default: 0 },
            { id: 'hold', label: 'Hold', param: 'hold', positions: ['Off', 'On'], default: 1 }
        ],
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
