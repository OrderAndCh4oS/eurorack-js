# Refrain — Research and Specification

**Status:** implemented and validated
**Module ID:** `refrain`
**Working model:** inspired deterministic phrase-form sequencer, v2 interaction
revision

## Scope

Refrain is a deterministic, clocked phrase-form sequencer. It generates a small
loop of related macro-tuples and occasionally replaces selected loop cells with
bounded variations. Each cell is held for sixteen accepted clocks, so Refrain
describes musical sections rather than notes. The v2 revision makes that form
performable: a bipolar Seed CV auditions nearby deterministic forms, direct
lane toggles scope mutation, and trigger/gate inputs expose Mutate, Recall, and
Hold to a patch.

It is deliberately **not** a scene manager, preset morpher, arbitrary CV
recorder, or sample-accurate automation lane. Its four output lanes have fixed
semantic roles:

- `KEY`: semitone-quantized tonal offset in the inclusive range -1 V to +1 V.
- `HARM`: normalized absolute harmonic-selector target in the inclusive range
  0 V to +5 V.
- `ENERGY`: bipolar activity/fill control in the inclusive range -5 V to +5 V.
- `MOD`: bipolar general modulation in the inclusive range -5 V to +5 V.

For intended use, patch `HARM` to Changes or Arp and set the destination's
corresponding panel knob to exactly `0`. Refrain emits an absolute selector
target, but both current destinations add their own panel setting to incoming
CV; the zero-knob convention is therefore required at the integration point.
Patch `ENERGY` to Cascade's fill control.

## Research Questions and Design Reading

The source review is organized around eight questions:

1. How do established generative sequencers balance repeatability and change?
2. Which interactions make loop mutation playable without becoming a scene
   manager?
3. How can changes be measured and made exact rather than probabilistic?
4. What must be deterministic across JavaScript engines and audio lifecycles?
5. How should queued actions interact at a loop boundary?
6. How can CV choose seeds without making 65,536 values noise-sensitive?
7. Which changes must wait for a whole loop, and which are playable at the next
   16-clock cell boundary?
8. What does Hold protect while leaving deliberate performance gestures live?

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
    saving to flash. It is a negative boundary: Refrain has no arbitrary CV
    recording, flash save, or multi-pattern selector.
