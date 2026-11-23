# Documentation

Guides to patching, the code editor, browser agents and module development.

## Start with the rack

Select **Start** to turn on audio. Turn a knob to change a sound or drag from an output socket to an input to connect modules. Sound reaches your speakers through an **OUT** module. [Synth Voice Basics](synth-voice-demos.md)

Use **Save** to keep a patch in this browser, or sign in to save it to your account. Account patches can be private or public. Account copies made with **Save a copy** start private. Copies of public patches preserve the original creator's credit.

Browse [public patches](/patches) to find something to play, change, or copy. An account patch has its own URL; make it public so others can open it. **Copy snapshot link** captures the rack's modules, settings, cables and MIDI mappings, including unsaved edits. It does not include recorded audio.

## Module demos

Each built-in module has a guide with a wired demo, a first listening exercise and a reference for its controls and jacks. Choose a module by name or by what you want it to do. [Browse module demos](/patches?view=tests)

To build your first voice, start with an [oscillator](modules/vco.md), give each note a shape with an [envelope](modules/adsr.md), then hear how a [filter](modules/vcf.md) changes its colour. To begin with rhythm, try the [clock divider](modules/div.md) or [Euclidean rhythm generator](modules/euclid.md).

## Connect MIDI hardware or a DAW

Open **MIDI Setup** in the desktop rack to select a keyboard, synth, MIDI interface or virtual bus. **Open MIDI starter** loads a voice you can play on channel 1 and a sequencer that follows incoming MIDI clock and returns notes on channel 2. [MIDI Input and Output](midi.md) · [Connect a DAW](midi.md#connect-a-daw) · [Record rack audio](midi.md#record-rack-audio)

### Connect Ableton Live

Live uses the **Track** and **Sync** port settings for notes and clock. [Ableton Live setup](midi.md#connect-ableton-live)

### Connect REAPER

REAPER sends notes through a track’s **MIDI Hardware Output** and records the return through a MIDI input. [REAPER setup](midi.md#connect-reaper)

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
