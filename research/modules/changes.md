# Changes — Scale-Aware Harmonic Pitch Sequencer

Status: done. Research, implementation, independent review, strict DSP audit,
and full-suite validation are complete.

## Recommendation and Scope

Adopt `changes` as the harmonic half of the Cadence pair. It emits a
deterministic 16-note phrase made from four scale-derived seventh chords, a
current chord-root CV, and a structural trigger every four clocks.

Changes receives an ordinary rack clock and has no private state, mask, or
required cable shared with Cascade. This is an inspired utility adaptation,
not an emulation of one product.

### Why it is distinct

- `arp` traverses one chosen chord; Changes sequences four scale-degree chords
  and plans voice movement across the whole loop.
- `seq` exposes manually authored voltages; Changes derives pitches from Key,
  Scale, Changes, and Motion.
- `quant` corrects incoming CV; Changes creates clocked harmonic material.
- Opp Ned stores editable note sets and familiar arp modes; Changes has no
  editing, storage, randomness, octave-span control, or Gate pattern.

### Non-goals

No density, rest, mask, probability, internal clock, chord editor, step editor,
polyphonic chord outputs, Hold, octave Range, Open switch, or Gate output.
Clock can be fanned to an envelope when Changes is used without Cascade.

## Research Findings

- The official [Gamut Repetitor manual](https://manuals.noiseengineering.us/gr/)
  establishes immediate root/scale control, 1V/oct pitch, repeatable looping,
  0–5V CV, and an approximately 2V trigger threshold.
- The official [Opp Ned manual](https://manuals.noiseengineering.us/on/)
  demonstrates an immediate 8HP clock-to-pitch instrument, reset on an
  advance, quantized transpose, and pitch traversal independent of its sound
  source. Changes deliberately omits its editable memories and arp modes.
- The [Sinfonion manual](https://www.acl-synth.com/manuals-eng/sinfonion-manual-1.0c.pdf)
  explicitly separates chord progression, arpeggiator clock, and voice
  articulation; it also supports a separate harmonic-root bass voice.
- Noise Engineering's
  [Multi Repetitor development account](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/developing-multi-repetitor/)
  reports that feature growth harmed immediate performance. This supports four
  high-level musical knobs rather than a compact Sinfonion clone.
- [Open Music Theory's four-chord schemas](https://viva.pressbooks.pub/openmusictheory/chapter/4-chord-schemas/)
  supports the doo-wop and singer/songwriter progression families below.
- Tymoczko's
  [The Geometry of Musical Chords](https://pubmed.ncbi.nlm.nih.gov/16825563/)
  supports minimizing movement between equal-cardinality chord voicings. It
  does not by itself minimize a serialized arp line, so a second monophonic
  traversal optimization is specified.
- Noise Engineering's official
  [Gamut + Multi patch](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/generative-sequencing-with-multi-repetitor-and-gamut-repetitor/)
  is direct precedent for separating melodic decisions from rhythmic
  articulation while sharing a master clock.

## Exact Module and Panel Contract

| Field | Value |
|---|---|
| ID / name | `changes` / `CHANGES` |
| Width | 8HP |
| Category | `sequencer` |
| Color | `module-color-nine` |
| Renderer | Declarative |

Controls:

| Kind | Param | Label | Range/default | Timing |
|---|---|---|---|---|
| Knob | `key` | Key | integer 0–11, default 0 | Phrase-latched |
| Knob | `scale` | Scale | integer 0–7, default 0 | Phrase-latched |
| Knob | `changes` | Changes | integer 0–7, default 1 | Phrase-latched |
| Knob | `motion` | Motion | integer 0–7, default 0 | Phrase-latched |
| Action | `resetAction` | Reset | trigger, default 0 | Queues restart |

Inputs:

| Port | Signal | Voltage/normal | Contract |
|---|---|---|---|
| `clock` | trigger | 0–10V, normal 0V | Rising edge strictly above 2.5V |
| `reset` | trigger | 0–10V, normal 0V | Rising edge at or above 1V |
| `keyCV` | cv | -5V to +5V, normal 0V | 1V/oct post-plan transpose, sampled every Clock |
| `changesCV` | cv | -5V to +5V, normal 0V | Additive progression choice, phrase-latched |

Outputs:

| Port | Signal | Voltage | Contract |
|---|---|---|---|
| `pitch` | cv | -6V to 95/12V | Held monophonic phrase pitch |
| `root` | cv | -5V to 41/6V | Held uninverted chord root |
| `change` | trigger | 0V or 10V | Fixed 8ms pulse at steps 0/4/8/12 |

LEDs are `chord1` through `chord4` (persistent one-hot chord slot) and
`pending` (requested structural tuple differs from active state or restart is
queued). Chord LEDs are off before first Clock and after lifecycle reset.

All unpatched inputs use explicit 0V normals.

## Normative Musical Data

Scale semitones from Key:

```text
0 Major          [0,2,4,5,7,9,11]
1 Dorian         [0,2,3,5,7,9,10]
2 Phrygian       [0,1,3,5,7,8,10]
3 Lydian         [0,2,4,6,7,9,11]
4 Mixolydian     [0,2,4,5,7,9,10]
5 Natural minor  [0,2,3,5,7,8,10]
6 Harmonic minor [0,2,3,5,7,8,11]
7 Melodic minor  [0,2,3,5,7,9,11]
```

Melodic minor is the static ascending/jazz collection. Locrian is omitted in
favor of two immediately useful leading-tone minor collections.

Zero-based degree progressions:

```text
0 Pedal       [0,0,0,0]
1 Cadence     [0,3,4,0]
2 Doo-wop     [0,5,3,4]
3 Pop         [0,4,5,3]
4 Relative    [5,3,0,4]
5 Turnaround  [0,5,1,4]
6 ii-V cycle  [1,4,0,5]
7 Lament      [0,6,5,4]
```

Names are major-key mnemonics only; arrays are normative. Other scales produce
intentional modal adaptations.

For scale `S`, degree `d`, and tone `j = 0..3`, construct a seventh chord:

```text
raw[j] = S[(d + 2*j) mod 7] + 12 * floor((d + 2*j) / 7)
```

For C Major this gives I `[0,4,7,11]`, ii `[2,5,9,12]`,
V `[7,11,14,17]`, and vii `[11,14,17,21]`.

## Normative Planning Algorithm

### 1. Inversion candidates

For inversion `i = 0..3`, rotate the ascending raw chord at `i`, raising
wrapped notes 12 semitones. Include each uniform octave shift whose lowest and
highest pitches are within `[-12,+24]` semitones. Deduplicate and order the
ascending four-tuples lexicographically.

### 2. Cyclic simultaneous voice leading

Choose one candidate per chord. Exhaustively rank all four-chord plans by:

1. total cyclic L1 motion across corresponding low-to-high voices, including
   chord 4 back to chord 1;
2. smallest maximum individual leap;
3. smallest sum of absolute pitches;
4. lexicographically smallest flattened 16-value plan.

The first plan is normative and cannot hide a leap at phrase wrap.

### 3. Diverse monophonic Motion paths

Each chord has all 24 permutations of voice indices `[0,1,2,3]`. A phrase
chooses one per chord and emits 16 notes. Score all 16 cyclic adjacent
transitions by total absolute semitone movement, then maximum leap, then the
lexicographic note sequence and permutation-index tuple.

To prevent eight near-identical minima:

1. For each possible first-chord permutation, find its best complete phrase.
2. Rank those 24 conditional winners by the score above.
3. Keep the first eight. Motion 0–7 selects them in order.

The eight Motions therefore have distinct first-chord order, nondecreasing
cost, no RNG, and exact reset replay.

## Runtime Representation and CPU Decision

The searches must not execute or allocate in `process()`. Key does not affect
relative plans, so the complete table is:

```text
8 scales * 8 progressions * 8 Motions * 16 notes = 8,192 Int8 values
```

Check in an immutable generated `Int8Array`. A small pure generator implements
the normative search and tests regenerate/compare the table or an exact
checksum plus exhaustive vectors. Runtime work is constant-time edge detection,
table lookup, two voltage equations, and one trigger timer.

On-load or phrase-boundary search was rejected because startup cost and audio-
thread spikes are unnecessary. No RNG, DOM, Web Audio node, event queue,
unbounded telemetry, or browser API is required.

## Phrase, Reset, and Output Semantics

- Phrase steps 0–3, 4–7, 8–11, and 12–15 use chord slots 1–4.
- Initial cursor is pre-step `-1`; first Clock plays step 0.
- Every accepted raw Clock advances; there is no rest/mask decision.
- Key, Scale, Changes, Motion, and sampled Changes CV form one structural tuple
  that commits only when step 0 plays. A mid-phrase edit sets Pending and never
  makes a hybrid progression.
- Key CV is different: clamp/sample it at every accepted Clock and apply it
  after the relative plan.
- Effective Changes index at commit:

```text
clamp(round(changes + clamp(changesCV,-5,5) * 7/5), 0, 7)
```

- Reset jack and Reset action are independently rising-edge detected. A reset
  immediately cancels Change and sets `restartPending` without asynchronously
  changing held Pitch/Root/chord LEDs.
- The next accepted Clock plays step 0, commits pending controls, and emits
  Change. Reset+Clock on the same sample plays step 0.
- Reset while Clock is already high waits for a later genuine Clock edge; a
  held Reset does not repeatedly restart.
- Lifecycle `reset()` preserves buffer identity but zeroes inputs/outputs,
  cursor, edge memories, timer, pending/active state, and LEDs.
- Change fires on every scheduled chord slot even when adjacent degrees are
  equal. Pulse length is `max(1, round(sampleRate * 0.008))`; retrigger restarts
  the counter.

Output equations for relative note `n`, active chord degree `d`, key `k`, and
current Key CV `x`:

```text
Pitch = clamp(x,-5,5) + (k + n) / 12
Root  = clamp(x,-5,5) + (k + S[d]) / 12
```

The candidate register proves Pitch `[-6,95/12]V`; Root is
`[-5,41/6]V`. Root ignores inversion and Motion.

## Pair Patch Contract

```text
external Clock --+--> Changes Clock
                 +--> Cascade Clock

Changes Pitch ------> lead oscillator V/Oct
Cascade lane3 ------> lead trigger
Changes Root -------> bass oscillator V/Oct
Cascade lane1 ------> bass trigger
```

Never clock Changes from a sparse Cascade lane: rests would stop harmonic time.
Both begin at step `-1`, so a shared master clock aligns them without hidden
state. A Reset source may fan to both for deterministic restart.

## Contradictions and Decisions

| Issue | Resolution |
|---|---|
| Gamut/Opp Ned use ~2V trigger and mostly 0–5V rails | App `>2.5V` Clock, `>=1V` Reset, bipolar pitch, and 0/10V trigger standards win |
| Gamut generates/loops randomness | Changes has no RNG; controls and reset reproduce exactly |
| Immediate edits versus coherent phrases | Structural edits commit at step 0; Pending and Reset expose latency |
| Chord voice leading versus serialized melody | Separate cyclic simultaneous and monophonic objectives |
| Absolute eight best paths may be near duplicates | Keep best path for each unique first permutation, then rank |
| Triads repeat a note over four clocks | Four distinct diatonic seventh tones won |
| Range/Open/Hold/Gate can be useful | Omitted to avoid ARP duplication, pair desync, and panel overload |
| “Change” with repeated Pedal chords | Means scheduled chord-slot boundary and always fires |
| Modal progression labels can mislead | Degree arrays are normative; labels are mnemonics |

No research blocker remains. Exact authored tables may be reordered only after
listening validation updates this record and golden tests.

## Implementation Plan

- **Module ID/category:** `changes`, `sequencer`, 8HP,
  `module-color-nine`.
- **Branch/worktree:** `module/changes-cascade` in
  `/Users/orderandchaos/code/eurorack-js/.worktrees/changes-cascade`. The pair
  shares one implementation branch because registration aliases, worklet
  revision, docs, and the combined patch are one atomic core-graph change.
- **DSP model:** generated immutable 8,192-entry relative-pitch plan table;
  constant-time worklet lookup, held Pitch/Root CV, edge detection, and one
  fixed trigger counter. A pure generator remains the normative oracle.
- **Params:** `key`, `scale`, `changes`, `motion`, `resetAction`.
- **Inputs:** `clock`, `reset`, `keyCV`, `changesCV`.
- **Outputs:** `pitch`, `root`, `change`.
- **LEDs:** `chord1`–`chord4`, `pending`.
- **Factory patch:** combined `test-changes-cascade.js`, using a common Clock,
  two Pluck voices, Cascade lanes 1/3, mixer, and output.
- **Tests first:** `tests/dsp/changes.test.js` must cover every panel element,
  generator/table equivalence, latching, exact harmony, reset priority,
  triggers, voltages, LEDs, buffers, and pair integration.
- **Shared changes:** register both modules in manifest/static definitions in
  matching order, preserve sequential `mN` aliases, and bump the synchronized
  worklet graph revision in all three required files.
- **Focused validation:** `npm test -- tests/dsp/changes.test.js
  tests/dsp/cascade.test.js tests/rack/module-contracts.test.js
  tests/research/module-queue.test.js`.
- **Patch validation:** `npm test --
  tests/config/factory-patches.test.js tests/app/patch-format.test.js`.
- **DSP audits:** `npm run audit:dsp -- --module changes --matrix
  --strict-voltage` and the corresponding Cascade command.
- **Full validation:** `npm test`.
- **Known assumptions:** generated music must exactly match this document;
  listening changes require research and golden-test updates before merge.

## Test Targets

1. Exact metadata, defaults, controls, actions, ports, voltages, normals, LEDs,
   exhaustive panel coverage, and declarative rendering.
2. Stable block-sized buffers, full writes, zero-before-first-Clock, lifecycle
   reset, and finite NaN/Infinity recovery.
3. Clock exactly at/below/above 2.5V, sustained-high behavior, first step,
   16-step wrap, and one-hot chord LEDs in four-clock groups.
4. Every scale/progression table, seventh construction, octave carry, distinct
   chord pitch classes, and candidate register/dedup/order.
5. Exhaustive oracle for cyclic voicing optimum and every tie-break, including
   a fixture where greedy planning loses.
6. Exhaustive conditional Motion winners, unique first permutations,
   nondecreasing cost, deterministic ordering, and generated-table checksum.
7. Structural edits remain inert through step 15 and commit atomically at step
   0; Pending behavior and worst-case latency.
8. Changes CV endpoints/rounding/clamp/normal/non-finite fallback and phrase
   sampling.
9. Key CV samples each Clock, holds between, gives exact 1V/oct transpose, and
   does not alter relative plan ranking.
10. Pitch is always an active chord tone; Root is exact uninverted degree,
    independent of Motion, and has verified extrema.
11. Change at 0/4/8/12 including Pedal, exact 8ms/10V across block and sample
    rates, retrigger, and reset interruption.
12. External/action/lifecycle reset distinctions, held reset, reset while Clock
    high, same-sample Reset+Clock, and pending commit.
13. Fresh instances/resets/sample rates/block sizes reproduce identical output.
14. Pair integration: common Clock advances harmony through Cascade rests;
    increasing Fill preserves Changes pitches at retained lane positions;
    shared reset exactly replays both modules.

## DSP Audit (2026-07-30)

- **Focused coverage:** `tests/dsp/changes.test.js` covers the complete panel
  contract, scale/progression tables, exhaustive cyclic voicing and Motion
  oracles, all 8,192 generated plan entries, phrase latching, CV scaling,
  clocks/resets, trigger timing, LEDs, stable buffers, and paired behavior with
  Cascade.
- **Measured status:** the strict 44.1/48/96kHz by 128/512-sample audit matrix
  completed 10 scenarios per configuration with finite, stable buffers, zero
  processing errors, zero voltage-contract flags, an exact 10.000V observed
  peak, and a maximum Node diagnostic time of 122.4 microseconds per block.
  Pitch and Root remain held CVs within their declared rails; Change remains an
  exact 0V/10V trigger.
- **Runtime decision:** exhaustive musical planning is kept outside
  `process()` and verified against a checked-in 8,192-entry `Int8Array`.
  Production DSP performs constant-time indexed reads with no per-sample
  allocation or search.
- **Next action:** retain generator/table equivalence and paired common-clock
  tests whenever harmonic data, tie-breaks, or module registration changes.

## Annotated Sources

Accessed 2026-07-30 unless noted.

### Primary/manufacturer

1. Noise Engineering, [Gamut Repetitor Manual](https://manuals.noiseengineering.us/gr/)
   — panel, root/scale/loop, 1V/oct, voltage ranges, thresholds, design notes.
2. Noise Engineering, [Introducing Gamut Repetitor](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/introducing-gamut-repetitor/)
   — repeatable random intent and Buchla context.
3. Noise Engineering, [Gamut firmware update](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/gamut-repetitor-update/)
   — user feedback and revised pitch/trigger coupling.
4. Noise Engineering, [Opp Ned Manual](https://manuals.noiseengineering.us/on/)
   — 8HP arp panel, patterns, direction/range, reset/freeze, transpose, rails.
5. Noise Engineering, [Developing Multi Repetitor](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/developing-multi-repetitor/)
   — immediacy, historical prototypes, and feature-complexity trade-off.
6. ACL / Mathias Kettner, [Sinfonion Manual 1.0c](https://www.acl-synth.com/manuals-eng/sinfonion-manual-1.0c.pdf)
   — separate chord/arp/articulation functions, inversions, bass root, reset.
7. Intellijel, [Metropolix Manual 1.6](https://intellijel.com/downloads/manuals/metropolix_manual_v1.6_2025.09.24.pdf)
   — queued structural changes at reset/grid boundaries.

### Theory/algorithm

8. Dmitri Tymoczko, [The Geometry of Musical Chords](https://pubmed.ncbi.nlm.nih.gov/16825563/),
   *Science* 313 (2006), DOI `10.1126/science.1126287` — short voice-leading
   paths and chord-space framing.
9. Open Music Theory, [Four-Chord Schemas](https://viva.pressbooks.pub/openmusictheory/chapter/4-chord-schemas/)
   — doo-wop and singer/songwriter progressions.
10. Open Music Theory, [Classical Schemas](https://viva.pressbooks.pub/openmusictheory/chapter/classical-schemas/)
    — lament degree descent.
11. Open Music Theory, [Diatonic Modes](https://viva.pressbooks.pub/openmusictheory/chapter/diatonic-modes/)
    and [Minor Scales](https://viva.pressbooks.pub/openmusictheory/chapter/minor-scales/)
    — scale interval cross-check and melodic-minor distinction.

### Independent/practical

12. ModularGrid, [Gamut Repetitor](https://modulargrid.net/e/noise-engineering-gamut-repetitor)
    — practical HP/panel cross-check; manufacturer manual wins conflicts.
13. ModularGrid, [ACL Sinfonion](https://modulargrid.net/e/acl-sinfonion)
    — practical 42HP scope comparison supporting the compact adaptation.
14. Afterlife Music, [ACL Sinfonion Review](https://afterlifemusic.co.uk/2023/07/acl-sinfonian-review-by-afterlife-with-example-track/)
    — independent observation of quick live chord/progression selection.
15. MusicRadar, [Tetrachords review](https://www.musicradar.com/reviews/a-joy-to-use-offers-a-vast-array-of-features-and-works-on-just-about-any-genre-cycle-instruments-tetrachords-review)
    — independent melodic/harmonic performance workflow.
