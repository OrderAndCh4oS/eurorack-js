# Voltage-controlled filter (VCF)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+VCF+Resonance)

1. Select **Start**. A sawtooth feeds In and the low-pass output goes through a VCA to both speakers. The LFO moves the filter’s Freq input while the oscillator holds its pitch.
2. Lower **Res**, turn **Freq** slowly, then bring Res back up and repeat. To compare filter shapes, move the VCA’s source cable from LP to HP or BP.

## In a composition

For an acid bass line, patch a short envelope to Freq and set Res high enough to hear an accent on each attack. A slow LFO in the same socket gives a sustained chord a longer arc.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Freq (`cutoff`) | Moves the filter frequency. On LP, turning it down removes upper harmonics. |
| Res (`resonance`) | Emphasizes the band near the cutoff, making the sweep more pronounced. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio | The sound to filter. Rich waves such as saw and pulse make the effect easy to hear. |
| Freq (`cutoffCV`) | Control voltage · 0 to 5 V | Moves the cutoff from an envelope, LFO or other voltage. |
| Res (`resCV`) | Control voltage · 0 to 10 V | Changes the amount of resonance under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| LP (`lpf`) | Audio | Low-pass output. Frequencies below the cutoff dominate. |
| BP (`bpf`) | Audio | Band-pass output. Frequencies around the selected band dominate. |
| HP (`hpf`) | Audio | High-pass output. Frequencies above the cutoff dominate. |

## Design background

The four-stage low-pass design takes its cue from Robert Moog’s transistor ladder. The patent was filed in 1966. Its feedback path helps explain why resonance can make one narrow region sing. [Moog’s filter patent](https://patents.google.com/patent/US3475623A/en)

[Research and implementation notes](../../research/modules/vcf.md)
