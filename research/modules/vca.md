# Voltage Controlled Amplifier (vca)

## Hardware Reference
- **Based on**: [2hp VCA](http://www.twohp.com/modules/p/vca)
- **Manual**: [VCA Manual PDF](https://www.twohp.com/modules/p/vca) (download from product page)
- **ModularGrid**: [2hp VCA](https://www.modulargrid.net/e/2hp-vca-black)
- **Chip**: SSM2164 / SSI2164 quad VCA architecture

## Specifications

### Features
- Dual linear VCA based on 2164 architecture
- Extremely low distortion
- DC-coupled for audio or CV
- CV input with attenuator on channel 2
- Depth: 45mm

### Controls
- **Ch1 Gain**: Channel 1 level (0-100%)
- **Ch2 Gain**: Channel 2 level (0-100%)

### Inputs
- **In 1**: Channel 1 audio/CV input
- **In 2**: Channel 2 audio/CV input
- **CV**: Channel 2 CV control (0-5V = silence to unity)

### Outputs
- **Out 1**: Channel 1 output
- **Out 2**: Channel 2 output (CV controlled)

### Indicators
- **Ch1 LED**: Channel 1 output level
- **Ch2 LED**: Channel 2 output level

## DSP Implementation

### Algorithm Overview
Linear VCA with CV control:
```
output = input × gain × cvResponse(cv)
```

Where `cvResponse` maps 0-5V to 0-1 (linear).

### CV Response Modes

#### Linear Response (Our Implementation)
```javascript
gain = clamp(cv, 0, 5) / 5
```
- 0V = silence
- 5V = unity gain
- Linear relationship between CV and amplitude

#### Exponential Response (Native SSM2164)
The hardware SSM2164 has exponential response (-33mV/dB):
```javascript
// For true 2164 emulation:
gain = 10^(min(20, -cv * 5000 / 0.033) / 20)
```

### CV Smoothing
Uses slew limiting (3ms time constant) on CV input to prevent clicks:
```javascript
const cvSlew = createSlew({ sampleRate, timeMs: 3 });
smoothedCV = cvSlew.process(rawCV);
```

### Key Concepts
- **Linear vs Exponential**: We use linear for simplicity; hardware 2164 is exponential
- **Slew limiting**: Capacitor-smoothed CV prevents audible stepping
- **LED decay**: Smooth visual feedback (~100ms decay)

## DSP References
- [SSI2164 Datasheet](https://www.soundsemiconductor.com/downloads/ssi2164datasheet.pdf) - Official specs
- [SSM2164 in CircuitJS](https://blog.30350n.de/ssm2164_in_circuitjs/) - Simulation
- [electro-music.com - SSM2164 VCAs](https://electro-music.com/wiki/pmwiki.php?n=Schematics.SSM2164BasedVCAs) - Schematics
- [Synthrotek MST Dual 2164](https://www.synthrotek.com/products/mst-eurorack-modules/mst-dual-2164-vca/) - Build docs
- [Mike Irwin Linearization](http://clsound.com/quadvca.html) - Linear VCA technique

## Implementation Notes

### Differences from Hardware
1. **Response curve**: We use linear; hardware is exponential
2. **Gain staging**: Simplified to 0-1 range
3. **Noise floor**: Perfect digital (no analog noise)

### Potential Improvements
- Add exponential response mode switch
- Implement soft clipping at high gains
- Add CV attenuverter knob

## Sources
- [2hp VCA Product Page](http://www.twohp.com/modules/p/vca)
- [ModularGrid - 2hp VCA](https://www.modulargrid.net/e/2hp-vca-black)
- [SSM2164 Overview](https://www.allelcoelec.com/blog/Exploring-the-SSM2164-VCA-Feature,Schematic,and-Alternatives.html)
