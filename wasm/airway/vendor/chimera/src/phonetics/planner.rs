//! Segment sequence → gestural score. Timing and phonation are articulatory: aspiration is a
//! glottal opening gesture peaking at the release (VOT emerges), nasality is velum lowering with
//! anticipation, coarticulation comes from overlapping vowel gestures beneath consonant gestures.
//!
//! The planners allocate and run off the audio thread. [`oral_gestures_into`] (used by the beat
//! sequencer) builds into a caller's `Vec` and allocates nothing once it has capacity.

use super::durations::{SegInfo, klatt_durations};
use super::inventory::{Glottal, Manner, PhonemeDef, Voicing, phoneme};
use super::{Intonation, Plan, PlannedSegment, Segment};
use crate::anatomy::human::{ArticKey, ArticPatch, BodyMix, BodyName};
use crate::control::score::{ControlKey, Gesture, Targets};
use crate::math::{js_max, js_min, js_round};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::OnceLock;

/// label of the end-of-breath-group abduction (a live note can drop it when the next one starts)
pub const EXHALE_LABEL: &str = "exhale";

/// when a sung phrase's breath reaches full drive, after the plan start (its first segment starts at 0.06)
const BREATH_SUNG_AT: f64 = 0.06;

const VOWEL_KEYS: [ArticKey; 9] = [ArticKey::TbX, ArticKey::TbY, ArticKey::Jaw, ArticKey::LipAp, ArticKey::LipProt, ArticKey::LipWidth, ArticKey::Root, ArticKey::Larynx, ArticKey::TtCurl];

/// One calibrated vowel of `vowelTargets.generated.json`.
#[derive(Clone, Debug, Deserialize)]
pub struct VowelTarget {
    pub artic: ArticPatch,
    #[serde(default)]
    pub formants: Vec<f64>,
}

/// body name → IPA → calibrated vowel
pub type VowelTable = BTreeMap<String, BTreeMap<String, VowelTarget>>;

/// The calibrated vowel table (parsed once).
pub fn vowel_table() -> &'static VowelTable {
    static T: OnceLock<VowelTable> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str(include_str!("vowelTargets.generated.json")).expect("vowelTargets.generated.json"))
}

/// Diphthongs and r-coloured vowels expand to vowel sequences. American /eɪ oʊ/ glide toward
/// [i u] (Hillenbrand et al. 1995: /e/ F2 rises ~150 Hz, /o/ F1 falls with F2 steady); with
/// [ɪ ʊ] as targets they barely moved (/e/ and /ɪ/ share F2) and sounded like the steady
/// [eː oː] of Indian English. The other offglides undershoot toward [ɪ ʊ].
pub fn expand(ipa: &str) -> Option<&'static [&'static str]> {
    Some(match ipa {
        "aɪ" => &["a", "ɪ"],
        "aʊ" => &["a", "ʊ"],
        "ɔɪ" => &["ɔ", "ɪ"],
        "eɪ" => &["e", "i"],
        "oʊ" => &["o", "u"],
        "ɚ" => &["ɝ"],
        _ => return None,
    })
}

/// The two vowel targets of a diphthong ("aɪ" → ("a", "ɪ")), or None.
pub fn diphthong_parts(ipa: &str) -> Option<(&'static str, &'static str)> {
    match expand(ipa) {
        Some(p) if p.len() == 2 => Some((p[0], p[1])),
        _ => None,
    }
}

pub fn is_vowel(ipa: &str, body: BodyMix) -> bool {
    let t = vowel_table();
    body.weights().iter().any(|(b, w)| *w > 0.0 && t.get(b.as_str()).is_some_and(|t| t.contains_key(ipa))) || expand(ipa).is_some()
}

/// The calibrated articulation of a vowel for a body: between presets, the presets' calibrated
/// articulations blended by the body's weights.
pub fn vowel_artic(ipa: &str, body: BodyMix) -> Option<ArticPatch> {
    if let Some(b) = body.preset() {
        return preset_vowel_artic(ipa, b);
    }
    let w = body.weights();
    let mut parts = [(0.0, ArticPatch::default()); 3];
    for (i, (b, wi)) in w.iter().enumerate() {
        if *wi > 0.0 {
            parts[i] = (*wi, preset_vowel_artic(ipa, *b)?);
        }
    }
    Some(ArticPatch::blend(&parts))
}

