# Compressor/Limiter (comp)

## Hardware Reference
- **Working model**: App-adapted stereo-linked feed-forward compressor/limiter for dynamics control, sidechain pumping, and output protection.
- **Primary Eurorack references**: Cosmotronic Messor and WMD MSCL.
- **Context reference**: Intellijel Jellysquasher for analog-color compressor context; RaneNote 155 for general dynamics processor terminology and applications.
- **Review/demo references**: Official Cosmotronic Messor stereo compressor demo and official WMD MSCL features/controls video. ModularGrid pages provide community/practical cross-checks for Messor and MSCL specs and usage language.
- **DSP references**: Giannoulis/Massberg/Reiss AES compressor tutorial, W3C Web Audio `DynamicsCompressorNode`, JUCE `dsp::Compressor`, and recent DAFx 2026 compressor-model evaluation work.

## Specifications

### Source-Derived Behavior
- Cosmotronic describes Messor as a VCA-based feed-forward stereo compressor with a low-noise signal path, an internal sidechain, switchable high-pass/low-pass sidechain filtering, a precision envelope follower, attack, release, threshold, ratio, makeup gain, ratio settings beyond limiting into over-compression, CV inputs for attack, release, sidechain filter cutoff, and gain CV that can act as a stereo VCA when the gain knob is down.
- ModularGrid's manufacturer-approved Messor listing adds practical behavior language: squashing drums, sidechaining kicks, sculpting transients, glueing a mix, exposing the gain-reduction envelope as an output, bypass switching, warm mode, external sidechain insertion, and analog tube-simulation color.
- WMD describes MSCL as a 4 HP stereo analog bus compressor inspired by dbx "Over Easy" behavior. It has attack and release knobs, output gain, a combined compression knob that decreases threshold while increasing makeup gain and ratio, a sidechain input for ducking, threshold ranges for different signal amplitudes, and a limit switch that makes it operate more like a peak limiter.
- The WMD product text gives concrete ranges useful for app translation: ratio from 1.25:1 to infinity:1, attack response from 0.15 ms/dB to 0.1 s/dB, release response from 0.6 ms/dB to 4 s/dB, output gain up to +/-35 dB, threshold ranges of +5 dBu, -4 dBu, and -15 dBu, and limit-switch makeup caps.
- Intellijel describes Jellysquasher as an analog compressor designed to color and transform audio, using an RMS detector, tube/tape emulator circuits, and transformer coloration. This supports documenting color/compression as a known Eurorack workflow, but not as a required first implementation.
- Rane's dynamics processor note defines the common architecture as a gain-control element in the signal path plus a sidechain with detector and gain computer, and explains threshold, ratio, attack, release, makeup gain, sidechain/key inputs, stereo linking, soft knee, and frequency-sensitive sidechain filtering.

### App Panel Contract
- **Module ID**: `comp`
- **Name**: `COMP`
- **Category**: `utility`
- **Suggested width**: 8 HP.
- **Knobs**:
  - `threshold`: compression threshold. UI 0..1 maps to -36 dB to 0 dB relative to 5 V peak full-scale. Default -12 dB.
  - `ratio`: compression ratio. UI 0..1 maps exponentially from 1:1 to 20:1; `limit` mode forces at least 20:1. Default about 4:1.
  - `attack`: gain-reduction attack time. UI 0..1 maps exponentially from 0.1 ms to 100 ms. Default about 10 ms.
  - `release`: gain-recovery release time. UI 0..1 maps exponentially from 10 ms to 4000 ms. Default about 250 ms.
  - `makeup`: output makeup gain. UI 0..1 maps from -12 dB to +18 dB. Default 0 dB.
  - `sideFilter`: sidechain filter cutoff. UI 0..1 maps exponentially from 20 Hz to 8 kHz. Default about 120 Hz.
  - `mix`: dry/wet blend for parallel compression. 0 = dry, 1 = fully processed. Default 1.
- **Switches**:
  - `mode`: `Comp` / `Limit`. Limit mode uses peak detection, minimum 20:1 ratio, faster attack cap, and the same final +/-5 V ceiling.
  - `detector`: `RMS` / `Peak`. RMS is smoother for bus compression; peak is better for protection and snappy ducking.
  - `filterMode`: `Off` / `HP` / `LP`. High-pass reduces kick/bass sensitivity for glue; low-pass can make bass/kick drive pumping.
  - `bypass`: `On` / `Byp`. Bypass passes dry input to output while still updating input meters is optional; first implementation may bypass DSP and LEDs except output level.
