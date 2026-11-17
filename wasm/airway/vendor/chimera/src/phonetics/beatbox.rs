//! A physically modelled beatboxer. Each drum sound is a short gestural score on the human vocal
//! tract, made with the airstream mechanisms beatboxers actually use:
//!  - pulmonic: breath from the lungs (snares, hats, crash)
//!  - glottalic (ejective): the glottis sealed, the larynx rises like a piston and compresses the
//!    air behind an oral closure (kick, rimshot): punchy, dry, no breath noise
//!  - velaric (click): the tongue seals a pocket against the palate and hollows it; the release
//!    pops inward (tongue click, lip pop)
//!  - ingressive: breath drawn in through a constriction (inward K snare)
//!  - voiced: a hummed bass through the nose
//!
//! One throat makes one sound at a time, so patterns are monophonic like a real beatboxer's.
//! Symbols follow Standard Beatbox Notation where it has one.
//!
//! Real time: a sound's `build` appends its gestures to a caller's `Vec` and allocates nothing
//! when the `Vec` has room ([`MAX_SOUND_GESTURES`]); the beat sequencer runs it on the audio
//! thread. Call [`init`] first so the phoneme tables are parsed off it.

use super::inventory::phoneme;
use super::planner::{oral_gestures_into, vowel_artic};
use crate::anatomy::human::{ArticKey, ArticPatch, BodyMix};
use crate::control::score::{ControlKey, Gesture, Label, Targets};
use crate::math::{js_max, js_min};
use serde::{Deserialize, Serialize};

/// Parse the tables the sounds use.
pub fn init() {
    super::planner::init();
}

