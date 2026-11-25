# OCTO SEND (`octo-send`)

## Hardware and evidence

OCTO SEND collects eight independent signals where they originate in the rack. A single visible LINK cable carries them across rows to [OCTO RECEIVE](octo-receive.md). Numbers stay fixed, so a player can unplug and reconnect the whole trunk while leaving the short leads in place.

Intellijel's Octalink 1U uses two identical passive panels. Each has eight numbered 3.5 mm jacks, one shielded RJ45 connector, and a 14 HP, 14 mm deep footprint in its 1U format. Each wire connects the like-numbered jacks. Either physical end can drive a given lane. The illustrated patch sends a Dixie II+ oscillator in one case through a buffered multiple to a Polaris filter in another. The product page describes general signal transport, while the manual qualifies the audio example with a possible rise in noise floor. The manual supplies no worst-case pitch error, noise level or crosstalk measurement. [Intellijel product page](https://intellijel.com/shop/eurorack/1u/octalink-1u/) · [2021 manual, pp. 3–6](https://intellijel.com/downloads/manuals/octalink-1u_manual_2021.08.03.pdf)

A performer using two 7U cases describes packing the patched halves separately and reconnecting them at shows. That account establishes the practical value of preserving the local patch. A comparable Doepfer multicore specifies an eight-jack upper bank and reports that coupling and pitch accuracy depend on cable length, shielding and buffering. Those observations apply to real installations. The software model assumes ideal digital transfer and gives each panel a fixed signal direction to fit the rack's input/output jacks. Fan-out from one LINK output to multiple Receives is a software convenience. [Performer's setup](https://www.reddit.com/r/modular/comments/1o8gfni/my_live_setup_2x_intellijel_7u_104hp_oxi_one_mk2/) · [Doepfer A-180-9 notes](https://doepfer.de/A1809.htm)

## Panel and voltage contract

| Panel element | Direction and ID | Behavior |
|---|---|---|
| Jacks 1 through 8 | Eight scalar inputs, `in1` through `in8`, signal `any` | One source per jack. Normal 0 V. Two columns with the same numbered positions as Receive. A missing lane keeps its position. |
| LINK | Dedicated trunk output, `link` | One visible patch cable per connected Receive. Each Receive gets all eight lanes. The physical connection in patch v3 is Send's `link` → Receive's `link`. |
| Controls and indicators | Empty params and LEDs | Fixed mapping. No knobs, switches, buttons, channel names, pairing settings, displays or modes. |

The scalar ports use the rack's nominal `any` range of −10 to +10 V. For every finite Float32 source sample, the destination receives the same value as direct wiring, including wider CV. Audio at ±5 V, 1 V/octave pitch, a 0/10 V gate, and a 5–10 ms trigger at 5–10 V can coexist. A 0 V sample is valid data. Unity gain, DC coupling and sample alignment apply independently to every lane. Thresholds, pulse widths and polarity decisions belong to the modules at the ends of the route. LINK itself has no scalar voltage. Filter loss, clipping, noise, crosstalk and loading are outside this utility model.

## DSP and routing plan

Keep three physical cables for a routed signal in the saved patch and in the UI. Compile them into an effective scalar route from the original source to the final destination before calculating strongly connected components (SCCs). For example, an oscillator routed through lane 1 into a filter contributes the same oscillator → filter edge as a direct cable. This preserves same-block feedforward and the existing one-block-per-internal-edge feedback rule. Treating whole panels as signal-processing stages could add several blocks inside a feedback loop or pull an unrelated clock lane into that loop. Packing samples into an audio waveform would lose independent sample positions. Resolving lanes once at topology compilation avoids both issues.

1. Validate every physical endpoint and reject duplicate input destinations, including Send numbered inputs and Receive LINK inputs. Admit a trunk only between a Send LINK output and a Receive LINK input. Apply this compatibility rule to rack creation and moves, patch import, patch scripts, and worklet topology compilation. Preserve existing scalar-to-scalar patching across all signal tags. Port roles come from the module definitions so instance names and rack order can vary.
2. Index the physical source of each input. To resolve a Receive output, look up its LINK, then the matching numbered input of the linked Send. A scalar cable from another Receive continues the lookup at that output, even when different numbers were joined between pairs. Track the visited Receive-output endpoints. An endpoint-only loop has no driver and supplies 0 V. Terminate on a real source or an open lane. Reuse resolutions within the topology.
3. For every physically cabled consumer, route the resolved source or a block of zeros. A cord from Receive to a downstream normalled input occupies the jack even if the Send input or LINK is unplugged. Removing that final cord restores the downstream normal and runs the disconnect hook. Leaving it connected while moving the trunk requires no new downstream connection event. Keep the worklet's physical occupancy tracking for startup, rewiring and instance replacement. Verify Receiver ports themselves expose the lane values through their own stable scalar output buffers.
4. Compile effective routes before SCC ordering. A feedback edge through one or more snakes has the same one-block delay as the corresponding direct edge. Crossed lanes in opposing directions between different Send/Receive pairs can share hardware-style routing without creating a cycle unless the real processing modules close one. Publish a whole topology revision atomically. Keep the existing v3 cable fields, explicit connections, fan-out rules and serialization limit on physical cables.

Endpoint factories are stateless and worklet-safe. Ordinary ports have stable, block-sized Float32 buffers, initially zeroed, cleared in place on reset. Support isolated endpoint inspection and graph-driven processing. LINK describes the routing relationship without sending a voltage to ordinary jacks. No global channel table, per-sample discovery or per-block allocation is needed. Static scalar buffers can be reused when a lane is open.

The local graph and processor are normative for scheduling, connection hooks and normal restoration. VCV's Merge and Split illustrate independent indexed voltages and zeroing holes in a packed cable. Their sixteen-channel, variable-width engine has different transport and scheduling semantics from this rack. [Graph compiler](../../src/js/audio/graph.js) · [Worklet](../../src/js/audio/worklet/processor.js) · [VCV Merge](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Merge.cpp) · [VCV Split](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Split.cpp)

## Test targets

- Check precisely eight numbered scalar inputs, their 0 V normals, one dedicated LINK output, empty params and LEDs, and stable initialized buffers at each supported block size. Reset clears owned buffers in place and carries no previous source into a new topology.
- Give all eight lanes distinct simultaneous signals, including bipolar audio, fine fractional pitch CV, wider CV, silence and a one-sample pulse straddling a block boundary across successive test blocks. Compare every sample to direct cabling. Remove an interior source while driving lane 8 and verify fixed numbering and independence.
- Fan the trunk out to two Receives. Reorder or rename instances, chain one Receive output into a differently numbered input of another Send, and form a source-free routing cycle. Verify isolation between separate pairs and guaranteed termination.
- Reject both directions of scalar/LINK mismatch, wrong jack directions, and two cables at any single input, including dead-end cables. Preserve arbitrary scalar cross-patching, serialized physical cords, and ordinary output fan-out.
- Compare direct and snake versions of a self-feedback patch, a two-DSP feedback loop, and an unrelated feedforward lane in the same trunk. Confirm the same effective delayed edges and identical sample sequences. Verify physical occupancy against an input with a nonzero or dynamic normal, including a hot trunk move while audio runs.

## Implementation Plan

Implement `octo-send` and `octo-receive` together in category `utility` on branch `module/octo` in `.worktrees/octo`; research branch `research/octo` lives in `.worktrees/octo-research`. Target two 6 HP panels with matching jack positions. Use declarative panel definitions and the panel/voltage contracts above. Register both in the same manifest and worklet order, and refresh the shared worklet graph revision. Update the module contracts, live cable checks, patch validation and graph compiler for the dedicated LINK endpoints. Document the routing convention and add both modules to the directories.

Write the endpoint, graph, patch and lifecycle tests before implementing the feature. Publish one shared factory demo, **Test - Octo Cable Snake**. Send a VCO triangle on lane 1 to the left OUT input and clock pulses on lane 8 to trigger a kick on the right. Connect the two rows with one visible LINK. Use the exact source-defined jack IDs and list the patch under both modules.

```sh
npm test -- tests/dsp/octo-send.test.js tests/dsp/octo-receive.test.js tests/rack/module-contracts.test.js tests/research/module-queue.test.js
npm test -- tests/audio/graph.test.js tests/audio/worklet-processor.test.js tests/app/rack-state.test.js tests/app/patch-format.test.js tests/patch-script/builder-compiler.test.js
npm test -- tests/config/patch-catalogs.test.js tests/config/factory-patches.test.js tests/app/patch-format.test.js
npm run audit:dsp -- --module octo-send --matrix --strict-voltage
npm run audit:dsp -- --module octo-receive --matrix --strict-voltage
npm test
```

Open the demo in a browser, start the real AudioWorklet, measure left/right output, remove and reconnect LINK with local leads intact, then save and reload. Use the graph tests to establish exact per-lane transfer and feedback timing. The standalone audit checks endpoint invariants in isolation.

## DSP Audit (2026-11-25)

The standalone strict-voltage audit passed at 44.1, 48 and 96 kHz with 128- and 512-sample blocks. All endpoint buffers stayed finite and retained their identities. The connected graph tests drove all eight lanes with distinct signals and compared direct wiring with the same wiring through a trunk, including a feedback loop sharing the trunk with a feedforward lane. [Graph tests](../../tests/audio/octo-graph.test.js)

In Chromium, the same VCO and clock drove two copies of a triangle-and-kick mix. One used direct cables and the other used Octo lanes 1 and 8. All 96,000 stereo frames at 48 kHz matched sample for sample. Removing just lane 1 silenced the demo's left output while the right-hand kick kept playing. [Browser patching test](../../tests/e2e/octo.spec.js)

## Sources

All external references were accessed 2026-11-25.

- Intellijel, *Octalink 1U Manual*, rev. 2021-08-03, pp. 3–6. Primary panel, routing, case-to-case example and passive audio limitations. [Manual](https://intellijel.com/downloads/manuals/octalink-1u_manual_2021.08.03.pdf)
- Intellijel, *Octalink 1U*, undated product page. Pair, physical dimensions, shielded cable, setup workflow. Manufacturer-submitted ModularGrid listing dated 2018-08-03 corroborates its original format. [Intellijel](https://intellijel.com/shop/eurorack/1u/octalink-1u/) · [ModularGrid](https://modulargrid.net/e/intellijel-octalink-1u)
- Independent performer, *My live setup (2x Intellijel 7u 104hp) + OXI One mk2*, r/modular, 2025, account since deleted. First-hand report of retaining local wiring for shows, with a setup photograph. [Setup report](https://www.reddit.com/r/modular/comments/1o8gfni/my_live_setup_2x_intellijel_7u_104hp_oxi_one_mk2/)
- Doepfer, *A-180-9 Multicore*, undated technical notes. Comparable passive eight-channel bank, effects of cable length and shielding. [Technical notes](https://doepfer.de/A1809.htm)
- VCV, *Fundamental Merge and Split*, Rack v2 source. Comparable indexed channel routing and the Merge rule for empty inputs. [Merge.cpp](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Merge.cpp) · [Split.cpp](https://raw.githubusercontent.com/VCVRack/Fundamental/v2/src/Split.cpp)
