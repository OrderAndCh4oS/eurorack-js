# Beatbox Pro — extended physical mouth percussion

> Parked by the user after audition, 17 November 2026. See the [archive decision](../topics/vocal-beatbox-parked.md). Historical implementation notes follow.

Status: implemented and technically validated; useful audible control range remains unresolved after user audition, 2026-11-17. User explicitly requests a second shipping
beatbox module. This is a percussion instrument alongside VOCAL, not a voice
mode or a combined vocal/percussion sequencer.

## Panel contract

`beatbox-pro`, BEATBOX PRO, 28 HP, voice category, module-color-eight.
The same eight BEATBOX knobs, Hit and Clamp/Wrap switch, plus eight controls:
Noise 0..2 (1), Nasal 0..1 (0), Lips -1..1 (0), Tongue -1..1 (0),
Throat 0..1 (0), Hum Voice 0..1 (1), Hum Tension 0..1 (.5), Hum Fry 0..1 (0).
16 knobs in a 4x4 grid; clear physical-control labels and live sound display.
Trigger/output LEDs. No menus or hidden control banks.

## Voltage contract

Inherit the compact module's eight inputs, all zero-normalled. Add Noise CV
+/-5 V (.4/V), Nasal CV +/-5 V (.2/V), Lips and Tongue CV +/-5 V (.2/V),
Throat CV +/-5 V (.2/V), Voice/Tension/Fry CV +/-5 V (.2/V). Sum with knobs,
clamp to corresponding knob range. Choke input 0..10 V, >=1 V mutes over
5 ms and inhibits hits while held; Choke wins over simultaneous Trig/Hit.
Outputs: Out +/-5 V, Env 0..5 V (post-level peak follower, 20 ms release),
Active gate 0/10 V (scheduled gesture lifetime; independent of Level).

## DSP plan

Same single physical engine and bandlimited Tune as BEATBOX; independent state
per instance. Native noise control scales existing pressure-dependent sources
(no additional white-noise layer). Lips offsets aperture and protrusion;
Tongue offsets body and tip positions within documented bounds; Nasal opens
velopharyngeal coupling without cancelling Hum's calibrated nasal route;
Throat narrows epilarynx. These modify the score's original targets and live
baseline without accumulating offsets. They use existing articulator dynamics.
The canonical retimed score is stored once per hit and subsequent changes
rebuild at most 16 gestures into reserved storage. Geometry parameters always
return to defaults when modulation is removed. Tension/Fry/Voice chiefly
shape Hum, so the panel names that limitation explicitly.

Defaults reproduce compact BEATBOX. No feedback/polyphony or extra exciter
inside the panel. External mixers, VCAs, envelopes, sequencers and modulation
remain the musical control system. Pitch ratio doubles worst-case physical
rendering work; practical multi-instance capacity requires measured profiling.
Aggressive lips/tongue/nasal settings can weaken a closure and intentionally
turn a burst into a leak or hiss. Controls do not promise uniform loudness.

## Implementation Plan

- Module `beatbox-pro`, voice, existing authorized checkout.
- Framework scope: add supported 28 HP width to registry validation and base
  panel CSS; existing row occupancy already uses numeric HP.
- Register adjacent to `beatbox`; regenerate static aliases/fingerprint and
  update docs/counts. Shared native/kernel/rendering extension is planned.
- All params/inputs/outputs/LEDs above; finite telemetry only.
- Tests first: parity with compact defaults, every control and CV; physical
  audible change, non-accumulating modifiers, independent instances; positive
  and negative sound wrapping; per-hit capture; Choke priority and fade;
  Env/Active ranges; reset; finite extremes; timing/sample-rate/block-size matrix.
- Original factory demo withdrawn after user audition. Keep an internal browser
  fixture for Wrap, routing, audio, Choke and lifecycle regression coverage.