/// A beatboxer's ready posture: jaw nearly closed, lips just apart, tongue relaxed.
pub fn beat_ready(body: BodyMix) -> ArticPatch {
    // with the jaw nearly closed the tongue rests a little higher than in a spoken schwa; the
    // velar hits need it there: from lower, the release peels open and loses its punch
    let schwa = vowel_artic("ə", body).unwrap_or_default();
    let mut out = schwa;
    out.set(ArticKey::TbY, schwa.get(ArticKey::TbY).unwrap_or(6.85) + 0.1).set(ArticKey::Jaw, 0.4).set(ArticKey::LipAp, 0.25).set(ArticKey::LipProt, 0.1);
    out
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BeatRole {
    Kick,
    Snare,
    Hat,
    Perc,
    Bass,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Airstream {
    Pulmonic,
    Ejective,
    Click,
    Ingressive,
    Voiced,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatBuild {
    /// hum pitch (Hz)
    pub f0: f64,
    /// how long the sound may last (s): its step length, for sustained sounds
    pub len: f64,
    /// loudness 0.5..1.5
    pub accent: f64,
}

/// Builds a sound's gestures (acoustic hit at t = 0), appending them to `out`.
pub type BuildFn = fn(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>);

/// The most gestures any sound builds (a `Vec` with this much room never reallocates).
pub const MAX_SOUND_GESTURES: usize = 16;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatSound {
    /// pattern symbol
    pub id: &'static str,
    pub name: &'static str,
    pub role: BeatRole,
    pub airstream: Airstream,
    pub hint: &'static str,
    /// Gestures with the acoustic hit at t = 0. `latency` (s) is the measured delay from the
    /// planned hit to the acoustic onset; the sequencer schedules that much earlier.
    #[serde(skip)]
    pub build: BuildFn,
    pub latency: f64,
}

impl BeatSound {
    /// `build` into a new `Vec` (allocates; for tools and tests).
    pub fn build_vec(&self, body: BodyMix, o: &BeatBuild) -> Vec<Gesture> {
        let mut out = Vec::with_capacity(MAX_SOUND_GESTURES);
        (self.build)(body, o, &mut out);
        out
    }
}

impl core::fmt::Debug for BeatSound {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("BeatSound").field("id", &self.id).field("name", &self.name).field("latency", &self.latency).finish()
    }
}

/// The consonant's oral gestures with `extra` targets over its own; returns where they start in `out`.
#[allow(clippy::too_many_arguments)]
fn oral(body: BodyMix, ipa: &str, a: f64, b: f64, speed: f64, label: &str, extra: &[(ArticKey, f64)], out: &mut Vec<Gesture>) -> usize {
    let start = out.len();
    let Some(d) = phoneme(ipa, body) else { return start };
    let mut tg = d.targets;
    for (k, x) in extra {
        tg.set(*k, *x);
    }
    oral_gestures_into(&d, &tg, a, b, speed, label, out);
    start
}

#[allow(clippy::too_many_arguments)]
fn g(t0: f64, t1: f64, ramp_in: f64, ramp_out: f64, strength: f64, targets: Targets, label: &str, speed: Option<f64>) -> Gesture {
    let mut x = Gesture::new(t0, t1, ramp_in, ramp_out, strength, targets).label(label);
    x.speed = speed;
    x
}

fn tg(pairs: &[(ControlKey, f64)]) -> Targets {
    let mut t = Targets::default();
    for (k, x) in pairs {
        t.set(*k, *x);
    }
    t
}

const fn a(k: ArticKey) -> ControlKey {
    ControlKey::Artic(k)
}

/// Beatboxers snap their releases: faster than speech, and the heavy dorsum is no exception.
fn snap(gs: &mut [Gesture], speed: f64, ramp_out: f64) {
    for x in gs.iter_mut() {
        if x.strength >= 40.0 {
            x.speed = Some(speed);
            x.ramp_out = ramp_out;
        }
    }
}

/// A release fricative that starts only after the burst: with the planner's 30 ms ramp it would
/// grip the articulators while the closure is still held and pry it open early.
fn after(gs: &mut [Gesture], ramp_in: f64) {
    for x in gs.iter_mut() {
        x.ramp_in = js_min(x.ramp_in, ramp_in);
    }
}

/// Glottalic piston: glottis sealed through the closure, larynx raised just before release.
fn ejective(at: f64, accent: f64, label: &str, out: &mut Vec<Gesture>) {
    out.push(g(at - 0.012, 0.03, 0.012, 0.03, 8.0, tg(&[(ControlKey::CLOSURE, 1.0)]), label, None));
    out.push(g(-0.05, 0.004, 0.03, 0.08, 40.0, tg(&[(a(ArticKey::Larynx), js_min(1.6, 1.25 + 0.3 * accent))]), label, Some(3.0)));
}

/// Lung pressure (× the performer's breath pressure) over [a, b], with the glottis held open
/// until the breath has gone (otherwise the folds start to vibrate on the leftover pressure).
fn blow(t0: f64, t1: f64, level: f64, abduction: f64, label: &str, tail: f64, out: &mut Vec<Gesture>) {
    out.push(g(t0, t1 + tail + 0.02, 0.02, 0.03, 6.0, tg(&[(ControlKey::ABDUCTION, abduction)]), label, None));
    out.push(g(t0 - 0.01, t1, 0.02, tail, 1.0, tg(&[(ControlKey::BREATH, level)]), label, None));
}

use ArticKey::{Jaw, LipAp, TbY};

fn kick(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let s = oral(body, "p", -0.075, 0.0, 2.0, "B", &[(Jaw, 0.3)], out);
    snap(&mut out[s..], 3.5, 0.01);
    ejective(-0.075, o.accent, "B", out);
}

fn hat(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let s = oral(body, "t", -0.05, 0.0, 2.0, "t", &[(Jaw, 0.3)], out);
    snap(&mut out[s..], 3.5, 0.01);
    let s = oral(body, "s", 0.012, 0.03, 1.6, "t", &[], out);
    after(&mut out[s..], 0.008);
    blow(-0.03, 0.026, 1.25 * o.accent, 0.36, "t", 0.02, out);
}

fn open_hat(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let end = js_max(0.09, js_min(0.26, o.len * 1.6));
    let s = oral(body, "t", -0.05, 0.0, 2.0, "tss", &[(Jaw, 0.3)], out);
    snap(&mut out[s..], 3.5, 0.01);
    let s = oral(body, "s", 0.012, end, 1.4, "tss", &[], out);
    after(&mut out[s..], 0.008);
    blow(-0.03, end, 1.2 * o.accent, 0.4, "tss", 0.09, out);
}

fn snare(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let s = oral(body, "p", -0.06, 0.0, 2.0, "Pf", &[], out);
    snap(&mut out[s..], 3.5, 0.01);
    let s = oral(body, "f", 0.018, 0.08, 1.6, "Pf", &[], out);
    after(&mut out[s..], 0.008);
    blow(-0.045, 0.075, 1.7 * o.accent, 0.45, "Pf", 0.04, out);
}

fn rimshot(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let s = oral(body, "k", -0.08, 0.0, 2.0, "K", &[(Jaw, 0.35)], out);
    snap(&mut out[s..], 4.0, 0.008);
    ejective(-0.08, o.accent, "K", out);
}

fn inward_snare(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let s = oral(body, "k", -0.06, 0.0, 2.0, "^K", &[(Jaw, 0.35)], out);
    snap(&mut out[s..], 4.0, 0.008);
    let s = oral(body, "x", 0.012, 0.085, 1.4, "^K", &[(TbY, 7.35)], out);
    after(&mut out[s..], 0.008);
    out.push(g(-0.05, 0.085, 0.02, 0.04, 6.0, tg(&[(ControlKey::ABDUCTION, 0.5)]), "^K", None));
    // draw the breath in behind the closure so the release rushes inward
    out.push(g(-0.035, 0.085, 0.015, 0.05, 2.0, tg(&[(ControlKey::BREATH, -1.7 * o.accent)]), "^K", None));
}

fn tongue_click(body: BodyMix, _o: &BeatBuild, out: &mut Vec<Gesture>) {
    // the tip seals without the alveolar's fronted tongue body (that would close the pocket)
    let s = oral(body, "t", -0.12, 0.0, 2.0, "!", &[], out);
    snap(&mut out[s..], 3.5, 0.01);
    let mut w = s;
    for r in s..out.len() {
        if !out[r].targets.has(ArticKey::TbX) {
            out[w] = out[r];
            w += 1;
        }
    }
    out.truncate(w);
    // the back seal sits low, leaving a pocket for the dorsum to hollow
    oral(body, "k", -0.12, 0.035, 2.0, "!", &[(TbY, 7.85), (Jaw, 0.4)], out);
    out.push(g(-0.03, 0.006, 0.04, 0.03, 40.0, tg(&[(a(ArticKey::Dorsum), 1.0)]), "!", Some(2.0)));
}

fn lip_pop(body: BodyMix, _o: &BeatBuild, out: &mut Vec<Gesture>) {
    // a light seal (pressing the lips squeezes the pocket before the suction starts)
    let s = oral(body, "p", -0.12, 0.0, 2.0, "P!", &[(LipAp, -0.08)], out);
    snap(&mut out[s..], 5.0, 0.006);
    oral(body, "k", -0.12, 0.03, 2.0, "P!", &[], out);
    // lips stay sealed while the jaw and tongue hollow the mouth: about −30 cmH₂O of suction
    out.push(g(-0.07, 0.004, 0.04, 0.05, 40.0, tg(&[(a(Jaw), 1.6), (a(ArticKey::Dorsum), 1.0)]), "P!", Some(2.0)));
}

fn crash(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let end = js_max(0.14, js_min(0.34, o.len * 2.0));
    // the "ch": the back of the tongue lingers by the velum after the burst ([x]) while the
    // blade rises into the long rounded [ʃ]
    let s = oral(body, "k", -0.06, 0.0, 2.0, "kch", &[], out);
    snap(&mut out[s..], 4.0, 0.008);
    let s = oral(body, "x", 0.002, 0.045, 2.0, "kch", &[], out);
    after(&mut out[s..], 0.008);
    let s = oral(body, "ʃ", 0.025, end, 1.4, "kch", &[], out);
    after(&mut out[s..], 0.008);
    blow(-0.035, end, 1.75 * o.accent, 0.45, "kch", 0.14, out);
}

fn hum(body: BodyMix, o: &BeatBuild, out: &mut Vec<Gesture>) {
    let end = js_max(0.06, o.len * 0.92);
    // lips shut before the voice starts, so the note begins as a hum rather than a vowel;
    // the folds stay apart (breathing) while the velum drops into the sealed mouth, so the
    // squeezed air goes to the lungs instead of popping out through the nose
    oral(body, "m", -0.03, end, 1.6, "m", &[], out);
    out.push(g(-0.02, end, 0.03, 0.03, 4.0, tg(&[(a(ArticKey::Velum), 0.9)]), "m", None));
    out.push(g(-0.08, -0.03, 0.02, 0.02, 5.0, tg(&[(ControlKey::ABDUCTION, 0.3)]), "m", None));
    out.push(g(-0.01, end, 0.02, 0.04, 1.0, tg(&[(ControlKey::BREATH, 0.95 * o.accent)]), "m", None));
    out.push(g(-0.02, end, 0.015, 0.02, 8.0, tg(&[(ControlKey::F0, o.f0)]), "m", None));
}

pub static BEAT_SOUNDS: [BeatSound; 10] = [
    BeatSound { id: "B", name: "Kick", role: BeatRole::Kick, airstream: Airstream::Ejective, hint: "Lips burst on air the rising larynx compresses", latency: 0.01, build: kick },
    BeatSound { id: "t", name: "Hi-hat", role: BeatRole::Hat, airstream: Airstream::Pulmonic, hint: "Tongue-tip release into a short hiss", latency: -0.005, build: hat },
    BeatSound { id: "tss", name: "Open hat", role: BeatRole::Hat, airstream: Airstream::Pulmonic, hint: "The hi-hat left ringing as a long hiss", latency: -0.005, build: open_hat },
    BeatSound { id: "Pf", name: "Snare", role: BeatRole::Snare, airstream: Airstream::Pulmonic, hint: "Lips burst, then the lower lip hisses against the teeth", latency: 0.018, build: snare },
    BeatSound { id: "K", name: "Rimshot", role: BeatRole::Snare, airstream: Airstream::Ejective, hint: "Back of the tongue bursts on larynx-compressed air", latency: -0.0165, build: rimshot },
    BeatSound { id: "^K", name: "Inward snare", role: BeatRole::Snare, airstream: Airstream::Ingressive, hint: "A sharp breath in past the back of the tongue", latency: -0.014, build: inward_snare },
    BeatSound { id: "!", name: "Tongue click", role: BeatRole::Perc, airstream: Airstream::Click, hint: "Tongue seals a pocket, hollows it and pops", latency: -0.007, build: tongue_click },
    BeatSound { id: "P!", name: "Lip pop", role: BeatRole::Perc, airstream: Airstream::Click, hint: "Sealed lips, the jaw drops, the lips pop open", latency: -0.001, build: lip_pop },
    BeatSound { id: "kch", name: "Crash", role: BeatRole::Hat, airstream: Airstream::Pulmonic, hint: "Back-of-tongue release into a long rounded hiss", latency: -0.013, build: crash },
    BeatSound { id: "m", name: "Hum", role: BeatRole::Bass, airstream: Airstream::Voiced, hint: "Hummed bass note through the nose", latency: 0.0056, build: hum },
];

/// The sound with this pattern symbol (no allocation).
pub fn beat_sound(id: &str) -> Option<&'static BeatSound> {
    BEAT_SOUNDS.iter().find(|s| s.id == id)
}

/// One step of a pattern: a sound (`None` in a pattern = rest), optional MIDI note for pitched
/// sounds. `Copy`, so patterns can be swapped on the audio thread without allocating.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatStep {
    pub id: Label,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent: Option<f64>,
}

