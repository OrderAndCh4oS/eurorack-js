# Spectrogram

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Spectrogram)

1. Start the demo. A saw feeds the display and passes through to the speakers. Hold its pitch briefly, then move Coarse and watch the group of harmonic lines change height.
2. Turn Floor to reveal or hide quieter components. Change Time to see a longer history, then freeze a pitch sweep to inspect its path.

## In a composition

For a filter sweep, compare a spectrogram before and after the filter. The history shows which harmonics disappear first and how the resonance travels through them.

## Panel reference

**Copy** puts spectral data on the clipboard as CSV. **Save** downloads the CSV. **Plot** downloads a PNG of the display.

### Controls

| Panel | What it does |
| --- | --- |
| Time (`time`) | Sets how much recent history the display shows, from two to thirty seconds. |
| Floor (`floor`) | Sets the level below which spectral detail fades from view. |
| Freeze (`freeze`) | Holds the current spectral history for closer inspection or export. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Audio (`audio`) | Audio | Supplies the sound whose frequency content will be drawn over time. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Thru (`out`) | Audio | Passes the input onward for listening or further processing. |

## Design background

A spectrogram lays successive short-time spectra side by side. Frequency occupies the vertical axis, time the horizontal axis, and colour or brightness represents level.

[Research and implementation notes](../../research/modules/spectrogram.md)
