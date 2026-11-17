//! IPA string → segments (stress ˈ ˌ, length ː, tie bars, affricates, diphthongs, word gaps).

use super::Segment;
use super::inventory::{Manner, PhonemeDef, Voicing};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

const VOWEL_CHARS: &str = "iyɨʉɯuɪʏʊeøɘɵɤoəɛœɜɞʌɔæɐaɶɑɒɝɚ";
const MULTI: [&str; 14] = ["tʃ", "dʒ", "ts", "dz", "pf", "tɕ", "dʑ", "tʂ", "dʐ", "aɪ", "aʊ", "ɔɪ", "eɪ", "oʊ"];
const ALIASES: [(&str, &str); 9] = [("t͡ʃ", "tʃ"), ("d͡ʒ", "dʒ"), ("t͡s", "ts"), ("d͡z", "dz"), ("ɡ", "g"), ("ʧ", "tʃ"), ("ʤ", "dʒ"), ("r̥", "r"), ("ɐ̯", "ɐ")];

/// combining tilde and combining diaeresis below: the vowel before them is nasalized, breathy
const NASALIZED: char = '\u{303}';
const BREATHY: char = '\u{324}';
/// combining inverted breve below (non-syllabic, `aɪ̯`) and combining vertical line below (syllabic,
/// `bʌtn̩`): in most dictionary IPA, and the voice says the sound they mark, so they are never reported
const NONSYLLABIC: char = '\u{32F}';
const SYLLABIC: char = '\u{329}';
/// NFC composes these vowels with their mark into one code point; the tokenizer reads them as the
/// vowel and the mark (those that don't compose, like ɛ̃, arrive as two)
const PRECOMPOSED: [(&str, &str); 7] = [("ã", "a\u{303}"), ("õ", "o\u{303}"), ("ẽ", "e\u{303}"), ("ĩ", "i\u{303}"), ("ũ", "u\u{303}"), ("ỹ", "y\u{303}"), ("ṳ", "u\u{324}")];

fn known() -> &'static HashSet<&'static str> {
    static K: OnceLock<HashSet<&'static str>> = OnceLock::new();
    K.get_or_init(|| {
        let mut k: HashSet<&'static str> = super::inventory::consonant_symbols().iter().copied().collect();
        for (i, c) in VOWEL_CHARS.char_indices() {
            k.insert(&VOWEL_CHARS[i..i + c.len_utf8()]);
        }
        k.extend(MULTI);
        k
    })
}

/// Force the tables (the known-symbol set and the NFC data), so nothing initialises lazily later.
pub fn init() {
    known();
    nfc_tables();
}

pub fn tokenize_ipa(input: &str) -> Vec<Segment> {
    tokenize(input, &mut Gaps::default())
}

/// What `tokenize` leaves out of its input without a word.
#[derive(Default)]
struct Gaps {
    /// symbols it does not know
    unknown: Vec<String>,
    /// letters that carried a combining mark it does not model, and marks it reads written after a
    /// sound they do not apply to (shown with that sound)
    marked: Vec<String>,
}

fn add(list: &mut Vec<String>, item: String) {
    if !list.contains(&item) {
        list.push(item);
    }
}

/// A lone combining mark is shown on a dotted circle, so it is visible.
fn shown(s: &str) -> String {
    if s.chars().next().is_some_and(|c| ('\u{300}'..='\u{36F}').contains(&c)) { format!("\u{25CC}{s}") } else { s.to_string() }
}

impl Gaps {
    /// A mark the tokenizer reads, written after a sound it does not apply to (ʲ after a vowel, ʱ
    /// after a voiceless stop): reported with that sound, or alone when no sound precedes it.
    fn ignore(&mut self, after: Option<&Segment>, mark: char) {
        add(
            &mut self.marked,
            match after {
                Some(s) if s.ipa != "_" => format!("{}{mark}", s.ipa),
                _ => shown(&mark.to_string()),
            },
        );
    }
}

