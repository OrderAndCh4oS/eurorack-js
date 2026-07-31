# Refrain — Research and Specification

**Status:** done
**Module ID:** `refrain`
**Working model:** inspired autonomous phrase-form sequencer

## Scope

Refrain is a deterministic, clocked phrase-form sequencer. It generates a small
loop of related macro-tuples and occasionally replaces selected loop cells with
bounded variations. Each cell is held for sixteen accepted clocks, so Refrain
describes musical sections rather than notes.

It is deliberately **not** a scene manager, preset morpher, arbitrary CV
recorder, or sample-accurate automation lane. Its four output lanes have fixed
semantic roles:

- `KEY`: semitone-quantized tonal offset in the inclusive range -1 V to +1 V.
- `HARM`: absolute harmonic selector in the inclusive range 0 V to +5 V.
- `ENERGY`: bipolar activity/fill control in the inclusive range -5 V to +5 V.
- `MOD`: bipolar general modulation in the inclusive range -5 V to +5 V.

For intended use, patch `HARM` to Changes or Arp and set the destination's
corresponding panel knob to exactly `0`, so the voltage is interpreted as an
absolute selector rather than an offset. Patch `ENERGY` to Cascade's fill
control.

## Research Questions and Design Reading

The source review is organized around five questions:

1. How do established generative sequencers balance repeatability and change?
2. Which interactions make loop mutation playable without becoming a scene
   manager?
3. How can changes be measured and made exact rather than probabilistic?
4. What must be deterministic across JavaScript engines and audio lifecycles?
5. How should queued actions interact at a loop boundary?

## Source Register

Sources are ordered by evidential weight within each group. Manufacturer
manuals and source code support behavior; product pages and blogs support
design intent and workflow; reviews/demos support observed use. When a live
page does not expose its original publication day, the year/era is stated and
the access date is included.

### Primary product and implementation sources

