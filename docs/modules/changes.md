# Changes harmonic sequencer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Changes+%2B+Cascade)

1. Start the patch. Changes sends Pitch to the lead pluck and Root to the bass pluck. The same clock runs Cascade, whose third and first lanes strike the two voices.
2. Leave Cascade alone and turn Key to transpose the pair. Then change Motion and listen for differences in how the lead moves against the bass.

## In a composition

For a generative duet, keep the root on a sparse low instrument and give the melody a busier rhythm. Route the Change output to an accent for a third part that marks harmonic movement.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Key (`key`) | Chooses the tonic note for the progression and melody. |
| Scale (`scale`) | Chooses the pool of scale notes from which pitch and root are built. |
| Changes (`changes`) | Selects a progression of harmonic degrees within that scale. |
| Motion (`motion`) | Chooses how the melody moves against the progression. |
| Reset (`resetAction`) | Restarts the musical pattern from the panel. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clock (`clock`) | Trigger · 0 to 10 V | Advances the line through the selected progression and motion pattern. |
| Reset (`reset`) | Trigger · 0 to 10 V | Returns the pattern to the beginning in time with an external phrase. |
| Key (`keyCV`) | Control voltage · ±5 V | Transposes the tonic under voltage control. |
| Changes (`changesCV`) | Control voltage · ±5 V | Moves through the available progressions under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Pitch (`pitch`) | Control voltage · ≈ −6 to 7.92 V | The melodic line as one-volt-per-octave pitch. Patch to a lead voice. |
| Root (`root`) | Control voltage · ≈ −5 to 6.83 V | The current harmonic root as pitch voltage. Patch to a bass or another pitch-aware module. |
| Change (`change`) | Trigger · 0 to 10 V | Pulses on harmonic changes for accents or to cue another part. |

## Design background

This rack design separates the choice of harmony from the choice of rhythm. Its root and melody outputs make that distinction audible with just two plucked strings.

[Research and implementation notes](../../research/modules/changes.md)