fn preset_vowel_artic(ipa: &str, body: BodyName) -> Option<ArticPatch> {
    let t = vowel_table();
    let v = t.get(body.as_str()).and_then(|b| b.get(ipa)).or_else(|| t.get("male").and_then(|m| m.get(ipa)))?;
    let mut out = ArticPatch::default();
    for k in VOWEL_KEYS {
        if let Some(x) = v.artic.get(k) {
            out.set(k, x);
        }
    }
    // a rhotic's tip is raised and curled back, not resting behind the teeth: without its
    // calibrated position the tip stayed down and /ɝ/'s F3 sat ~15–20 % high (weakly rhotic)
    if v.artic.get(ArticKey::TtCurl).unwrap_or(0.0) > 0.05 {
        if let Some(x) = v.artic.get(ArticKey::TtX) {
            out.set(ArticKey::TtX, x);
        }
        if let Some(x) = v.artic.get(ArticKey::TtY) {
            out.set(ArticKey::TtY, x);
        }
    }
    Some(out)
}

/// Parse the vowel and consonant tables now (so nothing initialises lazily on the audio thread).
pub fn init() {
    vowel_table();
    super::inventory::init();
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanOptions {
    pub body: BodyMix,
    /// voice-clock start time (s)
    pub t0: f64,
    /// speaking-rate multiplier (>1 = faster)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate: Option<f64>,
    /// baseline pitch (Hz)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub f0: Option<f64>,
    /// "statement" (final fall) or "question" (final rise)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intonation: Option<Intonation>,
    /// pitch excursion for stressed syllables (fraction)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent: Option<f64>,
    /// the last segment is held open-ended (a sung note): no end-of-breath release
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub open_end: Option<bool>,
    /// a sung phrase (`plan_song`): consonants given a pitch hold it, and pitch ramps shrink to
    /// fit short notes. Speech and live notes leave it unset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sung: Option<bool>,
}

/// JS truthiness of an optional number (`if (s.f0)`: 0 and NaN are false).
#[inline]
pub(crate) fn truthy(x: Option<f64>) -> bool {
    matches!(x, Some(v) if v != 0.0 && !v.is_nan())
}

/// `Partial<HumanArtic>` as gesture targets
#[inline]
pub(crate) fn artic_targets(p: &ArticPatch) -> Targets {
    let mut t = Targets::default();
    for (k, x) in p.iter() {
        t.set(k, x);
    }
    t
}

#[inline]
fn one(k: impl Into<ControlKey>, x: f64) -> Targets {
    Targets::default().with(k, x)
}

/// A planner segment: the input segment plus what the planner attaches to it.
struct Seg<'a> {
    ipa: &'a str,
    dur: Option<f64>,
    stress: Option<u8>,
    f0: Option<f64>,
    def: Option<PhonemeDef>,
    vowel: Option<ArticPatch>,
    glide_from: bool,
    aspirated: Option<bool>,
    vot: Option<f64>,
    nasalized: Option<bool>,
    palatalized: Option<bool>,
    breathy: Option<bool>,
}

/// glottal abduction of breathy voice: /ɦ/'s, a gap the folds still vibrate across
const BREATHY_ABDUCTION: f64 = 0.1;
/// how long past its release a breathy-voiced stop's folds stay apart (s), at most to the end of
/// the next segment
const BREATHY_RELEASE: f64 = 0.08;

/// A trill's strikes, `TRILL_HZ` a second: the share of each cycle spent at the place, the
/// ramps (s), the articulator speed, and how far (cm) the tongue is pulled back between strikes.
/// The tongue is too slow (13 Hz) to strike 26 times a second and reopen: at 26 Hz it hovered
/// near the ridge with the voicing all but gone; and above speed 6 it overshot and bounced.
const TRILL_HZ: f64 = 20.0;
const TRILL_STRIKE: f64 = 0.45;
const TRILL_RAMP: f64 = 0.004;
const TRILL_SPEED: f64 = 3.5;
const TRILL_OPEN: f64 = 1.6;

/// where a trill's articulator is pulled back to between strikes: away from the place by
/// `TRILL_OPEN` (cm) for the tongue, by an open lip gap for the lips
fn trill_open(closed: &ArticPatch) -> ArticPatch {
    let mut open = ArticPatch::default();
    for (k, v) in closed.iter() {
        match k {
            ArticKey::TtY | ArticKey::TbY => {
                open.set(k, v - TRILL_OPEN);
            }
            ArticKey::LipAp => {
                open.set(k, v + 0.4);
            }
            _ => {}
        }
    }
    open
}

