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
const displaySize = bufferSize * 4;  // Multiple frames for smooth display
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
