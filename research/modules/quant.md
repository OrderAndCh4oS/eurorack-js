# Quantizer (quant)

## Hardware Reference
- **Based on**: Ladik Q-010 Easy Quantizer concept
- **ModularGrid**: [Various quantizers](https://www.modulargrid.net/e/modules/browser?SearchName=quantizer)

## Specifications

### Features
- 16 preset musical scales
- Octave transpose (±2 octaves)
- Semitone transpose (0-11 semitones)
- 1V/Oct input and output
- Trigger output on note changes

### Controls
- **Scale**: Select from 16 preset scales
- **Octave**: Transpose ±2 octaves
- **Semitone**: Transpose 0-11 semitones

### Inputs
- **CV In**: Pitch CV to quantize (V/Oct)

### Outputs
- **CV Out**: Quantized pitch CV (V/Oct)
- **Trigger**: 5V pulse on note change

### Indicators
- **Active LED**: Flashes on note changes

## Available Scales

| Index | Scale | Notes |
|-------|-------|-------|
| 0 | Chromatic | All 12 notes |
| 1 | Major | 1, 2, 3, 4, 5, 6, 7 |
| 2 | Minor | 1, 2, b3, 4, 5, b6, b7 |
| 3 | Harmonic Minor | 1, 2, b3, 4, 5, b6, 7 |
| 4 | Melodic Minor | 1, 2, b3, 4, 5, 6, 7 |
| 5 | Dorian | 1, 2, b3, 4, 5, 6, b7 |
| 6 | Phrygian | 1, b2, b3, 4, 5, b6, b7 |
| 7 | Lydian | 1, 2, 3, #4, 5, 6, 7 |
| 8 | Mixolydian | 1, 2, 3, 4, 5, 6, b7 |
| 9 | Locrian | 1, b2, b3, 4, b5, b6, b7 |
| 10 | Pentatonic Major | 1, 2, 3, 5, 6 |
| 11 | Pentatonic Minor | 1, b3, 4, 5, b7 |
| 12 | Blues | 1, b3, 4, b5, 5, b7 |
| 13 | Whole Tone | 1, 2, 3, #4, #5, b7 |
| 14 | Diminished | 1, 2, b3, 4, b5, b6, 6, 7 |
| 15 | Augmented | 1, b3, 3, 5, #5, 7 |

## DSP Implementation

### Quantization Algorithm
```javascript
function quantizeVoltage(voltage, scaleNotes, octaveOffset, semitoneOffset) {
    // Extract octave and note from voltage
    const totalSemitones = voltage * 12;  // V/Oct: 1V = 12 semitones
    const octave = Math.floor(totalSemitones / 12);
    const note = totalSemitones % 12;

    // Find nearest scale note
    let nearestNote = scaleNotes[0];
    let minDistance = Infinity;

    for (const scaleNote of scaleNotes) {
        const distance = Math.abs(note - scaleNote);
        const wrapDistance = Math.abs(note - (scaleNote + 12));
        const actualDistance = Math.min(distance, wrapDistance);

        if (actualDistance < minDistance) {
            minDistance = actualDistance;
            nearestNote = scaleNote;
        }
    }

    // Apply transpose and convert back to voltage
    const outputNote = nearestNote + semitoneOffset;
    const outputOctave = octave + octaveOffset;

    return (outputOctave * 12 + outputNote) / 12;
}
```

### Trigger Generation
Output trigger pulse when quantized note changes:
```javascript
if (Math.abs(quantized - lastQuantized) > 0.001) {
    triggerOut = 5;  // 5V trigger
    lastQuantized = quantized;
}
```

### Key Concepts
- **V/Oct standard**: 1 volt = 1 octave = 12 semitones
- **Nearest-note quantization**: Finds closest scale degree
- **Wrap handling**: Notes near octave boundaries consider both directions

## Music Theory Reference

### Scale Degrees
| Degree | Semitones | Name |
|--------|-----------|------|
| 1 | 0 | Root/Tonic |
| b2 | 1 | Minor 2nd |
| 2 | 2 | Major 2nd |
| b3 | 3 | Minor 3rd |
| 3 | 4 | Major 3rd |
| 4 | 5 | Perfect 4th |
| #4/b5 | 6 | Tritone |
| 5 | 7 | Perfect 5th |
| #5/b6 | 8 | Aug 5th/Min 6th |
| 6 | 9 | Major 6th |
| b7 | 10 | Minor 7th |
| 7 | 11 | Major 7th |

## DSP References
- [Music Theory - Scale Construction](https://www.musictheory.net/lessons/21)
- [V/Oct Standard](https://learningmodular.com/glossary/v-oct/)
- [MIDI to Frequency](https://newt.phys.unsw.edu.au/jw/notes.html)

## Potential Improvements
- Add user-programmable scales
- Implement sample & hold for slew-free steps
- Add probability/skip for generative sequences
- Implement microtonal scales (non-12TET)

## Sources
- [Ladik Modules](http://ladik.eu/)
- [ModularGrid Quantizer Browser](https://www.modulargrid.net/e/modules/browser?SearchName=quantizer)