/// velum port area (cm²) of a nasalized vowel, and the ramps of its lowering and raising (s)
const NASAL_VOWEL_PORT: f64 = 0.3;
const NASAL_VOWEL_RAMP: f64 = 0.04;

#[derive(Clone, Copy)]
struct Span {
    t0: f64,
    t1: f64,
}

pub fn plan_utterance(input: &[Segment], o: &PlanOptions) -> Plan {
    let rate = o.rate.unwrap_or(1.0);
    let body = o.body;
    // durations by the Klatt rules, on whole segments (diphthongs before they are split)
    let durs = klatt_durations(input, |s| {
        if is_vowel(&s.ipa, body) {
            return SegInfo { vowel: true, ..Default::default() };
        }
        let d = phoneme(&s.ipa, body);
        SegInfo { vowel: false, manner: d.map(|d| d.manner), voiced: Some(d.is_some_and(|d| d.voicing == Voicing::Voiced)), dur: d.map(|d| d.dur) }
    });
    // expand diphthongs into two vowel targets sharing the duration
    let mut segs: Vec<Seg> = Vec::with_capacity(input.len() + 4);
    for (si, s) in input.iter().enumerate() {
        if let Some(parts) = expand(&s.ipa) {
            let base = durs[si];
            for (i, p) in parts.iter().enumerate() {
                let dur = if parts.len() > 1 { base * (if i == 0 { 0.55 } else { 0.45 }) } else { base };
                segs.push(Seg { ipa: p, dur: Some(dur), stress: s.stress, f0: s.f0, def: None, vowel: None, glide_from: i > 0, aspirated: None, vot: None, nasalized: s.nasalized, palatalized: None, breathy: s.breathy });
            }
        } else {
            segs.push(Seg { ipa: &s.ipa, dur: Some(durs[si]), stress: s.stress, f0: s.f0, def: None, vowel: None, glide_from: false, aspirated: s.aspirated, vot: s.vot, nasalized: s.nasalized, palatalized: s.palatalized, breathy: s.breathy });
        }
    }
    for s in segs.iter_mut() {
        let v = vowel_artic(s.ipa, body);
        if v.is_some() {
            s.vowel = v;
        } else {
            s.def = phoneme(s.ipa, body);
        }
    }
    let mut gestures: Vec<Gesture> = Vec::new();
    let mut planned: Vec<PlannedSegment> = Vec::with_capacity(segs.len());
    let mut t = o.t0 + 0.06; // breath onset lead
    let mut times: Vec<Span> = Vec::with_capacity(segs.len());
    for s in &segs {
        let mut d = if let Some(d) = s.dur {
            d
        } else if s.vowel.is_some() {
            if s.stress == Some(1) {
                0.17
            } else if s.stress == Some(2) {
                0.13
            } else {
                0.095
            }
        } else {
            s.def.map_or(0.08, |d| d.dur)
        };
        // final lengthening on the last syllable rhyme
        d /= rate;
        times.push(Span { t0: t, t1: t + d });
        t += d;
    }
    let end = t;
    // ---- vowel gestures: overlap neighbours so the tongue travels vowel-to-vowel
    let v_idx: Vec<usize> = segs.iter().enumerate().filter(|(_, s)| s.vowel.is_some()).map(|(i, _)| i).collect();
    for (n, &i) in v_idx.iter().enumerate() {
        let prev = if n > 0 { times[v_idx[n - 1]].t1 } else { times[i].t0 - 0.08 };
        let next = if n < v_idx.len() - 1 { times[v_idx[n + 1]].t0 } else { times[i].t1 + 0.08 };
        // vowel-to-vowel through the consonant (Öhman): the previous vowel lets go early in the gap
        // and the next one's target ramps in over most of it, so the tongue body is already near
        // the next vowel at the release and the transitions carry the consonant's place
        let r_in = js_max(0.03, 0.75 * (times[i].t0 - prev)) + 0.01;
        let r_out = js_max(0.03, 0.4 * (next - times[i].t1)) + 0.01;
        gestures.push(Gesture::new(times[i].t0, times[i].t1, r_in, r_out, 1.0, artic_targets(segs[i].vowel.as_ref().unwrap())).label(segs[i].ipa));
    }
    // utterance-initial/final consonants: lend them the nearest vowel's body posture
    // ---- consonant gestures
    for (i, s) in segs.iter().enumerate() {
        let Span { t0, t1 } = times[i];
        let dur = t1 - t0;
        planned.push(PlannedSegment {
            ipa: s.ipa.to_string(),
            t0,
            t1,
            stress: if s.vowel.is_some() { Some(s.stress.unwrap_or(0)) } else { None },
            kind: if s.vowel.is_some() { "vowel".to_string() } else { s.def.map_or("?", |d| d.manner.as_str()).to_string() },
        });
        if s.vowel.is_some() && !s.glide_from {
            // what a vowel's marks hold for the whole vowel, through a diphthong's glide
            let end = times[(i + 1..segs.len()).take_while(|&j| segs[j].glide_from).last().unwrap_or(i)].t1;
            if s.nasalized == Some(true) {
                // nasalized: the velum is down
                gestures.push(Gesture::new(t0, end, NASAL_VOWEL_RAMP, NASAL_VOWEL_RAMP, 4.0, one(ArticKey::Velum, NASAL_VOWEL_PORT)).label("velum"));
            }
            if s.breathy == Some(true) {
                // breathy: the folds part-open, as for /ɦ/
                gestures.push(Gesture::new(t0, end, 0.03, 0.03, 5.0, one(ControlKey::ABDUCTION, BREATHY_ABDUCTION)).label("breathy"));
            }
        }
        let Some(def) = s.def.as_ref() else { continue };
        let next_vowel = i < segs.len() - 1 && segs[i + 1].vowel.is_some();
        let prev_seg = if i > 0 { Some(&segs[i - 1]) } else { None };
        let mut add_oral = |tg: &ArticPatch, a: f64, b: f64, speed: f64, label: &str| oral_gestures_into(def, tg, a, b, speed, label, &mut gestures);
        match def.manner {
            // a stop that closes behind another stop's closure, its articulator already placed by
            // the segment before that (the tip raised for /ɹ/ in "sharp tree"), reaches contact
            // sooner than from a vowel: with the usual lead it sealed ~20 ms before the front
            // closure opened, and the tongue then pumped the air shut between the two closures
            // The delay leaves the closure 30 ms before its release (its 10 ms minimum hold and
            // its ~20 ms early release), so a short sung stop isn't pushed past its own end.
            Manner::Stop if pre_placed_behind_closure(&segs, i) => add_oral(&def.targets, t0 + js_min(PLACED_CLOSURE_DELAY, js_max(0.0, dur - 0.03)), t1, 1.55, def.ipa),
            Manner::Stop | Manner::Nasal => add_oral(&def.targets, t0, t1, 1.55, def.ipa),
            Manner::Tap => add_oral(&def.targets, t0, t1, 2.8, def.ipa),
            Manner::Trill => {
                // driven trill: the articulator strikes the place and is pulled back between
                // strikes, so the voice carries on through it. Each strike is its own short gesture
                // with tight ramps: with a stop's 30 ms ramp-in and 18 ms ramp-out the strikes
                // overlapped into one held near-closure and the voice stopped for ~90 ms (Spanish
                // "perro" sounded wrong; tests/trill.rs)
                let n = js_max(2.0, js_round(dur * TRILL_HZ));
                let mut k = 0.0;
                while k < n {
                    let a = t0 + (k / n) * dur;
                    let b = a + TRILL_STRIKE * dur / n;
                    gestures.push(Gesture::new(a, b, TRILL_RAMP, TRILL_RAMP, 40.0, artic_targets(&def.targets)).speed(TRILL_SPEED).release_hold(TRILL_RAMP).label(def.ipa));
                    if k + 1.0 < n {
                        gestures.push(Gesture::new(b + 2.0 * TRILL_RAMP, a + dur / n - TRILL_RAMP, TRILL_RAMP, TRILL_RAMP, 40.0, artic_targets(&trill_open(&def.targets))).speed(TRILL_SPEED).label(def.ipa));
                    }
                    k += 1.0;
                }
            }
            Manner::Affricate => {
                let split = t0 + dur * 0.55;
                add_oral(&def.targets, t0, split, 2.0, def.ipa);
                let rel = def.release.and_then(|r| phoneme(r, body));
                if let Some(rel) = rel {
                    add_oral(&rel.targets, split + 0.008, t1, 1.4, def.ipa);
                }
            }
            Manner::Fricative | Manner::Approximant | Manner::Lateral => add_oral(&def.targets, t0, t1, 1.3, def.ipa),
            Manner::Glottal | Manner::Vowel => {}
        }
        // nasality: the velum lowers in anticipation (into the preceding vowel, as in English) and
        // seals again by the end of the nasal; 0.45 cm² is ample for the murmur
        if def.nasal == Some(true) {
            gestures.push(Gesture::new(t0 - 0.02, t1 - 0.02, 0.05, 0.03, 4.0, one(ArticKey::Velum, 0.45)).label("velum"));
        }
        // phonation
        let k2 = 1.0; // abduction is body-scaled in the voice
        let mut voiced_again = t1; // when the folds are back, after an aspirated release
        if def.glottal == Some(Glottal::Open) {
            gestures.push(Gesture::new(t0 - 0.01, t1, 0.03, 0.035, 5.0, one(ControlKey::ABDUCTION, 0.33 * k2)).label("h"));
        } else if def.glottal == Some(Glottal::Breathy) {
            gestures.push(Gesture::new(t0, t1, 0.03, 0.03, 5.0, one(ControlKey::ABDUCTION, 0.1 * k2)).label("ɦ"));
        } else if def.glottal == Some(Glottal::Stop) {
            gestures.push(Gesture::new(t0, t1, 0.012, 0.015, 8.0, one(ControlKey::CLOSURE, 1.0)).label("ʔ"));
        } else if def.voicing == Voicing::Voiceless {
            if def.manner == Manner::Stop || def.manner == Manner::Affricate {
                // as the front end says; by default English's rule: aspirated when syllable-initial
                // before a vowel and not after /s/
                let aspirated = s.aspirated.unwrap_or_else(|| next_vowel && !prev_seg.is_some_and(|p| p.ipa == "s"));
                // the folds stay apart past the release by 40% of the default 50 ms (the ramps
                // make up the rest of the aspiration); a front end's longer or shorter `vot` moves
                // that by the whole difference, so the voice onset time it asks for is what it gets
                let past = match (aspirated, s.vot) {
                    (true, None) => DEFAULT_VOT / rate * 0.4, // as before, to the bit
                    (true, Some(v)) => js_max(0.0, 0.4 * DEFAULT_VOT + v - DEFAULT_VOT) / rate,
                    (false, _) => 0.012 * 0.4,
                };
                let g = Gesture::new(t0 + 0.25 * dur, t1 + past, 0.035, if aspirated { 0.045 } else { 0.02 }, 6.0, one(ControlKey::ABDUCTION, if aspirated { 0.36 } else { 0.22 })).label("aspiration");
                voiced_again = g.end();
                gestures.push(g);
            } else {
                gestures.push(Gesture::new(t0 - 0.015, t1 + 0.005, 0.03, 0.03, 6.0, one(ControlKey::ABDUCTION, 0.3)).label("voiceless"));
            }
        } else if def.manner == Manner::Fricative {
            gestures.push(Gesture::new(t0, t1, 0.03, 0.03, 3.0, one(ControlKey::ABDUCTION, 0.035)).label("voiced frication"));
        }
        // a breathy-voiced release (Hindi bʱ): the folds part as the closure lets go and stay
        // apart into the start of the vowel
        if s.breathy == Some(true) && def.voicing == Voicing::Voiced && matches!(def.manner, Manner::Stop | Manner::Affricate) {
            let until = js_min(t1 + BREATHY_RELEASE, times.get(i + 1).map_or(f64::MAX, |n| n.t1));
            gestures.push(Gesture::new(t1 - 0.02, until, 0.03, 0.03, 5.0, one(ControlKey::ABDUCTION, BREATHY_ABDUCTION)).label("breathy"));
        }
        // palatalization: the tongue body goes toward /j/ under the consonant, stays there until the
        // voice returns, and lets go into the vowel, so the release carries the [j]-like transition
        if s.palatalized == Some(true) {
            if let Some(tg) = palatal_body(def, body) {
                gestures.push(Gesture::new(t0, voiced_again, PALATAL_RAMP, PALATAL_RAMP, PALATAL_STRENGTH, artic_targets(&tg)).label("palatalized"));
            }
        }
    }
    let open_end = o.open_end == Some(true);
    let sung = o.sung == Some(true);
    // ---- breath: on through the utterance. A sung phrase's onset is planned (its first vowel
    // lands on the beat), so a singer times the breath to it: the pressure reaches full drive as
    // the first segment starts, and builds into adducted folds or behind the first constriction
    // rather than voicing ahead of the note. Speech and live notes keep their 20 ms lead.
    let breath_at = if sung { BREATH_SUNG_AT } else { 0.04 };
    gestures.push(Gesture::new(o.t0 + breath_at, end, 0.04, if open_end { 0.07 } else { 0.05 }, 1.0, one(ControlKey::BREATH, 1.0)).label("breath"));
    // ---- end of the breath group: the folds part as the breath stops, so a final obstruent is
    // released into silence instead of into an added vowel ("cat-uh"). After a vowel or sonorant
    // they part once the pressure has fallen, so the voice fades out instead of ending in an [h].
    if !open_end {
        let last = segs.last();
        let sonorant = last.is_some_and(|l| l.vowel.is_some()) || last.and_then(|l| l.def).is_some_and(|d| matches!(d.manner, Manner::Nasal | Manner::Approximant | Manner::Lateral | Manner::Tap | Manner::Trill));
        let at = end + if sonorant { 0.045 } else { 0.015 };
        gestures.push(Gesture::new(at, end + 0.1, 0.03, 0.06, 6.0, one(ControlKey::ABDUCTION, 0.22)).label(EXHALE_LABEL));
    }
    // ---- intonation: pitch targets on vowels
    let f0 = o.f0.unwrap_or(110.0);
    let accent = o.accent.unwrap_or(0.14);
    let total = js_max(0.2, end - o.t0);
    // the nuclear accent: the phrase's last primary-stressed vowel, a bigger excursion that falls
    // (statements) into the final low; earlier accents are smaller (a "hat" pattern)
    let mut nuclear: isize = -1;
    for &i in &v_idx {
        if segs[i].stress == Some(1) && !segs[i].glide_from {
            nuclear = i as isize;
        }
    }
    for (n, &i) in v_idx.iter().enumerate() {
        let s = &segs[i];
        let Span { t0, t1 } = times[i];
        // pitch holds through the consonants up to the next vowel (instead of sagging to the base)
        let hold = if n < v_idx.len() - 1 { js_max(t1, times[v_idx[n + 1]].t0 - 0.03) } else { t1 };
        let mut target: f64;
        let has_f0 = truthy(s.f0);
        if has_f0 {
            target = s.f0.unwrap();
        } else {
            let prog = (t0 - o.t0) / total;
            let decl = 1.0 - 0.1 * prog;
            let is_nuclear = i as isize == nuclear;
            let acc = if s.stress == Some(1) {
                1.0 + (if is_nuclear { accent * 1.8 } else { accent })
            } else if s.stress == Some(2) {
                1.0 + accent * 0.5
            } else {
                1.0
            };
            target = f0 * decl * acc;
            let last = n == v_idx.len() - 1;
            if last && o.intonation == Some(Intonation::Question) {
                target = f0 * 1.35;
            }
            if last && o.intonation.unwrap_or(Intonation::Statement) == Intonation::Statement {
                if is_nuclear && t1 - t0 > 0.08 {
                    // accent peak early in the vowel, then the fall within it
                    gestures.push(Gesture::new(t0, t0 + 0.35 * (t1 - t0), 0.05, 0.05, 1.0, one(ControlKey::F0, target)).label("pitch"));
                    gestures.push(Gesture::new(t0 + 0.55 * (t1 - t0), t1, 0.06, 0.06, 1.0, one(ControlKey::F0, f0 * 0.82)).label("pitch"));
                    continue;
                }
                target = f0 * 0.82;
            }
        }
        let r = if has_f0 && sung { pitch_ramp(t1 - t0) } else { 0.06 };
        gestures.push(Gesture::new(t0, if has_f0 { t1 } else { hold }, r, r, if has_f0 { 6.0 } else { 1.0 }, one(ControlKey::F0, target)).label("pitch"));
    }
    // sung: a consonant given its note's pitch holds it, so the pitch moves during an onset
    // consonant and has arrived when the vowel starts
    for (i, s) in segs.iter().enumerate() {
        if sung && s.vowel.is_none() && truthy(s.f0) {
            let Span { t0, t1 } = times[i];
            let r = pitch_ramp(t1 - t0);
            gestures.push(Gesture::new(t0, t1, r, r, 6.0, one(ControlKey::F0, s.f0.unwrap())).label("pitch"));
        }
    }
    if rate > 1.0 {
        shorten_timing(&mut gestures, rate);
    }
    Plan { gestures, segments: planned, end }
}

