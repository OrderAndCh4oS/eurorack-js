# Step Sequencer (seq)

## Hardware Reference
- **Based on**: Doepfer A-155-2 Analog Sequencer
- **ModularGrid**: [Doepfer A-155](https://www.modulargrid.net/e/doepfer-a-155)

## Specifications

### Features
- 8 step CV/Gate sequencer
- Per-step CV knobs (0-1V / 0-2V / 0-4V range)
- Per-step gate on/off buttons
- 8 direction modes
- Adjustable sequence length (1-8 steps)
- Per-step LED indicators

### Controls
- **Step 1-8**: Individual CV values (0-1 normalized)
- **Gate 1-8**: Toggle buttons for per-step gate on/off
- **Length**: Sequence length (1-8 steps)
- **Range**: CV output range (1V, 2V, or 4V)
- **Direction**: Playback mode (8 modes)

### Inputs
- **Clock**: Advance sequence (≥3V threshold)
- **Reset**: Return to step 1 (≥3V threshold)

### Outputs
- **CV**: Step CV output (scaled by range)
- **Gate**: Gate output (0V or 10V, follows clock when step gate enabled)

### Indicators
- **Step 1-8 LEDs**: Show current step position

## Direction Modes

| Index | Name | Behavior |
|-------|------|----------|
| 0 | Up | Forward: 1→2→3→4→5→6→7→8→1... |
| 1 | Down | Backward: 8→7→6→5→4→3→2→1→8... |
| 2 | 2× Up | Forward, each step twice |
| 3 | 2× Down | Backward, each step twice |
| 4 | Pendulum 1 | Up-down; start and end steps play twice |
| 5 | 2× Pendulum 1 | Every step plays twice; start and end play four times |
| 6 | Pendulum 2 | Up-down; start and end steps play once |
| 7 | Random | Random step selection |

## CV Ranges

| Range Setting | Output Range | Use Case |
|---------------|--------------|----------|
| 0 (1V) | 0 - 1V | 1 octave pitch |
| 1 (2V) | 0 - 2V | 2 octave pitch |
| 2 (4V) | 0 - 4V | 4 octave pitch or wide modulation |

## DSP Implementation

### Clock Edge Detection
```javascript
const clockActive = clockIn >= 3;  // 3V threshold
if (clockActive && !lastClockState) {
    advanceStep(seqLength, direction);
}
lastClockState = clockActive;
```

### Direction Implementation
```javascript
advanceStep(seqLength, direction) {
    switch (direction) {
        case 0: // up
            currentStep = (currentStep + 1) % seqLength;
            break;

        case 1: // down
            currentStep = (currentStep - 1 + seqLength) % seqLength;
            break;

        case 4: // pendulum1
            currentStep += pendulumDirection;
            if (currentStep >= seqLength - 1) {
                currentStep = seqLength - 1;
                pendulumDirection = -1;
            } else if (currentStep <= 0) {
                currentStep = 0;
                pendulumDirection = 1;
            }
            break;

        case 7: // random
            currentStep = Math.floor(Math.random() * seqLength);
            break;
    }
}
```

The app keeps its existing mode-number order (`Up`, `Down`, `2x Up`,
`2x Down`, ...) even though the Doepfer panel lists Down first. Repeat counts
follow the official A-155-2 definitions: the 2x linear modes repeat every step,
Pendulum type 1 repeats endpoints, 2x Pendulum type 1 repeats interiors twice
and endpoints four times, and Pendulum type 2 repeats neither endpoint.

### Gate Output
Gate output follows clock while step gate is enabled:
```javascript
// Gate high only when:
// 1. Clock is high
// 2. Current step's gate button is on
gateOut = (clockActive && stepGates[currentStep]) ? 10 : 0;
```

This app behavior intentionally favors playable patches over a latched step gate: ADSRs and VCAs close as soon as the clock input is removed, avoiding stuck notes or drones when trigger cables are unplugged.

### CV Output
```javascript
cvOut = stepValues[currentStep] * rangeMultiplier;
// rangeMultiplier: 1V, 2V, or 4V
```

### Key Concepts
- **Analog-style sequencing**: Unquantized CV, use quantizer module for pitched sequences
- **Per-step gates**: Enable rhythmic patterns (skip steps)
- **Direction modes**: Create varied patterns from same CV values

## Classic Sequencer Techniques

### Melodic Sequences
- Use with quantizer for pitched melodies
- 2V or 4V range for wider intervals
- Direction modes for variation

### Modulation Sequences
- CV to filter cutoff, PWM, etc.
- 1V range for subtle modulation
- Random mode for generative patches

### Rhythmic Patterns
- Use gate buttons for rhythm
- Clock divider for polyrhythms
- Reset for phrase synchronization

## DSP References
- [Doepfer A-155 Manual](https://www.doepfer.de/a155.htm)
- [Step Sequencer Design](https://www.soundonsound.com/techniques/step-sequencing)
- [Modular Sequencing Techniques](https://learningmodular.com/)

## Potential Improvements
- Add CV inputs for step modulation
- Implement probability per step
- Add glide/portamento between steps
- Implement Euclidean rhythm generation
- Add step mute vs. skip modes

## Sources
- [Doepfer A-155-2 product page](https://doepfer.de/a1552.htm) - Doepfer,
  accessed 2026-07-30; primary direction/repeat definitions.
- [Doepfer A-155-2 manual](https://doepfer.de/a100_man/A-155-2_Manual.pdf) -
  Doepfer; primary direction programming and repeat behavior.
- [Doepfer A-155](https://www.doepfer.de/a155.htm)
- [ModularGrid - Doepfer A-155](https://www.modulargrid.net/e/doepfer-a-155)

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/seq.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Fixed four direction modes that did not implement their names: `2x Up` and
  `2x Down` were identical to normal traversal, while both Pendulum type 1
  modes omitted the documented repeats. Focused sequence fixtures now lock all
  repeat patterns; Pendulum type 2 retains single endpoints.
- Reset now wins when Reset and Clock rise together, instead of returning to
  step 1 and immediately advancing to step 2 in the same sample.
- Range, length, direction, eight CV controls, and eight gate buttons are
  bounded before use. Step/gate arrays are preallocated rather than created in
  every audio block, and non-finite controls/inputs recover safely.
- Clock and Reset explicitly accept 0-10V with 0V normals and use the documented
  >=3V edge threshold. CV declares 0-4V and Gate declares 0-10V.
- Reset clears stable inputs/outputs, edge history, repeat/pendulum state, and
  LEDs in place.
- The strict 44.1/48/96 kHz by 128/512 matrix completes 39 scenarios with
  finite output, zero voltage flags, stable buffers, exact 10.000V gate peaks,
  and a maximum diagnostic time below 0.090ms per block.
