# 2hp Rnd (Random) Module Research

## Overview
Random voltage generator with stepped and smooth outputs, internal clock, and random gate output.

## Sources
- [2hp Official](https://www.twohp.com/modules/p/rnd)
- [ModularGrid](https://modulargrid.net/e/2hp-rnd-v2)
- [Pugix Review](https://pugix.com/synth/2hp-rnd-module/)
- [Elevator Sound](https://www.elevatorsound.com/product/2hp-rnd-v2-eurorack-random-voltage-generator-module/)

## Specifications
- Width: 2hp
- Depth: 42mm
- Power: 48mA +12V, 6mA -12V

## Panel Layout
- RATE knob - Clock speed (internal mode) or probability (external mode)
- AMP knob - Output amplitude (0 to max)
- CLK input - External clock input
- STEP output - Stepped random voltage (0-10V)
- SMOOTH output - Slewed random voltage
- GATE output - Clock out (internal) or random gates (external)

## Functionality

### Stepped Output
- Quantized random voltages (discrete steps, not musical scale)
- New voltage generated on each clock pulse
- Amplitude adjustable via AMP knob
- Range: 0V to 10V (or 0-5V via jumper)

### Smooth Output
- Same random source but with slew/smoothing applied
- Creates slowly evolving random modulation
- Good for gentle parameter drift

### Internal Clock Mode
- Rate knob controls clock speed
- Gate output = clock output (pulses when new random generated)
- Useful as standalone random source

### External Clock Mode
- Clocked by external signal
- Rate knob controls probability of gate firing
- Gate output = random gates (probabilistic)

### Self-Patching
- Patching Gate → Clock input creates random timing
- "Random voltage at random times"

## Implementation Notes

### DSP Approach
```javascript
// Stepped: sample & hold random on clock
if (clockRising) {
    heldUnitValue = random();
}

steppedValue = heldUnitValue * 10 * amplitude;

// Smooth: sample-rate-invariant one-pole slew toward the scaled held value
smoothValue += (steppedValue - smoothValue) * (1 - exp(-1 / (tau * sampleRate)));

// Gate: output clock (internal) or probabilistic gate (external)
```

### Considerations
- Use consistent random seed behavior for reproducibility option
- Smooth output needs adjustable slew rate (tied to rate knob inverse)
- Gate output voltage: 10V when high, 0V when low

## Use Cases
1. **Random melodies** - Step output → Quantizer → VCO
2. **Evolving textures** - Smooth output → Filter cutoff
3. **Generative rhythms** - Gate output → Drum triggers
4. **Parameter drift** - Smooth → any CV input for subtle movement
5. **Chaos patches** - Self-patch gate → clock for random timing

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Before remediation**: `step` (cv) measured 0.00..6.49 V against -5..5 V; `smooth` (cv) measured 0.00..6.49 V against -5..5 V
- **After remediation**: Step and smooth outputs now declare 0..10 V; strict matrix passes.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/rnd.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Status**: confirmed contract and range findings are resolved; broader listening and characterization work remains tracked centrally.

## Individual Contract Audit (2026-07-30, complete)

- External mode now follows actual cable state. Previously the internal clock
  advanced during every low sample between external pulses, so a patched clock
  did not override it and could produce unintended extra random changes.
- With Clock connected, every >=1V rising edge samples a new Step target and Rate
  controls Gate probability from 0% to 100%, matching the documented external
  mode. With Clock unpatched, Rate controls the 0.1-20Hz internal clock and every
  internal tick emits Gate.
- Amp now scales the held unit-random value continuously instead of being baked
  into the value only at trigger time. Step therefore responds immediately to
  Amp, and Smooth follows the same scaled target.
- Smooth uses a physical-time one-pole from 250ms at minimum Rate to 5ms at
  maximum. A 250ms/63.2% fixture agrees at 1kHz and 2kHz, replacing the previous
  sample-rate-dependent per-sample coefficient.
- Random generation is injectable for deterministic coverage and clamps invalid
  RNG results; params and Clock samples have finite fallbacks. Clock declares
  0-10V/0V normal and all outputs declare their 0-10V rails.
- Reset preserves connection ownership while clearing phase, held/smooth values,
  gate/LED timers, edge state, and stable buffers in place.
- Focused and module-contract validation passes 37 assertions. The strict
  44.1/48/96kHz by 128/512 matrix completes five scenarios with finite output,
  zero voltage flags, stable buffers, exact 10.000V peaks, and a maximum Node
  diagnostic time below 0.083ms per block.
