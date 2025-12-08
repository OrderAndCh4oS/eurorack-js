# 2hp Rnd (Random) Module Research

## Overview
Random voltage generator with stepped and smooth outputs, internal clock, and random gate output.

## Sources
- [2hp Official](https://www.twohp.com/modules/p/rnd)
- [ModularGrid](https://modulargrid.net/e/2hp-rnd-v2)
- [Pugix Review](https://pugix.com/synth/2hp-rnd-module/)
- [Elevator Sound](https://www.elevatorsound.com/product/2hp-rnd-v2-eurorack-random-voltage-generator-module/)

## Specifications
- Width: 2hp
- Depth: 42mm
- Power: 48mA +12V, 6mA -12V

## Panel Layout
- RATE knob - Clock speed (internal mode) or probability (external mode)
- AMP knob - Output amplitude (0 to max)
- CLK input - External clock input
- STEP output - Stepped random voltage (0-10V)
- SMOOTH output - Slewed random voltage
- GATE output - Clock out (internal) or random gates (external)

## Functionality

### Stepped Output
- Quantized random voltages (discrete steps, not musical scale)
- New voltage generated on each clock pulse
- Amplitude adjustable via AMP knob
- Range: 0V to 10V (or 0-5V via jumper)

### Smooth Output
- Same random source but with slew/smoothing applied
- Creates slowly evolving random modulation
- Good for gentle parameter drift

### Internal Clock Mode
- Rate knob controls clock speed
- Gate output = clock output (pulses when new random generated)
- Useful as standalone random source

### External Clock Mode
- Clocked by external signal
- Rate knob controls probability of gate firing
- Gate output = random gates (probabilistic)

### Self-Patching
- Patching Gate → Clock input creates random timing
- "Random voltage at random times"

## Implementation Notes

### DSP Approach
```javascript
// Stepped: sample & hold random on clock
if (clockRising) {
    steppedValue = Math.random() * 10 * amplitude;
}

// Smooth: slew the stepped value
smoothValue += (steppedValue - smoothValue) * slewRate;

// Gate: output clock (internal) or probabilistic gate (external)
```

### Considerations
- Use consistent random seed behavior for reproducibility option
- Smooth output needs adjustable slew rate (tied to rate knob inverse)
- Gate output voltage: 10V when high, 0V when low

## Use Cases
1. **Random melodies** - Step output → Quantizer → VCO
2. **Evolving textures** - Smooth output → Filter cutoff
3. **Generative rhythms** - Gate output → Drum triggers
4. **Parameter drift** - Smooth → any CV input for subtle movement
5. **Chaos patches** - Self-patch gate → clock for random timing
