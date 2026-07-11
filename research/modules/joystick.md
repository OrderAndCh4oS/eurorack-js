# Joystick Controller (joystick)

## Hardware Reference
- **Primary inspiration**: Intellijel Planar 2, Flight of Harmony Choices, and Buchla performance-controller history.
- **Primary manuals/pages**:
  - Intellijel Planar 2 product page and Planar 2 Manual v1.3, revision 2024.04.16.
  - Flight of Harmony Choices r1.1 User's Manual, edition 1, 2009-04.
  - Buchla 223e Multi-Dimensional Kinesthetic Input / Tactile Input Port and 227e System Interface product records, plus Buchla history page.
- **Practical secondary references**: ModularGrid Flight of Harmony Choices and Perfect Circuit Intellijel Planar 2 product/demo page.
- **Reviews/demos**: Perfect Circuit-hosted Planar 2 demo descriptions document joystick movement recording, one-shot/loop playback, six CV outputs plus gate, and 4-to-1 / 1-to-4 mixing use. Flight of Harmony's own manual points users to Muffwiggler demos, but no stable direct demo URL was found in this pass.
- **DSP references**: Julius O. Smith, CCRMA Physical Audio Signal Processing sections on linear interpolation and delay-line interpolation; existing local `rnd`, `atten`, `loop`, and `slew` patterns for CV ranges, gate pulses, gesture buffering, and smoothing.

## Specifications

### Source-Derived Behavior
- Intellijel Planar 2 is a 14 HP recordable vector joystick. It provides X/Y CV outputs, four quadrant A-D outputs, gate output, CV inputs with attenuverters, cartesian/polar/scan CV modes, manual gate, movement-sense gate, record/play/loop controls, trigger-synced recording/playback, and optional quad mixing/panning/routing when audio/CV is patched to A-D inputs.
- Planar 2 X/Y outputs can be switched per axis between 0V to +10V unipolar and -5V to +5V bipolar. A-D outputs act as 0V to +10V CV sources when A-D inputs are unpatched.
- Planar 2's CV input modes are:
  - Cartesian: CV 1 controls X, CV 2 controls Y.
  - Polar: CV 1 controls rotation, CV 2 controls radius.
  - Scan: CV 1 scans through a recorded gesture and CV 2 changes scan linearity.
- Planar 2 can record joystick movements and manual gates, play them once as a complex envelope, loop them as an LFO-like function, or trigger/retrigger playback from its trigger input.
- Flight of Harmony Choices is a simpler 14 HP X/Y joystick utility. It has X/Y inputs and outputs, scale and offset controls, AC/DC reference switches, gate and trigger outputs, and two trigger/gate buttons. Its manual specifies direct coupling, 0-200% scaling, +/-5V offset, max output around the supply rails, and 1.5 ms trigger duration.
- Buchla's controller lineage emphasizes non-keyboard, multi-dimensional performance interfaces. The 223e uses a tactile surface with velocity, pressure, and one/two-dimensional location sensing, presenting location, pressure, impact, tuned voltages, and pulses on many outputs. The 227e shows the adjacent Buchla spatialization use case: voltage-controllable two-dimensional movement in a four-channel space.

### App Panel Contract
- **Module ID**: `joystick`
- **Name**: `JOY`
- **Category**: `utility`
- **Width**: 10 HP. This is smaller than Planar/Choices because the first app version omits Planar's four audio inputs, MIX output, and full quad panner/mixer.
- **Color token**: `module-color-six`
- **Renderer**: custom renderer recommended. The panel needs an interactive X/Y pad, compact buttons, and live LED state; the generic declarative renderer is not enough for a usable joystick.
- **Params**:
  - `x`: joystick X position, -1..+1, default 0.
  - `y`: joystick Y position, -1..+1, default 0.
  - `range`: 0 = bipolar X/Y, 1 = unipolar X/Y, default 0.
  - `cvMode`: 0 = cartesian, 1 = polar, 2 = scan, default 0.
  - `cv1Amt`: CV 1 attenuverter, UI 0..1 maps to -1..+1, default 0.5.
  - `cv2Amt`: CV 2 attenuverter, UI 0..1 maps to -1..+1, default 0.5.
  - `sense`: movement-sense gate enable, 0/1, default 1.
  - `gateButton`: manual gate button state, 0/1, default 0. This should be momentary in the custom renderer.
  - `record`: record arm/toggle state, 0/1, default 0.
  - `play`: playback running/armed state, 0/1, default 0.
  - `loopMode`: 0 = one-shot, 1 = loop, 2 = trigger-rearmed one-shot, default 1.
