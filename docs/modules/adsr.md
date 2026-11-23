# Envelope generator (ADSR)

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+ADSR+Envelope)

1. Press **Start**. CLK holds the Gate input high for part of each beat. Env opens channel 1 of the VCA, which carries the VCO’s saw wave to the speakers.
2. Turn **Atk** down for a sharp onset, then lengthen it until the note swells. Slow CLK and compare **Sus**, the level during a held gate, with **Rel**, the time the note takes to fade afterwards.

## In a composition

For a bass part, use a quick attack, short decay and low sustain. For a bowed-string entrance, lengthen attack and release and use the same envelope to open the filter.

## Panel reference

### Controls

| Panel | What it does |
| --- | --- |
| Atk (`attack`) | Sets the time from a gate opening to the envelope’s peak. |
| Dec (`decay`) | Sets the time from the peak down to the sustain level. |
| Sus (`sustain`) | Sets the level maintained while the gate is held after decay. |
| Rel (`release`) | Sets the fade time after the gate closes. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Gate (`gate`) | Gate · 0 to 10 V | Starts the envelope when high and starts release when it falls. |
| Retr (`retrig`) | Trigger · 0 to 10 V | Restarts the attack during a held gate. |
| Atk (`attackCV`) | Control voltage · ±5 V | Changes the attack time under voltage control. |
| Dec (`decayCV`) | Control voltage · ±5 V | Changes the decay time under voltage control. |
| Rel (`releaseCV`) | Control voltage · ±5 V | Changes the release time under voltage control. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Env (`env`) | Control voltage · 0 to 5 V | Supplies the positive envelope that opens a VCA or moves a filter. |
| Inv (`inv`) | Control voltage · −5 to 0 V | Supplies an inverted version of the envelope. |
| EOC (`eoc`) | Trigger · 0 to 10 V | Pulses when the release has finished. |

## Design background

The four-stage envelope follows a keyboard gesture from key-down through key-up. Sending the shape to separate volume and filter controls is central to subtractive synthesis. [Doepfer’s gate and envelope example](https://doepfer.de/a100_man/a100t_e.htm)

[Research and implementation notes](../../research/modules/adsr.md)
