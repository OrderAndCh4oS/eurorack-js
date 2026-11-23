# Stereo flanger

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Flanger)

1. Start the patch. A pulse wave feeds both sides of Flanger. Bring the mix up from dry and listen to the moving colour along the held note.
2. Increase Feedback to sharpen the pattern. Try a deep slow sweep, then reduce Depth and raise Rate for a smaller vibrating effect.

## In a composition

For a build-up over a drum break, open the depth across several bars and bring the mix back down when the beat lands. A pulse or saw makes the sweep easy to hear.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets the speed of the short delay sweep. |
| Depth (`depth`) | Sets how far the delay moves and how widely its peaks and notches sweep. |
| Fdbk (`feedback`) | Recirculates part of the delayed signal to emphasize the comb-like sound. |
| Mix (`mix`) | Blends the source with its short delayed copy. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In L (`inL`), In R (`inR`) | Audio | Feeds one side of the flanger with audio. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out L (`outL`), Out R (`outR`) | Audio | Carries the corresponding side of the flanged mix. |

## Design background

Flanging comes from combining a signal with a very slightly delayed copy. Moving that short delay moves the regularly spaced peaks and dips of a comb filter.

[Research and implementation notes](../../research/modules/flanger.md)