- **Inputs**:
  - `cv1`: CV input. Meaning depends on `cvMode`.
  - `cv2`: CV input. Meaning depends on `cvMode`.
  - `trigger`: trigger input for synced recording/playback and retriggering. Rising edge threshold follows the app trigger standard.
  - `reset`: trigger input to stop playback and return the playhead to the start. This is an app utility addition, not a documented Planar control.
- **Outputs**:
  - `x`: X-axis CV.
  - `y`: Y-axis CV.
  - `a`, `b`, `c`, `d`: quadrant CV outputs, mapped clockwise from top-left: A = top-left, B = top-right, C = bottom-right, D = bottom-left.
  - `gate`: manual or movement-sense gate.
  - `trig`: short trigger pulse fired when movement starts or the manual gate rises.
- **LEDs**:
  - `xPositive`, `xNegative`, `yPositive`, `yNegative`: axis polarity/amount indicators.
  - `a`, `b`, `c`, `d`: quadrant output amount indicators.
  - `gate`: high when gate output is high.
  - `record`: high/flash-equivalent when recording or armed.
  - `play`: high when playback is running.
  - `trigger`: brief trigger input/output activity indicator.
- **Normalization**:
  - Unpatched `cv1` and `cv2` read 0V.
  - Unpatched `trigger` and `reset` are idle at 0V.
  - There are no audio inputs in the first implementation; use existing `matrix`, `vca`, and `mix` modules for audio routing or vector mixing patches.

### Voltage Contract
- X/Y internal position is normalized as -1..+1 after joystick, recording playback, and CV automation are combined.
- In bipolar range, `x` and `y` outputs are clamped to -5V..+5V.
- In unipolar range, `x` and `y` outputs are clamped to 0V..+10V to match Planar and the app's existing tolerance for 0-10V CV sources.
- Quadrant outputs are always unipolar 0V..+10V. Use bilinear corner weights from normalized X/Y:
  - `a = (1 - nx) * ny * 10`
  - `b = nx * ny * 10`
  - `c = nx * (1 - ny) * 10`
  - `d = (1 - nx) * (1 - ny) * 10`
  - where `nx = (x + 1) / 2` and `ny = (y + 1) / 2`.
- `gate` outputs 0V low and 10V high. This intentionally adapts Choices' negative-off gate behavior to the app gate standard.
- `trig` outputs a 10V pulse for 5-10 ms. This intentionally lengthens Choices' 1.5 ms trigger to the app trigger standard.
- `trigger` and `reset` inputs detect rising edges above 2.5V.
- Movement-sense gate turns high when the X/Y position changes by more than a small epsilon after smoothing; it remains high for at least one block and goes low once movement is below the threshold.
- Reset clears playback/record state and output buffers, but it should not reset stored params or erase the recorded gesture unless the UI explicitly invokes an erase action.

### Contradictions and Source Quality
- Planar 2 product/retailer descriptions still commonly say "up to 30 seconds" of recording, while the current v1.3 manual and firmware notes document approximately 4 minutes after the 1.2 firmware's 8x loop-time update. The app implementation should choose a bounded buffer such as 30 seconds or 64 seconds for memory predictability unless the coordinator explicitly wants the longer Planar 2 v1.3 behavior.
- Planar is both a controller and a four-channel audio/CV mixer/panner/router. The queued module is a low-risk utility controller, so the first app version should not include A-D audio inputs or MIX output. The `matrix` module already covers general routing/mixing; a future `vector-mix` module could target full Planar-style audio behavior.
- Choices supports AC input processing through X/Y input jacks and AC/DC reference switches. This app module is a DC performance controller; AC processing is intentionally omitted.
- Choices gate/trigger outputs go negative when off because they follow supply rails. The app uses 0V off for gates/triggers everywhere.
- Physical joystick feel, return spring behavior, lubrication, and mechanical tension are not modeled. The browser UI should emulate position and gesture, not hardware friction.
- Buchla 223e pressure/impact/tuned-voltage behavior is historical context only. This module does not attempt to emulate the 223e keypad surface or arpeggiator.

