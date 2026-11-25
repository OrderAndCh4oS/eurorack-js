// The test patch name is the stable key in TEST_PATCHES. Shared demos have a guide for each instrument.
export const MODULE_DEMOS = [
    {
        id: "midi-cv", title: "MIDI to pitch and gate", patch: "Test - MIDI-CV",
        intro: "Play one rack voice from a keyboard or a MIDI track. Each note becomes a pitch voltage and a gate that follows the time you hold the key."
    },
    {
        id: "midi-4", title: "Four-voice MIDI interface", patch: "Test - MIDI-4 Poly",
        intro: "Spread a chord across up to four pitch and gate pairs. Each pair can play its own oscillator and articulate its own envelope."
    },
    {
        id: "midi-cc", title: "MIDI controller to CV", patch: "Test - MIDI-CC",
        intro: "Turn four knobs or faders on a MIDI controller into patchable voltages. A recorded automation lane can move the same parameters on playback."
    },
    {
        id: "midi-clk", title: "MIDI clock and transport", patch: "Test - MIDI-CLK",
        intro: "Let another sequencer set the pace of the rack. Incoming transport messages can start the pattern at its beginning and supply a steady pulse."
    },
    {
        id: "midi-drum", title: "MIDI drum triggers", patch: "Test - MIDI-DRUM",
        intro: "Play a kit from pads or a drum track. Each assigned MIDI note produces a short pulse at its own jack."
    },
    {
        id: "clk", title: "Clock (CLK)", patch: "Test - Clock Divisions",
        intro: "A clock sends regular electrical beats. You hear the instruments it triggers and the sequences it advances."
    },
    {
        id: "div", title: "Clock divider and multiplier (DIV)", patch: "Test - Clock Divisions",
        intro: "Give DIV one beat and it will produce two related rhythms. One output can mark long beats while the other fills the space between them."
    },
    {
        id: "swing", title: "Swing clock", patch: "Test - Swing",
        intro: "Swing moves selected subdivisions later while the underlying pulse keeps its place. Compare a straight pulse with a swung one to hear the groove."
    },
    {
        id: "burst", title: "Burst generator", patch: "Test - Burst",
        intro: "A burst turns one cue into a short run of triggers. It can make a drum roll, a ratchet on a bass step or a quick ornament."
    },
    {
        id: "gate-delay", title: "Gate delay", patch: "Test - Gate Delay",
        intro: "Delay the start of a gesture, choose how long it stays on, or do both. Gate Delay works on note timing."
    },
    {
        id: "cascade", title: "Cascade rhythm generator", patch: "Test - Changes + Cascade",
        intro: "Cascade plays related trigger patterns. A sparse bass line and a busier lead can share accents because the patterns are nested."
    },
    {
        id: "lfo", title: "Low-frequency oscillator (LFO)", patch: "Test - LFO → VCO Pitch",
        intro: "An LFO repeats a movement for you. It can make a pitch wobble, a filter open and close, or a volume swell in time."
    },
    {
        id: "quad-lfo", title: "Quadrature LFO", patch: "Test - Quad LFO",
        intro: "Four sine waves turn at the same speed, each a quarter of a cycle behind the previous one. One knob can choreograph four related movements."
    },
    {
        id: "nse", title: "Noise generator (NSE)", patch: "Test - Noise Output",
        intro: "Noise supplies the hiss in a snare, the air around a flute or a stream of unpredictable voltages. It has texture even when it has no definite note."
    },
    {
        id: "sh", title: "Sample and hold (S+H)", patch: "Test - S&H → Pitch",
        intro: "A sample and hold takes a snapshot of a voltage and keeps it until the next trigger. Sampling noise turns a continuous hiss into a staircase of pitches."
    },
    {
        id: "quant", title: "Pitch quantizer (QUANT)", patch: "Test - Quantizer Scales",
        intro: "A quantizer turns a freely moving voltage into notes from a scale. A smooth sweep can become a melody with audible steps."
    },
    {
        id: "arp", title: "Arpeggiator", patch: "Test - Arpeggiator",
        intro: "An arpeggiator turns a chord into a line, picking one chord tone for each incoming pulse."
    },
    {
        id: "changes", title: "Changes harmonic sequencer", patch: "Test - Changes + Cascade",
        intro: "Changes writes a line and a bass root from a shared key and scale. The two voices can sound related even when they strike at different times."
    },
    {
        id: "refrain", title: "Refrain phrase sequencer", patch: "Test - Refrain",
        intro: "Refrain gives a patch a recurring musical phrase. Its four lanes can change the key, harmony, rhythmic energy and tone together."
    },
    {
        id: "seq", title: "Eight-step sequencer", patch: "Test - Sequencer",
        intro: "Arrange up to eight pitches in a repeating row. Each step has a separate gate, so you can decide both what note would play and whether it gets an attack."
    },
    {
        id: "prob-seq", title: "Probability sequencer", patch: "Test - Probability Sequencer",
        intro: "Write a rhythm that can take a different turn on each pass. Individual steps decide whether to play, under what conditions and how many strikes to make."
    },
    {
        id: "seq-switch", title: "Sequential switch", patch: "Test - Sequential Switch",
        intro: "A sequential switch changes which cable you hear on each pulse. It can also send one incoming signal to a succession of destinations."
    },
    {
        id: "euclid", title: "Euclidean rhythm generator", patch: "Test - Euclidean",
        intro: "Choose a number of hits and a length, and Euclid spaces the hits around the cycle. Rotate moves the pattern under the beat."
    },
    {
        id: "logic", title: "Gate logic (AND / OR)", patch: "Test - Logic",
        intro: "Combine two rhythms by listening for their coincidences or their union. AND fires while both gates are high, and OR stays high while either one is high."
    },
    {
        id: "mult", title: "Multiple (signal splitter)", patch: "Test - Mult",
        intro: "A multiple sends copies of one signal to several destinations. It is especially handy when you want to see all the branches of a patch in one place."
    },
    {
        id: "octo-send", title: "Octo Send", patch: "Test - Octo Cable Snake",
        intro: "Gather up to eight signals on one rack row and run a single cable to Octo Receive. Each signal has its own numbered jack at both ends."
    },
    {
        id: "octo-receive", title: "Octo Receive", patch: "Test - Octo Cable Snake",
        intro: "Pick up eight signals from Octo Send next to the modules that need them. One LINK cable reconnects all eight paths."
    },
    {
        id: "matrix", title: "Matrix mixer", patch: "Test - Matrix Mixer",
        intro: "Build four different blends from the same four inputs. Each knob sits at the crossing of one source and one destination."
    },
    {
        id: "joystick", title: "Joystick controller", patch: "Test - Joystick Controller",
        intro: "Shape two things with one hand. Moving the stick sideways and vertically produces separate control voltages, and a gesture can be recorded and played back."
    },
    {
        id: "vco", title: "Voltage-controlled oscillator (VCO)", patch: "Test - VCO Only",
        intro: "An oscillator supplies a note that lasts as long as the rack is running. Its different outputs give the same note different colours."
    },
    {
        id: "wavetable", title: "Wavetable oscillator", patch: "Test - Wavetable",
        intro: "Travel through a collection of wave shapes while holding one note. The tone can grow bright, hollow or reed-like without a change in pitch."
    },
    {
        id: "complex-vco", title: "Complex harmonic oscillator", patch: "Test - Complex VCO",
        intro: "Build a tone from its fundamental and two families of overtones. Modulating the oscillator’s phase or frequency gives the note another layer of movement."
    },
    {
        id: "ensemble-vco", title: "Ensemble oscillator", patch: "Test - Ensemble VCO",
        intro: "Play a cluster of tuned oscillators from one panel. Spread opens the cluster into a chord, while small tuning differences give a held note movement."
    },
    {
        id: "pluck", title: "Plucked string voice", patch: "Test - Pluck",
        intro: "Strike a virtual string with a pulse. One jack says when to pluck and another sets the note, so this voice needs no separate oscillator or amplitude envelope."
    },
    {
        id: "vcf", title: "Voltage-controlled filter (VCF)", patch: "Test - VCF Resonance",
        intro: "A filter lets you change the brightness of a held note. Resonance brings the frequencies near the filter’s edge forward until you can hear the sweep as a separate accent."
    },
    {
        id: "lpg", title: "Low-pass gate", patch: "Test - LPG",
        intro: "A low-pass gate can make a sustained tone fade and darken in one gesture. A short strike gives it the contour of a plucked or tapped object."
    },
    {
        id: "formant", title: "Formant filter", patch: "Test - Formant",
        intro: "Give an oscillator a vowel-like colour. Several peaks move together in the spectrum, changing the apparent shape of the sound while the oscillator holds its note."
    },
    {
        id: "resbank", title: "Resonator bank", patch: "Test - Resonator Bank",
        intro: "Make an impulse ring as if it struck a string, plate or other resonant body. You choose the tuning and which parts of the ringing sound come forward."
    },
    {
        id: "fold", title: "Wavefolder", patch: "Test - Fold",
        intro: "A wavefolder adds harmonics by bending a waveform back on itself. A plain triangle can acquire a bright, rippling edge as the folds get deeper."
    },
    {
        id: "ring", title: "Ring modulator", patch: "Test - Ring",
        intro: "Combine two oscillators by multiplying them. As you retune one oscillator, the result can move from a pitched buzz into bell-like or beating tones."
    },
    {
        id: "vocoder", title: "Twelve-band vocoder", patch: "Test - Vocoder",
        intro: "Let the shape of one sound articulate another. The modulator supplies changing frequency-band levels and the carrier supplies the tone you hear through them."
    },
    {
        id: "rnd", title: "Random voltage generator", patch: "Test - Rnd",
        intro: "Get a sequence of new values, a smoothly moving voltage and a gate pattern from one source. A seed lets you revisit a particular run of decisions."
    },
    {
        id: "envf", title: "Envelope follower", patch: "Test - Envf",
        intro: "Turn the loudness contour of an audio signal into a voltage. A second instrument can follow the first one’s phrasing without copying its pitch."
    },
    {
        id: "func", title: "Function generator", patch: "Test - Func Envelope",
        intro: "Draw a rise and fall from a single trigger. The same pair of time controls can also smooth a moving voltage or repeat as a modulation source."
    },
    {
        id: "adsr", title: "Envelope generator (ADSR)", patch: "Test - ADSR Envelope",
        intro: "An envelope draws the shape of a note over time. Patch it to volume and a continuous buzz can become a pluck, a held organ note or a slow swell."
    },
    {
        id: "vca", title: "Voltage-controlled amplifier (VCA)", patch: "Test - ADSR Envelope",
        intro: "A VCA lets one signal turn another up or down. In a synth voice, it gives a continuously running oscillator a beginning and an end."
    },
    {
        id: "atten", title: "Dual attenuverter", patch: "Test - Attenuverter",
        intro: "Resize a control movement, turn it upside down or move its centre. Each of the two channels has its own amount and offset."
    },
    {
        id: "slew", title: "Dual slew limiter", patch: "Test - Slew Limiter",
        intro: "Slow down sudden changes in voltage. On a pitch cable, abrupt jumps between notes become audible slides."
    },
    {
        id: "dly", title: "Delay", patch: "Test - Delay",
        intro: "Make a second copy of a sound arrive later. Feeding part of the delayed sound back into the line creates a train of echoes."
    },
    {
        id: "tape", title: "Tape echo", patch: "Test - Tape",
        intro: "Give repeats a recorded, uneven character. Multiple playback heads, saturation and small speed variations can make the echo sound quite different from the original."
    },
    {
        id: "verb", title: "Stereo reverb", patch: "Test - Reverb",
        intro: "Put a sound in an apparent space. A spreading tail carries on after the dry instrument stops, with the size of that gap easy to hear on short notes."
    },
    {
        id: "chorus", title: "Stereo chorus", patch: "Test - Chorus",
        intro: "Make one held note sound like several slightly different performances. Short moving delays introduce small changes in timing and pitch across the stereo field."
    },
    {
        id: "phaser", title: "Stereo phaser", patch: "Test - Phaser",
        intro: "Send moving hollows through a sustained sound. As the filtered and dry paths meet, some frequencies cancel and the pattern sweeps across the note."
    },
    {
        id: "flanger", title: "Stereo flanger", patch: "Test - Flanger",
        intro: "Sweep a ladder of peaks and notches through a sound. The result can be a faint metallic edge or a pronounced jet-like pass."
    },
    {
        id: "crush", title: "Stereo bitcrusher", patch: "Test - Bitcrusher",
        intro: "Make clean audio coarse and grainy by reducing the detail of its digital representation. Bit depth affects level steps and sample rate affects how often the sound is updated."
    },
    {
        id: "loop", title: "Audio looper", patch: "Test - Loop",
        intro: "Capture a short performance and let it repeat. You can layer another pass, reverse the phrase or slow the captured audio down."
    },
    {
        id: "granulita", title: "Granulita granular chord generator", patch: "Test - Granulita",
        intro: "Turn fragments of one sound into a moving chord. The module captures small pieces called grains and plays multiple pitched copies of them."
    },
    {
        id: "shimmer", title: "Shimmer reverb", patch: "Test - Shimmer",
        intro: "Let a reverb tail grow a second, pitched layer. Shifting the incoming sound or shifting each trip around the feedback path gives two different kinds of bloom."
    },
    {
        id: "db", title: "Stereo level meter", patch: "Test - dB Meter",
        intro: "Watch the level of the left and right channels. Peak and average readings help you see the difference between a momentary accent and a sustained loud sound."
    },
    {
        id: "pwm", title: "Pulse-width modulator", patch: "Test - PWM",
        intro: "Turn a moving waveform into a pulse. Adjusting how much of each cycle stays high changes the sound’s hollow or reedy quality."
    },
    {
        id: "turing", title: "Turing looping random sequencer", patch: "Test - Turing",
        intro: "Find a melody by chance, then catch it in a loop. The Lock control sets how faithfully the sequence comes back on each pass."
    },
    {
        id: "ochd", title: "Øchd eight-speed LFO", patch: "Test - OCHD",
        intro: "Set eight slow-moving voltages in motion with one knob. The outputs run at different rates, so several parameters can drift together without falling into a short repeating pattern."
    },
    {
        id: "chaos", title: "Chaotic modulation source", patch: "Test - Chaos",
        intro: "Get three related movements that keep changing direction. They grow out of the same system, so the curves can feel connected even when you cannot predict the next turn."
    },
    {
        id: "cmp2", title: "Dual window comparator", patch: "Test - CMP2",
        intro: "Turn selected regions of a changing voltage into gates. Each comparator lights while its input lies inside a window that you can move and resize."
    },
    {
        id: "comp", title: "Stereo compressor and limiter", patch: "Test - COMP",
        intro: "Let a loud signal turn the level down automatically. With a separate detector input, a kick can make space for itself in an entirely different sound."
    },
    {
        id: "kick", title: "Kick drum", patch: "Test - Kick Only",
        intro: "Build the low thump and leading click of a bass drum from a trigger. The pitch, tail and attack colour can be tuned to the rest of the track."
    },
    {
        id: "snare", title: "Snare drum", patch: "Test - Snare Only",
        intro: "Shape the balance between a drum’s pitched body and its noisy rattle. A single trigger starts the whole hit."
    },
    {
        id: "hat", title: "Open and closed hi-hat", patch: "Test - Hat Only",
        intro: "Play open and closed articulations on the same metallic voice. A closed stroke can cut off a ringing open stroke, like bringing a pair of cymbals together."
    },
    {
        id: "mix", title: "Four-channel mixer", patch: "Test - Clock Divisions",
        intro: "Balance up to four signals on one output. If a kick hides the hi-hat, this is the panel where you decide how much space each receives."
    },
    {
        id: "scope", title: "Two-channel oscilloscope", patch: "Test - Scope Sine Wave",
        intro: "See a signal as a changing voltage. Two traces let you compare an audible waveform with the slower movement of a control signal."
    },
    {
        id: "spectrum", title: "Spectrum analyzer", patch: "Test - Spectrum Analyzer",
        intro: "See which frequencies make up a sound. A pitched note can show many peaks because its fundamental and harmonics are all present at once."
    },
    {
        id: "plot", title: "Waveform plotter", patch: "Test - Plot Waveform",
        intro: "Inspect how a level changes over a chosen span of time. Freezing the plot makes a brief event easier to examine after it has passed."
    },
    {
        id: "spectrogram", title: "Spectrogram", patch: "Test - Spectrogram",
        intro: "See how a sound’s frequencies change over time. A held harmonic leaves a line, while a sudden strike can light up many frequencies at once."
    },
    {
        id: "rec", title: "Stereo WAV recorder", patch: "Test - MIDI In and Out",
        intro: "Capture the sound passing through two jacks as a WAV file. You can listen through the recorder while it is recording."
    },
    {
        id: "cv-rec", title: "Two-lane CV and gate recorder", patch: "Test - CV Recorder",
        intro: "Record the movement that plays an instrument. Two pairs of control-voltage and gate lanes let you replay pitch, articulation or a changing timbre."
    },
    {
        id: "pitch-track", title: "Monophonic pitch tracker", patch: "Test - Pitch Tracker",
        intro: "Turn the pitch of a single clear note into a voltage that can play another oscillator. A separate gate shows when the tracker has a usable reading."
    },
    {
        id: "midi-out", title: "Pitch and gate to MIDI", patch: "Test - MIDI In and Out",
        intro: "Send a rack melody to an external synth or a software instrument. Pitch chooses the MIDI note, and a high gate holds it."
    },
    {
        id: "out", title: "Stereo output (OUT)", patch: "Test - VCO Only",
        intro: "OUT is the final connection to your speakers or headphones. Its two sockets let you hear the left and right sides of the rack independently."
    },
    {
        id: "gate-seq", title: "Four Track Gate Sequencer", patch: "Test - Four Track Gate Sequencer",
        intro: "Write four drum patterns up to 64 steps long. Mute a track or hold a loop fill while the underlying groove keeps time."
    },
    {
        id: "fold-perc", title: "Fold percussion voice", patch: "Test - Fold Percussion",
        intro: "Shape six oscillators into kicks, rims and metallic hits. A step sequencer can give each hit a different amount of fold."
    },
    {
        id: "dj-filter", title: "Stereo DJ Filter", patch: "Test - Stereo DJ Filter",
        intro: "Sweep from a muffled stereo mix through the dry center to a thin high-pass build. Use bypass to bring the bass back on the downbeat."
    },
    {
        id: "slice-sampler", title: "Slice sampler", patch: "Test - Slice Sampler",
        intro: "Cut two sounds into regions and trigger them independently. Play the factory phrases, open a local WAV or record audio from another module."
    },
    {
        id: "mutes", title: "Performance Mutes", patch: "Test - Performance Mutes",
        intro: "Bring four stems in and out by hand or from four mute gates. Each channel smooths the cut so you can punch in between beats."
    },
];
