# Kick Drum Synthesizer (kick)

## Hardware Reference
- **Based on**: [2hp Kick](https://www.twohp.com/modules/p/kick)
- **Classic Reference**: Roland TR-808 Bass Drum
- **ModularGrid**: [2hp Kick](https://www.modulargrid.net/e/2hp-kick)

## Specifications

### Features
- Sine oscillator with pitch envelope sweep
- Exponential amplitude envelope
- Soft clipping for harmonic content
- 1V/Oct pitch tracking
- CV modulation over all parameters

### Controls
- **Pitch**: Base frequency (30Hz - 150Hz)
- **Decay**: Envelope length (20ms - 500ms)
- **Tone**: Soft clipping/distortion amount

### Inputs
- **Trigger**: Starts drum sound (≥1V rising edge)
- **Pitch CV**: 1V/Oct pitch offset
- **Decay CV**: Decay time modulation (0-5V)
- **Tone CV**: Distortion modulation (0-5V)

### Outputs
- **Out**: Audio output (±5V)

### Indicators
- **Active LED**: Shows envelope level

## TR-808 Kick Drum Theory

### Original Circuit
The 808 kick uses a **Bridged-T oscillator** - a self-damping sine wave oscillator that:
- Doesn't require a separate envelope generator
- Self-oscillates when triggered
- Creates naturally decaying sine waves
- Produces characteristic sub-bass frequencies

### Key Sound Elements
1. **Sine wave body** - Pure, round tone
2. **Pitch envelope** - Higher pitch at attack, sweeps down
3. **Amplitude envelope** - Fast attack, exponential decay
4. **Slight pitch drift** - Adds organic character

### The Pitch Envelope
The defining characteristic of 808-style kicks:
- Initial pitch 2-4× higher than sustain pitch
- Fast decay (5-100ms) to base frequency
- Creates the percussive "punch" and "thump"
- Higher pitch sweep = more "zappy" attack
- Lower pitch sweep = mellow, droning kick

### Typical Frequencies
| Component | Range |
|-----------|-------|
| Attack pitch | 60-300 Hz |
| Sustain pitch | 30-80 Hz |
| 808 reference | 56 Hz (low A) |

## DSP Implementation

### Oscillator Phase Reset on Trigger

**Critical**: The oscillator phase MUST be reset to 0 on each trigger for consistent attack transients.

Without phase reset, the sine oscillator continues from wherever it was, causing:
- Random phase at attack = inconsistent high-frequency transients
- Some hits have bright "spike" in spectrogram, others don't
- Perceived volume inconsistency

From [Perfect Circuit - Kick Drum Synthesis](https://www.perfectcircuit.com/signal/kick-drum-synthesis):
> "When using a free-running oscillator, its phase is inconsistent. This can not only lead to annoying clicks and pops but can also lead to inconsistency in the perceived volume of the sub kick."
> "The solution is to sync the phase when the gate is high... Every time a gate-on is received, the oscillator's phase is reset to 0°."

```javascript
// On trigger - ALWAYS reset phase
if (trig >= 1 && lastTrig < 1) {
    phase = 0;  // Reset phase for consistent attack
    ampEnv = 1;
    pitchEnv = 1;
}
```

### Dual Envelope System
```javascript
// On trigger
phase = 0;       // Reset oscillator phase
ampEnv = 1;      // Start amplitude envelope at max
pitchEnv = 1;    // Start pitch envelope at max

// Decay rates (exponential)
const ampDecayMs = 20 + decayParam * 480;    // 20-500ms
const pitchDecayMs = 5 + totalDecay * 95;     // 5-100ms (faster)

ampDecayRate = Math.exp(-4.5 / ampDecaySamples);
pitchDecayRate = Math.exp(-4.5 / pitchDecaySamples);
```

### Frequency Calculation
```javascript
// Base frequency from knob (30-150Hz)
const baseFreq = 30 + pitchKnob * 120;

// Apply 1V/Oct from CV
const freqWithCV = baseFreq * Math.pow(2, pitchCV);

// Apply pitch envelope (sweeps from +2 octaves down to base)
const pitchSweepMult = 1 + pitchEnv * 2;  // 1x to 3x
const freq = freqWithCV * pitchSweepMult;
```

### Sine Oscillator
```javascript
// Phase accumulator
phase += (freq / sampleRate) * Math.PI * 2;
if (phase > Math.PI * 2) phase -= Math.PI * 2;

let sample = Math.sin(phase);
```

### Tone/Distortion
Soft clipping using tanh for warmth:
```javascript
if (toneAmount > 0) {
    const drive = 1 + toneAmount * 4;  // 1x to 5x
    sample = Math.tanh(sample * drive) / Math.tanh(drive);
}
```

### Final Output
```javascript
sample *= ampEnv;           // Apply amplitude envelope
out[i] = sample * 5;        // Scale to ±5V

// Decay envelopes
ampEnv *= ampDecayRate;
pitchEnv *= pitchDecayRate;
```

## Classic 808 Kick Parameters

### Sweet Spots
| Sound | Pitch | Decay | Tone |
|-------|-------|-------|------|
| Classic 808 | 0.2-0.3 | 0.5-0.7 | 0.0-0.2 |
| Trap sub | 0.1-0.2 | 0.7-1.0 | 0.0 |
| Punchy kick | 0.4-0.5 | 0.3-0.4 | 0.3-0.5 |
| Distorted | 0.3 | 0.5 | 0.7-1.0 |

## DSP References
- [Perfect Circuit: Kick Drum Synthesis](https://www.perfectcircuit.com/signal/kick-drum-synthesis) - Eurorack approach
- [N8 Synthesizers: DIY 808 Kick](https://www.n8synth.co.uk/diy-eurorack/eurorack-808-kick/) - Circuit analysis
- [MusicRadar: Analogue Kick Synthesis](https://www.musicradar.com/how-to/make-analogue-style-kick)
- [Roland TR-808 Wikipedia](https://en.wikipedia.org/wiki/Roland_TR-808) - Historical reference

## Hardware References
- [2hp Kick Product Page](https://www.twohp.com/modules/p/kick)
- [Baratatronix: 808 Tom Synthesis](https://www.baratatronix.com/blog/808-tom-synthesis) - Related circuit

## Potential Improvements
- Add click/transient generator
- Implement analog waveshaping options
- Add sub-oscillator for extended low-end
- Velocity sensitivity
- Multiple envelope modes (linear, exponential, logarithmic)

## Sources
- [2hp Kick](https://www.twohp.com/modules/p/kick)
- [ModularGrid - 2hp Kick](https://www.modulargrid.net/e/2hp-kick)
- [TR-808 Service Manual](https://www.synthxl.com/wp-content/uploads/2018/04/Roland-TR-808-Service-Manual.pdf)