## DSP Implementation

### Algorithm Overview
- Read `x` and `y` params from the UI X/Y pad and clamp to -1..+1.
- If playback is active, replace live joystick position with interpolated samples from the recorded gesture buffer.
- Apply CV automation:
  - Cartesian: add scaled `cv1 / 5` to X and scaled `cv2 / 5` to Y.
  - Polar: interpret `cv1` as rotation over a full turn and `cv2` as radius/depth; add a circular offset to X/Y.
  - Scan: when a recording exists, use `cv1` to choose a read position inside the gesture buffer and `cv2` to curve or reverse scan travel. If no recording exists, scan mode should fall back to live X/Y plus cartesian CV so outputs do not become undefined.
- Smooth final X/Y with a short slew or one-pole filter to avoid zipper noise from pointer updates and automation jumps. Keep smoothing short enough that manual performance feels responsive.
- Convert final X/Y to voltage range and quadrant weights every sample.
- Gate logic:
  - Manual gate is high while `gateButton` is high.
  - Movement gate is high when `sense` is enabled and the smoothed X/Y delta exceeds the movement threshold.
  - Record/playback should store/replay manual and movement gates as a single gate lane.
- Trigger logic:
  - Emit a 5-10 ms pulse on manual gate rising edge or movement gate rising edge.
  - Trigger input rising edge restarts recording when `record` is armed, or starts/retriggers playback according to `loopMode` when a recording exists.
- LED logic follows output state: axis LEDs show signed X/Y level, quadrant LEDs show A-D weights, gate/play/record/trigger LEDs show their associated logic states.

### Gesture Recorder
- Store recorded gestures as a compact array of frames `{ x, y, gate }` at a control rate, not audio rate. A practical target is 250-1000 Hz; this is much higher than UI event rate, low CPU/memory, and adequate for smooth CV gestures after interpolation.
- During recording, sample the smoothed live/CV-combined position and gate lane into a circular or bounded buffer until stopped or max length is reached.
- During playback, use linearly interpolated table lookup for X/Y and nearest/edge reconstruction for gate state.
- Loop playback should optionally use a short ramp/crossfade at the loop boundary to avoid discontinuities. This follows Planar 2's ramped-loop firmware behavior conceptually, without attempting exact firmware timing.
- Trigger-synced one-shot playback should start at frame 0 on the next trigger edge, run to the recorded end, then stop or re-arm depending on `loopMode`.

### Observed Behavior From Reviews/Demos
- Planar 2 demos and retailer descriptions emphasize performance gestures becoming reusable modulation: complex envelopes, LFO-like loops, evolving CV motions, and manual trigger/gate gestures.
- Demo descriptions also stress the value of six simultaneous CV outputs plus a gate: X/Y can control two parameters directly while A-D quadrants create related corner weights for morphing, routing, or macro control.
- Choices is valued as a simpler hands-on utility: scale/offset a joystick motion, choose DC or AC reference behavior, and fire dedicated gate/trigger outputs from the same controller surface.
- Buchla context supports treating the controller as a performance surface rather than a hidden modulation source: the musical value is direct gestural control, recording, and multiple simultaneous derived voltages.

### Key References
- Intellijel Planar 2 official material defines the broad functional envelope: vector joystick, X/Y and A-D outputs, gate generation, CV automation modes, and gesture recording.
- Flight of Harmony Choices defines the simpler joystick utility model: X/Y in/out, scale, offset, gate, trigger, and direct coupling.
- Buchla 223e/227e references justify multi-dimensional control and spatial/quadrant performance as historical context, not as a direct panel clone.
- Julius O. Smith's interpolation references support linearly interpolated gesture playback and loop boundary treatment for smooth CV reconstruction.

### Code Notes
- This should be a custom-rendered module with stable dimensions for the X/Y pad so dragging does not resize the panel.
- Keep the DSP pure and deterministic aside from UI-driven params; no random generation is needed.
- Expose recorded-buffer state through DSP internals only as needed for the renderer. Persisting recordings in patch files is a future feature; first implementation can treat recordings as runtime state.
- Do not use audio input clearing patterns because this first module has no audio inputs.