/// How firmly a palatalized consonant's tongue body is held (the overlapping vowel has 1.0, the
/// consonant's own articulators 40), and how long it takes to take and let go of the posture (s)
const PALATAL_STRENGTH: f64 = 3.0;
const PALATAL_RAMP: f64 = 0.04;

/// The tongue body's posture for a palatalized consonant: /j/'s, on the coordinates the consonant
/// itself does not use. A velar closes with the body's height, so only its front-back
/// place moves (fronted); a consonant with no free body coordinate (palatals, uvulars, /w/, /ɫ/,
/// glottals) has nothing to add.
fn palatal_body(def: &PhonemeDef, body: BodyMix) -> Option<ArticPatch> {
    let j = phoneme("j", body)?;
    let mut out = ArticPatch::default();
    for k in [ArticKey::TbX, ArticKey::TbY] {
        if let (false, Some(x)) = (def.dominant.contains(&k), j.targets.get(k)) {
            out.set(k, x);
        }
    }
    (!out.is_empty() && def.place != "palatal" && def.manner != Manner::Glottal).then_some(out)
}

/// Fast speech: segments shrink by the rate, so the gestures' ramps and release holds must shrink
/// too. With fixed ones, a stop's closure outlasted the short vowel after it: at rate 1.8 the /ɑ/
/// of "ɑtɑtɑ" never opened (tests/fast_speech.rs). Pitch and breath gestures keep their ramps.
fn shorten_timing(gestures: &mut [Gesture], rate: f64) {
    for g in gestures.iter_mut().filter(|g| !g.targets.has(ControlKey::F0) && !g.targets.has(ControlKey::BREATH)) {
        g.ramp_in /= rate;
        g.ramp_out /= rate;
        g.release_hold = g.release_hold.map(|h| h / rate);
    }
}

