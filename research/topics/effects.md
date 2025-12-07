# Digital Audio Effects

## Effects Categories

### Time-Based Effects
- **Delay**: Echo, slapback, feedback delays
- **Reverb**: Room simulation, ambience
- **Chorus**: Detuning via modulated delay
- **Flanger**: Short modulated delay with feedback
- **Phaser**: Allpass filter cascade

### Dynamic Effects
- **Compression**: Reduce dynamic range
- **Limiting**: Hard ceiling on peaks
- **Gate**: Mute below threshold
- **Expander**: Increase dynamic range

### Frequency Effects
- **EQ**: Frequency shaping
- **Filter**: Lowpass, highpass, bandpass
- **Pitch Shift**: Change frequency without speed
- **Ring Modulation**: Multiply with carrier

### Distortion Effects
- **Overdrive**: Soft clipping
- **Distortion**: Hard clipping
- **Fuzz**: Extreme distortion
- **Bitcrush**: Sample rate/bit depth reduction

## Delay Effects

### Basic Delay Line
```javascript
// Circular buffer
const bufferSize = sampleRate * maxDelayTime;
const buffer = new Float32Array(bufferSize);
let writeIndex = 0;

function process(input) {
    const readIndex = (writeIndex - delaySamples + bufferSize) % bufferSize;
    const delayed = buffer[readIndex];

    buffer[writeIndex] = input + delayed * feedback;
    writeIndex = (writeIndex + 1) % bufferSize;

    return input * (1 - mix) + delayed * mix;
}
```

### Chorus/Flanger
Modulated delay creates pitch variation:
```javascript
// LFO modulates delay time
const lfoPhase += lfoFreq / sampleRate;
const modulation = Math.sin(2 * Math.PI * lfoPhase);

// Chorus: 20-50ms base, ±5ms modulation
const delayTime = 0.030 + modulation * 0.005;

// Flanger: 1-10ms base, ±5ms modulation
const delayTime = 0.005 + modulation * 0.003;
```

### Phaser
Cascade of allpass filters with modulated frequency:
```javascript
// Each allpass stage shifts phase
function allpass(input, freq) {
    const a1 = (Math.tan(Math.PI * freq / sampleRate) - 1) /
               (Math.tan(Math.PI * freq / sampleRate) + 1);
    output = a1 * input + state;
    state = input - a1 * output;
    return output;
}

// 4-8 stages, LFO modulates notch frequency
for (let stage = 0; stage < numStages; stage++) {
    signal = allpass(signal, lfoModulatedFreq);
}
output = input + signal * depth;  // Mix dry + wet
```

## Reverb Algorithms

### Schroeder Reverberator (1962)
Parallel comb filters → series allpass:
```
Input → [Comb 1]──┐
      → [Comb 2]──┼──► Sum → [AP 1] → [AP 2] → Output
      → [Comb 3]──┤
      → [Comb 4]──┘
```

### Freeverb
Enhanced Schroeder with:
- 8 comb filters (with lowpass in feedback)
- 4 allpass filters
- Stereo spread (delay offset)
- See [verb.md](../modules/verb.md)

### Dattorro Plate Reverb
More complex, lush sound:
- Pre-delay
- Input diffusers (4 allpass)
- Tank with modulated delay + diffusion
- Two parallel delay networks

### FDN (Feedback Delay Network)
Matrix-based reverb:
```javascript
// Multiple delays with feedback matrix
const newDelays = matrixMultiply(feedbackMatrix, delayOutputs);
for (let i = 0; i < numDelays; i++) {
    delays[i].write(input + newDelays[i]);
}
```

## Distortion/Saturation

### Soft Clipping (Tanh)
Smooth saturation:
```javascript
output = Math.tanh(input * drive);
// Normalize: output = Math.tanh(input * drive) / Math.tanh(drive);
```

### Hard Clipping
Aggressive distortion:
```javascript
output = Math.max(-1, Math.min(1, input * drive));
```

### Waveshaping
Custom transfer function:
```javascript
// Chebyshev polynomial for harmonics
function chebyshev(x, n) {
    // Generates nth harmonic
}

// Tube-style asymmetric clipping
output = input >= 0 ?
    Math.tanh(input * 2) :
    Math.tanh(input * 1.5);
```

### Bitcrushing
Sample rate and bit depth reduction:
```javascript
// Bit reduction
const bits = 8;
const levels = Math.pow(2, bits);
output = Math.round(input * levels) / levels;

// Sample rate reduction
if (sampleCount % decimation === 0) {
    holdValue = input;
}
output = holdValue;
```

## Modulation Effects

### Ring Modulation
Multiply signal with carrier:
```javascript
const carrier = Math.sin(2 * Math.PI * carrierFreq * t);
output = input * carrier;
// Creates sum and difference frequencies (sidebands)
```

### Tremolo
Amplitude modulation:
```javascript
const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t);
output = input * (1 - depth * (1 - lfo));
```

### Vibrato
Pitch modulation via variable delay:
```javascript
const lfo = Math.sin(2 * Math.PI * rate * t);
const delayTime = baseDelay + lfo * depth;
output = readDelayLine(delayTime);
```

## Dynamics Processing

### Compressor
Reduce loud signals:
```javascript
const threshold = -20;  // dB
const ratio = 4;        // 4:1 compression

const inputDb = 20 * Math.log10(Math.abs(input));
if (inputDb > threshold) {
    const excess = inputDb - threshold;
    const gainReduction = excess * (1 - 1/ratio);
    output = input * Math.pow(10, -gainReduction / 20);
}
```

### Envelope Follower
Track signal amplitude:
```javascript
const attackCoeff = 1 - Math.exp(-1 / (attackTime * sampleRate));
const releaseCoeff = 1 - Math.exp(-1 / (releaseTime * sampleRate));

const absInput = Math.abs(input);
if (absInput > envelope) {
    envelope += attackCoeff * (absInput - envelope);
} else {
    envelope += releaseCoeff * (absInput - envelope);
}
```

## Key References

### Books
- "DAFX: Digital Audio Effects" - Zölzer (comprehensive)
- "Physical Audio Signal Processing" - J.O. Smith (free online)

### Papers
- [Dattorro: Effect Design Part 1 & 2](https://ccrma.stanford.edu/~dattorro/)
- [Schroeder: Natural Sounding Artificial Reverberation](https://www.aes.org/e-lib/)

### Code
- [Freeverb3](https://freeverb3-vst.sourceforge.io/)
- [STK Effects](https://ccrma.stanford.edu/software/stk/)
- [MusicDSP Effects](https://www.musicdsp.org/en/latest/Effects/index.html)

## Related Topics
- [Delay Module](../modules/dly.md)
- [Reverb Module](../modules/verb.md)
- [Filters](filters.md)

## Sources
- [CCRMA Effects](https://ccrma.stanford.edu/~jos/pasp/)
- [DAFx Conference Papers](https://dafx.de/paper-archive/)
- [Valhalla DSP Blog](https://valhalladsp.com/blog/)
