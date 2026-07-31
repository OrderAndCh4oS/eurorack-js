# CV Recorder — Research and Specification

**Status:** spec-ready
**Module ID:** `cv-rec`
**Working model:** dual arbitrary-CV/gate recorder and looper; inspired utility
adaptation

## Scope

CV Recorder captures voltages that arrive through patch cables and replays them
as reusable modulation. It has two aligned lanes, each containing one continuous
CV signal and one logical gate signal. A free-time mode records gestures at a
fixed control rate; a clocked mode records one CV/gate step per clock. Both modes
can replay with stepped or smoothed CV while gates remain discrete.

The external-input contract is the reason this candidate remains distinct:

- `joystick` records its own normalized X/Y performance state after the pad and
  its mode-dependent CV transforms. It does not preserve two arbitrary input
  voltages plus two independent external gates.
- `loop` is a mono, audio-rate, tape-style looper with reverse, half-speed,
  feedback, edge fades, and a `-5..+5 V` audio contract. CV Recorder is a dual
  control-rate memory with explicit gate semantics, a `-10..+10 V` CV contract,
  and clock-edge capture.
- `sh` remembers one instantaneous value; it does not retain or replay a
  sequence or gesture.
- `rec` exports audio and has no in-rack playback path.

If implementation drops the arbitrary external CV inputs, the paired gate lanes,
or clocked capture, `cv-rec` should be retired rather than shipped as a second
JOY/LOOP variant.

CV Recorder is deliberately not an audio sampler, DAW automation editor, scene
manager, pitch quantizer, generative sequencer, or non-volatile pattern library.
It does not draw or edit a waveform, reverse or time-stretch recordings, punch
into a selected region, or store recordings in patch JSON. Those are explicit
scope boundaries, not missing details.

## Research Questions

1. Which existing instruments record arbitrary external voltage rather than
   only their own panel controls?
2. How do continuous gesture recorders differ from clocked CV/gate recorders?
3. What transport makes recording fast enough for performance without making
   destructive actions ambiguous?
4. Which reconstruction belongs to continuous CV, and which belongs to gates?
5. What fixed memory and control rate are sufficient for modulation without
   pretending to be an audio recorder?
6. How should a recording survive AudioWorklet stop/start without becoming
   patch-persisted bulk data?
7. What remains materially distinct from the existing JOY, LOOP, SH, SEQ, and
   REC modules?

## Source Register

Sources are grouped by role. Manufacturer manuals and firmware/source records
carry the most weight for behavior and electrical facts. Reviews and demos are
used for observed workflow, not undocumented voltages. Historical software and
academic sources establish the longer practice of sampling and replaying control
functions.

### Primary hardware and implementation sources