- **Inputs**:
  - `inL`, `inR`: stereo audio inputs, type `audio`.
  - `sidechain`: external key/sidechain audio input, type `audio`.
  - `thresholdCV`: threshold modulation input, type `cv`.
  - `attackCV`: attack modulation input, type `cv`.
  - `releaseCV`: release modulation input, type `cv`.
  - `makeupCV`: makeup gain modulation input, type `cv`.
  - `filterCV`: sidechain filter cutoff modulation input, type `cv`.
- **Outputs**:
  - `outL`, `outR`: processed stereo audio outputs, type `audio`.
  - `env`: sidechain envelope follower output, type `cv`.
  - `gr`: gain-reduction amount output, type `cv`.
- **LEDs**:
  - `level`: output peak level, normalized so 5 V peak is full brightness.
  - `gainReduction`: gain-reduction meter, 0 = no reduction, 1 = 30 dB or more reduction.
  - `limit`: lights when limit mode or final ceiling clamps output.
- **Normalization**:
  - Unpatched `inL` and `inR` read 0 V.
  - If `inR` is unpatched and `inL` is patched, process mono-to-dual by using `inL` for both channels. This mirrors common stereo utility expectations and makes one-cable use practical.
  - If `sidechain` is unpatched, derive the detector from linked program input using the higher linked level of L/R.
  - Unpatched CV inputs are 0 V offsets.
- **Not included in first pass**:
  - Analog transformer/tube/tape color circuits from Jellysquasher or Messor warm mode.
  - Full multiband compression.
  - True lookahead limiting with delay compensation.
  - Hardware-calibrated dBu thresholds.

## Voltage Contract
- Audio inputs expect the app's normal +/-5 V audio range and should tolerate moderate over-range without NaN or Infinity. Detector math clamps absolute level to a small positive floor before converting to dB.
- Audio outputs are protected to +/-5 V. Compressor makeup can drive the signal into the final limiter; clipping/limiting updates the `limit` LED.
- Threshold uses dB relative to 5 V peak full-scale, not hardware dBu. `threshold = -12 dB` means compression begins when the detector level is about 1.25 V peak-equivalent.
- `thresholdCV` is bipolar: 1 V raises threshold by 6 dB, -1 V lowers it by 6 dB, clamped to -48 dB..+6 dB.
- `attackCV` and `releaseCV` shift the normalized knob position before log mapping. 5 V shifts by +0.5; -5 V shifts by -0.5; clamp to 0..1. Higher values mean slower times.
- `makeupCV` is bipolar: 1 V adds 6 dB makeup, -1 V subtracts 6 dB, clamped to -24 dB..+24 dB.
- `filterCV` is musical/octave-style: 1 V doubles cutoff and -1 V halves it, clamped to 20 Hz..8 kHz.
- `env` outputs 0..10 V. 10 V represents detector level at or above 5 V peak-equivalent.
- `gr` outputs 0..10 V. 10 V represents 30 dB or more of gain reduction.
- No gate, trigger, clock, reset, or pitch-CV behavior is present.

## DSP Implementation

### Algorithm Overview
Use a clean digital feed-forward compressor with stereo-linked gain reduction:

1. Read `inL` and `inR`; if right is unpatched, use left for the right processing path.
2. Select detector source:
   - external `sidechain` when patched;
   - otherwise linked program detector using the max of L/R detector magnitudes.
3. Apply optional sidechain filter:
   - `Off`: detector unchanged;
   - `HP`: one-pole high-pass at `sideFilter` cutoff;
   - `LP`: one-pole low-pass at `sideFilter` cutoff.
4. Calculate detector level:
   - `Peak`: absolute value.
   - `RMS`: one-pole smoothed square mean followed by square root.
5. Convert detector level to dB relative to 5 V peak full-scale: `levelDb = 20 * log10(level / 5)`.
6. Apply static compression curve:
   - Below threshold: 0 dB gain reduction.
   - Above threshold: `reductionDb = overDb * (1 - 1 / ratio)`.
   - Soft-knee width: fixed 6 dB in compressor mode; 0 dB hard knee in limiter mode.
7. Smooth gain reduction in the dB domain with attack/release coefficients. When target reduction is greater than current reduction, use attack; when target reduction falls, use release.
8. Convert smoothed reduction and makeup to linear gain and apply the same gain to L/R to preserve stereo image.
9. Blend processed and dry signals with `mix`.
10. Apply final +/-5 V ceiling. Limit mode should use a hard ceiling; compressor mode may use a short soft-clip transition into the same ceiling.
11. Emit `env`, `gr`, and LED states once per buffer with short decay/hold so meters are readable.

