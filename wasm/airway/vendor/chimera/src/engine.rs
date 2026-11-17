//! The instrument: one human voice (any body), the creatures, and the beatbox sequencer, driven by
//! commands. This is what the browser's AudioWorklet runs and what a DAW wraps as a source module.
//!
//! Contract (see docs/rust-engine.md):
//! - Commands take effect at once, between `render` calls. A host that needs sample accuracy
//!   splits its block at the event.
//! - `render` advances in 128-sample sub-blocks on an absolute sample count. The sequencer ticks at
//!   each sub-block boundary, so the output does not depend on the host's block size.
//! - Rendering, gestures, releases, artic/source/gate changes and beat edits allocate nothing once
//!   warm. A body or creature switch builds a new airway network (it allocates).

use crate::anatomy::human::{ArticPatch, BodyMix, BodyName};
use crate::control::beat_player::BeatPlayer;
use crate::control::score::{Gesture, GestureScore};
use crate::creatures::types::CreatureDef;
use crate::creatures::voice::{CreatureTelemetry, CreatureVoice};
use crate::phonetics::beatbox::{BeatStep, MAX_SOUND_GESTURES};
use crate::voice::human_voice::{HumanVoice, SourcePatch, VoiceTelemetry, oversample_for};

/// Samples per sub-block: the browser's render quantum, kept for every host.
pub const SUB_BLOCK: usize = 128;
/// Gestures taken from one schedule command (as the TypeScript worklet did).
pub const MAX_SCHEDULE: usize = 4000;

/// Default pitch per body (Hz): the presets', blended geometrically in between.
pub fn default_f0(body: impl Into<BodyMix>) -> f64 {
    let body = body.into();
    let f = |b: BodyName| match b {
        BodyName::Male => 110.0,
        BodyName::Female => 205.0,
        BodyName::Child => 260.0,
    };
    match body.preset() {
        Some(b) => f(b),
        None => crate::math::exp(body.blend(|b| crate::math::ln(f(b)))),
    }
}

/// Identity of the voice the engine is playing (the browser's "ready" message).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct VoiceInfo {
    pub body: BodyMix,
    pub n_ph: usize,
    pub n_or: usize,
}

pub struct Engine {
    pub sample_rate: f64,
    body: BodyMix,
    voice: HumanVoice,
    /// the performer's breath (the voice's own gate also follows the score)
    gate_level: f64,
    /// samples rendered so far (sub-block phase)
    pos: u64,
    scratch: Vec<Gesture>,
    beat: BeatPlayer,
    /// a creature playing instead of the human voice (whose clock then stands still)
    creature: Option<CreatureVoice>,
}

impl Engine {
    pub fn new(sample_rate: f64) -> Engine {
        crate::init();
        let body = BodyMix::MALE;
        Engine { sample_rate, body, voice: Self::make_voice(sample_rate, body), gate_level: 0.0, pos: 0, scratch: Vec::with_capacity(MAX_SCHEDULE), beat: BeatPlayer::new(), creature: None }
    }

    fn make_voice(fs: f64, body: BodyMix) -> HumanVoice {
        let mut v = HumanVoice::new(fs, body.body(), oversample_for(fs));
        v.set_source(&SourcePatch::f0(default_f0(body)));
        v
    }

    pub fn info(&self) -> VoiceInfo {
        VoiceInfo { body: self.body, n_ph: self.voice.airway.n_ph, n_or: self.voice.airway.n_or }
    }

    pub fn voice(&self) -> &HumanVoice {
        &self.voice
    }

    pub fn voice_mut(&mut self) -> &mut HumanVoice {
        &mut self.voice
    }

    /// Switch the human body. The performer's settings carry over: source (pitch reset to the
    /// new body's default), posture, breath. Allocates (a new airway network).
    pub fn set_body(&mut self, body: impl Into<BodyMix>) -> VoiceInfo {
        let body: BodyMix = body.into();
        let body = BodyMix::new(body.female, body.child);
        let prev = core::mem::replace(&mut self.voice, Self::make_voice(self.sample_rate, body));
        self.body = body;
        let mut src = SourcePatch::from_source(&prev.source);
        src.f0 = Some(default_f0(body));
        self.voice.set_source(&src);
        let mut target = ArticPatch::default();
        for (k, x) in prev.artic.target.to_array().iter().enumerate() {
            target.values[k] = Some(*x);
        }
        self.voice.set_articulation(&target, Some(prev.artic.tip_free));
        // the performer's breath, not the voice's (which includes breath from the score)
        self.voice.set_gate(self.gate_level);
        // the new voice's clock starts at zero: keep the beat's phase across the switch, and
        // queue again the hits the old voice's score was holding (built for the new body)
        self.beat.body = body;
        self.beat.rebase(self.voice.clock - prev.clock);
        self.beat.rewind(self.voice.clock);
        self.info()
    }

    pub fn set_artic(&mut self, values: &ArticPatch, tip_free: Option<bool>) {
        self.voice.set_articulation(values, tip_free);
    }

    pub fn set_source(&mut self, values: &SourcePatch) {
        self.voice.set_source(values);
    }

    pub fn set_gate(&mut self, level: f64) {
        self.gate_level = level;
        self.voice.set_gate(level);
        if let Some(c) = self.creature.as_mut() {
            c.set_gate(level);
        }
    }

    // ---------------------------------------------------------------- creatures

