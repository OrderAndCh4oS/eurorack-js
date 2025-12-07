# Stereo Reverb (verb)

## Hardware Reference
- **Based on**: [2hp Verb](https://www.twohp.com/modules/p/verb)
- **Algorithm**: Freeverb (Schroeder-Moorer reverberator)
- **ModularGrid**: [2hp Verb](https://www.modulargrid.net/e/2hp-verb)

## Specifications

### Features
- Freeverb-based stereo reverb
- 8 parallel comb filters + 4 series allpass filters per channel
- Adjustable decay time and high-frequency damping
- Mono-to-stereo normalization
- Stereo spread via delay time offset

### Controls
- **Time**: Reverb decay length (0.7 - 0.98 feedback coefficient)
- **Damp**: High-frequency damping (0 = bright, 1 = dark)
- **Mix**: Dry/wet balance (0 = dry, 1 = wet)

### Inputs
- **Audio L**: Left audio input (±5V)
- **Audio R**: Right audio input (normalizes from L if unplugged)
- **Mix CV**: Mix modulation (±5V = ±0.5 range)

### Outputs
- **Out L**: Left processed output (±5V)
- **Out R**: Right processed output (±5V)

### Indicators
- **Active LED**: Shows output level

## Freeverb Algorithm Theory

### History
Freeverb was developed by "Jezar at Dreampoint" and became the standard open-source reverb algorithm. It's based on the **Schroeder-Moorer** reverberator architecture from the 1960s-70s.

### Architecture
```
                    ┌──────────────┐
                    │   Comb 1     │───┐
                    ├──────────────┤   │
                    │   Comb 2     │───┤
                    ├──────────────┤   │
Input ─────────────►│   Comb 3     │───┼───► Sum ───► Allpass 1
                    ├──────────────┤   │              │
                    │   Comb 4     │───┤              ▼
                    ├──────────────┤   │         Allpass 2
                    │   Comb 5     │───┤              │
                    ├──────────────┤   │              ▼
                    │   Comb 6     │───┤         Allpass 3
                    ├──────────────┤   │              │
                    │   Comb 7     │───┤              ▼
                    └──────────────┘   │         Allpass 4
                    │   Comb 8     │───┘              │
                    └──────────────┘                  ▼
                                                   Output
```

### Comb Filter Delay Times (44.1kHz)
| Filter | Left (samples) | Right (samples) |
|--------|----------------|-----------------|
| Comb 1 | 1116 | 1116 + 23 |
| Comb 2 | 1188 | 1188 + 23 |
| Comb 3 | 1277 | 1277 + 23 |
| Comb 4 | 1356 | 1356 + 23 |
| Comb 5 | 1422 | 1422 + 23 |
| Comb 6 | 1491 | 1491 + 23 |
| Comb 7 | 1557 | 1557 + 23 |
| Comb 8 | 1617 | 1617 + 23 |

### Allpass Delay Times (44.1kHz)
| Filter | Left (samples) | Right (samples) |
|--------|----------------|-----------------|
| AP 1 | 556 | 556 + 23 |
| AP 2 | 441 | 441 + 23 |
| AP 3 | 341 | 341 + 23 |
| AP 4 | 225 | 225 + 23 |

### Stereo Spread
Right channel delays are offset by 23 samples, creating subtle decorrelation that sounds like a wider stereo field.

## DSP Implementation

### Comb Filter with Damping
Each comb filter has an embedded lowpass in the feedback loop:

```javascript
// Read output from delay buffer
const output = buffer[index];

// Apply damping (one-pole lowpass on feedback)
filterStore = output * damp2 + filterStore * damp1;
// damp1 = damp * 0.4
// damp2 = 1 - damp1

// Write to buffer with feedback
buffer[index] = input + filterStore * feedback;

// Advance circular buffer
index = (index + 1) % bufferLength;
```

### Allpass Filter
Freeverb's "allpass" is actually a simplified version:

```javascript
// Read from buffer
const bufOut = buffer[index];

// Write: input + scaled buffer output
buffer[index] = input + bufOut * 0.5;

// Output: buffer output minus input
output = bufOut - input;

// Advance
index = (index + 1) % bufferLength;
```

### Parameter Mapping
```javascript
// Time (0-1) → feedback coefficient (0.7-0.98)
const feedback = 0.7 + time * 0.28;

// Damp (0-1) → damping coefficients
const damp1 = damp * 0.4;
const damp2 = 1 - damp1;
```

### Sample Rate Scaling
```javascript
const rateScale = sampleRate / 44100;
const scaledDelay = Math.floor(baseDelay * rateScale);
```

## Reverb Parameters

### Sweet Spots
| Sound | Time | Damp | Mix |
|-------|------|------|-----|
| Small Room | 0.2-0.3 | 0.6 | 0.3 |
| Medium Hall | 0.5-0.6 | 0.4 | 0.4 |
| Large Hall | 0.7-0.8 | 0.3 | 0.5 |
| Cathedral | 0.9+ | 0.2 | 0.6 |
| Plate | 0.6 | 0.7 | 0.5 |

### Damping Character
- **Low damp (bright)**: Air, shimmer, unnatural
- **Medium damp**: Natural room absorption
- **High damp (dark)**: Warm, vintage, padded room

## DSP References
- [DSPRelated: Freeverb](https://www.dsprelated.com/freebooks/pasp/Freeverb.html) - Julius O. Smith
- [Valhalla DSP: Schroeder Reverbs](https://valhalladsp.com/2009/05/30/schroeder-reverbs-the-forgotten-algorithm/)
- [Freeverb3 Tips](https://freeverb3-vst.sourceforge.io/tips/reverb.shtml)
- [NTNU gDSP: Freeverb](http://gdsp.hf.ntnu.no/lessons/6/39/)
- [Artificial Reverberation](https://www.dsprelated.com/freebooks/pasp/Artificial_Reverberation.html)

## Hardware References
- [2hp Verb Product Page](https://www.twohp.com/modules/p/verb)
- [Original Freeverb Source](https://github.com/sinshu/freeverb)

## Alternative Algorithms
| Algorithm | Character | Complexity |
|-----------|-----------|------------|
| Freeverb | Classic, clean | Low |
| Dattorro | Lush, modulated | Medium |
| FDN | Versatile, dense | Medium-High |
| Convolution | Realistic | High |
| Plate | Bright, diffuse | Medium |

## Potential Improvements
- Add pre-delay control
- Implement modulated delay lines (shimmer)
- Add size/room parameter
- Implement freeze function
- Add early reflections section
- Implement different reverb algorithms (Dattorro, FDN)

## Sources
- [2hp Verb](https://www.twohp.com/modules/p/verb)
- [ModularGrid - 2hp Verb](https://www.modulargrid.net/e/2hp-verb)
- [Schroeder, M. R. (1962) "Natural Sounding Artificial Reverberation"](https://www.aes.org/e-lib/browse.cfm?elib=343)
