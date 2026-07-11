# Low Pass Gate (lpg)

## Status

Research, implementation, and validation completed through the queue processor
workflow. The `lpg` row is tracked in `research/module-queue.md`.

This research pass covered the queue targets: Buchla low pass gate history,
Make Noise Optomix, Doepfer A-101-2, vactrol response notes, and percussive
demo/patch references.

## Scope

Build one compact, single-channel low pass gate for eurorack-js. The design is
inspired by Buchla 292 style behavior, with Make Noise Optomix style `Strike`
and `Damp` controls and optional Doepfer A-101-2 style resonance. It is not a
component-level model of any one module.

## Hardware References

### Buchla 292 / 292t

- Buchla and Tiptop Audio's Eurorack 200 series page presents the project as a
  Eurorack conversion/resumption of Don Buchla's 200 series and lists the 292t
  as "Quad Lopass Gate Model 292t". The page establishes the 292 lineage and
  current Eurorack panel scale.
- The 292t manual defines four channels with per-channel audio inputs, CV
  inputs, manual blue offset/volume knobs, individual outputs, a summed `All`
  output, and three modes: gate, combo, and lopass.
- The 292t manual notes that combo mode combines a linear gate and lopass
  behavior and adds a subtle ringing decay, while lopass mode is useful for a
  pinged "snap". This supports making the app module's default mode `combo`.

### Make Noise Optomix

- Make Noise describes Optomix as a two-channel low pass gate with simultaneous
  control of amplitude and frequency content, essentially a voltage-controlled
  filter amplifier with an organic control response.
- Optomix revision 2 adds `Damp`, `Strike`, side-chain compression use, positive
  input normalization, a summing output, direct-coupled audio/CV processing, and
  four vactrols.
- The manual gives practical electrical references: signal inputs handle up to
  10 Vpp, control and damp CV ranges are 0-8 V with +8 V normalization, channel
  outputs and sum output are 10 Vpp depending on source/settings, and `Strike`
  expects an 8 V gate.
- The manual explicitly describes LPG behavior as amplitude and low-pass
  frequency moving together: when control becomes more positive, lows appear
  first and amplitude rises; when control falls, highs are attenuated sooner.
  It also identifies moderate attack, slow decay, bleed/ringing, and damping as
  part of the vactrol sound.

### Doepfer A-101-2

- Doepfer's A-101-2 page identifies the module as a vactrol-based combination
  of low-pass filter and VCA, inspired by Buchla 292.
- Doepfer says Don Buchla coined the "Low Pass Gate" term for a module switchable
  between low-pass and VCA, with a combined LP+VCA mode where the sound becomes
  duller as it gets quieter.
- The A-101-2 is a 12 dB low-pass filter that can switch between LP, VCA, and
  LP+VCA. It adds CV/audio attenuators, resonance up to self-oscillation, and
  gate inputs for external mode control. Doepfer notes that vactrol circuits may
  not fully attenuate audio in VCA mode at minimum control.
- Doepfer's page also notes the audio input can be overdriven with standard
  A-100 audio levels above roughly mid knob position, the module is DC coupled,
  and the lowest filter frequency is around 50 Hz.

### Vactrol Behavior

- Doepfer's vactrol basics page defines a vactrol as an LED/light-source plus
  LDR in a light-proof package, acting as a voltage-controlled resistance.
- Doepfer lists core sonic reasons for vactrol use: they behave like ohmic
  resistors, tolerate comparatively high circuit voltages, and avoid the
  distortion common to some active variable-resistance approaches.
- Doepfer lists core emulation problems: LED-current to LDR-resistance response
  is extremely nonlinear, parts vary materially from unit to unit, and response
  is asymmetric and illumination-dependent. Bright-region response can be in the
  10 ms range, while reaching dark resistance can take seconds.

## Observed Behavior From Reviews/Demos And Patch Notes

- Doepfer links Raul Pena tutorials for A-101-2 mode intro, VCA mode, and
  combined mode. The official page positions those videos as practical mode
  demonstrations, supporting explicit mode tests for VCA, combo, and LP.
