# Clock Divider/Multiplier (div)

## Hardware Reference
- **Based on**: [2hp Div](http://www.twohp.com/modules/p/div)
- **Manual**: [Div Manual PDF](https://www.twohp.com/modules/p/div) (download from product page)
- **ModularGrid**: [2hp Div](https://www.modulargrid.net/e/2hp-div)

## Specifications

### Features
- 2 channel voltage controlled clock divider/multiplier
- Division ratios: /16, /8, /7, /6, /5, /4, /3, /2
- Unity: x1
- Multiplication ratios: x2, x3, x4, x5, x6, x7, x8, x16
- Individual rate knob and CV per channel
- Creates dynamic rhythms from single clock

### Power (Hardware)
- +12V: 30mA
- -12V: 3mA
- Depth: 46mm

### Controls
- **Rate 1**: Division/multiplication ratio for channel 1
- **Rate 2**: Division/multiplication ratio for channel 2

### Inputs
- **Clock In**: Trigger input (threshold: 2.5V)
- **CV 1**: Rate modulation for channel 1 (0-5V)
- **CV 2**: Rate modulation for channel 2 (0-5V)

### Outputs
- **Out 1**: Channel 1 divided/multiplied clock
- **Out 2**: Channel 2 divided/multiplied clock

### Indicators
- **Ch1 LED**: Channel 1 output activity
- **Ch2 LED**: Channel 2 output activity

## DSP Implementation

### Algorithm Overview

#### Division Mode (ratio < 1)
Counts input clock edges, outputs on every Nth edge:
```javascript
if (clockEdge && counter % divideBy === 0) {
    triggerPulse()
}
counter++
```

#### Multiplication Mode (ratio > 1)
Measures input period, generates evenly-spaced pulses:
```javascript
// Track input period
if (clockEdge) {
    lastPeriod = samplesSinceLastClock
    samplesSinceLastClock = 0
}

// Generate pulses at subdivisions
phasePerPulse = lastPeriod / multiplyBy
if (samplesSinceLastClock % phasePerPulse === 0) {
    triggerPulse()
}
```

### Ratio Table
| Knob Position | Ratio | Effect |
|---------------|-------|--------|
| 0.0 | /16 | Divide by 16 |
| 0.25 | /4 | Divide by 4 |
| 0.5 | x1 | Unity (passthrough) |
| 0.75 | x4 | Multiply by 4 |
| 1.0 | x16 | Multiply by 16 |

### Key Concepts
- **Edge detection**: Rising edge on clock input (>2.5V threshold)
- **Period tracking**: Measures time between clock edges for multiplication
- **Pulse matching**: Output pulse height matches input pulse height

## DSP References
- [Clock Dividers - Learning Modular](https://learningmodular.com/glossary/clock-divider/)
- [Euclidean Rhythms](https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf) - Related rhythmic concepts

## Sources
- [2hp Div Product Page](http://www.twohp.com/modules/p/div)
- [ModularGrid - 2hp Div](https://www.modulargrid.net/e/2hp-div)
