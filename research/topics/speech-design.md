# Speech module research and proposed design

Status: design adopted for implementation, 2026-11-17. The current contract and
validation status are in [Speech](../modules/speech.md).

SPEECH should turn a short piece of English text into a playable phrase. A trigger
starts the whole text; Pitch and Rate remain controllable during speech. This
matches the requested workflow and keeps it distinct from VOCAL's selectable
phonemes and the two BEATBOX modules. External modules supply rhythm, repetition,
mixing, and effects.

The strongest design references are Polaxis Emy with Nexus for text entry and
voice control, the E950 for trigger behavior, and Plaits for separating pitch
from vocal character. CHIMERA supplies a plausible synthesis foundation, but
intelligibility and performance need a speech prototype before the panel is frozen.

## Comparable instruments and practical use

These are documented workflows. The implications column contains our design
judgment, rather than claims made by the manufacturers.

| Reference | Documented workflow | Implication for SPEECH |
|---|---|---|
| [Polaxis Emy with Nexus][s1] | Enter text or select a line from a text file; trigger speech. Separate speed, formant, and expression controls; punctuation shapes sentence endings. AUX indicates speech activity. | The closest functional reference. Keep content editing separate from performance controls, and expose phrase activity to the patch. |
| [Synthesis Technology E950][s2] | Gate/SYNC speaks an indexed ROM word or phrase. A sequencer supplies index CV and trigger; another trigger can restart a word to stutter it. DIGITAL is high while speaking. | Make interruption behavior explicit and useful. A Busy output lets other modules follow speech timing. It is a word bank, not arbitrary text input. |
| [E951 expander][s3] | Displays the selected word and loops approximately 40 or 160 ms of LPC data. These are synthesis-data loops, not recorded audio loops. | Position feedback and fragment performance have value, but fragment looping is a separate extension to whole-text playback. |
| [Mutable Instruments Plaits][s4] | Its speech model combines vowel algorithms and LPC word banks. MORPH scans words/segments; triggering can speak a word, with intonation and speed controls. TIMBRE changes vocal character independently of pitch. | Pitch, articulation timing, and vocal character should remain separate. Alphabet buttons alone do not constitute a text frontend. |
| [docB SpeakerPro for VCV Rack][s5] | Text becomes phonemes, editable prosody, then generated audio. The performance section plays samples with trigger, bank selection, and EOC; V/Oct changes playback speed. | Preparation and playback need clear states. Pronunciation correction is useful. Its sample playback behavior should not define our independent live Pitch/Rate controls. |

[Voxglitch Robot Speech][s6] is an adjacent browser authoring tool: it exposes SAM
pitch, speed, mouth, and throat controls and exports one WAV per script line. It
supports keeping voice shaping distinct from text, but is not evidence of a
Eurorack CV contract.

Nexus's current product page explicitly documents live controls and qualifies
Pitch CV by mode. Do not generalize one Polaxis engine or firmware's behavior to
the whole product family. Likewise, Plaits' attenuverter functions depend on
patching and model state. Our panel should label each function directly. [s7, s4]

## Recommended first panel

Proposed ID `speech`, category `voice`, color `module-color-six`. Start layout
work at 24 HP; readability of the text editor decides the final width.

| Control | Proposed behavior |
|---|---|
| Text editor | One text passage, including punctuation and newlines. A trigger reads the whole passage. English first. |
| Apply | Prepare an edited passage in the background. Keep the last ready version available until preparation succeeds. |
| Speak | Momentary action identical to a trigger input; uses the prepared text. |
| Stop | Release the voice and reset phrase position. |
| Pitch | -24 to +24 semitones, default 0, relative to 110 Hz before the phrase's pitch contour. Show the corresponding base frequency. |
| Rate | 0.5x to 2x, default 1x. Scale articulation time while preserving pitch. |
| Contour | 0 to 2, default 1. Zero flattens the planned pitch inflection, one retains it, two exaggerates it in semitone space. |
| Breath | 0 to 1, default 0.15. Adjust source breathiness while preserving the planned voiced/unvoiced consonants. |
| Level | 0 to 1, default 0.8. Smoothed final gain. |
| Tract | Male/Female calibrated anatomy; latch the selection at phrase start. Pitch remains independent. A female audition patch sets Pitch to +12 explicitly. |
| Retrigger | FINISH / RESTART, default FINISH. This only determines interruption of an active phrase. |

