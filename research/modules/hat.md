# Hi-Hat Synthesizer (hat)

## Hardware Reference
- **Based on**: [2hp Hat](https://www.twohp.com/modules/p/hat)
- **Classic Reference**: Roland TR-808 Hi-Hat/Cymbal
- **ModularGrid**: [2hp Hat](https://www.modulargrid.net/e/2hp-hat)

## Specifications

### Features
- 6 square wave oscillators at inharmonic ratios
- Bandpass filtering for metallic character
- Separate open and closed hat triggers
- Closed hat chokes open hat
- Sizzle control for frequency tuning
- Blend control for metallic vs noise mix

### Controls
- **Decay**: Envelope length (Open: 100-800ms, Closed: 10-80ms)
- **Sizzle**: Oscillator/filter frequency multiplier (0.5x - 2x)
- **Blend**: Mix between metallic oscillators and noise

### Inputs
- **Open Trigger**: Starts open hi-hat (long decay)
- **Closed Trigger**: Starts closed hi-hat (short decay, chokes open)

### Outputs
- **Out**: Audio output (±5V)

### Indicators
- **Active LED**: Shows envelope level

## TR-808 Hi-Hat Theory

### Oscillator Phase: Free-Running (NOT Reset)

**Critical difference from kick/snare**: Hi-hat oscillators should be FREE-RUNNING, not phase-reset on trigger.

The 808's 6 square wave oscillators run continuously. The trigger only opens the VCA/envelope - it does NOT reset oscillator phases. This is intentional:

From [Mod Wiggler - Synthesizing 808 Hi-Hats](https://www.modwiggler.com/forum/viewtopic.php?t=120280):
> "The high hat sample is constantly playing in loop and that when the sound is triggered an envelope is applied to the looped sample. Therefore, the hi hat sounds different each time it is triggered."
> "Because the oscillators are free-running, each triggered hit sounds slightly different."

**Why free-running works for hi-hats but not kicks:**

| Aspect | Kick/Snare | Hi-Hat |
|--------|------------|--------|
| Oscillators | 1 (tonal) | 6 (inharmonic noise) |
| Goal | Identical hits | Natural variation |
| Phase reset | Yes | No |
| Reasoning | Consistent punch | Metallic shimmer varies |

The 6 inharmonic oscillators already create complex, noise-like timbres. Capturing them at random phase relationships adds organic variation that makes the hi-hat sound more natural and less "machine-like."

```javascript
// On trigger - do NOT reset oscillator phases
if (trigOpen >= 1 && lastTrigOpen < 1) {
    // oscPhases NOT reset - intentionally free-running
    ampEnv = 1;
    isOpen = true;
}
```

### Why 6 Square Wave Oscillators?
The metallic, shimmering sound of cymbals comes from **inharmonic spectra** - frequencies that are not simple integer multiples. The 808 achieves this by mixing six square waves at carefully chosen non-harmonic frequencies.

### Original 808 Frequencies
| Oscillator | Frequency | Note Equivalent |
|------------|-----------|-----------------|
| 1 | 800 Hz | G5 +35¢ |
| 2 | 540 Hz | C#5 -45¢ |
| 3 | 522.7 Hz | C5 -2¢ |
| 4 | 369.6 Hz | F#4 -2¢ |
| 5 | 304.4 Hz | D#4 -38¢ |
| 6 | 205.3 Hz | G#3 -20¢ |

### Our Implementation Frequencies
Simplified non-harmonic ratios:
```javascript
const baseFreqs = [205, 295, 370, 523, 620, 840];
```

### Signal Path
```
┌─────────────────────────────────────────────┐
│  6× Square Wave Oscillators                 │
│  (inharmonic frequencies)                   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌──────────────────┴──────────────────────────┐
│              Mixer + Noise                  │
│        (blend controls ratio)               │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌──────────────────┴──────────────────────────┐
│           Bandpass Filter                   │
│        (4-12kHz, sizzle tuned)             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌──────────────────┴──────────────────────────┐
│              VCA + Envelope                 │
│     (Open: 100-800ms, Closed: 10-80ms)     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
                Output
```

## DSP Implementation

### 6 Square Wave Oscillators
```javascript
// Non-harmonic base frequencies
const baseFreqs = [205, 295, 370, 523, 620, 840];

// Sizzle affects frequency multiplier
const freqMult = 0.5 + sizzleParam * 1.5;  // 0.5x to 2x

// Generate 6 oscillators
let metallic = 0;
for (let o = 0; o < 6; o++) {
    const freq = baseFreqs[o] * freqMult;
    oscPhases[o] += freq / sampleRate;
    if (oscPhases[o] > 1) oscPhases[o] -= 1;

    // Square wave
    metallic += oscPhases[o] < 0.5 ? 1 : -1;
}
metallic /= 6;  // Normalize
```

### Noise Blending
```javascript
// LCG white noise
noiseState = noiseState * 1664525 + 1013904223;
const noise = ((noiseState >>> 16) / 32768 - 1);

// Blend metallic oscillators with noise
const input = metallic * (1 - blendParam * 0.5) + noise * blendParam;
```

### Bandpass Filter
```javascript
// Sizzle-tuned bandpass (4kHz to 12kHz)
const bpFreq = 4000 + sizzleParam * 8000;
const bpQ = 2 + sizzleParam * 4;

// Biquad coefficients
const w0 = (2 * Math.PI * bpFreq) / sampleRate;
const alpha = Math.sin(w0) / (2 * bpQ);
const b0 = alpha;
const a1 = -2 * Math.cos(w0);
const a2 = 1 - alpha;
const norm = 1 + alpha;

// Apply filter
const filtered = (b0 * input - a1 * bpState1 - a2 * bpState2) / norm;
bpState2 = bpState1;
bpState1 = filtered;
```

### Open vs Closed Envelopes
```javascript
// Open hat trigger
if (trigOpen >= 1 && lastTrigOpen < 1) {
    ampEnv = 1;
    isOpen = true;
    const decayMs = 100 + decayParam * 700;  // 100-800ms
    decayRate = Math.exp(-4.5 / decaySamples);
}

// Closed hat trigger (also chokes open)
if (trigClosed >= 1 && lastTrigClosed < 1) {
    ampEnv = 1;
    isOpen = false;
    const decayMs = 10 + decayParam * 70;    // 10-80ms
    decayRate = Math.exp(-4.5 / decaySamples);
}
```

### Choke Mechanism
When closed trigger fires, it:
1. Resets the envelope to 1
2. Sets `isOpen = false`
3. Switches to short decay rate
4. Immediately cuts off any sustaining open hat

## Classic Hi-Hat Parameters

### Sweet Spots
| Sound | Decay | Sizzle | Blend |
|-------|-------|--------|-------|
| 808 Closed | 0.2 | 0.5 | 0.3 |
| 808 Open | 0.6 | 0.5 | 0.3 |
| Bright/Fizzy | 0.4 | 0.9 | 0.6 |
| Dark/Muted | 0.3 | 0.2 | 0.2 |
| Noisy | 0.5 | 0.5 | 0.9 |

### Typical Decay Times
| Type | 808 Original | Our Range |
|------|--------------|-----------|
| Closed | ~50ms | 10-80ms |
| Open | 90-600ms | 100-800ms |

## DSP References
- [Baratatronix: 808 Cymbal & Hi-Hat](https://www.baratatronix.com/blog/cascadia-808-cymbal-hi-hat-synthesis)
- [Sound On Sound: Practical Cymbal Synthesis](https://www.soundonsound.com/techniques/practical-cymbal-synthesis)
- [Sound On Sound: Realistic Cymbals](https://www.soundonsound.com/techniques/synthesizing-realistic-cymbals)
- [McGill Percussion Synthesis](https://cim.mcgill.ca/~clark/nordmodularbook/nm_percussion.html)

## Alternative Approaches
- **FM Synthesis**: Using 2 operators instead of 6 oscillators
- **Ring Modulation**: Korg KR-55 style (4 pairs of ring-modulated squares)
- **Physical Modeling**: Simulating cymbal modes and resonances

## Potential Improvements
- Add tunable oscillator frequencies
- Implement ring modulation mode
- Add accent input for velocity
- Separate open/closed outputs
- Add cymbal/ride mode (longer decay + different frequencies)

## Sources
- [2hp Hat Product Page](https://www.twohp.com/modules/p/hat)
- [ModularGrid - 2hp Hat](https://www.modulargrid.net/e/2hp-hat)
- [TR-808 Service Manual](https://www.synthxl.com/wp-content/uploads/2018/04/Roland-TR-808-Service-Manual.pdf)
