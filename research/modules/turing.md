# Turing Machine - Random Looping Sequencer

Based on Music Thing Modular Turing Machine Mk II by Tom Whitwell.

## Overview

A binary shift register sequencer that generates random voltages which can be locked into repeating loops. Unlike traditional sequencers, you cannot program specific sequences - you steer the randomness and lock patterns you like.

## Sources

- [Music Thing Modular Official](https://www.musicthing.co.uk/Turing-Machine/)
- [ModularGrid](https://modulargrid.net/e/music-thing-modular-turing-machine-mk-ii-black)
- [Sound On Sound Review](https://www.soundonsound.com/reviews/music-thing-modular-turing-machine-mkii)
- [GitHub Repository](https://github.com/TomWhitwell/TuringMachine)

## Specifications

- **Width**: 10HP
- **Power**: +12V: 40mA, -12V: 0mA
- **Inspired by**: Triadex Muse, Buchla 266 Source of Uncertainty, Grant Richter's Noisering

## Algorithm

### Shift Register Core

1. 16-bit shift register (two 8-bit chips in hardware)
2. On each clock pulse, all bits shift one position
3. The bit that falls off the end is either:
   - Put back at the beginning unchanged (locked loop)
   - Maybe flipped based on probability (slip/random)
4. CV output is generated from 8 of these 16 bits through a DAC (R2R resistor ladder)
5. When all 8 bits are high = maximum voltage (~5V)
6. When all 8 bits are low = 0V

### Probability Control (Big Knob)

The lock knob feeds a voltage (-5V to +5V) to a comparator. The other input is white noise.

- **Knob fully CW (5 o'clock)**: High positive voltage, noise rarely exceeds it → bit never flips → locked loop
- **Knob at noon**: Zero voltage, 50% chance noise exceeds it → fully random
- **Knob fully CCW (7 o'clock)**: High negative voltage, noise always exceeds it → bit always flips → locked at 2x length

The "slip" zones (3 and 9 o'clock) have intermediate probabilities where sequences mostly loop but occasionally mutate.

## Controls

### Knobs

| Knob | Function | Range |
|------|----------|-------|
| Lock (big, unlabeled) | Probability of bit flip | CCW=2x lock, Noon=random, CW=lock |
| Scale | Output voltage range | 0 to ~5V |

### Switch

| Switch | Function |
|--------|----------|
| Length | Sequence length: 2, 3, 4, 5, 6, 8, 12, 16 steps |
| Write | Inject zero bit (momentary) |

### Inputs

| Input | Function |
|-------|----------|
| Clock | Trigger to advance sequence |
| CV | Voltage control of Lock knob position |

### Outputs

| Output | Function |
|--------|----------|
| CV | Main stepped voltage output (0-5V from DAC) |
| Pulse | Gate high when current step > threshold (~1.5V) |
| Noise | White noise (used internally, also available) |

## LED Behavior

8 LEDs show the current state of the 8 bits being read for CV output:
- All on = maximum voltage
- All off = 0V
- Pattern shows current register state

## Implementation Notes

### DSP Structure

```javascript
// 16-bit shift register as array of 0/1
let register = new Array(16).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);

// On each clock:
function step(lockAmount) {
    // lockAmount: 0 = random, 1 = locked, -1 = double-lock (always flip)

    const lastBit = register[15];

    // Determine if bit should flip
    const noise = Math.random() * 2 - 1; // -1 to +1
    const threshold = lockAmount; // -1 to +1
    const shouldFlip = noise > threshold;

    const newBit = shouldFlip ? (1 - lastBit) : lastBit;

    // Shift register
    for (let i = 15; i > 0; i--) {
        register[i] = register[i - 1];
    }
    register[0] = newBit;
}

// CV output from 8 bits (bits 0-7 or configurable)
function getCV(scale) {
    let value = 0;
    for (let i = 0; i < 8; i++) {
        value += register[i] * (1 << i); // Bit weight
    }
    // Normalize to 0-255, then scale to voltage
    return (value / 255) * scale * 5; // 0 to 5V max
}

// Pulse output
function getPulse() {
    const cv = getCV(1);
    return cv > 1.5 ? 10 : 0; // Gate voltage
}
```

### Length Implementation

The length switch doesn't change register size - it changes which bit wraps back:
- Length 8: Bit 7 wraps to bit 0
- Length 16: Bit 15 wraps to bit 0
- Length 2: Bit 1 wraps to bit 0

**Important**: The entire 16-bit register always shifts. CV is always read from bits 0-7.
Length affects which bit feeds back, not when CV repeats. With lock=1:
- Length 16: CV pattern repeats every 16 steps
- Length 8: A shorter feedback loop, but CV still derived from 8 bits of shifting register
- Length 2: Very short feedback loop creating faster-evolving patterns

The length setting creates different "flavors" of pattern evolution, not strict loop lengths.

### Edge Cases

- At exact noon (50% probability), sequence is truly random
- The "double lock" at CCW creates patterns 2x the length setting
- Write switch forces a 0 into the register, useful for resetting stuck patterns

## Suggested Module Spec

```javascript
{
    id: 'turing',
    name: 'TURING',
    hp: 8,
    category: 'sequencer',

    params: {
        lock: 0.5,    // 0=double-lock, 0.5=random, 1=lock
        scale: 0.8,   // Output voltage scaling
        length: 3     // Switch: 0-7 for lengths [2,3,4,5,6,8,12,16]
    },

    inputs: {
        clock: 'trigger',
        lockCV: 'cv'
    },

    outputs: {
        cv: 'cv',
        pulse: 'gate'
    },

    leds: ['bit0', 'bit1', 'bit2', 'bit3', 'bit4', 'bit5', 'bit6', 'bit7']
}
```

## Patch Ideas

1. **Self-generating melody**: Clock → Turing, CV → Quantizer → VCO
2. **Evolving rhythm**: Use Pulse output to trigger drums, slowly slip the pattern
3. **Dual voice**: Two Turings at different lengths for polyrhythmic melodies
4. **CV-controlled chaos**: LFO → Lock CV to sweep between locked and random