## Test Targets
- Initialization creates all params, input buffers, output buffers, LEDs, and empty recorder state.
- Default centered joystick outputs 0V on bipolar X/Y, 5V on unipolar X/Y, and 2.5V on each quadrant output.
- X/Y extremes produce correct bipolar and unipolar voltages and correct quadrant corner weights.
- Each param is clamped: `x`, `y`, `range`, `cvMode`, `cv1Amt`, `cv2Amt`, `sense`, `gateButton`, `record`, `play`, and `loopMode`.
- Cartesian CV input moves X/Y according to attenuverter polarity and clamps to valid position/range.
- Polar CV input can create a circular offset from rotation/radius values and handles zero radius without NaN.
- Scan CV mode reads through an existing recording and falls back safely when no recording exists.
- Manual gate outputs 10V while held and emits one trigger pulse on rising edge.
- Movement-sense gate turns on for motion above threshold and stays low for stationary joystick values.
- Trigger input rising edge starts/retriggers playback according to one-shot, loop, and trigger-rearmed loop modes.
- Reset trigger stops playback, clears playhead/gate/trigger state, and leaves params intact.
- Recording captures X/Y/gate frames; playback reconstructs X/Y with interpolation and gate with clean transitions.
- Loop boundary handling produces finite values and avoids discontinuity spikes.
- LEDs reflect axis polarity, quadrant levels, gate, record, play, and trigger activity.
- Buffer integrity: all outputs fill the entire buffer, remain finite, and stay within their voltage contracts.

