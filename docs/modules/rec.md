# Stereo WAV recorder

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+MIDI+In+and+Out)

1. Enable MIDI input, select Start and play notes on channel 1. The upper-row triangle voice feeds both recording inputs, then passes through to the speakers. The separate lower row sends MIDI to an external destination.
2. Press Rec, play a short phrase, then press Rec again to finish and download the WAV. To capture another part, move the recorder’s input cables to that part of the rack.

[Connect MIDI hardware or a DAW](../midi.md)

## In a composition

Record a dry lead before reverb, or put Rec across the final mix to capture a whole performance. The cables determine what will be in the file.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rec (`record`) | Starts capturing the two inputs. Press again to finish and download a stereo WAV. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`L`), R (`R`) | Audio | Supplies the corresponding channel of the recording and through signal. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| L (`outL`), R (`outR`) | Audio | Passes that input on for monitoring while the recorder captures it. |

## Design background

This is an inline stereo recorder. Recording at a chosen patch point gives a musician the modular equivalent of taking a direct feed from a mixing desk.

[Research and implementation notes](../../research/modules/rec.md)