- Make Noise embeds "Optomix New Features" on the Optomix product page, which
  supports the revision-2 emphasis on `Damp`, `Strike`, side-chain/dynamic
  response, and CV processing.
- Optomix manual patch ideas include "The New Bongo", "FM Pings", side-chain
  ducking, accenting via `Strike`, and palm-muted damping. These support a test
  patch where a VCO or noise source is struck by triggers without a separate
  envelope generator.
- Practical sound target: a short trigger into `Strike` should produce a fast
  attack, rounded transient, and nonlinear decay that closes the VCA while also
  darkening the signal. Increasing `Damp` should shorten the tail and reduce
  bleed/ringing.

## Panel Contract

### Metadata

- Module ID: `lpg`
- Name: `LPG`
- Category: `filter`
- Suggested width: 6 HP
- Suggested color token: `module-color-three` or another unused filter-adjacent
  shared token chosen by the implementation branch.

### Parameters

| Param | Label | Range | Default | Behavior |
| --- | --- | --- | --- | --- |
| `level` | Level | 0-1 | 0 | Manual open/offset. At 0 the gate closes unless CV or Strike opens it. At 1 the gate is held open. |
| `damp` | Damp | 0-1 | 0.35 | Higher values shorten decay, reduce bleed, and make struck sounds more muted. |
| `tone` | Tone | 0-1 | 0.65 | Sets base/open cutoff range. Low values are darker; high values open the LPG brighter. |
| `resonance` | Res | 0-1 | 0 | Optional Doepfer-inspired resonance. 0 is Buchla/Optomix-like non-resonant behavior; max may approach self-oscillation only in LP mode if implemented safely. |
| `mode` | Mode | 0, 1, 2 | 1 | 0 = VCA/gate, 1 = combo LP+VCA, 2 = LP. Use custom UI or a button bank to label values `VCA`, `COMBO`, `LP`. |

### Inputs

| Port | Label | Type | Contract |
| --- | --- | --- | --- |
| `audio` | In | `buffer` | Direct-coupled audio/CV signal. Expected audio range -5 V to +5 V. Unpatched input is silence and must clear after processing. |
| `cv` | CV | `cv` | Main open control. 0 V closed, 5 V nominal full open. Clamp/tolerate 0-10 V gates and hot CV. Add to `level`. |
| `strike` | Strike | `trigger` | Rising edge at >= 1 V triggers a pluck envelope. Gates at 5-10 V work; 0 V resets edge detector. |
| `dampCV` | Damp | `cv` | Adds to `damp`. 0-5 V maps across the damp range; clamp outside range. Audio-rate modulation is acceptable but should be smoothed enough to avoid zipper noise. |

### Outputs

| Port | Label | Type | Contract |
| --- | --- | --- | --- |
| `out` | Out | `buffer` | Processed signal, nominal -5 V to +5 V. Soft-limit extreme resonance/drive to prevent NaN or runaway. |

### LEDs

| LED | Behavior |
| --- | --- |
| `open` | Brightness follows the effective internal vactrol/gain envelope after smoothing. It should show strike tails and manual/CV opening. |

### Normalization

- No patched `cv`: CV contribution is 0 V; `level` controls manual opening.
- No patched `strike`: no pluck trigger; manual/CV still work.
- No patched `dampCV`: `damp` knob controls damping alone.
- No patched `audio`: output is silence even when struck. Do not emit a separate envelope from `out`.

## Voltage Contract

- Audio input/output: nominal -5 V to +5 V. Accept hot input and soft clip output
  rather than producing values outside a musically useful range.
- Main CV: 0-5 V maps to closed-full open. Values above 5 V are clamped for
  control but should not cause NaN or runaway.
- `Strike`: app trigger/gate standard applies. A rising edge >= 1 V triggers the
  envelope. Hardware Optomix expects 8 V gates, but eurorack-js uses 0/10 V
  gates and 5-10 V triggers, so the app threshold should remain compatible with
  existing trigger sources.
- `Damp CV`: 0-5 V maps to 0-1 added damping before clamp. Higher voltage means
  shorter/more muted decay.
