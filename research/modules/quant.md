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
Output an app-standard 8ms trigger pulse when the quantized note changes:
```javascript
if (Math.abs(quantized - lastQuantized) > 0.001) {
    triggerSamplesRemaining = round(sampleRate * 0.008)
    lastQuantized = quantized;
}
triggerOut = triggerSamplesRemaining > 0 ? 5 : 0
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

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Before remediation**: `cv` (cv) measured -7.00..7.00 V against -5..5 V
- **After remediation**: Output contract now covers -7..95/12 V; strict matrix passes.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/simple-quantizer.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Status**: confirmed contract and range findings are resolved; broader listening and characterization work remains tracked centrally.

## Individual Contract Audit (2026-07-30, complete)

- Fixed nearest-note search across negative octave boundaries. For example,
  -0.01V now correctly selects 0V in the chromatic scale instead of -1/12V.
  The algorithm evaluates scale candidates in both adjacent octaves.
- Worklet and panel defaults now agree on scale 1 (major). Scale, octave, and
  semitone controls are rounded and bounded before lookup; non-finite input CV
  falls back to 0V.
- Note changes now emit an 8ms, 5V pulse rather than a single-sample spike.
  The Active LED decay is based on physical time instead of losing 0.1 per
  block.
- Input explicitly accepts -5V to +5V with a 0V normal; output retains its
  complete -7V to 95/12V transposed range, and Trigger declares 0-5V.
- Reset clears the stable input/output buffers, pitch comparison state, pulse
  timer, and LED. Tests no longer replace input buffer identities.
- The strict 44.1/48/96 kHz by 128/512 matrix completes seven scenarios with
  finite output, zero voltage flags, stable buffers, exact 7.000V audit peaks,
  and a maximum diagnostic time below 0.200ms per block.
