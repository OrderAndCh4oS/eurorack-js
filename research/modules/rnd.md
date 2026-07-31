# 2hp Rnd (Random) Module Research

## Overview
Random voltage generator with stepped and smooth outputs, internal clock, and random gate output.

## Sources
- [2hp Official](https://www.twohp.com/modules/p/rnd)
- [ModularGrid](https://modulargrid.net/e/2hp-rnd-v2)
- [Pugix Review](https://pugix.com/synth/2hp-rnd-module/)
- [Elevator Sound](https://www.elevatorsound.com/product/2hp-rnd-v2-eurorack-random-voltage-generator-module/)
- Melissa E. O'Neill, “PCG: A Family of Simple Fast Space-Efficient
  Statistically Good Algorithms for Random Number Generation,” Harvey Mudd
  College technical report HMC-CS-2014-0905, 5 September 2014:
  [paper and citation record](https://www.pcg-random.org/paper.html) and
  [minimal PCG C usage/reference vectors](https://www.pcg-random.org/using-pcg-c-basic.html).
  Primary algorithm source for the deterministic PCG XSH-RR 64/32 stream and
  its reference seeding procedure.
- Ecma International / TC39, ECMA-262,
  [`Math.random`](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.random),
  living specification accessed 31 July 2026. This deliberately leaves the
  algorithm implementation-defined, so it cannot provide a portable patch
  identity.

## Specifications
- Width: 2hp
- Depth: 42mm
- Power: 48mA +12V, 6mA -12V

## Panel Layout
- RATE knob - Clock speed (internal mode) or probability (external mode)
- AMP knob - Output amplitude (0 to max)
- SEED knob - Software adaptation, integer 0-65535; patch-persisted stream
  identity
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
- Use a specified random stream and patch-persisted seed so shared patches
  replay across machines
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

## Deterministic Seed Adaptation (2026-07-31)

The physical 2hp Rnd sources document Rate and Amp only; they do not expose a
seed control. The emulator adds Seed as a software utility adaptation because
patch sharing otherwise serializes every visible setting while leaving the
musically decisive random sequence to each browser's implementation-defined
`Math.random`.

### Persistence and replay contract

- `Seed` is an integer `0..65535`, default `0`, declared as an ordinary module
  parameter. Patch v3 files and shareable URL hashes therefore store any
  non-default value under the RND instance's params; an omitted default still
  reconstructs seed 0 from the module contract.
- RND uses the same specified PCG XSH-RR 64/32 one-sequence generator as
  Refrain. It uses unsigned 32-bit halves, `Math.imul`, and integer bit
  operations rather than implementation-defined browser randomness. The
  multiplier, increment, and seeding procedure are the PCG values documented
  in the Refrain specification's “Exact PCG32 and integer mapping” section.
- A random unit value is exactly `nextUint32() / 2^32`. At Rate 1 or 0, each
  accepted external clock consumes one draw for Step. At intermediate Rate,
  it consumes a gate-probability draw first and a Step draw second. Internal
  ticks consume one Step draw and always emit Gate.
- DSP construction initially creates seed 0, but the first process hydrates
  the patch-assigned Seed before any possible draw. Changing Seed reseeds at
  the start of the next process block; the existing Step target remains held
  until the next random event. Lifecycle reset clears outputs and restarts the
  currently selected seed from its first draw.
- Consequently, the same patch, seed, module routing, parameter automation,
  and accepted clock-event order produce the same random choices on another
  machine. Internal-clock wall-clock timing can still differ when sample rate
  differs, and live MIDI/CV timing is not part of patch state.
- Patch state stores stream identity, not the mutable PCG continuation. Saving
  midway through a performance and reopening it deliberately replays from the
  start of the seed; it does not resume from the last generated value.
- The optional injected random function remains a test seam for validating
  amplitude, slew, invalid-result handling, and gate extremes. Production DSP
  supplies no override and always uses PCG32.

### Test targets

- Golden seed 4242 produces the first four Step values
  `5.4216194991`, `5.4721889016`, `9.0932147251`, and `2.7384936227`
  volts at Amp 1 with Rate 1 external clocks.
- Two instances with the same seed match exactly; adjacent seeds diverge.
- Reset replays the selected stream; live Seed changes preserve the held value
  until the next event; non-finite, fractional, and out-of-range seeds
  normalize to the documented integer domain.
- Patch URL round-trip retains Seed, and factory RND/Refrain demonstrations
  carry explicit seeds so their generative identity is reviewable in source.

### Validation result

Focused RND, Refrain, module-contract, patch-format, factory-patch, and research
tests pass. The full suite passes 2,145 tests across 112 files. The strict RND
matrix passes seven scenarios at 44.1, 48, and 96kHz with 128- and 512-sample
blocks: all outputs are finite, all buffers remain stable, no voltage flags are
reported, and the largest diagnostic time is 72.8 microseconds per block. All
15 Chromium end-to-end tests pass, including production AudioWorklet loading of
the shared PCG utility.