- No pitch tracking or clock reset behavior.
- DC-coupled behavior: processing CV/audio-rate input is allowed, but output is
  still soft-limited to the rack's signal ranges.

## DSP Plan

### Chosen Model

Use an inspired-by LPG model rather than a circuit-accurate Buchla, Make Noise,
or Doepfer clone. The module should prioritize the perceptual LPG behavior:
combined gain and low-pass cutoff, asymmetric vactrol response, nonlinear
strike tails, mode switching, and safe rack-level output.

### Algorithm Overview

1. Compute effective controls per sample:
   - `openTarget = clamp(level + cv / 5 + strikeEnvelope, 0, 1)`.
   - `dampTarget = clamp(damp + dampCV / 5, 0, 1)`.
   - `toneTarget = clamp(tone, 0, 1)`.
2. Detect `strike` rising edges at >= 1 V. On a rise, excite a pluck envelope
   immediately to 1.0.
3. Model vactrol response with asymmetric smoothing:
   - Attack: roughly 2-12 ms depending on level/excitation.
   - Decay: roughly 80-1200 ms, shortened by `damp`.
   - Tail/memory: optional slow sensitivity state, inspired by Mutable
     Instruments Streams, so repeated strikes can feel slightly more open.
4. Apply a nonlinear mapping from vactrol state to gain and cutoff:
   - Gain curve: use a smooth exponential/Gompertz-like or power curve so the
     low end stays quiet and the top opens quickly.
   - Cutoff curve: minimum around 40-80 Hz, maximum around 18-20 kHz, scaled by
     `tone` and vactrol state. In combo mode, lows should appear before highs.
5. Mode behavior:
   - `mode = 0` VCA: output = input * gain, with filter mostly open/bypassed.
   - `mode = 1` Combo: output = lowpass(input, cutoff) * gain.
   - `mode = 2` LP: output = lowpass(input, cutoff) with near-unity gain.
6. Filter implementation:
   - Prefer a TPT state-variable filter or two cascaded one-pole/TPT low-pass
     stages. TPT is stable with audio-rate cutoff modulation and aligns with
     existing VCF research in the project.
   - Resonance defaults to 0. If implemented, keep resonance limited in combo
     mode and permit stronger Doepfer-style resonance only in LP mode.
7. Output stage:
   - Apply gentle saturation/soft clipping near +/-5 V to handle resonance and
     hot input.
   - Ensure all output samples are finite and every buffer sample is written.

### Expected Differences From Hardware

- Real vactrols vary by part and by recent illumination history; this model will
  use deterministic, repeatable response curves.
- The 292t is four channels and Optomix is two channels with sum/aux behavior;
  this app module is intentionally one channel to keep scope small.
- Optomix revision 2 side-chain compression is not in the first implementation.
  `Damp` may accept audio-rate CV, but it should not be marketed as a compressor.
- Doepfer's A-101-2 has gate-controlled mode switching and input overdrive
  behavior. The app module will use manual mode selection and conservative
  soft clipping.

## Assumptions And Contradictions

- Source contradiction: Buchla/Tiptop and Make Noise emphasize non-resonant LPG
  behavior, while Doepfer adds resonance and possible self-oscillation. Decision:
  include `resonance` with default 0 so classic behavior is default and Doepfer
  color is optional.
- Source contradiction: Optomix uses 0-8 V control ranges and expects 8 V
  `Strike` gates; eurorack-js standardizes CV around 0-5 V and gates at 0/10 V.
  Decision: map 0-5 V to nominal full open, clamp above 5 V, and use existing
  >= 1 V trigger threshold for interoperability.
- Unknown: exact 292 and Optomix vactrol time constants are not specified in
  primary manuals. Decision: use Doepfer's vactrol basics ranges and tune by
  ear/test targets: fast attack, slow nonlinear decay, and damped tail control.
- Unknown: exact Buchla 292 filter topology and response are not modeled.
  Decision: use a stable musical 2-pole/TPT low-pass approximation and document
  it as inspired-by.
- UI assumption: a labeled three-position mode selector may require a custom
  render function, because the current declarative switch helper is binary and
  button banks display numeric values.

## Test Targets

