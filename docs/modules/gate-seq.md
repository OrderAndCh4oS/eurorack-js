# Four Track Gate Sequencer

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+Four+Track+Gate+Sequencer)

1. Start audio. A plays four kicks per bar and B plays the backbeat. C runs a seven-step closed hat against the 16-step kick. Listen for two quick strikes on its last step. D brings in an open hat.
2. Press and hold **Hold fill** to play a Loopy fill. The sequencer reads steps 17–20, including a snare roll stored outside the regular pattern. Release to rejoin the groove where it would have been playing. Mute B and try the fill again to hear the hat part on its own against the kick.
3. Select track C and open **Settings**. Change Length from 7 to 8. The extra silent step keeps the hat accents in the same place on each pass through the kick pattern. Return to **Steps**, choose **Ratchets**, select step 7 and change Hits to ×3.
4. Open **Memory**, choose a slot and press **Save**. Change a rhythm or mute a track, then press **Load** to restore all four tracks in time with the running clock.

## In a composition

Keep the kick at ×1 and set a sparse percussion track to ×2. The faster track visits two different steps per incoming clock period after it has measured the tempo. Ratchets divide one programmed hit into repeats, so the following rest keeps its place. Try a three-hit ratchet with a low Chance setting for a roll that sometimes drops out as a group.

For contrasting sections, save a sparse pattern and a busy variation into different slots. Loading one changes all four tracks and their mutes together. For a shorter change, program spare steps on page 2, set the Fill endpoints to cover them and hold Fill for the turnaround.

## Panel reference

Choose A–D under **Track**. In **Steps**, choose one of four pages and click a numbered pad to toggle it. A solid dot marks a hit and an open circle marks a rest. A dashed border marks a step outside the track length. An underline follows the playhead. In Ratchets mode a box marks the edit target. Choose a pad and set Hits to 1, 2, 3, 4, 6, 8 or 12. An inactive pad retains its hit count.

**Settings** edits the selected track. Length sets its repeat from 1 to 64 steps. Clock rate divides by 2, 3, 4, 8, 16, 32 or 64, follows the clock at ×1, or multiplies by 2, 3 or 4. Gate sets the percentage of the step held high. At 100%, adjacent single hits can tie. Swing sets the first half of each two-step pair to 50–78% of the pair. Delay adds 0–58% of a step to every onset. Chance sets a 0–100% probability per enabled cell. Rotation moves hits and ratchets up to 63 steps in either direction within the active length. Positive values move them later.

The four **Mute** buttons silence tracks independently while their playheads continue. **Memory** provides eight whole-pattern slots. Save includes all steps, settings and mutes. Each slot shows Empty or Saved. Loading creates an editable copy and keeps the transport running. The working pattern and memory slots travel with the rack patch.

### Controls

| Panel | What it does |
| --- | --- |
| Fill from (`fillFirst`) | Selects the first endpoint, 1–64. Set both endpoints to one step to repeat it. |
| Through (`fillLast`) | Selects the other endpoint. A fill plays from the lower endpoint through the higher one, including both. Cells beyond a track’s length play at their written addresses. |
| Hold fill (`fill`) | Hold with a pointer, Space or Enter to loop the selected range at each track’s rate. Release to return to each track’s underlying phase. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CLK (`clock`) | Trigger · 0–10 V | A rise above 2.5 V advances the transport. The first edge starts step 1. A second edge establishes the tempo for multiplied steps. |
| RST (`reset`) | Trigger · 0–10 V | A rise to 1 V clears pending hits and arms step 1. A simultaneous clock plays it immediately. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| A (`a`) | Gate · 0 or 10 V | Track A, patched to the kick trigger in the demo. |
| B (`b`) | Gate · 0 or 10 V | Track B, patched to the snare trigger. |
| C (`c`) | Gate · 0 or 10 V | Track C, patched to the closed hat. |
| D (`d`) | Gate · 0 or 10 V | Track D, patched to the open hat. |

## Design background

Intellijel Steppy inspired the four independent gate tracks, pattern memories and performance loops. The rack version adds multiplication and exposes both fill endpoints so one hand can play a fill. Each jack has its own activity light.

[Research and implementation notes](../../research/modules/gate-seq.md)
