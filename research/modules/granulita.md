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

The official manual names the chord bank but does not publish numeric
voicings. The interval/dyad entries below duplicate their interval across four
grain voices; triads double the root. This is an explicit app approximation.

| Index | Name | Intervals (semitones) |
|-------|------|----------------------|
| 0 | Unison | 0, 0, 0, 0 |
| 1 | Minor third | 0, 3, 0, 3 |
| 2 | Major third | 0, 4, 0, 4 |
| 3 | Fourth | 0, 5, 0, 5 |
| 4 | Tritone | 0, 6, 0, 6 |
| 5 | Fifth | 0, 7, 0, 7 |
| 6 | Minor triad | 0, 3, 7, 12 |
| 7 | Major triad | 0, 4, 7, 12 |
| 8 | Diminished seventh | 0, 3, 6, 9 |
| 9 | Half-diminished seventh | 0, 3, 6, 10 |
| 10 | Minor seventh | 0, 3, 7, 10 |
| 11 | Minor-major seventh | 0, 3, 7, 11 |
| 12 | Dominant seventh | 0, 4, 7, 10 |
| 13 | Major seventh | 0, 4, 7, 11 |
| 14 | Augmented major seventh | 0, 4, 8, 11 |
| 15 | Augmented triad with doubled root | 0, 4, 8, 12 |

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

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/granulita.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Audit (2026-07-30)

### Confirmed and remediated

- Stereo input normalization used instantaneous right-channel amplitude, which
  replaced every near-zero right sample with an unrelated left sample. IN R now
  follows worklet cable lifecycle state; an unpatched IN R still normalizes from
  IN L.
- The output limiter had the same discontinuous 5 V transfer found in `verb`.
  Both channels now use the shared continuous `softLimitVoltage()` rail.
- `grains.filter(...)` allocated one temporary array per audio sample: 512
  allocations per 512-sample block, or approximately 48,000 arrays per second
  at 48 kHz. Active grains are now counted in the existing fixed pool loop with
  zero per-sample array allocations.
- The chord bank was replaced with the 16 harmonies in the official manual.
  Where the manual names an interval but does not publish a four-voice voicing,
  the app duplicates the interval across its four grain voices.
- Voice selection now recenters the complete chord around the selected note.
  For example, selecting the second voice of a minor seventh yields
  `[-3, 0, 4, 7]`, preserving the chord while that voice tracks the input.
- All seven CV ports now declare the documented 0-5 V contract.

### Hit-mode scheduling remediation

- The previous FRZ, SYNC, and TRIG branches all spawned the same simultaneous
  grain burst on a rising Hit edge, leaving normal FRZ/SYNC wet output silent.
- FRZ and SYNC now run a continuous overlap scheduler. The target active-grain
  count is implemented as `grain length / count` firing intervals, while Count
  0 remains silent.
- FRZ holds the stereo capture buffer under a high Hit gate but continues
  scheduling grains from the held material. Releasing Hit resumes capture.
- SYNC measures successive Hit rising edges and applies their period as a
  bounded scalar around a 500 ms reference to both grain window length and
  firing interval. It deliberately does not hard-align grain starts to clock
  edges, matching the official note that SYNC follows tempo but is not locked
  to the grid. Holding Hit for two seconds clears the learned period.
- TRIG alone remains edge-fired and emits a bounded burst, preserving precise
  trigger-driven playback.
- Exact firmware scaling is unpublished. The 0.125x..8x period scalar is an
  explicit utility approximation chosen to remain musical and bounded.

### Validation

- Focused tests distinguish all three modes, clock-scaling math, freeze/release
  capture behavior, chord/Voice mapping, all CV contracts, mono normalization,
  continuous rails, reset, finite buffers, and per-sample allocation safety.
- The strict 44.1/48/96 kHz by 128/512-sample matrix completed all 19 scenarios
  with finite output, stable buffer identities, no voltage flags, peaks at or
  below 5 V, and a worst observed advisory runtime of 925.1 microseconds/block.
- **Status**: complete for the documented inspired-by model. Exact proprietary
  firmware voicings and clock-scalar curves remain declared approximations.

### Primary sources added

- [Granulita Versio manual](https://manuals.noiseengineering.us/gv/) - Noise
  Engineering, updated 2026-07-13, accessed 2026-07-30. Supports voltage
  contracts, Hit threshold, chord order, Voice semantics, grain ranges,
  direction modes, and distinct FRZ/SYNC/TRIG behavior.
- [Granulita Versio product page](https://noiseengineering.us/products/granulita-versio/)
  - Noise Engineering, accessed 2026-07-30. Cross-checks the 16 harmonies,
  stereo platform, complete CV control, and mode descriptions.
