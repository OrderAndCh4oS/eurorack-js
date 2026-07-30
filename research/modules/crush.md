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

The current compact app panel has no CV ports. Bits/Rate CV remain a possible
future extension rather than part of the implemented contract.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/crush.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30)

- **Defects found**: In R did not normal from In L, so a one-cable patch
  produced only left-channel processing; the output also had no declared rail
  protection for over-range input. In R now follows cable lifecycle state and
  both outputs use the shared continuous +/-5 V soft rail.
- **Reset/coverage**: reset clears held samples, reduction phase, stable input
  buffers, outputs, and LED. Focused tests exercise 2-16-bit quantization,
  1x-64x sample holding, their combination, dry/wet endpoints, independent
  stereo, mono normalization/connect/disconnect, continuous rails, reset, LED,
  and finite full-buffer output.
- **Runtime/voltage result**: the strict 44.1/48/96 kHz by 128/512 matrix
  completed seven scenarios with no errors or voltage flags, stable buffers,
  and a 4.926 V peak.
- **Status**: complete for the current three-control bitcrusher contract.