Use the existing shared knob, jack, and button styles. Show the prepared text,
whether there are unapplied edits, preparation/error status, and the active word
or progress. A lit Busy indicator must reflect actual transport state, not merely
nonzero waveform amplitude. Punctuation pauses are still part of the phrase.

The five knobs have distinct jobs. Additional throat/formant, tension, or
articulation controls should earn panel space through listening tests; the
existing two calibrated tract models do not establish a safe continuous tract
size control. Avoid a large panel of controls whose effects disappear under the
speech gestures.

## Trigger and editing behavior

1. A rising trigger starts the most recently prepared passage from its beginning.
   A sustained high input produces one start. Gate length does not truncate speech.
2. FINISH ignores new triggers while Busy, without queuing them. This preserves
   intelligibility when a clock runs faster than the phrase.
3. RESTART accepts each new edge and begins again with a short click-free
   transition. Repeated short triggers deliberately create stuttering fragments.
4. Stop wins over a simultaneous trigger. Stopping or restarting does not emit
   End for the interrupted phrase. There is no automatic resume.
5. Busy stays high through internal pauses and the terminal release. End pulses
   exactly once after natural completion. A trigger arriving at the completion
   sample may start the next phrase without suppressing that completion pulse.
6. Applying text while speaking never replaces the active passage mid-word.
   A successfully prepared revision becomes available for the next accepted
   trigger. Late results from superseded edits are discarded.
7. Before any passage is ready, triggers do nothing and the panel explains the
   preparation state. No delayed trigger is saved for later playback.
8. Invalid edits retain the last ready passage and display the error. Intentionally
   applying empty text clears the ready passage; triggering it is silent and
   produces neither Busy nor End.

Text and Tract are captured at an accepted trigger. Pitch, Rate, Contour, Breath,
and Level remain live. The displayed text and progress must refer to the active
revision while it plays, even if a different revision is ready for next time.

## Voltage and timing proposal

All values below are app design choices. Hardware thresholds and scaling are
reference evidence, not values to copy into this emulator.

| Port | Signal and range | Meaning |
|---|---|---|
| `trig` | Trigger, 0–10 V, normal 0 V | Rising crossing of 1 V requests Speak; below 1 V rearms. |
| `stop` | Trigger, 0–10 V, normal 0 V | Rising crossing of 1 V requests Stop. |
| `vOct` | CV, -5–5 V, normal 0 V | 1 V/octave added to Pitch, continuously. |
| `rateCV` | CV, -5–5 V, normal 0 V | `clamp(rate * 2^(V/5), 0.5, 2)`. +5 V doubles rate; -5 V halves it, within bounds. |
| `contourCV` | CV, -5–5 V, normal 0 V | `clamp(contour + V/5, 0, 2)`. |
| `breathCV` | CV, -5–5 V, normal 0 V | `clamp(breath + V/5, 0, 1)`. |
| `out` | Audio, -5–5 V | Mono physical-model speech. Only OUT makes it audible. |
| `busy` | Gate, 0/10 V | High from an accepted start through phrase completion/release. |
| `end` | Trigger, 10 V for 10 ms | Natural completion only. |

For a normalized planned contour `c(t)` in octaves, voiced fundamental is
`clamp(110 * 2^(pitch/12 + vOct + contour*c(t)), 40, 1100)` Hz. Flattening Contour
does not voice normally unvoiced consonants. Rate advances the speech timeline;
it must not change the audio sample clock or resample the output.

Use sample-exact edge detection and bounded, smoothed controls. The initial
control update target is the existing absolute 64-sample grid; this is not a
claim of audio-rate articulation. A prototype must establish the final release
duration and restart bridge, then fix them in the module specification. End must
account for all final gestures and the release, not a guessed duration from text
length or an audio-amplitude threshold.

## Patches that exercise the design

