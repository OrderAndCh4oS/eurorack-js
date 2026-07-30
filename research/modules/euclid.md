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
- **Hits**: Number of active steps (0 to Length)
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
The implementation uses integer math directly and allocates no pattern array:

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

Unpatched clock/reset inputs are restored to their 0V normals by the compiled
graph. Trigger pulses are bounded to 8ms, so no cable-specific cleanup hook is
required.

### Reset Handling
```javascript
const resetHigh = reset >= 1;
if (resetHigh && !lastReset) {
    currentStep = -1;
    triggerCounter = 0;
}
lastReset = resetHigh;
```

Reset suppresses a simultaneous clock edge; the next clock advances to step 0.

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

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/euclid.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).

## Individual Contract Audit (2026-07-30, complete)

- Removed a test-driven pulse extension that made a nominal 10ms trigger last
  at least four whole blocks (about 46ms at 44.1 kHz/512). Hits now emit exact
  8ms, 10V trigger pulses, while a separate 50ms LED hold keeps activity
  visible even when a render block is longer than the pulse.
- Length and Hits CV are now evaluated per sample. Previously only sample zero
  modulated the whole block, so in-block and audio-rate modulation was ignored.
- Reset clears a pending pulse and wins same-sample Clock coincidence; the next
  clock begins at step 0.
- Euclidean hit calculation now uses direct accumulator arithmetic without
  allocating a pattern array in every block. The obsolete cable-disconnection
  callback was removed in favor of stable 0V-normalled inputs.
- Clock/Reset declare 0-10V, CV inputs -5V to +5V, and Trigger 0-10V. Reset
  clears all stable buffers and timing/edge/LED state; non-finite params and CV
  recover safely.
- Focused coverage verifies classic hit counts, rotation, looping, per-sample
  CV, thresholds, reset priority, exact voltage, reset, and finite integrity.
  The strict six-configuration matrix completes seven scenarios with zero
  errors/voltage flags and stable buffers; its generic stimulus does not clock
  a hit, while focused fixtures verify the exact 10V pulse.