/// What the engine will not say as written in a piece of IPA text (see [`skipped_ipa`]).
#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedIpa {
    /// symbols the tokenizer does not know (a tone letter, a click, a capital, a typo): dropped
    pub unknown: Vec<String>,
    /// symbols the tokenizer knows and the planner has no sound for (a vowel letter without a
    /// calibrated vowel): dropped
    pub no_sound: Vec<String>,
    /// letters written with a mark the engine does not model (a devoicing ring; not the syllabic and
    /// non-syllabic marks `n̩` `ɪ̯`, which are in most dictionary IPA and the voice says the sound),
    /// or a mark it reads written where it cannot apply (`ʲ` after a vowel, `ʱ` after a voiceless
    /// stop), shown with the letter: the letter is said, the mark is not
    pub ignored_marks: Vec<String>,
}

impl SkippedIpa {
    pub fn is_empty(&self) -> bool {
        self.unknown.is_empty() && self.no_sound.is_empty() && self.ignored_marks.is_empty()
    }

    /// One line per kind that is not empty, ready to print after `warning: `. The labels are the
    /// ones the Speak notice shows (`Not said`, `No sound yet`, `Mark ignored`).
    pub fn warnings(&self) -> Vec<String> {
        let mut out = Vec::new();
        let mut line = |what: &str, items: &[String]| {
            if !items.is_empty() {
                out.push(format!("{what}: {}", items.join(" ")));
            }
        };
        line("not said", &self.unknown);
        line("no sound yet", &self.no_sound);
        line("mark ignored", &self.ignored_marks);
        out
    }
}

/// Whether the planner has a sound for a symbol `tokenize_ipa` can emit: a calibrated vowel for
/// some body, a diphthong made of them, or a consonant in the inventory.
fn has_sound(sym: &str) -> bool {
    use crate::anatomy::human::BodyMix;
    [BodyMix::MALE, BodyMix::FEMALE, BodyMix::CHILD].into_iter().any(|b| super::planner::is_vowel(sym, b)) || consonant(sym).is_some()
}

/// What the engine will not say as written in `input`, in input order, each item once: symbols it
/// does not know at all, symbols it knows but has no sound for (derived: `tokenize_ipa` emits
/// them and the planner has no vowel or consonant for them, so the list shrinks as sounds are
/// added), and marks it does not model or cannot apply (the letter is said, the mark is not).
/// The syllabic and non-syllabic marks (U+0329 `n̩`, U+032F `ɪ̯`) are the exception: they are in most
/// dictionary IPA and the voice says the sound they mark, so they are never reported, on any letter
/// or where no letter precedes them.
///
/// The marks `tokenize_ipa` reads (`ʰ ˭`, a tilde or diaeresis below on a vowel, `ʲ`, `ʱ` where
/// they apply), stress, length, tie bars, spaces and `. , |` are not reported, and neither are
/// whitespace of other kinds and the transcription delimiters `/ [ ]` (`/ɕiɛ/`, `[ɕiɛ]`). `tokenize_ipa` itself is unchanged and still drops these silently,
/// so a caller that takes IPA from a person should show this.
pub fn skipped_ipa(input: &str) -> SkippedIpa {
    let mut g = Gaps::default();
    let mut no_sound = Vec::new();
    for seg in tokenize(input, &mut g) {
        if seg.ipa != "_" && !has_sound(&seg.ipa) {
            add(&mut no_sound, seg.ipa);
        }
    }
    SkippedIpa { unknown: g.unknown, no_sound, ignored_marks: g.marked }
}

/// Every symbol `tokenize_ipa` can emit: the inventory's consonants, the vowel letters and the
/// multi-letter affricates and diphthongs. Not every one has a sound (see [`skipped_ipa`]).
pub fn known_ipa_symbols() -> Vec<&'static str> {
    let mut v: Vec<&'static str> = known().iter().copied().collect();
    v.sort_unstable();
    v
}

