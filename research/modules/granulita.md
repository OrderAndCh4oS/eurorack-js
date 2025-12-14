# Granulita Versio (granulita)

## Hardware Reference
- **Based on**: [Noise Engineering Granulita Versio](https://noiseengineering.us/products/granulita-versio/)
- **Manual**: [Granulita Versio Manual](https://manuals.noiseengineering.us/gv/)
- **Platform**: Versio DSP platform (10HP, stereo in/out)
- **ModularGrid**: [Granulita Versio](https://modulargrid.net/e/noise-engineering-granulita-versio)

## Specifications

### Physical
- **Width**: 10HP
- **Power**: +12V 125mA, -12V 10mA
- **Internal Sample Rate**: 96kHz
- **Audio Processing**: 32-bit

### Description
Stereo granular chord generator and resynthesizer with reverb/atmosphere. Takes audio input, granularizes it, and creates chords by pitch-shifting multiple "voices" according to selectable chord types.

### Controls (7 knobs)

| Knob | Parameter | Range | Description |
|------|-----------|-------|-------------|
| **Blend** | Dry/wet | 0-1 | Dry/wet balance |
| **Pitch** | Pitch offset | -1 to +1 octave | Unquantized pitch transposition |
| **Chord** | Chord type | 0-15 (16 chords) | Selects chord/interval type |
| **Voice** | Root tracking | 0-3 | Which chord voice tracks input pitch |
| **Verb** | Reverb | 0-1 | Decay (0-0.5), shimmer (0.5-0.75), infinite (0.75-1) |
| **Count** | Grain count | 0-32 | Number of simultaneous grains |
| **Length** | Grain length | 16ms-4s | Duration of each grain |

### Switches (2 three-position)

**Direction Switch (Top)**
| Position | Name | Behavior |
|----------|------|----------|
| Up | REV | Grains play backwards |
| Center | BTH | Random direction per grain |
| Down | FWD | Grains play forwards |

**Hit Mode Switch (Bottom)**
| Position | Name | Behavior |
|----------|------|----------|
| Up | FRZ | Freeze playback on gate high |
| Center | SYNC | External clock sync with tap tempo |
| Down | TRIG | Trigger-only mode |

### Inputs

**Audio I/O (Standard Versio)**
- **In L**: Left audio input (R normalizes to L if unpatched)
- **In R**: Right audio input
- **Out L**: Left processed output
- **Out R**: Right processed output

**Control Inputs**
- **Hit**: Gate input (triggers >2V threshold)
- **Blend CV**: 0-5V, sums with knob
- **Pitch CV**: 0-5V, sums with knob
- **Chord CV**: 0-5V, sums with knob
- **Voice CV**: 0-5V, sums with knob
- **Verb CV**: 0-5V, sums with knob
- **Count CV**: 0-5V, sums with knob
- **Length CV**: 0-5V, sums with knob

### Voltage Specs
- CV inputs: 0V to 5V (all pots act as offsets)
- Hit input threshold: >2V
- Audio inputs: Clip around 16V peak-to-peak (±8V)
- Audio outputs: ±5V nominal

### Indicators
- **Chord LEDs**: Display current chord intervals (white = root voice)

## Chord Types (16 total)

Based on typical granular chord generators:
| Index | Name | Intervals (semitones) |
|-------|------|----------------------|
| 0 | Unison | 0, 0, 0, 0 |
| 1 | Octave | 0, 12, 0, 12 |
| 2 | Fifth | 0, 7, 12, 19 |
| 3 | Major | 0, 4, 7, 12 |
| 4 | Minor | 0, 3, 7, 12 |
| 5 | Maj7 | 0, 4, 7, 11 |
| 6 | Min7 | 0, 3, 7, 10 |
| 7 | Dom7 | 0, 4, 7, 10 |
| 8 | Dim | 0, 3, 6, 9 |
| 9 | Aug | 0, 4, 8, 12 |
| 10 | Sus4 | 0, 5, 7, 12 |
| 11 | Sus2 | 0, 2, 7, 12 |
| 12 | Add9 | 0, 4, 7, 14 |
| 13 | Min9 | 0, 3, 7, 14 |
| 14 | Spread | 0, 7, 14, 21 |
| 15 | Cluster | 0, 1, 2, 3 |

## Granular Synthesis Theory

### Basic Concept
Granular synthesis breaks audio into small "grains" (typically 10ms-500ms) and reassembles them with:
- **Time stretching**: Independent of pitch
- **Pitch shifting**: Via playback speed change
- **Density**: Multiple overlapping grains
- **Position**: Where in the buffer to read from

### Grain Structure
```
       ┌────────────────────────────────────────┐
  1.0  │         ╱████████████╲                 │  Amplitude envelope
       │       ╱██████████████████╲             │  (typically Hanning)
  0.0  │─────╱████████████████████████╲─────────│
       └────────────────────────────────────────┘
       │ attack │      sustain      │ release │
```

### Pitch Shifting via Grains
Each grain plays back at a different rate:
```javascript
// Pitch ratio: 2^(semitones/12)
const pitchRatio = Math.pow(2, semitones / 12);
readPosition += pitchRatio; // Faster/slower playback
```

### Grain Scheduling
```
Time →
Grain 1: ████████████
Grain 2:      ████████████
Grain 3:           ████████████
Grain 4:                ████████████
         (overlap creates continuous texture)
```

## DSP Implementation

### Buffer Structure
```javascript
// Circular audio buffer (4 seconds at sample rate)
const bufferSize = sampleRate * 4;
const audioBuffer = new Float32Array(bufferSize);
let writeHead = 0;  // Current recording position
```

### Grain Object
```javascript
{
    active: true,
    position: 0,      // Current read position in buffer
    length: 0,        // Total grain length in samples
    elapsed: 0,       // Samples played so far
    pitch: 1.0,       // Playback rate
    direction: 1,     // 1 = forward, -1 = reverse
    pan: 0.5          // Stereo position
}
```

### Grain Envelope (Hanning Window)
```javascript
function grainEnvelope(phase) {
    // phase 0-1 through the grain
    return 0.5 * (1 - Math.cos(2 * Math.PI * phase));
}
```

### Pitch Shift Calculation
```javascript
// For each voice in chord
const chordIntervals = CHORDS[chordType];
const voicePitch = Math.pow(2, (pitchOffset * 12 + chordIntervals[voice]) / 12);
```

### Reverb Section
Simple shimmer reverb with pitch-shifted feedback:
```javascript
// Decay time from verb knob (first half)
// Shimmer intensity from verb knob (second half)
// Infinite mode when verb > 0.75
```

## Simplified Implementation

For this emulator, we'll implement:
1. **4-voice granular engine** (matching chord voices)
2. **16 chord types** with selectable root tracking
3. **Simple reverb** with shimmer option
4. **Three direction modes** (fwd/rev/both)
5. **Freeze mode** on gate high
6. **Basic sync mode** for grain timing

### Processing Flow
```
Audio In → Buffer → Grain Engine → Chord Voices → Mix → Reverb → Output
              ↑                         ↓
           Write Head              Pitch Shift
              ↑                         ↓
           Freeze Gate             Voice Select
```

## Parameter Mapping

### Pitch Knob
```javascript
// -1 to +1 octave (-12 to +12 semitones)
const pitchSemitones = (pitch - 0.5) * 24;
```

### Chord Knob
```javascript
// 16 chords, quantized
const chordIndex = Math.floor(chord * 16);
```

### Voice Knob
```javascript
// 4 voices (0-3)
const rootVoice = Math.floor(voice * 4);
```

### Verb Knob
```javascript
// First half: decay (0-0.5 maps to 0-1 decay)
// Second half: shimmer (0.5-1 adds shimmer)
const decay = Math.min(verb * 2, 1);
const shimmer = Math.max(0, (verb - 0.5) * 2);
const infinite = verb > 0.75;
```

### Count Knob
```javascript
// 0-32 grains (0 = silent, 32 = maximum density)
const grainCount = Math.floor(count * 32);
```

### Length Knob
```javascript
// 16ms to 4000ms (exponential scaling)
const lengthMs = 16 * Math.pow(250, length);
// at length=0: 16ms
// at length=1: 4000ms
```

## Sources
- [Granulita Versio Manual](https://manuals.noiseengineering.us/gv/)
- [Noise Engineering Product Page](https://noiseengineering.us/products/granulita-versio/)
- [ModularGrid](https://modulargrid.net/e/noise-engineering-granulita-versio)
- [World of Versio](https://noiseengineering.us/pages/world-of-versio/)
- [Granular Synthesis - Curtis Roads](https://mitpress.mit.edu/9780262681544/microsound/)

## Potential Improvements
- Add grain spray/jitter parameter
- Implement more sophisticated shimmer reverb
- Add grain position randomization
- Implement stereo grain panning
- Add more chord types
