# Arpeggiator (arp)

## Hardware Reference
- **Based on**: [2hp Arp](http://www.twohp.com/modules/p/arp)
- **Manual**: [Arp Manual PDF](https://www.twohp.com/modules/p/arp) (download from product page)
- **ModularGrid**: [2hp Arp](https://www.modulargrid.net/e/2hp-arp)

## Specifications

### Features
- Gate-driven arpeggiator
- 13 chord types (triads and sevenths)
- 4 playback modes (up, down, up-down, random)
- 1-2 octave range
- V/Oct tracking on root CV input
- Voltage control over root and chord type
- Depth: 42mm

### Power (Hardware)
- +12V: 40mA
- -12V: 7mA

### Controls
- **Root**: Root note (0-11 = C through B)
- **Chord**: Chord type selection (13 types)
- **Mode**: Playback direction (4 modes)
- **Octaves**: Range switch (1 or 2 octaves)

### Inputs
- **Trigger**: Advance to next note (0.4V threshold)
- **Reset**: Return to first note in pattern
- **Root CV**: V/Oct pitch offset for root
- **Chord CV**: Chord type modulation

### Outputs
- **V/Oct**: Pitch CV output

### Indicators
- **Step LED**: Flashes on each step

## Chord Types

| Index | Name | Intervals (semitones) |
|-------|------|----------------------|
| 0 | Unison | 0 |
| 1 | Major | 0, 4, 7 |
| 2 | Minor | 0, 3, 7 |
| 3 | Diminished | 0, 3, 6 |
| 4 | Augmented | 0, 4, 8 |
| 5 | Sus2 | 0, 2, 7 |
| 6 | Sus4 | 0, 5, 7 |
| 7 | Major 7th | 0, 4, 7, 11 |
| 8 | Minor 7th | 0, 3, 7, 10 |
| 9 | Dominant 7th | 0, 4, 7, 10 |
| 10 | Diminished 7th | 0, 3, 6, 9 |
| 11 | Half-Dim 7th | 0, 3, 6, 10 |
| 12 | Aug Major 7th | 0, 4, 8, 11 |

## Playback Modes

| Index | Name | Behavior |
|-------|------|----------|
| 0 | Up | Ascending: 0, 1, 2, 3, 0, 1, 2, 3... |
| 1 | Down | Descending: 3, 2, 1, 0, 3, 2, 1, 0... |
| 2 | Up-Down | Pendulum: 0, 1, 2, 3, 2, 1, 0, 1... |
| 3 | Random | Random selection each step |

## DSP Implementation

### Sequence Building
```javascript
function buildArpSequence(chordIntervals, octaves, mode) {
    let sequence = [];

    // Add base chord notes
    for (const interval of chordIntervals) {
        sequence.push(interval);
    }

    // Add octave copies
    if (octaves === 2) {
        for (const interval of chordIntervals) {
            sequence.push(interval + 12);
        }
    }

    // Reorder based on mode
    switch (mode) {
        case 'down':
            sequence.reverse();
            break;
        case 'upDown':
            // 0,1,2,3 → 0,1,2,3,2,1
            const ascending = [...sequence];
            const descending = [...sequence].reverse().slice(1, -1);
            sequence = [...ascending, ...descending];
            break;
        case 'random':
            // Handled at step time
            break;
    }

    return sequence;
}
```

### Step Advancement
```javascript
// On trigger rising edge
if (triggerActive && !lastTriggerState) {
    if (mode === 'random') {
        currentStep = Math.floor(Math.random() * sequence.length);
    } else {
        currentStep = (currentStep + 1) % sequence.length;
    }
}

// Calculate output pitch
const noteInSemitones = rootNote + sequence[currentStep];
output = noteInSemitones / 12;  // Convert to V/Oct
```

### V/Oct Handling
```javascript
// Root CV adds to base root (V/Oct = semitones × 12)
if (rootCV) {
    rootNote += rootCV * 12;
}

// Output in V/Oct format
output = (rootNote + sequenceNote) / 12;
```

### Key Concepts
- **Gate-driven**: Advances on each trigger, not free-running
- **V/Oct tracking**: Root CV input follows standard
- **Chord CV**: Allows external modulation of chord type

## DSP References
- [Arpeggiator Design](https://www.soundonsound.com/techniques/creating-arpeggios)
- [V/Oct Standard](https://learningmodular.com/glossary/v-oct/)
- [Music Theory - Chord Construction](https://www.musictheory.net/lessons/40)

## Potential Improvements
- Add more chord types (9ths, 11ths, etc.)
- Implement latch mode (hold notes after trigger)
- Add probability per step
- Implement custom chord entry

## Sources
- [2hp Arp Product Page](http://www.twohp.com/modules/p/arp)
- [ModularGrid - 2hp Arp](https://www.modulargrid.net/e/2hp-arp)
