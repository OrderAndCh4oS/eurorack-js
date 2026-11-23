# Stereo chorus

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Chorus)

1. Start the patch in stereo. The same plain triangle feeds both inputs. Turn Mix down to hear it dry, then raise Mix and listen to the image widen.
2. Raise Depth at a slow Rate, then speed up Rate. One control sets how far the detuning travels and the other sets how often the movement repeats.

## In a composition

For a string pad, keep Rate slow and add just enough Mix to spread the held chord. A deeper, faster setting gives an electric-keyboard line a wavering edge.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Rate (`rate`) | Sets the speed of the modulation that moves the delayed copies. |
| Depth (`depth`) | Sets how far the delays move and therefore the amount of pitch movement. |
| Mix (`mix`) | Balances the original signal with the chorus voices. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| In L (`inL`), In R (`inR`) | Audio | Feeds the indicated side of the stereo chorus. In the demo both receive the same triangle. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out L (`outL`), Out R (`outR`) | Audio | Carries the matching side of the widened, modulated mix. |

## Design background

Chorus effects imitate the small timing and tuning differences among players performing the same part. Modulated delay lines make those differences controllable.

[Research and implementation notes](../../research/modules/chorus.md)
