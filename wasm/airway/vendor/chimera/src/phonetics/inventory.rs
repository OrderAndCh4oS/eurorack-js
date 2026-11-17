//! Phoneme inventory (IPA) as articulatory specifications for the human model.
//! Coordinates are template-space (cm) and apply to every body (the anatomy scales them).
//! Fricative/approximant constriction heights are refined by tools/calibrate-consonants.ts
//! to hit target constriction areas; calibrated values override the defaults here.
//!
//! Real time: [`phoneme`] returns a `Copy` definition (targets inline, strings static) and
//! allocates nothing once [`init`] has parsed the tables.

use crate::anatomy::human::{ArticKey, ArticPatch, BodyMix, BodyName};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::LazyLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Manner {
    Vowel,
    Stop,
    Nasal,
    Fricative,
    Affricate,
    Approximant,
    Lateral,
    Tap,
    Trill,
    Glottal,
}

impl Manner {
    pub fn as_str(self) -> &'static str {
        match self {
            Manner::Vowel => "vowel",
            Manner::Stop => "stop",
            Manner::Nasal => "nasal",
            Manner::Fricative => "fricative",
            Manner::Affricate => "affricate",
            Manner::Approximant => "approximant",
            Manner::Lateral => "lateral",
            Manner::Tap => "tap",
            Manner::Trill => "trill",
            Manner::Glottal => "glottal",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Voicing {
    Voiced,
    Voiceless,
}

/// glottal-only segments
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Glottal {
    Open,
    Stop,
    Breathy,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhonemeDef {
    pub ipa: &'static str,
    pub name: &'static str,
    pub manner: Manner,
    pub voicing: Voicing,
    pub place: &'static str,
    pub targets: ArticPatch,
    /// articulators this segment controls strongly (others coarticulate with vowels)
    pub dominant: &'static [ArticKey],
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nasal: Option<bool>,
    /// default duration (s)
    pub dur: f64,
    /// target constriction area (cm², adult male) for calibration of the main coordinate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub area: Option<f64>,
    /// which coordinate the calibration adjusts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cal_key: Option<ArticKey>,
    /// affricate: the fricative release
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release: Option<&'static str>,
    /// glottal-only segments
    #[serde(skip_serializing_if = "Option::is_none")]
    pub glottal: Option<Glottal>,
}

use ArticKey::*;
use Manner as M;
use Voicing::{Voiced, Voiceless};

type Tg = &'static [(ArticKey, f64)];

const TIP: [ArticKey; 2] = [TtX, TtY];
const BODY: [ArticKey; 2] = [TbX, TbY];
const LIPS: [ArticKey; 1] = [LipAp];

/// `{ ...a, ...b }` as a patch
fn tg(a: Tg, b: Tg) -> ArticPatch {
    let mut p = ArticPatch::default();
    for (k, x) in a.iter().chain(b) {
        p.set(*k, *x);
    }
    p
}

#[allow(clippy::too_many_arguments)]
fn c(ipa: &'static str, name: &'static str, manner: Manner, voicing: Voicing, place: &'static str, targets: ArticPatch, dominant: &'static [ArticKey], dur: f64) -> PhonemeDef {
    PhonemeDef { ipa, name, manner, voicing, place, targets, dominant, nasal: None, dur, area: None, cal_key: None, release: None, glottal: None }
}

impl PhonemeDef {
    fn nasal(mut self) -> Self {
        self.nasal = Some(true);
        self
    }
    fn cal(mut self, area: f64, key: ArticKey) -> Self {
        self.area = Some(area);
        self.cal_key = Some(key);
        self
    }
    fn rel(mut self, r: &'static str) -> Self {
        self.release = Some(r);
        self
    }
    fn glot(mut self, g: Glottal) -> Self {
        self.glottal = Some(g);
        self
    }
}

// place templates
const BILABIAL: Tg = &[(LipAp, -0.25)];
const ALV_STOP: Tg = &[(TtX, 6.25), (TtY, 9.68)];
#[allow(dead_code)]
const DENT_STOP: Tg = &[(TtX, 6.85), (TtY, 9.0)];
const POSTALV_STOP: Tg = &[(TtX, 5.75), (TtY, 10.0)];
const RETRO_STOP: Tg = &[(TtX, 5.45), (TtY, 10.05), (TtCurl, 0.95)];
const PAL_STOP: Tg = &[(TbX, 3.75), (TbY, 8.45)];
// velar closure: aimed past contact (the contact model caps penetration) so it seals wherever the
// vowel puts the tongue body front–back, and the jaw rises part-way (open-vowel contexts leaked)
const VEL_STOP: Tg = &[(TbX, 2.3), (TbY, 8.35), (Jaw, 0.7)];
const UVU_STOP: Tg = &[(TbX, 1.55), (TbY, 7.6)];
const NONE: Tg = &[];
const ALVPAL_FRIC: Tg = &[(TtX, 5.85), (TtY, 9.5), (TbX, 3.6), (TbY, 7.75), (Jaw, 0.3), (LipProt, 0.0), (LipWidth, 0.7)];
const ALVPAL_STOP: Tg = &[(TtX, 5.85), (TtY, 10.0), (TbX, 3.6), (TbY, 8.1), (LipProt, 0.0), (LipWidth, 0.7)];

const TIP_CURL: &[ArticKey] = &[TtX, TtY, TtCurl];

fn base() -> Vec<PhonemeDef> {
    let t = |a: Tg| tg(a, NONE);
    vec![
        // stops
        c("p", "voiceless bilabial stop", M::Stop, Voiceless, "bilabial", t(BILABIAL), &LIPS, 0.085),
        c("b", "voiced bilabial stop", M::Stop, Voiced, "bilabial", t(BILABIAL), &LIPS, 0.07),
        c("t", "voiceless alveolar stop", M::Stop, Voiceless, "alveolar", t(ALV_STOP), &TIP, 0.075),
        c("d", "voiced alveolar stop", M::Stop, Voiced, "alveolar", t(ALV_STOP), &TIP, 0.06),
        c("ʈ", "voiceless retroflex stop", M::Stop, Voiceless, "retroflex", t(RETRO_STOP), TIP_CURL, 0.075),
        c("ɖ", "voiced retroflex stop", M::Stop, Voiced, "retroflex", t(RETRO_STOP), TIP_CURL, 0.065),
        c("c", "voiceless palatal stop", M::Stop, Voiceless, "palatal", t(PAL_STOP), &BODY, 0.08),
        c("ɟ", "voiced palatal stop", M::Stop, Voiced, "palatal", t(PAL_STOP), &BODY, 0.07),
        c("k", "voiceless velar stop", M::Stop, Voiceless, "velar", t(VEL_STOP), &[TbY], 0.08),
        c("g", "voiced velar stop", M::Stop, Voiced, "velar", t(VEL_STOP), &[TbY], 0.07),
        c("q", "voiceless uvular stop", M::Stop, Voiceless, "uvular", t(UVU_STOP), &BODY, 0.085),
        c("ɢ", "voiced uvular stop", M::Stop, Voiced, "uvular", t(UVU_STOP), &BODY, 0.075),
        c("ʔ", "glottal stop", M::Glottal, Voiceless, "glottal", t(NONE), &[], 0.06).glot(Glottal::Stop),
        // nasals
        c("m", "bilabial nasal", M::Nasal, Voiced, "bilabial", t(BILABIAL), &LIPS, 0.075).nasal(),
        c("ɱ", "labiodental nasal", M::Nasal, Voiced, "labiodental", t(&[(Labiodental, 1.0), (LipAp, -0.1)]), &[Labiodental, LipAp], 0.075).nasal(),
        c("n", "alveolar nasal", M::Nasal, Voiced, "alveolar", t(ALV_STOP), &TIP, 0.07).nasal(),
        c("ɳ", "retroflex nasal", M::Nasal, Voiced, "retroflex", t(RETRO_STOP), TIP_CURL, 0.07).nasal(),
        c("ɲ", "palatal nasal", M::Nasal, Voiced, "palatal", t(PAL_STOP), &BODY, 0.075).nasal(),
        c("ŋ", "velar nasal", M::Nasal, Voiced, "velar", t(VEL_STOP), &[TbY], 0.08).nasal(),
        c("ɴ", "uvular nasal", M::Nasal, Voiced, "uvular", t(UVU_STOP), &BODY, 0.08).nasal(),
        // fricatives
        c("ɸ", "voiceless bilabial fricative", M::Fricative, Voiceless, "bilabial", t(&[(LipAp, 0.08)]), &LIPS, 0.11).cal(0.12, LipAp),
        c("β", "voiced bilabial fricative", M::Fricative, Voiced, "bilabial", t(&[(LipAp, 0.1)]), &LIPS, 0.09).cal(0.15, LipAp),
        c("f", "voiceless labiodental fricative", M::Fricative, Voiceless, "labiodental", t(&[(Labiodental, 1.0), (LipAp, 0.05)]), &[Labiodental, LipAp], 0.11).cal(0.11, LipAp),
        c("v", "voiced labiodental fricative", M::Fricative, Voiced, "labiodental", t(&[(Labiodental, 1.0), (LipAp, 0.06)]), &[Labiodental, LipAp], 0.08).cal(0.13, LipAp),
        c("θ", "voiceless dental fricative", M::Fricative, Voiceless, "dental", t(&[(TtX, 6.85), (TtY, 8.5)]), &TIP, 0.11).cal(0.15, TtY),
        c("ð", "voiced dental fricative", M::Fricative, Voiced, "dental", t(&[(TtX, 6.85), (TtY, 8.5)]), &TIP, 0.07).cal(0.17, TtY),
        c("s", "voiceless alveolar fricative", M::Fricative, Voiceless, "alveolar", t(&[(TtX, 6.3), (TtY, 9.15), (Jaw, 0.3)]), &[TtX, TtY, Jaw], 0.12).cal(0.085, TtY),
        c("z", "voiced alveolar fricative", M::Fricative, Voiced, "alveolar", t(&[(TtX, 6.3), (TtY, 9.15), (Jaw, 0.3)]), &[TtX, TtY, Jaw], 0.09).cal(0.1, TtY),
        c("ʃ", "voiceless postalveolar fricative", M::Fricative, Voiceless, "postalveolar", t(&[(TtX, 5.7), (TtY, 9.5), (Jaw, 0.35), (LipProt, 0.75), (LipWidth, 0.2)]), &[TtX, TtY, Jaw, LipProt, LipWidth], 0.12).cal(0.2, TtY),
        c("ʒ", "voiced postalveolar fricative", M::Fricative, Voiced, "postalveolar", t(&[(TtX, 5.7), (TtY, 9.5), (Jaw, 0.35), (LipProt, 0.75), (LipWidth, 0.2)]), &[TtX, TtY, Jaw, LipProt, LipWidth], 0.09).cal(0.22, TtY),
        c("ʂ", "voiceless retroflex fricative", M::Fricative, Voiceless, "retroflex", t(&[(TtX, 5.45), (TtY, 9.7), (TtCurl, 0.9)]), TIP_CURL, 0.12).cal(0.15, TtY),
        c("ʐ", "voiced retroflex fricative", M::Fricative, Voiced, "retroflex", t(&[(TtX, 5.45), (TtY, 9.7), (TtCurl, 0.9)]), TIP_CURL, 0.09).cal(0.17, TtY),
        c("ç", "voiceless palatal fricative", M::Fricative, Voiceless, "palatal", t(&[(TbX, 3.75), (TbY, 8.25)]), &BODY, 0.12).cal(0.14, TbY),
        c("ʝ", "voiced palatal fricative", M::Fricative, Voiced, "palatal", t(&[(TbX, 3.75), (TbY, 8.25)]), &BODY, 0.09).cal(0.16, TbY),
        c("x", "voiceless velar fricative", M::Fricative, Voiceless, "velar", t(&[(TbX, 2.3), (TbY, 7.7)]), &[TbY], 0.12).cal(0.18, TbY),
        c("ɣ", "voiced velar fricative", M::Fricative, Voiced, "velar", t(&[(TbX, 2.3), (TbY, 7.7)]), &[TbY], 0.09).cal(0.2, TbY),
        c("χ", "voiceless uvular fricative", M::Fricative, Voiceless, "uvular", t(&[(TbX, 1.55), (TbY, 7.6)]), &BODY, 0.12).cal(0.2, TbY),
        c("ʁ", "voiced uvular fricative", M::Fricative, Voiced, "uvular", t(&[(TbX, 1.55), (TbY, 7.6)]), &BODY, 0.09).cal(0.22, TbY),
        c("ħ", "voiceless pharyngeal fricative", M::Fricative, Voiceless, "pharyngeal", t(&[(Root, -0.95), (TbX, 1.3), (TbY, 6.2)]), &[Root, TbX, TbY], 0.12).cal(0.25, TbX),
        c("ʕ", "voiced pharyngeal fricative", M::Fricative, Voiced, "pharyngeal", t(&[(Root, -0.95), (TbX, 1.3), (TbY, 6.2)]), &[Root, TbX, TbY], 0.09).cal(0.3, TbX),
        c("h", "voiceless glottal fricative", M::Glottal, Voiceless, "glottal", t(NONE), &[], 0.09).glot(Glottal::Open),
        c("ɦ", "voiced glottal fricative", M::Glottal, Voiced, "glottal", t(NONE), &[], 0.08).glot(Glottal::Breathy),
        c("ɬ", "voiceless lateral fricative", M::Fricative, Voiceless, "alveolar", tg(ALV_STOP, &[(Lateral, 0.35)]), &[TtX, TtY, Lateral], 0.12),
        c("ɮ", "voiced lateral fricative", M::Fricative, Voiced, "alveolar", tg(ALV_STOP, &[(Lateral, 0.45)]), &[TtX, TtY, Lateral], 0.09),
        // affricates
        c("ts", "voiceless alveolar affricate", M::Affricate, Voiceless, "alveolar", t(ALV_STOP), &TIP, 0.14).rel("s"),
        c("dz", "voiced alveolar affricate", M::Affricate, Voiced, "alveolar", t(ALV_STOP), &TIP, 0.12).rel("z"),
        c("tʃ", "voiceless postalveolar affricate", M::Affricate, Voiceless, "postalveolar", tg(POSTALV_STOP, &[(LipProt, 0.75), (LipWidth, 0.2)]), &[TtX, TtY, LipProt, LipWidth], 0.15).rel("ʃ"),
        c("dʒ", "voiced postalveolar affricate", M::Affricate, Voiced, "postalveolar", tg(POSTALV_STOP, &[(LipProt, 0.75), (LipWidth, 0.2)]), &[TtX, TtY, LipProt, LipWidth], 0.13).rel("ʒ"),
        // Mandarin: alveolo-palatal fricatives and affricates (x, j, q), retroflex
        // affricates (zh, ch). Laminal: the blade and front of the body raised behind the ridge,
        // lips spread (rounding comes from the vowel)
        c("ɕ", "voiceless alveolo-palatal fricative", M::Fricative, Voiceless, "alveolo-palatal", t(ALVPAL_FRIC), &[TtX, TtY, TbX, TbY, Jaw, LipProt, LipWidth], 0.12).cal(0.17, TtY),
        c("ʑ", "voiced alveolo-palatal fricative", M::Fricative, Voiced, "alveolo-palatal", t(ALVPAL_FRIC), &[TtX, TtY, TbX, TbY, Jaw, LipProt, LipWidth], 0.09).cal(0.19, TtY),
        c("tɕ", "voiceless alveolo-palatal affricate", M::Affricate, Voiceless, "alveolo-palatal", t(ALVPAL_STOP), &[TtX, TtY, TbX, TbY, LipProt, LipWidth], 0.14).rel("ɕ"),
        c("dʑ", "voiced alveolo-palatal affricate", M::Affricate, Voiced, "alveolo-palatal", t(ALVPAL_STOP), &[TtX, TtY, TbX, TbY, LipProt, LipWidth], 0.12).rel("ʑ"),
        c("tʂ", "voiceless retroflex affricate", M::Affricate, Voiceless, "retroflex", t(RETRO_STOP), TIP_CURL, 0.14).rel("ʂ"),
        c("dʐ", "voiced retroflex affricate", M::Affricate, Voiced, "retroflex", t(RETRO_STOP), TIP_CURL, 0.12).rel("ʐ"),
        c("pf", "voiceless labiodental affricate", M::Affricate, Voiceless, "labiodental", t(BILABIAL), &LIPS, 0.14).rel("f"),
        // approximants, laterals, taps, trills
        c("w", "labial-velar approximant", M::Approximant, Voiced, "labial-velar", t(&[(LipAp, 0.28), (LipProt, 1.0), (LipWidth, 0.05), (TbX, 2.45), (TbY, 7.45)]), &[LipAp, LipProt, LipWidth, TbX, TbY], 0.06),
        c("ʋ", "labiodental approximant", M::Approximant, Voiced, "labiodental", t(&[(Labiodental, 0.9), (LipAp, 0.25)]), &[Labiodental, LipAp], 0.06),
        c("ɹ", "alveolar approximant", M::Approximant, Voiced, "postalveolar", t(&[(TtX, 5.35), (TtY, 9.35), (TtCurl, 0.85), (LipProt, 0.5), (LipWidth, 0.3), (Root, -0.6), (TbX, 2.3), (TbY, 7.1)]), &[TtX, TtY, TtCurl, LipProt, LipWidth, Root], 0.065),
        c("ɻ", "retroflex approximant", M::Approximant, Voiced, "retroflex", t(&[(TtX, 5.4), (TtY, 9.55), (TtCurl, 1.0)]), TIP_CURL, 0.065),
        c("j", "palatal approximant", M::Approximant, Voiced, "palatal", t(&[(TbX, 3.8), (TbY, 7.95), (Jaw, 0.25)]), &BODY, 0.055),
        c("ɥ", "labial-palatal approximant", M::Approximant, Voiced, "labial-palatal", t(&[(TbX, 3.8), (TbY, 7.95), (Jaw, 0.25), (LipAp, 0.28), (LipProt, 1.0), (LipWidth, 0.05)]), &[TbX, TbY, Jaw, LipAp, LipProt, LipWidth], 0.055),
        c("ɰ", "velar approximant", M::Approximant, Voiced, "velar", t(&[(TbX, 2.35), (TbY, 7.45)]), &BODY, 0.06),
        c("l", "alveolar lateral approximant", M::Lateral, Voiced, "alveolar", tg(ALV_STOP, &[(Lateral, 1.0)]), &[TtX, TtY, Lateral], 0.065),
        c("ɫ", "velarised lateral", M::Lateral, Voiced, "alveolar", tg(ALV_STOP, &[(Lateral, 1.0), (TbX, 1.9), (TbY, 6.8)]), &[TtX, TtY, Lateral, TbX, TbY], 0.075),
        c("ɭ", "retroflex lateral", M::Lateral, Voiced, "retroflex", tg(RETRO_STOP, &[(Lateral, 1.0)]), &[TtX, TtY, TtCurl, Lateral], 0.065),
        c("ʎ", "palatal lateral", M::Lateral, Voiced, "palatal", tg(PAL_STOP, &[(Lateral, 1.0)]), &[TbX, TbY, Lateral], 0.07),
        c("ɾ", "alveolar tap", M::Tap, Voiced, "alveolar", t(ALV_STOP), &TIP, 0.025),
        c("ɽ", "retroflex flap", M::Tap, Voiced, "retroflex", t(RETRO_STOP), TIP_CURL, 0.03),
        // the trill's strikes aim at contact, like /t/: short strikes aimed short of it never touched
        c("r", "alveolar trill", M::Trill, Voiced, "alveolar", t(ALV_STOP), &TIP, 0.11),
        c("ʀ", "uvular trill", M::Trill, Voiced, "uvular", t(&[(TbX, 1.55), (TbY, 7.85)]), &BODY, 0.11),
        c("ʙ", "bilabial trill", M::Trill, Voiced, "bilabial", t(&[(LipAp, 0.02)]), &LIPS, 0.12),
    ]
}

type CalTable = BTreeMap<String, BTreeMap<String, ArticPatch>>;

static BASE: LazyLock<Vec<PhonemeDef>> = LazyLock::new(base);
static CAL: LazyLock<CalTable> = LazyLock::new(|| serde_json::from_str(include_str!("consonantTargets.generated.json")).expect("consonantTargets.generated.json"));
static SYMBOLS: LazyLock<Vec<&'static str>> = LazyLock::new(|| BASE.iter().map(|p| p.ipa).collect());

/// Parse the tables now (so nothing initialises lazily on the audio thread).
pub fn init() {
    LazyLock::force(&BASE);
    LazyLock::force(&CAL);
    LazyLock::force(&SYMBOLS);
}

fn by_ipa(ipa: &str) -> Option<&'static PhonemeDef> {
    // `new Map(BASE.map(...))`: a later duplicate would win; the table has none
    BASE.iter().rev().find(|p| p.ipa == ipa)
}

/// Phoneme definition with calibrated targets for a body (falls back to defaults); between
/// presets the calibrated targets blend by the body's weights. Allocates nothing (the definition
/// is `Copy`).
pub fn phoneme(ipa: &str, body: BodyMix) -> Option<PhonemeDef> {
    let p = by_ipa(ipa)?;
    let of = |b: BodyName| match CAL.get(b.as_str()).and_then(|t| t.get(ipa)) {
        Some(cal) => {
            let mut t = p.targets;
            t.merge(cal);
            t
        }
        None => p.targets,
    };
    let mut out = *p;
    out.targets = match body.preset() {
        Some(b) => of(b),
        None => ArticPatch::blend(&body.weights().map(|(b, w)| (w, of(b)))),
    };
    Some(out)
}

pub fn consonants() -> &'static [PhonemeDef] {
    &BASE
}

pub fn consonant_symbols() -> &'static [&'static str] {
    &SYMBOLS
}
