# Maths Module Research

## Overview

Based on: Make Noise MATHS
A dual function generator / analog computer for generating envelopes, LFOs, slew, and complex CV.

## References

- [Make Noise MATHS Official](https://www.makenoisemusic.com/modules/maths/)
- [MATHS Manual PDF](https://www.makenoisemusic.com/wp-content/uploads/2024/03/MATHSmanual2013.pdf)
- [ModularGrid - Make Noise Maths](https://modulargrid.net/e/make-noise-maths--)
- [Ali Jamieson - Maths for Beginners](https://alijamieson.co.uk/2016/11/02/make-noise-maths-beginners/)

## Original Module Specifications

- **HP:** 20
- **Power:** 60mA @ +12V, 50mA @ -12V
- **Price:** ~$290

## Original Architecture

MATHS has 4 channels:

### Channels 1 & 4 - Function Generators
- Rise knob (time for voltage to go from 0 to peak)
- Fall knob (time for voltage to decay from peak to 0)
- Vari-Response knob (curve shape: logarithmic → linear → exponential)
- Cycle button (enables self-cycling for LFO/VCO mode)
- Signal IN (for slew/lag/portamento)
- Trigger IN (triggers envelope)
- Fall CV IN (+/-8V modulates fall time)
- Cycle IN (gate input to enable cycling)
- Variable OUT (processed signal, 0-8V cycling, +/-10V with input)
- Unity OUT (unattenuated output, NOT on SUM/OR bus)
- EOR (End of Rise) - CH.1 only, gate output
- EOC (End of Cycle) - CH.4 only, gate output

### Channels 2 & 3 - Attenuverters
- Attenuverter knob
- Signal IN (normalized to +10V for CH.2, +5V for CH.3)
- Output to SUM/OR bus only (no dedicated output)

### Mix Bus Outputs
- SUM: Sum of all 4 channels (+/-10V)
- INV: Inverted SUM (+/-10V)
- OR: Analog OR of all 4 channels (0-10V)

## Timing Range

- Slowest: 25 minutes (Rise+Fall full CW with CV)
- Fastest: 1kHz (audio rate)

## Response Curves

Vari-Response control shapes Rise/Fall curves:
- **Logarithmic** (CCW): Slow curve, good for portamento
- **Linear** (center): Straight line, triangle LFO
- **Exponential** (CW): Fast/punchy, percussive envelopes

## Simplified Implementation: FUNC

Given Maths is 20HP with complex routing, we'll implement a simplified **FUNC** (Function Generator) module based on Make Noise Function (single channel Maths):

### FUNC Module Design (8HP)

**Knobs:**
- Rise (0.5ms to 10s)
- Fall (0.5ms to 10s)
- Curve (log → linear → exp)

**Switches:**
- Cycle (off/on)

**Inputs:**
- In (signal input for slew/envelope following)
- Trig (trigger input)
- RiseCV (rise time CV)
- FallCV (fall time CV)
- CycleCV (gate to enable cycling)

**Outputs:**
- Out (function output, 0-10V)
- Inv (inverted, 10-0V)
- EOR (end of rise gate)
- EOC (end of cycle gate)

**LED:**
- Level indicator (follows output)

## DSP Algorithm

### Function Generator Core

```javascript
// State
let phase = 0;        // 0 = idle, 0-0.5 = rising, 0.5-1 = falling
let output = 0;
let rising = false;

// On trigger or cycle restart:
phase = 0;
rising = true;

// Per sample:
if (rising) {
    // Calculate rise increment based on rise time
    const riseTime = baseRise * Math.pow(2, riseCV);
    const riseInc = 1 / (riseTime * sampleRate * 2); // *2 because rise is half cycle
    phase += riseInc;

    if (phase >= 0.5) {
        phase = 0.5;
        rising = false;
        // Trigger EOR
    }
} else if (phase > 0) {
    // Falling
    const fallTime = baseFall * Math.pow(2, fallCV);
    const fallInc = 1 / (fallTime * sampleRate * 2);
    phase += fallInc;

    if (phase >= 1) {
        phase = 0;
        // Trigger EOC
        if (cycling) {
            phase = 0;
            rising = true;
        }
    }
}

// Apply curve shaping
let shaped;
if (rising) {
    // 0 to 0.5 → 0 to 1
    const t = phase * 2;
    shaped = applyCurve(t, curve);
} else {
    // 0.5 to 1 → 1 to 0
    const t = (phase - 0.5) * 2;
    shaped = 1 - applyCurve(t, curve);
}

output = shaped * 10; // 0-10V
```

### Curve Shaping

```javascript
function applyCurve(t, curve) {
    // curve: 0 = log, 0.5 = linear, 1 = exp
    if (curve < 0.5) {
        // Logarithmic (slow start, fast end)
        const logAmount = (0.5 - curve) * 2; // 0-1
        const logT = Math.pow(t, 0.3 + (1 - logAmount) * 0.7);
        return t * (1 - logAmount) + logT * logAmount;
    } else {
        // Exponential (fast start, slow end)
        const expAmount = (curve - 0.5) * 2; // 0-1
        const expT = Math.pow(t, 1 + expAmount * 3);
        return t * (1 - expAmount) + expT * expAmount;
    }
}
```

### Slew Limiter Mode

When signal is patched to IN (without trigger), acts as slew limiter:

```javascript
const target = input;
const diff = target - output;

if (diff > 0) {
    // Rising - use rise rate
    const maxChange = 10 / (riseTime * sampleRate);
    output += Math.min(diff, maxChange);
} else {
    // Falling - use fall rate
    const maxChange = 10 / (fallTime * sampleRate);
    output += Math.max(diff, -maxChange);
}
```

## Voltage Standards

- **Output:** 0-10V (unipolar CV)
- **Inverted Output:** 10V - output
- **EOR/EOC:** 0V/10V gates (5ms pulse width)
- **CV Inputs:** +/-5V modulates time exponentially
- **Cycle Input:** >2.5V enables cycling

## Test Cases

1. **Trigger response:** Output rises then falls on trigger
2. **Rise time:** Verify timing accuracy across range
3. **Fall time:** Verify timing accuracy across range
4. **Curve shapes:** Log/linear/exp produce different shapes
5. **Cycle mode:** Self-triggers at EOC
6. **EOR gate:** Fires at peak
7. **EOC gate:** Fires at end
8. **Slew mode:** Smoothly follows input
9. **CV modulation:** Rise/Fall CV affects timing
10. **Cycle CV:** Gate input enables/disables cycling

## Patch Ideas

### Basic Envelope
- Trigger from gate
- Out to VCA CV
- Adjust Rise/Fall for attack/release

### LFO
- Enable Cycle
- Adjust Rise/Fall for rate and shape
- Use Curve for waveform (triangle → saw)

### Portamento/Glide
- Patch V/Oct through In
- Set Rise/Fall equal for symmetric glide
- Out to VCO V/Oct

### Envelope Following
- Patch audio to In
- Short Rise, longer Fall
- Out follows amplitude

### Ping-Pong / Complex Functions
- Patch EOC back to Trig of another FUNC
- Chain function generators for complex shapes
