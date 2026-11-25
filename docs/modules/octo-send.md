# Octo Send

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Octo+Cable+Snake)

1. Press **Start**. A triangle wave plays on the left and a kick beats on the right. On row 1, the oscillator feeds jack 1 and the clock feeds jack 8.
2. Unplug jack 1 on Send. The tone stops while the kick keeps time. Reconnect the triangle to jack 1 to bring the tone back.
3. Unplug LINK. The tone stops and the last kick decays. Reconnect LINK to Octo Receive on row 2 to restore both routes at once.

## In a composition

Keep a sequencer and its clock together on the first row. Patch pitch into lane 1, gate into lane 2 and accent into lane 3. On a voice row, use those same numbered outputs for the oscillator, envelope and filter. Shift-drag another cable from Send LINK to a second Receive if another row needs the same signals.

## Panel reference

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| 1–4 (`in1`, `in2`, `in3`, `in4`) | Audio, CV, gate or trigger | Each goes to its own matching Receive output. |
| 5–8 (`in5`, `in6`, `in7`, `in8`) | Audio, CV, gate or trigger | These work independently, even if jacks 1–4 are empty. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| LINK (`link`) | Eight lanes | Connect to LINK on one or more Octo Receives. Each receives all eight signals. |

## Design background

The Intellijel Octalink joins two cases through a single cable with matching numbers at either end. EurorackJS gives the sending and receiving ends their own panels. [Intellijel Octalink 1U](https://intellijel.com/shop/eurorack/1u/octalink-1u/)

[Research and implementation notes](../../research/modules/octo-send.md)