## Implementation Plan
- Module ID: `joystick`
- Category: `utility`
- Branch/worktree: implemented through an isolated implementation subagent workspace and integrated by the coordinator.
- DSP model: inspired-by Planar 2 / Choices performance CV controller with X/Y CV, quadrant CV, gate/trigger, CV automation, and runtime gesture recording; no audio mixer/router in v1.
- Params: `x`, `y`, `range`, `cvMode`, `cv1Amt`, `cv2Amt`, `sense`, `gateButton`, `record`, `play`, `loopMode`.
- Inputs: `cv1`, `cv2`, `trigger`, `reset`.
- Outputs: `x`, `y`, `a`, `b`, `c`, `d`, `gate`, `trig`.
- LEDs: `xPositive`, `xNegative`, `yPositive`, `yNegative`, `a`, `b`, `c`, `d`, `gate`, `record`, `play`, `trigger`.
- Factory patch: `src/js/config/patches/test-joystick.js`, routing X/Y outputs into `vcf`, `vca`, and `scope` so manual gestures visibly and audibly change the patch.
- Focused tests: `npm test -- tests/dsp/joystick.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Full validation command: `npm test`
- Known assumptions: 10 HP app panel, no audio inputs/MIX output, 0-10V unipolar CV allowed, app-standard 0/10V gates and 5-10 ms triggers, app-added reset input, runtime-only recording storage, bounded 64-second recording length, manual REC starts immediately, and trigger input restarts recording when REC is armed for synced capture.

## Potential Improvements
- Persist gesture recordings in patch state once patch-format ownership for larger runtime buffers is designed.
- Add a full `vector-mix` or `planar` module later for quad audio panning/routing and A-D input normalization.
- Add pressure/Z-axis or multi-touch modes if the UI toolkit later supports touch-specific gestures cleanly.
- Add optional quantized or tempo-synced recorder lengths once clock transport conventions are stronger.

## Sources
- [Intellijel Planar 2 product page](https://intellijel.com/shop/eurorack/planar-2/) - Intellijel Designs, current product page, accessed 2026-07-09, supports: recordable vector joystick identity, 14 HP/depth/current, X/Y and A-D outputs, 0-10V and +/-5V ranges, gate generator, CV gesture recorder, external CV input modes, and 30-second product-page recording claim.
- [Planar 2 Manual v1.3](https://intellijel.com/downloads/manuals/planar-2_manual_v1.3_2024.04.16.pdf) - Intellijel Designs, firmware/manual revision 2024-04-16, accessed 2026-07-09, supports: full panel contract, input/output descriptions, XY/ABCD button states, polarity ranges, CV attenuverters, cartesian/polar/scan modes, movement-sense/manual gate behavior, trigger-synced recording/playback, loop modes, calibration, ramped-loop option, and firmware notes.
- [Choices r1.1 User's Manual](https://www.flightofharmony.com/manuals/CH/CH_r1-1.pdf) - Flight of Harmony / Red Hand Studios, edition 1, 2009-04, accessed 2026-07-09, supports: X/Y joystick utility model, direct coupling, supply/current, max input/output voltage, 0-200% scaling, +/-5V offset, gate/trigger outputs, 1.5 ms trigger duration, AC/DC reference switches, and control inventory.
- [Flight of Harmony Choices on ModularGrid](https://www.modulargrid.net/e/flight-of-harmony-choices) - ModularGrid, module database page, accessed 2026-07-09, supports: secondary cross-check of 14 HP, 36 mm depth, current draw, discontinued status, feature list, original manual link, and user/rack context.
- [Buchla 223e Multi-Dimensional Kinesthetic Input / Tactile Input Port](https://buchla.com/product/223e/) - Buchla USA product record, modified 2025-09-18 per WordPress API, accessed 2026-07-09, supports: tactile controller with 27 velocity/pressure keypads, one/two-dimensional location sensing, 30 outputs, arpeggiator, and preset-manager integration.
- [Buchla 227e System Interface](https://buchla.com/product/227e/) - Buchla USA product record, modified 2025-09-18 per WordPress API, accessed 2026-07-09, supports: voltage-controllable two-dimensional spatialization in a four-channel performance environment and historical context for quadrant/spatial control.
- [History | Buchla](https://buchla.com/history/) - Buchla USA, page modified 2019-11-12 per WordPress API, accessed 2026-07-09, supports: Buchla controller history from non-keyboard instruments through Thunder, Lightning, Marimba Lumina, and 200e; contextual design philosophy for multi-dimensional controllers.
- [Intellijel Planar 2 Joystick Vector Mixer + Quad Panner](https://www.perfectcircuit.com/intellijel-planar-2.html) - Perfect Circuit, retailer/product/demo page, accessed 2026-07-09, supports: secondary/demo observations for Planar 2 as a joystick vector mixer, gesture recorder, six-CV-plus-gate controller, one-shot/loop playback, and patch examples using recorded movements.
- [Linear Interpolation](https://ccrma.stanford.edu/~jos/pasp/Linear_Interpolation.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/Stanford, copyright page updated 2024-06-28, accessed 2026-07-09, supports: linearly interpolated gesture/table lookup.
- [Delay-Line Interpolation](https://ccrma.stanford.edu/~jos/pasp/Delay_Line_Interpolation.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/Stanford, copyright page updated 2024-06-28, accessed 2026-07-09, supports: interpolation to avoid zipper noise and inexpensive linear interpolation trade-offs.
- [Fractional Delay Filtering by Linear Interpolation](https://ccrma.stanford.edu/~jos/pasp/Fractional_Delay_Filtering_Linear.html) - Julius O. Smith III, Physical Audio Signal Processing, CCRMA/Stanford, copyright page updated 2024-06-28, accessed 2026-07-09, supports: interpolated delay/table lookup behavior and low-frequency accuracy relevant to control-rate gesture playback.
- Internal reference: `src/js/modules/rnd/index.js` - eurorack-js local implementation, accessed 2026-07-09, supports: existing 0-10V CV/gate output conventions and 10 ms trigger/gate pulse pattern.
- Internal reference: `src/js/modules/atten/index.js` - eurorack-js local implementation, accessed 2026-07-09, supports: existing attenuverter and offset mapping.
- Internal reference: `src/js/modules/loop/index.js` - eurorack-js local implementation, accessed 2026-07-09, supports: runtime recording state and custom-rendered record/play control pattern.
- Internal reference: `src/js/utils/slew.js` - eurorack-js local implementation, accessed 2026-07-09, supports: local smoothing utility for avoiding abrupt CV jumps.

## DSP Audit (2026-07-11)

- **Runtime matrix**: deterministic stimulus completed at 44.1, 48, and 96 kHz with 128- and 512-sample blocks; outputs were finite and input/output buffer identities remained stable.
- **Matrix sweep**: No voltage-contract violation was observed across the full matrix control sweep.
- **Coverage**: Focused DSP coverage exists in `tests/dsp/joystick.test.js`; the audit harness supplements rather than replaces its behavioral assertions.
- **Interpretation**: this baseline detects runtime, range, reset, and broad spectral regressions. It does not establish hardware fidelity or replace listening tests and module-specific assertions.
- **Next action**: follow the priority and acceptance criteria in [the central sound engineering audit](../sound-engineering-review.md).