/// Front-to-back order of the oral places of articulation.
fn place_rank(place: &str) -> Option<u8> {
    Some(match place {
        "bilabial" => 0,
        "labiodental" => 1,
        "dental" => 2,
        "alveolar" => 3,
        "postalveolar" => 4,
        "retroflex" => 5,
        "palatal" => 6,
        "velar" => 7,
        "uvular" => 8,
        _ => return None,
    })
}

/// How much later a pre-placed closure behind another stop's closure is aimed (s): the time its
/// shorter travel saves, so it seals as the front closure opens.
const PLACED_CLOSURE_DELAY: f64 = 0.025;
/// An aspirated stop's voice onset time when its front end doesn't say (English's), in seconds.
const DEFAULT_VOT: f64 = 0.05;

/// Whether stop `i` closes behind the closure of the stop before it, with its own articulators
/// already set by the consonant before that one (/t/ in /ɹpt/: the tip is up for the /ɹ/ and
/// stays free during the lip closure; a rhotic vowel raises it too). After any other vowel ("apt",
/// "napkin") the timing is unchanged.
fn pre_placed_behind_closure(segs: &[Seg], i: usize) -> bool {
    let (Some(def), Some(prev)) = (segs[i].def.as_ref(), i.checked_sub(1).and_then(|j| segs[j].def.as_ref())) else { return false };
    if def.manner != Manner::Stop || prev.manner != Manner::Stop || !closes_in_front(prev.place, def.place) || i < 2 {
        return false;
    }
    let before = &segs[i - 2];
    let rhotic = before.vowel.as_ref().filter(|v| v.get(ArticKey::TtCurl).unwrap_or(0.0) > 0.05);
    let Some(tg) = before.def.as_ref().map(|d| &d.targets).or(rhotic) else { return false };
    def.dominant.iter().all(|k| tg.get(*k).is_some())
}

