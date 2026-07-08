# Matrix Mixer (matrix)

## Hardware Reference
- **Primary references**: Doepfer A-138m Matrix Mixer, AI Synthesis AI008 Eurorack Matrix Mixer, 4ms VCA Matrix.
- **Manual/build references**: Doepfer A-138m product/manual material and AI Synthesis AI008 build guide.
- **Context/reviews/demos**: 4ms official video/demo list for VCAM; MusicRadar ADDAC System 814 review for modern matrix-mixer workflow and feedback patch observations.
- **DSP references**: Existing `mix` and `atten` modules in this repo for DC-coupled summing and attenuverter mapping; matrix mixers are implemented as per-sample weighted sums.

## Specifications

### Source-Derived Behavior
- Doepfer A-138m is a 4 x 4 matrix mixer with one mode switch per column/output. In unipolar mode the controls are attenuators; in bipolar mode the controls are polarizers with zero at center, negative left of center, and positive right of center. It is DC-coupled for both audio and CV. Doepfer also documents an optional internal jumper where the top row can generate DC offsets if the top input is unpatched.
- AI Synthesis AI008 is a four-input, four-output Eurorack matrix mixer. Its build-guide metadata describes it as buffered and DC-coupled for mixing audio and CV to multiple outputs or a combined output.
- 4ms VCA Matrix is a playable 4 x 4 matrix of VCAs with four CV/audio inputs, four outputs, sixteen control jacks, sixteen level knobs, sixteen mute buttons, LEDs, DC coupling, and full-range signal/control inputs. It adds VCA-specific behavior, CV addressing, mute buttons, and soft limiting beyond a passive/manual matrix mixer.
- MusicRadar's ADDAC 814 review describes a matrix mixer as useful for routing any input to any output, feedback loops, and DC-coupled audio/CV patches; it notes that feedback can become wild quickly and benefits from subtle control changes.

### App Panel Contract
- **Knobs**: 16 route amount knobs, arranged conceptually as output columns A-D by input rows 1-4:
  - `a1`, `a2`, `a3`, `a4`: input 1-4 amount into output A.
  - `b1`, `b2`, `b3`, `b4`: input 1-4 amount into output B.
  - `c1`, `c2`, `c3`, `c4`: input 1-4 amount into output C.
  - `d1`, `d2`, `d3`, `d4`: input 1-4 amount into output D.
- **Switches**: `modeA`, `modeB`, `modeC`, `modeD`; `0` = unipolar attenuator, `1` = bipolar polarizer for that output column.
- **Inputs**: `in1`, `in2`, `in3`, `in4`, all `buffer`, DC-coupled audio/CV.
- **Outputs**: `outA`, `outB`, `outC`, `outD`, all `buffer`, DC-coupled audio/CV.
- **LEDs**: `outA`, `outB`, `outC`, `outD`, showing output peak level normalized around 10V.
- **Normalization**: no app-level DC offset normalization in the first implementation. Doepfer's optional top-row offset generator is documented but omitted to keep the panel small and deterministic.
- **Not included**: 4ms-style per-cell CV inputs, mute buttons, VCA response curve, external expansion headers, and soft-limit trim behavior.

### Voltage Contract
- Inputs accept arbitrary app buffer voltages. Typical audio is +/-5V and typical CV is 0-5V or +/-5V.
- In unipolar output mode, each knob maps 0..1 to gain 0..1.
- In bipolar output mode, each knob maps 0..1 to gain -1..+1, with 0.5 as zero gain.
- Outputs are linear DC-coupled sums and are not hard-clipped. This matches the existing `mix` module behavior and keeps CV summing predictable. Downstream modules remain responsible for their own operating ranges.
- LEDs map peak absolute output voltage with `peak / 10`, clamped to 0..1, and decay between blocks.
- No gate, trigger, pitch-tracking, clock, or reset voltage behavior is present.

## DSP Implementation

### Algorithm Overview
For each sample, compute each output as a weighted sum of all four input buffers:

```text
outA = in1 * gain(a1, modeA) + in2 * gain(a2, modeA) + in3 * gain(a3, modeA) + in4 * gain(a4, modeA)
```

The same formula is used for outputs B-D. Gains are derived once per block from clamped params. This is a faithful utility adaptation of manual matrix mixers rather than a VCA matrix emulation.

### Observed Behavior From Reviews/Demos
- Matrix mixers are valued less as tone generators and more as routing/performance hubs: one signal can feed multiple destinations, multiple signals can be blended per destination, and outputs can be patched back into inputs for feedback patches.
- Modern review context emphasizes that DC coupling matters because the same routing grid can move audio or modulation. Feedback patching can create complex textures but should be controlled with small gain moves.
- 4ms demos emphasize playable per-route control and mutes. This implementation does not include mutes, but the per-route knobs and per-output mode switches support the same core "route any input to any output" workflow.

### Contradictions and Source Quality
- Doepfer uses one unipolar/bipolar switch per column; 4ms uses unipolar VCA levels plus CV/mute control. This implementation follows Doepfer for manual polarity because it adds more utility without adding sixteen CV inputs.
- Doepfer documents optional DC offset generation for the top row via an internal jumper. AI008 and 4ms source material emphasize DC-coupled mixing but not the same normalization behavior. The app version omits offsets for clarity and because an existing `atten` module already provides offset generation.
- 4ms documents a soft-limit effect. Linear summing is preferred here because this module is a routing utility, not a saturation effect, and the repo's `mix` module already passes summed voltage without clipping.

