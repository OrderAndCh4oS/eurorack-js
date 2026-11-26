# Spacer panels

## Panel and size

A Eurorack blank occupies a length of rail and needs only its mounting hardware. Doepfer specifies a horizontal pitch of 5.08 mm and leaves a small tolerance on the manufactured panel width. Its accessory catalogue includes narrow blanks and wide covers. ModularSynthLab also prints graphics on blank panels. These references inform the proportions and mounting details. The six prints in the emulator are original designs.

- Doepfer, *A-100 construction details*, undated, accessed 2026-11-26. Rail pitch, front-panel dimensions and tolerance. [Construction details](https://doepfer.de/a100_man/a100m_e.htm)
- Doepfer, *A-100 accessories*, undated, accessed 2026-11-26. Examples of passive blind plates sold by width. [A-100 accessories](https://doepfer.de/a100z_e.htm)
- ModularSynthLab, *Eurorack Blank Panels 3U*, undated, accessed 2026-11-26. Printed graphics and mounting treatment on 3U panels. [Printed blank panels](https://modularsynthlab.com/product/eurorack-blank-panels-3u/)

## Implementation Plan

The built-in `spacer` belongs to the Other category. This checkout implements a single variable-width accessory on the current branch. The emulator uses exact grid units for layout and accepts every whole width from 1 HP to the rack's 84 HP. A panel added by code defaults to 4 HP and Contour. The interactive picker offers the remaining row width.

Each instance stores `hp` and `style` in patch state. Contour uses nested elevation lines, Orbit uses elliptical tracks, Weave uses interlaced bands, Dunes uses a layered landscape, Prism uses angular facets and Pulse uses stacked waveforms. The six prints use the faceplates of VCF, MIX, DIV, VCO, LFO and VCA respectively. Artwork draws with the Industrial theme's ink, neutral shades and signal orange. The panel hardware, picker and saved previews follow the same light and dark theme. Right-click or Shift+F10 opens the artwork picker. [Industrial colours](../../src/industrial-theme.css)

The print name sits between the artwork and the bottom screw on 1–4 HP panels. It reads vertically at 1–2 HP and horizontally at 3–4 HP. From 5 HP the footer also shows the width. The artwork button's accessible name includes the print and width at every size.

Agents can inspect the available HP on each row, place and reprint a spacer, or remove it to reclaim room for a module. A direct spacer edit uses the current rack revision and updates the existing panel layout during playback.

The panel has no controls that affect a signal, jacks, LEDs, normal voltages or calibration. Its contract factory supplies empty input and output maps. Production audio omits the panel altogether. Original procedural artwork is drawn when its width, style or palette changes. The six-panel factory demo illustrates both theme previews.

Test all integer widths, rejected widths and styles, row capacity, independent patch state, copying, hosted validation and exclusion from audio and wiring diagnostics. In a browser check the fill action, keyboard and context-menu editing, light/dark switching and changes during playback. Run the focused spacer and contract tests, the strict DSP audit matrix for the spacer and the complete test suite.

## DSP Audit (2026-11-26)

The strict voltage matrix returned zero errors and zero voltage flags at 44.1, 48 and 96 kHz with 128- and 512-frame blocks. In Chromium a VCO patch continued producing audio at the same active worklet revision while spacers were added, resized and reprinted. A shared patch link restored all six panel choices. [Panel tests](../../tests/dsp/spacer.test.js) · [Browser checks](../../tests/e2e/spacers.spec.js)
