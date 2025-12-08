# øchd - 8x Free-Running LFO

Based on Instruo/DivKid øchd designed by Ben "DivKid" Wilson.

## Overview

Eight independent, free-running analogue triangle LFOs in 4HP. The outputs are arranged from fastest (top) to slowest (bottom), with frequencies tuned by ear for musical usefulness rather than mathematical ratios. The LFOs are deliberately unsynchronized, creating organic drifting modulation.

## Sources

- [Instruo Official Product Page](https://www.instruomodular.com/product/ochd/)
- [ModularGrid](https://modulargrid.net/e/divkid-ochd)
- [Elevator Sound](https://www.elevatorsound.com/product/instruo-divkid-ochd-eurorack-multi-lfo-module/)
- [DivKid Announcement](https://divkidvideo.com/ochd-the-second-divkid-eurorack-module/)
- [Mod Wiggler Discussion](https://modwiggler.com/forum/viewtopic.php?t=225778)

## Specifications

- **Width**: 4HP
- **Depth**: 32mm
- **Power**: +12V: 80mA, -12V: 80mA

## Output Characteristics

- **Waveform**: Triangle (all outputs)
- **Voltage Range**: 10Vpp bipolar (-5V to +5V)
- **Frequency Range**: 160Hz (fastest, top) to 25-minute cycle (slowest, bottom)
- **Arrangement**: Output 1 (top) fastest → Output 8 (bottom) slowest

## Controls

### Knobs

| Knob | Function | Range |
|------|----------|-------|
| Rate | Global frequency control for all 8 LFOs | Scales all frequencies together |

### Inputs

| Input | Function |
|-------|----------|
| Rate CV | Modulates global rate with attenuverter |

### Outputs

| Output | Function |
|--------|----------|
| 1 (top) | Fastest LFO (~160Hz max at full rate) |
| 2 | Second fastest |
| 3 | Third fastest |
| 4 | Fourth fastest |
| 5 | Fifth fastest |
| 6 | Sixth fastest |
| 7 | Seventh fastest |
| 8 (bottom) | Slowest LFO (25-minute cycle at minimum rate) |

## LED Behavior

Each output has a bipolar LED indicator showing the current LFO position:
- Lights one color when positive
- Lights opposite color when negative
- Brightness indicates amplitude

## Algorithm

### Frequency Relationships

The frequencies are NOT mathematically synchronized. They were tuned by ear to create musical relationships. Based on the specified range (160Hz to 25-minute cycles), we can derive approximate frequency ratios.

A reasonable implementation approach:

```javascript
// Approximate frequency multipliers relative to base rate
// Top (1) is fastest, bottom (8) is slowest
// These create musically useful but non-harmonic relationships
const frequencyMultipliers = [
    1.0,      // Output 1: Base rate (fastest)
    0.54,     // Output 2: ~half speed
    0.29,     // Output 3
    0.16,     // Output 4
    0.087,    // Output 5
    0.047,    // Output 6
    0.026,    // Output 7
    0.014     // Output 8: ~1/70th of base (slowest)
];

// At knob = 1.0 (max), output 1 = 160Hz
// At knob = 0.0 (min), output 8 = 1/1500 Hz (25 min cycle)
```

### Rate Knob Behavior

The rate knob controls all 8 LFOs globally:
- Fully CW: Output 1 reaches ~160Hz (audio rate)
- Fully CCW: Output 8 reaches ~25 minute cycle time
- CV can extend range even lower with negative voltages

### CV Input Behavior

- Positive CV: Increases rate
- Negative CV: Decreases rate, can stall oscillators ("track and hold")
- Attenuverter allows inverting the CV response

### Track and Hold Feature

With negative CV, the oscillators can be stalled, freezing their current output value. This allows using gates to "sample" the LFO at specific moments.

## Implementation Notes

### DSP Structure

```javascript
// 8 independent triangle oscillators
const phases = new Array(8).fill(0).map(() => Math.random()); // Start at random phases
const directions = new Array(8).fill(1); // 1 = rising, -1 = falling

function process(sampleRate) {
    // Calculate base frequency from rate knob + CV
    const baseFreq = calculateBaseFreq(rateKnob, rateCV);

    for (let lfo = 0; lfo < 8; lfo++) {
        const freq = baseFreq * frequencyMultipliers[lfo];
        const phaseInc = freq / sampleRate;

        // Update phase
        phases[lfo] += directions[lfo] * phaseInc;

        // Triangle oscillator: reverse at peaks
        if (phases[lfo] >= 1) {
            phases[lfo] = 1;
            directions[lfo] = -1;
        } else if (phases[lfo] <= 0) {
            phases[lfo] = 0;
            directions[lfo] = 1;
        }

        // Output: phase 0-1 mapped to -5V to +5V
        outputs[lfo] = (phases[lfo] * 2 - 1) * 5;
    }
}
```

### Base Frequency Calculation

```javascript
// Rate knob 0-1 maps to frequency range
// Using exponential scaling for musical response
function calculateBaseFreq(knob, cv) {
    // Knob at 0: base freq for slowest cycle time
    // Knob at 1: base freq = 160Hz (for output 1)
    // Output 8's multiplier (~0.014) gives 25-min cycle when base is very slow

    const minBaseFreq = 0.0007; // ~0.0007 Hz * 0.014 = 25 min cycle for out 8
    const maxBaseFreq = 160;    // 160 Hz for output 1 at max

    // Exponential scaling
    const effectiveKnob = Math.max(0, Math.min(1, knob + cv / 5));
    return minBaseFreq * Math.pow(maxBaseFreq / minBaseFreq, effectiveKnob);
}
```

### Random Initial Phases

Important: Each LFO should start at a random phase to maintain the "organic" character. They should never be phase-aligned.

## Suggested Module Spec

```javascript
{
    id: 'ochd',
    name: 'OCHD',
    hp: 4,
    category: 'modulator',

    params: {
        rate: 0.5  // Global rate 0-1
    },

    inputs: {
        rateCV: 'cv'
    },

    outputs: {
        out1: 'cv',
        out2: 'cv',
        out3: 'cv',
        out4: 'cv',
        out5: 'cv',
        out6: 'cv',
        out7: 'cv',
        out8: 'cv'
    },

    leds: ['led1', 'led2', 'led3', 'led4', 'led5', 'led6', 'led7', 'led8']
}
```

## Patch Ideas

1. **Organic movement**: Patch all 8 outputs to different parameters (filter cutoff, VCO pitch, VCA level, PWM, etc.) for constantly evolving patches
2. **Slow modulation**: Use bottom outputs for slow filter sweeps and drones
3. **Audio rate modulation**: Use top output at max rate for FM/AM effects
4. **Self-patching**: Route an output back into rate CV for complex waveshaping
5. **Polyrhythmic triggers**: Use multiple outputs through comparators for non-repeating trigger patterns
