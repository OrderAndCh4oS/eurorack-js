# Phaser Module Research

## Overview

Phaser effect using cascaded allpass filters. Creates sweeping notches in frequency spectrum.

## References

- [Stanford CCRMA - Phasing with First-Order Allpass](https://ccrma.stanford.edu/realsimple/DelayVar/Phasing_First_Order_Allpass_Filters.html)
- [DSPRelated - Phasing](https://www.dsprelated.com/freebooks/pasp/Phasing_First_Order_Allpass_Filters.html)
- [WolfSound - Allpass Filter](https://thewolfsound.com/allpass-filter/)

## Algorithm

Chain of allpass filters whose pole frequency is modulated by LFO.
4 stages = 2 notches, 6 stages = 3 notches, etc.

### First-Order Allpass Filter
```
y[n] = a * x[n] + x[n-1] - a * y[n-1]
```
Where `a` controls the break frequency.

### Key Parameters
- **Rate**: LFO speed (0.1-5 Hz)
- **Depth**: Amount of frequency sweep
- **Feedback**: Recirculation for resonance
- **Stages**: Number of allpass stages (4, 6, 8)
- **Mix**: Dry/wet balance

## DSP Implementation

```javascript
// Per sample, for each allpass stage:
function allpass(x, state, coef) {
    const y = coef * x + state.x1 - coef * state.y1;
    state.x1 = x;
    state.y1 = y;
    return y;
}

// Modulate coefficient based on LFO
const lfo = Math.sin(phase) * depth;
const freq = baseFreq * Math.pow(2, lfo); // Exponential sweep
const coef = (1 - freq/sampleRate) / (1 + freq/sampleRate);

// Chain allpass stages
let wet = input;
for (let i = 0; i < stages; i++) {
    wet = allpass(wet, allpassStates[i], coef);
}

// Mix with feedback
output = dry + wet * mix;
feedbackSample = wet * feedback;
```

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Before remediation**: `outL` (audio) measured -4.15..5.34 V against -5..5 V; `outR` (audio) measured -4.15..5.34 V against -5..5 V
- **After remediation**: Output and feedback state use ±5 V soft rails; strict matrix peak is 4.99 V and the 500-block extreme-feedback test passes.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/phaser.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Status**: confirmed contract and range findings are resolved; broader listening and characterization work remains tracked centrally.