| Use | Patch | Behavior to demonstrate |
|---|---|---|
| Complete spoken hook | Clock divider → Trig, FINISH; Out → mixer → OUT | A passage repeats on accepted clock edges without accidental word chopping. |
| Rhythmic stutter | Burst or sequencer gates → Trig, RESTART | Trigger spacing controls how much of the phrase is heard. |
| Pitched chant | Quantized sequence → V/Oct; Contour at 0; slow clock → Trig | Pitch follows the patch while consonants and phrase timing remain intact. This is not yet lyric-to-note alignment. |
| Call and response | First SPEECH End → second SPEECH Trig | The second voice starts after the first completes, including when Rate changes. |
| Repeat with a gap | End → gate delay → Trig; press Speak once | External timing determines the gap. Feedback routing includes the engine's documented block delays. |
| Voice in motion | Attenuated LFO → Rate or Contour | Changes are audible during the same phrase; modulation does not wait for the next trigger. |

Phrase banks with Phrase CV are the most promising later addition: both E950 and
Nexus support content selection as a performance gesture. For the first version,
one text passage makes the requested whole-text trigger behavior unambiguous.
Word stepping, scrubbing, vowel freeze, fragment looping, and lyric/note alignment
need their own timing contracts and should follow a successful phrase prototype.

## CHIMERA feasibility and constraints

The pinned CHIMERA source already contains `EnglishG2P`, dictionary loading,
letter-to-sound fallback, stress/allophone handling, punctuation, and a planner
that generates overlapping articulatory gestures. `PlanOptions` separates rate,
base pitch, intonation, and body. This path requires no model training. It does
require integration beyond our current 32-button phoneme API. [s8, s9]

Keep adjacent gestures overlapping through their transitions. Turning each
letter into an isolated VOCAL hit would discard pronunciation, diphthongs,
coarticulation, and much of the timing that makes speech understandable.

The current audio adapter deliberately limits its gesture score to **64 entries**
for bounded percussion recipes. Excess entries are dropped. Loading an entire
sentence into that score without redesign would silently lose speech. The
English frontend and planner also allocate, so they cannot run in `process()`.
[s10]

Recommended architecture: prepare pronunciation and immutable phrase data in a
Worker, then render the physical voice in the AudioWorklet. Compare a bounded
rolling gesture window with precomputed control trajectories before choosing the
transport. Preserve overlap, ramp weights, pressure, and source controls in either
case. No per-trigger dictionary parsing, network request, unbounded event queue,
or WASM memory growth belongs on the audio thread.

The pinned repository supplies `cmudict.txt.gz` and its CMU notice. Preserve that
notice and checksum the dictionary when packaging it. English fallback is useful
for unknown words, but fixed homograph choices and names can mispronounce; provide
clear edited-text audition first and consider a pronunciation override editor
later. Do not claim multilingual support from the existence of other frontends.
[s8, s11]

Provisional preparation limits are 240 text characters and 20 seconds of planned
speech at 1x; reject excess with a clear explanation instead of truncating. At
0.5x that permits approximately 40 seconds plus release. Measure plan sizes and
CPU before finalizing these limits. Persist applied text, draft text if retained,
and controls; do not serialize WASM memory. Derived plans need versioning, bounded
validation, and a defined preparation lifecycle on patch restore. The exact
Worker-to-worklet transfer path remains an implementation decision.

## Prototype acceptance before implementation is finalized

Start with a small end-to-end speech experiment, then freeze the module contract
in `research/modules/speech.md` immediately before registration and implementation.
This topic document does not mark a queued module spec-ready.

- Listen to short sentences containing stops, fricatives, diphthongs, weak words,
  questions, numbers, names, and repeated words. Judge both tract models. The
  acceptance goal is understandable continuous speech at normal settings; the
  existing vowel and beatbox tests do not establish this.
- Confirm Rate changes duration independently of pitch and Pitch changes voiced
  fundamental independently of duration. Compare 0.5x/1x/2x and octave offsets;
  account separately for the fixed release. Test live changes inside a phrase.
