# Per-Module Sound and Contract Audit

Started: 2026-07-30

This board tracks the individual audit requested after user feedback exposed
audible defects that the generic DSP matrix did not detect.

## Acceptance gates

A module is `complete` only when:

1. Its research record identifies the intended hardware or utility behavior,
   voltage and normalization contracts, assumptions, and contradictions.
2. Every control, CV/gate/trigger input, mode, output, LED, reset path, and
   persistent/runtime state has focused behavioral coverage.
3. Relevant discontinuity risks are exercised: zero crossings, cable changes,
   control and mode transitions, trigger coincidence, voltage rails, feedback,
   and buffer boundaries.
4. It passes the supported sample-rate/block-size DSP matrix with strict voltage
   checks and stable buffer identities.
5. Audio modules have an objective render comparison or characterization;
   modules with meaningful real-time cost have AudioWorklet profiling evidence.
6. Confirmed defects are fixed and recorded in the module research file.

Statuses: `pending`, `in-progress`, `complete`, `blocked`.

## Audit board

| Module | Risk group | Status | Evidence / next focus |
|---|---|---|---|
| `midi-cv` | MIDI/event timing | complete | Sample-offset notes, held-note/legato/retrigger, expression bounds/reset; strict matrix |
| `midi-4` | MIDI/event timing | complete | Correct oldest-voice steal, chord/sample offsets, bend/finite/reset; strict matrix |
| `midi-cc` | MIDI/event timing | complete | Bounded CC/channel mapping, invariant 5ms slew, finite/reset; strict matrix |
| `midi-clk` | MIDI/event timing | complete | Exact transport offsets, immediate Stop closure, divisions/pulses/reset; strict matrix |
| `midi-drum` | MIDI/event timing | complete | Duplicate mappings, simultaneous hits, channel/velocity/pulse/reset; strict matrix |
| `clk` | Clock | complete | Immediate Pause closure, LED/pulse separation, CV/reset/rails; strict matrix |
| `div` | Clock/normalization | complete | Natural disconnect expiry, exact multiplication timing, rails/reset/LEDs; strict matrix |
| `swing` | Clock/normalization | complete | Causal disconnect drain, finite scheduling, exact templates/CV/width/reset; strict matrix |
| `burst` | Clock | complete | NaN deadline fix, retrigger/cycle/distribution/CV/pulse/reset contracts; strict matrix |
| `gate-delay` | Clock | complete | Exact zero/cross-block timing, retrigger, 50ms LEDs, finite/stable reset; strict matrix |
| `lfo` | Modulation | complete | Per-sample Rate/Wave/Reset, reachable shape endpoints, defaults/rails/reset; strict matrix |
| `quad-lfo` | Modulation | complete | Exact quadrature/CV/Reset/Hold timing, finite ranges, rails/stable reset; strict matrix |
| `nse` | Source | complete | Invariant downsampling, continuous retrigger, mode/reset/default/finite/rails; strict matrix |
| `sh` | Utility | complete | Continuous slew range, bypass-state sync, invariant timing/reset; strict matrix |
| `quant` | Quantizer | complete | Negative octave boundaries, 8ms trigger, defaults/ranges/reset; strict matrix |
| `arp` | Sequencer | complete | Chord CV/reset feedback remediation; strict matrix |
| `seq` | Sequencer | complete | Correct 2x/pendulum repeats, reset priority, bounds/reset; strict matrix |
| `seq-switch` | Sequencer/audio | complete | Measured 1ms crossfade, trigger/reset/voltage/reset contracts; strict matrix |
| `euclid` | Sequencer/normalization | complete | Exact 8ms pulse, per-sample CV, reset priority, allocation-free pattern; strict matrix |
| `logic` | Utility | complete | Manual-correct 4 inputs/>2.5V/5V, cable normals, patch update; strict matrix |
| `mult` | Utility | complete | Cable-state IN2 normal, exact six-way fan-out/reset; strict matrix |
| `matrix` | Utility/audio | complete | 16 route slews/cells, polarity transitions, DC/rails/reset; strict matrix |
| `joystick` | Utility/modulation | complete | Reset priority, range slew, allocation-free gestures, CV/reset contracts; strict matrix |
| `vco` | Oscillator | complete | PolyBLEP -13.71dB alias comparison, Sync/CV/reset/rails; strict matrix |
| `wavetable` | Oscillator | complete | Bank/replica crossfades, <-100dB coherent alias bins; strict matrix |
| `complex-vco` | Oscillator | complete | Smooth partial guard, -62.24dB core aliases, normals/reset; strict matrix |
| `ensemble-vco` | Oscillator | complete | Per-sample CV/freeze fix, stable Cross-FM, 44-scenario CPU matrix |
| `pluck` | Voice | complete | Sample-rate-invariant damping/excitation, CV/reset/polyphony; strict matrix |
| `vcf` | Filter | complete | Deterministic self-oscillation, CV/reset/three-output coverage; strict matrix |
| `lpg` | Filter/nonlinear | complete | Mode crossfade, voltage/reset/envelope/rails coverage; strict matrix |
| `formant` | Filter/nonlinear | complete | 5ms Mix/Drive slew, CV/reset/limiter coverage; strict matrix |
| `resbank` | Filter/voice | complete | Cable-state Audio/Strum normals, models/polyphony/reset; strict matrix |
| `fold` | Nonlinear | complete | First-order ADAA, measured -8.26 dB reflected-harmonic power; strict matrix |
| `ring` | Nonlinear | complete | Four-quadrant scaling, continuous rail/reset, bandwidth note; strict matrix |
| `rnd` | Modulation | complete | Cable-owned external timing/probability, invariant slew, continuous Amp/finite/reset; strict matrix |
| `envf` | Modulation | complete | Exact threshold, invariant 1/10/10/100ms timing, complement/finite/reset; strict matrix |
| `func` | Modulation | complete | Cable-state slew mode, non-retriggering cycle, exact 5ms EOR/EOC, finite/reset; strict matrix |
| `adsr` | Modulation | complete | Correct 2ms Attack, Gate/Retrig priority, exact 5ms EOC, CV/finite/reset; strict matrix |
| `vca` | Utility/audio | complete | Default/CV-normal alignment, startup/reset slew, finite DC transfer; strict matrix |
| `atten` | Utility | complete | Explicit 0V normals, finite recovery, stable reset/LED, exact endpoints; strict matrix |
| `slew` | Utility | complete | Exact bypass, 200ms invariant RC timing, CV/reset/finite contracts; strict matrix |
| `dly` | Effect | complete | Full-range 0-5V CV, invariant damping, reset/rails; strict matrix |
| `tape` | Effect | complete | Time slew/head crossfade, tap/clock/freeze characterization; strict matrix |
| `verb` | Effect/normalization | complete | Stereo normalization/limiter remediation; patch render |
| `chorus` | Effect | complete | Cable-state mono normal, stereo decorrelation, continuous rails; strict matrix |
| `phaser` | Effect | complete | Cable-state mono normal, allpass/feedback/reset coverage; strict matrix |
| `flanger` | Effect | complete | Cable-state mono normal, bipolar feedback/reset coverage; strict matrix |
| `crush` | Effect/nonlinear | complete | Cable-state mono normal, quantize/hold/reset/rails; strict matrix |
| `loop` | Effect/state | complete | Endpoint/clear de-click, triggers, modes, runtime/reset; strict matrix |
| `granulita` | Effect/normalization | complete | Stereo/rail/chord/allocation/mode scheduling fixes; strict matrix |
| `db` | Utility/analyzer | complete | Correct 300ms VU/-20dB peak timing, real combined peak, passthrough/reset; strict matrix |
| `pwm` | Utility/audio | complete | Correct CV scale, sub-sample edges (-4.93dB aliases), reset; strict matrix |
| `turing` | Sequencer/normalization | complete | Default/Scale fix, bounded probability/pulse, allocation/reset contracts; strict matrix |
| `ochd` | Modulation | complete | Correct 160Hz/25min rates, CV attenuverter/stall, per-sample finite/reset; strict matrix |
| `cmp2` | Utility/normalization | complete | Cable-state signal/CV normals fixed; focused tests and strict matrix |
| `comp` | Effect/normalization | complete | Cable-state R/sidechain normals fixed; transient tests and strict matrix |
| `kick` | Voice/nonlinear | complete | Per-sample CV, bounded pitch, trigger/decay/tone/click/finite/rails/reset; strict matrix |
| `snare` | Voice/nonlinear | complete | Per-sample CV, bounded pitch, deterministic noise/reset, body/snap/decay/rails; strict matrix |
| `hat` | Voice/nonlinear | complete | Closed-trigger priority/choke, Nyquist-safe filter, deterministic noise/reset/rails; strict matrix |
| `mix` | Utility/audio | complete | 5ms level slew, invariant transition, DC sums/reset/rails; strict matrix |
| `scope` | Analyzer | complete | Trigger/tune/passthrough/telemetry finite containment and full reset; strict matrix |
| `spectrum` | Analyzer | complete | Calibrated FFT, invariant dB/s peak release, passthrough/finite/reset/CPU; strict matrix |
| `plot` | Analyzer | complete | Trigger/capture/stats/passthrough/time/finite/reset; strict matrix |
| `spectrogram` | Analyzer | complete | Calibrated FFT, bounded history/freeze/export/passthrough/finite/reset; strict matrix |
| `rec` | Recorder | complete | Exact sample bounds/chunks/events/WAV, finite stereo passthrough/reset; strict matrix |
| `out` | Output | complete | Bounded volume/samples/mix, normalized WebAudio bridge, metering/reset; strict matrix |