impl BeatStep {
    pub fn new(id: &str) -> BeatStep {
        BeatStep { id: Label::new(id), note: None, accent: None }
    }
}

/// Default hum note (MIDI E2)
pub const BASS_NOTE: f64 = 40.0;

/// JS `\s` (ECMAScript WhiteSpace and LineTerminator).
fn js_space(c: char) -> bool {
    matches!(c, '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}

/// `/^(.+?):(\d+)$/`: the digits after the last colon, if there is something before it.
fn split_note(tok: &str) -> Option<(&str, &str)> {
    let p = tok.rfind(':')?;
    let (head, digits) = (&tok[..p], &tok[p + 1..]);
    if head.is_empty() || digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some((head, digits))
}

/// The longest pattern the beat player plays: 16 bars of sixteenths.
pub const MAX_BEAT_STEPS: usize = 256;

/// Parse a beat written as text: tokens separated by spaces or "|" (bar lines, ignored);
/// "." or "-" is a rest; a hum may carry a MIDI note ("m:43"); a trailing ">" accents.
/// Steps past [`MAX_BEAT_STEPS`] are dropped: the player would never reach them.
pub fn parse_beat(text: &str) -> Vec<Option<BeatStep>> {
    let mut out = Vec::new();
    for raw in text.split(|c: char| js_space(c) || c == '|') {
        if raw.is_empty() {
            continue;
        }
        if out.len() == MAX_BEAT_STEPS {
            break;
        }
        if raw == "." || raw == "-" {
            out.push(None);
            continue;
        }
        let mut tok = raw;
        let mut accent = None;
        if let Some(t) = tok.strip_suffix('>') {
            accent = Some(1.3);
            tok = t;
        }
        let mut note = None;
        if let Some((head, digits)) = split_note(tok) {
            tok = head;
            note = Some(digits.parse::<f64>().unwrap());
        }
        let s = beat_sound(tok).or_else(|| {
            let lower = tok.to_lowercase();
            BEAT_SOUNDS.iter().find(|x| x.id.to_lowercase() == lower)
        });
        out.push(s.map(|s| BeatStep { id: Label::new(s.id), note, accent }));
    }
    out
}

/// A number as JS prints it, for the values a pattern holds (−0 prints as 0).
fn js_num(x: f64) -> String {
    if x == 0.0 { "0".to_string() } else { format!("{x}") }
}

/// Inverse of parse_beat: four steps per group, groups separated by spaces.
pub fn format_beat(steps: &[Option<BeatStep>]) -> String {
    let toks: Vec<String> = steps
        .iter()
        .map(|s| match s {
            Some(s) => {
                let note = s.note.map_or(String::new(), |n| format!(":{}", js_num(n)));
                let acc = if s.accent.is_some_and(|a| a > 1.0) { ">" } else { "" };
                format!("{}{note}{acc}", s.id.as_str())
            }
            None => ".".to_string(),
        })
        .collect();
    let groups: Vec<String> = toks.chunks(4).map(|c| c.join(" ")).collect();
    groups.join(" | ")
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeatPreset {
    pub name: &'static str,
    pub bpm: f64,
    pub swing: f64,
    pub text: &'static str,
}

pub static BEAT_PRESETS: [BeatPreset; 7] = [
    BeatPreset { name: "Boots and cats", bpm: 96.0, swing: 0.0, text: "B . t . | Pf . t . | B . t . | Pf . t ." },
    BeatPreset { name: "Four on the floor", bpm: 122.0, swing: 0.0, text: "B . t . | B . tss . | B . t . | B . tss ." },
    BeatPreset { name: "Breakbeat", bpm: 94.0, swing: 0.18, text: "B . t . | Pf . t B | . B t . | Pf . t t" },
    BeatPreset { name: "Rimshot shuffle", bpm: 88.0, swing: 0.4, text: "B . t K | . t B . | t . K t | . B K t" },
    BeatPreset { name: "Inward snare", bpm: 100.0, swing: 0.0, text: "B . t . | ^K . t . | B B t . | ^K . t ." },
    BeatPreset { name: "Clicks and pops", bpm: 90.0, swing: 0.25, text: "B . ! . | P! . ! . | B ! . ! | P! . ! !" },
    BeatPreset { name: "Hum bass", bpm: 92.0, swing: 0.1, text: "B m . m:43 | Pf . m:45 . | B m:40 . m | Pf . t kch" },
];