1. Initialization
   - Creates `params`, `inputs`, `outputs`, and `leds` with the documented keys.
   - Output buffer length matches `bufferSize`.
   - Defaults are `level: 0`, `damp: 0.35`, `tone: 0.65`, `resonance: 0`,
     `mode: 1`.
2. Output ranges and buffer integrity
   - With silence input, output is all zeros and finite.
   - With +/-5 V input and full-open CV, output remains finite and within the
     intended soft-limit range.
   - Every output sample is written; no NaN/Infinity at extreme params/CV.
3. Level control
   - `level = 0` and no CV/strike closes the gate.
   - `level = 1` passes a steady signal in VCA mode and opens cutoff in combo/LP
     modes.
4. Main CV
   - 0 V CV does not open the gate by itself.
   - 5 V CV opens to nominal full level/cutoff.
   - 10 V CV clamps safely, with no extra gain runaway.
5. Strike input
   - Rising edge at >= 1 V creates a pluck envelope.
   - Held high does not retrigger until the input falls below threshold and rises
     again.
   - A 5-10 ms trigger produces audible nonzero output from a sustained input.
6. Damp and Damp CV
   - Higher `damp` shortens the envelope tail and lowers LED tail duration.
   - `dampCV` adds to damping and clamps safely at high voltage.
7. Tone and resonance
   - Lower `tone` produces a darker combo/LP output than higher `tone` for the
     same input/envelope.
   - `resonance` changes LP/Combo spectral level without causing instability.
8. Modes
   - VCA mode changes amplitude without materially darkening the signal.
   - Combo mode changes both amplitude and brightness.
   - LP mode changes brightness while retaining near-unity amplitude when open.
9. LED
   - `leds.open` rises on manual/CV/strike opening and decays with the vactrol
     tail.
10. Reset
   - Clears envelopes, filter states, edge detector, LED, and output buffer.
11. Audio input clearing
   - Follows the rack's audio-path clear pattern so disconnecting the cable
     silences subsequent processing.

## Implementation Plan

- Module ID: `lpg`
- Category: `filter`
- Branch/worktree: implemented via the queue processor's isolated
  implementation subagent workspace and integrated in the coordinator
  workspace.
- DSP model: inspired-by single-channel vactrol LPG with modes VCA, Combo, and
  LP; asymmetric nonlinear envelope controls gain and cutoff; optional limited
  resonance.
- Params: `level`, `damp`, `tone`, `resonance`, `mode`
- Inputs: `audio`, `cv`, `strike`, `dampCV`
- Outputs: `out`
- LEDs: `open`
- Factory patch: `src/js/config/patches/test-lpg.js`, using VCO audio through
  LPG, clocked strikes, visible scope monitoring, and final audio output.
- Focused tests: `tests/dsp/lpg.test.js` covering the targets above plus
  `tests/rack/module-contracts.test.js` and `tests/research/module-queue.test.js`.
