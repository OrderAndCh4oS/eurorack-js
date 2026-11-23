# Cascade rhythm generator

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Changes+%2B+Cascade)

1. Start the patch. Lane 1 strikes the bass pluck and lane 3 strikes the lead. CHANGES supplies their pitches from the same master clock.
2. Turn **Fill** gradually to add strikes. Then adjust **Rotate** and listen through a phrase boundary for the accents moving around the beat.

## In a composition

For a percussion arrangement, put a low drum on a sparse lane and a higher drum on a denser one. Raise Fill through a transition to bring both toward a climax.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Fill (`fill`) | Sets density across the four nested lanes. Higher settings add positions in a fixed priority order. |
| Rotate (`rotate`) | Shifts all the patterns together around the sixteen-step cycle. |
| Reset (`resetAction`) | Returns the pattern to its beginning from the panel. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clock (`clock`) | Trigger · 0 to 10 V | Advances all four lanes by one step. |
| Reset (`reset`) | Trigger · 0 to 10 V | Aligns the pattern with the start of an external phrase. |
| Fill (`fillCV`) | Control voltage · ±5 V | Adds a changing voltage to Fill for programmed builds and breakdowns. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1 (`lane1`) | Trigger · 0 to 10 V | Sends the sparsest pattern, useful for anchors such as bass or kick. |
| 2 (`lane2`) | Trigger · 0 to 10 V | Adds a second density level while retaining the first lane’s hits. |
| 3 (`lane3`) | Trigger · 0 to 10 V | Sends a denser pattern that includes the preceding lanes’ positions. |
| 4 (`lane4`) | Trigger · 0 to 10 V | Sends the fullest lane, useful for a busy upper part or a clock for another pattern. |

## Design background

Cascade arranges positions by priority. That makes density a playable control while keeping the more prominent accents common to related lanes.

[Research and implementation notes](../../research/modules/cascade.md)
