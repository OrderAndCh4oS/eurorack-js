# Sample & Hold (sh)

## Hardware Reference
- **Based on**: [2hp S+H](https://www.twohp.com/modules/sh)
- **Manual**: [S+H Manual PDF](https://www.twohp.com/modules/sh) (download from product page)
- **ModularGrid**: [2hp S+H](https://www.modulargrid.net/e/2hp-s-h)

## Specifications

### Features
- Analog sample and hold
- 2 independent channels
- Wide input range: ±12V
- Clocks fast enough to downsample audio
- Depth: 45mm

### Power (Hardware)
- +12V: 5mA (varies by source, some list 34mA)
- -12V: 5mA (varies by source, some list 35mA)

### Controls
- **Slew 1**: Glide time for channel 1 output (0-50ms)
- **Slew 2**: Glide time for channel 2 output (0-50ms)

### Inputs
- **In 1**: Signal input channel 1 (±12V)
- **In 2**: Signal input channel 2 (±12V)
- **Trig 1**: Trigger input channel 1 (≥1V rising edge)
- **Trig 2**: Trigger input channel 2 (≥1V rising edge)

### Outputs
- **Out 1**: Sampled voltage channel 1
- **Out 2**: Sampled voltage channel 2

### Indicators
- **Ch1 LED**: Shows held voltage level
- **Ch2 LED**: Shows held voltage level

## DSP Implementation

### Algorithm Overview
On trigger rising edge, capture input and hold:
```javascript
if (trigger >= 1 && lastTrigger < 1) {
    heldValue = inputValue
}
lastTrigger = trigger
output = heldValue
```

### Edge Detection
```javascript
const triggerHigh = trigger >= 1
const risingEdge = triggerHigh && lastTrigger < 1
lastTrigger = trigger
```

### Slew Limiting
Optional glide between held values:
```javascript
if (slewEnabled) {
    output = slew.process(heldValue)  // One-pole lowpass
} else {
    slew.reset(heldValue)             // keep the filter aligned while bypassed
    output = heldValue
}
```

Slew time: 0 to 50ms (controlled by knob)

### Key Concepts
- **Sample on edge**: Only samples on rising edge, not while gate is high
- **Track and hold**: Holds last sampled value until next trigger
- **Slew limiting**: Smooth transitions between steps (portamento effect)

## Common Uses

### Random Voltages
- Input: Noise source
- Trigger: Clock
- Result: Stepped random CV for pitch, filter, etc.

### Arpeggios
- Input: Sawtooth LFO
- Trigger: Fast clock
- Result: Stepped ramp = arpeggio pattern

### Audio Downsampling
- Input: Audio signal
- Trigger: High-speed clock
- Result: Lo-fi/bitcrushed audio

### CV Quantization (time-based)
- Input: Continuous CV
- Trigger: Clock
- Result: Rhythmically quantized modulation

## DSP References
- [Sample and Hold - Wikipedia](https://en.wikipedia.org/wiki/Sample_and_hold)
- [S&H Circuits - Electronics Tutorials](https://www.electronics-tutorials.ws/waveforms/555_oscillator.html)
- [Track and Hold - Analog Devices](https://www.analog.com/en/technical-articles/track-and-hold-amplifiers.html)

## Sources
- [2hp S+H Product Page](https://www.twohp.com/modules/sh)
- [ModularGrid - 2hp S+H](https://www.modulargrid.net/e/2hp-s-h)
- [Elevator Sound - 2hp S+H](https://www.elevatorsound.com/product/2hp-sh-eurorack-sample-hold-module/)
- [Perfect Circuit - 2hp S+H](https://www.perfectcircuit.com/2hp-s-h-sample-and-hold.html)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/sh.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Removed a hidden 0-0.5ms dead zone: exact zero remains a sample-exact bypass,
  while every positive knob value now applies the requested 0-50ms RC slew.
- The internal slew state tracks the held voltage while bypassed. Enabling slew
  after holding 5V therefore stays at 5V instead of falling toward 0V and
  climbing back.
- A 50ms one-time-constant fixture matches `1 - exp(-1)` at 44.1, 48, and 96
  kHz. Same-sample edge capture, the >=1V threshold, sustained-high behavior,
  both independent channels, and audio-rate clocks remain covered.
- Signal inputs and outputs explicitly support -12V to +12V; trigger inputs
  declare 0-10V with 0V normals. Non-finite signals, triggers, and controls
  cannot poison held or filter state.
- Reset clears all four stable input buffers and both outputs, held values,
  edge history, filters, and LEDs in place.
- The strict 44.1/48/96 kHz by 128/512 matrix completes five scenarios with
  finite output, zero voltage flags, stable buffers, and a maximum diagnostic
  time below 0.194ms per block.
