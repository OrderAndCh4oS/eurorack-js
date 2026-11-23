# Open and closed hi-hat

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Hat+Only)

1. Start the demo. CLK plays the closed jack and a divided version of the same clock plays the open jack. Listen for the longer ring among the short ticks.
2. Lengthen Decay to make the open hits easier to pick out. Adjust Sizzle and Blend for a brighter edge or a different balance of metallic and noisy sound.

## In a composition

For a drum-machine groove, keep closed strokes regular and place open strokes just ahead of selected closed hits. That next closure becomes part of the articulation.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Decay (`decay`) | Sets the ringing time of the hats. Open and closed strokes keep their different articulations. |
| Sizzle (`sizzle`) | Shifts the oscillator and filter frequencies that give the hat its bright edge. |
| Blend (`blend`) | Changes the balance between the available metallic and robotic timbres. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Open (`trigOpen`) | Trigger | Starts the longer, ringing open articulation. |
| Clsd (`trigClosed`) | Trigger | Starts the shorter closed stroke and cuts off a ringing open stroke. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Out (`out`) | Audio | Carries both hat articulations on one audio output. |

## Design background

The separate trigger inputs reflect the two familiar drum-machine hi-hat voices while sharing a choke relationship, so the order of the hits matters. [2hp Hat](https://www.twohp.com/modules/p/hat)

[Research and implementation notes](../../research/modules/hat.md)
