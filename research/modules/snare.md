# Snare Drum Synthesizer (snare)

## Hardware Reference
- **Based on**: [2hp Snare](https://www.twohp.com/modules/p/snare)
- **Classic Reference**: Analog snare drums (TR-808, TR-909)
- **ModularGrid**: [2hp Snare](https://www.modulargrid.net/e/2hp-snare)

## Specifications

### Features
- Triangle oscillator body + filtered noise
- Independent body and noise envelopes
- Snap control for snare wire intensity
- 1V/Oct pitch tracking
- CV modulation over all parameters

### Controls
- **Snap**: Noise/attack intensity (0-1), controls snare wire amount
- **Decay**: Overall envelope length (30-300ms body, 10-150ms noise)
- **Pitch**: Body oscillator frequency (100Hz - 400Hz)

### Inputs
- **Trigger**: Starts drum sound (≥1V rising edge)
- **Pitch CV**: 1V/Oct pitch offset
- **Decay CV**: Decay time modulation (0-5V)
- **Snap CV**: Snare intensity modulation (0-5V)

### Outputs
- **Out**: Audio output (±5V)

### Indicators
- **Active LED**: Shows envelope level

## Snare Drum Synthesis Theory

### Acoustic Snare Anatomy
A real snare drum produces sound from two sources:
1. **Drum head vibration** - Tonal component (~150-400Hz)
2. **Snare wires** - Noisy rattling against bottom head

### Synthesis Architecture
```
             ┌──────────┐
Trigger ────►│ Body Env │──►┌─────────┐
             └──────────┘   │         │
                            │  Mixer  ├───► Output
             ┌───────────┐  │         │
Trigger ────►│ Noise Env │──►└─────────┘
             └───────────┘
                  │
             ┌────▼────┐
             │ HP Filt │
             └────┬────┘
                  │
             ┌────▼────┐
             │  Noise  │
             └─────────┘
```

### Body Oscillator
- **Triangle wave** preferred over sine for slight harmonic content
- Frequency range: 100-400Hz (typically ~200Hz)
- Fast attack, medium decay envelope

### Snare Wires (Noise)
- **White noise** filtered through highpass
- Faster decay than body (creates "crack" before "thump")
- HPF removes low frequencies, emphasizes high-frequency rattle
- Mix ratio controlled by Snap parameter

## DSP Implementation

### Dual Envelope System
```javascript
// On trigger
ampEnv = 1;     // Body envelope
noiseEnv = 1;   // Noise envelope (faster decay)

// Body decay: 30-300ms
const ampDecayMs = 30 + decayParam * 270;
ampDecayRate = Math.exp(-4.5 / ampDecaySamples);

// Noise decay: 10-150ms (faster for snap/crack)
const noiseDecayMs = 10 + decayParam * 140;
noiseDecayRate = Math.exp(-4.5 / noiseDecaySamples);
```

### Triangle Oscillator
```javascript
// Frequency from knob + CV (100-400Hz, 1V/Oct)
const baseFreq = 100 + pitchParam * 300;
const freq = baseFreq * Math.pow(2, pitchCV);

// Phase accumulator
phase += freq / sampleRate;
if (phase > 1) phase -= 1;

// Triangle wave
const triSample = 4 * Math.abs(phase - 0.5) - 1;
```

### Noise Generation with Highpass
```javascript
// Linear congruential generator for white noise
noiseState = noiseState * 1664525 + 1013904223;
const noise = ((noiseState >>> 16) / 32768 - 1);

// Simple highpass filter (removes low end for snare character)
const filteredNoise = noise - noiseFilterState;
noiseFilterState = noise * (1 - hpCoeff);  // hpCoeff ≈ 0.85
```

### Mixing Body and Noise
```javascript
// Body with envelope (reduced by snap)
const body = triSample * ampEnv * (1 - snapAmount * 0.5);

// Noise with faster envelope and snap amount
const snareNoise = filteredNoise * noiseEnv * snapAmount;

// Final mix with soft clipping
let sample = body + snareNoise * 1.5;
sample = Math.tanh(sample * 1.2);
out[i] = sample * 5;
```

## Classic Snare Parameters

### Sweet Spots
| Sound | Snap | Decay | Pitch |
|-------|------|-------|-------|
| 808 Snare | 0.3 | 0.4 | 0.3 |
| 909 Snare | 0.5 | 0.5 | 0.5 |
| Tight crack | 0.8 | 0.2 | 0.6 |
| Loose thump | 0.2 | 0.7 | 0.3 |
| Rimshot | 0.9 | 0.1 | 0.8 |

### Envelope Recommendations
- **Attack**: Near-instantaneous (0ms)
- **Sustain**: None (percussive sounds don't sustain)
- **Body decay**: 200-300ms for authentic character
- **Noise decay**: 50-150ms (shorter = snappier)

## DSP References
- [Sound On Sound: Practical Snare Synthesis](https://www.soundonsound.com/techniques/practical-snare-drum-synthesis)
- [Sound On Sound: Synthesizing the Snare](https://www.soundonsound.com/techniques/synthesizing-drums-snare-drum)
- [McGill Percussion Synthesis](https://cim.mcgill.ca/~clark/nordmodularbook/nm_percussion.html)
- [CCRMA Percussion](https://ccrma.stanford.edu/~sdill/220A-project/drums.html)

## Hardware References
- [2hp Snare Product Page](https://www.twohp.com/modules/p/snare)
- [Corsynth DR-02 Snare](https://corsynth.com/home/modules/dr02)

## Potential Improvements
- Add resonant body mode (tuned bandpass)
- Multiple noise color options (white, pink, filtered)
- Implement ring modulation for metallic overtones
- Add velocity control over snap/decay
- Separate outputs for body and noise

## Sources
- [2hp Snare](https://www.twohp.com/modules/p/snare)
- [ModularGrid - 2hp Snare](https://www.modulargrid.net/e/2hp-snare)
- [TR-808 Service Manual](https://www.synthxl.com/wp-content/uploads/2018/04/Roland-TR-808-Service-Manual.pdf)
