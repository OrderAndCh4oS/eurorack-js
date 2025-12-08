# PWM Module Research

## Reference Module: Doepfer A-168-1

The A-168-1 is a PWM (Pulse Width Modulation) generator that converts any continuously varying signal into a rectangle/pulse wave with adjustable pulse width.

## How It Works

The module is essentially a **comparator with adjustable threshold**:

1. Input signal (triangle, saw, sine, envelope, etc.) is compared against a threshold voltage
2. When input > threshold: output goes HIGH (+5V)
3. When input < threshold: output goes LOW (-5V)
4. Adjusting the threshold changes the pulse width
5. Modulating the threshold with CV creates PWM

```
Input Signal (triangle)     Threshold (adjustable)     Output (pulse)
      /\                         ___________              _____
     /  \                       |           |            |     |
    /    \      ───────────────>|           |  ───────>  |     |
   /      \                     |___________|            |_____|
  /        \
```

## Specifications

| Spec | Value |
|------|-------|
| HP | 4 |
| Current | +20mA, -20mA |
| Depth | 20mm |

### Controls
- **PW knob** - Manual pulse width (0-100%)
- **PWM CV input** - External modulation with attenuator

### Inputs
- **In** - Signal input (triangle, saw, sine, envelope, random)

### Outputs
- **Out** - Pulse output with LED
- **/Out** - Inverted pulse output with LED

### Internal Trimmers (on hardware)
- PW centering - Sets 50% duty cycle at knob center
- PWM range - Calibrates full 0-100% sweep

## Technical Notes

- Output levels: ±5V (matches our gate standard when rectified, or bipolar for audio)
- Does NOT work with square wave input (no slope to compare against)
- The threshold is the sum of: manual PW offset + PWM CV input
- Works at both audio rates (VCO input) and modulation rates (LFO/envelope input)

## Our Implementation

### Inputs
- `in` - Audio/CV input signal
- `pwmCV` - PWM modulation CV input

### Outputs
- `out` - Pulse output
- `inv` - Inverted pulse output

### Parameters
- `pw` - Manual pulse width (0-1, center = 0.5 = 50%)
- `pwmAmt` - PWM CV attenuator amount (0-1)

### LEDs
- `out` - Shows output state
- `inv` - Shows inverted output state

### DSP

```javascript
// Convert PW knob (0-1) to threshold voltage
// At 0.5 (center), threshold = 0 for symmetric 50% duty cycle
// Full range should cover the typical ±5V input signal
const baseThreshold = (pw - 0.5) * 10; // -5V to +5V range

for (let i = 0; i < bufferSize; i++) {
    // Modulated threshold
    const threshold = baseThreshold + pwmCV[i] * pwmAmt * 5;

    // Comparator
    if (input[i] > threshold) {
        out[i] = 5;   // High
        inv[i] = -5;  // Low
    } else {
        out[i] = -5;  // Low
        inv[i] = 5;   // High
    }
}
```

## Use Cases

1. **Add PWM to LFO** - Feed LFO triangle into PWM, modulate with another LFO
2. **Add PWM to VCO** - Feed VCO saw/tri into PWM for pulse with CV-able width
3. **Rhythmic gating** - Feed envelope into PWM for variable-width gates
4. **Audio rate PWM** - Classic PWM sound from any oscillator
5. **Waveshaping** - Convert any wave to pulse at various duty cycles

## Sources

- [Doepfer A-168-1 Official Page](https://doepfer.de/a1681.htm)
- [Doepfer A-168-1 on ModularGrid](https://modulargrid.net/e/doepfer-a-168-1)
