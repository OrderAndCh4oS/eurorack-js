# Waveform plotter

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Plot+Waveform)

1. Start the patch. The VCO’s saw runs into Plot and through to both speakers. Tune the oscillator low and shorten the time window to see the repeated ramps more clearly.
2. Freeze the trace, then change the oscillator’s pitch. Release Freeze to see the new spacing. For a single percussive shape, patch a drum to Audio and its striking pulse to Trig.

## In a composition

For comparing attacks, capture a kick, then a snare at the same time scale. The panel’s image and data export controls let you keep the resulting traces.

## Panel reference

**Copy** puts the plotted data on the clipboard as CSV. **Save** downloads the CSV. **Plot** downloads a PNG of the waveform.

### Controls

| Panel | What it does |
| --- | --- |
| Time (`time`) | Sets the span of the displayed time window, from one to ten seconds. |
| Freeze (`freeze`) | Holds the waveform display so an event can be examined. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Audio (`audio`) | Audio | Supplies the changing audio or control voltage to display. |
| Trig (`trig`) | Trigger | Starts a capture aligned with an external pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Thru (`out`) | Audio | Passes the input signal onward while it is observed. |

## Design background

A time-domain plot records the shape of voltage over an interval. It is particularly handy for comparing events too fast to follow while they are moving.

[Research and implementation notes](../../research/modules/plot.md)