fn tokenize(input: &str, gaps: &mut Gaps) -> Vec<Segment> {
    let mut s = nfc(input);
    for (a, b) in ALIASES {
        s = s.replace(a, b);
    }
    for (a, b) in PRECOMPOSED {
        s = s.replace(a, b);
    }
    s = s.replace(['\u{35C}', '\u{361}'], ""); // tie bars
    let s: Vec<char> = s.chars().collect();
    let mut out: Vec<Segment> = Vec::new();
    let mut stress = 0u8;
    let mut i = 0;
    let known = known();
    while i < s.len() {
        let ch = s[i];
        if ch == 'ˈ' || ch == '\'' {
            stress = 1;
            i += 1;
            continue;
        }
        if ch == 'ˌ' {
            stress = 2;
            i += 1;
            continue;
        }
        if ch == ' ' || ch == '.' || ch == '|' || ch == ',' {
            if let Some(last) = out.last_mut() {
                last.word_end = Some(true);
            }
            if ch == ',' || ch == '|' {
                out.push(Segment { ipa: "_".into(), dur: Some(0.16), ..Default::default() });
            }
            i += 1;
            continue;
        }
        // aspiration marks: ʰ aspirated, ˭ unaspirated (the front end's call; see Segment::aspirated)
        if ch == 'ʰ' || ch == '˭' {
            if let Some(last) = out.last_mut() {
                last.aspirated = Some(ch == 'ʰ');
            }
            i += 1;
            continue;
        }
        // palatalization, on a consonant made with a mouth gesture (not a glottal one)
        if ch == 'ʲ' {
            match out.last_mut().filter(|l| consonant(&l.ipa).is_some_and(|c| c.manner != Manner::Glottal)) {
                Some(last) => last.palatalized = Some(true),
                None => gaps.ignore(out.last(), ch),
            }
            i += 1;
            continue;
        }
        // a breathy-voiced release, on a voiced stop or affricate (Hindi bʱ dʱ gʱ)
        if ch == 'ʱ' {
            match out.last_mut().filter(|l| consonant(&l.ipa).is_some_and(|c| c.voicing == Voicing::Voiced && matches!(c.manner, Manner::Stop | Manner::Affricate))) {
                Some(last) => last.breathy = Some(true),
                None => gaps.ignore(out.last(), ch),
            }
            i += 1;
            continue;
        }
        // a vowel mark after the length mark instead of the vowel (ɛː̃)
        if (ch == NASALIZED || ch == BREATHY) && i > 0 && (s[i - 1] == 'ː' || s[i - 1] == ':') {
            match out.last_mut().filter(|l| is_vowel_token(&l.ipa)) {
                Some(last) if ch == NASALIZED => last.nasalized = Some(true),
                Some(last) => last.breathy = Some(true),
                None => gaps.ignore(out.last(), ch),
            }
            i += 1;
            continue;
        }
        if ch == 'ː' || ch == ':' {
            if let Some(last) = out.last_mut() {
                let first = last.ipa.chars().next();
                last.dur = Some(last.dur.unwrap_or(if first.is_some_and(|c| VOWEL_CHARS.contains(c)) { 0.15 } else { 0.09 }) * 1.7);
            }
            i += 1;
            continue;
        }
        // a syllabic or non-syllabic mark with no sound before it to sit on (the start, after a space
        // or a length mark): dropped, as it always was, but not reported either
        if ch == NONSYLLABIC || ch == SYLLABIC {
            i += 1;
            continue;
        }
        let mut tok = String::new();
        for m in MULTI {
            if starts_with_at(&s, i, m) {
                tok = m.to_string();
            }
        }
        if tok.is_empty() {
            tok = ch.to_string();
        }
        i += tok.chars().count();
        // combining diacritics: the tilde and the diaeresis below on a vowel are read, the rest we
        // do not model
        let marks_from = i;
        let (mut nasalized, mut breathy) = (false, false);
        while i < s.len() && ('\u{300}'..='\u{36F}').contains(&s[i]) {
            nasalized |= s[i] == NASALIZED;
            breathy |= s[i] == BREATHY;
            i += 1;
        }
        if !known.contains(tok.as_str()) {
            // whitespace and the delimiters IPA is written between (/phonemic/, [phonetic]) are structure
            if !tok.chars().all(|c| c.is_whitespace() || matches!(c, '/' | '[' | ']')) {
                add(&mut gaps.unknown, shown(&tok));
            }
            continue;
        }
        let is_v = is_vowel_token(&tok);
        // what is left unread: any mark but a tilde or diaeresis below on a vowel, and the
        // syllabic and non-syllabic marks on any letter (never reported)
        let unread: String = s[marks_from..i].iter().copied().filter(|c| !(is_v && (*c == NASALIZED || *c == BREATHY)) && *c != NONSYLLABIC && *c != SYLLABIC).collect();
        if !unread.is_empty() {
            add(&mut gaps.marked, format!("{tok}{unread}"));
        }
        out.push(Segment { ipa: tok, stress: Some(if is_v { stress } else { 0 }), nasalized: (is_v && nasalized).then_some(true), breathy: (is_v && breathy).then_some(true), ..Default::default() });
        if is_v {
            stress = 0;
        }
    }
    out
}