1. **“Gamut Repetitor Manual,” Noise Engineering, current documentation last
   updated 13 July 2026.**
   [Manual](https://manuals.noiseengineering.us/gr/) — Primary panel,
   voltage, looping, reset, scale, and design-note source. It describes Gamut
   as a four-channel random quantized generator whose finite Length settings
   loop captured generated material.
2. **“Introducing Gamut Repetitor,” Noise Engineering, 2024 (accessed 30 July
   2026).**
   [Announcement and development article](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/introducing-gamut-repetitor/)
   — Primary design-history source for repeatable randomized sequences,
   controllable pitch constraints, four independently advanced channels, and
   loop lengths including 1–8.
3. **“Now available: Gamut Repetitor firmware update,” Noise Engineering,
   2024 (accessed 30 July 2026).**
   [Firmware-update article](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/gamut-repetitor-update/)
   — Primary evidence that generated pitch and rhythm semantics can need
   revision after observed use; also documents the manufacturer's response to
   Ricky Tinez's independent demo/feedback.
4. **“Gamut Repetitor vs. Opp Ned: sequencer showdown,” Noise Engineering,
   2024 (accessed 30 July 2026).**
   [Comparison](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/opp-ned-vs-gamut-repetitor/)
   — Primary source distinguishing a no-state generative sequencer from an
   arpeggiator with twelve saved patterns. This directly supports Refrain's
   non-scene-manager scope and volatile performance evolution.
5. **“Generative ambient sequencing with Multi Repetitor and Gamut
   Repetitor,” Noise Engineering, 2026 (accessed 30 July 2026).**
   [Manufacturer patch article/demo](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/generative-sequencing-with-multi-repetitor-and-gamut-repetitor/)
   — Demonstrates a small control surface producing complex, slowly changing
   structure by pairing related trigger and pitch sources.
6. **“Multi Repetitor,” Noise Engineering Documentation, last updated 13 July
   2026.**
   [Manual](https://manuals.noiseengineering.us/mr/) — Primary source for a
   four-lane algorithmic rhythm generator designed for on-the-fly performance,
   with a selected base family and per-lane modifiers.
7. **“Developing Multi Repetitor,” Noise Engineering, 2026 (accessed 30 July
   2026).**
   [Development article](https://noiseengineering.us/blogs/loquelic-literitas-the-blog/developing-multi-repetitor/)
   — Primary design-history evidence that large editable/screen-based
   prototypes were rejected in favor of a simpler playable interface, and
   that smooth movement between patterns was a specific design problem.
8. **“Marbles Manual,” Mutable Instruments, 2018; archived documentation
   accessed 30 July 2026.**
   [Manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/marbles/manual/)
   — Primary source for DEJA VU repetition/novelty, finite loop lengths,
   locked loops, slow mutation, quantized voltage generation, and the
   distinction between reusing decisions and drawing new ones.
9. **“Marbles Firmware,” Mutable Instruments, versions 1.0–1.3, final release
   in the archived product era (accessed 30 July 2026).**
   [Firmware history and binaries](https://pichenettes.github.io/mutable-instruments-documentation/modules/marbles/firmware/)
   — Primary behavioral revision record. Version 1.2 adds “super lock” and
   version 1.3 specifies next-clock reset behavior while warning that
   coincident reset and clock are unspecified. Refrain closes that ambiguity
   explicitly.
10. **“Marbles Open Source,” Émilie Gillet / Mutable Instruments, 2018–2022
    archive.**
    [Build/source notes](https://pichenettes.github.io/mutable-instruments-documentation/modules/marbles/open_source/)
    and [official `marbles` source tree](https://github.com/pichenettes/eurorack/tree/master/marbles)
    — Primary implementation reference for a fixed-resource embedded
    random/looping sequencer. It is a reference to study, not code to port.
11. **“Grids Manual,” Mutable Instruments, original module 2013; archived
    manual revision 2017 (accessed 30 July 2026).**
    [Manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/grids/manual/)
    — Primary source for a low-dimensional map of related patterns, continuous
    navigation, density/fill controls, and bounded random perturbation.
12. **“Grids,” Émilie Gillet / Mutable Instruments, 2013–2022 archive.**
    [Official `grids` source tree](https://github.com/pichenettes/eurorack/tree/master/grids)
    — Primary implementation reference for table/map-based relatedness and
    deterministic embedded pattern lookup. Refrain uses neither its training
    data nor its rhythm map.
13. **“TuringMachine Mark 2,” Tom Whitwell / Music Thing Modular, Mk1 launched
    June 2012; Mk2 repository/design 2016.**
    [Official repository and documentation](https://github.com/TomWhitwell/TuringMachine)
    — Primary source describing a random looping sequencer whose voltage
    strings can lock or slip gradually. It supports the repeat/change
    precedent, not Refrain's exact-K algorithm.
14. **“TURING MACHINE Mk ii Instructions,” Music Thing Modular / Thonk,
    version 1.01, 20 April 2016.**
    [Build and operating document](https://www.thonk.co.uk/wp-content/uploads/Documents/turing2016/Turing_Machine_Mkii_Build_Doc_v1.01a.pdf)
    — Primary-adjacent hardware documentation for loop-length selection and
    the module's clocked shift-register implementation.
15. **“Metropolix Manual,” Intellijel, version 1.6, 24 September 2025.**
    [Official manual](https://intellijel.com/downloads/manuals/metropolix_manual_v1.6_2025.09.24.pdf)
    and [product page](https://intellijel.com/shop/eurorack/metropolix/) —
    Primary sources for a performance sequencer with stored presets,
    accumulators, probability, and controlled variation. Refrain borrows the
    performance emphasis but rejects track/scene/preset depth.
16. **“René,” Make Noise, current René generation introduced 2018; current
    page/manual accessed 30 July 2026.**
    [Official product page and manual link](https://www.makenoisemusic.com/modules/rene/)
    — Primary source for real-time Cartesian sequencing, visible activity,
    performance programming, and 64 stored states. The state system is an
    explicit contrast with Refrain's single volatile Anchor.
17. **“Mimetic Sequent Manual,” Noise Engineering, original product era
    2016–2017; current documentation last updated 13 July 2026.**
    [Manual](https://manuals.noiseengineering.us/ms/) — Primary source for a
    64-step CV recorder/randomizer, three patterns, chromatic quantization,
    bounded pitch-aware or motion-aware variation, pattern duplication, and
    saving to flash. It is the clearest negative boundary: Refrain has no CV
    input, recording, flash save, or multi-pattern selector.
18. **“meloDICER User Guide,” VERMONA, manual version 1.1 / firmware R19,
    early-2020s revision (accessed 30 July 2026).**
    [Official support/download page](https://www.vermona.com/en/support/product/melodicer/)
    and [official product description](https://www.vermona.com/produkte/module/produkt/melodicer/)
    — Primary source for balancing stochastic and deterministic melody/rhythm,
    live control, looped “dice” mode, stored generator conditions, and explicit
    clock thresholds. Refrain adopts the balance, not saved patterns.
19. **“Chaos Manual,” CLANK, firmware 1.17, 20 July 2023.**
    [Official manual PDF](https://static1.squarespace.com/static/5d77f17826f9797b805bdae8/t/64b8fa30b1d4be19a870f17a/1689844272963/Chaos%2BManual%2Bv1.17.pdf)
    and [product page](https://www.clank.eu/chaos) — Primary source for six
    random/looping CV and gate lanes, per-parameter entropy (distance from the
    previous value), freezing recent values, editing, save/recall, and reset.
20. **“Bloom” (v1 manual), Qu-Bit Electronix, original product/manual
    2019–2020; legacy resource accessed 30 July 2026.**
    [Official legacy page](https://www.qubitelectronix.com/legacy-2026) and
    [official manual PDF](https://www.qubitelectronix.com/s/QB_Bloom-7cly.pdf)
    — Primary source for a user-authored trunk, recursively related branches,
    bounded transposition/inversion/reversal/mutation, “Unmutate,” and eight
    stored patterns. Refrain chooses a fixed loop and explicit anchor instead
    of a branching scene tree.

### Determinism, distance, and phrase structure

21. **“PCG: A Family of Simple Fast Space-Efficient Statistically Good
    Algorithms for Random Number Generation,” Melissa E. O'Neill, Harvey Mudd
    College technical report HMC-CS-2014-0905, 5 September 2014.**
    [Paper and citation record](https://www.pcg-random.org/paper.html) and
    [minimal PCG C usage/reference vectors](https://www.pcg-random.org/using-pcg-c-basic.html)
    — Primary algorithm source for a reproducible 64-bit-state/32-bit-output
    generator and unbiased bounded generation.
22. **“Math.random,” ECMA-262 ECMAScript Language Specification, Ecma
    International / TC39, living specification accessed 30 July 2026.**
    [Normative section](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.random)
    — Specifies an implementation-defined random algorithm/strategy and no
    user seed; therefore it cannot satisfy Refrain's cross-lifecycle
    reconstruction contract.
23. **“Error Detecting and Error Correcting Codes,” R. W. Hamming, *Bell
    System Technical Journal* 29(2), April 1950, pp. 147–160.**
    [Publisher record and DOI](https://onlinelibrary.wiley.com/doi/10.1002/j.1538-7305.1950.tb00463.x)
    — Foundational source for counting differing fixed positions. Refrain uses
    Hamming weight/distance only for the exact K-cell selection mask.
24. **“Binary Codes Capable of Correcting Deletions, Insertions and
    Reversals,” V. I. Levenshtein, *Soviet Physics Doklady* 10, February 1966,
    pp. 707–710.**
    [Bibliographic record](https://ui.adsabs.harvard.edu/abs/1966SPhD...10..707L/abstract)
    — Foundational edit-operation metric. It is context for bounded change,
    not Refrain's runtime algorithm because cell count and alignment do not
    change.
25. **“Comparison of Musical Sequences,” Marcel Mongeau and David Sankoff,
    *Computers and the Humanities* 24(3), June 1990, pp. 161–175.**
    [ERIC bibliographic record](https://eric.ed.gov/?id=EJ422077) — Adapts
    sequence distance to pitch and rhythm. It cautions against equating a
    simple numeric cell delta with perceptual musical distance.
26. **“Sampling Variations of Lead Sheets,” Pierre Roy, Alexandre
    Papadopoulos, and François Pachet, arXiv:1703.00760, 2 March 2017.**
    [arXiv record](https://arxiv.org/abs/1703.00760) — Demonstrates sampling
    structured musical variations within controlled similarity bounds and
    evaluates against Mongeau–Sankoff. It motivates explicit bounds while also
    showing that Refrain's lightweight tuple metric is only a proxy.
27. **“The Local Boundary Detection Model (LBDM) and its Application in the
    Study of Expressive Timing,” Emilios Cambouropoulos, International
    Computer Music Conference, 2001.**
    [University of Michigan ICMC archive](https://quod.lib.umich.edu/i/icmc/bbp2372.2001.021/1/--local-boundary-detection-model-lbdm-and-its-application?page=root%3Bsize%3D400%3Bview%3Dtext)
    — Models perceptually meaningful local melodic boundaries using pitch,
    onset, and rest changes. It supports committing macro changes at a
    phrase boundary, while Refrain uses a fixed structural boundary rather
    than running segmentation analysis.

### Boundary transactions, demos, and reviews

28. **“Launching Clips,” Ableton Reference Manual Version 12, Ableton,
    current manual accessed 30 July 2026.**
    [Official manual chapter](https://www.ableton.com/en/manual/launching-clips/)
    — Primary source for launch quantization and Follow Actions: requested
    changes can be deferred to a musical grid, and explicit action precedence
    is part of a live system's contract.
29. **“Tonverk User Manual,” Elektron, OS 1.3.3, 7 May 2026, section 10.1.4
    “Transition Mode.”**
    [Official manual PDF](https://www.elektron.se/wp-content/uploads/2026/05/Tonverk-User-Manual_ENG_OS1.3.3_260507.pdf)
    — Primary source contrasting sequential end-of-pattern changes with direct
    jumps/starts. Refrain fixes the choice to a sequential complete-loop
    transaction for all structural changes.
30. **“Qu-Bit Bloom,” Paul Nagle, *Sound On Sound*, February 2020.**
    [Independent review](https://www.soundonsound.com/reviews/qu-bit-bloom) —
    Observes that mutation can generate rewarding related sequences, that the
    module suits both performance and hands-free evolution, and that deeper
    interaction raises UI complexity.
31. **“Intellijel Metropolix review,” MusicRadar, 2021 (accessed 30 July
    2026).**
    [Independent review](https://www.musicradar.com/reviews/intellijel-metropolix)
    — Observes responsive controls and successful live-performance,
    improvisation, and jamming workflow.

The source list intentionally contains no retailer specifications for
Refrain's electrical contract: those voltages and thresholds are local
application requirements supplied by this specification. All live pages were
verified on 30 July 2026.

## Product and Historical Context

### Noise Engineering Gamut Repetitor and Multi Repetitor

Gamut Repetitor is the closest conceptual neighbor: related quantized pitch
outputs, deterministic seeding, controlled variation, and performance-oriented
freezing establish that musically useful autonomy needs reproducibility and a
small number of legible macro controls. Refrain differs by operating on
16-clock phrase cells and by assigning four heterogeneous semantic lanes rather
than producing several pitch streams.

Multi Repetitor contributes the idea of a master rhythm with related outputs
and performance variation. Refrain borrows the notion of relatedness, not its
rhythm-generation function.

### Mutable Instruments Marbles and Grids

Marbles demonstrates repeatable random sequences, controllable bias/spread,
external clock/reset, and a useful distinction between generating material and
locking it. Grids demonstrates a compact latent-map approach in which related
patterns can be explored with continuous controls. Refrain does not reproduce
either algorithm: it uses an explicit, inspectable array of cells and an exact
shared mutation mask.

### Music Thing Modular Turing Machine

The Turing Machine's locked shift-register loop is a key precedent for a
repeating pattern that can be made more or less mutable. Refrain replaces
bit-flip probability with an exact mutation cardinality: `AMOUNT` always
selects exactly K unique cells.

### Performance sequencers

Metropolix and René show the value of immediate physical control over looping
material and of separating transport from stored musical state. Mimetic
Sequent, meloDICER, CLANK Chaos, and Bloom provide additional examples of
controlled randomization, loop capture/recall, and bounded generative
variation. Refrain narrows those ideas to one loop, one anchor, and four fixed
macro lanes.

Ableton Live clip launch quantization and Elektron's transition workflow are
useful non-Eurorack precedents for deferring a requested structural change to a
musically complete boundary. They motivate Refrain's loop-boundary transaction
model; Refrain does not launch clips or retain scenes.

## Local Distinctness

Refrain occupies a layer above the repository's note and rhythm modules:

- Unlike `seq`, it does not expose a step editor or emit per-step pitch/gate.
- Unlike `changes`, it does not calculate chord voicings or progression logic.
- Unlike `arp`, it does not turn chord material into note events.
- Unlike `cascade`, it does not synthesize gates; `ENERGY` is intended to steer
  Cascade's fill dimension.
- Unlike `turing`, `rnd`, and `sh`, it does not emit sample-level or
  clock-by-clock random values.
- Unlike a scene manager, it neither stores rack parameters nor addresses
  module instances.
- Unlike a CV recorder, it has no recording input, overdub, interpolation, or
  arbitrary voltage capture.

Its distinct job is slow phrase form: every accepted clock advances a
substep, every sixteen accepted clocks advances a cell, and each cell holds a
coherent four-lane macro tuple.

## Closed Behavioral Contract

### Time model

- An **accepted clock** is a rising crossing from `<= 2.5 V` to `> 2.5 V`.
- Reset is active at `>= 1 V` and is edge-detected to avoid repeated resets
  while held high.
- The current cell's tuple is sample-and-held continuously at all four outputs.
- Once started, a cell lasts exactly 16 accepted clock intervals.
- Loop length is an integer from 1 through 8 cells.
- Transport state is `(cellIndex, substepIndex)`, with both zero-based.
- Initialization begins at cell 0, substep 0, with cell 0 already visible and
  a restart queued. The first accepted clock establishes cell 0/substep 0
  without advancing, matching the pre-step transport used by Changes and
  Cascade.
- After transport has started, each accepted clock increments `substepIndex`.
  The clock after substep 15 sets it to 0 and advances `cellIndex` modulo the
  active loop length.
- Reset affects transport only: it queues cell 0/substep 0 for the next
  accepted clock without changing the currently held tuple. It does not alter
  the generated base pattern, live pattern, Anchor, PRNG seed, or queued
  boundary action.
- If reset and clock edges occur on the same sample, reset wins transport and
  the clock is consumed: the sample ends at cell 0/substep 0, not substep 1.

### Pattern model

- A pattern contains eight allocated cells even when the active length is
  shorter. Only cells `[0, length)` play or participate in mutation.
- Each cell is a tuple `{ key, harm, energy, mod }`.
- `key` is stored as an integer semitone offset in `[-12, 12]` and rendered as
  `key / 12` volts.
- `harm` is stored as an integer selector step in `[0, 20]` and rendered as
  `harm / 4` volts (0.25 V resolution across 0–5 V).
- `energy` and `mod` are stored as signed integer steps in `[-20, 20]` and
  rendered as `step / 4` volts (0.25 V resolution across -5–+5 V).
- A deterministic base pattern is regenerated from the visible integer
  `SEED`. Generation uses the PCG XSH-RR 64/32 (“PCG32”) procedure specified
  below; it must not use `Math.random()`.
- A seed change schedules the newly generated base pattern for the next
  complete-loop boundary. It does not replace a tuple during a cell.
- A length change is also boundary-only. Until the boundary transaction, the
  previous length determines wrap and boundary detection.
- Committing a seed change replaces the live eight-cell pattern with the new
  base pattern. It does not overwrite Anchor.
- Newly exposed cells after a length increase already exist in the current
  eight-cell live/base pattern; no random work occurs at the boundary.

### Amount and mutation

- `AMOUNT` maps to an exact integer `K` in `[1, activeLength]`.
- The UI control itself is integer `1..8`; at mutation time
  `K = min(amount, activeLength)`.
- A mutation request snapshots `AMOUNT` and queues one mutation intent for the
  next complete-loop boundary. The candidate is constructed from the live
  pattern at that boundary, after pending Seed/Length changes commit. Repeated
  requests before the boundary replace the pending intent (latest request
  wins).
- The candidate chooses exactly K unique active cell indices using a partial
  Fisher–Yates shuffle driven by PCG32.
- The same K-cell mask applies to all four lanes.
- At every chosen cell, all four lanes receive bounded, quantized deltas:
  `KEY` ±1..±4 semitones; `HARM` ±1..±3 selector steps; `ENERGY` and `MOD`
  ±1..±4 quarter-volt steps.
- Delta signs and magnitudes are deterministic PRNG results.
- Saturating at a rail must not produce a no-op. If a sampled signed delta
  clamps to the original value, reflect the direction inward; if necessary,
  choose the nearest valid adjacent quantized value.
- Consequently every chosen cell changes all four lanes, and therefore changes
  by at least one lane as a weaker invariant.
- Unselected cells are bit-for-bit unchanged.
- Mutation never changes length, seed, transport, or Anchor.

This exact-cardinality design uses Hamming distance on the cell-selection mask:
the mask distance is exactly K. Lane-wise quantized edit sizes are bounded,
providing an intentionally simple musical-distance proxy rather than claiming
the full melodic-edit models of Mongeau–Sankoff or later learned similarity
work.

### Anchor, Recall, and automatic evolution

- `ANCHOR` is a two-position `RUN`/`HOLD` switch, defaulting to `RUN`.
- A rising transition from Run to Hold immediately copies the current
  eight-cell live pattern into a single volatile Anchor slot and marks it
  valid. It does not change transport.
- While the switch is in Hold, automatic evolution is disabled.
- A falling transition from Hold to Run resumes automatic evolution without
  clearing or changing the valid Anchor. A later Run-to-Hold transition
  overwrites Anchor with the then-current live pattern.
- `RECALL` is ignored when no Anchor is valid. Otherwise it queues an Anchor
  copy for the next complete-loop boundary.
- A manual `MUTATE` remains allowed while Hold is active; Hold prevents only
  automatic evolution.
- Automatic evolution is attempted once per complete-loop boundary when the
  switch is in Run. `CHANCE` is an integer percent `0..100`; a PCG32 draw below
  that percentage creates and commits a mutation using the current `AMOUNT`.
- A complete-loop boundary is the clock edge that would wrap from the final
  cell's substep 15 to cell 0/substep 0.
- Boundary action priority is `RECALL > MUTATE > automatic`.
- If Recall and Mutate are both pending, Recall commits and the pending Mutate
  is discarded. Automatic evolution is not evaluated at that boundary.
- If Mutate is pending without Recall, it commits and automatic evolution is
  not evaluated.
- If neither manual action is pending, automatic evolution may commit.
- Anchor capture itself is immediate, so a same-block later boundary sees the
  new Anchor and Hold state.
- Boundary commits occur before outputting the newly entered cell 0 tuple.

### Complete-loop boundary transaction

The boundary transaction is atomic and has this exact order:

1. Detect wrap using the pre-boundary active length.
2. If Seed is pending, regenerate the eight-cell base, replace the eight-cell
   live pattern, and reset mutation PRNG continuation to the new seed-derived
   post-base state.
3. If Length is pending, commit it.
4. Resolve one pattern action: valid Recall, otherwise queued Mutate, otherwise
   eligible automatic evolution. Recall discards a queued Mutate.
5. Set transport to cell 0/substep 0 and expose the final live cell 0 tuple.

A Recall at the same boundary as a Seed change therefore restores Anchor after
the new base/PRNG state is installed. A Mutate at that boundary mutates the new
base using the new length. Structural control changes are not themselves
“automatic evolution” and still commit while Hold is active.

### Exact PCG32 and integer mapping

Use unsigned arithmetic modulo `2^64`, with mask
`0xffffffffffffffff`, multiplier `6364136223846793005`, and the fixed odd
one-sequence increment `1442695040888963407`.

Seeding for visible integer `seed` is:

1. set state to zero;
2. run one PCG32 step;
3. add unsigned `seed` to state modulo `2^64`;
4. run one PCG32 step.

Each step returns the output derived from `oldState`, then updates
`state = oldState * multiplier + increment (mod 2^64)`. The output is the
32-bit rotate-right of
`xorshifted = (((oldState >> 18) XOR oldState) >> 27)` by
`rotation = oldState >> 59`, exactly as PCG XSH-RR 64/32 defines it.

`bounded(n)` must use rejection rather than raw modulo:
`threshold = (2^32 - n) mod n`; draw unsigned 32-bit values until
`draw >= threshold`, then return `draw mod n`.

Base generation visits cells 0 through 7 and, within each cell, draws in this
fixed order:

1. `key = bounded(25) - 12`;
2. `harm = bounded(21)`;
3. `energy = bounded(41) - 20`;
4. `mod = bounded(41) - 20`.

The PRNG state after those 32 bounded results becomes mutation continuation.
An automatic eligibility test draws `bounded(100)` and succeeds exactly when
the result is less than `CHANCE`. A mutation creates indices
`[0, ..., activeLength - 1]` and performs a partial Fisher–Yates selection:
for selection position `j = 0..K-1`, swap it with
`j + bounded(activeLength - j)`; the first K indices are the shared mask.

For each selected cell, visit lanes in `KEY`, `HARM`, `ENERGY`, `MOD` order.
Draw magnitude `1 + bounded(maxDelta)` with respective maxima `4, 3, 4, 4`,
then draw the sign with `bounded(2)` (`0 = negative`, `1 = positive`). Apply
the signed delta with saturation. If saturation returns the original value,
apply the opposite-signed delta instead. All lane domains contain more than
one value, so this rule guarantees an actual quantized change.

Golden tests must lock the seeding output, first base pattern, post-base PRNG
state, bounded-rejection behavior, selected masks, and lane deltas. This exact
contract takes precedence over alternative PCG stream/seeding conventions.

### Volatility and persistence

The live mutated pattern and Anchor are worklet-internal runtime state and are
volatile. The current architecture does not automatically patch-persist such
state. Patch state contains only declared visible controls. Therefore:

- lifecycle reset/recreation or patch load deterministically reconstructs the
  base pattern from `SEED`;
- uncommitted mutation intents, live mutations, Anchor contents,
  Anchor-valid state,
  and mutation PRNG continuation are lost;
- the visible `SEED`, `LENGTH`, `AMOUNT`, `CHANCE`, and other declared controls
  recreate the same base, not the previous performance's mutations;
- because `anchor` is a visible persisted switch, lifecycle reconstruction
  treats its edge history as Run: if the restored value is Hold, the first
  process pass captures the reconstructed base as a new Anchor and suppresses
  auto; it does not recover the previous Anchor;
- this limitation must be stated in user-facing documentation/tooltips rather
  than implying scene or pattern storage.

## Panel Contract

### Parameters and actions

| ID | Label | Kind | Range/default | Contract |
|---|---|---|---|---|
| `seed` | SEED | stepped knob | integer 0..65535, default 0 | Deterministic base-pattern identity; changes commit at the next complete-loop boundary. |
| `length` | LENGTH | stepped knob | integer 1..8, default 4 | Active cells; boundary-only. |
| `amount` | AMOUNT | stepped knob | integer 1..8, default 1 | Exact unique-cell mutation count, clamped to active length. |
| `chance` | CHANCE | knob | integer 0..100%, default 20 | Automatic mutation probability per complete-loop boundary. |
| `mutate` | MUTATE | momentary button/action | default released | Queue/replace a mutation intent for the next boundary. |
| `anchor` | ANCHOR | two-position switch | `0` Run / `1` Hold, default Run | Entering Hold immediately captures/overwrites Anchor and suppresses auto; returning to Run resumes auto but retains Anchor for Recall. |
| `recall` | RECALL | momentary button/action | default released | Queue Anchor restore for the next boundary; ignored if invalid. |

`MUTATE` and `RECALL` are rising-edge commands and are not semantically
persistent even if represented through numeric params at the worklet boundary.
`ANCHOR` is a patch-persisted switch; only its Run/Hold position persists, not
the captured Anchor contents.

### Inputs

| Port | Label | Signal | Voltage/normal | Contract |
|---|---|---|---|---|
| `clock` | CLOCK | clock | threshold `>2.5 V`, normal 0 V | Rising crossing advances one substep. |
| `reset` | RESET | trigger | threshold `>=1 V`, normal 0 V | Rising crossing resets transport only. |

There are no normalled clock sources and no CV-recording or lane inputs.

### Outputs

| Port | Label | Signal | Voltage | Resolution/meaning |
|---|---|---|---|---|
| `key` | KEY | CV | -1..+1 V | 1/12 V; semitone-quantized tonal offset. |
| `harm` | HARM | CV | 0..+5 V | 0.25 V; absolute harmonic selector. |
| `energy` | ENERGY | CV | -5..+5 V | 0.25 V; bipolar activity/fill macro. |
| `mod` | MOD | CV | -5..+5 V | 0.25 V; bipolar general macro. |

All outputs are filled for the entire processing block, remain finite, and hold
their tuple between accepted clocks.

### LEDs

| ID | Meaning |
|---|---|
| `cell1`..`cell8` | One-hot active-cell position; LEDs above `length` are off. |
| `substep` | 50 ms bright hold after an accepted clock, otherwise shows normalized progress `(substepIndex + 1) / 16` at a restrained level. |
| `anchor` | `0` with no valid Anchor; `0.5` with a valid Anchor while in Run; `1` with a valid Anchor while in Hold. |
| `pending` | On when Recall or Mutate is queued; Recall may use full brightness and Mutate half brightness. |
| `mutation` | 50 ms visual hold when manual or automatic mutation commits. |

No display telemetry or custom renderer is required; the initial implementation
should use declarative controls and bounded LED state only.

## DSP Model and Trade-offs

The DSP is an inspired-by utility adaptation, not a circuit or firmware
emulation. Its state consists of fixed-size typed arrays for the base, live,
candidate, and Anchor patterns; transport counters; edge-detector history; a
PCG32 state; pending-action flags; and LED values. `process()` performs no
allocation.

PCG32 is chosen because its algorithm and output permutation can be specified,
tested with vectors, and reproduced independently of a JavaScript engine.
JavaScript's `Math.random()` deliberately leaves the algorithm
implementation-defined and therefore cannot meet the seed-recreation contract.
Implement modulo-`2^64` state with two unsigned 32-bit halves so no `BigInt`
work occurs in the audio loop. Base regeneration and a boundary mutation are
bounded but still occur from `process()`, so their arithmetic must remain
allocation-free. Commit golden vectors against the mathematical definition
above.

The fixed four-lane tuple and shared cell mask privilege recognizable form over
maximum entropy. Quarter-volt harmonic and macro grids are a deliberate
musical abstraction because the destination modules do not publish a shared
semantic voltage vocabulary. The narrower `KEY` lane follows the repository's
1 V/octave convention.

## Assumptions, Contradictions, and Source Weighting

- Manufacturer manuals and firmware/source repositories win for documented
  behavior of comparison products; product pages are used for high-level
  intent; retailer copy and demos are context only.
- Comparable products disagree on whether lock/freeze prevents manual change.
  Refrain defines Hold narrowly: it suppresses automatic evolution but permits
  explicit Mutate, because a performance lock should not disable an
  intentional command. Returning to Run resumes auto without destroying the
  Recall target.
- Comparable products use both immediate and quantized randomization. Refrain
  uses boundary commits for structural coherence, following launch/transition
  workflows; Anchor capture remains immediate so the performer captures what
  is sounding.
- Hardware random modules frequently describe musical randomness without
  promising cross-restart bit identity. Refrain explicitly guarantees base
  reconstruction from seed and tests the PRNG.
- `HARM`, `ENERGY`, and `MOD` voltage semantics are local integration
  contracts, not claims about a source product. Destination controls may sum
  knob and CV, hence the explicit zero-knob instruction for absolute `HARM`.
- The 0.25 V macro grid, mutation delta sizes, default chance, and eight-cell
  allocation are product-design assumptions selected for audible,
  testable boundedness.
- The declarative software panel uses 10 HP and `module-color-ten`; these are
  local presentation choices, not claims about comparison hardware. The
  restrained non-clock `substep` LED level is one quarter of normalized
  progress, so accepted clocks remain visually distinct at full brightness.
- Runtime patterns are not patch state. Adding persisted structured pattern
  state would change scope toward a scene/pattern manager and is explicitly
  deferred.

## Test Targets

1. **Initialization:** correct defaults; fixed eight-cell buffers; deterministic
   seed-0 golden pattern; outputs initially equal cell 0.
2. **Determinism:** PCG32 golden vectors; identical seed/control tuples produce
   identical base patterns after reconstruction; no `Math.random`.
3. **Buffer integrity:** all outputs fill every sample for multiple block sizes;
   no NaN/Infinity; no input or output array replacement.
4. **Voltage/quantization:** `KEY` stays -1..+1 V on 1/12 V steps; `HARM`
   0..5 V and macro outputs -5..+5 V on 0.25 V steps.
5. **Clock threshold:** only rising crossings from `<=2.5` to `>2.5 V` advance;
   a held clock does not retrigger; the first accepted edge establishes step
   zero and the following 16 accepted edges advance one cell.
6. **Reset:** `>=1 V` rising edge queues a transport restart without changing
   the held tuple, pattern, Anchor, queues, or PRNG; the next clock starts at
   0/0 and same-sample reset+clock ends at 0/0.
7. **Length:** values clamp/step 1..8; requested changes do not alter the active
   loop before a complete boundary and commit atomically there.
8. **Seed:** change is boundary-only, replaces live base deterministically, and
   leaves Anchor unchanged.
9. **Amount:** for every length and amount, mutation selects exactly
   `min(amount,length)` unique active cells; no inactive or duplicate cells.
10. **Shared mutation mask:** selected cells change all four lanes within their
    stated delta limits and quantization; all unselected cells are identical.
11. **Rail behavior:** mutation at every min/max rail still changes every lane
    without leaving its voltage range.
12. **Queued mutation:** request is inaudible before boundary; repeated Mutate
    requests retain only the latest intent/Amount snapshot; candidate
    construction and commit precede new cell-0 output.
13. **Anchor:** Run-to-Hold captures/overwrites the live eight-cell pattern
    immediately; Hold suppresses automatic evolution while leaving manual
    Mutate operational; Hold-to-Run resumes auto without clearing Anchor;
    LED values distinguish invalid, valid/Run, and valid/Hold.
14. **Recall:** ignored without Anchor; otherwise boundary-only and exact,
    including cells outside current active length.
15. **Priority:** simultaneous pending Recall and Mutate commits Recall and
    discards Mutate; manual Mutate suppresses auto for that boundary; Recall
    suppresses both.
16. **Automatic mutation:** chance 0 never mutates; chance 100 mutates at each
    eligible Run boundary; one attempt maximum per loop; a valid retained
    Anchor does not suppress auto after returning to Run.
17. **LEDs:** one-hot cell position, inactive-length LEDs off, valid/pending
    states accurate, accepted-clock/substep behavior bounded 0..1, and 50 ms
    clock/mutation holds visible at the worklet telemetry cadence.
18. **Lifecycle/reset distinction:** DSP `reset()` reconstructs seed-derived
    base and clears volatile live/Anchor/pending/PRNG continuation, while RESET
    input only resets transport. Reset clears Anchor edge history to Run, so a
    persisted Hold value captures the reconstructed base on the next process.
19. **Contract integration:** declarative params/ports/LEDs satisfy module
    contracts and all signal types/normal voltages are declared.

## Implementation Plan

- **Module/category:** `refrain`, `sequencer`.
- **Research branch/worktree:** `research/refrain` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/refrain-research`.
- **Implementation branch/worktree:** `module/refrain` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/refrain`.
- **DSP model:** deterministic inspired-by phrase-form sequencer using fixed
  arrays, PCG32, 16-clock cells, boundary transactions, one volatile Anchor,
  and a shared exact-K mutation mask.
- **Params/actions:** `seed`, `length`, `amount`, `chance`; momentary `mutate`
  and `recall`; two-position Run/Hold `anchor`.
- **Inputs:** `clock`, `reset`.
- **Outputs:** `key`, `harm`, `energy`, `mod`.
- **LEDs:** `cell1`..`cell8`, `substep`, `anchor`, `pending`, `mutation`.
- **UI:** declarative; add succinct help text for destination-knob-zero and
  volatile Anchor/live mutations if supported by existing declarative fields.
- **Factory patch:** `test-refrain`; demonstrate clock/reset, `KEY` to a tonal
  destination, `HARM` to Changes or Arp with its destination knob at zero,
  `ENERGY` to Cascade fill, and at least one audible/visible route.
- **Shared framework changes:** explicit RackHost patch loads must request
  replace-mode worklet activation so volatile live pattern, Anchor, pending
  actions, and PRNG state are discarded even when module IDs and types match.
  Ordinary topology edits and failed-load rollback remain non-replacing; do
  not add persisted pattern or scene infrastructure.
- **Focused tests:**
  `npm test -- tests/dsp/refrain.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- **RackHost/worklet validation:**
  `npm test -- tests/app/rack-host.test.js tests/audio/worklet-engine.test.js tests/audio/worklet-processor.test.js`
- **Factory-patch validation:**
  `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- **DSP audit:**
  `npm run audit:dsp -- --module refrain --matrix --strict-voltage`
- **Full validation:** `npm test`
- **Known assumptions:** quarter-volt macro grid, delta ranges, exact action
  timing, and volatile runtime state are normative local decisions described
  above.

## Gate Decision

**Decision: done.** The linked source register is verified, and the
behavioral, timing, panel, voltage, deterministic-generation, boundary
priority, persistence, DSP, assumption/contradiction, test, and
implementation-plan contracts are closed. Implementation and validation are
complete.

## DSP Audit (2026-07-31)

The implemented module passes
`npm run audit:dsp -- --module refrain --matrix --strict-voltage` across
44.1, 48, and 96 kHz at block sizes 128 and 512. All 13 generated scenarios
per configuration completed without errors, produced finite outputs, retained
stable input/output buffers, and reported zero voltage-contract flags. The
largest observed output magnitude was 4.75 V. The diagnostic Node timing
maximum was 128.0 microseconds per block; it is not a real-time AudioWorklet
threshold. Focused tests additionally lock the exact PCG32 vectors, seed-0
base and mutation continuation, boundary transaction ordering, exact-K shared
mutation masks, Run/Hold Anchor behavior, Recall/manual/automatic priority,
clock/reset semantics, quantization, reset reconstruction, and deterministic
replay. Production-style hydration tests also verify that params assigned after
`createDSP()` install `SEED` and `LENGTH` before the first output/Anchor capture,
while restored high Mutate/Recall action values establish edge history without
replaying commands. Rack patch loading releases transient trigger/momentary
actions to their defaults before instantiation, so a captured high pulse cannot
consume the performer's first click.

The 31 July integration re-audit also verifies shared-clock phase against
Changes and Cascade: clock 1 establishes all three at step 0, clock 16 leaves
Refrain at cell 0/substep 15, and clock 17 advances Refrain to cell 1 exactly
as the companion modules enter their next step 0. Asynchronous Reset now holds
the current macro tuple until the shared next clock, preventing a one-clock
cross-module mismatch. Clock and mutation LEDs use 50 ms counters so 30 Hz
worklet telemetry can observe them.

RackHost regressions additionally verify that ordinary topology synchronization
uses non-replacing activation, explicit patch loads use replacing activation,
and a failed replacing activation restores the prior main-thread patch before a
non-replacing rollback synchronization. This rollback policy relies on the
processor's atomic activation contract: failed candidate construction or graph
compilation leaves the prior worklet module instances intact.
