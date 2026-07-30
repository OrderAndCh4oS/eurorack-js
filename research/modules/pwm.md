# PWM Module Research

## Reference Module: Doepfer A-168-1

The A-168-1 is a PWM (Pulse Width Modulation) generator that converts any continuously varying signal into a rectangle/pulse wave with adjustable pulse width.

## How It Works

The module is essentially a **comparator with adjustable threshold**:

1. Input signal (triangle, saw, sine, envelope, etc.) is compared against a threshold voltage
2. When input > threshold: output goes HIGH (+5V)
3. When input < threshold: output goes LOW (-5V)
4. Adjusting the threshold changes the pulse width
5. Modulating the threshold with CV creates PWM

```
Input Signal (triangle)     Threshold (adjustable)     Output (pulse)
      /\                         ___________              _____
     /  \                       |           |            |     |
    /    \      ───────────────>|           |  ───────>  |     |
   /      \                     |___________|            |_____|
  /        \
```

## Specifications

| Spec | Value |
|------|-------|
| HP | 4 |
| Current | +20mA, -20mA |
| Depth | 20mm |

### Controls
- **PW knob** - Manual pulse width (0-100%)
- **PWM CV input** - External modulation with attenuator

### Inputs
- **In** - Signal input (triangle, saw, sine, envelope, random)

### Outputs
- **Out** - Pulse output with LED
- **/Out** - Inverted pulse output with LED

### Internal Trimmers (on hardware)
- PW centering - Sets 50% duty cycle at knob center
- PWM range - Calibrates full 0-100% sweep

## Technical Notes

- Output levels: ±5V (matches our gate standard when rectified, or bipolar for audio)
- Does NOT work with square wave input (no slope to compare against)
- The threshold is the sum of: manual PW offset + PWM CV input
- Works at both audio rates (VCO input) and modulation rates (LFO/envelope input)

## Our Implementation

### Inputs
- `in` - Audio/CV input signal
- `pwmCV` - PWM modulation CV input

### Outputs
- `out` - Pulse output
- `inv` - Inverted pulse output

### Parameters
- `pw` - Manual pulse width (0-1, center = 0.5 = 50%)
- `pwmAmt` - PWM CV attenuator amount (0-1)

### LEDs
- `out` - Shows output state
- `inv` - Shows inverted output state

### DSP

```javascript
// Convert PW knob (0-1) to threshold voltage
// At 0.5 (center), threshold = 0 for symmetric 50% duty cycle
// Full range should cover the typical ±5V input signal
const baseThreshold = (pw - 0.5) * 10; // -5V to +5V range

for (let i = 0; i < bufferSize; i++) {
    // Modulated threshold
    const threshold = baseThreshold - pwmCV[i] * pwmAmt;

    // Comparator
    if (input[i] > threshold) {
        out[i] = 5;   // High
        inv[i] = -5;  // Low
    } else {
        out[i] = -5;  // Low
        inv[i] = 5;   // High
    }
}
```

## Use Cases

1. **Add PWM to LFO** - Feed LFO triangle into PWM, modulate with another LFO
2. **Add PWM to VCO** - Feed VCO saw/tri into PWM for pulse with CV-able width
3. **Rhythmic gating** - Feed envelope into PWM for variable-width gates
4. **Audio rate PWM** - Classic PWM sound from any oscillator
5. **Waveshaping** - Convert any wave to pulse at various duty cycles

## Sources

- [Doepfer A-168-1 Official Page](https://doepfer.de/a1681.htm)
- [Doepfer A-168-1 on ModularGrid](https://modulargrid.net/e/doepfer-a-168-1)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/pwm.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- PWM CV now explicitly declares bipolar -5..+5 V with a 0 V normal. At full
  attenuation, +5 V moves the centered threshold from 0 V to -5 V; the former
  implementation multiplied CV by two and incorrectly moved it to -10 V.
- Comparator crossings use the analytically estimated sub-sample crossing
  fraction. Only an edge sample can be intermediate; settled pulse levels and
  the inverted output remain exactly complementary at +/-5 V.
- On a coherent 3.072 kHz / 16.384 kHz sine-to-pulse fixture, combined
  reflected power at 1.024, 4.096, and 7.168 kHz falls to 32.1% of ideal
  point-sampled comparator power (-4.93 dB). This is a first-order,
  allocation-free edge treatment rather than oversampling.
- LED smoothing now uses a physical 100 ms time constant instead of a fixed
  per-block coefficient. Reset clears both stable inputs, both output buffers,
  edge history, LED smoothers, and LEDs in place.
- Focused tests cover both controls, CV scale and audio-rate modulation,
  comparator equality/direction, triangle/saw/sine/DC inputs, complementary
  output, edge antialiasing, LEDs, ranges, reset, and finite buffers.
- The strict 44.1/48/96 kHz by 128/512 matrix completes all five scenarios
  with finite output, zero voltage flags, stable buffers, exact 5.000 V rails,
  and a largest Node diagnostic observation of 81.9 microseconds per block.
