# MIDI Module Suite Research

## Reference Hardware

### Mutable Instruments Yarns (12HP)
- 4 CV outputs, 4 Gate outputs
- Modes: Mono, 2-voice, 4-voice poly, 4-part trigger
- Features: Arpeggiator, 64-step sequencer, Euclidean patterns
- 1V/oct, 5V gates, portamento, pitch bend, vibrato
- Source: https://pichenettes.github.io/mutable-instruments-documentation/modules/yarns/

### Expert Sleepers FH-2 (8HP)
- 8 CV outputs (expandable to 64)
- USB host + device, 5-pin DIN MIDI
- 16-note polyphonic, MPE support
- 14-bit DAC, ±5V or 0-10V range
- Source: https://www.expert-sleepers.co.uk/fh2.html

### Polyend Poly 2
- 8 CV/Gate pairs
- USB + DIN MIDI
- Polyphonic + multitimbral
- Source: https://modwiggler.com/forum/viewtopic.php?t=254551

## Proposed Module Suite

### 1. MIDI-CV (4HP) - Basic Monophonic
Inspired by: Simple MIDI-CV converters
- **Outputs**: Pitch CV (1V/oct), Gate, Velocity, Mod Wheel
- **Controls**: Channel select, transpose
- **Use case**: Playing melodies with a keyboard

### 2. MIDI-4 (6HP) - 4-Voice Polyphonic
Inspired by: Yarns in 4-voice mode
- **Outputs**: 4x Pitch CV, 4x Gate
- **Controls**: Channel, voice allocation mode
- **Modes**: Poly, unison, rotate, random
- **Use case**: Polyphonic pads, chord stabs

### 3. MIDI-CC (4HP) - CC to CV Converter
Inspired by: FH-2 CC mapping
- **Outputs**: 4 CV outputs mapped to CCs
- **Controls**: CC number selection per output
- **Range**: 0-10V
- **Use case**: Hardware controller integration

### 4. MIDI-CLK (2HP) - Clock/Transport
Inspired by: Yarns clock output
- **Outputs**: Clock, Reset/Start, Run gate
- **Controls**: Division (1/1, 1/2, 1/4, 1/8, 1/16)
- **Use case**: Sync sequencers to DAW

## Voltage Standards (from CLAUDE.md)

| Signal | Range | Notes |
|--------|-------|-------|
| Pitch CV | 1V/octave | 0V = C4 (MIDI note 60) |
| Gate | 0/10V | Threshold ≥1V |
| Velocity | 0-10V | Scaled from 0-127 |
| CC | 0-10V | Scaled from 0-127 |
| Clock | 5-10ms pulse | >2.5V threshold |

## MIDI Note to Voltage Conversion

```javascript
// 1V/octave, 0V = C4 (MIDI note 60)
const pitchCV = (midiNote - 60) / 12;
// Range: MIDI 0-127 = -5V to +5.58V
```

## Implementation Notes

### Web MIDI Integration
- Modules need access to shared MIDI manager
- MIDI data arrives asynchronously, but DSP runs in blocks
- Solution: Buffer MIDI events, process during DSP block

### MIDI Event Buffering
```javascript
// In MIDI manager, queue events
midiEvents.push({ type: 'noteOn', note, velocity, timestamp });

// In module process(), consume events
while (midiEvents.length > 0) {
    const event = midiEvents.shift();
    // Process event
}
```

### Voice Allocation (Polyphonic)
- **Lowest**: Assign to lowest available voice
- **Round-robin**: Cycle through voices
- **Steal oldest**: Reassign longest-held note
- **Steal quietest**: Reassign lowest velocity note

## File Structure

```
src/js/modules/
├── midi-cv/index.js      # Monophonic MIDI-CV
├── midi-4/index.js       # 4-voice polyphonic
├── midi-cc/index.js      # CC to CV
└── midi-clk/index.js     # Clock/transport
```

## Sources

- [Yarns Documentation](https://pichenettes.github.io/mutable-instruments-documentation/modules/yarns/)
- [FH-2 Specifications](https://www.expert-sleepers.co.uk/fh2.html)
- [MIDI to CV Overview - Perfect Circuit](https://www.perfectcircuit.com/signal/midi-to-cv)
- [ModWiggler Discussion](https://modwiggler.com/forum/viewtopic.php?t=283343)
