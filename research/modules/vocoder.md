# Filter-Bank Vocoder (vocoder)

## Research Status

- Queue item: `vocoder` / Filter-Bank Vocoder.
- Research branch/worktree: `research/vocoder` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/vocoder-research`.
- This document closes the research gate only. It does not authorize or contain
  module implementation, tests, registration, factory-patch, or queue changes.
- Intended queue result after coordinator review: `spec-ready`.
- Model choice: an inspired-by, mono channel-vocoder utility. It takes an
  external modulator and an external carrier, transfers a fixed 12-band spectral
  envelope, and offers envelope-index shift plus direct high-frequency
  sibilance. It is not a clone of one hardware panel.
- First-version scope is deliberately fixed. It has no microphone preamp,
  internal oscillator/noise source, per-band sockets or faders, freeze,
  voiced/unvoiced detector, stereo mode, FFT/phase-vocoder path, or custom UI.

## Why This Module Exists

A channel vocoder answers a different musical question from the two nearby
modules already in the rack:

- [`formant`](formant.md) has one audio input and imposes four predetermined,
  moving vowel resonances. It does not measure a second signal. `vocoder` has
  simultaneous modulator and carrier inputs; its 12 time-varying analysis
  envelopes determine the carrier spectrum. Vocoder `shift` remaps envelope
  addresses between fixed bands. It does not move the filter frequencies or
  interpolate the Formant module's vowel table.
- [`resbank`](resbank.md) is a pitched modal/string resonator. An excitation or
  trigger deposits energy into ringing voices with musically long state.
  `vocoder` has no pitch, trigger, voice allocation, or resonant tail. Its only
  intentional memory is filter state, 1-50 ms attack, and 20-500 ms release.
- [`envf`](envf.md) exposes one broadband amplitude contour as CV. `vocoder`
  embeds 12 independent followers whose values remain internal and control a
  matching synthesis bank.

The missing capability is therefore not another vocal-colored filter. It is
cross-synthesis: rhythm, articulation, and spectral motion from one input can
animate the pitch and harmonic material of another.

## Historical And Hardware Evidence

### Dudley's Speech Encoder

Homer Dudley's 1939 Bell Laboratories account describes the vocoder as an
analyzer/synthesizer communications system. The analyzer reduced speech to
slowly varying control information; a receiving synthesizer reconstructed
speech from controlled buzz and hiss sources. This is the historical basis for
separating an information-bearing modulator from a pitch-bearing excitation.
The queued module is a musical descendant of that channel model, not an attempt
to emulate the telecommunications codec or the manually played Voder.

### Doepfer A-129 Modular Vocoder

The official A-129/1 and A-129/2 manual gives the clearest modular signal-flow
contract:

1. Speech enters a parallel analysis bank.
2. Each filter feeds an envelope follower.
3. A second input, called the instrumental signal, enters matching synthesis
   filters.
4. Each analysis envelope controls the corresponding synthesis-band VCA.
5. The resulting bands are summed while the carrier retains its pitch.

The A-129 uses 15 channels: a low-pass channel around 100 Hz, 13 band-pass
channels with nominal frequencies 120, 160, 230, 330, 500, 750, 1100, 1300,
1600, 2300, 3300, 5000, and 7500 Hz, and a high-pass channel around 10 kHz. Its
manual recommends clear, steady speech and a harmonically rich carrier such as
a sawtooth. It describes triangle and sine carriers as unsuitable for clear
speech, while noise, digital spectra, and modulated sources are valid creative
carriers.

The manual also documents two ideas retained in this spec:

- adding the analysis high-frequency channel directly improves consonant
  intelligibility; and
- cross-connecting analysis controls to different synthesis channels shifts or
  rearranges spectral information.

The app condenses those patch-cord operations into `SIBILANCE` and `SHIFT`
controls.

### Mutable Instruments Warps

The official Warps manual describes its vocoder as 20 analysis and 20 synthesis
filters spaced by thirds of an octave, with 48 dB/octave filtering and envelope
followers. Its controls interpolate/remap analysis envelopes across synthesis
bands, vary follower release, and can freeze envelopes. Its internal rich
carriers include saw, pulse, and low-pass noise.

Mutable Instruments' MIT-licensed source confirms a worklet-relevant
implementation pattern: fixed-size arrays, separate analysis and synthesis
filter-bank state, band-dependent follower gains, different attack/decay
coefficients, interpolated envelope-index remapping, and no allocation in the
audio loop. It also shows a more elaborate multirate design with delay
compensation and stacked filtering. This spec borrows the fixed-state and
envelope-remap concepts, but not source code or the multirate topology.

### Moog Spectravox

Moog's official Spectravox manual describes a ten-band spectral processor. In
Vocoder mode, each analysis-filter envelope is internally routed to the
matching synthesis-band VCA. Its ten channels comprise low- and high-frequency
end bands around eight band-pass channels, showing that a musically useful
hardware instrument can use fewer than Doepfer's 15 or Warps' 20 bands.

Spectravox is also useful as a panel/scope counterexample: it exposes substantial
per-band control and patching. That flexibility is attractive, but duplicating
it would exceed a compact declarative first module.

## Observed Musical Behavior

The primary manuals and independent Spectravox reviews agree on the practical
behavior even when they disagree about how polished a hardware result should
sound:

- A harmonically dense, sustained carrier exposes more analysis bands and
  generally improves intelligibility. Saw, pulse, chords, noise, and bright
  digital spectra are more effective than a sine.
- The modulator supplies timing and articulation; the carrier supplies pitch.
  Speech is conventional, but drums, guitar, sequencers, and acid-style synth
  lines produce useful rhythmic and cross-synthesis effects.
- Band count and selectivity change the character. More/narrower channels can
  preserve finer spectral detail; fewer/broader channels sound coarser and more
  like an obvious effect.
- Attack controls consonant/transient pickup. Release trades crisp articulation
  for smoother, more legato motion. Long release values smear syllables or drum
  hits but can create useful pads.
- Moving envelope information to different synthesis bands changes apparent
  vocal size/brightness without changing carrier pitch.
- Direct high-frequency analysis material helps unvoiced consonants that a
  pitched carrier does not reproduce well.
- The MusicRadar and WIRED Spectravox reviews both characterize the analog
  vocoder as limited or noisy rather than clinically intelligible, while also
  praising experimental use with drums, guitar, and synthesizers. Noise is an
  observed property of that hardware, not a fidelity target for this digital
  module.

## Source Quality And Provenance

### Strongest Sources

- The Doepfer manual/product page and Moog manual are primary sources for
  channel routing, band topology, controls, intended patches, and hardware
  behavior. They take precedence over retailer summaries.
- The Mutable Instruments manual is primary documentation for the Warps user
  contract. Its official source repository is the strongest implementation
  reference and has an explicit MIT license.
- Dudley's Bell Laboratories article is an original historical source rather
  than a retrospective account.
- The W3C Audio EQ Cookbook is the coefficient reference for this
  implementation. The DAFx paper and Faust library documentation independently
  support the matching-bank/envelope-follower model.

### Supporting Sources

- Apple Logic Pro's current guide is a manufacturer manual for a software
  vocoder. It supports the general relationship between band count and spectral
  precision, but it does not define this module's voltages or exact filters.
- MusicRadar and WIRED are independent reviews. They support observed workflow
  and character, not electrical facts or DSP coefficients.
- Sethares' channel-vocoder tutorial and the MusicDSP envelope-follower entry
  are useful pedagogical/implementation references. They are secondary to the
  W3C formulas, official open source, and peer-reviewed DAFx paper.
- Local module source and research define eurorack-js lifecycle, voltage,
  smoothing, and distinction requirements; they do not establish historical
  hardware facts.

### Licensing Boundary

The implementation should use independently written W3C/RBJ biquads and the
algorithm specified below. Warps source is suitable for understanding
allocation-free state and remapping, but there is no need to copy its filter
bank, decimator, or limiter. If any code is ever adapted rather than merely
studied, retain its MIT notice and record that decision explicitly.

## Specification

### Module Metadata

| Field | Contract |
| --- | --- |
| Module ID | `vocoder` |
| Display name | `VOCODER` |
| Category | `effect` |
| Width | 10 HP |
| Color | `module-color-eight` |
| Rendering | Declarative UI; no custom renderer or telemetry |
| Channels | Mono modulator, mono carrier, mono output |

### Knobs And Params

Every finite value is clamped to its declared range before use. A missing,
`NaN`, or infinite param falls back to its default.

| Label | Param | Range / step | Default | Exact meaning |
| --- | --- | --- | ---: | --- |
| Analysis | `analysisGain` | 0..2 / 0.01 | 1 | Linear gain before analysis filtering and the direct-sibilance high-pass. Intended mainly to raise quiet modulators. |
| Carrier | `carrierGain` | 0..2 / 0.01 | 1 | Linear gain before the synthesis bank. |
| Attack | `attackMs` | 1..50 ms / 1 ms | 5 | Shared follower rise time, defined as time for a fixed target step to close 99% of the remaining error. |
| Release | `releaseMs` | 20..500 ms / 1 ms | 120 | Shared follower fall time, using the same 99% definition. |
| Shift | `shift` | -1..1 / 0.01 | 0 | Envelope-index shift. Full range is -4..+4 synthesis-band positions. |
| Sibilance | `sibilance` | 0..1 / 0.01 | 0.25 | Level of a direct high-passed modulator path in the wet signal. |
| Mix | `mix` | 0..1 / 0.01 | 1 | 0 is the bounded dry modulator; 1 is the vocoded wet signal. |

### Switches, Buttons, Actions, And State

- Switches: none.
- Buttons/actions: none.
- Patch-persisted non-control state: none.
- Runtime-state hooks: none.
- Telemetry: none beyond the standard bounded LED object.

No hidden mode is implied. Freeze, internal-carrier selection, band solo,
voiced/unvoiced detection, bandwidth, and per-band level controls are out of
scope rather than undisclosed states.

### Inputs

| Label | Input / port | Signal | Voltage declaration | Behavior |
| --- | --- | --- | --- | --- |
| Mod | `modulator` | `audio` | `{ min: -5, max: 5, normal: 0 }` | Analysis/information signal: speech, drums, another synth, or any audio. Also supplies the dry and direct-sibilance paths. |
| Car | `carrier` | `audio` | `{ min: -5, max: 5, normal: 0 }` | Excitation signal whose pitch and fine harmonic structure are retained under the transferred envelope. |
| Shift | `shiftCv` | `cv` | `{ min: -5, max: 5, normal: 0 }` | Bipolar additive modulation of `shift`; +/-5 V spans the full normalized control range. |
| Mix | `mixCv` | `cv` | `{ min: -5, max: 5, normal: 0 }` | Bipolar additive modulation of `mix`; +/-5 V spans the full mix range. |

Input `Float32Array` identities must remain stable. The compiled graph restores
the declared 0 V normal when a cable is removed. The module must not replace
input arrays or implement cable-cleanup methods.

### Outputs

| Label | Output / port | Signal | Voltage contract |
| --- | --- | --- | --- |
| Out | `out` | `audio` | Finite mono audio, bounded to -5..+5 V by the final soft limiter. |

There are no envelope, individual-band, gate, trigger, pitch-CV, clock, or
stereo outputs.

### LEDs

| LED | Source and mapping |
| --- | --- |
| `analysis` | Post-gain, post-input-limiter modulator peak. Map `peakVolts / 5` to 0..1. |
| `carrier` | Post-gain, post-input-limiter carrier peak. Map `peakVolts / 5` to 0..1. |
| `output` | Final output peak. Map `peakVolts / 5` to 0..1. |

Each LED takes the current block peak immediately and otherwise decays with a
100 ms exponential time:

`led = max(blockPeak / 5, previousLed * exp(-bufferSize / (0.1 * sampleRate)))`

LEDs are bounded 0..1 and cleared by `reset()`.

### Normalization And Silent Cases

- All four inputs normalize to 0 V.
- With both audio inputs disconnected, output and LEDs remain zero.
- With a silent modulator, the carrier is muted after the follower release
  state decays. Carrier alone never creates sustained output.
- With a silent carrier, the filter-bank contribution is silent. At nonzero
  `sibilance`, high-frequency modulator material can still appear in the wet
  output; this is intentional and panel-visible.
- `analysisGain = 0` removes analysis-band envelopes and direct sibilance after
  their state decays. It does not mute the dry path at `mix < 1`.
- `carrierGain = 0` removes the synthesis-bank contribution. It does not mute
  direct sibilance.
- `sibilance = 0`, `carrierGain = 0`, and `mix = 1` produce silence after state
  decay.
- `mix = 0` returns the raw modulator through the final app voltage-bounding
  path; it bypasses `analysisGain`, follower timing, carrier, and sibilance.

## Voltage, Timing, And Control Contract

### Audio Voltage

1. Sanitize each audio sample: non-finite input becomes 0.
2. For analysis, multiply Mod by smoothed `analysisGain`, then apply
   `softLimitVoltage(value, 5)`.
3. For synthesis, multiply Car by smoothed `carrierGain`, then apply the same
   limiter.
4. Divide those bounded voltages by 5 before filter processing.
5. Compute the dry signal independently as
   `softLimitVoltage(finiteModulatorVolts, 5) / 5`.
6. Convert the blended normalized result back to volts and apply
   `softLimitVoltage(result, 5)`.

The output therefore remains in -5..+5 V even for out-of-contract upstream
values or constructive filter-bank summing. The limit is a project voltage
contract, not an attempt to reproduce noisy analog clipping.

### CV Mapping

Per sample:

```text
shiftNormalized = clamp(shift + finite(shiftCv) / 5, -1, 1)
shiftBands = 4 * smoothed(shiftNormalized)

