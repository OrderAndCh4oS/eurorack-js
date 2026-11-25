# OCTO RECEIVE (`octo-receive`)

OCTO RECEIVE breaks out the eight lanes of a single visible cable from [OCTO SEND](octo-send.md). Connect the modules' LINK jacks once, then patch each numbered output into the destination that needs that signal. The numbered jack positions match on both panels.

## Hardware, observations and assumptions

The Intellijel Octalink 1U manual documents a pair of identical, passive 14 HP panels. One shielded cable joins eight pairs of like-numbered jacks. The manual's audio patch connects a buffered Dixie II+ output to a Polaris in the other case. Intellijel also describes moving systems while leaving their internal leads patched. An independent performer reports using this feature with two touring cases. The performer's account documents the interaction without supplying voltage measurements. [Intellijel manual, pp. 3–6](https://intellijel.com/downloads/manuals/octalink-1u_manual_2021.08.03.pdf) · [Two-case setup report](https://www.reddit.com/r/modular/comments/1o8gfni/my_live_setup_2x_intellijel_7u_104hp_oxi_one_mk2/)

The physical jacks are bidirectional. This software utility assigns one panel to each direction. A Send can supply multiple Receives through visible LINK cables, and each numbered output can feed multiple scalar inputs. The manual cautions that hardware noise depends on the setup. Doepfer's comparable A-180-9 adds evidence of cable-dependent crosstalk. Neither manufacturer provides a transfer function for the illustrated installation. The emulated path therefore uses unity gain, isolated lanes and direct-cable timing. [Intellijel manual](https://intellijel.com/downloads/manuals/octalink-1u_manual_2021.08.03.pdf) · [Doepfer technical notes](https://doepfer.de/A1809.htm)

## Panel and voltage contract

| Panel element | Direction and ID | Behavior |
|---|---|---|
| LINK | Dedicated trunk input, `link` | Accepts a single cable from an OCTO SEND LINK output. Disconnecting it silences all eight outputs without removing any of their cords. |
| Jacks 1 through 8 | Eight scalar outputs, `out1` through `out8`, signal `any` | The same number on the linked Send supplies each output. Any number of destination cables can share an output. A missing Send input supplies 0 V on that lane. |
| Controls and indicators | Empty params and LEDs | Fixed positions and names. No knobs, switches, buttons, displays, modes or pairing settings. |

For a driven lane, each output sample equals its source's Float32 sample. The nominal scalar range is −10 to +10 V and wider finite CV passes through. Preserve DC, sign, pitch at 1 V/octave, audio at ±5 V, gates at 0/10 V and trigger pulse timing and amplitude, including a 5–10 ms pulse at 5–10 V. The module generates no thresholds or edges. LINK carries no scalar voltage and only mates with the Send trunk jack.

| Physical connection at the downstream input | Result |
|---|---|
| Cable from Receive, lane driven | Receives the lane samples, including exact zero crossings and sustained 0 V. |
| Cable from Receive, LINK or source lane open | Receives 0 V and stays physically connected. The input's built-in normal remains interrupted. |
| Cable from Receive removed | Worklet restores the downstream input's declared normal and runs its disconnect hook. |

Each public scalar output owns a stable block-sized buffer. It initializes to 0 V and clears in place on reset. An open LINK or empty lane clears through the entire block on the next active topology. Removing a source cannot leave a previous sample latched. Separate Receive instances combine signals only where the user patches their outputs into a mixer.

## DSP plan and trade-offs

Follow the [shared routing plan](octo-send.md#dsp-and-routing-plan). Resolve each Receive output through its LINK and matching Send input to the scalar source. Resolve chains by actual endpoint and lane number, including a cord that crosses two different lane numbers between pairs. A repeated Receive-output endpoint in a driverless chain terminates in silence. An ordinary DSP module ends the lookup and remains a vertex for feedback analysis. Keep the physically displayed and serialized cables as the authority for input occupancy.

Compile all effective source-to-consumer scalar edges before SCC scheduling. Put each current source block on the corresponding public Receive output and deliver the correctly scheduled block to each destination. A receiver can fan a signal to both a feedback destination (which sees the previous block) and an outside destination (which sees the current block). A delay belongs to its particular effective edge. Assigning that delay to the shared Receive output would alter one path. The same principle keeps an unrelated lane sample-aligned even when another lane in the trunk carries feedback. The graph resolves cable chains on topology changes and uses preallocated buffers while playing. [Graph compiler](../../src/js/audio/graph.js) · [Worklet topology and lifecycle](../../src/js/audio/worklet/processor.js)

VCV's Split offers a software precedent for a fixed output number indexing an individual voltage inside one cable. Its Merge writes 0 V for unpatched inputs. Its variable polyphony and per-sample channel copy would require a different transport model here. The repository's compiled scalar edges already provide feedback scheduling and stable destination buffers. [VCV Split](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Split.cpp) · [VCV Merge](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Merge.cpp)

## Test targets

- Check the single LINK input and eight numbered outputs, empty params and LEDs, all-zero startup, reset and stable scalar buffer identity. Outputs cover the entire block at 128 and 512 samples.
- Use distinct patterns on all eight lanes simultaneously. Verify exact samples in each output and downstream input over multiple blocks. Include independent audio, pitch, bipolar CV, gate and trigger signals, a high pulse on the last sample of a block, and silence. Check lane 8 with unpatched earlier lanes.
- Fan one Send to separate Receives and fan a Receive output to multiple scalar destinations. Remove a middle lane, remove LINK, connect a different Send, then disconnect the final scalar cable. Assert zero, preserved physical occupancy, restored normal, correct hook counts and absence of stale data after each change.
- Test a chain that changes lane numbers, an isolated pair, a driverless routing cycle and DSP self-feedback. Compare feedback and feedforward fan-out from the same lane against equivalent direct wiring. Check exact feedback-delay counts and that an independent lane in the same trunk stays aligned.
- Reject incompatible scalar/trunk endpoints and duplicate LINK input sources at live, import and graph boundaries. Round-trip the physical cables with strict v3 serialization and rebuild the same routing after audio stop/start.

## Implementation Plan

Implement `octo-receive` with `octo-send` in category `utility`, branch `module/octo`, worktree `.worktrees/octo`. The research branch is `research/octo` in `.worktrees/octo-research`. Target a 6 HP declarative panel with the same two-column lane grid and numbering as Send. The voltage contract, physical occupancy rules, ideal transfer assumption, stateless DSP and focused tests above apply to both roles. Add both manifest and static worklet imports, graph revision, public module-directory entries and guides in one change.

Write endpoint tests in `tests/dsp/octo-receive.test.js` and graph/processor tests before implementation. Use the joint factory demo **Test - Octo Cable Snake** for both directory entries. Lane 1 carries the VCO triangle to OUT left and lane 8 carries the clock pulse that triggers the kick on OUT right. Put the two panels on different rows joined by one LINK.

```sh
npm test -- tests/dsp/octo-receive.test.js tests/dsp/octo-send.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
npm test -- tests/audio/graph.test.js tests/audio/worklet-processor.test.js tests/app/rack-state.test.js tests/app/patch-format.test.js tests/patch-script/builder-compiler.test.js
npm test -- tests/config/patch-catalogs.test.js tests/config/factory-patches.test.js tests/app/patch-format.test.js
npm run audit:dsp -- --module octo-receive --matrix --strict-voltage
npm run audit:dsp -- --module octo-send --matrix --strict-voltage
npm test
```

Verify both stereo sides of the joint demo, disconnect/reconnect a playing LINK, and save/reload in a real browser AudioWorklet. Confirm a kick already triggered by lane 8 may complete its own decay after disconnection.

## DSP Audit (2026-11-25)

All six strict-voltage audit configurations passed at 44.1, 48 and 96 kHz with 128- and 512-sample blocks. Graph and worklet tests covered independent receivers, chains crossing lane numbers, zero on open lanes, and restoration of the receiving module's normal after removing its physical cable. The feedback fixtures matched the equivalent direct cables. [Graph tests](../../tests/audio/octo-graph.test.js) · [Worklet tests](../../tests/audio/worklet-processor.test.js)

A two-second Chromium AudioWorklet capture at 48 kHz found zero differing samples between a direct mix and the same oscillator and clock routed through the trunk. The browser demo also played after unplugging and reconnecting LINK, saving to the browser, reloading the page and restarting audio. [Browser patching test](../../tests/e2e/octo.spec.js)

## Sources

All external references were accessed 2026-11-25.

- Intellijel, *Octalink 1U Manual*, rev. 2021-08-03, and *Octalink 1U*, undated product page. Primary panel, pin correspondence, physical specs and practical audio example. [Manual](https://intellijel.com/downloads/manuals/octalink-1u_manual_2021.08.03.pdf) · [Product](https://intellijel.com/shop/eurorack/1u/octalink-1u/)
- Independent performer, *My live setup (2x Intellijel 7u 104hp) + OXI One mk2*, r/modular, 2025. First-hand performance use of the paired hardware for quickly transporting a prewired system. [Setup report](https://www.reddit.com/r/modular/comments/1o8gfni/my_live_setup_2x_intellijel_7u_104hp_oxi_one_mk2/)
- Doepfer, *A-180-9 Multicore*, undated technical notes. Physical analog and shielding limitations of a comparable multicore, with an eight-channel upper bank. [Technical notes](https://doepfer.de/A1809.htm)
- VCV, *Fundamental Split and Merge*, Rack v2 source. Per-channel indexed outputs and explicit zero filling of unused Merge inputs. [Split.cpp](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Split.cpp) · [Merge.cpp](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Merge.cpp)
