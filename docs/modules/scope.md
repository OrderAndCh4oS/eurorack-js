# Two-channel oscilloscope

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Scope+Sine+Wave)

1. Start the patch. Despite the preset’s name, channel 1 is patched to the VCO’s triangle. Its sloping sides and sharp corners are the sound you hear. Channel 2 displays the LFO.
2. Change Time to show several oscillator cycles or a longer section of the slow waveform. Adjust each gain separately, then switch Mode to explore the relationship between the two signals.

## In a composition

Use the scope to see whether a short trigger arrives before or after an envelope, or how a modulator bends a waveform. Its through outputs leave the observed signal available to the rest of the patch.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Time (`time`) | Sets the horizontal time scale in the waveform view. |
| Trig (`trigger`) | Sets the voltage crossing used to align the trace and steady a repeating wave. |
| Gn 1 (`gain1`), Gn 2 (`gain2`) | Sets the display magnification of this channel. |
| Off 1 (`offset1`), Off 2 (`offset2`) | Moves the matching trace vertically so the two signals are easier to compare. |
| Mode (`mode`) | Selects the time-domain scope, XY plot or pitch-tuning view. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1 (`in1`) | Any signal | Supplies the first trace and the horizontal signal in XY view. |
| 2 (`in2`) | Any signal | Supplies the second trace and the vertical signal in XY view. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1 (`out1`), 2 (`out2`) | Any signal | Passes this channel’s input onward. The display gain and offset only change what is drawn. |

## Design background

An oscilloscope displays voltage against time. An XY display instead uses the two inputs as horizontal and vertical coordinates, revealing their relationship as a shape.

[Research and implementation notes](../../research/modules/scope.md)
