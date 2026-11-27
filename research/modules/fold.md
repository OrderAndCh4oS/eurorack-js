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

## Implementation Plan — output coupling (2026-11-27)

The recorded *Copper & Vactrol 168* performance developed a sustained offset during its wet section. At 10× drive and Sym 0.35 the existing sine transfer produces −4.76 V from 0 V in. The patch sends this signal through an LPG to both the mixer and GRANULITA. [Public patch](https://eurorackjs.orderandchaos.xyz/patches/01M8CX34Y6Q7XJ0VKKSEJZD4DN)

Keep the `fold` effect's pre-fold bias and antialiasing. AC-couple its audio output at 18 Hz, with the pole computed from sample rate and unity gain at Nyquist. Reserve the final 1% of the ±5 V rail for a soft knee. Feed the bounded output back into the DC estimate so a lopsided waveform stays centered even when peaks reach a rail. Initialize the estimate at the silent operating point of the loaded controls. This costs one scalar of persistent state in addition to the folder's previous input. A downstream master filter would leave the offset in effect sends. [Julius O. Smith III, *Introduction to Digital Filters*, DC Blocker, accessed 2026-11-27](https://www.dsprelated.com/freebooks/filters/DC_Blocker.html)

This work in the current checkout keeps the patch format, Fold and Sym parameters, jack definitions and panel intact. Existing patches can load their saved settings. Sub-audio signals at Out will be attenuated. Validate a biased silent start, knob and CV changes, reset, even harmonics, bass response and voltage bounds in `tests/dsp/fold.test.js`. Compare existing patches using FOLD, run the strict DSP audit matrix and run the full unit suite.

The old silence test used Sym 0. Its symmetry test accepted any change in the mean of a single 128-sample block. The voltage audit records DC, but a constant −4.76 V satisfies the ±5 V rail check. The new regression tests check for silence with bias already present, let a live CV change settle across multiple blocks, and measure even harmonics over a complete cycle. A Chromium test captures the granular return at OUT, then patches in a real oscillator to verify the same route carries sound. [FOLD tests](../../tests/dsp/fold.test.js) · [Browser capture](../../tests/e2e/composition-modules.spec.js)

### Public patch impact

On 2026-11-27, 7 of the 33 public catalogue entries used FOLD. Copper is the patch that prompted the fix. The six other patches using FOLD all route its output as audio. The other 26 public patches have no FOLD signal path.

Each comparison rendered 16 seconds from the saved settings at 48 kHz with 128-frame blocks, identical random seeds and the rack's compiled routing graph. The table reports the change in stereo RMS at OUT, including DC. The 18 Hz high-pass can also change bass phase and the shape of transients. Live control moves can produce larger differences.

| Existing public patch | Change at OUT |
| --- | ---: |
| [Acid Bath (Arranged)](https://eurorackjs.orderandchaos.xyz/patches/01M7Z9Q4P2BKKD4V8EN8FN438T) | −0.181 dB |
| [Acid Bath](https://eurorackjs.orderandchaos.xyz/patches/01M7Z9N8SC3EGJ83NZH4R92JFX) | −0.144 dB |
| [Sluice](https://eurorackjs.orderandchaos.xyz/patches/01M86K5X353W4TDWM88H6D5GY2) | −0.033 dB |
| [Doppelgänger Acid](https://eurorackjs.orderandchaos.xyz/patches/01M89Z5XYYEC96R3EYZ2H1ED6H) | +0.018 dB |
| [Tidal Grammar](https://eurorackjs.orderandchaos.xyz/patches/01M7RMHYC05QJYH0VGJNZG474F) | −0.015 dB |
| [Stop-Time Phonk // Tokyo Noir](https://eurorackjs.orderandchaos.xyz/patches/01M89YJ7B8R1G2M0WN2E5ZEAQH) | −0.003 dB |

Copper's saved mix measured 0.598 dB lower. For a separate Act V comparison, set Fold to 0.78, Sym to 0.35, TZ FM to 0.65, Odd to 0.85, GRANULITA Blend to 0.85 and Verb to 0.72, and mute stems 1 and 2. Over the last four seconds of each render, the mean left output changed from +0.24079 to +0.00059 full scale at Joy X +0.82 and from −0.24027 to −0.00001 at Joy X −0.75. These are two held settings from the performance. The original recording contains continuous gestures.

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
