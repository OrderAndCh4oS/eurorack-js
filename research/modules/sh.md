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