- Focused validation command:
  `npm test -- tests/dsp/lpg.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Patch validation command:
  `npm test -- tests/config/factory-patches.test.js tests/app/patch-format.test.js`
- Full validation command: `npm test`
- Known assumptions: no exact hardware time constants; use deterministic vactrol
  approximation; use app voltage standards rather than Optomix 8 V nominal
  control; custom UI may be needed for labeled three-position mode control.
- Shared framework changes: none required. If the implementation wants labeled
  multi-position declarative controls, that should be planned separately; a
  custom renderer is sufficient for this module.

## Sources

- [Buchla & Tiptop Audio - Eurorack 200 series](https://tiptopaudio.com/buchla/)
  - Buchla & Tiptop Audio, current product/project page, accessed 2026-07-09.
  Supports: 200 series Eurorack context, 292t product identity, shipping status,
  manual link, size/price context.
- [Buchla & Tiptop Audio 292t Manual](https://tiptopaudio.com/manuals/Buchla_%26_Tiptop_Audio_292t.pdf)
  - Buchla & Tiptop Audio, one-page PDF manual, accessed 2026-07-09. Supports:
  four-channel 292t panel contract, gate/combo/lopass modes, individual/all
  outputs, manual offsets, combo ringing, lopass ping/snap note.
- [Make Noise Optomix product page](https://www.makenoisemusic.com/modules/optomix/)
  - Make Noise Music, current product page, accessed 2026-07-09. Supports:
  two-channel LPG purpose, VCFA description, revision 2 features, direct-coupled
  processing, four vactrols, `Strike`/`Damp` feature summary, embedded "Optomix
  New Features" official video.
- [Make Noise Optomix Manual](https://www.makenoise-manuals.com/optomix/optomix-manual.pdf)
  - Tony Rolando / Make Noise, Optomix manual PDF, accessed 2026-07-09. Supports:
  detailed panel controls, 10 Vpp signal/output ranges, 0-8 V control/damp CV,
  8 V `Strike`, `Damp` behavior, vactrol response notes, bleed/ringing, patch
  ideas including bongo, FM pings, accents, palm mute, and side-chain examples.
- [Doepfer A-101-2 Vactrol Low Pass Gate](https://doepfer.de/a1012.htm)
  - Doepfer Musikelektronik, product page/manual summary, accessed 2026-07-09.
  Supports: Buchla 292 inspiration, Don Buchla term attribution, LP/VCA/LP+VCA
  mode behavior, 12 dB low-pass, resonance/self-oscillation, vactrol bleed,
  DC-coupled operation, mode gate inputs, input overdrive note, linked Raul Pena
  tutorial demos.
- [Doepfer Vactrol Basics](https://doepfer.de/a100_man/Vactrol.htm)
  - Doepfer Musikelektronik technical note, accessed 2026-07-09. Supports:
  vactrol construction, nonlinear LED-current/LDR-resistance response, part
  variance, soft/mellow subjective behavior, slow asymmetric response, bright
  response in the 10 ms range, dark resistance taking seconds.
- [Raul Pena / Doepfer A101-2 LPG Modes Intro](http://www.youtube.com/watch?v=pDzjCjrEjs8)
  - Tutorial video linked by Doepfer from the A-101-2 page, accessed 2026-07-09.
  Supports: practical mode demonstration lane.
- [Raul Pena / Doepfer A101-2 Low Pass Gate - VCA Mode](http://www.youtube.com/watch?v=ZEwiDnk--tI)
  - Tutorial video linked by Doepfer from the A-101-2 page, accessed 2026-07-09.
  Supports: practical VCA mode demonstration lane.
- [Raul Pena / Doepfer A101-2 Low Pass Gate - Combined Mode](http://www.youtube.com/watch?v=5LrlNuIIeu4)
  - Tutorial video linked by Doepfer from the A-101-2 page, accessed 2026-07-09.
  Supports: practical combined LP+VCA mode demonstration lane.
- [Mutable Instruments eurorack - Streams vactrol.cc](https://github.com/pichenettes/eurorack/blob/master/streams/vactrol.cc)
  - Emilie Gillet / Mutable Instruments, open-source DSP, 2014, accessed
  2026-07-09. Supports: implementation reference for digital vactrol modeling
  using asymmetric attack/decay, plucked mode, memory/sensitization, nonlinear
  amplitude and cutoff mappings.
- [Mutable Instruments eurorack - Streams vactrol.h](https://github.com/pichenettes/eurorack/blob/master/streams/vactrol.h)
  - Emilie Gillet / Mutable Instruments, open-source DSP header, 2014, accessed
  2026-07-09. Supports: interface/state reference for the Streams vactrol DSP
  model.
- [Vadim Zavalishin - The Art of VA Filter Design, rev. 2.1.2](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.2.pdf)
  - Vadim Zavalishin / Native Instruments, 2020 PDF, accessed 2026-07-09.
  Supports: TPT/zero-delay virtual analog filter background, one-pole and state
  variable filter implementation choices, stable audio-rate modulation approach.
- [Julius O. Smith - Introduction to Digital Filters with Audio Applications](https://ccrma.stanford.edu/~jos/filters/)
  - CCRMA/Stanford online text, accessed 2026-07-09. Supports: general digital
  low-pass/filter implementation reference and test reasoning for stable IIR
  filters.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/lpg.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
