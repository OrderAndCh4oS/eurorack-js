# Shimmer Reverb — Research and Specification

**Status:** spec-ready
**Module ID:** `shimmer`
**Working model:** stereo pitch-feedback reverb; inspired utility adaptation

## Scope

Shimmer is a standalone stereo effect that combines a dense algorithmic reverb
with a continuously operating pitch shifter. It can place the shifted signal at
the reverb input for one stable harmony, or inside the regenerating tank for the
classic rising or falling harmonic cloud. It exposes interval, shimmer level,
decay, damping, diffusion, pre-delay, size, modulation, mix, freeze, and clear
as direct performance controls.

The candidate survives intake only with that complete signal path:

- `verb` is a compact Freeverb-style stereo reverb with Time, Damp, Mix, and
  Mix CV. It has no pitch shifter, feedback-routing choice, interval CV,
  diffusion, freeze, or clear workflow.
- `granulita` is a granular chord processor whose Verb control eventually adds
  a fixed, simple octave-like resampling overlay to its internal grain reverb.
  The shifted read is mixed after the comb/allpass output and is not written
  back into those reverb feedback buffers. It cannot serve as a transparent
  standalone reverb for arbitrary stereo audio, and it has no independent
  interval, route, damping, diffusion, freeze, or shimmer-level controls.
- Shimmer uses a richer eight-line feedback delay network (FDN), input
  diffusion, stable pitch-feedback normalization, anti-alias filtering, and a
  proper overlapping two-head pitch shifter. It is not a renamed VERB or an
  extraction of Granulita's current effect block.

If implementation is reduced to VERB plus a fixed octave tap, or to the current
Granulita shimmer buffer placed in a separate panel, this queue item should be
blocked and retired as duplicate scope.

The v1 boundary excludes dual independent Eventide-style pitch voices,
frequency-selective three-band feedback, multiple reverb algorithms, tempo
sync, presets, Karplus-Strong synthesis, spectral pitch shifting, reverse
grains, convolution, external send/return loops, and unbounded/infinite
internal gain. Those are real reference-product features, but they would turn a
focused module into a reverb workstation.

## Research Questions

1. Which routing actually defines shimmer, rather than merely adding a pitched
   wet layer after an ordinary reverb?
2. Which controls make a standalone shimmer materially deeper than VERB and
   Granulita's built-in path?
3. Which late-reverb network is dense and stable enough for recursive pitch
   feedback in an AudioWorklet?
4. Which pitch-shifting method offers acceptable latency, artifacts, and CPU at
   44.1, 48, and 96 kHz?
5. How should feedback, filtering, freeze, and output rails prevent a harmonic
   climb from becoming non-finite or dangerously loud?
6. Which commercial behavior is well documented, and which details remain
   proprietary implementation assumptions?

## Source Register

Sources are grouped by role. Manufacturer manuals and product documentation
carry the most weight for control and routing behavior. Original papers and
textbooks carry the algorithmic claims. Reviews and demos support observed
workflow and sound, not undocumented electrical or DSP facts.

### Primary product, manual, and historical sources

