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

The app only extrapolates multiplied pulses within the most recently measured
period. If no new clock edge arrives after that window, multiplied outputs stop.
When the clock cable is removed, the graph restores the stable Clock input
buffer to its 0V normal. DIV naturally stops extrapolating after the final
measured period; it does not depend on a module-specific cable cleanup hook.

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

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/div.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Clock is a 0-10V trigger input with the documented strict >2.5V threshold;
  Rate CV 1/2 are 0-5V controls; outputs are bounded 0-10V triggers that retain
  the connected input pulse height within those rails.
- Multiplication now uses a rounded, minimum-one-sample interval. This avoids
  modulo-by-zero at high ratios and short measured periods, while a focused
  1kHz fixture verifies x4 at exact quarter-period subdivisions.
- Multiplied pulses stop naturally after the last measured period when Clock
  returns to its 0V normal. The obsolete disconnect callback was removed to
  follow the compiled graph's stable-input contract.
- Electrical pulses remain 1ms. Independent 50ms activity timers make both LEDs
  visible without lengthening trigger outputs.
- Non-finite parameters and samples recover to safe defaults, and reset clears
  all timing state plus stable input/output buffers in place.
- Focused and module-contract validation passes 39 assertions. The strict
  44.1/48/96kHz by 128/512 matrix completes five scenarios with finite output,
  zero voltage flags, stable buffers, exact 10.000V peaks, and a maximum Node
  diagnostic time below 0.156ms per block.