### DSP Trade-Offs
- **Feed-forward, not feedback**: Chosen because Giannoulis/Massberg/Reiss recommend feed-forward designs as stable and predictable. Messor also describes feed-forward hardware behavior.
- **Clean utility first**: Messor and Jellysquasher include analog color options. The first app module should prioritize predictable bus compression and patch safety. Saturation can become a later optional `warm` switch once the core contract is covered by tests.
- **No lookahead initially**: Lookahead improves peak catching but adds latency and extra buffering. For eurorack-js, zero-added-latency patching is more important; final output limiting protects the rack.
- **Stereo-linked gain reduction**: Stereo linking avoids image shifts and follows bus-compressor practice. Separate dual-mono compression can be a future switch if needed.
- **dB-relative voltage mapping**: Hardware sources use dBu and analog headroom. The app uses 5 V peak as the audio reference so test expectations remain deterministic.
- **CV modulation is parameter-offset based**: This keeps CV predictable, avoids zipper noise by smoothing time/gain targets, and maps well to existing eurorack-js CV conventions.

### Observed Behavior From Reviews/Demos
- Messor's official page and ModularGrid listing frame the module around drum squashing, kick sidechain pumping, transient sculpting, mix glue, envelope output patching, and optional warm analog compression.
- The official Cosmotronic video is titled "Cosmotronic Messor - stereo compressor demo"; source metadata confirms it is a manufacturer demo focused on stereo compressor behavior, but the fetched metadata does not expose detailed patch settings.
- WMD's official page and ModularGrid listing frame MSCL as a compact master-bus compressor with easy controls, sidechain ducking, and a limiter-oriented mode for peaks.
- The official WMD video is titled "WMD MSCL - Features and Controls"; source metadata confirms a manufacturer walkthrough. The product text provides the more reliable control ranges.
- ModularGrid ratings/rack counts show both Messor and MSCL are established Eurorack compressor references, but community ratings are secondary evidence only and should not override manufacturer specs.

### Source Quality Notes
- Manufacturer product pages and manuals win for panel contract, control names, and electrical/mechanical facts.
- ModularGrid is useful for cross-checking HP, tags, panel imagery, rack adoption, and concise feature summaries. It can contain user edits, except Messor's listing is marked manufacturer-approved.
- Official YouTube oEmbed metadata identifies demos and channels, but does not provide enough detail for exact sonic settings. Do not infer exact attack/release behavior from video titles.
- RaneNote 155 is a general pro-audio reference, not Eurorack-specific. Use it for terminology and compressor topology, not app voltage ranges.
- AES/W3C/JUCE sources are stronger for digital algorithm design than hardware pages. The AES paper is the main DSP reference for feed-forward architecture, soft-knee/gain-computer choices, and evaluation language.
- The 2026 arXiv/DAFx paper is useful for validation thinking: gain-reduction/control-voltage trajectories are meaningful compressor-model targets. It is not necessary for first-pass DSP implementation.

### Assumptions and Contradictions
- Messor documents attack/release/filter/gain CV but does not publish exact voltage scaling on the fetched product page. The app scales CV in simple musical offsets and documents those assumptions.
- WMD gives dBu threshold ranges and ms-per-dB attack/release rates; Messor's fetched page gives control names but not exact ranges. The app uses dB relative to 5 V full-scale and conventional time-constant mapping.
- WMD combines threshold, ratio, and makeup into one `Comp` knob, while Messor exposes familiar individual controls. The app follows the individual-control model because it is easier to test and more useful as a general utility.
- Messor ratio can go beyond limiting into over-compression. The first app pass caps ratio at 20:1/infinity-equivalent behavior to avoid unstable or inverted dynamics.
- Hardware compressors may pass or generate signals above +/-5 V. The app constrains output to +/-5 V because output protection is part of the queue goal and aligns with eurorack-js audio standards.
- Bypass switching in analog hardware can be hard-switched. The app may crossfade bypass internally to avoid clicks; this is an implementation detail as long as bypass reaches the dry signal quickly and deterministically.

