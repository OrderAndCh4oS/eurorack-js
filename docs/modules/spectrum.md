# Spectrum analyzer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Spectrum+Analyzer)

1. Start the patch. A sawtooth goes through the analyzer to both speakers. Look for the repeating family of harmonic peaks above the lowest one.
2. Turn the VCO’s pitch and watch the family move. Replace its saw cable with the triangle to compare high-frequency content at the same pitch, then try the Log/Lin scale.

## In a composition

Use the display to tune a resonator against a bass line or find out where a bright layer is masking a lead. A note with a clear attack may look different a moment later.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Floor (`floor`) | Sets the quietest level shown on the spectrum. A lower floor reveals weaker bands. |
| Decay (`decay`) | Sets how quickly displayed levels fall after their energy drops. |
| Log/Lin (`scale`) | Chooses logarithmic or linear frequency spacing across the display. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Audio (`audio`) | Audio | Supplies the signal to analyze. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Thru (`out`) | Audio | Passes the measured signal onward. |

## Design background

A Fourier transform measures energy in frequency bands over a short window. This panel presents that result as a live spectrum.

[Research and implementation notes](../../research/modules/spectrum.md)
