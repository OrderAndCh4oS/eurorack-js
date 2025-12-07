# Digital Oscillator Techniques

## Oscillator Fundamentals

### Phase Accumulator
The core of most digital oscillators:
```javascript
// Normalized phase [0, 1)
phase += frequency / sampleRate;
if (phase >= 1) phase -= 1;
```

### Frequency to Phase Increment
```javascript
const phaseIncrement = frequency / sampleRate;
// Example: 440Hz at 44100Hz = 0.00998 per sample
```

### V/Oct (Volt per Octave)
Standard pitch CV:
```javascript
// 0V = base frequency, +1V = 1 octave up
const frequency = baseFreq * Math.pow(2, vOctCV);

// With fine tune (semitones)
const frequency = baseFreq * Math.pow(2, vOctCV) * Math.pow(2, fineSemitones/12);
```

## Basic Waveforms

### Sine Wave
Pure tone, no harmonics:
```javascript
output = Math.sin(2 * Math.PI * phase);
// Or using lookup table for efficiency
output = sinTable[Math.floor(phase * tableSize)];
```

### Sawtooth/Ramp
All harmonics, bright sound:
```javascript
// Naive (aliases at high frequencies)
output = 2 * phase - 1;  // -1 to +1

// Anti-aliased with PolyBLEP
output = 2 * phase - 1;
output -= polyBlep(phase, phaseInc);
```

### Square/Pulse
Odd harmonics, hollow sound:
```javascript
// Naive
output = phase < duty ? 1 : -1;

// Anti-aliased
output = phase < duty ? 1 : -1;
output += polyBlep(phase, phaseInc);
output -= polyBlep((phase + 1 - duty) % 1, phaseInc);
```

### Triangle
Odd harmonics, rapidly decreasing, mellow sound:
```javascript
// No anti-aliasing needed (continuous derivative)
output = 4 * Math.abs(phase - 0.5) - 1;  // -1 to +1

// Alternative formulation
output = 2 * Math.abs(2 * phase - 1) - 1;
```

## Advanced Techniques

### Pulse Width Modulation (PWM)
Variable duty cycle for timbral control:
```javascript
// duty: 0.05 to 0.95 (avoid extremes)
const duty = 0.05 + pwmCV * 0.9;
output = phase < duty ? 1 : -1;
```

### Hard Sync
Reset slave oscillator from master:
```javascript
// On master rising edge
if (masterPhase crossed zero && lastMasterPhase < 0) {
    slavePhase = 0;  // Reset slave
}
```
Creates harmonic-rich timbres that track master pitch.

### Soft Sync
Gently pull slave toward master phase:
```javascript
if (masterPhase crossed zero) {
    // Only sync if slave is close to its own reset
    if (slavePhase > 0.9 || slavePhase < 0.1) {
        slavePhase = 0;
    }
}
```

### FM (Frequency Modulation)
Modulate frequency with another oscillator:
```javascript
// Linear FM
frequency = baseFreq + modulator * fmDepth;

// Through-zero FM (bipolar modulator)
frequency = baseFreq + modulator * fmIndex * baseFreq;
```

### Ring Modulation
Multiply two signals:
```javascript
output = carrier * modulator;
// Creates sum and difference frequencies
```

### Waveform Morphing
Crossfade between waveforms:
```javascript
// Linear crossfade
output = waveA * (1 - morph) + waveB * morph;

// 4-way morph (like wavetable position)
const idx = morph * 3;
const frac = idx - Math.floor(idx);
const a = waves[Math.floor(idx)];
const b = waves[Math.floor(idx) + 1];
output = a * (1 - frac) + b * frac;
```

## Analog Modeling

### CEM3340 Architecture
Classic VCO chip features:
- Exponential converter (V/Oct tracking)
- Sawtooth core (integrating comparator)
- Triangle from sawtooth (absolute value shaping)
- Pulse from comparator
- Temperature compensation

### Waveshaping
Transform one waveform into another:
```javascript
// Triangle to sine approximation
output = Math.sin(input * Math.PI / 2);

// Soft clipping (warm saturation)
output = Math.tanh(input * drive);
```

### DC Offset Removal
Prevent waveform drift:
```javascript
// One-pole highpass
const dcBlockCoeff = 0.995;
output = input - dcState;
dcState = input - output * dcBlockCoeff;
```

## Multi-Oscillator Techniques

### Detuning
Slight pitch differences for thickness:
```javascript
const osc1 = generate(freq);
const osc2 = generate(freq * 1.003);  // +5 cents
const osc3 = generate(freq * 0.997);  // -5 cents
output = (osc1 + osc2 + osc3) / 3;
```

### Unison/Supersaw
Multiple detuned saws (classic trance sound):
```javascript
const detunes = [-0.1, -0.05, 0, 0.05, 0.1];  // cents spread
for (const detune of detunes) {
    output += saw(freq * Math.pow(2, detune/1200));
}
output /= detunes.length;
```

### Sub-Oscillator
One octave below main:
```javascript
const subPhase = phase / 2;  // Half frequency
subOutput = subPhase < 0.5 ? 1 : -1;  // Square sub
```

## Efficiency Considerations

### Lookup Tables
Pre-compute expensive functions:
```javascript
const sinTable = new Float32Array(4096);
for (let i = 0; i < 4096; i++) {
    sinTable[i] = Math.sin(2 * Math.PI * i / 4096);
}

// Runtime lookup with interpolation
const idx = phase * 4096;
const i0 = Math.floor(idx);
const frac = idx - i0;
output = sinTable[i0] * (1-frac) + sinTable[(i0+1) % 4096] * frac;
```

### SIMD Optimization
Process multiple samples in parallel (advanced):
```javascript
// Conceptual - actual SIMD depends on platform
for (let i = 0; i < bufferSize; i += 4) {
    phases[i:i+4] += phaseInc;
    outputs[i:i+4] = computeWaveform(phases[i:i+4]);
}
```

## Key References

### Books
- "Physical Audio Signal Processing" - J.O. Smith (free online)
- "DAFX: Digital Audio Effects" - Zölzer

### Papers
- [Antialiasing Oscillators in Subtractive Synthesis](https://ieeexplore.ieee.org/document/4117934)
- [Bandlimited Synthesis of Classic Waveforms](https://ccrma.stanford.edu/~stilti/papers/blit.pdf)

### Code
- [STK Oscillators](https://ccrma.stanford.edu/software/stk/)
- [MusicDSP Synthesis](https://www.musicdsp.org/en/latest/Synthesis/index.html)

## Related Topics
- [Anti-Aliasing](anti-aliasing.md) - Preventing aliasing
- [VCO Module](../modules/vco.md) - Our implementation

## Sources
- [CCRMA: Bandlimited Synthesis](https://ccrma.stanford.edu/~jos/pasp/Bandlimited_Synthesis.html)
- [Electric Druid: CEM3340](https://electricdruid.net/cem3340-vco-voltage-controlled-oscillator-designs/)
- [MusicDSP.org](https://www.musicdsp.org/)
