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
- Peak detection for LED updates
- Implements audio silence pattern for cable disconnection

## DSP References
- [Summing Amplifier](https://www.electronics-tutorials.ws/opamp/opamp_4.html) - Basic theory
- [MusicDSP - Mixer](https://www.musicdsp.org/en/latest/Effects/22-saturated-amplifier-or-mixer.html) - Saturation considerations

## Sources
- [2hp Mix Product Page](http://www.twohp.com/modules/p/mix)
- [ModularGrid - 2hp Mix](https://www.modulargrid.net/e/2hp-mix)
