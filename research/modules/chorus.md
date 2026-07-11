# Chorus Module Research

## Overview

Chorus effect using modulated delay lines. Creates thickening/detuning by mixing dry signal with delayed, pitch-modulated copies.

## References

- [Stanford CCRMA - Chorus Effect](https://ccrma.stanford.edu/~jos/pasp/Chorus_Effect.html)
- [DSPRelated - Time-Varying Delay Effects](https://www.dsprelated.com/freebooks/pasp/Time_Varying_Delay_Effects.html)
- [JUCE dsp::Chorus](https://docs.juce.com/master/classdsp_1_1Chorus.html)

## Algorithm

Chorus = dry + modulated delayed copy (20-50ms delay range)

```
output = dry * dryMix + delayLine[modulatedDelay] * wetMix
```

### Key Parameters
- **Rate**: LFO speed (0.1-5 Hz typical)
- **Depth**: Amount of delay modulation (1-10ms)
- **Delay**: Base delay time (10-50ms)
- **Mix**: Dry/wet balance
- **Feedback**: Optional recirculation

### Stereo Implementation
Use two delay lines with LFOs 90° or 180° out of phase for stereo width.

## DSP Implementation

```javascript
// Per sample:
const lfoL = Math.sin(phase) * depth;
const lfoR = Math.sin(phase + stereoOffset) * depth;
const delayL = baseDelay + lfoL;
const delayR = baseDelay + lfoR;

outL = dry * dryMix + readDelay(delayLineL, delayL) * wetMix;
outR = dry * dryMix + readDelay(delayLineR, delayR) * wetMix;

phase += 2 * Math.PI * rate / sampleRate;
```

### Interpolation
Linear interpolation for fractional delay reads is sufficient for chorus.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/chorus.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
