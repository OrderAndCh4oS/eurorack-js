# Compare 2 - Dual Window Comparator

Based on Joranalogue Audio Design Compare 2.

## Overview

A dual window comparator that checks if an input voltage falls between two threshold levels (the "window"). Unlike a simple comparator that triggers above a single threshold, a window comparator activates when the input is within a defined range. Includes a logic section combining both comparators' outputs.

## Sources

- [Joranalogue Official Product Page](https://joranalogue.com/products/compare-2)
- [ModularGrid](https://modulargrid.net/e/joranalogue-audio-design-compare-2)
- [Waveform Magazine Review](https://waveformmagazine.com/waveform-reviews/joranalogue-compare-2/)
- [Elevator Sound](https://www.elevatorsound.com/product/joranalogue-compare-2-eurorack-dual-comparator-module/)
- [Manua.ls Manual](https://www.manua.ls/joranalogue/compare-2/manual)

## Specifications

- **Width**: 8HP
- **Depth**: 30mm
- **Power**: +12V: 20mA, -12V: 15mA

## How Window Comparator Works

A window comparator has two thresholds: a lower and an upper. The output activates when the input voltage is between these thresholds (inside the "window").

```
Upper threshold ----+----
                    |    | Window (output HIGH when input is here)
Lower threshold ----+----
```

### Shift and Size Parameters

The window is defined by two parameters:
- **Shift**: Moves the entire window up or down (sets the center point)
- **Size**: Sets the distance between upper and lower thresholds (window width)

```
Upper threshold = Shift + (Size / 2)
Lower threshold = Shift - (Size / 2)
```

Example with Shift=0V, Size=2V:
- Upper threshold = +1V
- Lower threshold = -1V
- Output HIGH when input is between -1V and +1V

## Controls

### Per Comparator (x2)

| Control | Function | Range |
|---------|----------|-------|
| Shift knob | Center of detection window | -5V to +5V (0V at center) |
| Size knob | Width of detection window | 0V to 10V |
| Shift CV | Modulates shift | Added to knob |
| Size CV | Modulates size | Added to knob |

### Inputs

| Input | Function |
|-------|----------|
| In (left) | Signal input for comparator 1 |
| In (right) | Signal input for comparator 2 (normalled from left) |
| Shift CV (left) | CV for shift 1 (normalled to right) |
| Size CV (left) | CV for size 1 (normalled to right) |
| Shift CV (right) | CV for shift 2 |
| Size CV (right) | CV for size 2 |

### Outputs

| Output | Function |
|--------|----------|
| Out (per comparator) | Gate when input is INSIDE window (10V in our implementation) |
| Not (per comparator) | Gate when input is OUTSIDE window (inverted) |
| AND | Gate when BOTH comparators' Out are HIGH |
| OR | Gate when EITHER comparator's Out is HIGH |
| XOR | Gate when exactly ONE comparator's Out is HIGH |
| FF (Flip-Flop) | Toggles on rising edge of XOR output |

**Note**: Real Joranalogue outputs +5V gates; our implementation uses 10V to match system standard (0/10V gates).

## LED Behavior

Three-color LEDs per comparator:
- **Blue** (state=0): Input voltage is BELOW the window
- **Red** (state=1): Input voltage is ABOVE the window
- **White** (state=0.5): Input voltage is INSIDE the window
- **Off** (state=-1): Window size is negative AND signal is within this "negative window"

Logic section has LEDs for AND, OR, XOR, FF outputs (on/off only).

## Algorithm

### Window Comparator Logic

```javascript
function windowCompare(input, shift, size) {
    const halfSize = size / 2;
    const lower = shift - halfSize;
    const upper = shift + halfSize;

    // Inside window = output HIGH
    // Zero size means window is closed - never triggers
    const inside = size > 0 && input >= lower && input <= upper;

    return {
        out: inside ? 10 : 0,     // 10V gate when inside (system standard)
        not: inside ? 0 : 10,     // 10V gate when outside
        state: input < lower ? 'below' : (input > upper ? 'above' : 'inside')
    };
}
```

### Logic Section

```javascript
function logic(out1, out2, lastFF) {
    const a = out1 > 0;
    const b = out2 > 0;

    return {
        and: (a && b) ? 10 : 0,
        or: (a || b) ? 10 : 0,
        xor: (a !== b) ? 10 : 0,
        ff: lastFF  // Toggle on rising edge of out1
    };
}
```

### Flip-Flop Behavior

The FF output toggles state on each rising edge of the **XOR** signal (per manual):
- When XOR goes from LOW to HIGH, FF toggles
- FF stays at its current state otherwise
- This means FF toggles when one comparator changes state while the other stays the same

## Implementation Notes

### Normalization

- Left input is normalled to right input (same signal to both comparators if right not patched)
- Left Shift CV is normalled to right Shift CV
- Left Size CV is normalled to right Size CV

This allows modulating both comparators with single CV sources.

### Negative Size

When Size is negative (or CV pushes it negative), the window is "inverted" - the upper threshold is below the lower threshold. In this case, no input can be "inside" the window, so Out stays LOW and Not stays HIGH.

### Edge Cases

- Size = 0: Window is infinitely thin, practically never triggers
- Very large Size: Window encompasses full input range, always triggers
- Shift at extremes with large Size: Window clips at voltage rails

## Suggested Module Spec

```javascript
{
    id: 'cmp2',
    name: 'CMP2',
    hp: 8,
    category: 'utility',

    params: {
        shift1: 0,    // -5 to +5
        size1: 5,     // 0 to 10
        shift2: 0,
        size2: 5
    },

    inputs: {
        in1: 'cv',
        in2: 'cv',      // normalled from in1
        shiftCV1: 'cv',
        sizeCV1: 'cv',
        shiftCV2: 'cv', // normalled from shiftCV1
        sizeCV2: 'cv'   // normalled from sizeCV1
    },

    outputs: {
        out1: 'gate',
        not1: 'gate',
        out2: 'gate',
        not2: 'gate',
        and: 'gate',
        or: 'gate',
        xor: 'gate',
        ff: 'gate'
    },

    leds: ['state1', 'state2', 'and', 'or', 'xor', 'ff']
}
```

## Patch Ideas

1. **Rhythm from LFO**: Feed øchd into Compare 2, adjust window to extract gates at specific parts of the waveform
2. **Pulse width modulation**: Feed audio into input, adjust Size to change duty cycle of output pulses
3. **Frequency doubler**: Small window at zero crossing doubles trigger rate
4. **Complex gates**: Use logic outputs to combine two rhythm patterns
5. **Voltage-controlled swing**: Modulate Shift with slow LFO to vary when gates fire
6. **Audio-rate digital ring mod**: Feed two audio signals, use XOR output