18. **“meloDICER & MEX3 User Guide,” VERMONA, manual version 1.4 / firmware
    R41, current revision accessed 31 July 2026.**
    [Official manual PDF](https://www.vermona.com/fileadmin/user_upload/products/melodicer/downloads/melodicer%20manual%20en%201.4%20web.pdf)
    — Primary source for balancing stochastic and deterministic melody/rhythm,
    positive-edge gate assignments for re-dicing, and a Lock mode that stages
    ordinary controls until release. Refrain adopts externalized randomization
    but explicitly rejects meloDICER's global control-decoupling Lock semantics.
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
22. **“Math.random” and “Math.round,” ECMA-262 ECMAScript Language
    Specification, Ecma International / TC39, living specification accessed
    31 July 2026.**
    [Normative `Math.random` section](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.random)
    and [normative `Math.round` section](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.round)
    — `Math.random` uses an implementation-defined strategy and exposes no
    user seed, so it cannot satisfy cross-lifecycle reconstruction;
    `Math.round` closes Seed-CV half-step tie behavior.
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
    current manual accessed 31 July 2026.**
    [Official manual chapter](https://www.ableton.com/en/live-manual/12/launching-clips/)
    — Primary source for launch quantization and Follow Actions: requested
    changes can be deferred to a musical grid, and explicit action precedence
    is part of a live system's contract.
29. **“Tonverk User Manual,” Elektron, OS 1.3.3, 7 May 2026, section 10.1.4
    “Transition Mode.”**
    [Official manual PDF](https://www.elektron.se/wp-content/uploads/2026/05/Tonverk-User-Manual_ENG_OS1.3.3_260507.pdf)
    — Primary source contrasting sequential end-of-pattern changes with direct
    jumps/starts. Refrain uses that distinction to define cell-quantized
    performance changes separately from whole-loop automatic evolution.
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

### Refrain v2 interaction and implementation sources

32. **“Mimetic Digitwolis,” Noise Engineering Documentation, last updated
    13 July 2026.**
    [Official manual](https://manuals.noiseengineering.us/md2/) — Primary
    precedent for four persistent lane-selection buttons, externally
    triggerable Shred randomization, five assignable trigger inputs, and
    next-advance reset. Its selected-lane edit model supports four direct
    Refrain mutation toggles; its deep menus and save slots remain out of scope.
33. **“CVilization User Guide,” u-he / Heckmann Audio GmbH, Q2 2026 revision,
    accessed 31 July 2026.**
    [Official manual PDF](https://u-he.com/downloads/manuals/eurorack/cvilization/CVilization-user-guide.pdf)
    — Primary source for independently mutating four tracks, freezing a
    mutation result, assigning mutation/undo to external CV or trigger, and
    retaining a value until the next clock to avoid a live jump. It supports
    direct lane scope and clock-quantized changes, not Refrain's algorithm.
34. **“The Inspector Panel on Arranger Clips — Seed Section,” Bitwig Studio
    User Guide, Bitwig GmbH, current guide © 2026, accessed 31 July 2026.**
    [Official guide](https://www.bitwig.com/userguide/latest/the_inspector_panel_on_arranger_clips/)
    — Primary software precedent for showing a concrete numeric seed, hearing
    the pattern it produces, keeping a liked result, and reproducing the same
    random sequence from the same seed. It supports visible `ACTIVE`/`NEXT`
    identity rather than an LED-only pending state.
35. **“T's Musical Tools — Seed,” Jadael/T, open-source VCV Rack plugin,
    copyright 2024; release 2.2.1 dated 20 December 2025; repository accessed
    31 July 2026.**
    [Source and guide](https://github.com/Jadael/TMT) — Practical
    implementation precedent for converting an input voltage into repeatable
    seeded random output and sequencing seed voltages to revisit the same
    patterns. It supports voltage-addressed deterministic variation but does
    not define Refrain's voltage scale or timing.
36. **Local Changes and Arp module contracts, Eurorack JS, revision inspected
    31 July 2026.**
    [`changes/index.js`](../../src/js/modules/changes/index.js) and
    [`arp/index.js`](../../src/js/modules/arp/index.js) — Authoritative local
    integration evidence. Changes adds a bipolar CV-derived offset to its
    panel index; Arp adds a unipolar CV-derived offset to its chord control.
    Neither offers a shared ABS/OFFSET mode, so Refrain cannot make `HARM`
    universally absolute without the destination-knob-zero convention.

The source list intentionally contains no retailer specifications for
Refrain's electrical contract: those voltages and thresholds are local
application requirements supplied by this specification. All live pages were
reverified on 31 July 2026.

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
Sequent, Mimetic Digitwolis, CVilization, meloDICER, CLANK Chaos, and Bloom
provide additional examples of controlled randomization, externally triggered
edits, lane selection, loop capture/recall, and bounded generative variation.
Refrain narrows those ideas to one loop, one anchor, four fixed macro lanes,
and no menu.

Ableton Live clip launch quantization and Elektron's transition workflow are
useful non-Eurorack precedents for deferring a requested structural change to a
musically complete boundary. For v2, they motivate two quantization grids:
manual and Seed-audition changes use the next 16-clock cell boundary, while
unattended automatic evolution remains a whole-loop event. Refrain does not
launch clips or retain scenes.

### Seed audition and visible identity

Bitwig makes a deterministic seed useful by showing its identity and letting
the musician hear the resulting material. T's Musical Tools demonstrates the
related modular technique of revisiting deterministic output with a repeated
seed voltage. Directly spreading all 65,536 Refrain seeds over a 10 V input
would require about 0.153 mV per seed, far below a musically controllable
interval and vulnerable to ordinary modulation noise. V2 instead treats Seed
CV as a bipolar, semitone-grid offset around the panel seed: 121 reachable
offsets from -60 through +60, one adjacent seed per `1/12 V`.

The panel must show the committed seed and current target numerically. A
pending LED alone cannot identify a liked candidate or let a performer return
to it. `ACTIVE` identifies the base/PRNG seed underlying the live pattern;
`NEXT` previews the current panel-plus-CV target. It does not claim that a
subsequently mutated live pattern can be reconstructed from `ACTIVE` alone.

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

## V2 Design Decisions and Rejected Alternatives

| Question | Decision | Rejected alternative and reason |
|---|---|---|
| Seed CV scale | Bipolar -5..+5 V, quantized to -60..+60 integer seed offsets at 12 offsets/V. | Mapping 65,536 values across the jack is too sensitive; a unipolar full-range mapping also loses the useful “panel seed as centre” model. |
| Seed timing | Activate at the next cell boundary and restart transport at cell 0. | Immediate replacement can split a 16-clock phrase; waiting for a whole loop makes auditioning up to 128 clocks too slow. |
| Candidate approval | Automatic boundary activation with Hold as the audition lock. | Apply/Cancel adds controls and an extra confirmation step; Anchor/Recall already supplies a deliberate return point. |
| Seed feedback | Numeric `ACTIVE` and `NEXT` display plus bounded scalar telemetry. | LEDs convey state but cannot identify or recover one of 65,536 seeds. |
| Hold | Transport continues; Hold blocks unattended Seed-CV activation and automatic mutation, but leaves panel Seed, Length, Mutate, and Recall live. | Transport stop and global parameter lock conflate audition protection with clocking or disable explicit gestures. |
| Manual timing | Mutate and Recall commit at the next cell boundary. | Whole-loop latency is too slow for performance; mid-cell commits break phrase coherence. |
| Mutation scope | Four persistent direct toggles, one per lane, default on. | A menu or shared ABS/OFFSET mode hides common performance state; a double-tap solo gesture is deferred until there is evidence it is needed. |
| All lanes off | Mutate is rejected and automatic evolution is ineligible, with no PRNG draw or state change. | Consuming randomness for an inaudible no-op makes later deterministic results depend on a gesture that did nothing. |
| `HARM` | Keep the normalized 0..5 V absolute-target lane and require the destination knob at zero. | Offset/absolute modes cannot compensate consistently for the current, different Changes and Arp CV laws and would duplicate destination policy. |
| Seed stabilization | Quantize at `1/12 V` and sample only at cell boundaries; no hysteresis. | Hysteresis makes voltage-to-seed mapping history-dependent and weakens deterministic replay. |

## Closed Behavioral Contract

### Time model

- An **accepted clock** is a rising crossing from `<= 2.5 V` to `> 2.5 V`.
- A **cell boundary** is an accepted clock that enters cell 0 after
  startup/reset or ordinarily advances from substep 15 to the next cell at
  substep 0.
- A **natural loop boundary** is an ordinary cell boundary that would wrap
  from the old active length's final cell to cell 0. A Seed-driven restart and
  a startup/reset entry into cell 0 are not natural loop boundaries.
- Reset, Mutate, and Recall inputs use a `>= 1 V` high level and independent
  rising-edge histories. Held-high trigger signals do not retrigger. Hold is a
  level gate sampled continuously; only transitions of the combined
  panel-or-gate Hold state matter for Anchor capture.
- The current cell's tuple is sample-and-held continuously at all four outputs.
- Once started, a cell lasts exactly 16 accepted clock intervals.
- Loop length is an integer from 1 through 8 cells.
- Transport state is `(cellIndex, substepIndex)`, with both zero-based.
- First-process hydration exposes cell 0 and queues a restart. The first
  accepted clock is a cell boundary that establishes cell 0/substep 0 without
  advancing, matching the pre-step transport used by Changes and Cascade.
- After transport has started, each accepted clock increments `substepIndex`.
  The clock after substep 15 sets it to 0 and advances `cellIndex` modulo the
  active loop length, unless a Seed activation restarts at cell 0.
- Reset affects transport only: it queues cell 0/substep 0 for the next
  accepted clock without changing the currently held tuple. It does not alter
  the generated base pattern, live pattern, Anchor, PRNG seed, or queued
  manual action.
- If reset and clock edges occur on the same sample, reset wins transport and
  that clock performs the restart cell boundary: eligible Seed/manual
  transactions occur, then the sample ends at cell 0/substep 0, not substep 1.
- Input edges on the exact clock sample are observed before that boundary's
  transaction and may commit there. Edges after it wait for the next cell
  boundary.
- A panel-button rising edge is treated as occurring at sample 0 of the
  process block in which its param is first observed high. This makes its
  ordering relative to in-block jack and clock edges testable.

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
  effective seed. Generation uses the PCG XSH-RR 64/32 (“PCG32”) procedure
  specified below; it must not use `Math.random()`.
- Let `panelSeed` be the finite stepped `SEED` value in `0..65535`. At a
  particular sample, compute:

  ```text
  seedOffset = Math.round(clamp(finite(seedCV, 0), -5, +5) * 12)
  targetSeed = ((panelSeed + seedOffset) % 65536 + 65536) % 65536
  ```

  `Math.round` is the ECMAScript operation, including its ties-toward-positive-
  infinity behavior. The map is stateless and has no hysteresis. It exposes
  exactly 121 offsets, -60 through +60, and wraps at both ends of the 16-bit
  seed domain.
- The latest processed sample updates the preview `NEXT`; the exact routed
  `seedCV` sample on a cell-boundary clock is authoritative for activation.
  A preview can therefore change between worklet telemetry frames and is not a
  latched promise.
- The DSP remembers the panel seed used for the active base separately from
  the combined active seed. A differing panel value is an explicit manual
  Seed intent. If the panel value is unchanged, a differing combined target is
  a CV-only intent.
- At every cell boundary, a target different from `ACTIVE` commits when either
  effective Hold is false or the panel intent is explicit. A CV-only intent is
  blocked while Hold is true. A blocked target remains visible as `NEXT`.
- A committed target regenerates the base, replaces the live eight-cell
  pattern, resets mutation PRNG continuation to the seed-derived post-base
  state, and restarts transport at cell 0/substep 0. It does not overwrite
  Anchor. Thus changing Seed CV once per cell auditions one complete 16-clock
  cell-0 phrase from each candidate; holding a target lets its later cells
  proceed.
- If an explicit panel change produces the same combined target as `ACTIVE`,
  the boundary acknowledges the new panel basis without regeneration or
  transport restart. Later CV movement is then CV-only.
- `LENGTH` retains the v1 rule: a requested change commits only at a natural
  loop boundary detected with the old active length. Rapid Seed auditioning can
  postpone that boundary; this is intentional and must be shown by the active
  cell LEDs rather than silently changing length.
- Newly exposed cells after a length increase already exist in the current
  eight-cell live/base pattern; no random work occurs at the boundary.

### Amount and mutation

- `AMOUNT` maps to an exact integer `K` in `[1, activeLength]`.
- The UI control itself is integer `1..8`; at mutation time
  `K = min(amount, activeLength)`.
- Four persisted direct toggles form a lane mask in fixed bit order
  `KEY=1`, `HARM=2`, `ENERGY=4`, `MOD=8`; all default on.
- A panel `MUTATE` rising edge or `MUTATE` trigger-input rising edge is one
  logical command. It snapshots the current `AMOUNT` and four-bit mask and
  queues one intent for the next cell boundary. Repeated valid requests before
  that boundary replace the pending snapshot; latest request wins.
- A request whose sampled lane mask is zero is rejected. It clears an older
  queued Mutate intent, queues nothing, lights no pending/mutation indication,
  and consumes no PCG draw or state. It does not affect a queued Recall.
- The candidate is constructed from the live pattern at the commit boundary,
  after an eligible Seed regeneration and natural-loop Length commit.
- The candidate chooses exactly K unique active cell indices using a partial
  Fisher–Yates shuffle driven by PCG32.
- The same K-cell mask applies to every enabled lane. Disabled lanes and all
  inactive cells are bit-for-bit unchanged.
- At every chosen cell, each enabled lane receives a bounded, quantized delta:
  `KEY` ±1..±4 semitones; `HARM` ±1..±3 selector steps; `ENERGY` and `MOD`
  ±1..±4 quarter-volt steps.
- Delta signs and magnitudes are deterministic PRNG results.
- Saturating at a rail must not produce a no-op. If a sampled signed delta
  clamps to the original value, reflect the direction inward; if necessary,
  choose the nearest valid adjacent quantized value.
- Consequently every chosen cell changes every enabled lane and therefore
  changes at least one lane for every accepted nonzero mask.
- Unselected cells are bit-for-bit unchanged.
- Mutation never changes length, seed, transport, or Anchor.
- For any nonzero mask, draw magnitude and sign for all four lanes in the
  existing `KEY`, `HARM`, `ENERGY`, `MOD` order and discard disabled-lane
  results. This fixed schedule makes later masks and PRNG continuation
  independent of which nonzero subset was enabled. The all-off case is the
  intentional exception and makes no draw at all.

This exact-cardinality design uses Hamming distance on the cell-selection mask:
the cell mask distance is exactly K for each enabled lane. Lane-wise quantized
edit sizes are bounded, providing an intentionally simple musical-distance
proxy rather than claiming the full melodic-edit models of Mongeau–Sankoff or
later learned similarity work.

### Anchor, Recall, and automatic evolution

- `ANCHOR` remains the persisted panel parameter ID for compatibility; its
  visible switch labels are `RUN`/`HOLD`, defaulting to `RUN`.
- `effectiveHold = panelHold || (holdInput >= 1 V)` and is evaluated per
  sample. Only a false-to-true transition of the combined state captures; one
  source changing while the other keeps the OR high does not recapture.
- On an effective Run-to-Hold transition, immediately copy all eight cells of
  the current live pattern into the one volatile Anchor slot and mark it
  valid. Capture does not stop or reset transport.
- If Hold rises on a cell-boundary sample, capture the pre-transaction live
  pattern first. The now-high Hold blocks CV-only Seed activation and automatic
  evolution at that boundary; explicit panel Seed, Length, Mutate, and Recall
  remain allowed.
- A falling transition to Run resumes CV-only Seed and automatic eligibility
  at the next applicable boundary without clearing Anchor. The falling edge
  itself does not mutate, regenerate, or recall.
- A panel `RECALL` rising edge or Recall trigger-input rising edge is one
  logical command. It is ignored if Anchor is invalid; otherwise it queues for
  the next cell boundary. Recall copies whichever valid Anchor exists at
  commit time, so a later Hold capture before that boundary replaces the
  recalled target.
- Manual Mutate, Recall, explicit panel Seed, and Length remain operational in
  Hold. Hold suppresses only unattended Seed-CV activation and automatic
  mutation, including their chance draw.
- Automatic evolution is considered at most once per natural loop boundary.
  It requires effective Hold false, a nonzero current lane mask, no manual
  winner, and no change auto guard. Only then does it draw `bounded(100)`
  and succeed when the result is below the current integer `CHANCE` in
  `0..100`. A success snapshots nothing earlier; it uses the current boundary
  `AMOUNT` and lane mask.
- A manual Recall or Mutate command that wins a natural loop boundary
  suppresses automatic evaluation and its chance draw at that boundary.
- Recall has priority over Mutate. When both are pending, valid Recall commits
  and discards Mutate. When only Mutate is pending, it commits. Automatic is
  considered only when neither manual action wins.
- All cell-boundary commits occur before outputting the tuple of the newly
  entered cell. A Seed restart exposes cell 0; otherwise the ordinary next cell
  is exposed.

### Cell-boundary transaction and collision order

Every startup/reset entry or ordinary cell boundary executes one atomic
transaction. Its exact order is:

1. Sample same-sample Reset, Hold, Mutate, and Recall edges; if effective Hold
   rose, capture the pre-transaction live pattern.
2. Classify whether the incoming ordinary boundary was a natural loop boundary
   using the pre-boundary active length.
3. Compute the boundary's `targetSeed` from the current panel seed and exact
   routed Seed-CV sample. If the target differs and is eligible under Hold,
   regenerate base/live and PCG continuation, record both active effective
   seed and panel basis, and choose cell 0. If an explicit panel change maps to
   the already-active target, acknowledge its panel basis without restart.
4. If this was a natural loop boundary and Length is pending, commit Length.
5. Resolve at most one manual pattern action: valid Recall, otherwise queued
   nonzero-mask Mutate. Recall discards Mutate.
6. Any Seed, Length, Recall, or Mutate commit sets a change auto guard. Only if
   the incoming boundary was natural-loop, no manual action won, effective
   Hold is false, the current lane mask is nonzero, and that guard is clear may
   automatic chance be evaluated. If the guard is set at a natural loop
   boundary, skip the chance draw and clear the guard after suppressing that
   boundary.
7. Expose the final tuple for cell 0 after a Seed/startup/reset restart;
   otherwise expose the ordinarily entered cell at substep 0.

Structural Seed commits happen before `Recall > Mutate`, exactly so Recall can
restore Anchor after installing the new seed's PRNG continuation and Mutate can
operate on the new base. A natural loop remains classified from incoming
transport even if Seed then restarts it. The change guard always suppresses
automatic mutation and its chance draw on a natural boundary where Seed,
Length, Recall, or Mutate commits. A commit at a non-loop cell boundary carries
the guard to the next natural loop boundary, which is also suppressed; a
commit at a natural loop boundary consumes the guard there. In both cases the
first later eligible automatic boundary occurs only after at least one
complete traversal of the committed result. Rejected all-off Mutate and
invalid Recall commands do not set the guard because they commit nothing. At
an ordinary non-wrap cell boundary, automatic mutation is never evaluated.

An asynchronous Reset merely queues a restart; it does not clear pending
actions. Its next accepted clock runs the transaction above but is not a
natural loop boundary, so Seed/manual actions can commit and automatic cannot.

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
An eligible automatic test draws `bounded(100)` and succeeds exactly when the
result is less than `CHANCE`; ineligible Hold, manual-action, non-loop, or
all-off cases, and change-guarded loop boundaries do not make that draw.
A mutation creates indices
`[0, ..., activeLength - 1]` and performs a partial Fisher–Yates selection:
for selection position `j = 0..K-1`, swap it with
`j + bounded(activeLength - j)`; the first K indices are the shared mask.

For each selected cell, visit lanes in `KEY`, `HARM`, `ENERGY`, `MOD` order.
Draw magnitude `1 + bounded(maxDelta)` with respective maxima `4, 3, 4, 4`,
then draw the sign with `bounded(2)` (`0 = negative`, `1 = positive`). Apply
the signed delta only when that lane's mask bit is enabled; otherwise discard
both results. If saturation returns the original value, apply the
opposite-signed delta instead. All lane domains contain more than one value, so
this rule guarantees an actual quantized change in every enabled selected
lane. A zero lane mask never enters selection or lane drawing.

Golden tests must lock the seeding output, first base pattern, post-base PRNG
state, bounded-rejection behavior, selected masks, and lane deltas. This exact
contract takes precedence over alternative PCG stream/seeding conventions.

### Volatility and persistence

The live mutated pattern and Anchor are worklet-internal runtime state and are
volatile. The current architecture does not automatically patch-persist such
state. Patch state contains only declared visible controls. Therefore:

- lifecycle reset/recreation or patch load deterministically reconstructs the
  base from the effective panel-plus-Seed-CV value observed at first process;
- uncommitted manual intents, live mutations, Anchor contents, Anchor-valid
  state, change auto guard, active/preview telemetry, and mutation PRNG
  continuation are lost;
- the visible `SEED`, `LENGTH`, `AMOUNT`, `CHANCE`, `anchor`, and four lane
  toggles persist; momentary Mutate/Recall actions do not;
- this limitation must be stated in user-facing documentation/tooltips rather
  than implying scene or pattern storage.

The first call to `process()` is a required hydration transaction because the
production worklet assigns persisted params after `createDSP()`:

1. Read and sanitize persisted panel Seed, Length, Amount, Chance, Run/Hold,
   and all four lane toggles before exposing outputs or testing edges.
2. Compute the initial effective seed from the panel Seed and `seedCV[0]`
   using the exact mapping above (`0 V` for non-finite input), regenerate the
   base/live pattern, set both `ACTIVE` and `NEXT`, set the active panel basis,
   and expose cell 0/substep 0. This one hydration activation occurs even when
   Hold is restored high; it is not an unattended boundary change.
3. Establish the current high/low histories for the Mutate and Recall panel
   actions without replaying a restored high. Jack histories begin low and
   process sample 0 normally, so a routed trigger already high there is one
   rising command.
4. Evaluate effective Hold from the restored switch and `hold[0]`. If high,
   capture the hydrated pattern once as the new volatile Anchor and establish
   the combined Hold state; do not attempt automatic mutation.
5. Queue the normal transport restart. Later samples in that block obey the
   ordinary per-sample edge and boundary rules.

The routed `seedCV[0]` is authoritative at hydration. In an acyclic graph its
source processes before Refrain; a feedback-component route deliberately
supplies the graph's one-block-delayed value. `reset()` repeats this hydration
policy on the next process rather than trying to recover volatile state.

## Panel Contract

### Parameters and actions

| ID | Label | Kind | Range/default | Contract |
|---|---|---|---|---|
| `seed` | SEED | stepped knob | integer 0..65535, default 0 | Centre of the Seed-CV bank; explicit changes commit at the next cell boundary even in Hold. |
| `length` | LENGTH | stepped knob | integer 1..8, default 4 | Active cells; commits at the next natural loop boundary. |
| `amount` | AMOUNT | stepped knob | integer 1..8, default 1 | Exact unique-cell mutation count, clamped to active length. |
| `chance` | CHANCE | knob | integer 0..100%, default 20 | Automatic mutation probability per eligible natural loop boundary. |
| `mutateKey` | KEY | direct toggle | `0` off / `1` on, default on | Include KEY in future manual/automatic mutations. |
| `mutateHarm` | HARM | direct toggle | `0` off / `1` on, default on | Include HARM in future manual/automatic mutations. |
| `mutateEnergy` | ENERGY | direct toggle | `0` off / `1` on, default on | Include ENERGY in future manual/automatic mutations. |
| `mutateMod` | MOD | direct toggle | `0` off / `1` on, default on | Include MOD in future manual/automatic mutations. |
| `mutate` | MUTATE | momentary button/action | default released | Snapshot Amount/mask and queue/replace an intent for the next cell boundary. |
| `anchor` | RUN / HOLD | two-position switch | `0` Run / `1` Hold, default Run | Entering effective Hold captures Anchor and blocks CV-only Seed/auto; transport and explicit actions continue. |
| `recall` | RECALL | momentary button/action | default released | Queue Anchor restore for the next cell boundary; ignored if invalid. |

`MUTATE` and `RECALL` are rising-edge commands and are not semantically
persistent even if represented through numeric params at the worklet boundary.
`anchor` and the four lane toggles are patch-persisted; only their positions
persist, not captured Anchor contents or a pending manual command.

### Inputs

| Port | Label | Signal | Voltage/normal | Contract |
|---|---|---|---|---|
| `clock` | CLOCK | clock | threshold `>2.5 V`, normal 0 V | Rising crossing advances one substep. |
| `reset` | RESET | trigger | threshold `>=1 V`, normal 0 V | Rising crossing resets transport only. |
| `seedCV` | SEED CV | cv | -5..+5 V, normal 0 V | Additive 12-seeds/V target offset; sampled authoritatively at cell boundaries. |
| `mutateTrig` | MUTATE | trigger | 0..10 V, threshold `>=1 V`, normal 0 V | Rising edge ORs with the panel Mutate action. |
| `recallTrig` | RECALL | trigger | 0..10 V, threshold `>=1 V`, normal 0 V | Rising edge ORs with the panel Recall action. |
| `hold` | HOLD | gate | 0..10 V, high `>=1 V`, normal 0 V | Level ORs with the panel Hold switch. |

There is no normalled clock and no arbitrary CV-recording or per-lane data
input.

### Outputs

| Port | Label | Signal | Voltage | Resolution/meaning |
|---|---|---|---|---|
| `key` | KEY | CV | -1..+1 V | 1/12 V; semitone-quantized tonal offset. |
| `harm` | HARM | CV | 0..+5 V | 0.25 V; normalized absolute selector target; set Changes/Arp destination knob to 0. |
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
| `seedPending` | `0` when `NEXT == ACTIVE`; `1` when a target is eligible at the next cell boundary; `0.5` when a CV-only target is blocked by Hold. |
| `mutation` | 50 ms visual hold when manual or automatic mutation commits. |

### Custom display and telemetry

V2 requires a compact custom renderer and a 12 HP panel. It must retain the
existing controls, cell/substep LEDs, and jacks; add four always-visible lane
toggles and the four new inputs; and show two five-digit numeric fields:

- `ACTIVE`: committed effective seed `0..65535`, meaning base/PRNG identity.
- `NEXT`: latest target seed `0..65535`; render an em dash when it equals
  `ACTIVE`, and visually mark whether a differing target is armed or held.

The module declares only bounded scalar worklet telemetry:

```javascript
telemetry: {
    fields: ['activeSeed', 'nextSeed', 'seedPendingState'],
    methods: []
}
```

`seedPendingState` is integer `0 = equal`, `1 = eligible`, `2 = blocked by
Hold`; the renderer maps it to text/style without retaining history. All
controls, including lane toggles and buttons, must call `onParamChange`.
Direct mutation of the stable main-thread mirror does not control audio.

## DSP Model and Trade-offs

The DSP is an inspired-by utility adaptation, not a circuit or firmware
emulation. Its state consists of fixed-size typed arrays for the base, live,
candidate, and Anchor patterns; transport counters; edge-detector history; a
PCG32 state; active/panel/preview seed scalars; a pending Amount/mask snapshot;
and bounded LED/telemetry values. `process()` performs no allocation.

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
1 V/octave convention. Drawing then discarding disabled-lane deltas costs a
small fixed amount of work but preserves deterministic continuation across
nonzero masks. Regenerating at a cell boundary is bounded to eight tuples.

The Seed-CV map is a utility adaptation rather than a claim about any cited
hardware. Twelve seeds per volt makes the common `1/12 V` semitone interval a
single deterministic choice and keeps a ±60-seed performance neighborhood.
Boundary sampling prevents mid-cell discontinuities; the trade-off is that a
target visible in `NEXT` can move before the boundary that would activate it.

## Assumptions, Contradictions, and Source Weighting

- Manufacturer manuals and firmware/source repositories win for documented
  behavior of comparison products; product pages are used for high-level
  intent; retailer copy and demos are context only.
- Comparable products disagree on whether lock/freeze prevents manual change.
  Refrain defines Hold narrowly: it suppresses unattended Seed-CV activation
  and automatic evolution but permits panel Seed, Length, Mutate, and Recall,
  because an audition lock should not disable an intentional command.
  Returning to Run resumes eligibility without destroying the Recall target.
- Comparable products use both immediate and quantized randomization. Refrain
  uses cell-boundary commits for playable manual and Seed response, but retains
  natural-loop quantization for Length and automatic evolution. Anchor capture
  remains immediate so the performer captures exactly what is sounding.
- Hardware random modules frequently describe musical randomness without
  promising cross-restart bit identity. Refrain explicitly guarantees base
  reconstruction from seed and tests the PRNG.
- No cited product specifies `round(clamp(CV,-5,5)*12)` for a 16-bit seed. It
  is a local musical mapping selected after rejecting a noise-sensitive
  full-domain scan. ECMAScript `Math.round` resolves half-step ties exactly.
- The change auto guard is a local performance rule: Seed, Length, Mutate, or
  Recall commits suppress the relevant natural-loop chance draw so every
  deliberate result is heard for at least one complete traversal before
  automatic mutation can replace it.
- `HARM`, `ENERGY`, and `MOD` voltage semantics are local integration
  contracts, not claims about a source product. Destination controls may sum
  knob and CV, hence the explicit zero-knob instruction for absolute `HARM`.
- The 0.25 V macro grid, mutation delta sizes, default chance, and eight-cell
  allocation are product-design assumptions selected for audible,
  testable boundedness.
- The custom software panel uses 12 HP and `module-color-ten`; these are local
  presentation choices, not claims about comparison hardware. Twelve HP is the
  minimum accepted v2 layout because numeric seed identity, four lane toggles,
  and four added inputs must remain simultaneously legible.
- Runtime patterns are not patch state. Adding persisted structured pattern
  state would change scope toward a scene/pattern manager and is explicitly
  deferred.

## Test Targets

1. **Schema/defaults:** 12 HP metadata, existing IDs retained, four new params,
   four new fixed input buffers, output buffers, LED fields, and bounded
   telemetry exactly match the panel contract; all lane toggles default on.
2. **First-process hydration:** params assigned after `createDSP()` and
   `seedCV[0]` determine the first audible cell and PCG continuation before
   Anchor capture; restored Hold captures that hydrated pattern; restored high
   panel actions do not replay; a high jack at sample 0 is accepted once.
3. **Determinism:** existing PCG32 vectors, base goldens, post-base state, and
   bounded rejection remain exact; no `Math.random` or block/sample-rate
   dependence is introduced.
4. **Buffer integrity:** every output fills every sample at supported block
   sizes; all values remain finite; no input/output array is replaced and
   `process()` allocates no collection.
5. **Voltage/quantization:** `KEY` remains -1..+1 V on 1/12 V steps, `HARM`
   0..5 V on 0.25 V steps, and `ENERGY`/`MOD` -5..+5 V on 0.25 V steps.
6. **Seed-CV map:** test 0 V, ±1/12 V, ±5 V, clamp beyond rails, non-finite
   fallback, negative/positive half-step ties, and modulo wrap around panel
   seeds 0 and 65535. All 121 offsets map exactly by the normative formula.
7. **Seed boundary sampling:** a target change before a cell boundary commits
   there; one just after waits; the exact clock sample wins over neighboring
   samples. A commit regenerates all eight cells and restarts at cell 0 before
   output; an unchanged target does neither.
8. **Panel versus CV intent:** a panel-seed change commits in Run or Hold; a
   CV-only change commits in Run but remains blocked in Hold; a panel change
   that maps back to `ACTIVE` only updates the panel basis. Repeated targets
   always use the latest boundary sample.
9. **Seed audition transport:** changing target at consecutive cell boundaries
   repeatedly exposes a complete 16-clock cell-0 phrase; holding it allows
   cell 1 onward; Seed changes do not overwrite Anchor.
10. **Clock and Reset:** thresholds and held-high behavior remain exact; first
    clock establishes 0/0; asynchronous Reset preserves outputs until the next
    clock; reset+clock runs a restart boundary and ends at 0/0 without becoming
    an automatic-evolution boundary.
11. **Length:** values clamp/step 1..8 and commit only on an old-length natural
    wrap; Seed restarts can postpone that wrap; newly exposed cells already
    contain current live/base data.
12. **Trigger inputs:** each Mutate/Recall jack ignores `<1 V`, accepts a
    low-to-`>=1 V` edge, does not repeat while held, and accepts a new edge
    after low. Panel and jack sources OR to one logical command.
13. **Trigger/boundary collision:** an input edge on the exact boundary sample
    participates; one later waits. Button edges are ordered from process
    sample 0 as specified.
14. **Manual latency:** valid Mutate and Recall are inaudible before the next
    cell boundary, commit before the entered tuple, and never wait for a full
    loop. Startup/reset cell entries also accept them.
15. **Mutate snapshot:** Amount and lane mask are captured at the command edge;
    later control changes do not affect that intent; repeated valid commands
    retain only the latest snapshot.
16. **All-off no-op:** a zero-mask command clears older pending Mutate but not
    Recall, creates no indication, changes no pattern, and leaves PCG state
    bit-identical. Automatic evolution with current zero mask makes no chance
    draw and leaves state unchanged at chance 100.
17. **Selective exact-K:** for all 15 nonzero masks and every Length/Amount
    pair, exactly `min(amount,length)` unique active cells are selected; every
    enabled selected lane changes within its delta/domain; disabled lanes,
    unselected cells, and inactive cells are bit-identical.
18. **PRNG mask invariance:** all nonzero masks consume the same mask and
    four-lane magnitude/sign schedule; subsequent mutation masks and PCG state
    agree when only the nonzero lane selection differs.
19. **Rail behavior:** each enabled lane changes even at every minimum/maximum
    rail without leaving its integer or voltage domain.
20. **Effective Hold truth table:** panel and gate OR correctly; each combined
    false-to-true transition captures once; toggling one source while the other
    remains high does not recapture; returning Run retains Anchor.
21. **Hold collision/scope:** same-sample Hold rising captures pre-transaction
    live data and blocks CV-only Seed/auto, while panel Seed, Length, manual
    Mutate/Recall, transport, and outputs remain live. Hold blocks automatic
    chance draws, not just pattern commits.
22. **Recall:** invalid Recall is not queued; valid Recall restores all eight
    cells/all four lanes regardless of current mask; a newer Anchor capture
    before commit is the recalled value.
23. **Transaction priority:** Seed regeneration precedes Length and
    `Recall > Mutate`; Recall discards Mutate; either manual winner suppresses
    same-boundary auto. Any Seed, Length, valid Recall, or nonzero-mask Mutate
    commit at a natural wrap suppresses that draw; any such commit at a
    non-wrap carries suppression through the next natural wrap. In both cases
    PCG state proves no chance draw occurred and auto first becomes eligible
    only after a full traversal. Invalid Recall and all-off Mutate set no guard.
24. **Automatic evolution:** chance 0 never mutates; chance 100 mutates exactly
    once per eligible Run natural loop; no valid retained Anchor alone blocks
    auto; Release from Hold does not mutate until a later natural boundary.
25. **Feedback/LEDs:** `ACTIVE`, `NEXT`, pending state, `seedPending`, manual
    pending, Anchor, mutation hold, cell one-hot, and substep values transition
    exactly and stay bounded. `NEXT` follows latest processed target; equal
    renders as an em dash; a Held target is visibly distinct.
26. **HARM integration:** with Changes/Arp destination knob at zero, every
    Refrain HARM step selects its normalized target; nonzero destination knobs
    demonstrably add according to each destination contract, preventing any
    false claim of universal absolute behavior.
27. **Lifecycle:** `reset()`/patch recreation deterministically hydrates the
    effective base and clears volatile live/Anchor/pending/PRNG continuation;
    RESET input changes transport only; persisted lane toggles and Run/Hold
    restore while actions remain transient.
28. **Renderer/worklet integration:** custom controls use `onParamChange`;
    scalar telemetry survives audio start/stop and contains no history or
    unbounded value; routed jack input, action release, patch replacement,
    light/dark themes, and 12 HP layout receive browser coverage.

## Implementation Plan

- **Module/category:** `refrain`, `sequencer`.
- **Research branch/worktree:** `research/refrain-v2` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/refrain-v2-research`.
- **Implementation branch/worktree:** create `module/refrain-v2` in a separate
  coordinator-selected worktree after this research commit is accepted.
- **DSP model:** deterministic inspired-by phrase-form sequencer using fixed
  arrays, existing PCG32 goldens, 16-clock cells, cell/natural-loop boundary
  transactions, one volatile Anchor, a shared exact-K cell mask, four-bit lane
  mask, active/preview seeds, and a change auto guard.
- **Params/actions:** `seed`, `length`, `amount`, `chance`; momentary `mutate`
  and `recall`; two-position Run/Hold `anchor`; persisted `mutateKey`,
  `mutateHarm`, `mutateEnergy`, and `mutateMod`.
- **Inputs:** retain `clock`, `reset`; add `seedCV`, `mutateTrig`,
  `recallTrig`, and level gate `hold` with the exact voltage contracts above.
- **Outputs:** `key`, `harm`, `energy`, `mod`.
- **LEDs/telemetry:** retain `cell1`..`cell8`, `substep`, `anchor`, `pending`,
  and `mutation`; add `seedPending`; declare scalar fields `activeSeed`,
  `nextSeed`, and `seedPendingState`.
- **UI:** replace the declarative panel with a module-local compact custom
  renderer at 12 HP. Keep all state visible without a menu; use
  `onParamChange`; label `ACTIVE` as base identity, mark Held `NEXT`, and state
  the destination-knob-zero and volatile-Anchor limitations.
- **Tests before implementation:** revise `tests/dsp/refrain.test.js` first,
  preserving all v1 PCG/base/phase goldens and adding the 28 target groups
  above. Add focused custom-renderer coverage in `tests/ui/renderer.test.js`
  or a dedicated Refrain UI test before changing DSP.
- **Implementation sequence:** add stable input arrays/edge state; refactor
  processing around named boundary helpers; implement first-process hydration,
  Seed target classification, change auto guard, manual snapshot queues,
  lane-aware fixed-draw mutation, scalar telemetry, then the renderer.
- **Factory patch:** update `test-refrain` to declare new persisted defaults and
  demonstrate at least Seed CV or a trigger/Hold route while retaining `HARM`
  to Changes/Arp with its destination knob at zero.
- **Documentation:** update the README module row/help copy after behavior is
  implemented. No manifest/core-definition registration or graph-revision bump
  is required because the existing core module ID/order does not change.
- **Shared framework changes:** none planned. Keep existing replacing patch-load
  behavior and volatile runtime policy; do not add persisted pattern/scene
  infrastructure or unbounded telemetry.
- **Focused tests:**
  `npm test -- tests/dsp/refrain.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- **UI tests:**
  `npm test -- tests/ui/renderer.test.js`
- **RackHost/worklet validation:**
  `npm test -- tests/app/rack-host.test.js tests/audio/worklet-engine.test.js tests/audio/worklet-processor.test.js`
- **Factory-patch validation:**
  `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- **DSP audit:**
  `npm run audit:dsp -- --module refrain --matrix --strict-voltage`
- **Full validation:** `npm test`
- **Known assumptions:** 12 seeds/V, 12 HP, quarter-volt macro grid, delta
  ranges, cell-boundary manual timing, change auto guard, and volatile
  runtime state are normative local decisions described above.

## Gate Decision

**Decision: implemented and validated.** The linked source register, panel and
voltage contract, Seed-CV map, first-process hydration, Hold scope, boundary
collision order, selective-mutation/PRNG rules, HARM integration, telemetry
bounds, persistence model, test targets, and implementation plan are closed
and implemented for v2. The queue owner must update queue status separately;
this implementation branch does not edit `research/module-queue.md`.

## DSP Audit (2026-07-31)

The v2 implementation passes
`npm run audit:dsp -- --module refrain --matrix --strict-voltage` at 44.1, 48,
and 96 kHz with block sizes 128 and 512. All 21 scenarios in each of the six
configurations complete without errors, produce finite outputs, retain stable
input/output buffers, and report zero voltage-contract flags. The largest
observed output magnitude is 4.25 V. Diagnostic Node timing ranges from 28.4
to 208.3 microseconds per block; these measurements are advisory and are not
AudioWorklet deadline thresholds.

Focused coverage preserves the v1 PCG32 vectors, base goldens, and transport
phase while verifying the Seed-CV map across all 121 semitone offsets,
first-process/reset hydration, cell-boundary transactions, exact trigger
collisions, combined panel/gate Hold behavior, Recall precedence, selective
exact-K mutation for all 15 nonzero lane masks, fixed-draw PRNG invariance, the
full-traversal automatic-evolution guard, scalar telemetry, and the 12 HP
custom renderer. Factory-patch and Chromium AudioWorklet tests exercise routed
Seed CV, custom controls, action release, patch replacement, both themes, and
worklet telemetry. The implementation adds no manifest/core-definition entry
and requires no graph-revision change because Refrain retains its existing
core module identity and order. The full Vitest suite passes all 2,140 tests
across 112 files, and the focused Chromium AudioWorklet suite passes all eight
tests.

## Post-implementation usability follow-up (2026-07-31)

Listening and interaction review found two presentation issues and one factory-
patch issue; none required changing the Refrain DSP contract.

- Mutation-lane buttons now state `ON` or `OFF` in their title and identify the
  inverse click action. Mutate explains that Amount selects how many cells
  change and the lane buttons select which outputs change. Recall explains
  that it restores the volatile Anchor captured by entering Hold.
- The ACTIVE/NEXT seed readout is status, not a control. Its pending state is
  labelled `PEND`, has state-specific help text, and consumes mouse-down so it
  cannot accidentally start rack-module dragging.
- The original Test-Refrain patch continuously scanned Seed CV with an LFO.
  This could install a new seed at successive cell boundaries, repeatedly
  restart at cell 0, and prevent Amount/Chance evolution from completing a
  phrase. It also set Cascade Fill to 8, so Refrain's -5 V ENERGY extreme
  produced effective Fill 0, while the bass used sparse lane 1.
- The revised patch clocks a half-amplitude RND source every 128 master clocks,
  holding each candidate for two complete four-cell loops. Cascade Fill 12
  maps the full ENERGY range to Fill 4..16; lead lane 4 therefore has at least
  four hits and bass lane 2 at least two hits in every 16-step mask. This
  retains audible density modulation without silent seed regions and leaves
  an intervening loop in which Amount/Chance mutation can be heard.

## Historical V1 DSP Audit (2026-07-31)

Before this v2 specification, the implemented v1 module passed
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

This historical audit predates the v2 Seed CV, trigger/gate inputs, lane mask,
custom display, cell-boundary actions, and change auto guard documented in the
current audit above.
