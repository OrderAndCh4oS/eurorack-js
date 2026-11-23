# MIDI Input and Output

The rack uses standard MIDI ports. Play it from a keyboard, follow a drum machine’s clock, or send a sequence to a hardware synth. A digital audio workstation (DAW) can send notes to the rack, record the notes it sends back and capture its stereo sound on a separate audio track. [Connect a DAW](#connect-a-daw)

## Choose MIDI ports

Open the desktop rack in Chrome or Edge over HTTPS or localhost, allow MIDI access and select **MIDI Setup** in the toolbar. Connect a hardware device over USB MIDI or through a MIDI interface. For music software on the same computer, choose a virtual MIDI bus. [Browser MIDI permissions](https://developer.chrome.com/blog/web-midi-permission-prompt)

| Rack setting | What to select |
| --- | --- |
| **MIDI input** | The keyboard, interface input or virtual bus that sends notes, controllers or clock **into the rack**. A new tab starts on **All inputs**. |
| **MIDI output** | The synth, interface output or virtual bus that should **receive rack notes**. A new tab starts on **Off**. All **MIDI OUT** modules share this port. |

If a device uses the same name for its input and output, select its input explicitly to use it in both directions. **All inputs** skips a matching return port. Port choices last for the current tab. Saving a patch keeps its module channels and MIDI Learn mappings.

### Set up a virtual MIDI bus

To connect two apps on one computer, create a bus called **To Rack**. Add a second bus called **From Rack** if you also want to send notes back. A USB keyboard or MIDI interface can use its own ports directly.

- **macOS** — In **Audio MIDI Setup → Window → Show MIDI Studio**, open **IAC Driver**, enable **Device is online**, add or rename the buses, and click **Apply**. [Apple’s IAC setup](https://support.apple.com/guide/audio-midi-setup/transfer-midi-information-between-apps-ams1013/mac)
- **Windows** — Create the named ports in a virtual MIDI utility such as loopMIDI. Keep the utility running while you use the ports. [loopMIDI virtual ports](https://www.tobias-erichsen.de/software/loopmidi.html)

## Play the rack

Set your keyboard to MIDI channel 1, open **Test - MIDI-CV** and choose **Open in rack**, then **Start**. Hold a key and move the mod wheel. The key plays the voice and the wheel opens its filter. [Try the MIDI-CV voice](/patches?view=tests&q=Test%20-%20MIDI-CV)

| To play | Use this module | Rack connections |
| --- | --- | --- |
| A melody | **MIDI-CV** | **Pitch** → oscillator **V/Oct**, **Gate** → envelope **Gate**. The envelope controls a VCA between the oscillator and **OUT**. **Vel** supplies velocity and **Mod** supplies CC 1, both at 0–10 V. |
| Chords | **MIDI-4** | **P1/G1** through **P4/G4** supply four pitch/gate pairs. Connect each pair to its own voice. [Try the four-voice patch](/patches?view=tests&q=Test%20-%20MIDI-4%20Poly) |
| Drum hits | **MIDI-DRUM** | Eight assignable note numbers fire separate triggers. The first four default to 36, 38, 42 and 46 for kick, snare, closed hat and open hat. [Try the drum patch](/patches?view=tests&q=Test%20-%20MIDI-DRUM) |

**Channel numbers on the panels.** On **MIDI-CV**, **MIDI-4** and **MIDI-CC**, **Chan** runs from 0 to 15. Set it to **0** for MIDI channel 1 or **9** for channel 10. **MIDI-DRUM** uses **0** for all channels and **1–16** for a single channel. **MIDI OUT** uses **1–16** directly.

The **Bend** knob on MIDI-CV and MIDI-4 sets how far incoming pitch bend moves the pitch output. The default is two semitones in either direction.

For a browser controller, open **MIDI CC** (keys and knobs) or **MIDI Drum** (pads) from the rack toolbar. Each opens a separate tab and uses the first IAC output it finds, or the first available MIDI output. When **Connected to** shows a virtual bus, choose that same bus as the rack input.

## Control knobs with MIDI CC

To control a rack knob directly, select **MIDI Learn**, click the rack knob, then move a knob or fader that sends a MIDI Control Change (CC). Press **Escape** to finish. The mapping remembers both the MIDI channel and the CC number. Save the patch to reuse it.

To patch a CC into a modulation input, add **MIDI-CC**. Set one of its four CC numbers and connect the corresponding **CV1–CV4** output. Values 0–127 produce 0–10 V. In the example, CC 1 on channel 1 moves the filter cutoff while you hold a note. [Try the MIDI-CC patch](/patches?view=tests&q=Test%20-%20MIDI-CC)

## Follow MIDI clock

Enable MIDI clock and transport on the sending device or app. Patch **M‑CLK Clk → SEQ Clk** and **M‑CLK Rst → SEQ Rst**. Click **Start** in the rack, then press Play on the sender. Clock and transport apply across channels. The default **Div 2** produces quarter notes. The test patch uses **Div 4** for sixteenths. [Try the MIDI clock patch](/patches?view=tests&q=Test%20-%20MIDI-CLK)

MIDI Start resets the sequence and produces its first clock pulse. **Run** stays high during playback. Stop lowers **Run** and stops the clock pulses. Continue resumes without a reset.

## Send notes from the rack

1. In **MIDI Setup → MIDI output**, choose the receiving synth or virtual bus. Set **MIDI OUT → Chan** to the receiver’s channel.
2. Patch a sequencer’s **CV → MIDI OUT Pitch** and **Gate → MIDI OUT Gate**. Click **Start** in the rack and clock the sequencer from **CLK** or **M‑CLK**. Each time the gate rises to 1 V or higher, MIDI OUT reads the pitch and sends Note On. When the gate falls below 1 V, it sends Note Off for that same note.
3. Use **0 V** for MIDI note **60** and **+1 V** for **72**, with pitches rounded to the nearest semitone. Leave **Vel** empty for velocity 127, or patch 0–10 V for variable velocity. A velocity of zero skips the note. To play the next pitch, let the gate fall and rise again.

For chords, use one **MIDI OUT** per independent pitch/gate pair. The modules can share a channel. To hear the notes, use a hardware synth or load an instrument on the receiving DAW track. The built-in MIDI output sends Note On and Note Off. CC, pitch bend and clock/transport are available on the input side.

## Connect a DAW

Create two virtual buses and enable them in your DAW’s MIDI settings. Each bus connects an output in one app to an input in the other. [Virtual bus setup for macOS and Windows](#set-up-a-virtual-midi-bus)

| Signal | In the DAW | In the rack’s MIDI Setup |
| --- | --- | --- |
| DAW → rack | Send notes to the **To Rack** output. Enable outgoing MIDI clock and transport there to drive the rack sequencer. | **MIDI input → To Rack** |
| Rack → DAW | Receive notes on the **From Rack** input. | **MIDI output → From Rack** |

1. In **MIDI Setup**, select **Open MIDI starter**, then click **Start** in the rack. You can also open the same patch from the Module demos directory. [Test - MIDI In and Out](/patches?view=tests&q=Test%20-%20MIDI%20In%20and%20Out)
2. **Play the top row.** Set a MIDI track’s output to **To Rack, channel 1** and play a clip or pattern. For live playing, choose your keyboard as that track’s input. Keep the return bus on its own track so recorded notes cannot feed back into the rack.
3. **Record the bottom row.** Create a second track with an instrument and select **From Rack, channel 2** as its MIDI input. Arm it, enable input monitoring and start recording in the DAW. Its clock advances the rack sequencer every eighth note. The track should capture MIDI notes **60, 64, 67, 70** in a loop.

### Connect Ableton Live

In **Settings → Link, Tempo & MIDI**, enable **Track** and **Sync** on the **To Rack output** and **Track** on the **From Rack input**. On the clip track, choose **MIDI To → To Rack → Ch. 1** and **MIDI From → No Input** or your keyboard. On the instrument track, choose **MIDI From → From Rack → Ch. 2**, select **Monitor Auto**, arm it and record. [Live’s MIDI port settings](https://help.ableton.com/hc/en-us/articles/209774205-Live-s-MIDI-Settings) · [Live MIDI synchronization](https://help.ableton.com/hc/en-us/articles/209071149-Synchronizing-Live-via-MIDI)

For stereo loopback, choose **Ext. In → 1/2** (or your interface’s loopback pair) on a Live audio track. Arm it with **Monitor Auto**. To capture MIDI and audio together in Arrangement, arm both return tracks. [Record rack audio](#record-rack-audio)

### Connect REAPER

In **Preferences → Audio**, enable **From Rack** under **MIDI Inputs**. Under **MIDI Outputs**, enable **To Rack** and turn on **Send clock to output** for that port. Open the sending track’s routing window and set **MIDI Hardware Output** to **To Rack**, channel 1. On a second track, choose **Input: MIDI → From Rack → Channel 2**, add a virtual instrument, arm the track and enable input monitoring. Use the normal input recording mode to capture the notes. [REAPER User Guide, MIDI devices and track routing](https://dlx.reaper.fm/userguide/ReaperUserGuide786c.pdf)

## Record rack audio

**Record a WAV.** The starter’s **REC** module is wired to the top-row voice. While the rack is running, press its record button, play, then press it again to download the stereo WAV. Import the file into an audio track or sampler. For your own patch, connect your final mix to **REC L/R inputs** and **REC L/R outputs → OUT L/R**.

**Record in real time.** The rack’s browser audio connection is stereo output only. Route the browser to an audio interface’s loopback channels or to a virtual audio device. Choose the same loopback pair as the input of a stereo audio track in your recording software.

- **macOS** — Set the system audio output to **BlackHole 2ch** and select **BlackHole 2ch** as the recording app’s audio input. [BlackHole audio routing](https://github.com/ExistentialAudio/BlackHole)
- **Windows** — With VB-CABLE, send browser audio to **CABLE Input** and select **CABLE Output** as the recording app’s audio input. If you use an ASIO interface with loopback, choose its loopback pair. [VB-CABLE device directions](https://vb-audio.com/Cable/)

Route the recording app’s output to your headphones or interface. With interface loopback, feed the browser channels into the loopback mix and monitor the DAW on a separate pair. Arm the stereo track, start recording and play the rack. To capture notes and sound in the same take, arm the return MIDI track as well.

## Check a connection

- **The port list is empty.** Check that the device is connected or the virtual bus is online. If the browser denied access, allow MIDI in the site permissions and select **Retry MIDI access** in **MIDI Setup**.
- **A clip plays silently.** Open the dialog while the clip plays. An incoming note shows its number, channel and source. If it appears, check the receiving module’s **Chan** and the audio path through the VCA to **OUT**.
- **The return track is empty.** Watch for **Clock received** in the dialog. If clock arrives but **M‑CLK Run** stays dark, leave the rack running and stop and restart the sending sequencer’s transport. If the sequence advances, check the **MIDI OUT** gate, the selected output port and the armed track’s input channel.
