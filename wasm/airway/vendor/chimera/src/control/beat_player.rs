//! Step sequencer for the beatboxer. Runs on the voice clock (in the AudioWorklet, or offline),
//! so hits are sample-accurate whatever the main thread is doing. Each step's gestures are built
//! when its hit comes within `horizon` of the clock: early enough for the slowest sound's set-up,
//! late enough that edits to the pattern are heard within a step or two.
//!
//! Real time: [`BeatPlayer::new`] reserves everything the player uses; after that `tick`,
//! `set_steps`, `set_tempo`, `start`/`stop`, `rebase`/`rewind`, `step_at` and `gestures` (into
//! a `Vec` with room for [`MAX_SOUND_GESTURES`]) allocate nothing. Call
//! [`crate::phonetics::beatbox::init`] (or construct the engine) before the first tick so the
//! phoneme tables are not parsed on the audio thread.

use super::score::Gesture;
use crate::anatomy::human::BodyMix;
use crate::math::{js_max, js_min, midi_to_hz};
use crate::phonetics::beatbox::{BASS_NOTE, BeatBuild, BeatStep, MAX_BEAT_STEPS, MAX_SOUND_GESTURES, beat_sound};

/// scheduled steps remembered for the playhead (well over a horizon's worth)
const MARKS: usize = 32;

#[derive(Clone, Debug)]
pub struct BeatPlayer {
    steps: Vec<Option<BeatStep>>,
    pub bpm: f64,
    /// 0..0.6: off-beat sixteenths are delayed by swing × half a step
    pub swing: f64,
    pub playing: bool,
    pub body: BodyMix,
    anchor_time: f64,
    anchor_step: i64,
    next: i64,
    /// step number and hit time of recently scheduled steps (−1 = empty slot)
    mark_n: [i64; MARKS],
    mark_t: [f64; MARKS],
    mark_pos: usize,
    /// one step's gestures, reused
    buf: Vec<Gesture>,
}

impl Default for BeatPlayer {
    fn default() -> Self {
        Self::new()
    }
}

impl BeatPlayer {
    pub const STEPS_PER_BEAT: f64 = 4.0;
    /// schedule a step when its hit is this close (s); covers every sound's set-up time
    pub const HORIZON: f64 = 0.2;
    /// the longest pattern kept (16 bars; [`parse_beat`](crate::phonetics::beatbox::parse_beat)
    /// cuts longer text there, so the grid shows only what plays)
    pub const MAX_STEPS: usize = MAX_BEAT_STEPS;
    /// tempo range: a sixteenth at 240 bpm is 62 ms, about as fast as a beatboxer goes
    pub const MIN_BPM: f64 = 40.0;
    pub const MAX_BPM: f64 = 240.0;

    pub fn new() -> Self {
        BeatPlayer {
            steps: Vec::with_capacity(Self::MAX_STEPS),
            bpm: 96.0,
            swing: 0.0,
            playing: false,
            body: BodyMix::MALE,
            anchor_time: 0.0,
            anchor_step: 0,
            next: 0,
            mark_n: [-1; MARKS],
            mark_t: [0.0; MARKS],
            mark_pos: 0,
            buf: Vec::with_capacity(MAX_SOUND_GESTURES),
        }
    }

    pub fn steps(&self) -> &[Option<BeatStep>] {
        &self.steps
    }

    /// Replace the pattern (the first [`Self::MAX_STEPS`] steps). No allocation.
    pub fn set_steps(&mut self, steps: &[Option<BeatStep>]) {
        self.steps.clear();
        self.steps.extend_from_slice(&steps[..steps.len().min(Self::MAX_STEPS)]);
    }

    pub fn step_dur(&self) -> f64 {
        60.0 / self.bpm / Self::STEPS_PER_BEAT
    }

    fn step_time(&self, n: i64) -> f64 {
        let base = self.anchor_time + (n - self.anchor_step) as f64 * self.step_dur();
        if n % 2 == 1 { base + self.swing * 0.5 * self.step_dur() } else { base }
    }

    pub fn start(&mut self, clock: f64) {
        self.playing = true;
        self.anchor_time = clock + Self::HORIZON;
        self.anchor_step = 0;
        self.next = 0;
        self.mark_n = [-1; MARKS];
    }

    pub fn stop(&mut self) {
        self.playing = false;
    }

    /// Change tempo without a jump: the next unscheduled step keeps its time.
    pub fn set_tempo(&mut self, bpm: f64, swing: f64) {
        let b = js_min(Self::MAX_BPM, js_max(Self::MIN_BPM, bpm));
        if self.playing && b != self.bpm {
            self.anchor_time += (self.next - self.anchor_step) as f64 * self.step_dur();
            self.anchor_step = self.next;
        }
        self.bpm = b;
        self.swing = js_min(0.6, js_max(0.0, swing));
    }

