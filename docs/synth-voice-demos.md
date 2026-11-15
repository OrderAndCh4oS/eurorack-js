# Synth Voice Basics

Learn how pitch, tone and volume fit together using patches from the **Test patches** view. Each link below finds a working example in the catalogue. Select **Open in rack**, then **Start** to hear it.

## Follow the sound

A basic subtractive voice has this audio path:

```text
Oscillator → Filter → VCA → OUT
```

The oscillator makes the waveform, the filter changes its frequency content, and the VCA controls its level. **OUT** sends the result to your speakers. Pitch CV and envelopes control this path through separate cables.

Open [Test - VCO Only](/patches?view=tests&q=Test%20-%20VCO%20Only). Its triangle and ramp outputs pass through separate VCA channels to the left and right outputs. Turn the VCA's channel gains down one at a time to compare the waveforms. The triangle has less high-frequency content than the ramp.

## Shape each note

Open [Test - ADSR Envelope](/patches?view=tests&q=Test%20-%20ADSR%20Envelope). A clock drives the ADSR's gate input. The envelope controls the VCA while the oscillator supplies the audio.

- **Attack** controls how quickly the envelope rises.
- **Decay** controls how quickly it falls toward the sustain level.
- **Sustain** is the level held while the gate stays high.
- **Release** controls how quickly it falls after the gate goes low.

This patch starts with sustain at zero. Raise sustain to hear the difference between a short pluck and a held note. For a long attack, slow the clock so the gate stays high long enough for the envelope to rise.

## Move the filter

Open [Test - VCF Resonance](/patches?view=tests&q=Test%20-%20VCF%20Resonance). An LFO moves the filter cutoff while the VCO's ramp passes through its low-pass output.

Change the cutoff and resonance separately. Disconnect the cutoff CV cable to hear the filter at a fixed setting, then reconnect it to restore the movement. The VCF also has band-pass and high-pass outputs; try one in place of the low-pass connection to the VCA.

## Control modulation depth

Open [Test - LFO → VCO Pitch](/patches?view=tests&q=Test%20-%20LFO). The LFO changes oscillator pitch through its V/OCT input. A one-volt rise at this input raises pitch by one octave.

Then open [Test - Attenuverter](/patches?view=tests&q=Test%20-%20Attenuverter). It puts an attenuverter between the LFO and oscillator. Turn its first attenuation control toward the centre to reduce the pitch movement; move past the centre to invert it. The offset control shifts the whole signal up or down.

## Add a sequence

Open [Test - Sequencer](/patches?view=tests&q=Test%20-%20Sequencer). The clock advances the sequence. Its CV output sets oscillator pitch, and its gate output triggers the envelope. Audio runs through the filter and the VCA's second channel to **OUT**.

Change a step's pitch, then switch its gate off. The pitch value still belongs to that step, but the envelope no longer receives a new gate there. Try a shorter sequence length to repeat a smaller phrase.

## Save your version

Use **Save a copy** to keep an edited test patch. Choose this browser for a local save, or sign in to save it to your account. Account copies start private; save again and choose **Public** when you want to share them.

For a complete voice built in code, follow the [Patch Workbench Guide](patch-workbench-guide.md). Use **Debug** to check the wiring if a patch is silent. A connected path alone does not guarantee sound: check oscillator levels, VCA gain and envelope gates too.