effectiveMix = smoothed(clamp(mix + finite(mixCv) / 5, 0, 1))
```

- +5 V Shift CV moves the knob by +1 normalized unit; -5 V moves it by -1.
- +5 V Mix CV moves the knob by +1; -5 V moves it by -1.
- Values beyond +/-5 V are allowed but the effective controls clamp.
- CV inputs have no gate threshold, edge detection, sample-and-hold, or
  quantization.

### Timing

- `attackMs` covers 1-50 ms; `releaseMs` covers 20-500 ms.
- Times mean 99% convergence, not the one-time-constant 63.2% convention.
- The coefficient for either time is:

  `coefficient = exp(log(0.01) / (timeMs * 0.001 * sampleRate))`

- Attack is selected while the new envelope target is above the current state;
  release is selected otherwise.
- There is no frame, FFT hop, lookahead, or explicit block delay. Latency is
  only the causal IIR and envelope response. Feed-forward output should remain
  behaviorally consistent across 128- and 512-sample worklet blocks.
- There are no gate, trigger, clock, pitch, pause, or reset-input thresholds.

## DSP Plan

### Chosen Topology

Use two fixed, matching 12-band filter banks plus 12 envelope followers:

```text
Modulator -> input gain/limit -> analysis bank -> abs/followers --+
              |                                                   |
              +-> 5 kHz high-pass -> sibilance ------------------+--> wet
                                                                  |
