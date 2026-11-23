# Pitch quantizer (QUANT)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Quantizer+Scales)

1. Start the patch. The LFO rises and falls at In. The quantized output drives the VCO while the VCA passes its triangle to both speakers.
2. Slow the LFO, then turn **Scale**. Compare the spacing of the notes. **Oct** moves the whole result to another register.

## In a composition

For a melodic techno line, quantize a stepped random voltage and clock it from a drum pattern. Keep the same rhythm and change the scale to vary the harmony.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Scale (`scale`) | Chooses the collection of notes that the incoming pitch can land on. |
| Oct (`octave`) | Transposes the result up or down by whole octaves. |
| Semi (`semitone`) | Offsets the quantized result by semitones to move it into another key. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`cv`) | Control voltage · ±5 V | Accepts the continuously varying pitch or modulation voltage that you want to turn into notes. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`cv`) | Control voltage · ≈ −7 to 7.92 V | Sends the nearest allowed note as one-volt-per-octave pitch. |
| Trig (`trigger`) | Trigger · 0 to 5 V | Sends a short pulse whenever the output changes note. Use it to articulate a voice. |

## Design background

Pitch quantization treats a continuous pitch cable like a set of frets. The selected scale determines which landing places are available.

[Research and implementation notes](../../research/modules/quant.md)