## Test Targets
- Initialization creates default params, own input buffers, output buffers, `env`/`gr` CV buffers, and LED state.
- With no input, outputs are silent, `env` and `gr` are 0 V, LEDs decay to 0, and all buffers remain finite.
- With below-threshold +/-5 V-scaled test signals, output matches input apart from makeup/mix and final ceiling.
- Threshold knob and `thresholdCV` lower/raise the point where gain reduction begins.
- Ratio knob changes above-threshold slope; 1:1 produces no gain reduction and high ratio approaches limiting.
- Attack knob/CV changes how quickly gain reduction rises after a level step.
- Release knob/CV changes how quickly gain reduction recovers after a level drop.
- Makeup knob/CV changes output level after compression and respects final +/-5 V protection.
- `mix` blends dry and compressed signals without phase inversion or NaN.
- `detector` switch differentiates RMS and peak behavior on transient-rich signals.
- `mode` switch forces limiter-like high-ratio/peak behavior and lights `limit` when the ceiling catches peaks.
- `filterMode` and `sideFilter`/`filterCV` change detector sensitivity to low-frequency and high-frequency sidechain material.
- External `sidechain` input causes ducking of program audio when the sidechain crosses threshold.
- Unpatched sidechain falls back to program-linked detection.
- Mono normalization copies left input behavior to right output when right is unpatched.
- Stereo-linked gain applies equal reduction to both channels even when only one channel triggers the detector.
- `env` output follows detector amplitude in 0..10 V range and `gr` follows reduction amount in 0..10 V range.
- LED meters reflect output level, gain reduction, and limiting.
- `bypass` passes dry input and suppresses gain-reduction output or reduces it to 0 depending on final implementation choice; tests should lock whichever behavior is chosen.
- `reset()` clears envelopes, gain-reduction state, filter state, outputs, CV outputs, and LEDs.
- Audio-path input clearing follows the repo pattern so disconnected inputs return to silence immediately.

