# Clock Generator (clk)

## Hardware Reference
- **Based on**: [2hp Clk](http://www.twohp.com/modules/p/clk)
- **Manual**: [Clk Manual PDF](https://www.twohp.com/modules/p/clk) (download from product page)
- **ModularGrid**: [2hp Clk](https://www.modulargrid.net/e/2hp-clk)

## Specifications

### Features
- Voltage controlled clock generator
- Wide frequency range: 0.1 Hz to 10 kHz (10 second period to audio rate)
- Pause control with button and gate input
- LED indicates clock pulses
- Depth: 45mm

### Controls
- **Rate**: Clock frequency (exponential mapping)
- **Pause**: Button to pause/resume clock

### Inputs
- **Rate CV**: 0-10V modulates frequency
- **Pause**: Gate >2V pauses clock

### Outputs
- **Clock**: 10V trigger pulses (25% duty cycle)

### Indicators
- **Clock LED**: Flashes with each pulse

## DSP Implementation

### Algorithm Overview
Phase accumulator with variable frequency:
```
phase += freq / sampleRate
if (phase >= 1) {
    phase -= 1
    triggerPulse()
}
```

### Frequency Mapping
Exponential mapping over 5 decades:
```javascript
freq = 0.1 * Math.pow(100000, rate)  // 0.1Hz to 10kHz
```

### Pulse Generation
- Dynamic pulse width: 25% of period
- Maximum pulse width capped at 10ms (for low frequencies)
- Output: 0V (low) / 10V (high)

### Key Concepts
- **Phase accumulator**: Classic NCO (Numerically Controlled Oscillator) technique
- **Exponential frequency**: Matches musical perception (each turn of knob = same ratio change)
- **Pause state**: Stops phase accumulation, holds output low

## DSP References
- [NCO Design - Wikipedia](https://en.wikipedia.org/wiki/Numerically_controlled_oscillator)
- [Phase Accumulator - MusicDSP](https://www.musicdsp.org/en/latest/Synthesis/12-bandlimited-waveforms.html)

## Sources
- [2hp Clk Product Page](http://www.twohp.com/modules/p/clk)
- [ModularGrid - 2hp Clk](https://www.modulargrid.net/e/2hp-clk)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/clk.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