fn consonant(ipa: &str) -> Option<&'static PhonemeDef> {
    super::inventory::consonants().iter().find(|c| c.ipa == ipa)
}

fn is_vowel_token(tok: &str) -> bool {
    tok.chars().next().is_some_and(|c| VOWEL_CHARS.contains(c)) && !super::inventory::consonant_symbols().contains(&tok)
}

fn starts_with_at(s: &[char], i: usize, m: &str) -> bool {
    m.chars().enumerate().all(|(k, c)| s.get(i + k) == Some(&c))
}

// ---------------------------------------------------------------- NFC
// `String.prototype.normalize("NFC")` without a Unicode crate: canonical decomposition of the code
// points NFC rewrites on their own, canonical ordering, canonical composition. The tables
// (`tools/gen-ipa-nfc.ts`, from the JS engine's ICU) hold every combining class but only the
// compositions whose first character the tokenizer can emit; any other starter is dropped by the
// tokenizer whether it composes or not, so the tokens come out as the TypeScript engine's did.

#[derive(Deserialize)]
struct NfcData {
    ccc: Vec<(u32, u32, u8)>,
    decomp: Vec<(u32, Vec<u32>)>,
    comp: Vec<(u32, u32, u32)>,
}

struct NfcTables {
    /// (first, last, rank) ranges, sorted
    ccc: Vec<(u32, u32, u8)>,
    decomp: HashMap<char, Vec<char>>,
    comp: HashMap<(char, char), char>,
}

fn nfc_tables() -> &'static NfcTables {
    static T: OnceLock<NfcTables> = OnceLock::new();
    T.get_or_init(|| {
        let d: NfcData = serde_json::from_str(include_str!("ipaNfc.generated.json")).expect("ipaNfc.generated.json");
        let ch = |u: u32| char::from_u32(u).expect("code point");
        NfcTables {
            ccc: d.ccc,
            decomp: d.decomp.into_iter().map(|(c, v)| (ch(c), v.into_iter().map(ch).collect())).collect(),
            comp: d.comp.into_iter().map(|(a, b, c)| ((ch(a), ch(b)), ch(c))).collect(),
        }
    })
}

impl NfcTables {
    /// canonical-ordering rank (0 for a starter)
    fn rank(&self, c: char) -> u8 {
        let u = c as u32;
        match self.ccc.binary_search_by(|&(a, b, _)| if b < u { std::cmp::Ordering::Less } else if a > u { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal }) {
            Ok(k) => self.ccc[k].2,
            Err(_) => 0,
        }
    }
}

fn nfc(input: &str) -> String {
    let t = nfc_tables();
    let mut cps: Vec<char> = Vec::with_capacity(input.len());
    for c in input.chars() {
        match t.decomp.get(&c) {
            Some(d) => cps.extend(d),
            None => cps.push(c),
        }
    }
    // canonical ordering: each run of non-starters, stably by class
    let mut i = 0;
    while i < cps.len() {
        if t.rank(cps[i]) == 0 {
            i += 1;
            continue;
        }
        let start = i;
        while i < cps.len() && t.rank(cps[i]) != 0 {
            i += 1;
        }
        cps[start..i].sort_by_key(|&c| t.rank(c));
    }
    // canonical composition
    let mut out: Vec<char> = Vec::with_capacity(cps.len());
    let mut starter: Option<usize> = None;
    let mut last: Option<u8> = None;
    for c in cps {
        let r = t.rank(c);
        if let Some(si) = starter
            && last.is_none_or(|l| l < r)
            && let Some(&composed) = t.comp.get(&(out[si], c))
        {
            out[si] = composed;
            continue;
        }
        if r == 0 {
            starter = Some(out.len());
            last = None;
        } else {
            last = Some(r);
        }
        out.push(c);
    }
    out.into_iter().collect()
}
