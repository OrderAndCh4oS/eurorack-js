# Flanger Module Research

## Overview

Flanger effect using very short modulated delay with feedback. Creates sweeping comb filter effect.

## References

- [DSPRelated - Flanging](https://www.dsprelated.com/freebooks/pasp/Flanging.html)
- [Stanford CCRMA - Flanger](https://ccrma.stanford.edu/~spencer/blog/2013/03/05/flanger/)
- [Wikipedia - Flanging](https://en.wikipedia.org/wiki/Flanging)

## Algorithm

Similar to chorus but with:
- Shorter delay (0.1-10ms vs 20-50ms for chorus)
- Higher feedback for resonance
- Creates harmonic comb filter notches

```
output = dry + delayLine[modulatedDelay] * wetMix
delayLine.write(input + output * feedback)
```

### Key Parameters
- **Rate**: LFO speed (0.01-2 Hz typical)
- **Depth**: Delay modulation amount
- **Delay**: Base delay (0.5-5ms)
- **Feedback**: Recirculation (-1 to 1, negative inverts)
- **Mix**: Dry/wet balance

### Flanger vs Chorus
- Flanger: <10ms delay, high feedback, comb filter
- Chorus: 20-60ms delay, low/no feedback, detuning

## DSP Implementation

```javascript
// Per sample:
const lfo = Math.sin(phase) * depth;
const delay = baseDelay + lfo; // in samples

const wet = readDelayInterpolated(delayLine, delay);
const output = dry + wet * wetMix;

// Write with feedback
delayLine.write(input + wet * feedback);

phase += 2 * Math.PI * rate / sampleRate;
```

### Feedback Polarity
Positive feedback emphasizes harmonics.
Negative feedback emphasizes odd harmonics (more hollow sound).

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Before remediation**: `outL` (audio) measured -5.41..5.46 V against -5..5 V; `outR` (audio) measured -5.63..5.59 V against -5..5 V
- **After remediation**: Output and delay-write state use ±5 V soft rails; strict matrix peak is 4.93 V and the 500-block extreme-feedback test passes.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/flanger.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Status**: confirmed contract and range findings are resolved; broader listening and characterization work remains tracked centrally.
