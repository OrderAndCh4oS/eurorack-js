# Spacer prints

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Spacer+Prints)

1. Right-click a panel or click its printed style name. Choose another print and select **Apply**. With a keyboard, focus the panel header and press **Shift+F10**.
2. Toggle **Dark mode** to see how the six prints look on the rack's dark faceplates. Both modes use the same signal orange as the module controls.
3. Choose **+ Spacer**, select a rack row and enter a width in HP. **Fill gap** uses all the space available in that row. Select **Add spacer** to mount the panel.

## In a composition

A 1 HP strip can mark the start of a voice. A larger print can separate a bank of oscillators from the effects you reach for during a set. Select a module before adding a spacer to insert the panel immediately after it. You can also drag the spacer into position while the rack plays.

## Panel reference

| Print | Artwork |
|---|---|
| Contour | Survey marks among nested topographic lines |
| Orbit | Tilted elliptical tracks around a planet and its satellites |
| Weave | Diagonal threads passing over and under one another |
| Dunes | A striped sun over layered ridgelines |
| Prism | Folded angular facets with fine engraved lines |
| Pulse | A stack of oscillograms on a measurement grid |

Each panel saves its width and print with the patch. The light or dark palette follows the viewer's rack theme. Open the same picker to resize an existing panel.

An agent can read free HP per row with `get_rack` and use `edit_spacer` to fill a gap, change a print or make room for another module during playback. [Agent spacer controls](../webmcp.md#place-spacers)

## Design background

Physical Eurorack blanks come in several widths and can carry screen-printed artwork. These six original designs extend across the rail as the width increases. A spacer is passive and has no jacks or sound controls. [Doepfer accessories](https://doepfer.de/a100z_e.htm) · [Research and implementation notes](../../research/modules/spacer.md)
