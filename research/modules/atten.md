# Attenuverter (atten)

## Hardware Reference
- **Based on**: [Mutable Instruments Shades](https://pichenettes.github.io/mutable-instruments-documentation/modules/shades_2020/manual/) (simplified to 2 channels)
- **Also referenced**: [2hp AVert](https://www.twohp.com/modules/avert), [Doepfer A-183-1](https://doepfer.de/a1831.htm)
- **ModularGrid**: [Shades 2020](https://www.modulargrid.net/e/mutable-instruments-shades-2020)

## Specifications

### Features
- 2 independent channels (Shades has 3, we simplify to 2)
- Attenuverter: gain from -1 (inverted) through 0 (muted) to +1 (unity)
- Offset: add DC voltage to output
- This app-specific utility adaptation normalizes unpatched inputs to 0V; its
  separate offset controls provide the DC source
- LED indicators show signal level and polarity

### Power (Shades Hardware)
- +12V: 15mA
- -12V: 15mA
- Width: 6HP (Shades), 2HP (AVert)

### Controls
- **Atten 1**: Attenuverter gain channel 1 (-1 to +1, center = 0)
- **Offset 1**: DC offset channel 1 (-5V to +5V)
- **Atten 2**: Attenuverter gain channel 2 (-1 to +1, center = 0)
- **Offset 2**: DC offset channel 2 (-5V to +5V)

### Inputs
- **In 1**: Signal input channel 1 (-10V to +10V, 0V normal)
- **In 2**: Signal input channel 2 (-10V to +10V, 0V normal)

### Outputs
- **Out 1**: Processed signal channel 1
- **Out 2**: Processed signal channel 2

### Indicators
- **Ch1 LED**: Shows output level (brightness) and polarity (color/position)
- **Ch2 LED**: Shows output level (brightness) and polarity (color/position)

## DSP Implementation

### Algorithm Overview
```javascript
// Attenuverter: knob 0-1 maps to gain -1 to +1
const gain = (attenKnob - 0.5) * 2;  // 0->-1, 0.5->0, 1->+1

// Offset: knob 0-1 maps to -5V to +5V
const offset = (offsetKnob - 0.5) * 10;  // 0->-5V, 0.5->0V, 1->+5V

// Process
output = clamp(input * gain + offset, -10, 10);
```

### Normalling Behavior

Shades uses a voltage-reference normal so an attenuverter can create an offset
without a separate offset control. ATTEN already has a dedicated bipolar offset
knob on each channel. Its explicit utility contract is therefore a 0V normal:
an unpatched channel emits only its selected offset. This avoids summing two DC
sources and makes the default full-clockwise attenuverter produce 0V rather than
an unexpected +5V.

### LED Behavior (from Shades)
- Upper LED (turquoise): positive signal intensity
- Lower LED (pink): negative signal intensity
- Equal intensity = bipolar signal without DC offset

For our single LED per channel:
```javascript
// Map output voltage to LED brightness
// -5V = 0 (off), 0V = 0.5 (half), +5V = 1 (full)
led = clamp((avgOutput + 5) / 10, 0, 1);
```

### Key Concepts
- **Attenuverter** = attenuator + inverter in one control
- **Center detent**: At noon position, signal is muted (gain = 0)
- **Full CCW**: Signal inverted at unity (-1x)
- **Full CW**: Signal passed at unity (+1x)
- **Offset**: Adds DC voltage, useful for shifting bipolar to unipolar

## Common Uses

### Scale CV Range
- Problem: LFO outputs ±5V but you want ±1V for subtle filter modulation
- Solution: Attenuverter at ~20% (0.6 on knob)

### Invert Modulation
- Problem: Want envelope to close filter instead of open
- Solution: Attenuverter fully CCW (gain = -1)

### Create DC Voltage
- Problem: Need fixed voltage for mixer level or VCA bias
- Solution: Leave input unpatched, use offset knob

### Bipolar to Unipolar
- Problem: LFO is ±5V but want 0-10V for pitch modulation
- Solution: Attenuverter at 50%, offset at +5V
- Result: ±5V × 0.5 = ±2.5V, then +5V offset = 2.5V to 7.5V

### Pitch Transposition
- Problem: Want to shift sequence up an octave
- Solution: Patch through attenuverter at unity, add +1V offset

## Design Decisions

### Why 2 Channels (not 3)?
- Keeps HP width smaller (4HP vs 6HP)
- Matches our dual-channel pattern (S+H, VCA)
- 2 channels covers most use cases

### Why Separate Offset Knob (not Shades-style)?
- Shades uses daisy-chaining for offset (clever but confusing)
- Explicit offset knob is more intuitive
- No need for daisy-chain since we allow multiple cables from outputs

### Why 0V-Normalled Inputs?
- This is an inspired utility adaptation, not a panel-faithful Shades emulation.
- The dedicated offset controls already generate -5V to +5V without a cable.
- A 0V normal makes the transfer function unambiguous:
  `out = input * gain + offset`.
- Connection state is not inferred from sample amplitude, so patched silence
  remains silence.

## DSP References
- [Mutable Instruments Shades Manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/shades_2020/manual/)
- [Attenuverter - Wikipedia](https://en.wikipedia.org/wiki/Attenuverter)
- [Eurorack CV Standards](https://learningmodular.com/glossary/cv/)

## Sources
- [Mutable Instruments Shades 2020 Documentation](https://pichenettes.github.io/mutable-instruments-documentation/modules/shades_2020/manual/)
- [ModularGrid - Shades 2020](https://www.modulargrid.net/e/mutable-instruments-shades-2020)
- [2hp AVert](https://www.twohp.com/modules/avert)
- [ModularGrid - 2hp AVert](https://www.modulargrid.net/e/2hp-avert)
- [Doepfer A-183-1](https://doepfer.de/a1831.htm)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/atten.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Resolved the research/implementation contradiction in favor of the existing
  app-specific panel design: both inputs explicitly normal to 0V because each
  channel already owns a separate bipolar offset source.
- Inputs accept -10V to +10V and outputs declare the module's exact -10V to
  +10V clamp. Full counter-clockwise, center, and clockwise gain endpoints
  remain -1, 0, and +1.
- Non-finite controls and samples now recover to neutral values instead of
  propagating NaN through a rack. Reset clears both stable input and output
  buffers in place and restores the zero-voltage LED indication (0.5).
- Focused coverage exercises every knob endpoint, both channels, bipolar to
  unipolar conversion, offsets, rails, LED mapping, stable reset, finite
  recovery, and exact sample transfer.
- The strict 44.1/48/96 kHz by 128/512 matrix completes nine scenarios with
  finite output, zero voltage flags, stable buffers, exact 10.000V rails, and a
  maximum diagnostic time of 0.103ms per block.
