# Low-pass gate

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+LPG)

1. Start the demo. The oscillator’s triangle enters Audio and each clock hits Strike. The scope shows the shaped sound on one channel and the clock on the other.
2. Turn Damp and listen to the ringing tail between strikes. Change Mode with the clock still running to compare the contributions of volume and filtering.

## In a composition

For woody percussion, feed a bright wave into Audio and a sparse pattern into Strike. For a softer bass phrase, patch a shaped envelope into CV.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Level (`level`) | Sets how far the gate opens before external control or strikes are applied. |
| Damp (`damp`) | Sets the decay of the response to a strike. |
| Tone (`tone`) | Sets the brightness of the filter path. |
| Res (`resonance`) | Emphasizes the filter’s cutoff region in the filtering modes. |
| Mode (`mode`) | Chooses amplitude control, combined amplitude and low-pass filtering, or low-pass filtering. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In (`audio`) | Audio | The sound whose level or brightness will be shaped. |
| CV (`cv`) | Control voltage · 0 to 10 V | Opens the low-pass gate by an external control voltage. |
| Strike (`strike`) | Trigger · 0 to 10 V | Starts an internal decaying contour from a brief pulse. |
| Damp (`dampCV`) | Control voltage · 0 to 5 V | Varies how the gate decays following a strike. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries the input after the chosen gate and filter response. |

## Design background

The linked changes in brightness and loudness are associated with low-pass gates in Buchla-style patching. Make Noise’s Optomix gives a hardware example of the strike and damping approach. [Make Noise Optomix](https://www.makenoisemusic.com/modules/optomix/)

[Research and implementation notes](../../research/modules/lpg.md)
