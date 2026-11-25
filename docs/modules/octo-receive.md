# Octo Receive

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Octo+Cable+Snake)

1. Press **Start**. On the second row, Receive jack 1 sends a triangle wave to the left speaker. Jack 8 sends clock pulses to KICK, which you hear on the right.
2. Unplug jack 8 on Receive. The kick finishes its last beat and the left-hand tone carries on. Reconnect jack 8 to KICK's trigger input to bring back the rhythm.
3. Move the Receive end of the LINK cable off its jack. All eight lanes now supply zero volts. Reconnect the two LINK jacks and the short cables around Receive are ready to play again.

## In a composition

Put Receive beside a group of voices and run one LINK cable from an Octo Send on the sequencer row. A pitch on lane 1 and gate on lane 2 can feed several nearby voices. Shift-drag from a numbered output to use that signal at another input.

## Panel reference

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| LINK (`link`) | Eight lanes | Takes one cable from an Octo Send LINK. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1–4 (`out1`, `out2`, `out3`, `out4`) | Audio, CV, gate or trigger | Deliver Send inputs 1–4 at their original voltages. |
| 5–8 (`out5`, `out6`, `out7`, `out8`) | Audio, CV, gate or trigger | Deliver Send inputs 5–8. An open lane supplies 0 V. |

Any cable plugged into a destination jack overrides that jack's normal. To restore a VCA's built-in CV level, for example, unplug the cable at the VCA. Unplugging LINK leaves the VCA patched to a silent lane.

If an output is quiet, check the same number at Send. The wiring debugger follows connections between whole modules, so Send 1 and Receive 2 can both have cables while lane 2 has no source.

## Design background

Like the Intellijel Octalink, both panels use the same jack numbers. In the digital rack, replacing a direct cable with an Octo lane preserves pitch and clock timing. [Intellijel Octalink manual](https://intellijel.com/downloads/manuals/octalink-1u_manual_2021.08.03.pdf)

[Research and implementation notes](../../research/modules/octo-receive.md)
