# Wavefolder Module Research

## Overview
Wavefolder that adds harmonic complexity by folding waveforms back on themselves. Based on common eurorack wavefolder designs (Joranalogue Fold 6, Serge-style).

## Sources
- [Noise Engineering - Getting Started: Wavefolders](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/getting-started-wavefolders/)
- [CCRMA - Complex Nonlinearities: Wavefolder](https://ccrma.stanford.edu/~jatin/ComplexNonlinearities/Wavefolder.html)
- [KVR Forum - Wavefolding DSP](https://www.kvraudio.com/forum/viewtopic.php?t=501471)
- [Joranalogue Fold 6](https://www.signalsounds.com/joranalogue-fold-6-eurorack-wavefolder-module)
- [Antiderivative Antialiasing for Memoryless Nonlinearities](https://www.pure.ed.ac.uk/ws/portalfiles/portal/34115216/bilbao_pdf.pdf)
  — Stefan Bilbao, Kurt James Werner, Julius O. Smith III, and Jonathan S.
  Abel, IEEE Signal Processing Letters, 2017. Establishes the first-order
  divided-difference method used to antialias the sine transfer curve.

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
- This is an inspired-by utility adaptation, not a circuit-level emulation of a
  named hardware wavefolder.

### Aliasing Considerations
- Wavefolding creates high harmonics that can alias
- The sine transfer is evaluated with first-order antiderivative antialiasing
  (ADAA). For `f(x) = sin(pi*x)`, its analytic antiderivative lets the processor
  average the curve traversed between adjacent samples without an oversampling
  buffer.
- The near-zero divided-difference case uses the transfer curve at the midpoint
  to avoid numerical cancellation.
- First-order ADAA substantially reduces rather than eliminates aliasing. It
  introduces the expected one-sample state and mild high-frequency attenuation,
  trading a small tonal change for much lower reflected harmonic energy.

### Parameter Ranges
- Fold: 1-10x gain (1 = gentle harmonics, 10 = extreme folding)
- Symmetry knob: -1..+1, producing a pre-fold offset of -2..+2 V
- Fold CV: bipolar -5..+5 V, adding -0.5..+0.5 before the Fold clamp
- Symmetry CV: bipolar -5..+5 V, adding -2..+2 V to the pre-fold offset

## Use Cases
1. **Sine to complex** - Transform pure sine into harmonically rich timbre
2. **Triangle sweetening** - Add upper harmonics to triangle wave
3. **Dynamic timbre** - Modulate fold amount with envelope
4. **West Coast synthesis** - Classic Buchla-style sound design

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/fold.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Fold and Symmetry CV now explicitly declare bipolar -5..+5 V with a 0 V
  normal, matching their per-sample modulation paths.
- Reset clears the stable Audio/Fold/Symmetry input buffers and output without
  replacing buffer identities.
- Focused control, CV, symmetry/DC, range, reset, and finite-buffer tests pass.
  The strict 44.1/48/96 kHz by 128/512 matrix completes all five scenarios with
  no voltage flags, stable buffers, and a natural sine-bounded 5 V peak.
- A coherent 3.072 kHz / 16.384 kHz render at 7x drive measures the combined
  reflected products at 1.024, 5.120, and 7.168 kHz. First-order ADAA reduces
  their power to 14.9% of the raw sine folder (-8.26 dB), with a regression
  requiring at least a 4.56 dB reduction.
- The implementation remains allocation-free in `process()` and the strict
  matrix's observed Node diagnostic maximum was 117.6 microseconds per block.
