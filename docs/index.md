# Documentation

Guides to patching, the code editor, browser agents and module development.

## Start with the rack

Open [Test patches](/patches?view=tests) to explore modules in working setups. Start with [Synth Voice Basics](synth-voice-demos.md) for examples you can play straight away; MIDI patches need a MIDI source. Select **Start** to turn on audio. Turn a knob to change a sound; drag from an output socket to an input to connect modules. Sound reaches your speakers through an **OUT** module.

Use **Save** to keep a patch in this browser, or sign in to save it to your account. Account patches can be private or public. Account copies made with **Save a copy** start private. Copies of public patches preserve the original creator's credit.

Browse [public patches](/patches) to find something to play, change, or copy. An account patch has its own URL; make it public so others can open it. **Copy snapshot link** captures the rack's modules, settings, cables and MIDI mappings, including unsaved edits. It does not include recorded audio.

## Write patches with code

- [Write your first patch](patch-workbench-guide.md) — build a voice, add a filter and modulation, then check the connections.
- [Code reference](patch-workbench.md) — module declarations, cables, parameters, keyboard shortcuts, and console commands.

Select **Code** in the rack to open the editor. **Validate** checks your script without changing the rack. **Apply** loads the checked result. Use **Debug** to find disconnected modules and branches that do not reach an output.

## Work with an agent

[WebMCP](webmcp.md) lets a compatible browser agent inspect the current rack, write patch code, and check its wiring. It is experimental and requires browser support. You can inspect the code in the editor before it is applied.

## Development

- [Architecture](architecture.md) — rack state, audio processing, plugins, and the patch format.
- [Creating modules](creating-modules.md) — the DSP and control contracts, with worked examples and tests.

Eurorack is [open source](https://github.com/OrderAndCh4oS/eurorack-js).