### Code Notes
- Use four own input buffers and a `clearAudioInputs()` method so disconnected audio/CV inputs silence immediately in the engine.
- Reset clears all outputs and LEDs, but does not alter user params.
- Keep UI declarative even with 16 knobs; no custom renderer is required for the first pass.

## Test Targets
- Initialization creates 16 route params, four mode params, four input buffers, four output buffers, and four LEDs.
- Unipolar knobs pass, attenuate, and mute each routed input.
- Bipolar switches map 0 to inversion, 0.5 to zero, and 1 to unity.
- Each input can feed each output independently; unrelated outputs remain silent.
- Multiple inputs sum linearly and preserve DC values.
- Audio-rate bipolar signals pass through without NaN and with expected cancellation when inverted.
- Output LEDs rise with signal and decay with silence.
- `clearAudioInputs()` and `process()` restore own buffers after routed buffers are replaced.
- `reset()` clears outputs and LEDs.
- Metadata, UI control params, and port names match the module contract.

## Implementation Plan
- Module ID: `matrix`
- Category: `utility`
- Branch/worktree: current worktree `/Users/orderandchaos/code/eurorack-js`
- DSP model: 4 x 4 DC-coupled weighted sum matrix, Doepfer-style per-output unipolar/bipolar modes, no clipping.
- Params: 16 route amount knobs (`a1`..`d4`) and four mode switches (`modeA`..`modeD`).
- Inputs: `in1`, `in2`, `in3`, `in4` as `buffer`.
- Outputs: `outA`, `outB`, `outC`, `outD` as `buffer`.
- LEDs: `outA`, `outB`, `outC`, `outD` peak indicators.
- Factory patch: `src/js/config/patches/test-matrix.js`, using LFO and VCO signals routed through `matrix` to demonstrate modulation and audio summing into `out`.
- Focused tests: `npm test -- tests/dsp/matrix.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js`
- Full validation command: `npm test`
- Known assumptions: no per-cell VCA CV, no mute buttons, no top-row offset normalization, and no soft limiter in this first utility implementation.

## Potential Improvements
- Add a custom grid UI with clearer row/column grouping if the generic declarative renderer is cramped.
- Add optional output soft limiting as a switchable mode for feedback patches.
- Add per-cell mute buttons or a second VCAM-inspired module if performance routing becomes a priority.
- Add optional input normalization/DC offset generation once there is a UI pattern for internal jumpers or hidden settings.

## Sources
- [Doepfer A-138m Matrix Mixer](https://www.doepfer.de/a138m.htm) - Doepfer, product page/manual notes, accessed 2026-07-08, supports: 4 x 4 matrix layout, per-column unipolar/bipolar behavior, polarizer mapping, DC coupling, optional top-row offset jumper, 20HP/depth/current context.
- [Doepfer A-138m manual PDF](https://www.doepfer.de/a100_man/a138m_man.pdf) - Doepfer, PDF metadata shows 2004-era manual material, accessed 2026-07-08, supports: primary manufacturer manual source for A-138m.
- [AI008 Eurorack Matrix Mixer](https://aisynthesis.com/product/ai008-eurorack-matrix-mixer/) - AI Synthesis, product page, accessed 2026-07-08, supports: AI008 identity and current product context.
- [How to Build the AI008 DIY Matrix Mixer](https://aisynthesis.com/how-to-build-the-ai008-diy-matrix-mixer/) - AI Synthesis, published 2017-09-09 and modified 2026-03-02, accessed 2026-07-08, supports: four-input/four-output matrix mixer, buffered DC-coupled audio/CV routing, build context.
- [4ms VCA Matrix](http://www.4mspedals.com/vcam.php) - 4ms Company, official product page, accessed 2026-07-08, supports: 4 x 4 VCA matrix, four inputs/four outputs, 16 level knobs, 16 CV control jacks, mute buttons, LED behavior, DC coupling, soft-limit context, manuals and demo links.
- [4ms Company VCA Matrix on ModularGrid](https://www.modulargrid.net/e/4ms-company-vca-matrix) - ModularGrid, module database page, accessed 2026-07-08, supports: cross-check of 26HP, depth/current, feature summary, and community popularity/rack context.
- [ADDAC System 814 6x6 Stereo Matrix Mixer review](https://www.musicradar.com/music-tech/synths/addac-system-814-6x6-stereo-matrix-mixer-review) - Rob Redman, MusicRadar/Future, published 2026-02-13, accessed 2026-07-08, supports: modern review observations about matrix routing, feedback loops, DC-coupled audio/CV use, live usability, and subtle control of feedback patches.
- [src/js/modules/mix/index.js](../../src/js/modules/mix/index.js) - eurorack-js local implementation, accessed 2026-07-08, supports: existing DC-coupled mixer behavior, no-clipping summing, LED decay, and input clearing pattern.
- [src/js/modules/atten/index.js](../../src/js/modules/atten/index.js) - eurorack-js local implementation, accessed 2026-07-08, supports: existing attenuverter mapping from 0..1 to -1..+1 and DC offset utility separation.