Carrier   -> input gain/limit -> synthesis bank -> per-band VCAs -+

raw Modulator -----------------------------------------------> dry/wet mix
```

This is a time-domain channel vocoder. It is neither an FFT phase vocoder nor a
speech-recognition/synthesis model.

### Fixed Band Layout

Create one second-order section for every analysis band and one matching
section for every synthesis band.

| Index | Type | Nominal frequency | Q | Role |
| ---: | --- | ---: | ---: | --- |
| 0 | Low-pass | 120 Hz cutoff | 0.70710678 | Low-frequency energy |
| 1 | Band-pass | 170 Hz center | 2.0 | Low fundamentals/body |
| 2 | Band-pass | 250 Hz center | 2.0 | Low-mid body |
| 3 | Band-pass | 370 Hz center | 2.0 | Low-mid articulation |
| 4 | Band-pass | 550 Hz center | 2.0 | Mid articulation |
| 5 | Band-pass | 820 Hz center | 2.0 | Mid/vowel energy |
| 6 | Band-pass | 1220 Hz center | 2.0 | Upper-mid detail |
| 7 | Band-pass | 1810 Hz center | 2.0 | Upper-mid detail |
| 8 | Band-pass | 2690 Hz center | 2.0 | Presence |
| 9 | Band-pass | 4000 Hz center | 2.0 | Presence/consonants |
| 10 | Band-pass | 5950 Hz center | 2.0 | High detail |
| 11 | High-pass | 8500 Hz cutoff | 0.70710678 | Top-band energy |

The logarithmic centers are intentionally broad and overlapping. Twelve bands
are a CPU/clarity compromise between Spectravox's ten, Doepfer's 15, and
Warps' 20.

- Use the W3C/RBJ constant-0-dB-peak band-pass coefficients for indexes 1-10.
- Use W3C/RBJ low-pass and high-pass coefficients with Butterworth Q for the
  endpoints.
- Normalize coefficients by `a0`.
- Precompute all coefficients once in `createDSP()`. No panel control changes
  filter center or Q.
- At supported 44.1, 48, and 96 kHz sample rates, use the nominal frequencies.
  For an unusual lower positive rate, clamp every frequency to
  `0.42 * sampleRate` so coefficients remain finite; collapsed upper bands at
  unsupported rates are preferable to instability.
- Use transposed direct form II with independent state for every analysis and
  synthesis section. `Float64Array` state is acceptable; public buffers remain
  `Float32Array`.

One biquad per channel is intentionally gentler than Warps' stacked
48 dB/octave bank. The low/high endpoints have 12 dB/octave asymptotic slopes,
and the band-pass skirts overlap substantially. Expected result: less precise
speech separation and more spectral bleed, but lower CPU, lower ringing, and a
compact allocation-free process suitable for a browser rack.

### Envelope Followers

For every sample, process all 12 analysis filters before synthesis remapping:

```text
analysisBand = analysisFilter[band](analysisNormalized)
target = min(abs(analysisBand) * sqrt(12), 2)
coefficient = target > envelope[band] ? attackCoefficient : releaseCoefficient
envelope[band] = coefficient * (envelope[band] - target) + target
```

- Full-wave rectification is sufficient; no Hilbert transform is required.
- `sqrt(12)` compensates approximately for splitting broadband energy among
  channels.
- The target cap of 2 bounds state under resonant or malformed input without
  prematurely clipping ordinary band energy.
- Followers share the user attack/release values. Unlike Warps, this first
  version does not use band-dependent timing or freeze.
- Recompute attack and release coefficients once at the start of each block
  from sanitized params. Changing time alters the follower slope, not its
  current state, so it does not create an amplitude discontinuity.

### Envelope-Index Shift

For synthesis band `b`, read the analysis envelope at:

`sourceIndex = b - shiftBands`

- At zero shift, band `b` controls matching synthesis band `b`.
- Positive shift moves an analysis pattern upward: a lower analysis envelope
  controls a higher synthesis band.
- Negative shift moves the pattern downward.
- Linearly interpolate between adjacent envelopes for fractional indexes.
- Samples outside indexes 0..11 are zero. Do not wrap end bands around.
- Shift changes only envelope routing. Filter coefficients remain fixed, which
  distinguishes it from the moving resonances in `formant`.

This is a compact macro version of cross-patching Doepfer analysis outputs and
of Warps' interpolated envelope remapping.

### Synthesis And Wet Gain

For every synthesis band:

1. Process the normalized carrier through its matching fixed filter.
2. Multiply by the shifted/interpolated envelope.
3. Add to the band sum.

Then compute:

```text
bankWet = bandSum * (1.4 / sqrt(12))
directSibilance = 0.35 * smoothedSibilance * sibilanceHighPass
wet = bankWet + directSibilance
```

The constants are implementation assumptions chosen to give a useful nominal
level while leaving the final limiter to catch coherent extremes. They are
testable starting points, not manufacturer measurements.

### Direct Sibilance

- Run the post-`analysisGain`, post-input-limiter modulator through a separate
  fixed second-order Butterworth high-pass at 5 kHz.
- Add it only to the wet signal using the formula above.
- Use independent filter state; do not reuse band 11 because its cutoff and
  envelope-controlled purpose differ.
- Do not generate noise, classify voiced/unvoiced frames, or substitute a
  consonant source. The path is simply direct high-frequency analysis content,
  following the intelligibility technique in the A-129 manual.

Consequently a bright modulator can be audible at `mix = 1` without a carrier
when `sibilance > 0`. This is intentional, documented, and must be tested.

### Mix, Smoothing, And First-Block Hydration

Blend in normalized units:

`blended = dry * (1 - effectiveMix) + wet * effectiveMix`

Use separate 5 ms `createSlew()` instances for:

- analysis gain;
- carrier gain;
- normalized shift after knob plus CV;
- sibilance; and
- mix after knob plus CV.

Attack/release use block-rate coefficient updates as described above. Filter
audio is never smoothed.

On the first `process()` after construction or `reset()`, initialize each slew
directly to its sanitized target, including sample-zero Shift and Mix CV. This
prevents an artificial fade from zero when restoring a patch. Subsequent knob
or CV changes take the 5 ms path and avoid block-boundary clicks.

### Reset And Runtime State

`reset()` must:

- preserve the seven public param values;
- clear all four stable input arrays in place;
- clear `out` in place;
- clear 24 filter sections for the analysis/synthesis banks;
- clear the 12 envelope states;
- clear the independent sibilance high-pass;
- reset all five control slews and mark them for first-block hydration;
- clear all three LEDs;
- leave buffer identities unchanged.

No random state, asynchronous work, separate bulk history, messages, or browser
resources require reset.

### Worklet Safety And CPU Budget

The hot path has:

- 12 analysis biquads;
- 12 synthesis biquads;
- one direct-sibilance high-pass;
- 12 envelope updates and 12 interpolated VCAs per sample.

That is 25 fixed biquad sections per sample plus scalar control work. Allocate
all buffers, coefficient tables, filter state, envelope state, and slew objects
once in `createDSP()`. `process()` must not allocate arrays or objects, create
closures/readers, call DOM/Web Audio APIs, use `Date`, emit unbounded events, or
depend on the main thread.

The fixed filters avoid per-sample trigonometry. Only the small follower and LED
exponentials are computed once per block. A multirate bank like Warps could
reduce some high-order filter cost, but its decimation, delay compensation, and
steeper stages are unnecessary for this bounded 12-biquad-per-bank model.

Acceptance is functional completion of
`npm run audit:dsp -- --module vocoder --matrix --strict-voltage` at 44.1, 48,
and 96 kHz with 128- and 512-sample blocks, with no runtime timing failure. The
audit's timing is advisory; no machine-specific microsecond assertion belongs
in the focused test.

## Deviations, Contradictions, And Decisions

| Evidence conflict or unknown | Decision |
| --- | --- |
| Hardware references use 10 (Spectravox), 15 (A-129), or 20 (Warps) channels. | Fix the app at 12: LP + 10 BP + HP. It offers broader resolution than ten while keeping the worklet cost below 15/20-band models. |
| Warps documents steep 48 dB/octave filters; the app could stack sections for closer separation. | Use one biquad per channel. The expected bleed/coarser intelligibility is accepted for CPU and stability. |
| DAFx descriptions often focus on logarithmic band-pass banks, while A-129 and Spectravox include endpoint low/high channels. | Retain LP and HP endpoints to cover full-spectrum energy and follow modular hardware practice. |
| Warps uses band-dependent release behavior and supports frozen envelopes. | Expose one exact attack and one exact release for a small, testable panel. No freeze. |
| A-129 exposes 15 analysis CVs and cross-patching; Spectravox exposes extensive per-band control. | Keep envelopes internal and represent ordered cross-patching with one interpolated `shift` macro. |
| Vocoders may use direct high-frequency speech, generated noise, or voiced/unvoiced switching for consonants. | Use only a direct 5 kHz high-pass path with explicit level. No classifier or generated source. |
| Independent Spectravox reviews report noise and limited intelligibility. | Do not synthesize analog noise. Retain the creative coarse character through broad channels, and judge intelligibility by relative spectral-transfer tests rather than speech-recognition claims. |
| Hardware mic/instrument levels and CV ranges vary. | Use local +/-5 V audio, +/-5 V bipolar CV, and 0 V normals. No mic preamp. |
| Sources do not establish one universally correct attack/release range. | Use 1-50 ms attack and 20-500 ms release. These encompass the practical 1-100 ms / 10-500 ms Faust example ranges while keeping this panel focused. |
| Analog sums can exceed nominal Eurorack levels. | Soft-limit the public output to the app's +/-5 V audio rails. |
| Exact wet compensation and direct-sibilance gain are not standardized. | Start at `1.4 / sqrt(12)` and `0.35`; record them as assumptions and test their bounds/relative effects. |

## Explicitly Out Of Scope

- faithful emulation of the A-129, Warps, Spectravox, EMS, Sennheiser, or any
  other named vocoder;
- internal oscillator, chord carrier, pulse source, or noise generator;
- microphone permissions, preamplification, input selection, or recording;
- per-band faders, sockets, solo/mute, width/Q, or custom display;
- freeze/hold, voiced/unvoiced detection, pitch tracking, formant correction,
  automatic gain control, compressor, or noise gate;
- FFT/STFT phase vocoding, convolution, neural speech processing, or latency
  compensation;
- stereo analysis/synthesis or polyphonic voice allocation;
- filter-center modulation or audio-rate coefficient updates;
- envelope outputs or a patch-persisted learned spectrum.

These are potential later products or versioned contract changes, not blockers
for the first module.

## Open Questions

There are no blocking research questions. Implementation/listening can tune only
the explicitly identified assumption constants (`1.4`, `0.35`, and possibly
Q=2.0) if focused spectral tests and voltage limits remain true. Changing band
count, frequencies, ports, param names/ranges, follower time definition, or
shift polarity requires updating this research contract before code.

## Test Targets

Tests belong in `tests/dsp/vocoder.test.js` and should be written before or
alongside implementation. Use sustained fixtures and enough warm-up blocks for
IIR/follower settling; do not mistake follower attack for routing latency.

### Initialization And Contract

- Default metadata is `vocoder`, `VOCODER`, 10 HP, `module-color-eight`, and
  category `effect`.
- Defaults are exactly:
  `analysisGain=1`, `carrierGain=1`, `attackMs=5`, `releaseMs=120`,
  `shift=0`, `sibilance=0.25`, and `mix=1`.
- Inputs are stable `Float32Array(bufferSize)` values named `modulator`,
  `carrier`, `shiftCv`, and `mixCv`, initialized to their 0 V normals.
- Output `out` is a stable `Float32Array(bufferSize)`.
- LEDs `analysis`, `carrier`, and `output` start at 0.
- UI params, ports, signals, declared voltage ranges/normals, and defaults match
  this document. There are no switches, buttons, actions, `ui.state`, custom
  renderer, or telemetry.

### Silence, Ranges, And Integrity

- Disconnected inputs on a fresh/reset instance produce an all-zero output and
  zero LEDs.
- Every call fills the complete output buffer, including after a shorter prior
  fixture or reset.
- All supported params, CV extremes, out-of-range finite inputs, and injected
  `NaN`/infinities produce finite state/output.
- Output never exceeds +/-5 V.
- Public input and output buffer identities do not change across repeated
  `process()` and `reset()` calls.
- Long-running broadband and coherent-tone stress fixtures remain finite.
- Run the strict 44.1/48/96 kHz by 128/512 matrix with no voltage flags.

### Filter-Bank Spectral Transfer

- With zero shift and settled followers, a carrier tone near the active
  modulator band's center passes materially more strongly than a carrier tone
  several bands away.
- Probe the LP endpoint with low-frequency material and the HP endpoint with
  high-frequency material; each should exceed a suitable off-band response.
- Probe representative BP centers at 170, 820, 1810, and 5950 Hz. A center
  probe should exceed nearby geometric off-center probes after settling.
- A modulator tone controls amplitude but does not set output pitch: measured
  vocoder output follows carrier frequency when the two land in the same
  effective channel.
- Carrier alone becomes silent after envelopes release; modulator alone yields
  no filter-bank wet signal when `sibilance=0`.

### Each Knob

- `analysisGain=0` prevents new envelope and sibilance energy; default and 2
  increase response for a quiet modulator without exceeding rails.
- `carrierGain=0` removes the synthesis bank; default and 2 increase response
  for a quiet carrier without changing the modulator envelope timing.
- `attackMs=1` rises materially further during an early observation window
  than `attackMs=50` for the same step.
- After removing the modulator while retaining the carrier,
  `releaseMs=20` decays materially faster than `releaseMs=500`.
- Coefficient-focused assertions use the documented 99% formula at multiple
  sample rates, within floating-point tolerance.
- `shift=-1`, `0`, and `+1` implement -4, 0, and +4 band positions with the
  documented sign.
- `sibilance=0` removes the direct path; `sibilance=1` passes materially more
  5-10 kHz modulator energy while rejecting a low-frequency probe.
- `mix=0` returns the bounded dry Mod path independently of analysis/carrier;
  `mix=1` returns wet; an intermediate value lies between coherent dry/wet
  reference renders after the 5 ms slew settles.
- Invalid knob values recover to defaults; finite out-of-range values clamp.

### Each CV

- At a neutral Shift knob, +5 V and -5 V Shift CV reach +4 and -4 band
  positions after slew; values beyond +/-5 V do not exceed those limits.
- A low analysis tone in band 1 can control a carrier in band 5 at full positive
  shift; the reverse fixture works at full negative shift.
- Fractional shift linearly shares energy between adjacent synthesis mappings
  and changes continuously. Out-of-range source indexes contribute zero and do
  not wrap.
- Mix CV is additive: at a suitable knob setting, +5 V clamps wet and -5 V
  clamps dry. Over-range and non-finite CV remain bounded/finite.
- Shift and Mix inputs normalize to 0 V and leave knob behavior unchanged when
  disconnected.

### Sibilance And Silent-Carrier Exception

- With carrier absent, `sibilance=1` and `mix=1`, a high-frequency modulator
  yields output while a low-frequency modulator is strongly attenuated.
- `analysisGain=0` eventually removes that direct path; `carrierGain=0` does
  not.
- `sibilance=0`, `carrierGain=0`, and `mix=1` settle to silence.
- Direct sibilance remains bounded under a full-scale high-frequency signal.

### Smoothing And Restoration

- Construction/restoration hydrates all five slews to current targets on the
  first block instead of ramping from zero.
- A block-boundary change in Analysis, Carrier, Shift, Sibilance, or Mix follows
  the 5 ms slew and avoids a one-sample discontinuity comparable to a raw
  parameter jump.
- Attack/release changes preserve envelope state; only the subsequent slope
  changes.
- Behavior is consistent across 128- and 512-sample blocks within appropriate
  timing/spectral tolerances.

### LEDs

- Analysis LED follows post-gain analysis level, Carrier LED follows post-gain
  carrier level, and Output LED follows final output.
- LEDs are finite and remain within 0..1.
- Each responds immediately to a larger block peak and follows the documented
  100 ms decay during silence.
- `reset()` clears all three LEDs.

### Reset

- Seed all 24 bank filters, 12 envelopes, sibilance high-pass, slews, inputs,
  output, and LEDs; call `reset()`; verify each runtime state is cleared through
  observable silence/equivalence to a fresh instance.
- Verify all four input arrays and output are zeroed in place.
- Verify params are preserved.
- Verify the next block hydrates controls from preserved params and sample-zero
  Shift/Mix CV.

### Not Applicable

- There are no trigger, gate, clock, pitch-CV, reset-input, switch, button,
  action, custom-renderer, telemetry, or patch-state behaviors to test.

## DSP Audit (2026-07-31)

- `npm run audit:dsp -- --module vocoder --matrix --strict-voltage` passed all
  six 44.1/48/96 kHz by 128/512-sample configurations.
- Each configuration completed 15 scenarios with zero errors, finite output,
  zero voltage flags, and stable input/output buffer identities.
- Measured output peaks ranged from 4.894 V to 5.000 V. Maximum observed
  processing time ranged from 39.9 to 591.6 microseconds per block across the
  matrix; these local wall-clock figures are regression observations rather
  than real-time guarantees.
- The focused suite separately verifies spectral transfer, carrier-pitch
  retention, follower timing, CV mapping, reset equivalence, exact LED decay,
  malformed-input handling, and rail compliance.

## Implementation Plan

- **Module ID**: `vocoder`
- **Category**: `effect`
- **Branch/worktree**: implement on `module/vocoder` at
  `/Users/orderandchaos/code/eurorack-js/.worktrees/vocoder-module`. Do not implement in
  the research worktree.
- **DSP model**: mono, fixed 12-channel time-domain vocoder with matching
  LP + 10 BP + HP banks, 12 full-wave attack/release followers, interpolated
  +/-4-band envelope remapping, external carrier, direct 5 kHz sibilance,
  bounded dry/wet mix, and no processing-time allocation.
- **Params**: `analysisGain`, `carrierGain`, `attackMs`, `releaseMs`, `shift`,
  `sibilance`, `mix`.
- **Inputs**: `modulator`, `carrier`, `shiftCv`, `mixCv`.
- **Outputs**: `out`.
- **LEDs**: `analysis`, `carrier`, `output`.
- **Module file**: add `src/js/modules/vocoder/index.js` only after the queue is
  `spec-ready`, using declarative UI and no telemetry.
- **Focused tests**: write `tests/dsp/vocoder.test.js` first. Run
  `npm test -- tests/dsp/vocoder.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`.
- **Registration**: place `vocoder` after `ring` as an adjacent
  spectral/cross-modulation effect in both `src/js/rack/module-manifest.js` and
  `src/js/rack/core-definitions.js`. Preserve matching uninterrupted `m0`..`mN`
  aliases/order.
- **Worklet cache contract**: bump the same core graph revision in
  `src/js/audio/worklet-engine.js`, `src/js/audio/worklet/processor.js`, and
  `src/js/audio/worklet/core-plugin.js` when the core definition is added.
- **Factory patch**: add
  `src/js/config/patches/test-vocoder.js`, import/export it in the patch index,
  and use verified ports:
  `clk.clock -> kick.trigger`,
  `kick.out -> vocoder.modulator`,
  `vco.ramp -> vocoder.carrier`,
  `vocoder.out -> spectrum.audio`,
  `spectrum.out -> out.L`, and
  `vocoder.out -> out.R`.
  This makes the clocked kick envelope a clearly audible/visible modulation of
  a rich ramp carrier.
- **Factory-patch validation**:
  `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`.
- **DSP audit**:
  `npm run audit:dsp -- --module vocoder --matrix --strict-voltage`.
- **Full validation command before merge**: `npm test`.
- **Documentation**: add `vocoder` to the available-module lists/table in
  `AGENTS.md` and `README.md`. Update `docs/creating-modules.md` only if
  implementation discovers a genuinely reusable pattern.
- **Shared framework changes**: none expected beyond required core registration,
  alias renumbering, and the three-file graph-revision bump.
- **Known assumptions**: 12 bands, fixed frequencies/Q, common follower timing,
  `1.4 / sqrt(12)` bank compensation, `0.35` direct-sibilance scale, no internal
  carrier, and final +/-5 V soft limiting.

## Sources

### Primary Manuals, Product Pages, History, And Open Code

- [A-129/1 Vocoder Analysis Section and A-129/2 Synthesis Section manual](https://doepfer.de/a100_man/A1291man.pdf)
  - Doepfer Musikelektronik, official manual, undated/1990s-era product,
    accessed 2026-07-31.
  - Supports the 15-channel analysis/filter/follower and matching
    synthesis-filter/VCA architecture; nominal band frequencies; carrier pitch
    retention; rich-carrier guidance; direct high-frequency analysis for
    intelligibility; and external channel remapping.
- [A-129 Vocoder Subsystem](https://doepfer.de/a129e.htm)
  - Doepfer Musikelektronik, official English product/context page, accessed
    2026-07-31.
  - Supports 13 band-pass plus low/high endpoint channels, modular envelope CV
    connections, analysis/synthesis roles, and official sound-example carrier
    choices.
- [Warps manual](https://pichenettes.github.io/mutable-instruments-documentation/modules/warps/manual/)
  - Mutable Instruments, official manual, accessed 2026-07-31.
  - Supports 20 matching third-octave analysis/synthesis channels,
    48 dB/octave filtering, follower-release/freeze behavior,
    envelope-position interpolation, and harmonically rich internal carriers.
- [Warps DSP source](https://github.com/pichenettes/eurorack/tree/master/warps/dsp)
  - Emilie Gillet / Mutable Instruments, official MIT-licensed source,
    copyright notes dated 2014, accessed 2026-07-31. Relevant files include
    `vocoder.cc`, `vocoder.h`, `filter_bank.cc`, and `filter_bank.h`.
  - Supports fixed-size allocation-free state, 20-band followers, separate
    attack/decay, envelope remapping/interpolation, multirate filter-bank
    trade-offs, gain compensation, and delay alignment.
- [Spectravox User Manual, Revision B](https://api.moogmusic.com/sites/default/files/2024-05/Spectravox_Manual_RevB.pdf)
  - Moog Music, official manual, May 2024, accessed 2026-07-31.
  - Supports ten analysis/synthesis bands, low/high endpoint channels, and the
    Vocoder-mode internal routing from each analysis envelope follower to the
    corresponding synthesis VCA.
- [“The Vocoder”](https://www.worldradiohistory.com/Archive-Bell-Laboratories-Record/30s/Bell-Laboratories-Record-1939-12.pdf)
  - Homer Dudley, *Bell Laboratories Record*, volume 18 number 4, December
    1939, pages 122-126; archival scan accessed 2026-07-31.
  - Original historical account of the analyzer/synthesizer speech system,
    transmitting slowly varying controls, and reconstructing speech using buzz
    and hiss excitation.
- [Logic Pro for iPad: Vocoder basics](https://support.apple.com/en-gb/guide/logicpro-ipad/lpip4c9f0f82/ipados)
  - Apple, current official software manual, accessed 2026-07-31.
  - Supports two matching band-pass banks, per-band envelope followers/VCAs,
    the precision effect of band count, and non-speech analysis sources such as
    drums.

### Independent Reviews And Observed Use

- [Moog Spectravox review](https://www.musicradar.com/reviews/moog-spectravox)
  - Si Truss, MusicRadar, 17 July 2024, accessed 2026-07-31.
  - Supports observed ten-filter workflow, spectrum shifting, creative external
    sources, strong analog character, and the judgment that the result is noisy
    and not optimized for clean intelligibility.
- [Review: Moog Spectravox](https://www.wired.com/review/moog-spectravox/)
  - Terrence O'Brien, WIRED, 13 August 2024, accessed 2026-07-31.
  - Supports the low-pass + eight band-pass + high-pass layout, limited/noisy
    classic-vocoder character, and successful experiments using drum programs,
    guitar, and polyphonic synthesizer carriers.

### DSP And Engineering References

- [“A Streaming Audio Mosaicing Vocoder Implementation”](https://www.dafx.de/paper-archive/2013/papers/31.dafx2013_submission_55.pdf)
  - Edward Costello, Victor Lazzarini, and Damian Timoney, Proceedings of the
    16th International Conference on Digital Audio Effects (DAFx-13), 2013,
    accessed 2026-07-31.
  - Supports the conventional channel-vocoder reference model: matching,
    logarithmically distributed carrier/modulator filter banks with modulator
    envelope followers controlling carrier-channel amplitudes.
- [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/)
  - Raymond Toy, editor; formulas adapted from Robert Bristow-Johnson, W3C Audio
    Working Group Note, 8 June 2021, accessed 2026-07-31.
  - Normative implementation reference for normalized biquad equations and
    constant-0-dB-peak band-pass, low-pass, and high-pass coefficients.
- [Faust Virtual Analog Effects: `vocoder`](https://faustlibraries.grame.fr/libs/vaeffects/)
  - GRAME / Faust libraries documentation, accessed 2026-07-31.
  - Supports a standard parameterized filter-bank vocoder interface and
    practical example ranges of roughly 1-100 ms attack and 10-500 ms release.
- [A Channel Vocoder in Matlab](https://sethares.engr.wisc.edu/vocoders/channelvocoder.html)
  - William A. Sethares, University of Wisconsin, educational implementation,
    accessed 2026-07-31.
  - Supports parallel modulator/carrier banks, rectification plus low-pass
    envelope extraction, and use of a spectrally rich carrier.
- [Envelope follower with different attack and release](https://www.musicdsp.org/en/latest/Analysis/136-envelope-follower-with-different-attack-and-release.html)
  - Bram de Jong / MusicDSP community archive, 2003-era entry, accessed
    2026-07-31.
  - Supports a practical full-wave peak follower with separate attack/release
    one-pole coefficients; used as supporting precedent, not copied code.

### Local Architecture And Comparison References

- [`src/js/modules/formant/index.js`](../../src/js/modules/formant/index.js) and
  [`research/modules/formant.md`](formant.md)
  - eurorack-js implementation/research, accessed 2026-07-31.
  - Establish the existing one-input four-vowel resonator behavior and exact
    non-overlap with analysis/synthesis vocoding.
- [`src/js/modules/resbank/index.js`](../../src/js/modules/resbank/index.js) and
  [`research/modules/resbank.md`](resbank.md)
  - eurorack-js implementation/research, accessed 2026-07-31.
  - Establish the existing pitched modal/string resonator, trigger, tail, and
    polyphony behavior excluded from this module.
- [`src/js/modules/envf/index.js`](../../src/js/modules/envf/index.js) and
  [`research/modules/envf.md`](envf.md)
  - eurorack-js implementation/research, accessed 2026-07-31.
  - Establish local full-wave attack/release follower and CV conventions.
- [`src/js/utils/voltage.js`](../../src/js/utils/voltage.js) and
  [`src/js/utils/slew.js`](../../src/js/utils/slew.js)
  - eurorack-js utilities, accessed 2026-07-31.
  - Establish final soft-limiter and live-control smoothing behavior for the
    implementation plan.
