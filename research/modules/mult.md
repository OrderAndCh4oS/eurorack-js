# 2hp Mult Module Research

## Overview
Passive 2-input, 6-output signal splitter. Duplicates CV or audio signals to multiple destinations.

## Sources
- [2hp Official](https://www.twohp.com/modules/p/mult)
- [ModularGrid](https://modulargrid.net/e/2hp-mult)

## Specifications
- Width: 2hp
- Depth: 15mm
- Power: Passive (no power required)
- Price: $34

## Panel Layout (top to bottom)
- IN 1 - Input jack for channel 1
- OUT 1A - Output 1 (copy of IN 1)
- OUT 1B - Output 2 (copy of IN 1)
- OUT 1C - Output 3 (copy of IN 1)
- IN 2 - Input jack for channel 2
- OUT 2A - Output 1 (copy of IN 2)
- OUT 2B - Output 2 (copy of IN 2)
- OUT 2C - Output 3 (copy of IN 2)

## Functionality

### Signal Splitting
- Each input is copied to its 3 corresponding outputs
- No attenuation, buffering, or modification - pure signal copy
- Works with any signal type: audio, CV, gates, triggers

### Normalling
- When IN 2 has no cable, it receives IN 1's signal
- This allows a single input to be split 6 ways
- With both inputs patched, operates as two independent 1-to-3 mults

## Implementation Notes

### DSP Approach
- Simple buffer copy operation
- Each output = corresponding input
- Handle normalling: if in2 unpatched, use in1's signal for channel 2

### Considerations
- Since hardware is passive, our implementation should be transparent
- No processing, filtering, or coloring of signal
- LED indicators could show signal presence (even though hardware has none)

## Use Cases
1. **CV distribution**: Send one LFO to modulate multiple parameters
2. **Gate splitting**: Trigger multiple envelopes from one gate
3. **Audio splitting**: Send oscillator to multiple filters/effects
4. **Clock distribution**: Fan out clock to multiple sequencers

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/mult.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