1. **“94 - Space: #9412 Shimmer,” Eventide H9000 documentation, Space
   algorithm originally released 2011; documentation copyright 2022.**
   [Official algorithm guide](https://cdn.eventideaudio.com/manuals/h9000/2.0/content/appendix/algorithms/94_Space.html),
   accessed 31 July 2026. Primary source for two independently tuned pitch
   shifters, post-reverb/pre-shift delay, pitch feedback, band-dependent decay,
   fourth/fifth/octave interval examples, stereo I/O, and distinct pitch versus
   pitch-plus-reverb freeze modes.
2. **“ShimmerVerb,” Eventide, current product page and user guide.**
   [Official product page](https://www.eventideaudio.com/plug-ins/shimmerverb/)
   and [official user guide PDF](https://downloads.eventide.com/audio/manuals/plug-ins/ShimmerVerb%2BUser%2BGuide.pdf),
   accessed 31 July 2026. Primary source for parallel pitch shifters on the
   reverb tail, feedback into the reverb input, perfect-interval and MicroPitch
   tuning, delayed pitch feedback, frequency-selective regeneration, freeze,
   and the manufacturer's statement that Eno/Lanois popularized the production
   technique.
3. **“StarLab Time-Warped Reverberator User Manual,” Strymon, revision A,
   9 November 2021.**
   [Official manual PDF](https://www.strymon.net/manuals/StarLab_UserManual_RevA.pdf),
   accessed 31 July 2026. Primary Eurorack source for stereo input/output,
   Sparse/Dense/Diffuse textures, `-1..+1` octave shimmer, half-step Interval
   CV over `+/-5 V`, `+/-5 V` Shimmer/Decay/Wet CV, REGEN versus input routing,
   high/low damping, internal modulation, Infinite, Clear, and rising-edge CV
   actions.
4. **“StarLab Experimental Reverb,” Strymon, current product and manufacturer
   audio-demo page.**
   [Official product page](https://www.strymon.net/product/starlab/), accessed
   31 July 2026. Primary demonstration record for CV-modulated fifth shimmer,
   continuously swept Interval CV, octave-down regeneration, input shimmer,
   frozen beds, dense/sparse/diffuse tails, and the interaction of excessive
   pitch content with damping.
5. **“BigSky User Manual,” Strymon, revision D.**
   [Official manual PDF](https://www.strymon.net/manuals/BigSky_UserManual_RevD.pdf),
   accessed 31 July 2026. Primary pedal comparison for two tunable shimmer
   voices and Amount/Mode control. It supports the dual-voice precedent; v1
   deliberately keeps one voice for bounded CPU and panel scope.
6. **“H910 Harmonizer Timeline” and “Flashback #4.2: H910 Harmonizer — The
   Product,” Eventide, historical retrospective published 2021.**
   [Official timeline](https://www.eventideaudio.com/timeline/) and
   [engineering history](https://www.eventideaudio.com/blog/50th-flashback-4-2-h910-harmonizer-the-product/),
   accessed 31 July 2026. Primary manufacturer history for the 1974 concept,
   1975 commercial H910, and the read-memory-at-a-different-rate basis of early
   real-time digital pitch change.
7. **“The History of AMS,” AMS Neve, current company history.**
   [Official history](https://www.ams-neve.com/our-story/ams-history/), accessed
   31 July 2026. Primary manufacturer context for the 1978 DMX 15-80 digital
   delay, later pitch-changing enhancement, and its central place in 1980s
   production. It does not by itself prove a particular shimmer routing.

### Historical and practitioner context

8. **“Eno/Lanois Shimmer Effect: Early Examples,” Sean Costello, Valhalla DSP,
   10 May 2010.**
   [Designer essay](https://valhalladsp.com/2010/05/10/enolanois-shimmer-effect-early-examples/),
   accessed 31 July 2026. Practitioner history locating octave-swelling reverb
   before U2's 1984 release, including *Apollo* (1983), and noting that not every
   early pitched-reverb example used the same global-feedback routing.
9. **“Eno/Lanois Shimmer Sound: How It Is Made,” Sean Costello, Valhalla DSP,
   11 May 2010.**
   [Designer analysis](https://valhalladsp.com/2010/05/11/enolanois-shimmer-sound-how-it-is-made/),
   accessed 31 July 2026. Technical-practitioner source for the common elements:
   pitch shifter, long/modulated reverb or delay, feedback, EQ, and delay time as
   controls over the harmonic swell.
10. **“1000 Years of Reverbs,” Sean Costello, AES presentation, 2015.**
    [Presentation PDF](https://valhalladsp.com/wp-content/uploads/2015/06/aes2015reverbpresentation.pdf),
    accessed 31 July 2026. Historical/technical summary describing shimmer as a
    reverb and pitch shifter in a feedback loop whose decay rises in pitch and
    harmonic richness.

### Reverberation and pitch-shifting DSP sources

11. **“Designing Multi-Channel Reverberators,” John Stautner and Miller
    Puckette, *Computer Music Journal* 6(1), 1982.**
    [Author-hosted paper PDF](https://www.ee.columbia.edu/~dpwe/papers/StautP82-reverb.pdf),
    accessed 31 July 2026. Original FDN reference for cross-coupled delay
    networks, feedback matrices, echo-density growth, computational shortcuts,
    and a sufficient stability condition based on a unitary matrix scaled below
    unity.
12. **“Digital Delay Networks for Designing Artificial Reverberators,”
    Jean-Marc Jot and Antoine Chaigne, AES Convention Paper 3030, February
    1991.**
    [AES record and abstract](https://secure.aes.org/forum/pubs/conventions/?elib=5663),
    accessed 31 July 2026. Authoritative source for unitary-feedback delay
    networks, decay control decoupled from topology, resonance control, and
    response compensation.
13. **“Effect Design, Part 1: Reverberator and Other Filters,” Jon Dattorro,
    *Journal of the Audio Engineering Society* 45(9), 1997.**
    [Paper PDF](https://freeverb3-vst.sourceforge.io/doc/EffectDesignPart1.pdf),
    accessed 31 July 2026. Original tutorial reference for input diffusion,
    modulated delay/allpass reverb tanks, damping, output taps, and practical
    implementation trade-offs.
14. **“Artificial Reverberation” and “FDN Reverberation,” Julius O. Smith III,
    *Physical Audio Signal Processing*, online edition.**
    [Artificial reverb chapter](https://www.dsprelated.com/freebooks/pasp/Artificial_Reverberation.html)
    and [FDN chapter](https://www.dsprelated.com/freebooks/pasp/FDN_Reverberation.html),
    accessed 31 July 2026. Authoritative synthesis of allpass/comb/FDN history,
    orthogonal feedback, delay-length and mode-density choices, frequency-
    dependent decay, and time variation to reduce ringing.
15. **“Pitch Shifting,” Miller Puckette, *The Theory and Technique of Electronic
    Music*, online edition, 2005.**
    [Online chapter](https://msp.ucsd.edu/techniques/v0.05/book-html/node105.html),
    accessed 31 July 2026. Authoritative time-domain construction using a
    variable delay ramp, a window to hide each reset, and a second read head
    180 degrees out of phase.
16. **`PitchShifter`, DaisySP, Electrosmith, source copyright 2020.**
    [MIT-licensed source](https://github.com/electro-smith/DaisySP/blob/master/Source/Effects/pitchshifter.h),
    accessed 31 July 2026. Open implementation reference for a fixed circular
    delay, two phase-offset moving taps, sinusoidal gains, semitone ratios, and
    the quality/latency effect of a roughly 30–100 ms shift window. The app plan
    is independently specified; no source is copied.
17. **“Plateau,” Dale Johnson / Valley Audio, current manual and source record.**
    [Author manual](https://valleyaudio.github.io/rack/plateau/index.html) and
    [VCV source/license record](https://library.vcvrack.com/Valley/Plateau),
    accessed 31 July 2026. Open Dattorro-derived implementation context for a
    modulated plate, pre-delay, diffusion, filtering, hold, clear, and pervasive
    CV. Plateau is GPL-3.0-or-later, so it is an architecture comparison only;
    implementation must not copy its code into this repository.
18. **“Valhalla Shimmer Notes” and “ValhallaShimmer: The Controls,” Sean
    Costello, product design notes, 2010 with later PDF compilation.**
    [Technical notes PDF](https://valhalladsp.com/shimmer/ValhallaShimmerNotes.pdf)
    and [control guide](https://valhalladsp.com/2010/11/27/valhallashimmer-the-controls/),
    accessed 31 July 2026. Primary source for that product's diffuse delay
    networks, feedback pitch modes, `-12..+12` semitone range, power-
    complementary wet/dry mixing, bright/dark filtering, and the deliberate use
    of pitch-shifter noise/grain as orchestral texture.

### Independent reviews and observed demonstrations

19. **“Review: Strymon StarLab,” AudioTechnology, 2022 product era.**
    [Independent review](https://www.audiotechnology.com/reviews/strymon-starlab),
    accessed 31 July 2026. Observes convincing stereo spatial depth, productive
    use of independently patched left/right sources and slow LFO modulation,
    and audible tape-speed-like pitch movement when reverb size changes.
20. **“StarLab — Strymon,” Waveform Magazine, 2022 product era.**
    [Independent review](https://waveformmagazine.com/waveform-reviews/starlab-strymon/),
    accessed 31 July 2026. Observes that routing and tone controls are powerful
    but interactive, that too much pitch/harmonic feedback easily overwhelms a
    patch, and that input versus regenerating shimmer is a musically meaningful
    distinction.
21. **“Eventide Space Reverb Pedal Review,” Premier Guitar, 2011.**
    [Independent review](https://www.premierguitar.com/gear/eventide-space-reverb-pedal-review),
    accessed 31 July 2026. Describes Shimmer as pitch shifting the reverb tail
    into a harmonized ambient effect and places it among Space's deliberately
    non-natural algorithms.
22. **“Eventide Space Multi-Effects Stompbox,” Tape Op Magazine, issue 87,
    2012.**
    [Independent studio review](https://tapeop.com/reviews/gear/87/space-multi-effects-stompbox),
    accessed 31 July 2026. Supports stereo studio use, strong sound quality,
    abundant control, and the trade-off that the deeper algorithms sometimes
    require the manual.
23. **“Strymon StarLab Eurorack — Reverb Review,” independent video by
    Penishead, 13 February 2022.**
    [Video demo](https://www.youtube.com/watch?v=ix_CfaGwRsE), accessed
    31 July 2026. Observational lane with indexed sections for Sparse, Dense,
    Diffuse, Shimmer/Glimmer, LFO, and patched CV. Settings are audible examples,
    not calibrated measurements.

### Local architecture and duplication sources

24. **Local `verb` and `granulita` definitions, research, and focused tests,
    revision inspected 31 July 2026.**
    [`verb` definition](../../src/js/modules/verb/index.js),
    [`verb` research](verb.md),
    [`granulita` definition](../../src/js/modules/granulita/index.js), and
    [`granulita` research](granulita.md). These are authoritative for the
    existing Freeverb topology, Granulita's fixed 100 ms resampling path,
    current panel contracts, voltage rails, and recent allocation/normalization
    remediation.
25. **Local architecture, authoring guide, and sound-engineering review,
    revision inspected 31 July 2026.**
    [Architecture](../../docs/architecture.md),
    [Creating Modules](../../docs/creating-modules.md), and
    [Sound Engineering Review](../sound-engineering-review.md). Authoritative
    for stable buffers, worklet ownership, cable-state mono normalization,
    bounded state, continuous audio rails, no per-sample allocation, strict
    sample-rate/block-size validation, and browser profiling guidance.

## Evidence Synthesis

### Shimmer is a feedback topology, not a brightness adjective

The classic defining route is reverb output through pitch shift and back into
the reverberator. Every traversal raises or lowers the material again, so an
octave-up setting can develop one-, two-, and higher-octave energy as the tail
decays. Eventide's Space documentation explicitly places the pitch path in
feedback and exposes post-reverb/pre-shift delay plus band-dependent feedback.
The Eventide product history and Valhalla technical accounts describe the same
core relationship even though the exact early studio chains varied.

A pitch shifter only after a reverb produces one translated layer, not a
cumulative climb. That can still sound attractive, but it is not sufficient for
this queue item. `REGEN` therefore places the pitch result in the FDN feedback;
`INPUT` places it before the tank for a stable single-harmony tail. The route
switch is normative acceptance behavior.

### Delay, diffusion, filtering, and modulation shape the swell

The pitch interval is only the most obvious parameter. Eventide describes a
delay between reverb and pitch shift as a growth/breathing control. StarLab,
Plateau, Dattorro, and Valhalla all expose or discuss pre-delay, diffusion,
reverb size, damping, and modulation because these determine whether a tail is
an obvious echo train, a metallic ring, or a slowly blooming cloud.

The app target therefore keeps one pitch voice but gives the surrounding
reverb independent Size, Diffusion, Pre-delay, Damp, and Mod controls. This is a
more useful distinction from the existing effects than adding Eventide's second
pitch voice while leaving the reverb primitive.

### Pitch-shifter artifacts are part of the sound and a design risk

Puckette's time-domain method resets a moving delay tap under an amplitude
window and overlaps a second tap to hide the reset. DaisySP demonstrates that
the method is practical in a small real-time DSP, while its fixed window makes
the central compromise visible: a longer window improves low-frequency
continuity but adds latency and slower grains; a shorter window reacts quickly
but increases modulation, splice, and metallic artifacts.

Valhalla's designer notes make an important perceptual point: noisy/granular
pitch artifacts can become an orchestral texture in a diffuse feedback loop.
They should not be falsely advertised as transparent, however. The v1 target
uses a fixed 80 ms window, two complementary raised-cosine heads, linear
fractional reads, and deterministic phases. It is intentionally smoother and
more stable than Granulita's single advancing read, but it will not match a
modern proprietary polyphonic spectral shifter on exposed dry transients.

### Recursive pitch needs explicit energy and bandwidth control

Stautner/Puckette and Jot establish the stable late-reverb starting point: a
unitary/orthogonal feedback matrix with attenuation below unity. A pitch
shifter is time-varying and not perfectly energy preserving, so simply adding
it on top of an already high feedback coefficient is unsafe. High-frequency
energy also reaches Nyquist quickly during upward regeneration.

The target uses an energy-normalized Hadamard matrix, per-line RT60 gains below
one, a convex blend between unshifted and pitch-shifted feedback, a fixed low
cut, damping filters, and a four-pole anti-alias prefilter before upward shift.
Freeze removes new input and pitch regeneration instead of allowing an
unbounded harmonic climb at unity gain.

### Modular interaction justifies a dedicated effect

StarLab's manual and demos show why panel and CV access matter: interval sweeps
create fleeting harmonies, shimmer and decay CV animate a static source, input
and regenerative routes behave differently, and Infinite/Clear turn a reverb
tail into a playable layer. Independent reviewers also warn that excessive
pitch feedback overwhelms the source quickly.

The app contract exposes the highest-value subset directly. Interval is
semitone-quantized across `-12..+12`, Shimmer/Decay/Damp/Mix accept bipolar CV,
Freeze accepts a level gate, and Clear accepts a trigger. There are no hidden
secondary functions or menu states.

## Duplication Risk and Intake Decision

| Existing module | Existing behavior | Required distinction in `shimmer` |
|---|---|---|
| `verb` | Eight parallel lowpass-feedback combs and four series allpasses per channel; Time, Damp, Mix, Mix CV; early reflections | Eight-line cross-coupled FDN, input diffusion, true pitch feedback, interval/route/size/pre-delay/mod controls, Freeze and Clear. |
| `granulita` | Arbitrary stereo input is first captured and grain-resynthesized into chords. A shared Verb knob adds reverb and, above halfway, a fixed fast-read shimmer overlay. | Transparent stereo dry/wet effect on any patched audio, without mandatory grains/chords; proper overlapping pitch shift; independent interval, amount, route, damping, diffusion, freeze, and decay. |
| `dly` / `tape` | Echo feedback and delay-time pitch motion, but no dense reverberant tank or fixed musical transposition in that tank | Diffuse FDN tail whose feedback is deliberately transposed by a quantized musical interval. |

**Intake decision: keep and specify.** A standalone, CV-addressable pitch-
feedback FDN is materially different. If the implementation cannot deliver the
REGEN harmonic ladder, INPUT/REGEN contrast, and artifact-controlled
overlapping shifter within worklet budget, mark the item `blocked`; do not ship
a simpler duplicate.

## App Panel Contract

### Metadata and UI

- **Module ID:** `shimmer`
- **Name:** `SHIMMER`
- **Category:** `effect`
- **Width:** 16 HP
- **Color:** `module-color-eight`
- **Renderer:** declarative UI with `socketLayout`; no custom renderer,
  telemetry, runtime-state hook, or module event.
- **Persistence:** controls persist in patch params. Reverb/pitch delay memory is
  runtime DSP state only and is deliberately not captured across worklet
  recreation; audio stop/start begins with an empty tail.

### Knobs

| Param | Label | Range/default | Mapping and effect |
|---|---|---|---|
| `decay` | DECAY | `0..1`, default `0.55` | Exponential `0.4..30 s` target RT60 before frequency damping. |
| `size` | SIZE | `0..1`, default `0.5` | Scales all FDN delays by `2^(size - 0.5)`, approximately `0.707..1.414`; live movement bends the resident tail. |
| `diffusion` | DIFF | `0..1`, default `0.75` | Maps the input allpass coefficient from `0` (distinct echoes) through `0.78` (dense smear). |
| `preDelay` | PRE | `0..1`, default `0.15` | Quadratic mapping `0.5 * preDelay^2` seconds, exactly `0..500 ms`. |
| `damp` | DAMP | `0..1`, default `0.35` | `0` bright to `1` dark; feedback lowpass cutoff maps exponentially from `18 kHz` down to `500 Hz`, also capped below Nyquist. |
| `modDepth` | MOD | `0..1`, default `0.25` | Fixed slow multi-phase FDN delay modulation, `0..1.25 ms` peak depth. |
| `interval` | INT | integer `-12..+12`, default `+12`, step `1` | Pitch feedback/input interval in semitones. `0` crossfades to a direct shifter bypass. |
| `shimmer` | SHIM | `0..1`, default `0.35` | Amount of pitched input or convex pitched feedback, depending on Route. |
| `mix` | MIX | `0..1`, default `0.35` | Power-complementary dry/wet mix; endpoints are exact dry and exact wet. |

### Switch and actions

| Param | Label | UI contract | Default | Behavior |
|---|---|---|---:|---|
| `route` | ROUTE | two-position switch, `0=INPUT`, `1=REGEN` | `1` | INPUT creates one stable shifted layer before the tank; REGEN recursively shifts the tail on each traversal. A 50 ms internal morph avoids a topology click. |
| `freeze` | FREEZE | toggle action | `0` | Holds the current unpitched tank, mutes new wet input and pitch regeneration, and leaves dry audio passing. |
| `clear` | CLEAR | trigger action | `0` | Fades and erases every delay/filter state without changing panel controls. It is transient and cannot replay from a loaded patch. |

Every parameter above appears in DSP `params` and the declarative UI with the
same default. No undocumented state parameter or secondary control is allowed.

### Inputs

| ID/port | Label | Signal | Voltage / normal | Contract |
|---|---|---|---|---|
| `inL` | IN L | `audio` | `-5..+5 V`, normal `0 V` | Left audio input and mono source. |
| `inR` | IN R | `audio` | `-5..+5 V`, normal `0 V` | Right input; when physically unpatched it normalizes from IN L using cable lifecycle state, never instantaneous sample amplitude. |
| `decayCV` | DECAY | `cv` | `-5..+5 V`, normal `0 V` | Adds `CV / 5` to the normalized Decay setting. |
| `dampCV` | DAMP | `cv` | `-5..+5 V`, normal `0 V` | Adds `CV / 5` to normalized damping; positive CV darkens. |
| `shimmerCV` | SHIM | `cv` | `-5..+5 V`, normal `0 V` | Adds `CV / 5` to shimmer amount. |
| `intervalCV` | INT | `cv` | `-5..+5 V`, normal `0 V` | Adds `CV * 12 / 5` semitones, rounds to the nearest semitone, then clamps the combined interval to `-12..+12`. |
| `mixCV` | MIX | `cv` | `-5..+5 V`, normal `0 V` | Adds `CV / 5` to normalized Mix. |
| `freezeGate` | FREEZE | `gate` | `0..10 V`, normal `0 V` | Momentary level override: effective Freeze is panel toggle OR input `>=1 V`; release returns to the panel state. |
| `clearTrig` | CLEAR | `trigger` | `0..10 V`, normal `0 V` | Rising edge at `>=1 V` invokes the same clear command as the panel action. Held high does not repeat. |

All normalized CV sums clamp to `0..1`. Non-finite CV becomes `0 V` before
mapping. A simultaneous panel and jack Clear edge produces one clear request.

### Outputs

| ID/port | Label | Signal | Voltage | Contract |
|---|---|---|---|---|
| `outL` | OUT L | `audio` | `-5..+5 V` | Power-mixed, continuously soft-limited left output. |
| `outR` | OUT R | `audio` | `-5..+5 V` | Power-mixed, continuously soft-limited right output. |

### LEDs

| LED | Meaning |
|---|---|
| `input` | Smoothed input peak, normalized to `0..1`. |
| `tail` | Smoothed wet-tail energy, normalized to `0..1`. |
| `pitched` | Effective Shimmer amount multiplied by bounded pitch-path activity. |
| `frozen` | `1` while panel or gate Freeze is effective, otherwise `0`. |

All LED values remain finite in `0..1`. No waveform, history, or spectrum is
sent to the main thread.

## Voltage, Timing, and Control Contract

### Audio and overload

- Finite IN L/IN R samples within `-5..+5 V` enter linearly. Finite overload is
  smoothly limited before tank injection; non-finite input becomes `0 V`.
- Mix `0` is exact dry audio before the continuous external `+/-5 V` rail;
  Mix `1` is exact wet audio before that rail. Intermediate gains are
  `cos(mix * pi / 2)` and `sin(mix * pi / 2)`.
- Both outputs use the shared continuous `softLimitVoltage(..., 5)` policy.
  Internal ordinary operation is linear; a documented last-resort `+/-20 V`
  finite write guard contains pathological recursive state without defining the
  normal sound.
- Patched stereo silence remains silence in that channel. Only the physical
  absence of IN R invokes mono normalization.
- A non-finite panel parameter uses its declared default. A non-finite CV or
  audio sample uses `0 V`; the recursive state never receives NaN or Infinity.

### CV, gates, and actions

- Decay, Damp, Shimmer, and Mix CV are sampled per audio sample and use the
  additive bipolar mappings in the input table.
- Interval uses a fixed 25-entry semitone-ratio table for `-12..+12`; CV is
  rounded before lookup. There is no per-sample exponential calculation.
- Freeze is a level at `>=1 V`; `0.999 V` is low. Clear is a rising edge at
  `>=1 V`; its history updates after edge detection.
- Clear wins a same-sample Clear/Freeze transition. The persisted Freeze toggle
  is not rewritten by DSP; clearing while Freeze remains high leaves an empty
  frozen tank until Freeze is released.

### Control smoothing

All time constants are physical and sample-rate invariant:

- Mix: `5 ms`;
- Damp: `10 ms`;
- Decay and Shimmer: `20 ms`;
- Diffusion, interval ratio, and pre-delay: `30 ms`;
- Route and Mod depth: `50 ms`;
- Size: `100 ms`.

`reset()` initializes every smoother directly to its current parameter default
so the first block does not fade from an unrelated value. Rapid Size or
Pre-delay changes intentionally create a bounded Doppler/glide character rather
than a discontinuous pointer jump; the behavior is documented, not advertised
as transparent automation.

### Latency and clear timing

- Dry latency is zero samples.
- Wet onset includes selected `0..500 ms` pre-delay plus diffuser/tank delay.
- Pitched material uses an 80 ms moving-delay window and therefore blooms later
  than the unshifted wet path. Exact latency is signal- and interval-dependent;
  the module makes no zero-latency pitch claim.
- Clear ramps wet gain to zero over exactly `5 ms`, bulk-clears fixed buffers at
  the next process-block boundary, and ramps the empty wet path back over
  `5 ms`. Dry audio continues. At a 512-sample block, completion is therefore
  bounded by `10 ms + one block`.

## DSP Model

This is an inspired utility adaptation. Commercial Eventide and Strymon
algorithms are proprietary, and their exact pitch detectors, interpolation,
modulation, diffusion, filter slopes, and feedback normalization are unknown.
The app instead uses published FDN/allpass principles and an independently
specified time-domain pitch shifter.

### Signal flow

```text
IN L/R -> finite guard -> pre-delay -> stereo input diffusers -> injection
                                                        |          |
                                                        |          v
                                                        |      8-line FDN
                                                        |          |
                                                        |       wet L/R
                                                        |          |
                                                        +-> pitch shifter
                                                            | INPUT: injection
                                                            + REGEN: FDN feedback

dry L/R -------------------------------------------------> power mix -> soft rail
```

### Input diffusion and pre-delay

- Pre-delay uses two fixed circular `Float32Array` buffers sized for 500 ms at
  construction and allocation-free linear fractional readers.
- Each channel then passes through four first-order Schroeder allpass sections.
  Left delays are `[4.3, 6.1, 8.9, 12.7] ms`; right delays are
  `[4.9, 6.7, 9.7, 13.7] ms`, so identical mono input does not produce identical
  late state.
- The allpass coefficient is `0..0.78`. At exactly zero, the stage is a direct
  delay path rather than an unstable or denormal special case.
- Left/right diffuser results enter normalized Hadamard rows 0 and 4. REGEN
  pitch returns use rows 3 and 5, while wet L/R are read with rows 1 and 2.
  These six exact orthogonal signed vectors retain stereo separation and bound
  the energy of every injection/output projection. Rows use the Sylvester H8
  ordering and each coefficient is `+/-1/sqrt(8)`.

### Eight-line FDN tank

- Nominal line delays are `[29.7, 33.1, 37.9, 41.3, 43.7, 47.9, 53.3,
  59.9] ms`, multiplied by the smoothed Size scale
  `2^(size - 0.5)` and offset by bounded modulation.
- Every line allocates once for its maximum `1.414` size plus `1.25 ms`
  modulation at the construction sample rate. Fractional reads use pre-created
  linear circular readers.
- Feedback mixing is an 8x8 normalized Hadamard transform implemented as three
  in-place butterfly stages and one `1/sqrt(8)` scale. No matrix, vector, or
  callback allocation occurs in `process()`.
- The line lengths are deliberately unequal to spread modes. They are local
  musical choices, not measurements from Eventide, Strymon, or a physical room.
- Eight fixed low-rate sine phases modulate line lengths at
  `[0.071, 0.089, 0.113, 0.137, 0.163, 0.191, 0.223, 0.257] Hz`, starting at
  phase offsets `i / 8`. A precomputed 2048-entry sine table and linear lookup
  avoid eight `Math.sin` calls per sample. Time variation suppresses static
  ringing; Mod zero is exactly stationary.
- Stereo wet outputs use the exact normalized Hadamard rows declared above,
  rather than implementation-selected tap signs.

### Decay and damping

Decay maps to target `RT60 = 0.4 * 75^decay` seconds. Each line's low-frequency
gain is calculated from its current delay duration:

```text
g_i = 10 ^ (-3 * delaySeconds_i / RT60)
```

This keeps the approximate decay time independent of sample rate and FDN line
length. Normal operation always has `g_i < 1`.

Each feedback line has:

1. a fixed one-pole `80 Hz` highpass/DC blocker to prevent DC and sub-octave
   accumulation;
2. a one-pole lowpass whose cutoff follows Damp from `18 kHz` to `500 Hz` and
   never exceeds `0.45 * sampleRate`;
3. the per-line RT60 attenuation.

Filter state is finite-guarded and values below `1e-20` are flushed to zero.
Changing Damp changes high-frequency decay as in the hardware references; it is
not a post-output EQ.

### Time-domain pitch shifter

One stereo pitch voice uses the Puckette/Daisy class of moving-delay shifter:

- two 80 ms read ramps per channel, offset by half a cycle;
- pitch ratio `r = 2^(semitones / 12)` from a fixed semitone table;
- signed delay slope `1 - r`: the phasor direction is `sign(1 - r)` and its
  magnitude is `abs(r - 1) / 0.08` Hz;
- minimum read delay `2 ms` so a tap never collides with the write head;
- complementary raised-cosine windows
  `w0 = 0.5 - 0.5*cos(2*pi*phase)` and `w1 = 1 - w0`;
- allocation-free linear fractional reads from fixed stereo buffers;
- deterministic state and no random splice search.

The nonnegative windows sum to one, bounding the crossfade peak at the expense
of some coloration when the heads contain poorly correlated material. Near
unison, a 30 ms crossfade selects direct bypass so a stalled phasor cannot turn
Interval zero into a static comb filter. The same precomputed periodic table
used for tank modulation supplies the pitch windows, so `process()` performs no
trigonometric call. The implementation also derives equal-power Mix gains and
one-pole cosine coefficients from that table. Linear interpolation keeps the
worst supported-rate coefficient error below 0.5% (about 7.2 cents of cutoff at
the most sensitive 96 kHz upward-shift extreme) without another table or any
audio-rate allocation; exact Mix endpoints remain explicit.

Before upward shift, four cascaded one-pole lowpasses use
`min(dampCutoff, 0.45 * sampleRate / r)` as their target cutoff. This cannot make
the simple shifter alias-free, but it materially reduces content that would
cross Nyquist after transposition. Downshift keeps the Damp cutoff. Interval,
filter, and bypass transitions are smoothed.

### INPUT and REGEN routing

Let `s` be smoothed Shimmer amount and `q` be the smoothed Route morph from
`0=INPUT` to `1=REGEN`.

- The pitch-shifter source is the convex blend
  `(1-q) * diffusedInput + q * wetTank`.
- INPUT contribution is mixed into the ordinary input as
  `(input + s*(1-q)*pitched) / (1 + s*(1-q))`. It enters the tank once, so a
  held note creates one stable interval rather than an endless pitch ladder.
- REGEN feedback is the convex blend
  `(1-s*q) * unshiftedFeedback + (s*q) * pitchedFeedback`, followed by the
  per-line decay gains. Pitched stereo is distributed through normalized
  orthogonal vectors.

The convex construction is normative. It replaces, rather than adds on top of,
part of the ordinary feedback and therefore does not let Shimmer amount silently
raise loop gain above the selected decay. With `s=0`, both routes are the same
ordinary FDN reverb. With `q=1` and `s>0`, repeated traversals create the
measurable harmonic climb that distinguishes the module.

### Freeze, clear, and reset

Effective Freeze:

- uses one 10 ms state morph that ramps new wet injection and pitch
  regeneration to zero while dry audio remains live;
- captures each current modulated FDN length, morphs it by at most half a
  sample to the nearest integer length, and then holds it; exact integer reads
  avoid cumulative loss from fractional linear interpolation;
- morphs damping and per-line RT60 attenuation to identity, leaving the
  Hadamard tank at its lossless unity prototype;
- retains finite guards and the internal emergency rail.

On release, the same 10 ms state morph restores the live fractional lengths,
modulation, damping, decay gains, pitch route, and input. The sub-sample length
snap can make a small timbral bend, but it prevents a frozen tail from fading
rapidly and must not click or grow. The acceptance target is a stable held
cloud, not mathematically bit-identical memory.

CLEAR follows the timed fade/bulk-clear/fade sequence above and resets every
FDN, diffuser, pre-delay, pitch, filter, phasor, edge, and LED signal state.
Control smoothers reset directly to their current sanitized targets, so Clear
does not create a hidden jump back to defaults. `reset()` clears the same state
immediately and deterministically, restores every stable input/output buffer in
place, and likewise initializes helpers from current sanitized params and
declared input normals. Neither operation allocates, mutates persisted controls,
or replaces a port buffer.

### Worklet CPU and memory budget

At construction, allocate only:

- two 500 ms pre-delay buffers;
- eight FDN buffers sized for maximum Size/modulation;
- eight short input-diffuser buffers;
- two pitch buffers sized for 82 ms;
- stable block input/output arrays, a 2048-sample sine table, the 25-entry ratio
  table, and scalar filter/phase/control state.

The estimated fixed delay memory stays below 1 MiB at 96 kHz. `process()` uses
no `map`, `filter`, `reduce`, object/array construction, closures, buffer slices,
FFT, DOM, timers, events, or telemetry. The single pitch voice is a deliberate
CPU decision; a second voice approximately doubles its interpolated reads and
filter work.

The implementation must run the full 44.1/48/96 kHz by 128/512 strict matrix.
Node timing remains advisory. A representative browser AudioWorklet profile
should be investigated if one Shimmer instance exceeds 50% of the render
deadline at p95, following the repository sound-engineering guidance; no
machine-specific timing number becomes a brittle unit-test threshold.

## Expected Sound and Observed Behavior

- INPUT at `+12` should sound like an octave-harmonized source entering one
  dense tail. It must not keep climbing after the input stops.
- REGEN at `+12` should reveal successively higher octave energy, with damping
  naturally removing the highest generations. `+7` builds stacked fifths;
  negative intervals build darker descending clouds.
- Low Diffusion exposes discrete, rhythm-like FDN returns; high Diffusion
  smears attacks into the slow bloom associated with ambient shimmer.
- Higher Damp shortens the bright climb and prevents the piercing buildup that
  independent reviews warn is easy to overuse.
- Mod adds slow width and suppresses metallic stationary modes. At high values
  it is intentionally chorused rather than realistic.
- Pitch-shifter grains are least exposed inside a diffuse wet tail. Percussive
  input, low Diffusion, full Shimmer, and short Pre-delay form the worst-case
  artifact setting and belong in listening and click tests.
- Size motion bends the resident tail. This is a creative digital-reverb
  behavior observed in StarLab reviews, not a transparent room-size morph.

## Assumptions, Contradictions, and Source Weighting

- Historical accounts agree on Eno/Lanois popularization but differ on the
  exact first recording, exact reverb, and whether every early example used a
  global feedback loop. The document says “popularized,” not “invented,” and
  treats Eventide/Valhalla history as informed but not conclusive provenance.
- Eventide Space uses dual pitch shifters and up to two octaves; StarLab and
  Valhalla foreground a one-octave range; Granulita is effectively fixed upward.
  V1 chooses one `-12..+12` semitone voice because it preserves the classic
  octave/fifth/down-octave vocabulary with bounded CPU.
- Eventide's dedicated Shimmer is feedback-centered, while StarLab explicitly
  supports input and regenerative placement. V1 adopts both StarLab routes
  because their contrast is central to avoiding duplicate scope.
- Eventide, Strymon, and Valhalla algorithms are proprietary. No cited source
  proves their tank topology, shifter window, interpolation, or loop
  normalization. The eight-line Hadamard FDN and exact moving-delay equations
  are local, testable design choices.
- Dattorro's plate and Plateau are strong open reverb comparisons, but the app
  chooses a Stautner/Jot-style eight-line FDN rather than claiming a Dattorro
  clone. Plateau's GPL source must not be copied.
- Commercial pitch shifters range from early glitching hardware to modern
  polyphonic spectral systems. The chosen time-domain shifter trades transparent
  transients and formant preservation for low fixed memory, bounded latency,
  deterministic worklet CPU, and musically useful grain texture.
- StarLab documents `+/-5 V` CV and a `-1..+1` octave interval. The app follows
  those practical ranges but uses repository gate threshold `>=1 V` and audio
  rails `+/-5 V`; it does not emulate StarLab converters or calibration.
- FDN delays, 80 ms pitch window, `0.4..30 s` RT60, 80 Hz low cut, four-pole
  pre-shift filter, smoothing times, internal 20 V guard, and 16 HP panel are app
  decisions, not manufacturer measurements.
- Freeze definitions conflict: Eventide offers pitch-only and total freeze;
  StarLab Infinite allows further input behavior. V1 uses one safe total-tail
  freeze that stops new wet input and pitch climb while leaving dry passthrough.
- Reviews support workflow and subjective character only. Manufacturer audio
  demos are promotional. Papers support generic DSP principles, not fidelity
  to a named commercial algorithm.

No open question changes the panel or DSP contract. A listening pass may tune
the fixed FDN delay list and wet-output vectors only if objective timing,
stability, stereo, and regression tests remain unchanged and the final values
are recorded here before merge.

## Test Targets

1. **Metadata/schema:** exact ID/name/category, 16 HP, valid color, nine knobs,
   one switch, two actions, nine inputs, two outputs, four LEDs, no telemetry,
   and matching UI/DSP defaults.
2. **Initialization:** all port buffers are `Float32Array` of requested block
   size; every input normal is exact; all fixed delay buffers/tables exist at
   bounded sizes for 44.1, 48, and 96 kHz.
3. **Stable buffers:** input and output identities survive processing, mono/
   stereo connection changes, every control extreme, Clear, Freeze, reset, and
   long randomized runs.
4. **Complete writes:** every output sample is overwritten on every call,
   including silent, clearing, frozen, and non-finite-input states.
5. **Dry endpoint:** Mix zero reproduces finite stereo input below the output
   limiter knee sample for sample with zero latency and no wet leakage; values
   above the knee follow the shared limiter exactly.
6. **Mono normalization:** unpatched IN R follows IN L; physically patched
   right silence remains silence through zero crossings; disconnect restores
   mono behavior without replacing buffers.
7. **Audio rails:** normal signals remain linear below the documented knees;
   overload approaches but never exceeds `+/-5 V`; all non-finite input becomes
   finite output.
8. **Mix law:** min/default/max and `mixCV=-5/0/+5 V` match the exact
   power-complementary equation after smoothing; rapid modulation has bounded
   adjacent-sample jumps.
9. **Pre-delay:** an isolated helper/delta-onset test measures `0` and `500 ms`;
   intermediate quadratic mapping remains within one sample across sample
   rates, independent of the later diffuser/tank onset.
10. **Decay:** impulse energy estimates approximately `0.4 s` and `30 s` RT60
    endpoints within a documented tolerance; default and CV extremes order
    correctly and remain sample-rate invariant.
11. **FDN stability:** a lossless-matrix helper/golden test verifies Hadamard
    energy preservation; every non-frozen per-line gain remains below one.
12. **Echo density:** high Diffusion produces materially more occupied late
    impulse-response windows than Diffusion zero while preserving finite output,
    bounded gain, and rails.
13. **Size:** endpoints produce the exact `0.707/1.414` delay scales; a live
    change glides without a pointer discontinuity and returns to deterministic
    timing after settling.
14. **Damp:** Damp zero versus one measurably reduces high-band late-tail energy
    while retaining low-band decay order; `dampCV` spans and clamps the range.
15. **Mod:** zero is bit-deterministic and stationary; nonzero Mod changes late
    correlation/mode pattern, stays bounded, and has physical rate/depth
    invariance across sample rates.
16. **Shimmer bypass:** Shimmer zero makes INPUT and REGEN output-identical for
    identical starting state and never leaks stale pitch-buffer content.
17. **Pitch ratios:** isolated pitch-path tests measure `-12`, `+7`, and `+12`
    semitone sine ratios within a defined spectral tolerance after latency;
    Interval zero settles to direct bypass.
18. **Interval CV:** `-5/0/+5 V`, rounding boundaries, knob offsets, rail
    clamps, held values, and non-finite recovery select exact table entries.
19. **Pitch continuity:** each head reset occurs under a zero window; a steady
    sine at every supported interval has no full-scale splice and preserves
    finite bounded output through phase wrap.
20. **Up-shift anti-alias filter:** at `+12`, a fixed upper-stopband test tone
    near `0.4 * sampleRate` is at least 18 dB lower at the pitch-shifter input
    than the same unfiltered path; cutoff follows sample rate and Damp.
21. **INPUT route:** a stopped source produces one shifted spectral family but
    no successive octave/fifth ladder above the chosen interval.
22. **REGEN route:** an impulse or low sine with `+12` produces later energy near
    successive octaves; `+7` produces successive fifth-related bands; both
    decay and remain below rails.
23. **Route distinction:** otherwise identical INPUT and REGEN renders differ
    in late harmonic evolution, locking the candidate's non-duplication gate.
24. **Route morph:** switching during a tail completes over 50 ms, preserves
    state, and does not exceed the documented adjacent-sample jump tolerance.
25. **Shimmer amount/CV:** zero/default/full and CV extrema change pitch-path
    energy monotonically without raising normalized feedback gain above the
    selected decay gain.
26. **Worst-case artifact render:** percussive stereo input at low Diffusion,
    full Shimmer, short Pre-delay, and each interval stays finite, contains no
    isolated full-scale click, and is saved as an optional listening fixture.
27. **Freeze threshold:** `0.999 V` is low and `1.0 V` high; panel OR gate logic,
    gate release, and panel persistence are exact.
28. **Freeze behavior:** new audio does not enter wet state, dry continues,
    pitch climb stops, and held-tail RMS neither grows nor falls more than 3 dB
    over five seconds after the transition settles.
29. **Clear edge:** one rising edge clears once, held high does not repeat,
    panel+jack coincidence clears once, and completion is bounded by 10 ms plus
    one process block.
30. **Clear priority:** Clear during Freeze, active route morph, interval glide,
    and overload leaves every delay/filter/pitch state empty and every output
    finite; persisted controls remain unchanged.
31. **Reset:** immediately clears all buffers, filters, phases, edge histories,
    smoothers, outputs, and LEDs in place; the next default impulse render is
    identical to a fresh DSP instance.
32. **Parameter finite guards:** NaN/Infinity in every param or CV has a declared
    finite fallback and cannot poison recursive state.
33. **Long-run stability:** maximum Decay/Shimmer, bright Damp, both routes,
    both interval signs, Size/Mod extremes, Freeze transitions, and repeated
    impulses remain finite and within output contract for at least 30 seconds.
34. **Denormal/idle behavior:** a decayed silent tail flushes tiny scalar and
    buffer writes to zero and does not retain a nonzero Tail LED indefinitely.
35. **LEDs:** Input, Tail, Pitched, and Frozen each follow their exact state,
    remain finite in `0..1`, and reset to zero.
36. **Determinism:** identical audio/CV streams yield identical samples
    independent of block segmentation at a fixed sample rate. Clear may differ
    only until its documented next-block bulk erase; aligned renders are
    identical again after both Clear fades complete.
37. **Allocation safety:** `process()` performs no object/array creation or
    array combinator allocation; explicit Clear uses only pre-existing typed
    arrays and its rare bulk fill is profiled at 96 kHz.
38. **Strict matrix:** every supported sample-rate/block-size combination passes
    finite output, stable identity, voltage, reset, and control scenarios under
    `audit:dsp --matrix --strict-voltage`.
39. **AudioWorklet integration:** stereo routing, connection-state mono normal,
    CV modulation, transient Clear defaults, and topology recreation behave in
    production ownership; restart begins with an empty tail.
40. **Duplication acceptance:** a browser/factory test processes an arbitrary
    external stereo source directly, demonstrates INPUT versus REGEN late
    spectra, and does not instantiate Granulita's grain/chord engine or reuse
    VERB's three-control contract.

## Implementation Plan

- **Module ID/category:** `shimmer`, `effect`.
- **Implementation branch/worktree:** `module/shimmer` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/shimmer-module`.
- **DSP model:** inspired stereo reverb using four input allpasses per channel,
  one eight-line modulated Hadamard FDN, one stereo two-head 80 ms time-domain
  pitch shifter, INPUT/REGEN routing, frequency-dependent RT60, anti-alias
  filtering, power-complementary mix, bounded Freeze, and Clear.
- **Params:** knobs `decay`, `size`, `diffusion`, `preDelay`, `damp`,
  `modDepth`, `interval`, `shimmer`, `mix`; switch `route`; actions `freeze`,
  `clear`.
- **Inputs:** `inL`, `inR`, `decayCV`, `dampCV`, `shimmerCV`, `intervalCV`,
  `mixCV`, `freezeGate`, `clearTrig`.
- **Outputs:** `outL`, `outR`.
- **LEDs:** `input`, `tail`, `pitched`, `frozen`.
- **UI:** declarative 16 HP panel with grouped SPACE, PITCH, MIX, and stereo I/O
  sections; no custom renderer or telemetry.
- **Utilities:** use existing `createLinearCircularReader`, `createSlew` where
  its exact RC contract fits, and `softLimitVoltage` for external rails. Keep
  FDN, allpass, pitch-head, Hadamard, and filter state module-local. Do not copy
  GPL Plateau code or introduce a shared primitive without a separately tested
  framework decision.
- **Tests first:** add `tests/dsp/shimmer.test.js` before module code. Include
  pure/golden tests for Hadamard energy and interval tables plus black-box
  impulse, spectrum, artifact, CV, freeze, clear, rail, allocation, and reset
  coverage.
- **Factory patch:** add `Test - Shimmer` in
  `src/js/config/patches/test-shimmer.js`. Use a simple external melodic or
  percussive stereo-capable source, route Shimmer to OUT and a visual analyzer,
  and set a clear REGEN octave default. Inspect all actual source/analyzer/out
  port definitions during implementation rather than guessing cable names.
- **Registration:** add matching manifest and static core-definition entries,
  preserve sequential aliases/order, and bump the same core graph revision in
  `worklet-engine.js`, `processor.js`, and `core-plugin.js`.
- **Documentation:** add SHIMMER to AGENTS/README and link this record from the
  research index. Update the authoring guide only if implementation produces a
  genuinely reusable tested pattern.
- **Shared framework changes:** none planned. Current stable buffers, cable
  lifecycle state, declarative actions, CV contracts, and worklet profiling are
  sufficient.
- **Focused validation:**
  `npm test -- tests/dsp/shimmer.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- **Factory validation:**
  `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- **DSP audit:**
  `npm run audit:dsp -- --module shimmer --matrix --strict-voltage`
- **Browser validation:** profile a one-Shimmer patch and the factory patch in
  Chromium AudioWorklet; listen to impulse, sustained chord, bass, and
  percussion material in INPUT/REGEN, +/- octave, freeze, and worst-artifact
  settings.
- **Full validation:** `npm test`.
- **Known assumptions:** one pitch voice, 16 HP, `+/-5 V` audio/CV, semitone
  interval over `-12..+12`, 80 ms shift window, exact delay/filter lists above,
  `0.4..30 s` RT60, total-tail Freeze, runtime-ephemeral tail, and no dual voice,
  spectral shifter, tempo sync, preset, or multi-algorithm engine.

## Deferred Scope

- dual independently tuned/panned pitch voices and MicroPitch detune;
- multi-band low/mid/high pitch feedback and crossover controls;
- reverse pitch grains, autocorrelation/deglitch splice search, phase vocoder,
  formant preservation, or transient-aware polyphonic shifting;
- multiple Sparse/Dense/Diffuse/plate/hall algorithms;
- tempo-synced pre-pitch delay or external clock;
- Karplus-Strong, resonant Glimmer, post-reverb resonant filters, drive, or
  convolution;
- patch-persisted tails, spillover between patch presets, favorites, or undo;
- external feedback send/return and dangerous gain-above-unity modes.

These may be valuable later, but none is required to prove a distinct,
high-quality standalone pitch-feedback reverb.

## DSP Audit (2026-07-31)

- **Focused coverage:** `tests/dsp/shimmer.test.js` has 23 tests for
  schema/defaults, fixed memory, normalized-Hadamard energy, exact interval
  ratios, measured `-12/+7/+12` pitch translation, upward-shift filtering,
  every knob/CV mapping, Diffusion/Mod response, LEDs, connection-state stereo
  normalization, continuous rails, the REGEN octave ladder, Freeze loss and
  wet-input rejection, exact Clear timing/priority/complete-state reset,
  deterministic block segmentation, reset, and 30-second recursive stability.
- **Measured status:** the strict 44.1/48/96 kHz by 128/512-sample matrix
  completes 23 scenarios per configuration with finite stable buffers, zero
  processing errors, zero voltage-contract flags, a 4.926 V observed peak, and
  a maximum advisory Node diagnostic time of 1.5288 ms per block. The focused,
  contract, patch-format, and runtime-ownership gate passes 114 tests.
- **Memory and stability:** the 96 kHz fixed delay allocation remains below the
  specified 1 MiB cap. Five-second frozen-tail tests remain within the `+/-3 dB`
  target after integer-delay settling, and 30-second maximum-feedback renders
  remain finite inside the continuous external `+/-5 V` rails. The factory
  patch feeds matched INPUT and REGEN instances from a clocked stereo source
  and exposes their late spectra side by side while playing REGEN in stereo.
- **Licensing decision:** the implementation follows the independently stated
  Stautner/Jot normalized-FDN and Puckette moving-delay equations in this
  record. No Plateau GPL source or proprietary commercial algorithm was copied.
- **Review and repository status:** independent DSP/contract review found no
  remaining Shimmer blocker. The full suite passes 2,243 of 2,244 tests; its
  sole failure is the pre-existing audit-index mismatch for the concurrently
  documented but unregistered `pitch-track` and `vocoder` queue items. No
  browser listening session was performed; the advisory timings did not cross
  the documented threshold that requires a browser AudioWorklet profile.

## Spec-Ready Gate Decision

**Decision: spec-ready.** The research has primary Eventide and Strymon
manual/product evidence, independent review/demo observations, historical
context, original FDN/allpass/pitch references, open implementation comparisons,
source-quality notes, a complete panel and voltage contract, a stable artifact-
and CPU-aware worklet plan, explicit assumptions, exact test targets, and an
implementation plan. No source or architecture blocker remains.

The coordinator owns the separate `research/module-queue.md` transition. This
research branch intentionally does not edit the queue board and contains no
module implementation or tests.
