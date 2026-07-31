# Dual Channel Oscilloscope (scope)

## Hardware Reference
- **Based on**: [Intellijel Zeroscope 1U](https://intellijel.com/shop/eurorack/1u/zeroscope-1u/)
- **ModularGrid**: [Intellijel Zeroscope 1U](https://www.modulargrid.net/e/intellijel-zeroscope-1u)

## Specifications

### Features
- Dual channel waveform display
- Three display modes: Scope, X-Y (Lissajous), Tune
- Adjustable time base and gain per channel
- Trigger with adjustable threshold
- Passthrough outputs (signal normalled to output)
- DC coupled inputs (±10V)
- Built-in chromatic tuner

### Size
- 16HP (wide panel for display)

### Controls
- **Time**: Time base / samples per screen
- **Trigger**: Trigger threshold level (-10V to +10V)
- **Mode**: Display mode switch (Scope, X-Y, Tune)
- **Gain 1**: Channel 1 vertical scale
- **Gain 2**: Channel 2 vertical scale
- **Offset 1**: Channel 1 vertical position
- **Offset 2**: Channel 2 vertical position

### Inputs
- **In 1**: Channel 1 input (±10V)
- **In 2**: Channel 2 input (±10V)

### Outputs
- **Out 1**: Channel 1 passthrough
- **Out 2**: Channel 2 passthrough

### Indicators
- **CH1 LED**: Green, shows signal presence
- **CH2 LED**: Cyan, shows signal presence

## Display Modes

### Scope Mode (Mode 0)
Standard time-domain oscilloscope:
- Horizontal axis = time
- Vertical axis = voltage
- CH1 displayed in green
- CH2 displayed in cyan
- Trigger level indicator (dashed line)

### X-Y Mode (Mode 1)
Lissajous pattern display:
- CH1 drives horizontal (X) axis
- CH2 drives vertical (Y) axis
- Creates patterns based on frequency relationships
- Useful for phase comparison and modulation visualization

### Tune Mode (Mode 2)
Chromatic tuner:
- Displays detected note name and octave
- Shows frequency in Hz
- Cents deviation indicator (color-coded accuracy)
- Green = in tune (±5¢), Yellow = close (±15¢), Red = out of tune

## DSP Implementation

### Circular Display Buffer
```javascript
const displaySize = 2048;  // Independent of the AudioWorklet render quantum
const displayBuffer1 = new Float32Array(displaySize);
const displayBuffer2 = new Float32Array(displaySize);
let writeIndex = 0;

// Copy samples to circular buffer
for (let i = 0; i < bufferSize; i++) {
    displayBuffer1[writeIndex] = input1[i];
    displayBuffer2[writeIndex] = input2[i];
    writeIndex = (writeIndex + 1) % displaySize;
}
```

The canvas requests between 128 and 1024 samples in time-domain mode and up to
1024 samples in X-Y mode. History must therefore never be derived from the
AudioWorklet block size: the production render quantum is normally 128 samples,
so the former `bufferSize * 4` policy exposed only 512 samples and forced longer
views outside the available history. Because the old start-index expression
added the buffer length only once, it could remain negative for the excess
region; those invalid samples produced the blank/flickering section until the
write index advanced. A fixed 2048-sample circular history holds two
maximum-width views and remains bounded.

### Trigger Detection
Rising edge detection for stable display:
```javascript
const trigLevel = (triggerParam - 0.5) * 20;  // -10V to +10V

if (!triggered && lastSample < trigLevel && sample >= trigLevel) {
    triggered = true;
    triggerIndex = writeIndex;
}

// Reset after one display cycle
if (triggered && writeIndex === triggerIndex) {
    triggered = false;
}
```

### Frequency Detection (Tuner)
Zero-crossing counting for frequency measurement:
```javascript
// Detect positive zero crossing
if (lastSample < 0 && sample >= 0) {
    const period = sampleCount - lastZeroCrossing;

    if (period > 10 && period < sampleRate) {  // Valid range
        const freq = sampleRate / period;

        // Average multiple crossings for stability
        freqAccumulator += freq;
        freqSampleCount++;

        if (freqSampleCount >= 4) {
            detectedFreq = freqAccumulator / freqSampleCount;
            freqAccumulator = 0;
            freqSampleCount = 0;
        }
    }
    lastZeroCrossing = sampleCount;
}
```

### Note Detection
```javascript
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function freqToNote(freq) {
    if (freq < 20 || freq > 20000) return { note: '--', cents: 0 };

    // MIDI note number from frequency
    const noteNum = 12 * Math.log2(freq / 440) + 69;
    const roundedNote = Math.round(noteNum);
    const cents = Math.round((noteNum - roundedNote) * 100);

    const octave = Math.floor(roundedNote / 12) - 1;
    const noteName = NOTE_NAMES[roundedNote % 12];

    return { note: `${noteName}${octave}`, cents };
}
```

### Gain and Offset Mapping
```javascript
// Gain: 0=±10V, 0.5=±5V, 1=±2V range
const range = 2 + (1 - gainParam) * 8;

// Offset: 0=-10V, 0.5=0V, 1=+10V shift
const offset = (offsetParam - 0.5) * 20;

// Apply to sample for display
const y = centerY - ((sample + offset) / range) * (height / 2);
```

## Lissajous Patterns

### Frequency Ratios
| CH1:CH2 | Pattern |
|---------|---------|
| 1:1 | Circle/ellipse (depending on phase) |
| 2:1 | Figure-8 |
| 3:1 | Trefoil |
| 3:2 | Complex knot |

### Phase Relationships
- 0° or 180°: Diagonal line
- 90° or 270°: Circle or ellipse
- Other: Tilted ellipse

## Oscilloscope Techniques

### Audio Analysis
- View waveform shape (sine, saw, square, etc.)
- Check for clipping/distortion
- Visualize amplitude modulation
- Compare two signals for timing

### Modular Debugging
- Verify clock signals
- Check envelope shapes
- Confirm gate/trigger behavior
- Measure CV levels

### Tuning
- Quick pitch reference
- Oscillator calibration
- Chord/interval checking

## DSP References
- [Oscilloscope Basics - Electronics Tutorials](https://www.electronics-tutorials.ws/oscilloscope/oscilloscope.html)
- [Lissajous Figures - Wikipedia](https://en.wikipedia.org/wiki/Lissajous_curve)
- [Zero Crossing Detection](https://www.embedded.com/detecting-zero-crossings/)
- [Pitch Detection Algorithms](https://www.dspguide.com/ch12/3.htm)

## Hardware References
- [Intellijel Zeroscope 1U](https://intellijel.com/shop/eurorack/1u/zeroscope-1u/)
- [ModularGrid - Zeroscope 1U](https://www.modulargrid.net/e/intellijel-zeroscope-1u)

## Potential Improvements
- Add FFT spectrum analyzer mode
- Implement persistence/phosphor decay
- Add measurement cursors
- Support external trigger input
- Add grid divisions display
- Implement peak hold markers
- Add BPM detection mode

## Sources
- [Intellijel Zeroscope 1U](https://intellijel.com/shop/eurorack/1u/zeroscope-1u/)
- [ModularGrid - Intellijel Zeroscope](https://www.modulargrid.net/e/intellijel-zeroscope-1u)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/scope.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Valid dual-channel +/-10V signals remain sample-identical through the analyzer.
  Invalid samples recover to 0V before passthrough, telemetry, triggering, tune
  detection, and metering, so one bad graph value cannot poison display state.
- Trigger level is bounded, LED telemetry is capped at 1, and reset now clears
  every frequency accumulator/counter plus stable input/output/display buffers.
- Focused tests cover trigger threshold, tune frequency, circular history,
  passthrough, LEDs, telemetry bounds, finite recovery, and reset.
- The strict matrix completes fifteen scenarios with zero voltage flags, stable
  buffers, and maximum observed advisory Node diagnostic time below
  0.154ms/block across the latest validation run.

## Display-history regression (2026-07-31)

- Recent factory patches commonly select Time values from 0.24 to 0.45, asking
  the canvas for roughly 620 to 810 samples per frame.
- Production AudioWorklet instances use 128-sample blocks. The old
  `bufferSize * 4` history therefore held only 512 samples, causing the excess
  canvas region to begin at invalid negative history indices and flicker as the
  write index advanced.
- Scope now uses a fixed 2048-sample history for both channels. Focused DSP and
  production-browser tests require that the telemetry buffer is at least as
  long as the requested canvas window.
- Validation passes all 34 focused Scope tests, the six strict matrix
  configurations, all 2,311 repository tests, and all 21 Chromium tests.
