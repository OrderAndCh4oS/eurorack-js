# Digital Filter Topologies

## Filter Basics

### Frequency Response Parameters
- **Cutoff frequency (fc)**: Point where attenuation begins
- **Slope/Order**: Steepness of rolloff (6dB/oct per pole)
- **Resonance (Q)**: Peak at cutoff frequency
- **Gain**: Overall level

### Filter Types
| Type | Response | Common Use |
|------|----------|------------|
| Lowpass (LPF) | Passes below fc | Tone control, subtractive synthesis |
| Highpass (HPF) | Passes above fc | Remove rumble, thin out sounds |
| Bandpass (BPF) | Passes around fc | Vowel sounds, wah effects |
| Notch/Band-reject | Removes around fc | Feedback suppression |
| Allpass | Passes all (phase shift only) | Reverb, phaser effects |

### Slope Characteristics
| Poles | Slope | Character |
|-------|-------|-----------|
| 1-pole | 6dB/oct | Gentle, natural |
| 2-pole | 12dB/oct | Classic synthesizer |
| 4-pole | 24dB/oct | Moog-style, aggressive |
| 8-pole | 48dB/oct | Very steep, surgical |

## Digital Filter Implementations

### 1. One-Pole (6dB/oct)
Simplest recursive filter:
```javascript
// Lowpass
const alpha = fc / (fc + sampleRate/(2*Math.PI));
y[n] = alpha * x[n] + (1 - alpha) * y[n-1];

// Or using coefficient
const g = Math.tan(Math.PI * fc / sampleRate);
const G = g / (1 + g);
y[n] = G * x[n] + (1 - G) * y[n-1];
```

### 2. Biquad (2-pole, 12dB/oct)
Versatile second-order IIR:
```javascript
// Direct Form II Transposed
const w0 = 2 * Math.PI * fc / sampleRate;
const alpha = Math.sin(w0) / (2 * Q);

// Lowpass coefficients
const b0 = (1 - Math.cos(w0)) / 2;
const b1 = 1 - Math.cos(w0);
const b2 = (1 - Math.cos(w0)) / 2;
const a0 = 1 + alpha;
const a1 = -2 * Math.cos(w0);
const a2 = 1 - alpha;

// Process sample
y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2]
     - (a1/a0)*y[n-1] - (a2/a0)*y[n-2];
```

### 3. State Variable Filter (SVF)
Simultaneous LP, BP, HP outputs:
```javascript
const f = 2 * Math.sin(Math.PI * fc / sampleRate);
const q = 1 / Q;

// Process (Chamberlin method)
lpf = lpf + f * bpf;
hpf = input - lpf - q * bpf;
bpf = f * hpf + bpf;
notch = hpf + lpf;
```

### 4. Moog Ladder (4-pole, 24dB/oct)
Classic analog synth sound - see [vcf.md](../modules/vcf.md):
```javascript
// Zero-delay feedback implementation
const g = Math.tan(Math.PI * fc / sampleRate);
const G = g / (1 + g);
const k = resonance * 4;

// 4 cascaded one-pole filters
for (let p = 0; p < 4; p++) {
    const input = p === 0 ? x - Math.tanh(feedback * k) : stage[p-1];
    const v = G * (input - delay[p]);
    stage[p] = v + delay[p];
    delay[p] = stage[p] + v;
}
output = stage[3];
```

## Implementation Approaches

### Direct Form (Naive IIR)
```javascript
y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
```
- Simple but can have numerical issues
- Delay-free loops problematic

### Bilinear Transform
Maps analog prototype to digital:
```javascript
// s-domain to z-domain
s = (2/T) * (1 - z^-1) / (1 + z^-1)
```
- Frequency warping at high frequencies
- No aliasing

### Zero-Delay Feedback (ZDF/TPT)
Modern approach for accurate analog modeling:
```javascript
// Topology-preserving transform
const g = Math.tan(Math.PI * fc / sampleRate);  // Pre-warp
// Solves implicit equations
```
- Accurate resonance behavior
- Used in our VCF implementation

## Filter Sound Character

### Classic Filter Models
| Filter | Character | Notable Use |
|--------|-----------|-------------|
| Moog Ladder | Warm, fat, musical | Minimoog, Model D |
| Korg MS-20 | Aggressive, screaming | MS-20 |
| Roland TB-303 | Squelchy, acid | 303, acid house |
| Oberheim SEM | Smooth, creamy | SEM, OB-series |
| ARP 2600 | Gritty, alive | 2600 |

### Resonance Behavior
- **Sub-oscillation**: Q > 1 but no self-oscillation
- **Self-oscillation**: Q ≈ 4 for ladder filters
- **Soft clipping**: Prevents runaway (tanh saturation)

## Parameter Modulation

### Cutoff Modulation Sources
- **Envelope (filter sweep)**: Most common
- **LFO**: Wah/wobble effects
- **Keyboard tracking**: Higher notes = higher cutoff
- **Velocity**: Harder = brighter

### Modulation Considerations
```javascript
// Exponential frequency mapping
const cutoffHz = 20 * Math.pow(1000, cutoffKnob);

// CV modulation (V/oct style)
const modulatedHz = cutoffHz * Math.pow(2, cvVolts);

// Slew limiting for smooth parameter changes
cutoffSmooth = cutoffSmooth + coeff * (cutoffTarget - cutoffSmooth);
```

## Key References

### Academic
- [Välimäki & Smith: "The Freeverb Algorithm"](https://ccrma.stanford.edu/~jos/pasp/Freeverb.html)
- [Zavalishin: "The Art of VA Filter Design"](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf)

### Code Resources
- [MoogLadders GitHub](https://github.com/ddiakopoulos/MoogLadders) - Multiple implementations
- [MusicDSP.org Filters](https://www.musicdsp.org/en/latest/Filters/index.html)

### Books
- DAFX: Digital Audio Effects
- The Art of VA Filter Design (Zavalishin)

## Related Topics
- [VCF Module](../modules/vcf.md) - Our filter implementation
- [Effects](effects.md) - Filters in effects chains

## Sources
- [Audio EQ Cookbook](https://www.w3.org/2011/audio/audio-eq-cookbook.html)
- [KVR Filter Discussion](https://www.kvraudio.com/forum/viewforum.php?f=33)
- [DAFx Paper Archive](https://dafx.de/paper-archive/)
