# Two-lane CV and gate recorder

## Try the patch

[Open in rack](https://eurorackjs.orderandchaos.xyz/?test=Test+-+CV+Recorder)

1. Start the demo. An LFO, stepped random voltage and divided gates feed the recorder. Press REC, capture several clock ticks and press REC again. Playback begins on the next clock edge. Compare its two voltage lanes on the scope.
2. The first lane colours the pluck and its gate strikes the string. The second lane goes through an attenuverter and quantizer to pitch. Compare STEP and SMOOTH on playback to hear what happens between recorded values.

## In a composition

Capture a joystick phrase and use the same take for two different voices. A recorded accent pattern can be reused while you change the instruments it conducts.

## Panel reference

The take belongs to this rack session. The patch stores the panel settings. Reloading the page clears the recorded lanes.

### Controls

| Panel | What it does |
| --- | --- |
| FREE / CLOCK (`mode`) | Chooses free-time gesture capture or recording and playback synchronized to clock edges. |
| STEP / SMOOTH (`shape`) | Selects held step values or smooth changes between recorded CV values. |
| LOOP / ONE (`playMode`) | Chooses repeating or one-shot playback. |
| REC / STOP (`record`) | Starts or finishes a take. In Clock mode the next clock edge commits an armed start or stop. |
| PLAY / PAUSE (`play`) | Pauses or resumes a captured take. A paused lane holds its current value. |
| REWIND (`resetAction`) | Rewinds the playhead to the beginning of the take. |
| ERASE (`clear`) | Erases the captured lanes. |

### Inputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV 1 IN (`cv1In`), CV 2 IN (`cv2In`) | Control voltage · ±10 V | Records the continuous movement for the correspondingly numbered lane. |
| GATE 1 IN (`gate1In`), GATE 2 IN (`gate2In`) | Gate · 0 to 10 V | Records the gate articulation for this lane. |
| CLOCK (`clock`) | Trigger · 0 to 10 V | Supplies the timebase in Clock mode. |
| REC (`recordTrig`) | Trigger · 0 to 10 V | Requests the same start/stop operation as the recording control. |
| RESET (`reset`) | Trigger · 0 to 10 V | Rewinds the take from an external pulse. |

### Outputs

| Jack | Signal | What it does |
| --- | --- | --- |
| CV 1 OUT (`cv1Out`), CV 2 OUT (`cv2Out`) | Control voltage · ±10 V | Carries the corresponding CV lane for monitoring and playback. |
| GATE 1 OUT (`gate1Out`), GATE 2 OUT (`gate2Out`) | Gate · 0 to 10 V | Carries the corresponding gate lane to an envelope or voice trigger. |
| EOL (`eol`) | Trigger · 0 to 10 V | Sends a pulse at the end of the recorded loop. |

## Design background

A control recorder preserves a gesture separately from the sound it controls. Clocked and free timing support both step sequences and gestures played by hand.

[Research and implementation notes](../../research/modules/cv-rec.md)
