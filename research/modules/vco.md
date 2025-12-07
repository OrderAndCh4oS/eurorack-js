# Voltage Controlled Oscillator (vco)

## Hardware Reference
- **Based on**: [2hp VCO](https://www.twohp.com/modules/p/vco) / CEM3340 IC
- **Chip Datasheet**: [CEM3340 Designs - Electric Druid](https://electricdruid.net/cem3340-vco-voltage-controlled-oscillator-designs/)
- **ModularGrid**: [2hp VCO](https://www.modulargrid.net/e/2hp-vco)

## Specifications

### Features
- CEM3340-based analog oscillator architecture
- PolyBLEP anti-aliased waveforms
- Simultaneous triangle, sawtooth, and pulse outputs
- 1V/Oct tracking across 10+ octaves
- Hard sync input
- Linear FM input
- Pulse width modulation

### Power (Hardware)
- +12V: 27mA
- -12V: 24mA
- Depth: 42mm

### Controls
- **Coarse**: Base frequency (4.3Hz - 22kHz exponential)
- **Fine**: ±6 semitone detune
- **Glide**: Portamento time (0-100ms)

### Inputs
- **V/Oct**: Pitch CV (1V/octave standard)
- **FM**: Linear frequency modulation
- **PWM**: Pulse width modulation (0-5V maps to 5%-95% duty)
- **Sync**: Hard sync input (rising edge resets phase)

### Outputs
- **Triangle**: ±5V triangle wave
- **Ramp**: ±5V sawtooth wave (anti-aliased)
- **Pulse**: ±5V pulse/square wave (anti-aliased)

## CEM3340 IC Reference

### Original Output Levels
| Output | Level (±15V supply) | Level (±12V supply) |
|--------|--------------------|--------------------|
| Ramp | 0-10V (2/3 Vcc) | 0-8V |
| Triangle | 0-5V (1/3 Vcc) | 0-4V |
| Pulse | 0-13.7V (Vcc-1.3V) | 0-10.7V |

### Key Features
- On-chip temperature compensation (pins 1-2)
- High-frequency tracking compensation (pin 7)
- Hard and soft sync inputs (pins 6, 9)
- Linear FM input with bias network (pin 13)
- 1nF timing capacitor (low-leakage mica recommended)

## DSP Implementation

### Phase Accumulator
```javascript
// Core oscillator uses normalized phase [0, 1)
phase = (phase + freq / sampleRate) % 1;
```

### Frequency Calculation
```javascript
// V/Oct exponential conversion
const base = expMap(coarse, 4.3, 22000);  // Exponential knob
const freq = base * Math.pow(2, vOct) * Math.pow(2, fine / 12);
// Add linear FM
const finalFreq = Math.max(0, freq + fmValue * fmVoltsPerHz);
```

### PolyBLEP Anti-Aliasing

The PolyBLEP (Polynomial Band-Limited Step) algorithm reduces aliasing at waveform discontinuities:

```javascript
function polyBlep(t, dt) {
    // t = current phase [0, 1)
    // dt = phase increment per sample
    if (t < dt) {
        // Near start of period
        const x = t / dt;
        return x + x - x * x - 1;
    } else if (t > 1 - dt) {
        // Near end of period
        const x = (t - 1) / dt;
        return x * x + x + x + 1;
    }
    return 0;
}
```

### Waveform Generation

```javascript
// Naive waveforms (would alias)
let sawVal = 2 * phase - 1;           // -1 to +1
let sqrVal = phase < duty ? 1 : -1;   // ±1

// Apply PolyBLEP corrections
sawVal -= polyBlep(phase, inc);                    // One discontinuity per period
sqrVal += polyBlep(phase, inc);                    // Rising edge
sqrVal -= polyBlep((phase + 1 - duty) % 1, inc);   // Falling edge

// Triangle (no aliasing - continuous derivative)
const triVal = 4 * Math.abs(phase - 0.5) - 1;

// Scale to ±5V Eurorack standard
out = waveVal * 5;
```

### Hard Sync
```javascript
// Reset phase on rising edge of sync input
if (lastSync <= 0 && syncVal > 0) {
    phase = 0;
}
lastSync = syncVal;
```

### PWM Implementation
```javascript
// PWM CV (0-5V) maps to 5%-95% duty cycle
const duty = 0.05 + clamp(pwmVal, 0, 5) / 5 * 0.90;
const sqrVal = phase < duty ? 1 : -1;
```

## Anti-Aliasing Theory

### Why Aliasing Occurs
- Digital sampling creates mirror frequencies at Nyquist
- Sharp waveform discontinuities contain infinite harmonics
- Harmonics above Nyquist fold back as audible artifacts

### PolyBLEP Advantages
- Computationally efficient (simple polynomial)
- No pre-calculation required (unlike minBLEP)
- Better than wavetables for real-time modulation
- Slightly duller than minBLEP but acceptable quality

### Alternative Methods
| Method | Quality | CPU | Complexity |
|--------|---------|-----|------------|
| Naive | Poor | Low | Simple |
| PolyBLEP | Good | Low | Moderate |
| DPW | Good | Low | Moderate |
| minBLEP | Excellent | Medium | High |
| Wavetable | Variable | Low | Moderate |
| Oversampling | Excellent | High | Simple |

## DSP References
- [PolyBLEP Oscillator - Martin Finke](https://www.martin-finke.de/articles/audio-plugins-018-polyblep-oscillator/) - Tutorial with code
- [Antialiasing Oscillators - IEEE](https://ieeexplore.ieee.org/document/4117934/) - Academic paper
- [KVR Forum: PolyBLEP](https://www.kvraudio.com/forum/viewtopic.php?t=375517) - Discussion and variants
- [DAFX 2017: Efficient Anti-aliasing](http://www.dafx17.eca.ed.ac.uk/papers/DAFx17_paper_100.pdf) - Complex waveforms

## Hardware References
- [CEM3340 VCO Designs - Electric Druid](https://electricdruid.net/cem3340-vco-voltage-controlled-oscillator-designs/)
- [CEM3340 - Synth DIY Wiki](https://sdiy.info/wiki/CEM3340)
- [AS3340 Reissue - Alfa](https://www.alfarzpp.lv/eng/sc/AS3340.php)

## Potential Improvements
- Add soft sync mode
- Implement sub-oscillator output
- Add waveform mixing/morphing
- Through-zero FM for cleaner modulation
- Implement wavetable mode option

## Sources
- [2hp VCO Product Page](https://www.twohp.com/modules/p/vco)
- [ModularGrid - 2hp VCO](https://www.modulargrid.net/e/2hp-vco)
- [Electric Druid CEM3340](https://electricdruid.net/cem3340-vco-voltage-controlled-oscillator-designs/)
