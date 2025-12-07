# Anti-Aliasing Techniques for Digital Oscillators

## The Aliasing Problem

### What is Aliasing?
When sampling a continuous signal digitally, frequencies above the Nyquist limit (half the sample rate) fold back into the audible spectrum. For a 44.1kHz sample rate:
- Nyquist limit: 22,050 Hz
- A 30,000 Hz tone aliases to 14,100 Hz (44100 - 30000)

### Why Oscillators Alias
Classic analog waveforms contain infinite harmonics:
- **Sawtooth**: All harmonics (1×, 2×, 3×, 4×... fundamental)
- **Square**: Odd harmonics only (1×, 3×, 5×, 7×...)
- **Triangle**: Odd harmonics, rapidly decreasing amplitude

At higher pitches, these harmonics exceed Nyquist and fold back as audible artifacts.

### Audible Symptoms
- Metallic, harsh sound quality
- Inharmonic frequencies (out of tune)
- Pitch-dependent timbre changes
- "Zipper" noise during pitch bends

## Anti-Aliasing Methods

### 1. Naive (No Anti-Aliasing)
```javascript
// Direct waveform generation
const saw = 2 * phase - 1;
const square = phase < 0.5 ? 1 : -1;
```
- **Pros**: Simple, fast
- **Cons**: Severe aliasing at high frequencies
- **Use**: Only for LFO/sub-audio rates

### 2. Oversampling
Generate at higher sample rate, then lowpass filter and downsample:
```javascript
const oversample = 4;
const internalRate = sampleRate * oversample;

// Generate at high rate
for (let i = 0; i < oversample; i++) {
    buffer[i] = generateSample(phase);
    phase += freq / internalRate;
}

// Lowpass filter
output = lowpassFilter(buffer);

// Downsample (take every Nth sample)
return buffer[0];
```
- **Pros**: High quality, straightforward
- **Cons**: CPU intensive (4× = 4× processing)
- **Use**: When CPU is available, for best quality

### 3. Wavetable Synthesis
Pre-compute band-limited versions of waveforms:
```javascript
// Multiple tables for different pitch ranges
const tables = [
    computeWavetable(maxHarmonics),      // Low octave
    computeWavetable(maxHarmonics / 2),  // Mid octave
    computeWavetable(maxHarmonics / 4),  // High octave
    // ...
];

// Select table based on frequency
const tableIndex = Math.floor(Math.log2(freq / baseFreq));
return interpolateTable(tables[tableIndex], phase);
```
- **Pros**: Very efficient at runtime
- **Cons**: Memory usage, complex setup, interpolation artifacts
- **Use**: Traditional sample-based synthesizers

### 4. PolyBLEP (Polynomial Band-Limited Step)
Apply polynomial correction near discontinuities:
```javascript
function polyBlep(t, dt) {
    if (t < dt) {
        const x = t / dt;
        return x + x - x * x - 1;
    } else if (t > 1 - dt) {
        const x = (t - 1) / dt;
        return x * x + x + x + 1;
    }
    return 0;
}

// Apply to sawtooth (one discontinuity per period)
let saw = 2 * phase - 1;
saw -= polyBlep(phase, phaseIncrement);

// Apply to square (two discontinuities per period)
let square = phase < duty ? 1 : -1;
square += polyBlep(phase, phaseIncrement);
square -= polyBlep((phase + 1 - duty) % 1, phaseIncrement);
```
- **Pros**: Low CPU, good quality, easy to implement
- **Cons**: Slightly dulled high frequencies vs minBLEP
- **Use**: Real-time oscillators (our VCO uses this)

### 5. minBLEP (Minimum-Phase Band-Limited Step)
Pre-compute optimal BLEP residual using FFT:
```javascript
// Pre-computation
const minBlepTable = computeMinBlep(tableSize);

// At discontinuity, add windowed sinc
function addBlep(discontinuityPosition) {
    for (let i = 0; i < blepLength; i++) {
        const tablePos = fractionalPosition * tableSize;
        output[i] += minBlepTable[tablePos] * discontinuityMagnitude;
    }
}
```
- **Pros**: Excellent quality
- **Cons**: More CPU, requires pre-computation
- **Use**: High-quality software synthesizers

### 6. DPW (Differentiated Parabolic Wave)
Integrate then differentiate a band-limited primitive:
```javascript
// Trivial sawtooth -> parabola (integration)
const parabola = phase * phase;

// Differentiate
const dpw = (parabola - lastParabola) * sampleRate / (4 * freq);
lastParabola = parabola;
```
- **Pros**: Simple math, low CPU
- **Cons**: Unstable with fast frequency changes
- **Use**: Static-pitch sounds

## Method Comparison

| Method | Quality | CPU | Complexity | Real-time Suitable |
|--------|---------|-----|------------|-------------------|
| Naive | Poor | Low | Simple | No (except LFO) |
| 4× Oversample | Excellent | High | Medium | Yes |
| Wavetable | Good | Low | High (setup) | Yes |
| PolyBLEP | Good | Low | Low | Yes ✓ |
| minBLEP | Excellent | Medium | High | Yes |
| DPW | Good | Low | Low | Yes |

## Our Implementation

The VCO module uses **PolyBLEP** for sawtooth and square waves:
- Efficient for real-time modulation
- Good quality at typical audio rates
- No pre-computation needed
- Triangle wave needs no anti-aliasing (continuous derivative)

## Key References

### Academic Papers
- [Välimäki, V. & Huovilainen, A. (2006) "Antialiasing Oscillators in Subtractive Synthesis"](https://ieeexplore.ieee.org/document/4117934)
- [Lane, A. et al. (2002) "Differenced Polynomial Wave"](https://www.dafx.de/paper-archive/)

### Tutorials
- [Martin Finke: PolyBLEP Oscillator](https://www.martin-finke.de/articles/audio-plugins-018-polyblep-oscillator/)
- [KVR: PolyBLEP Discussion](https://www.kvraudio.com/forum/viewtopic.php?t=375517)

### Books
- DAFX: Digital Audio Effects (Zölzer, 2011)
- Physical Audio Signal Processing (J.O. Smith, online)

## Related Topics
- [Oscillators](oscillators.md) - Waveform generation
- [Filters](filters.md) - Lowpass for oversampling

## Sources
- [IEEE: Antialiasing Oscillators](https://ieeexplore.ieee.org/document/4117934)
- [CCRMA: Bandlimited Synthesis](https://ccrma.stanford.edu/~jos/pasp/Bandlimited_Synthesis.html)
- [MusicDSP: Anti-aliasing](https://www.musicdsp.org/en/latest/Synthesis/index.html)
