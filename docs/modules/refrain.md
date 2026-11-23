# Refrain phrase sequencer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Refrain)

1. Start the patch. Key steers Changes, Harm chooses chords on ARP, Energy changes the density of Cascade, and Mod colours the two plucks. Watch Energy on the scope’s second channel as you listen.
2. Switch Anchor to Hold to capture the phrase. Choose one mutation lane and turn the others off. Press Mutate and listen for what changes in the next phrase, then use Recall to return to the stored anchor. The patch also clocks a random source into Seed CV.

## In a composition

For a verse and refrain, keep the key lane anchored and vary the energy or timbre between repeats. Returning to an earlier phrase can make a long generative performance feel familiar.

## Panel reference

The anchor belongs to the current session. Entering Hold again replaces it with the phrase that is playing.

### Controls

| Panel | What it does |
| --- | --- |
| Seed (`seed`) | Selects the starting phrase. Reusing a seed recalls the same starting material. |
| Length (`length`) | Chooses the number of phrase cells in the loop, from one to eight. |
| Amount (`amount`) | Sets how many cells a mutation can affect. |
| Chance (`chance`) | Sets the probability of automatic mutation as the phrase runs. |
| Anchor Run/Hold (`anchor`) | Entering Hold captures the current phrase as the session anchor and pauses automatic mutation and unattended seed changes. Clocking and manual mutation still work. |
| Key (`mutateKey`), Harm (`mutateHarm`), Energy (`mutateEnergy`), Mod (`mutateMod`) | Includes the named lane in a mutation. Switch it off to protect that part of the phrase. |
| Mutate (`mutate`) | Requests a variation in the enabled lanes. |
| Recall (`recall`) | Queues the stored anchor for the next cell boundary. Enter Hold once to capture an anchor first. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Clock (`clock`) | Trigger · 0 to 10 V | Steps the phrase timing from an external pulse. |
| Reset (`reset`) | Trigger · 0 to 10 V | Aligns the play position to an external phrase boundary. |
| Seed CV (`seedCV`) | Control voltage · ±5 V | Addresses a starting phrase under voltage control. Seed changes take effect on a cell boundary. |
| Mutate (`mutateTrig`) | Trigger · 0 to 10 V | Requests a variation from a trigger. |
| Recall (`recallTrig`) | Trigger · 0 to 10 V | Requests restoration of the most recent anchor. |
| Hold (`hold`) | Gate · 0 to 10 V | Engages Hold from a gate, capturing the phrase on entry. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| Key (`key`) | Control voltage · ±1 V | Carries the phrase’s key movement. Send it to a harmonic sequencer’s key control. |
| Harm (`harm`) | Control voltage · 0 to 5 V | Selects harmonic shapes, such as chord choices on an arpeggiator. Set the destination’s base choice to zero for an absolute selection. |
| Energy (`energy`) | Control voltage · ±5 V | Carries the energy contour. Use it to control pattern density or a musical accent. |
| Mod (`mod`) | Control voltage · ±5 V | Supplies an additional changing voltage for voicing, brightness or articulation. |

## Design background

This original design treats song form as a set of repeatable control patterns. A shared seed lets related lanes change together while a recalled anchor gives the piece somewhere to return.

[Research and implementation notes](../../research/modules/refrain.md)