- Focused/full validation and provenance workflow: compact upgrade plan.
- All source/electrical choices are app adaptations. No training or hardware
  emulation claim. Subjective audition follows automated signal checks.

## Sources and evidence

Primary source is the already-vendored CHIMERA engine, Jameson Hodge and
contributors, pinned 2026-11-16 commit
`24bd2e4ee4accf7b27d57d8bf912472880dff9f7`. Source reviewed locally 2026-11-17;
GitHub web fetches returned cache misses on recheck. Original/vendored hashes
and modifications remain checked by `wasm/airway/source-lock.json`.

- [Phoneme inventory](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/inventory.rs): calibrated consonant targets, dominant articulators, nasal/voicing flags.
- [Speech planner](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/planner.rs): overlapping vowels/consonants, breath and glottal opening gestures.
- [Human voice](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/voice/human_voice.rs): physical state, source parameters, source/tract control updates.
- [Beatbox recipes](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/beatbox.rs): ten percussion gestures and their physical mechanisms.
- [Articulators](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/control/articulators.rs): bounded target motion and tongue-tip policy.
- [MIT license](https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/LICENSE): redistribution with retained notice.
- Proctor et al., JASA 133 (2013), [Paralinguistic mechanisms of production in human beatboxing](https://pmc.ncbi.nlm.nih.gov/articles/PMC3574116/): physical closure, release and airstream context.

Prior provenance, engineering comparisons, onset and CPU measurements are in
[the original Airway research](../topics/airway-prototype.md). User listening feedback on the original
Mouth Music patch was "disjointed clips". The source confirms each prepared hit
replaced the entire model state. Removing automatic hits made the vocal patch
continuous but lost consonants. These two modules separate those workflows.
No new subjective listening judgment is inferred from numerical validation.
No hardware panel/electrical spec exists: mappings below are app adaptations.


See [compact upgrade plan](beatbox.md#two-tier-upgrade--2026-11-17) for shared DSP trade-offs and added primary resampling references.


## DSP Audit (2026-11-17)

The generic strict voltage matrix passes 36 scenarios in each of six sample-rate
and block-size configurations (216 total), with finite output, stable buffers
and no voltage violations. Its synchronized Gate/Trig stimuli assert Choke at
every hit, so that matrix intentionally exercises a muted voice. Separate
focused tests render audible Hum with Choke released at 44.1/48/96 kHz and
128/512 frames, checking nonzero Out/Env/Active and their voltage bounds.

Focused tests also cover every physical knob and CV, compact/default parity,
Tune on all sounds, Choke priority/fade/rearming, reset and stable state. Native
tests and the allocation counter verify canonical score restoration and no
allocations during timing/physical updates. The real AudioWorklet browser test
checks all 16 knobs, 17 inputs and three outputs, panel bounds, Wrap persistence,
nonzero audio and Choke connection/disconnection. See the sound engineering
review for measured CPU cost and listening limitations.


Final validation: 160 test files passed, one skipped; 2,994 tests passed,
nine skipped. Production build and the real-browser AudioWorklet test pass.
The compact example remains in the catalogue. Pro uses an internal browser fixture. Changes are local;
maintainer review and deployment remain separate from this implementation.


## Audition feedback and demo withdrawal (2026-11-17)

User feedback: "ditch pro patch most knobs have little effect". Removed the
Physical Motion composition, snapshot URL, Test catalogue entry and preview.
The module remains available because this request names the patch. No new DSP
or wider control ranges are inferred from the removal request.

The existing knob tests assert different sample buffers and bounded output;
they do not measure perceptual salience. Hum Voice/Tension/Fry primarily affect
Hum. Lips/Tongue alter targets present in each recipe and the neutral baseline,
so their effect varies with the prepared gesture and its brief duration. A
future sound-design pass must establish useful audible ranges through isolated
per-sound A/B audition before presenting another Pro showcase. Browser safety
and lifecycle coverage remains in tests/e2e/fixtures/beatbox-pro.js.
