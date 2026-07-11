# Bitcrusher Module Research

## Overview

Lo-fi effect that reduces bit depth and sample rate for digital distortion/aliasing.

## References

- [Wikipedia - Bitcrusher](https://en.wikipedia.org/wiki/Bitcrusher)
- [ADSR - Building FX: Bitcrushing](https://www.adsrsounds.com/reaktor-tutorials/building-fx-part-vi-basic-bitcrushing/)
- [Perfect Circuit - Weird FX: Bitcrushers](https://www.perfectcircuit.com/signal/weird-fx-bitcrushers)

## Algorithm

Two main processes:
1. **Bit depth reduction**: Quantize to fewer amplitude levels
2. **Sample rate reduction**: Hold samples, skip updates

### Bit Depth Reduction
```javascript
// Reduce to N bits
const levels = Math.pow(2, bits);
const quantized = Math.round(input * levels / 2) / (levels / 2);
```

### Sample Rate Reduction
```javascript
// Reduce by factor of N
if (sampleCounter >= rateReduction) {
    heldSample = input;
    sampleCounter = 0;
}
sampleCounter++;
output = heldSample;
```

### Key Parameters
- **Bits**: Bit depth (1-16 bits)
- **Rate**: Sample rate reduction factor (1x-64x)
- **Mix**: Dry/wet balance

## DSP Implementation

```javascript
// Per sample:

// Sample rate reduction (sample-and-hold)
sampleCounter++;
if (sampleCounter >= rateReduction) {
    heldSample = input;
    sampleCounter = 0;
}

// Bit depth reduction
const levels = Math.pow(2, bits);
const crushed = Math.floor(heldSample * levels / 2 + 0.5) / (levels / 2);

// Mix
output = input * (1 - mix) + crushed * mix;
```

### Stereo
Can process L/R independently or linked.

### CV Control
- Bits CV: Modulate bit depth for rhythmic crushing
- Rate CV: Modulate sample rate for sweep effects

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/crush.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
