# Euclidean Rhythm Generator (euclid)

## Hardware Reference
- **Based on**: [2hp Euclid](https://www.twohp.com/modules/euclid)
- **Manual**: [2hp Euclid Manual](https://www.manua.ls/2hp/euclid/manual)
- **ModularGrid**: [2hp Euclid](https://www.modulargrid.net/e/2hp-euclid)

## Background

The Euclidean rhythm was discovered by Godfried Toussaint in 2004. The algorithm distributes N hits as evenly as possible across K steps, naturally producing many traditional world music rhythms.

### Famous Euclidean Patterns
| Steps | Hits | Pattern | Name |
|-------|------|---------|------|
| 8 | 3 | `X..X..X.` | Cuban tresillo |
| 8 | 5 | `X.XX.XX.` | Cuban cinquillo |
| 16 | 4 | `X...X...X...X...` | 4-on-the-floor |
| 12 | 4 | `X..X..X..X..` | Afro-Cuban |
| 16 | 5 | `X..X..X..X..X...` | Bossa nova |

## Specifications

### Hardware (2hp Euclid)
- Width: 2HP
- Depth: 42mm
- +12V: 21mA, -12V: 2mA
- Up to 16 steps

### Our Implementation
- Width: 4HP
- Up to 16 steps
- CV control over length and hits
- Rotation/offset control

### Controls
- **Length**: Pattern length (1-16 steps)
- **Hits**: Number of active steps (1 to Length)
- **Rotate**: Shifts pattern start point (0 to Length-1)

### Inputs
- **Clock**: Trigger input to advance sequence
- **Reset**: Restart pattern from step 1
- **LenCV**: CV control of length (+5V = +8 steps)
- **HitsCV**: CV control of hits (+5V = +8 hits)

### Outputs
- **Trig**: Trigger output (fires on active steps)
- **Accent**: Trigger output for first beat of pattern (optional)

### Indicators
- **Step LED**: Shows current step activity

## DSP Implementation

### Euclidean Algorithm (Bucket/Accumulator Method)
The simplest approach - uses integer math, no arrays needed:

```javascript
function isHit(step, hits, length) {
    // Bucket accumulator method
    // Returns true if this step should have a hit
    const bucket = (step * hits) % length;
    const prevBucket = ((step - 1 + length) % length * hits) % length;
    return bucket < hits && (step === 0 || bucket < prevBucket || prevBucket >= hits);
}
```

Or the classic Bresenham-style approach:

```javascript
function generatePattern(hits, length) {
    const pattern = [];
    let bucket = 0;
    for (let i = 0; i < length; i++) {
        bucket += hits;
        if (bucket >= length) {
            bucket -= length;
            pattern.push(1);
        } else {
            pattern.push(0);
        }
    }
    return pattern;
}
```

### Rotation
Shift the pattern by an offset:
```javascript
function getRotatedStep(step, rotate, length) {
    return (step + rotate) % length;
}
```

### Edge Detection for Clock
```javascript
const clockHigh = clock >= 1;
if (clockHigh && !lastClock) {
    // Advance to next step
    currentStep = (currentStep + 1) % length;
}
lastClock = clockHigh;
```

### Reset Handling
```javascript
const resetHigh = reset >= 1;
if (resetHigh && !lastReset) {
    currentStep = 0;
}
lastReset = resetHigh;
```

## Common Uses

### Basic Rhythm Generation
- Clock → Euclid → Drum trigger
- Instant complex rhythms from simple clock

### Polyrhythms
- Multiple Euclid modules with different settings
- Same clock, different length/hits = polyrhythms

### Evolving Patterns
- LFO → HitsCV for slowly changing patterns
- Random → LenCV for chaotic variations

### Accent Patterns
- Use two Euclids: one for main beat, one for accents
- Different hit counts create groove

## Design Decisions

### Why Bucket Method (not Bjorklund)?
- Simpler implementation (no recursion/arrays)
- Can compute hit on-the-fly per step
- Same results, less memory

### Why Include Rotation?
- Essential for musical variations
- Same hits/length with different rotation = different feel
- Allows syncing downbeat to other modules

### Why CV for Length and Hits?
- Creates evolving patterns
- Standard in hardware (2hp Euclid has CV)
- Enables external modulation of rhythm

## DSP References
- [Godfried Toussaint's Paper](https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf)
- [Rosetta Code - Euclidean Rhythm](https://rosettacode.org/wiki/Euclidean_rhythm)
- [Medium - Euclidean Rhythms](https://medium.com/code-music-noise/euclidean-rhythms-391d879494df)

## Sources
- [2hp Euclid](https://www.twohp.com/modules/euclid)
- [ModularGrid - 2hp Euclid](https://www.modulargrid.net/e/2hp-euclid)
- [2hp Euclid Manual](https://www.manua.ls/2hp/euclid/manual)