- Audition Contour and Breath at low, middle, and high settings. Retain them only
  if their effects are clear and they preserve useful default intelligibility.
- Verify FINISH, RESTART, held triggers, Stop priority, empty text, Busy during
  pauses, exactly one End pulse, and no End on interruption.
- Verify phrase edits and body selection cannot corrupt an active phrase;
  stale Worker results cannot replace newer revisions; export/import preserves
  text and controls and prepares consistently before Ready.
- Measure onset latency, restart discontinuities, terminal clicks, silence after
  Stop, finite output, DC, and ±5 V limits across sample rates and block sizes.
- Assert no gesture loss, allocations, or memory growth during playback. Profile
  at least two SPEECH instances in a real running rack, including simultaneous
  preparation, and repeat the existing VOCAL/BEATBOX regressions if shared code
  changes.

## Sources and evidence quality

All web sources accessed 2026-11-17. Technical behavior above comes from primary
manuals, product documentation, or pinned source. Hardware is inspiration; this
is a utility adaptation of CHIMERA rather than an emulation of one module.

| ID | Source and date | Supports |
|---|---|---|
| s1 | [Nexus Manual][s1], Polaxis / Jean-Luc Deladrière, firmware history through 2023-12-31, undated current manual | Text/file/keyboard workflows, controls, punctuation, Busy, and mode differences. |
| s2 | [E950 manual][s2], Synthesis Technology, undated | ROM indexing, sequencer example, stutter, speaking gate, speed and bending. |
| s3 | [E951 manual][s3], Synthesis Technology, undated | LPC fragment loops, display, and gate/latch operation. |
| s4 | [Plaits manual][s4], Mutable Instruments, undated | Speech algorithms and separation of pitch, formants, speed, and word selection. |
| s5 | [SpeakerPro documentation][s5], docB, undated current documentation | Preparation pipeline, pronunciation/prosody editing, sample playback, bank and EOC. |
| s6 | [Robot Speech][s6], Voxglitch, undated browser tool | SAM authoring controls and per-line WAV export; not a module CV specification. |
| s7 | [Nexus Vox product documentation][s7], Polaxis, undated | Live control explicitly supported; Pitch CV mode qualification. |
| s8 | [English frontend][s8], CHIMERA / jamesondh, pinned commit `24bd2e4`, 2026-11-16 | Dictionary/fallback, stress, word boundaries, punctuation, fixed homographs. |
| s9 | [Speech planner][s9], same pinned CHIMERA revision | Body-aware gestures, timing, pitch, and planning options. |
| s10 | [Local gesture score][s10], CHIMERA adapted for this repository | 64-entry capacity and overflow behavior; local code is authoritative for this limitation. |
| s11 | [Dictionary notice][s11], Carnegie Mellon University, copyright 1993–2015, bundled by pinned CHIMERA | Dictionary redistribution conditions. |

The manufacturer embeds provide a [Nexus demonstration][d1] and an
[E951 tutorial][d2]. Their audiovisual contents were not retrievable in this
research pass; no comparative listening or naturalness claim is based on them.
The documented workflows above are sufficient to propose transport behavior;
our own listening prototype remains necessary to settle voice quality.

[s1]: https://www.polaxis.be/nexus-manual/
[s2]: https://synthtech.com/docs/E950_manual.pdf
[s3]: https://synthtech.com/docs/E951_manual.pdf
[s4]: https://pichenettes.github.io/mutable-instruments-documentation/modules/plaits/manual/
[s5]: https://docb.io/speakerpro
[s6]: https://www.voxglitch.com/robot
[s7]: https://www.polaxis.be/product/nexus/
[s8]: https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/english.rs
[s9]: https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/crates/chimera/src/phonetics/planner.rs
[s10]: ../../wasm/airway/vendor/chimera/src/control/score.rs
[s11]: https://github.com/jamesondh/chimera-vocal-synth/blob/24bd2e4ee4accf7b27d57d8bf912472880dff9f7/public/data/CMUDICT-LICENSE.txt
[d1]: https://www.youtube.com/watch?v=Medf5SuGAOU
[d2]: https://www.youtube.com/watch?v=3n2ICLFqigU
