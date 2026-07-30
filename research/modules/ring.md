# Ring Modulator Module Research

## Overview
Ring modulator that multiplies two signals together, producing sum and difference frequencies. Creates metallic, bell-like, and inharmonic tones.

## Sources
- [Wikipedia - Ring Modulation](https://en.wikipedia.org/wiki/Ring_modulation)
- [Synthesizer Academy - Ring Modulator](https://synthesizeracademy.com/ring-modulator/)
- [All About Circuits - Ring Modulators](https://www.allaboutcircuits.com/technical-articles/understanding-how-ring-modulators-produce-am-signals/)
- [Pittsburgh Modular Dual Ring](https://modulargrid.net/e/pittsburgh-modular-dual-ring)

## Specifications (our design)
- Width: 4hp
- Two signal inputs (X and Y / Carrier and Modulator)
- Mix control to blend dry and wet
- Output

## Panel Layout
- X input - Carrier signal
- Y input - Modulator signal
- MIX knob - Blend dry carrier with ring modulated output
- OUT - Ring modulated output

## How Ring Modulation Works

### Basic Algorithm
```javascript
output = inputX * inputY;
```
Simply multiply the two signals sample-by-sample.

### Frequency Domain
- Produces sum and difference frequencies
- Input A at 440Hz, Input B at 100Hz → Output has 540Hz and 340Hz
- Original frequencies are suppressed (unlike AM)
- Creates inharmonic spectra from harmonic inputs

### Relationship to AM
- AM (Amplitude Modulation): modulator is shifted positive before multiply
- Ring Mod: unshifted modulator (bipolar) multiplied with carrier
- Ring mod = "suppressed carrier AM"
- Also called "balanced modulator" or "4-quadrant multiplier"

## Implementation Notes

### DSP Approach
```javascript
// Pure ring mod
out = x * y;

// With mix control (0 = dry, 1 = full ring mod)
out = x * (1 - mix) + (x * y) * mix;
```

### Scaling
- Both inputs are ±5V audio
- Multiply produces ±25V, need to scale back
- Divide by 5 to keep output in ±5V range

### Bandwidth

Ring multiplication creates sum and difference components but no nonlinear
harmonic series. A sum component above Nyquist can still alias; callers should
use band-limited oscillators and leave bandwidth for the chosen carrier and
modulator. Oversampling is not included in this compact utility.

## Use Cases
1. **Bell tones** - Two slightly detuned oscillators
2. **Metallic textures** - Audio-rate modulation
3. **Tremolo** - LFO-rate modulation (when mixed with dry)
4. **Vocal effects** - Classic Dalek voice sound
5. **Inharmonic drones** - Non-integer frequency ratios

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/ring.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30)

- Both +/-5 V inputs multiply with the documented 1/5 voltage scaling and the
  Mix control is sample-exact across dry, half, and wet endpoints.
- The output now uses the shared continuous +/-5 V rail for over-range inputs;
  ordinary in-range multiplication remains unchanged. Reset clears both stable
  input buffers and output without replacing buffer identities.
- Focused tests cover four-quadrant DC multiplication, bipolar waveforms,
  sum/difference behavior, dry/wet endpoints, rails, reset, and finite
  full-buffer output.
- The strict 44.1/48/96 kHz by 128/512 matrix completed all three scenarios
  with no errors or voltage flags, stable buffers, and a 4.926 V peak.
- **Status**: complete for the compact four-quadrant multiplier contract.
