# Wavefolder Module Research

## Overview
Wavefolder that adds harmonic complexity by folding waveforms back on themselves. Based on common eurorack wavefolder designs (Joranalogue Fold 6, Serge-style).

## Sources
- [Noise Engineering - Getting Started: Wavefolders](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/getting-started-wavefolders/)
- [CCRMA - Complex Nonlinearities: Wavefolder](https://ccrma.stanford.edu/~jatin/ComplexNonlinearities/Wavefolder.html)
- [KVR Forum - Wavefolding DSP](https://www.kvraudio.com/forum/viewtopic.php?t=501471)
- [Joranalogue Fold 6](https://www.signalsounds.com/joranalogue-fold-6-eurorack-wavefolder-module)

## Specifications (our design)
- Width: 4hp
- Controls: Fold amount, Symmetry
- CV inputs: Fold CV, Symmetry CV
- Audio in/out

## Panel Layout
- FOLD knob - Amount of folding (0 = clean, max = many folds)
- SYM knob - Symmetry/bias control
- IN - Audio input
- FOLD CV - CV control of fold amount
- SYM CV - CV control of symmetry
- OUT - Folded audio output

## How Wavefolding Works

1. Signal enters the folder
2. When amplitude exceeds a threshold, the signal "folds" back
3. Higher fold amounts = lower threshold = more folds
4. Creates harmonic overtones from simple waveforms
5. Best with sine/triangle inputs, works with any waveform

## DSP Algorithms

### Simple Sine Folder (Serge-style)
```javascript
out = Math.sin(gain * input);
```
- As gain increases, signal folds more times
- Produces smooth, musical folding
- Simple and effective

### Triangle Folder
```javascript
// Normalize input to folding range
x = input * drive;
// Integer part determines fold direction
phase = x + offset;
intPart = Math.floor(phase);
fracPart = phase - intPart;
// Fold based on even/odd
if (intPart & 1) {
    out = 2 * fracPart - 1;  // Rising
} else {
    out = 1 - 2 * fracPart;  // Falling
}
```

### Symmetry/Bias
Adding DC offset before folding creates asymmetric folding:
```javascript
biasedInput = input + symmetry;
out = fold(biasedInput);
```

## Implementation Notes

### Chosen Approach: Sine Folder
- Use `sin(drive * input)` as core algorithm
- Simple, musical, low CPU
- Drive/fold amount scales the input before sin()
- Symmetry adds DC offset for asymmetric folding

### Aliasing Considerations
- Wavefolding creates high harmonics that can alias
- For basic implementation: accept some aliasing
- Future improvement: 2x-4x oversampling

### Parameter Ranges
- Fold: 1-10x gain (1 = gentle harmonics, 10 = extreme folding)
- Symmetry: -5V to +5V DC offset

## Use Cases
1. **Sine to complex** - Transform pure sine into harmonically rich timbre
2. **Triangle sweetening** - Add upper harmonics to triangle wave
3. **Dynamic timbre** - Modulate fold amount with envelope
4. **West Coast synthesis** - Classic Buchla-style sound design
