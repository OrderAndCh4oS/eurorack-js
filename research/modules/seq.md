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
| 4 | Pendulum 1 | Up-down, hit ends once: 1→2→3→4→3→2→1→2... |
| 5 | 2× Pendulum 1 | Pendulum 1, each step twice |
| 6 | Pendulum 2 | Up-down, don't repeat ends: 1→2→3→4→3→2→1→2... |
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

### Gate Output
Gate output follows clock while step gate is enabled:
```javascript
// Gate high only when:
// 1. Clock is high
// 2. Current step's gate button is on
gateOut = (clockActive && stepGates[currentStep]) ? 10 : 0;
```

This ensures the ADSR re-triggers on each step rather than holding through the sequence.

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
- [Doepfer A-155](https://www.doepfer.de/a155.htm)
- [ModularGrid - Doepfer A-155](https://www.modulargrid.net/e/doepfer-a-155)