    /// The voice clock restarted (new voice after a body change): keep the beat's phase.
    pub fn rebase(&mut self, delta: f64) {
        self.anchor_time += delta;
        for t in self.mark_t.iter_mut() {
            *t += delta;
        }
    }

    /// The score holding the scheduled hits was replaced (new voice): schedule again every step
    /// not yet heard at `clock`, at the times they were given.
    pub fn rewind(&mut self, clock: f64) {
        let (mut first, mut first_t) = (-1i64, 0.0);
        for i in 0..MARKS {
            let n = self.mark_n[i];
            if n >= 0 && self.mark_t[i] >= clock && (first < 0 || n < first) {
                first = n;
                first_t = self.mark_t[i];
            }
        }
        if first < 0 {
            return;
        }
        self.anchor_step = first;
        self.anchor_time = first_t - if first % 2 == 1 { self.swing * 0.5 * self.step_dur() } else { 0.0 };
        self.next = first;
        for n in self.mark_n.iter_mut() {
            if *n >= first {
                *n = -1;
            }
        }
    }

    /// Step under the playhead at `clock`: the last scheduled step whose hit has come (−1: none).
    pub fn step_at(&self, clock: f64) -> i64 {
        if !self.playing || self.steps.is_empty() {
            return -1;
        }
        let (mut best, mut best_t) = (-1i64, f64::NEG_INFINITY);
        for i in 0..MARKS {
            let t = self.mark_t[i];
            if self.mark_n[i] >= 0 && t <= clock && t > best_t {
                best = self.mark_n[i];
                best_t = t;
            }
        }
        if best < 0 { -1 } else { best % self.steps.len() as i64 }
    }

    /// Schedule every step whose hit falls within the horizon: `schedule` receives each step's
    /// gestures (on the voice clock), in step order. No allocation.
    pub fn tick(&mut self, clock: f64, schedule: &mut impl FnMut(&[Gesture])) {
        if !self.playing || self.steps.is_empty() {
            return;
        }
        let mut buf = std::mem::take(&mut self.buf);
        for _guard in 0..64 {
            let hit = self.step_time(self.next);
            if hit > clock + Self::HORIZON {
                break;
            }
            let l = self.steps.len() as i64;
            self.mark_n[self.mark_pos] = self.next;
            self.mark_t[self.mark_pos] = hit;
            self.mark_pos = (self.mark_pos + 1) % MARKS;
            let cell = self.steps[(self.next % l) as usize];
            if let Some(cell) = cell
                && hit >= clock
            {
                // sustained sounds (hum, open hat) last until the next sound
                let mut rests = 0i64;
                while rests < l - 1 && self.steps[((self.next + 1 + rests) % l) as usize].is_none() {
                    rests += 1;
                }
                buf.clear();
                self.gestures(&cell, hit, (1 + rests) as f64 * self.step_dur(), &mut buf);
                schedule(&buf);
            }
            self.next += 1;
        }
        self.buf = buf;
    }

    /// Gestures for one sound whose acoustic hit lands at `hit` on the voice clock, appended to
    /// `out` (`len`: how long the sound may last; the TS default was one step, [`Self::step_dur`]).
    /// No allocation when `out` has room for [`MAX_SOUND_GESTURES`] more.
    pub fn gestures(&self, cell: &BeatStep, hit: f64, len: f64, out: &mut Vec<Gesture>) {
        let Some(s) = beat_sound(cell.id.as_str()) else { return };
        let start = out.len();
        (s.build)(self.body, &BeatBuild { f0: midi_to_hz(cell.note.unwrap_or(BASS_NOTE)), len, accent: cell.accent.unwrap_or(1.0) }, out);
        let off = hit - s.latency;
        for g in out[start..].iter_mut() {
            g.t0 += off;
            g.t1 += off;
        }
    }

    /// Set-up time a sound needs before its hit (s): when a pad press can sound at the earliest.
    /// `scratch` is cleared and used to build the sound (no allocation when it has room).
    pub fn lead_in_with(id: &str, body: BodyMix, scratch: &mut Vec<Gesture>) -> f64 {
        let Some(s) = beat_sound(id) else { return 0.0 };
        scratch.clear();
        (s.build)(body, &BeatBuild { f0: 100.0, len: 0.15, accent: 1.0 }, scratch);
        let mut lead = 0.0;
        for g in scratch.iter() {
            lead = js_max(lead, -(g.t0 - g.ramp_in));
        }
        lead + s.latency
    }

    /// [`Self::lead_in_with`] on a fresh buffer (allocates; for the UI and tests).
    pub fn lead_in(id: &str, body: BodyMix) -> f64 {
        Self::lead_in_with(id, body, &mut Vec::with_capacity(MAX_SOUND_GESTURES))
    }
}