## Implementation Plan
- Module ID: `comp`
- Category: `utility`
- Branch/worktree: current isolated workspace `/Users/orderandchaos/code/eurorack-js`; research-only pass, no implementation in this task.
- DSP model: stereo-linked clean digital feed-forward compressor/limiter with optional external sidechain, sidechain HP/LP filter, RMS/peak detection, soft knee in compressor mode, hard/fast limiter mode, dB-domain attack/release smoothing, dry/wet blend, final +/-5 V protection, and CV outputs for detector envelope and gain reduction.
- Params: `threshold`, `ratio`, `attack`, `release`, `makeup`, `sideFilter`, `mix`, `mode`, `detector`, `filterMode`, `bypass`.
- Inputs: `inL`, `inR`, `sidechain`, `thresholdCV`, `attackCV`, `releaseCV`, `makeupCV`, `filterCV`.
- Outputs: `outL`, `outR`, `env`, `gr`.
- LEDs: `level`, `gainReduction`, `limit`.
- Factory patch: add `src/js/config/patches/test-comp.js` during implementation, ideally with a drum/kick or clocked envelope sidechain ducking a sustained VCO/noise/mix signal into `out`; no patch changes in this research-only task.
- Focused tests: `npm test -- tests/dsp/comp.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Full validation command: `npm test`
- Known assumptions: app dBFS reference is 5 V peak; output ceiling is +/-5 V; CV scales are app-defined; no analog warm/color modeling in first pass; no lookahead latency in first pass; stereo-linked behavior only unless a future dual-mono mode is added.
- Shared framework changes required: none expected.

## Potential Improvements
- Add `warm` saturation mode inspired by Messor/Jellysquasher after the clean compressor passes tests.
- Add a lookahead limiter mode if patch latency is acceptable and the engine can tolerate per-module delay.
- Add dual-mono/stereo-link switch for creative stereo movement.
- Add a custom meter UI with gain-reduction and output bargraphs if the declarative LED list is too cramped.
- Add selectable knee width as an advanced control if users need hard-knee transient shaping.

## Sources
- [Cosmotronic Messor official page](https://cosmotronic.nl/modules/messor/) - Cosmotronic, current product page, accessed 2026-07-09, supports: VCA feed-forward stereo compressor, sidechain HP/LP filter, envelope follower, attack/release/threshold/ratio/makeup controls, ratio beyond limiting, CV inputs for attack/release/filter/gain, stereo VCA behavior, demo link, HP/current/depth context.
- [Cosmotronic Messor manual PDF](https://drive.google.com/file/d/1N3yUDQhhb-rLvTK2UfMwucxCgW51emRw/view?usp=drive_link) - Cosmotronic, manual linked from official page, accessed 2026-07-09, supports: primary manual source for Messor; local text extraction unavailable because `pdftotext` is not installed.
- [Cosmotronic Messor on ModularGrid](https://www.modulargrid.net/e/cosmotronic-messor) - ModularGrid, manufacturer-approved module listing, accessed 2026-07-09, supports: 8 HP, depth/current, tags, external sidechain, gain-reduction envelope output, bypass, warm mode, use cases, community/rack context.
- [Cosmotronic Messor - stereo compressor demo](https://www.youtube.com/watch?v=LW0PzIdeU8U) - Cosmotronic, YouTube video metadata via oEmbed, accessed 2026-07-09, supports: official demo source identity and title.
- [WMD MSCL official page](https://wmdevices.com/products/mscl) - WMD, current product page, accessed 2026-07-09, supports: 4 HP stereo analog compressor, dbx Over Easy inspiration, sidechain input, threshold range switch, limit switch, ratio/attack/release/gain ranges, control layout, product video ID.
- [WMD MSCL manual PDF](https://wmdevices.com/cdn/shop/files/MSCL_Manual_v0.2_1.pdf?v=7194095899743142384) - WMD, manual linked from official page, accessed 2026-07-09, supports: primary manual source for MSCL.
- [WMD MSCL on ModularGrid](https://www.modulargrid.net/e/wmd-mscl) - ModularGrid, module database page, accessed 2026-07-09, supports: 4 HP/depth/current cross-check, sidechain ducking, threshold/limit switch behavior, RMS/adaptive detector note, impedance notes, green/red gain-reduction indicator, AC/DC coupling notes, community context.
- [WMD MSCL - Features and Controls](https://www.youtube.com/watch?v=o2F12clNH_E) - WMDevices, YouTube video metadata via oEmbed, accessed 2026-07-09, supports: official features/control demo identity and title.
- [Intellijel Jellysquasher](https://intellijel.com/shop/eurorack/jellysquasher/) - Intellijel Designs, legacy product page, accessed 2026-07-09, supports: colored analog Eurorack compressor context, RMS detector, tube/tape emulator and transformer coloration as intentionally omitted first-pass features.
- [Dynamics Processors - Technology & Applications](https://www.ranecommercial.com/legacy/note155.html) - Rick Jeffs, Scott Holden, Dennis Bohn, RaneNote 155, September 2005, accessed 2026-07-09, supports: dynamics processor topology, sidechain/key input, stereo linking, threshold/ratio/attack/release/makeup definitions, soft-knee and frequency-sensitive sidechain context.
- [Digital Dynamic Range Compressor Design - A Tutorial and Analysis](https://aes.org/publications/elibrary-page/?id=16354) - Dimitrios Giannoulis, Michael Massberg, Joshua D. Reiss, Journal of the Audio Engineering Society 60(6), 2012, accessed 2026-07-09, supports: feed-forward digital compressor recommendation, nonlinear/memory nature, gain-computer/detector design choices, objective compressor-performance framing.
- [Web Audio API 1.1 - DynamicsCompressorNode](https://www.w3.org/TR/webaudio/#DynamicsCompressorNode) - W3C Web Audio Working Group, First Public Working Draft 2024-11-05, accessed 2026-07-09, supports: web-native compressor parameters, `reduction` metering, soft-knee compression curve requirements, internal pre-delay/gain/envelope follower processing model.
- [JUCE dsp::Compressor documentation](https://docs.juce.com/master/classjuce_1_1dsp_1_1Compressor.html) - Raw Material Software/JUCE, accessed 2026-07-09, supports: standard digital compressor API with threshold, ratio, attack, release, reset, and sample/block processing.
- [Evaluating Dynamic Range Compressor Models Using Control-Voltage Measurements](https://arxiv.org/abs/2606.18573) - Benjamin R. Thompson and Michael C. Heilemann, arXiv/accepted to DAFx 2026, submitted 2026-06-17, accessed 2026-07-09, supports: importance of gain-reduction/control-voltage trajectories for compressor model evaluation and test target thinking.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Before remediation**: `env` (cv) measured 0.00..10.00 V against -5..5 V; `gr` (cv) measured 0.00..10.00 V against -5..5 V
- **After remediation**: Envelope and gain-reduction outputs now declare 0..10 V; strict matrix passes.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/comp.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Status**: confirmed contract and range findings are resolved; broader listening and characterization work remains tracked centrally.