1. **“QUAD CV RECORDER Manual,” Flame, version 1.01, product era 2015–2016.**
   [Official manual PDF](https://www.flame-instruments.de/pdf/Manual_Flame_4CVRec_v101_eng.pdf),
   accessed 31 July 2026. Primary source for four external-CV tracks, free and
   clocked recording, 16-bit storage, `-5..+5 V` / `0.1..9 V` ranges, 66-second
   free recording, loop/single/gate/scan playback, punch-in, linked tracks,
   clocked hard/soft reconstruction, and battery-backed memory.
2. **“Bishop's Miscellany User Manual,” Shakmat, original module era
   2014–2016.**
   [Manual PDF mirror linked from the manufacturer record](https://www.analoguehaven.com/shakmat-modular/bishops-miscellany/manual.pdf),
   accessed 31 July 2026. Primary-adjacent copy of the original manual defining
   dual stepped CV plus logic recording over 32 steps, live input monitoring
   while recording, external Record, clock/reset, segment length/shift, and
   `0..5 V` inputs and outputs.
3. **“Bishop's Miscellany,” Shakmat, current legacy product record.**
   [Manufacturer page](https://shakmat.com/products/bishop-miscellany/),
   accessed 31 July 2026. Primary source confirming the intended patch sources
   include keyboards, MIDI-CV, ribbons, joysticks, and other CV/gate controllers,
   with dual CV/gate capture and up to 32 steps.
4. **“Bishop's Miscellany MK2,” Shakmat, current product/firmware record,
   2025–2026.**
   [Manufacturer page](https://shakmat.com/products/bishop-miscellany-mk2/),
   accessed 31 July 2026. Primary source for the expanded dual CV/gate recorder,
   processing and regenerative engines, sequence editing, SD-card storage,
   playlist workflow, and the contrast between immediate capture and a deep
   sequence workstation.
5. **“Pip v1.1 Manual,” Neutral Labs, current revision accessed 31 July
   2026.**
   [Official manual PDF](https://neutral-labs.com/sb/pip-downloads/Pip-v1.1-manual.pdf)
   and [product page](https://neutral-labs.com/pip). Primary source for two
   clock-related CV generators that can record either external CV or knob
   movement, store 128 samples per cycle, loop immediately, output simultaneous
   unipolar/bipolar forms, and morph or time-relate the result.
6. **“Pip,” Neutral Labs, open-source firmware, initial release 22 December
   2022.**
   [Official source repository](https://github.com/neutral-labs/pip), accessed
   31 July 2026. Primary implementation reference for bounded embedded CV
   recording and lookup. It is a design reference only; no firmware code is to
   be copied.
7. **“Brain Seed Quick Start,” Antimatter Audio, original product era
   approximately 2013.**
   [Manufacturer quick-start PDF](https://d1aeri3ty3izns.cloudfront.net/media/29/299187/download_299187.pdf),
   accessed 31 July 2026. Primary document for exact clock-edge snapshots of an
   arbitrary `-5..+5 V` input, variable recording up to 1000 steps, fixed
   8/16/32-step modes, trigger-controlled record state, playback direction/CV
   addressing, and a `+1.5 V` hardware trigger threshold.
8. **“Brain Seed Support / FAQ,” Antimatter Audio, current archived support
   page.**
   [Manufacturer FAQ](https://antimatteraudio.blogspot.com/p/support-faq.html),
   accessed 31 July 2026. Primary support evidence for CV-address noise
   sensitivity, clipping behavior, calibrated `-5..+5 V` output, saved state,
   freeze/reset distinctions, and behavior across 8/16/32/1000-step lengths.
9. **“PAPAGEI Two Track 1V/Octave CV Looper Quickstart,” Flame, version
   1.00, 2026.**
   [Official German quick-start PDF](https://www.flame-instruments.com/pdf/Quickstart_Flame_Papagei_v100_deu.pdf),
   accessed 31 July 2026. Primary current evidence for a compact two-track,
   clocked CV/gate looper, gate-qualified overwrite, independent loop lengths,
   reset/clear/mute, a sixteenth-note grid, up to 16 bars, and separate CV/gate
   outputs. The electrical and behavioral details are taken from the German
   source; translated retailer summaries are only cross-checks.
10. **“Planar 2 Manual,” Intellijel, version 1.3, 16 April 2024.**
    [Official manual PDF](https://intellijel.com/downloads/manuals/planar-2_manual_v1.3_2024.04.16.pdf),
    accessed 31 July 2026. Primary comparison for JOY's recordable X/Y surface,
    one-shot/loop gesture playback, trigger sync, and Cartesian/Polar/Scan CV
    transformations. It supports the duplication analysis; CV Recorder does not
    emulate Planar's joystick or vector mixer.

### Historical and software-automation context

11. **“Interview with Max Mathews,” Curtis Roads, Computer Music Journal,
    originally 1980.**
    [Archived interview PDF](https://stereolux.org/sites/stereolux/files/import_archives/roads-max_matthews_interview.pdf),
    accessed 31 July 2026. Mathews describes GROOVE treating a score as sampled
    control functions for an analog synthesizer and recording human gestures at
    roughly 100–200 Hz. This is strong historical precedent for control-rate,
    rather than audio-rate, gesture memory.
12. **“AN1x Owner's Manual,” Yamaha, original instrument era 1997.**
    [Official manual PDF](https://data.yamaha.com/files/download/other_assets/3/333543/AN1xE1.PDF),
    accessed 31 July 2026. Primary historical source for the four-track Free EG,
    which records real-time knob movement and replays parameter trajectories.
13. **“Electribe S (ES-1) Owner's Manual,” Korg, original manual era
    2000–2001.**
    [Official manual PDF](https://cdn.korg.com/us/support/download/files/2f4f5b80ccf8a36b24997d482cabfeb3.pdf),
    accessed 31 July 2026. Primary source for pattern-looped Motion Sequence
    recording and the musically important distinction between Smooth playback
    and Trigger Hold stepped playback.
14. **“electribe Parameter Guide,” Korg, 2016 revision.**
    [Official parameter guide PDF](https://cdn.korg.com/us/support/download/files/b77b1482084a8677d7f5ba24efc6cd5e.pdf),
    accessed 31 July 2026. Confirms modern Motion Sequence modes: fluid/smoothed
    knob changes versus values held from note triggers.
15. **“Automation and Editing Envelopes,” Ableton Reference Manual version
    12, current guide accessed 31 July 2026.**
    [Official manual chapter](https://www.ableton.com/en/live-manual/12/automation-and-editing-envelopes/).
    Primary software-workflow source for recording performed control changes,
    loop automation, touch versus latch behavior, punch-out at a clip boundary,
    discrete switch envelopes, and explicit override/re-enable state.

### Sampling and interpolation references

16. **“Lecture 17: Interpolation,” Alan V. Oppenheim, MIT OpenCourseWare,
    Signals and Systems.**
    [Lecture and transcript](https://mitocw.ups.edu.ec/resources/res-6-007-signals-and-systems-spring-2011/video-lectures/lecture-17-interpolation/),
    accessed 31 July 2026. Academic reference distinguishing exact band-limited
    reconstruction from approximate zero-order hold and first-order/linear
    interpolation.
17. **“Fractional Delay Filtering by Linear Interpolation,” Julius O. Smith
    III, Physical Audio Signal Processing, CCRMA/Stanford, 2010; web revision
    28 June 2024.**
    [Online chapter](https://ccrma.stanford.edu/~jos/pasp/Fractional_Delay_Filtering_Linear.html),
    accessed 31 July 2026. Supports allocation-free linear table lookup and
    documents its strongest accuracy at DC/low frequencies and its limitations
    for broadband audio.
18. **“Sampling continuous-time signals,” EE603 Digital Signal Processing and
    its Applications, IIT Bombay, 2020 course edition.**
    [Course chapter](https://www.ee.iitb.ac.in/~akumar/courses/ee603-2020/sampling),
    accessed 31 July 2026. Academic reference for the greater-than-twice-bandwidth
    sampling condition, aliasing under insufficient rates, and the trade-off
    between sample-and-hold and linear reconstruction.

### Independent reviews, demos, and field observations

19. **“Shakmat Bishop's Miscellany MkII,” Robin Vincent, Sound On Sound,
    February 2026.**
    [Independent review](https://www.soundonsound.com/reviews/shakmat-bishops-miscellany-mkii),
    accessed 31 July 2026. Observes that the original recorder was immediate and
    playful, while MkII adds screen/encoder learning cost; also documents
    held-record overwrite, tapped incremental recording, and quick CV/gate
    capture in practice.
20. **“Resurgence: Experiences and Impacts of the Contemporary Modular
    Synthesiser,” doctoral thesis, University of Technology Sydney, 2023–2024
    repository edition.**
    [Institutional PDF](https://opus.lib.uts.edu.au/bitstream/10453/177946/1/thesis.pdf),
    accessed 31 July 2026. Academic field observation of Bishop's Miscellany
    capturing two CV/gate streams, enabling punch-like replacement, repeating
    meso-scale structures, and restoring performer influence over generative
    material.
21. **“Knob and CV recorders,” Gearspace Modular Mania discussion, October
    2017.**
    [Forum thread](https://gearspace.com/board/modular-mania-all-things-eurorack-and-modular-synths-effects/1182460-knob-cv-recorders.html),
    accessed 31 July 2026. Anecdotal workflow evidence: a Flame C-3 user values
    immediate freeform drawing of a modulation loop but explicitly notes the
    absence of sync. This source does not support electrical facts.
22. **“Neutral Labs Pip complex CV generator/recorder Eurorack module demo,”
    MatrixSynth, 14 January 2023.**
    [Demo index](https://www.matrixsynth.com/2023/01/neutral-labs-pip-complex-cv.html),
    accessed 31 July 2026. Video-index evidence for hearing recorded CV and
    morphing it in patch context. The embedded demo is promotional/product
    demonstration rather than an independent measurement.
23. **“Flame QUAD CV RECORDER,” ModularGrid, current database record.**
    [Secondary specification cross-check](https://modulargrid.com/e/flame-quad-cv-recorder),
    accessed 31 July 2026. Supports practical panel size, discontinued status,
    track/link modes, ranges, clock modes, and user/rack context; the official
    Flame manual wins on conflicts.

### Local architecture and comparison sources

24. **Local `joystick`, `loop`, `sh`, and `rec` definitions and research
    records, revision inspected 31 July 2026.**
    [`joystick`](../../src/js/modules/joystick/index.js),
    [`loop`](../../src/js/modules/loop/index.js),
    [`sh`](../../src/js/modules/sh/index.js), and
    [`rec`](../../src/js/modules/rec/index.js). These are authoritative for the
    duplication boundary, existing 500 Hz / 64-second JOY gesture storage,
    audio-rate LOOP behavior, sample-and-hold scope, and recording/export
    runtime patterns.
25. **Local architecture and module-authoring contracts, revision inspected
    31 July 2026.**
    [Architecture](../../docs/architecture.md) and
    [Creating Modules](../../docs/creating-modules.md). Authoritative for
    AudioWorklet ownership, stable buffers, bounded telemetry, module events,
    runtime-state hooks, patch separation, and worklet-safe allocation rules.

## Evidence Synthesis

### Arbitrary voltage recording is a distinct modular operation

The strongest hardware precedents do not require the recorded motion to
originate on the recorder. Flame QUAD accepts LFOs, envelopes, sequencers,
joysticks, or other external CV on four independent tracks. Bishop's Miscellany
and Papagei capture paired external pitch/CV and gate information. Brain Seed
samples whatever voltage is present at its input on each clock. Pip can replace
its internal middle waveform with external CV.

This is materially different from remembering a module's own UI gestures. It
allows a performer to freeze a favorable section of a random source, re-use an
envelope as a looping macro, capture pitch plus articulation from another
sequencer, or turn any patched controller into a repeatable modulation source.
The field study's Bishop patch is particularly direct evidence: a performer
regains structural influence by capturing and looping otherwise generative CV
and gates.

### Continuous and clocked capture solve different musical problems

Flame QUAD exposes both free recording and clock sampling. Free recording keeps
the timing and curvature of a performed gesture. Clocked capture treats each
edge as a step and is appropriate for pitch, rhythm, resampling sequencers, and
tempo-locked automation. Pip takes a related but different path: it stores a
fixed number of samples across a cycle so recorded modulation can follow its
clock relationship. Brain Seed and Bishop are explicitly clock-edge recorders.

CV Recorder therefore includes both modes rather than pretending that one
sampling policy is universally correct:

- `FREE` is a modulation recorder. It stores two CV/gate pairs at 1000 frames
  per second for up to 60 seconds.
- `CLOCK` is a dual step recorder. It stores the two CV/gate pairs at exact
  clock rising edges for up to 1024 steps.

The modes share a transport and memory but keep their own playback timing. The
mode is captured with each recording, so moving the mode selector cannot
reinterpret existing data accidentally.

### Smooth versus stepped reconstruction must be explicit

Korg's Motion Sequence documents the musician-facing choice cleanly: continuous
controls may connect smoothly or hold values at trigger timing. Flame QUAD makes
the same distinction as clocked SOFT versus HARD output. Sampling references
describe these as first-order/linear interpolation and zero-order hold.

CV Recorder exposes `STEP` and `SMOOTH` for continuous CV only:

- `STEP` is zero-order hold. It is correct for deliberate voltage steps and
  pitch sequences.
- `SMOOTH` uses linear interpolation. It is inexpensive, allocation-free, exact
  at stored points, and well suited to low-bandwidth modulation.
- Gates are always zero-order held and reconstructed as logic. Interpolating a
  gate would create threshold-dependent timing and is forbidden.

Linear interpolation is not band-limited reconstruction. A 1000 Hz free capture
rate is intentionally a control-rate compromise, not an audio-quality claim.
The recorder's free path is specified for modulation below 500 Hz, with best
results far below that limit. Audio-rate or strongly aliased signals belong in
`loop`.

### Immediate monitoring and visible state are performance requirements

Bishop passes its inputs to the outputs during recording. Flame QUAD passes the
selected source during record standby and capture, then begins playback when
recording stops. Reviews consistently value this direct transition: perform a
movement, stop, and immediately hear it loop.

The app adaptation follows that behavior. Empty and actively recording lanes
monitor their sanitized inputs. A compact display and bounded LEDs distinguish
EMPTY, ARM, REC, PLAY, and PAUSE; they also show whether the stored timebase is
free or clocked. No waveform history crosses from the worklet.

### Persistence is runtime-only

Hardware spans volatile loops, battery-backed memory, and SD-card pattern
libraries. The repository already separates patch parameters from bulk runtime
state. CV Recorder follows `loop` and `joystick`:

- controls and mode selections are patch-persisted parameters;
- recorded arrays are bounded AudioWorklet runtime state;
- AudioWorklet stop/start and supported topology recreation can restore that
  runtime snapshot;
- patch export, URL sharing, page reload, and a fresh module instance do not
  contain the recording;
- restoring runtime state always disarms recording to prevent an old transport
  edge from overwriting the restored loop.

This rejects Flame QUAD's battery and Bishop MkII's SD-card model for v1. Adding
large pattern data to patch JSON would expand scope into a scene/preset manager
and require a separate architecture decision.

## Duplication Risk and Intake Decision

| Existing module | What it records/does | Why `cv-rec` remains distinct |
|---|---|---|
| `joystick` / JOY | Its final normalized X/Y position and derived gate at 500 Hz, after pad position and Cartesian/Polar/Scan transforms; 64-second runtime gesture | CV Recorder has no pad or coordinate transform. It preserves two independent patched voltages over `-10..+10 V`, plus two independent external gate lanes, and has exact clock-edge capture. |
| `loop` | One mono audio-rate `-5..+5 V` stream with tape-style record modes, feedback, reverse/half speed, and audio edge fades | CV Recorder is dual control-rate data plus gate logic, has no feedback/reverse/audio claims, preserves DC up to wider rails, and can record one frame per external clock. |
| `sh` | One instantaneous voltage sampled on a trigger | CV Recorder retains up to 60,000 continuous frames or 1024 clocked steps per lane and loops them. |
| `seq` | Panel-authored fixed steps | CV Recorder derives values from arbitrary external patches and records gates with them. |
| `rec` | Audio-to-WAV capture and browser download | CV Recorder replays inside the rack and never emits file/download events. |

**Intake decision: keep and specify.** The combination of arbitrary paired
external CV/gate capture, dual aligned lanes, and FREE/CLOCK timebases is not
provided by an existing module. A reduced implementation that records only a
panel knob, only JOY's own state, or a single audio-rate stream would fail this
decision and should be blocked as duplicate scope.

## App Panel Contract

### Metadata and renderer

- **Module ID:** `cv-rec`
- **Name:** `CV REC`
- **Category:** `modulation`
- **Width:** 12 HP
- **Color:** `module-color-seven`
- **Renderer:** compact custom renderer using only the shared toolkit for knobs,
  actions, jacks, LEDs, and cleanup. The renderer adds a scalar status/length
  display; it does not draw or retain a waveform.
- **Telemetry:** bounded scalar values only:

```javascript
telemetry: {
    fields: ['transportState', 'recordedMode', 'recordedLength', 'playProgress'],
    methods: []
}
```

Telemetry meanings are normative:

- `transportState`: integer `0=EMPTY`, `1=ARM`, `2=REC`, `3=PLAY`, `4=PAUSE`.
- `recordedMode`: integer `-1=none`, `0=FREE`, `1=CLOCK`.
- `recordedLength`: integer `0..60000`; in CLOCK recordings it is constrained
  further to `0..1024`.
- `playProgress`: finite scalar `0..1`; empty memory reports `0`.

### Persisted controls

| Param | Control | Values | Default | Contract |
|---|---|---:|---:|---|
| `mode` | two-position switch/bank | `0=FREE`, `1=CLOCK` | `0` | Selects the mode for the next new recording. An existing recording retains its captured mode until replaced or cleared. |
| `shape` | two-position switch/bank | `0=STEP`, `1=SMOOTH` | `1` | Live playback choice for CV reconstruction. It never changes stored samples. Gate lanes are always stepped. |
| `playMode` | two-position switch/bank | `0=LOOP`, `1=ONE` | `0` | LOOP wraps indefinitely; ONE stops at the final frame/step and holds it. |

All three values clamp to integer `0` or `1` at DSP entry.

### Transient actions

| Param | Label | UI mode | Default | Effect |
|---|---|---|---:|---|
| `record` | REC | trigger | `0` | Toggles the internal record request. FREE starts/stops immediately; CLOCK arms start/stop for a clock boundary. |
| `play` | PLAY | trigger | `0` | With committed memory and no active record transaction, toggles PLAY/PAUSE. |
| `resetAction` | RESET | trigger | `0` | Aborts an active/armed recording or rewinds committed playback to position zero without erasing memory. |
| `clear` | CLEAR | trigger | `0` | Erases both lanes and returns to live input monitoring. |

Transient actions use independent rising-edge histories. Patch loading releases
captured high action params to zero under the repository's existing transient
action policy. Every custom control calls `onParamChange`; direct mirror mutation
is forbidden.

### Inputs

| ID/port | Label | Signal | Voltage | Normal | Behavior |
|---|---|---|---|---:|---|
| `cv1In` | CV 1 IN | `cv` | `-10..+10 V` | `0 V` | Lane 1 continuous voltage source. |
| `gate1In` | GATE 1 IN | `gate` | `0..10 V` | `0 V` | Lane 1 logical source, high at `>=1 V`. |
| `cv2In` | CV 2 IN | `cv` | `-10..+10 V` | `0 V` | Lane 2 continuous voltage source. |
| `gate2In` | GATE 2 IN | `gate` | `0..10 V` | `0 V` | Lane 2 logical source, high at `>=1 V`. |
| `clock` | CLOCK | `trigger` | `0..10 V` | `0 V` | CLOCK-mode edge input; rising only when the sample is strictly `>2.5 V` after a sample at or below threshold. |
| `recordTrig` | REC | `trigger` | `0..10 V` | `0 V` | Rising edge at `>=1 V` toggles the same logical record request as the panel action. |
| `reset` | RESET | `trigger` | `0..10 V` | `0 V` | Rising edge at `>=1 V` invokes the same reset command as the panel action. |

The paired CV and gate inputs have no cross-normalization. FREE mode ignores
clock transport but still updates clock edge history, so changing modes while a
clock is high cannot create a false edge.

### Outputs

| ID/port | Label | Signal | Voltage | Behavior |
|---|---|---|---|---|
| `cv1Out` | CV 1 OUT | `cv` | `-10..+10 V` | Lane 1 monitored or recorded CV. |
| `gate1Out` | GATE 1 OUT | `gate` | `0/10 V` | Lane 1 monitored or recorded logic. |
| `cv2Out` | CV 2 OUT | `cv` | `-10..+10 V` | Lane 2 monitored or recorded CV. |
| `gate2Out` | GATE 2 OUT | `gate` | `0/10 V` | Lane 2 monitored or recorded logic. |
| `eol` | EOL | `trigger` | `0/10 V` | 8 ms pulse on a LOOP wrap or ONE completion. Record finalization alone does not pulse. |

When memory is EMPTY, outputs continuously monitor the inputs. While actively
recording, they also monitor sanitized input at audio-block sample resolution,
not the reduced recording frame rate. An empty CLOCK arm continues the monitor;
an arm made while old memory exists continues the old playback until the first
recording clock commits the replacement.

PAUSE holds the current recorded CV and gate values. Clearing returns to input
monitoring on the exact clear sample. No output buffer identity may change.

### LEDs and display

| LED | Meaning |
|---|---|
| `recording` | Full while active recording; half while a CLOCK start/stop is armed. |
| `playing` | Full in PLAY, half in PAUSE, off without committed memory. |
| `memory` | Full whenever a valid recording exists. |
| `clock` | 50 ms visual hold after an accepted CLOCK-mode edge. |
| `eol` | Follows the 8 ms EOL pulse timer. |
| `gate1` / `gate2` | Follow the two output gate states. |
| `phase` | `playProgress` during playback; `recordedLength / limit` while recording; `0` when empty. |

All LEDs remain finite in `0..1`. The renderer displays state plus stored
timebase/length without unbounded history:

- EMPTY: `EMPTY`
- armed: `ARM F` or `ARM C`
- active: `REC F` / `REC C`
- playback: `PLAY F 12.345s` or `PLAY C 0032`
- paused: `PAUSE F ...` or `PAUSE C ...`

The FREE seconds display derives from `recordedLength / 1000`; CLOCK displays
steps. The panel labels recorded memory `RUNTIME` so it does not imply patch or
page persistence.

## Voltage and Timing Contract

### Continuous CV

- Finite input is clamped to the inclusive `-10..+10 V` recorder rails before
  storage or monitoring.
- `NaN`, `Infinity`, and `-Infinity` become `0 V` before any accumulation.
- Stored CV is `Float32`; the module applies no pitch quantization, offset,
  normalization, slew, saturation curve, or gain change.
- Output is clamped again to `-10..+10 V` after reconstruction.
- The wide range intentionally preserves the app's bipolar modulation and
  0–10 V controller sources. Downstream modules retain responsibility for their
  own declared input range.

### Gates and triggers

- Gate inputs are logical high at `>=1 V`, low below `1 V`.
- Gate outputs are exactly `10 V` high and `0 V` low.
- Panel actions and `recordTrig` / `reset` use `>=1 V` rising edges.
- CLOCK is stricter: a rising edge crosses from `<=2.5 V` to `>2.5 V`.
- EOL is an exact `round(sampleRate * 0.008)`-sample 10 V pulse, minimum one
  sample. A new EOL retrigger restarts the full 8 ms timer.

### FREE recording rate and bandwidth

- Fixed logical frame rate: exactly 1000 frames/second, independent of audio
  sample rate and render block size.
- Maximum: 60,000 frames = 60 seconds.
- A phase accumulator schedules frame boundaries without rounding 44.1, 48, or
  96 kHz into different long-term control rates.
- Frame zero samples both CV/gate pairs on the exact accepted record-start
  sample.
- After frame zero, set `freePhase = 0` and clear the four accumulators. For
  every later audio sample that remains in REC, first add that sample's two
  sanitized CV values and gate truth values to the current window, then add
  `1000` to `freePhase`. When `freePhase >= sampleRate`, subtract
  `sampleRate`, store one frame from that non-empty window, and clear the
  accumulators. Since 1000 is below every supported sample rate, at most one
  frame boundary occurs per audio sample.
- These are half-open logical windows after the instantaneous frame zero. At
  48 kHz the first averaged frame contains samples `start+1..start+48`; at
  44.1 kHz the phase remainder alternates 45- and 44-sample windows. Each CV
  frame stores its window's arithmetic mean. This bounded boxcar integration
  reduces, but does not eliminate, aliasing.
- A FREE gate frame is high if any sample in its frame interval is high. This
  preserves the repository's ordinary 5–10 ms triggers at 1 kHz while accepting
  that a sub-millisecond pulse may be extended to one frame.
- Fewer than two frames is not a valid FREE recording. Stopping earlier returns
  to EMPTY.
- REC-stop/CLEAR/RESET priority is evaluated before FREE accumulation on that
  sample. The command sample is excluded even when it coincides with the next
  frame boundary, and any incomplete accumulator window is discarded. Starting
  on sample 0 and stopping on sample `10 * sampleRate` therefore commits exactly
  10,000 frames at every supported sample rate.
- FREE recording auto-finalizes on frame 60,000 and begins playback at frame
  zero.
- The path is intended for modulation below 500 Hz and is most faithful at
  much lower human-gesture/LFO rates. It makes no audio-band fidelity promise.

### CLOCK recording

- Maximum: 1024 steps, chosen as a bounded binary extension of Brain Seed's
  documented 1000-step variable memory.
- Each accepted clock edge captures the two clamped CV values and the two gate
  truth values from that exact audio sample.
- One captured step is a valid CLOCK recording.
- Reaching 1024 steps auto-finalizes. The full buffer does not wrap and
  overwrite silently.
- Held-high CLOCK does not repeat. An edge at exactly `2.5 V` does not count.

## Transport and Collision Contract

### Command priority

At each audio sample, commands are combined from their independent panel and
jack edge detectors. A panel and jack edge for the same command on one sample
produce one logical command, not two toggles. If different commands coincide,
their evaluation order is:

1. `CLEAR`
2. `RESET`
3. `REC`
4. `PLAY`
5. `CLOCK`

CLEAR suppresses every later command, and RESET suppresses REC, PLAY, and CLOCK.
Otherwise REC is applied before PLAY and suppresses PLAY on that sample; CLOCK
is then evaluated against the resulting record state. Thus REC+CLOCK arms and
captures step zero on the same sample, while an armed-stop REC+CLOCK finalizes
before that edge can append another step.

### FREE state transitions

- REC from EMPTY, PLAY, or PAUSE clears committed data and begins a new FREE
  recording immediately on that sample.
- REC while recording finalizes immediately. Two or more frames commit and
  begin PLAY from frame zero; fewer frames return EMPTY.
- PLAY with committed data toggles PLAY/PAUSE. It is ignored while recording.
- RESET while recording aborts the incomplete replacement and returns EMPTY.
  RESET in PLAY/PAUSE rewinds to frame zero and preserves the prior run/pause
  state.
- CLEAR always erases both lanes and returns to live monitoring.
- FREE playback advances by `1000 / sampleRate` frames per audio sample.

### CLOCK state transitions

- REC from EMPTY, PLAY, or PAUSE enters ARM-start. Existing committed memory,
  if any, continues its previous run/pause behavior while waiting.
- A second REC before the first clock cancels ARM-start without damaging the
  old memory.
- The next accepted clock after ARM-start clears the old memory, captures step
  zero on that exact sample, enters REC, and begins live input monitoring.
- REC while actively recording enters ARM-stop. A second REC before the next
  clock cancels ARM-stop and continues recording.
- On the next clock after ARM-stop, recording finalizes **before** a new step is
  captured. Playback installs step zero on that same sample. The following clock
  advances to step one.
- PLAY toggles committed PLAY/PAUSE only when no record start/stop transaction is
  active.
- RESET cancels ARM-start/ARM-stop. During active recording it aborts the new
  recording and returns EMPTY; during committed playback it installs step zero
  immediately and preserves run/pause.
- CLOCK playback advances one stored step per accepted edge. With no clock it
  holds its current values indefinitely.

### Playback completion

- LOOP wraps from the last frame/step to zero and emits EOL.
- ONE reaches the last frame/step, emits EOL once, enters PAUSE, and holds the
  final CV/gates.
- FREE mode detects completion at the exact sample where its fractional playhead
  reaches the end.
- CLOCK mode detects completion on the edge that would advance past the last
  step.
- Changing `playMode` or `shape` is live and never mutates memory or resets the
  playhead.

## Reconstruction Contract

### FREE

- STEP outputs `buffer[floor(playHead)]` until the next frame.
- SMOOTH linearly interpolates between the current and following CV frames.
  LOOP treats frame zero as the neighbor after the final frame; ONE clamps its
  final neighbor to the final frame.
- Gates use the current frame only, with no fractional thresholding.

### CLOCK

- STEP installs the current step CV at the clock edge and holds it.
- SMOOTH starts at the current step on an edge and moves linearly toward the
  next stored step over the most recently measured complete clock period.
- Before one complete period has been measured, SMOOTH holds the current step.
- If the next edge arrives early, output snaps to the newly selected exact
  sample on that edge. If it arrives late, CV reaches the target at the predicted
  period and holds until the edge. This bounded causal policy follows tempo
  changes without look-behind allocation.
- Gates always change only at actual clock edges and always represent the
  current stored step.

## Runtime Memory and Lifecycle

### Fixed worklet memory

Allocate once in `createDSP()`:

- two `Float32Array(60000)` CV stores;
- two `Uint8Array(60000)` gate stores;
- stable per-block input/output arrays;
- scalar phase, accumulator, transport, edge, interpolation, pulse, LED, and
  telemetry state.

The recording stores total 600,000 bytes before ordinary DSP buffers. CLOCK uses
only the first 1024 entries. `process()` performs no array/object allocation,
slice, sort, callback iteration, or browser work.

### Runtime-state hooks

`captureRuntimeState()` may allocate bounded copies only when the host requests
a runtime snapshot. It captures:

- valid length and recorded mode;
- valid prefixes of both CV and gate arrays;
- playhead/step and PLAY/PAUSE state;
- FREE frame-rate version (`1000`) for validation.

`restoreRuntimeState()` validates shape, finite values, rails, gate bytes,
length, and mode before copying into preallocated stores. Invalid or oversized
state restores EMPTY rather than partially trusting data. Restoration always:

- clears record/arm/action/edge histories;
- sets recording false;
- restores committed playback at the bounded saved position;
- fills output buffers deterministically on the next `process()` call.

If runtime capture occurs during an active recording, a valid partial FREE
recording of at least two frames or CLOCK recording of at least one step is
captured as committed memory. Restoration starts it in PLAY at frame/step zero;
recording does not resume across the audio gap. An invalid partial capture is
discarded.

The DSP `reset()` resets transport, edge histories, accumulators, pulse timers,
input/output buffers, LEDs, and action params but preserves committed recording
memory, matching the repository's looper/JOY lifecycle convention. With valid
memory it restarts in PLAY at frame/step zero; without memory it returns EMPTY.
It fills all stable inputs with their declared normals in place. Because Clock
edge history resets low, a routed high Clock on the first subsequent process
block is accepted once. Only CLEAR or a committed replacement erases memory.

`restoreRuntimeState()` is intentionally different: it restores the validated
saved PLAY/PAUSE state and bounded saved position, then establishes jack edge
histories low. A routed high Clock on its first subsequent process block is
therefore also accepted once in CLOCK mode.

## DSP Model and Trade-offs

This is an inspired utility adaptation, not a faithful emulation of one hardware
module. Flame QUAD supplies the clearest dual free/clock model; Bishop, Brain
Seed, and Papagei supply paired clocked CV/gate behavior; Pip supplies fixed
control-function storage; Korg supplies the STEP/SMOOTH interaction vocabulary.

Chosen trade-offs:

- **Two aligned lanes** rather than Flame's four: enough for X/Y, pitch/timbre,
  or two related modulations while keeping a 12 HP panel and bounded memory.
- **Two independent gates** rather than deriving gates from CV: preserves
  articulation, triggers, and switch automation and closes the JOY duplication
  gap.
- **1000 Hz FREE rate** rather than JOY's 500 Hz: more headroom for arbitrary
  patched envelopes and short standard triggers at about 600 kB fixed storage.
- **Mean CV / any-high gate downsampling:** cheap, bounded, DC-correct, and
  trigger-friendly, but not a substitute for a proper audio anti-alias filter.
- **Linear CV interpolation:** low CPU, exact at samples, suitable for control
  rates; sinc/cubic reconstruction would cost more and still could not recover
  content aliased before storage.
- **Gates never interpolate:** timing semantics win over cosmetic smoothing.
- **No overdub/punch in v1:** replacing a take is exact and reversible only until
  the first new CLOCK capture. Selective overwrite, undo, and multiple memories
  would require more UI and transactional buffers.
- **Runtime-only recording:** compatible with current ownership and bounded
  topology restore, but a shared patch does not carry the gesture.
- **No audio promise:** prevents duplication with LOOP and makes the memory/CPU
  budget honest.

## Assumptions, Contradictions, and Source Weighting

- Hardware voltage ranges conflict: Bishop is `0..5 V`, Brain Seed is
  `-5..+5 V`, Papagei pitch is `0..8 V`, and Flame QUAD offers bipolar and
  near-10 V unipolar modes. The app chooses one transparent `-10..+10 V`
  recorder range so ordinary bipolar and 0–10 V controllers survive without a
  range menu.
- Hardware memory varies from volatile cycle replacement to battery and SD-card
  persistence. Repository runtime-state ownership wins: v1 memory is bounded
  and session/runtime-only.
- Flame QUAD advertises 16-bit capture; JavaScript `Float32` has far more
  resolution than needed across a 20 V control range. The spec does not claim
  converter-level hardware accuracy.
- Continuous recorders disagree on sync. Flame C-3 is valued for freeform use;
  QUAD and Pip add clock relations; Bishop/Brain Seed are step-clocked. The app
  exposes FREE and CLOCK as separate normative models rather than a hidden
  fallback.
- Hardware smoothing details are not fully specified. The app's interpolation
  equations and clock-period behavior are local and testable.
- `1000 Hz`, 60 seconds, 1024 steps, 12 HP, an 8 ms EOL pulse, and the action
  collision order are app decisions, not claims about a cited product.
- The FREE any-high gate accumulator can widen sub-millisecond input pulses to
  one millisecond. That is acceptable because repository triggers are normally
  5–10 ms; it must be documented and tested.
- Audio and CV are physically interchangeable in modular practice, but this
  product contract intentionally excludes audio fidelity. Signals above the
  free recorder's Nyquist limit may alias or average.
- Sound On Sound and the UTS thesis support observed workflow, not voltage or
  threshold facts. Gearspace is anecdotal and is used only for the freeform/no
  sync usability contrast. Manufacturer demos demonstrate intended behavior but
  are not independent measurements.

## Test Targets

1. **Metadata/schema:** exact ID/name/category, 12 HP, valid color, custom
   telemetry fields/methods, three persisted controls, four transient actions,
   seven exact inputs, five exact outputs, and eight LED names.
2. **Initialization:** matching DSP/UI defaults; `Float32Array` inputs/outputs of
   the requested block size; 60,000-frame typed stores; EMPTY telemetry; all
   action params low.
3. **Stable buffers:** every input/output identity survives process, reset,
   clear, recording, runtime restore, mode changes, and all supported block
   sizes.
4. **Empty monitoring:** both CV outputs follow independent inputs sample by
   sample; gates threshold at `0.999 V` versus `1.0 V`; no cross-lane leakage.
5. **Rails/finite guards:** CV accepts exact `-10/+10 V`, clamps beyond rails,
   maps all non-finite samples to zero, and never emits NaN/Infinity.
6. **Clock/action thresholds:** clock rejects `2.5 V` and accepts the first
   sample above it; REC/RESET reject `<1 V`, accept `>=1 V`, and do not repeat
   while held.
7. **Combined commands:** simultaneous panel/jack REC edges toggle once;
   independent edge histories accept a later edge from either source after both
   return low.
8. **Priority:** exact same-sample collision tests lock
   `CLEAR > RESET > REC > PLAY > CLOCK`, including REC+CLOCK and RESET+CLOCK.
9. **FREE start:** frame zero captures both CV/gate pairs on the exact REC sample,
   previous memory clears, output monitoring remains sample-accurate, and a
   later-in-block REC waits until its own sample.
10. **FREE control rate:** across 44.1/48/96 kHz and 128/512 blocks, starting on
    sample zero and stopping before capture on sample `10 * sampleRate` creates
    exactly 10,000 frames independent of block boundaries. Goldens cover the
    first 48 kHz window, alternating 44.1 kHz window lengths, a stop exactly on
    a pending boundary, and discard of a partial final window.
11. **FREE averaging:** known ramps and alternating samples produce exact
    per-window arithmetic means; non-finite values contribute sanitized zero.
12. **FREE gate capture:** any-high accumulation preserves 5 ms and 10 ms pulses,
    records exact low gaps, and documents one-frame widening for a sub-ms pulse.
13. **FREE minimum/maximum:** fewer than two frames rejects the take; 60,000
    frames auto-finalize once without wrap/overwrite.
14. **FREE playback timing:** one second of recorded data loops in one second at
    every supported sample rate, with no block-size drift.
15. **FREE STEP:** output holds exact stored frames and gates, including a
    deliberate discontinuity.
16. **FREE SMOOTH:** output matches linear-interpolation goldens at fractional
    positions, wraps last-to-first only in LOOP, and clamps at the last frame in
    ONE.
17. **CLOCK arm/cancel:** first REC arms without damaging old memory; second REC
    before a clock cancels; old playback continues while waiting.
18. **CLOCK start:** REC on the exact clock sample captures step zero; REC one
    sample later waits for the next edge; capture uses the exact edge-sample CV
    and gate values.
19. **CLOCK stop:** REC arms stop; the next clock finalizes before capture,
    installs stored step zero, and the following clock advances to step one.
20. **CLOCK held/missing:** a held clock never repeats and absent clock holds
    recording/playback state without internal fallback.
21. **CLOCK maximum:** 1024 accepted edges auto-finalize exactly; step 1025 never
    overwrites step zero.
22. **CLOCK STEP/SMOOTH:** STEP holds; SMOOTH linearly targets the next stored CV
    over the last measured period, snaps correctly on early clocks, holds after
    late clocks, and does not interpolate gates.
23. **Mode capture:** changing `mode` after a take never reinterprets its timing;
    the next replacement latches the newly selected mode.
24. **PLAY/PAUSE:** PLAY is ignored without memory or during record transaction;
    otherwise it toggles and PAUSE holds all four lane values.
25. **LOOP/ONE/EOL:** wrap versus final hold, exact EOL timing/retriggering, one
    pulse per completion, and no EOL merely for record finalization.
26. **RESET:** aborts active/armed capture, rewinds committed playback without
    erasing it, preserves PLAY/PAUSE state, clears edge history safely, and does
    not create a false clock edge.
27. **CLEAR:** erases both lanes, wins every collision, zeroes memory telemetry,
    and returns to live monitoring on the exact action sample.
28. **Lifecycle reset:** `reset()` clears transport/actions/I/O/LEDs/helpers,
    restores input normals in place, preserves committed memory, and restarts
    it in PLAY at frame/step zero. A high first-block Clock is accepted once.
29. **Runtime state:** capture/restore round-trips both modes, both gate lanes,
    exact valid length, playhead, run/pause, rails, and typed data without patch
    params; a restored high first-block Clock is accepted once.
30. **Runtime validation:** malformed, non-finite, mismatched, old-rate,
    oversized, or invalid-mode snapshots restore EMPTY atomically.
31. **Mid-record stop/start:** valid partial data restores as committed PLAY at
    zero with REC disarmed; an invalid partial take restores EMPTY.
32. **Feedback:** every telemetry scalar and LED transitions through EMPTY, ARM,
    REC, PLAY, PAUSE, EOL, gate high, and reset while remaining finite/bounded.
33. **Buffer integrity:** every process call fills every output sample; long
    randomized inputs/actions never produce non-finite or out-of-contract values.
34. **Determinism:** identical per-sample input/action streams produce identical
    stored arrays and outputs regardless of block segmentation.
35. **Allocation/worklet safety:** process path uses fixed arrays/scalars only;
    runtime snapshot allocation occurs only on explicit host request; module
    definition has no DOM/browser dependency.
36. **Renderer:** every custom control calls `onParamChange`, jacks use exact
    IDs/directions, display tolerates telemetry delay, all four themes remain
    legible, and cleanup removes listeners/animation.
37. **AudioWorklet integration:** routed CV/gates record and replay in production
    processing order; stop/start restores runtime data; patch replacement never
    replays transient actions.
38. **Duplication acceptance:** a factory/browser test proves that external
    `lfo`/random CV and an independent gate source are captured without using
    JOY's pad state, and that gate playback is not altered by CV interpolation.

## Implementation Plan

- **Module ID/category:** `cv-rec`, `modulation`.
- **Implementation branch/worktree:** `module/cv-rec` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/cv-rec`.
- **DSP model:** inspired dual CV/gate runtime recorder with fixed 60,000-frame
  stores, 1 kHz FREE accumulation/playback, exact-edge CLOCK capture up to 1024
  steps, STEP/SMOOTH CV reconstruction, discrete gates, and explicit transport
  priority.
- **Params:** persisted `mode`, `shape`, `playMode`; transient trigger actions
  `record`, `play`, `resetAction`, `clear`.
- **Inputs:** `cv1In`, `gate1In`, `cv2In`, `gate2In`, `clock`, `recordTrig`,
  `reset`.
- **Outputs:** `cv1Out`, `gate1Out`, `cv2Out`, `gate2Out`, `eol`.
- **LEDs/telemetry:** LEDs `recording`, `playing`, `memory`, `clock`, `eol`,
  `gate1`, `gate2`, `phase`; scalar telemetry `transportState`, `recordedMode`,
  `recordedLength`, `playProgress`.
- **UI:** 12 HP custom toolkit renderer with transport buttons, three mode
  controls, two clearly paired lane I/O columns, clock/transport inputs, scalar
  state/length display, and explicit `RUNTIME` / `MOD ONLY` labeling.
- **Runtime state:** use definition-level `captureRuntimeState()` /
  `restoreRuntimeState()` hooks. Do not add the arrays to `ui.state`, params,
  patch format, telemetry history, or module events.
- **Factory patch:** add `Test - CV Recorder` in
  `src/js/config/patches/test-cv-rec.js`. Demonstrate arbitrary source capture
  with an LFO or random CV, a separate clock/gate source, both a visible scope
  route and a musically audible modulation route. Inspect all exact source and
  destination port names during implementation; do not infer them from this
  plan.
- **Tests first:** create `tests/dsp/cv-rec.test.js` before module code, plus a
  dedicated custom-renderer test when useful. Lock transport collisions,
  control-rate counts, interpolation goldens, runtime state, voltage rails, and
  all buffer identities before implementation.
- **Registration:** add matching entries to `module-manifest.js` and
  `core-definitions.js`, preserve sequential aliases/order, and bump the same
  core graph revision in `worklet-engine.js`, `processor.js`, and
  `core-plugin.js`.
- **Documentation:** add CV REC to AGENTS/README and link this record from the
  research index. Update the module-authoring guide only if implementation
  discovers a reusable runtime-state pattern not already documented.
- **Shared framework changes:** none planned. Existing custom renderer,
  telemetry, transient actions, runtime-state hooks, and patch schema are
  sufficient.
- **Focused validation:**
  `npm test -- tests/dsp/cv-rec.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- **Factory validation:**
  `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- **Runtime/worklet validation:**
  `npm test -- tests/app/rack-host.test.js tests/audio/worklet-engine.test.js tests/audio/worklet-processor.test.js`
- **DSP audit:**
  `npm run audit:dsp -- --module cv-rec --matrix --strict-voltage`
- **Full validation:** `npm test`
- **Known assumptions:** 12 HP, two lanes, `-10..+10 V` CV, 1 kHz/60-second
  FREE storage, 1024 CLOCK steps, mean-CV/any-high-gate accumulation, 8 ms EOL,
  runtime-only memory, no overdub/edit/reverse/speed/quantization, and the
  normative collision order above.

## Deferred Scope

- non-volatile patch/project recording storage or multiple memories;
- undo, overdub, punch-region editing, and per-lane record enable;
- reverse, variable speed, scan CV, start/end trim, or time stretching;
- pitch quantization, generative mutation, random playback, or gate ratchets;
- audio-band capture or file import/export;
- waveform/history telemetry;
- more than two lanes or independent lane lengths.

Each could be useful, but none is required to establish the distinct external
CV/gate recorder capability. Adding several together would recreate the deep
workstation trade-off observed in Bishop MkII rather than the immediate utility
targeted here.

## Spec-Ready Gate Decision

**Decision: spec-ready.** Primary hardware/manual evidence, independent workflow
observations, historical context, interpolation references, duplication risk,
the complete panel/voltage/timing contract, runtime persistence policy,
allocation-bounded DSP plan, explicit assumptions, collision rules, and exact
test targets are closed for implementation. No source or architecture blocker
remains.

The coordinator owns the separate `research/module-queue.md` transition. This
research branch intentionally does not edit the queue board and does not contain
module code or tests.