    /// Play a creature instead of the human voice (`None`: back to the human), starting from
    /// these settings (param index, value). Returns its definition. Allocates (a new airway).
    pub fn set_creature(&mut self, def: Option<&'static CreatureDef>, initial: &[(usize, f64)]) -> Option<&'static CreatureDef> {
        self.creature = def.map(|d| {
            let mut c = CreatureVoice::new(d, self.sample_rate, initial);
            c.set_gate(self.gate_level);
            c
        });
        def
    }

    pub fn creature(&self) -> Option<&CreatureVoice> {
        self.creature.as_ref()
    }

    /// The performer's settings for the creature (param index, value).
    pub fn set_creature_params(&mut self, values: &[(usize, f64)]) {
        if let Some(c) = self.creature.as_mut() {
            c.set_params(values);
        }
    }

    /// Play a call of the creature (its index in the def); `pitch` scales its pitch params.
    pub fn play_call(&mut self, call: usize, pitch: Option<f64>, amp: Option<f64>) {
        if let Some(c) = self.creature.as_mut() {
            c.play_call(call, pitch, amp.unwrap_or(1.0));
        }
    }

    pub fn stop_call(&mut self) {
        if let Some(c) = self.creature.as_mut() {
            c.stop_call();
        }
    }

    /// The creature's telemetry (see [`CreatureVoice::telemetry`]); false when the human plays.
    pub fn creature_telemetry(&mut self, out: &mut CreatureTelemetry) -> bool {
        match self.creature.as_mut() {
            Some(c) => {
                c.telemetry(out);
                true
            }
            None => false,
        }
    }

    /// Schedule gestures planned with times relative to "now": they are shifted onto the voice
    /// clock by `clock + lead`. Returns that offset (the plan's time 0 on the voice clock).
    pub fn schedule(&mut self, gestures: &[Gesture], lead: f64, replace: bool) -> f64 {
        let off = self.voice.clock + lead;
        self.scratch.clear();
        for g in gestures.iter().take(MAX_SCHEDULE) {
            let mut g = *g;
            g.t0 += off;
            g.t1 += off;
            self.scratch.push(g);
        }
        if replace {
            self.voice.cancel_score();
        }
        self.voice.schedule(&self.scratch);
        off
    }

    pub fn stop_speech(&mut self) {
        self.voice.cancel_score();
    }

    /// End the open-ended gestures with this tag now (a sung note released).
    pub fn release(&mut self, tag: f64) {
        self.voice.release(tag);
    }

    pub fn score(&self) -> &GestureScore {
        &self.voice.score
    }

    /// How many of the human voice's decaying states are denormal numbers (for tests: none should
    /// be; see `AirwayNetwork::flush_tiny`).
    pub fn denormal_states(&self) -> usize {
        self.voice.denormal_states()
    }

    /// The voice clock (s): the time base of scheduled gestures.
    pub fn clock(&self) -> f64 {
        self.voice.clock
    }

    /// Render `out.len()` samples.
    pub fn render(&mut self, out: &mut [f32]) {
        let mut i = 0;
        while i < out.len() {
            let phase = (self.pos % SUB_BLOCK as u64) as usize;
            if phase == 0 {
                self.sub_block_start();
            }
            let n = (SUB_BLOCK - phase).min(out.len() - i);
            match self.creature.as_mut() {
                Some(c) => c.render(&mut out[i..i + n]),
                None => self.voice.render(&mut out[i..i + n]),
            }
            i += n;
            self.pos += n as u64;
        }
    }

    /// Per-sub-block bookkeeping: the sequencer schedules the hits within its horizon.
    fn sub_block_start(&mut self) {
        if self.creature.is_some() {
            return; // the human voice (and its sequencer) waits while a creature plays
        }
        let voice = &mut self.voice;
        let clock = voice.clock;
        self.beat.tick(clock, &mut |gs| voice.schedule(gs));
    }

    // ---------------------------------------------------------------- beatbox sequencer

    /// Replace the pattern (at most 128 steps; `None` is a rest).
    pub fn set_beat_steps(&mut self, steps: &[Option<BeatStep>]) {
        self.beat.set_steps(steps);
    }

    /// Change tempo/swing (`None`: keep). The next unscheduled step keeps its time.
    pub fn set_beat_tempo(&mut self, bpm: Option<f64>, swing: Option<f64>) {
        let b = &mut self.beat;
        b.set_tempo(bpm.unwrap_or(b.bpm), swing.unwrap_or(b.swing));
    }

    /// Start or stop the sequencer. Stopping also silences hits already scheduled.
    pub fn set_beat_playing(&mut self, playing: bool) {
        if playing && !self.beat.playing {
            self.beat.start(self.voice.clock);
        }
        if !playing && self.beat.playing {
            self.beat.stop();
            // hits already scheduled within the horizon would still sound
            self.voice.cancel_score();
        }
    }

    pub fn beat(&self) -> &BeatPlayer {
        &self.beat
    }

    /// Play one beatbox sound as soon as the mouth can make it.
    pub fn beat_hit(&mut self, step: &BeatStep) {
        self.scratch.clear();
        let hit = self.voice.clock + BeatPlayer::lead_in_with(step.id.as_str(), self.body, &mut self.scratch);
        self.scratch.clear();
        self.beat.gestures(step, hit, 0.18, &mut self.scratch);
        debug_assert!(self.scratch.len() <= MAX_SOUND_GESTURES);
        self.voice.schedule(&self.scratch);
    }

    /// The beat step under the playhead (−1 when the sequencer is stopped).
    pub fn beat_step(&self) -> i64 {
        self.beat.step_at(self.voice.clock)
    }

    pub fn telemetry(&mut self, out: &mut VoiceTelemetry) {
        self.voice.telemetry(out);
    }
}
