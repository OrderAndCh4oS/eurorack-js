# Mixer (mix)

## Hardware Reference
- **Based on**: [2hp Mix](http://www.twohp.com/modules/p/mix)
- **Manual**: [Mix Manual PDF](https://www.twohp.com/modules/p/mix) (download from product page)
- **ModularGrid**: [2hp Mix](https://www.modulargrid.net/e/2hp-mix)

## Specifications

### Features
- 4 channel DC-coupled mixer
- Individual level control per channel
- Works with audio or CV signals
- Low noise floor design

### Controls
- **Level 1-4**: Individual channel gain (0-100%)

### Inputs
- **In 1-4**: 4 DC-coupled inputs (audio or CV)

### Outputs
- **Out**: Summed output of all channels

### Indicators
- **Level LED**: Shows output level with peak hold decay

### Power (Hardware)
- +12V: 41mA
- -12V: 41mA
- Depth: 45mm

## DSP Implementation

### Algorithm Overview
Simple summing mixer:
```
output = Σ(input[n] × level[n])
```

### Key Concepts
- **DC coupling**: No high-pass filtering, passes DC offsets (important for CV)
- **Linear summing**: Direct addition of scaled inputs
- **LED decay**: Exponential decay (~100ms time constant) for smooth metering

### Code Notes
- Uses `clamp(0, 1)` on level parameters
- Level changes use a 5ms one-pole slew; the initial patch render starts
  directly at the stored values
- Peak detection for LED updates
- Stable 0V-normalled input buffers support audio and CV
- Sums remain linear through 9.6V, then approach continuous +/-10V rails

## DSP References
- [Summing Amplifier](https://www.electronics-tutorials.ws/opamp/opamp_4.html) - Basic theory
- [MusicDSP - Mixer](https://www.musicdsp.org/en/latest/Effects/22-saturated-amplifier-or-mixer.html) - Saturation considerations

## Sources
- [2hp Mix Product Page](http://www.twohp.com/modules/p/mix)
- [ModularGrid - 2hp Mix](https://www.modulargrid.net/e/2hp-mix)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Before remediation**: `out` (any) measured -20.00..20.00 V against -10..10 V
- **After remediation**: The sum remains linear through 9.6 V and softly approaches the declared ±10 V rails; strict matrix peak is 10 V.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/mix.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Status**: confirmed contract and range findings are resolved; broader listening and characterization work remains tracked centrally.

## Individual Contract Audit (2026-07-30, complete)

- All four DC-coupled inputs explicitly accept -10V to +10V with 0V normals.
  The output retains its continuous -10V to +10V rail and exact linear summing
  below the 9.6V knee.
- A 5ms level slew now prevents manual or mapped knob changes from introducing
  a full-scale block-boundary step. At 44.1 kHz, a 0-to-1 level change on 5V
  input begins at about 0.023V instead of jumping directly to 5V. The first
  patch render initializes directly to stored levels, so loading a patch does
  not receive an artificial fade.
- The one-time-constant response is verified at 44.1, 48, and 96 kHz. All four
  controls and signal inputs are sanitized against non-finite values.
- Reset clears every stable input and output buffer in place, resets the four
  smoothing states, and clears the bounded peak meter.
- Focused tests cover each channel, DC and phase-cancelling audio sums, overload
  continuity, control transitions, rate invariance, LED decay, finite recovery,
  and complete reset.
- The strict 44.1/48/96 kHz by 128/512 matrix completes nine scenarios with
  finite output, zero voltage flags, stable buffers, exact 10.000V rails, and a
  maximum diagnostic time below 0.172ms per block.