/// Whether a closure at `front` lies in front of one at `back`.
fn closes_in_front(front: &str, back: &str) -> bool {
    matches!((place_rank(front), place_rank(back)), (Some(f), Some(b)) if f < b)
}

/// Ramps of a given pitch (a sung note's) on a segment `dur` long: 60 ms, but at most half the
/// segment. A ramp-in starts before the segment, so in a fast run a full 60 ms would pull the
/// previous vowel off its note for most of its length.
fn pitch_ramp(dur: f64) -> f64 {
    js_min(0.06, js_max(0.008, 0.5 * dur))
}

/// Oral gestures for one consonant constriction held acoustically from `a` to `b` (closure to
/// release): a dominant gesture on the consonant's own articulators and a weak one on the rest.
/// Movement latencies are compensated so the acoustic closure and release land on a and b.
pub fn oral_gestures(def: &PhonemeDef, tg: &ArticPatch, a: f64, b: f64, speed: f64, label: &str) -> Vec<Gesture> {
    let mut out = Vec::with_capacity(4);
    oral_gestures_into(def, tg, a, b, speed, label, &mut out);
    out
}

/// [`oral_gestures`], appended to `out` (at most four gestures; no allocation when `out` has
/// room for them).
pub fn oral_gestures_into(def: &PhonemeDef, tg: &ArticPatch, a: f64, b: f64, speed: f64, label: &str, out: &mut Vec<Gesture>) {
    let mut dom = ArticPatch::default();
    let mut sec = ArticPatch::default();
    for (k, v) in tg.iter() {
        if def.dominant.contains(&k) {
            dom.set(k, v);
        } else {
            sec.set(k, v);
        }
    }
    let is = |k: &ArticKey, a: ArticKey, b: ArticKey, c: ArticKey| *k == a || *k == b || *k == c;
    // the dorsum is heavy: its releases are slower than tip and lip releases
    let body_only = def.dominant.iter().all(|k| is(k, ArticKey::TbX, ArticKey::TbY, ArticKey::Root));
    let sp = if body_only { 1.0 + (speed - 1.0) * 0.35 } else { speed };
    // articulators need ~10–15 ms to climb out of the overshoot (contact) target, so the
    // gesture releases early and the acoustic release lands on the planned boundary:
    // measured movement latencies (closure lag / release lag) per articulator class
    let closing = matches!(def.manner, Manner::Stop | Manner::Nasal | Manner::Affricate);
    let lips_only = def.dominant.iter().all(|k| *k == ArticKey::LipAp || *k == ArticKey::Labiodental);
    let lead = if closing { if body_only { 0.034 } else if lips_only { 0.019 } else { 0.02 } } else { 0.0 };
    // a consonant must own its constriction articulators (Task-Dynamics style): at strength 40
    // the overlapping vowel contributes ~2 %, so closures seal instead of being diluted
    let early = if closing { if body_only { 0.024 } else if lips_only { 0.022 } else { 0.031 } } else { 0.008 };
    if !dom.is_empty() {
        out.push(Gesture::new(a - early, js_max(a + 0.01, b - lead), 0.03, if body_only { 0.03 } else { 0.018 }, 40.0, artic_targets(&dom)).speed(sp).release_hold(0.045).label(label));
    }
    // alveolars front the tongue body during the closure (the alveolar F2 locus, ~1.8 kHz)
    let alveolar = def.place == "alveolar" && tg.get(ArticKey::TbX).is_none() && matches!(def.manner, Manner::Stop | Manner::Nasal | Manner::Fricative | Manner::Affricate | Manner::Tap);
    if alveolar {
        out.push(Gesture::new(a, b, 0.05, 0.05, 1.2, Targets::default().with(ArticKey::TbX, 3.2).with(ArticKey::TbY, 7.4)).label(label));
    }
    if !sec.is_empty() {
        // a velar's front–back place follows the vowel (fronted /k/ in "key", backed in "caw"):
        // its own tbX only weakly, so the F2 locus moves with the vowel as in natural speech
        let place = if body_only { sec.get(ArticKey::TbX) } else { None };
        if place.is_some() {
            sec.values[ArticKey::TbX.index()] = None;
        }
        if !sec.is_empty() {
            out.push(Gesture::new(a, b, 0.05, 0.05, 2.2, artic_targets(&sec)).label(label));
        }
        if let Some(x) = place {
            out.push(Gesture::new(a, b, 0.05, 0.05, 0.25, one(ArticKey::TbX, x)).label(label));
        }
    }
}

/// One phrase of [`plan_phrases`].
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhraseInput {
    pub segments: Vec<Segment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intonation: Option<Intonation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pause: Option<f64>,
}

/// Plan consecutive phrases (each with its own breath group and intonation) from t0.
/// `o.intonation` is ignored (each phrase brings its own).
pub fn plan_phrases(phrases: &[PhraseInput], o: &PlanOptions) -> Plan {
    let mut all = Plan { gestures: Vec::new(), segments: Vec::new(), end: o.t0 };
    let mut t = o.t0;
    for p in phrases {
        let plan = plan_utterance(&p.segments, &PlanOptions { t0: t, intonation: Some(p.intonation.unwrap_or(Intonation::Statement)), ..o.clone() });
        all.gestures.extend_from_slice(&plan.gestures);
        all.segments.extend(plan.segments);
        t = plan.end + p.pause.unwrap_or(0.25);
        all.end = plan.end;
    }
    all
}
