//! English text → phoneme segments: CMUdict (ARPAbet with stress) when loaded, letter-to-sound
//! rules otherwise; American flapping and dark /l/; numbers spelled out; punctuation → phrase
//! breaks and intonation.

use super::syllables::WordSource;
use super::{Intonation, Segment};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn arpa(base: &str) -> Option<&'static str> {
    Some(match base {
        "AA" => "ɑ",
        "AE" => "æ",
        "AH" => "ʌ",
        "AO" => "ɔ",
        "AW" => "aʊ",
        "AY" => "aɪ",
        "EH" => "ɛ",
        "ER" => "ɝ",
        "EY" => "eɪ",
        "IH" => "ɪ",
        "IY" => "i",
        "OW" => "oʊ",
        "OY" => "ɔɪ",
        "UH" => "ʊ",
        "UW" => "u",
        "B" => "b",
        "CH" => "tʃ",
        "D" => "d",
        "DH" => "ð",
        "F" => "f",
        "G" => "g",
        "HH" => "h",
        "JH" => "dʒ",
        "K" => "k",
        "L" => "l",
        "M" => "m",
        "N" => "n",
        "NG" => "ŋ",
        "P" => "p",
        "R" => "ɹ",
        "S" => "s",
        "SH" => "ʃ",
        "T" => "t",
        "TH" => "θ",
        "V" => "v",
        "W" => "w",
        "Y" => "j",
        "Z" => "z",
        "ZH" => "ʒ",
        _ => return None,
    })
}
const VOWELS: [&str; 17] = ["ɑ", "æ", "ʌ", "ə", "ɔ", "aʊ", "aɪ", "ɛ", "ɝ", "ɚ", "eɪ", "ɪ", "i", "oʊ", "ɔɪ", "ʊ", "u"];
fn is_vowel(ipa: &str) -> bool {
    VOWELS.contains(&ipa)
}
/// The dictionary keeps one pronunciation per word; for these homographs it kept the rarer one
/// (the verb "wind", past-tense "read"). Telling them apart needs grammar; the common reading wins.
fn homograph(w: &str) -> Option<&'static str> {
    Some(match w {
        "wind" => "W IH1 N D",
        "read" => "R IY1 D",
        "live" => "L IH1 V",
        "lead" => "L IY1 D",
        "close" => "K L OW1 Z",
        "wound" => "W UW1 N D",
        _ => return None,
    })
}

/// monosyllabic function words are unstressed in running speech (and reduce)
const FUNCTION_WORDS: &str = "a an the of to in on at by for from with as and or but nor so if is am are was were be been do does did has have had will would can could should shall may might must it its i you he she we they me him her us them my your his our their this that than then there not no";
fn is_function_word(w: &str) -> bool {
    FUNCTION_WORDS.split(' ').any(|f| f == w)
}
fn reduce_vowel(ipa: &str) -> Option<&'static str> {
    Some(match ipa {
        "ʌ" | "æ" | "ɑ" | "ɛ" | "ɔ" | "u" | "ʊ" => "ə",
        _ => return None,
    })
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phrase {
    pub segments: Vec<Segment>,
    pub intonation: Intonation,
    /// pause after the phrase (s)
    pub pause: f64,
    /// the words said, one per word end in `segments`
    pub words: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct EnglishG2P {
    dict: Option<HashMap<String, String>>,
}

/// JS `\s` (and what `String.prototype.trim` removes).
pub(crate) fn js_is_space(c: char) -> bool {
    matches!(c, '\t' | '\n' | '\u{B}' | '\u{C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}')
}

fn is_phrase_punct(c: char) -> bool {
    matches!(c, '.' | '!' | '?' | ';' | ':' | ',')
}

impl EnglishG2P {
    pub fn new() -> EnglishG2P {
        EnglishG2P::default()
    }

    pub fn is_loaded(&self) -> bool {
        self.dict.is_some()
    }

    /// The dictionary as text ("word\tPHONES" lines, i.e. `public/data/cmudict.txt.gz` gunzipped).
    pub fn load_dict(&mut self, text: &str) {
        let mut m = HashMap::new();
        for line in text.split('\n') {
            if let Some(tab) = line.find('\t')
                && tab > 0
            {
                m.insert(line[..tab].to_string(), line[tab + 1..].to_string());
            }
        }
        self.dict = Some(m);
    }

    /// Text → phrases of segments.
    pub fn to_phrases(&self, text: &str) -> Vec<Phrase> {
        let mut phrases: Vec<Phrase> = Vec::new();
        let normalized = expand_numbers(&text.replace('’', "'"));
        // split on phrase punctuation, keeping the delimiter
        let parts = split_keeping(&normalized, is_phrase_punct);
        let mut words: Vec<String> = Vec::new();
        let mut flush = |delim: &str, words: &mut Vec<String>| {
            if words.is_empty() {
                return;
            }
            let mut segs: Vec<Segment> = Vec::new();
            // the words said: a token with no sound ("--", a lone apostrophe) is left out, so
            // the n-th word ends at the n-th word end
            let mut said: Vec<String> = Vec::new();
            for w in words.iter() {
                let mut ws = self.word(w, true);
                let Some(last) = ws.last_mut() else { continue };
                last.word_end = Some(true);
                segs.append(&mut ws);
                said.push(w.clone());
            }
            apply_allophones(&mut segs);
            let q = delim.contains('?');
            let pause = if delim.contains(['.', '!', '?']) {
                0.35
            } else if !delim.is_empty() {
                0.18
            } else {
                0.3
            };
            words.clear();
            if !segs.is_empty() {
                phrases.push(Phrase { segments: segs, intonation: if q { Intonation::Question } else { Intonation::Statement }, pause, words: said });
            }
        };
        for part in &parts {
            if !part.is_empty() && part.chars().all(is_phrase_punct) {
                flush(part, &mut words);
            } else {
                let lower = part.to_lowercase();
                words.extend(lower.split(|c: char| !(c.is_ascii_lowercase() || c == '\'' || c == '-')).filter(|w| !w.is_empty()).map(str::to_string));
            }
        }
        flush("", &mut words);
        phrases
    }

    /// One word → segments with lexical stress. `reduce`: weak forms of function words (speech).
    pub fn word(&self, w: &str, reduce: bool) -> Vec<Segment> {
        let lower = w.to_lowercase();
        let clean = lower.trim_matches('\'');
        let entry = homograph(clean).or_else(|| self.dict.as_ref().and_then(|d| d.get(clean)).map(String::as_str));
        if let Some(entry) = entry.filter(|e| !e.is_empty()) {
            let mut segs = arpabet_to_segments(entry);
            if reduce && is_function_word(clean) {
                let nv = segs.iter().filter(|s| is_vowel(&s.ipa)).count();
                for s in segs.iter_mut() {
                    s.stress = Some(0);
                    // short function words reduce toward schwa ("of" → əv, "and" → ənd), except /i ɪ eɪ aɪ oʊ/
                    if nv == 1
                        && let Some(r) = reduce_vowel(&s.ipa)
                        && !["you", "do", "to", "who", "not", "no"].contains(&clean)
                    {
                        s.ipa = r.to_string();
                    }
                }
            }
            return segs;
        }
        // hyphenated compounds
        if clean.contains('-') {
            return clean.split('-').flat_map(|p| self.word(p, reduce)).collect();
        }
        letter_to_sound(clean)
    }
}

impl WordSource for EnglishG2P {
    fn word(&self, w: &str, reduce: bool) -> Vec<Segment> {
        EnglishG2P::word(self, w, reduce)
    }
}

/// `s.split(/(<class>+)/)`: the pieces between runs of delimiter characters, with the runs.
fn split_keeping(s: &str, delim: fn(char) -> bool) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if !delim(c) {
            cur.push(c);
            continue;
        }
        out.push(std::mem::take(&mut cur));
        let mut run = String::from(c);
        while let Some(&n) = chars.peek()
            && delim(n)
        {
            run.push(n);
            chars.next();
        }
        out.push(run);
    }
    out.push(cur);
    out
}

pub fn arpabet_to_segments(phones: &str) -> Vec<Segment> {
    let mut out = Vec::new();
    // phones.trim().split(/\s+/): the empty pieces (only ever "" for a blank string) match nothing
    for ph in phones.split(js_is_space).filter(|p| !p.is_empty()) {
        // ^([A-Z]+)([012])?$
        let (base, digit) = match ph.as_bytes().last() {
            Some(d @ (b'0' | b'1' | b'2')) => (&ph[..ph.len() - 1], Some(*d)),
            _ => (ph, None),
        };
        if base.is_empty() || !base.bytes().all(|b| b.is_ascii_uppercase()) {
            continue;
        }
        let stress = match digit {
            Some(b'1') => 1,
            Some(b'2') => 2,
            _ => 0,
        };
        let Some(mut ipa) = arpa(base) else { continue };
        if base == "AH" && stress == 0 {
            ipa = "ə";
        }
        if base == "ER" && stress == 0 {
            ipa = "ɚ";
        }
        out.push(Segment { ipa: ipa.to_string(), stress: Some(if is_vowel(ipa) { stress } else { 0 }), ..Default::default() });
    }
    out
}

/// American English allophones: flapping and velarised coda /l/ (in place).
fn apply_allophones(segs: &mut [Segment]) {
    for i in 1..segs.len().saturating_sub(1) {
        let (prev, next) = (&segs[i - 1], &segs[i + 1]);
        let pv = is_vowel(&prev.ipa) || prev.ipa == "ɹ";
        let nv = is_vowel(&next.ipa);
        let (next_stressed, prev_word_end) = (next.stress.is_some_and(|s| s != 0), prev.word_end == Some(true));
        let s = &mut segs[i];
        // /t d/ between a vowel and an unstressed vowel → tap ("water", "ladder", "got it"), but not
        // at the start of a word ("were disputing" keeps its /d/)
        if (s.ipa == "t" || s.ipa == "d") && pv && nv && !next_stressed && !prev_word_end {
            s.ipa = "ɾ".into();
        }
    }
    for i in 0..segs.len() {
        if segs[i].ipa != "l" {
            continue;
        }
        let next_vowel = segs.get(i + 1).is_some_and(|n| is_vowel(&n.ipa));
        // coda /l/ (before a consonant, pause, or word end) is velarised
        if !next_vowel || segs[i].word_end == Some(true) {
            segs[i].ipa = "ɫ".into();
        }
    }
}

// ---------------------------------------------------------------- numbers
const ONES: [&str; 20] = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS: [&str; 10] = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
fn number_words(n: f64) -> String {
    if n < 20.0 {
        return ONES[n as usize].to_string();
    }
    if n < 100.0 {
        return TENS[(n / 10.0).floor() as usize].to_string() + &(if n % 10.0 != 0.0 { " ".to_string() + ONES[(n % 10.0) as usize] } else { String::new() });
    }
    if n < 1000.0 {
        return ONES[(n / 100.0).floor() as usize].to_string() + " hundred" + &(if n % 100.0 != 0.0 { " ".to_string() + &number_words(n % 100.0) } else { String::new() });
    }
    if n < 1e6 {
        return number_words((n / 1000.0).floor()) + " thousand" + &(if n % 1000.0 != 0.0 { " ".to_string() + &number_words(n % 1000.0) } else { String::new() });
    }
    // n.toString().split("").map((d) => ONES[+d]).join(" "): non-digits (an exponent, "Infinity") give ""
    js_integer_to_string(n).chars().map(|d| d.to_digit(10).map_or("", |k| ONES[k as usize])).collect::<Vec<_>>().join(" ")
}
/// `Number.prototype.toString` for a non-negative integer-valued double (shortest round-trip
/// digits; exponent form from 1e21).
fn js_integer_to_string(n: f64) -> String {
    if n.is_infinite() {
        return "Infinity".into();
    }
    if n < 1e21 {
        return format!("{n}");
    }
    format!("{n:e}").replacen('e', "e+", 1)
}
fn expand_numbers(t: &str) -> String {
    let mut out = String::with_capacity(t.len());
    let mut digits = String::new();
    let emit = |digits: &mut String, out: &mut String| {
        if !digits.is_empty() {
            // parseInt(d, 10): the correctly rounded double
            let n: f64 = digits.parse().expect("digits");
            out.push(' ');
            out.push_str(&number_words(n));
            out.push(' ');
            digits.clear();
        }
    };
    for c in t.chars() {
        if c.is_ascii_digit() {
            digits.push(c);
        } else {
            emit(&mut digits, &mut out);
            out.push(c);
        }
    }
    emit(&mut digits, &mut out);
    out
}

// ---------------------------------------------------------------- letter-to-sound fallback
/// Compact rule set for words missing from the dictionary. Rules are tried longest-first at each
/// position; context classes: '#' word boundary, 'V' vowel letter, 'C' consonant letter.
/// (pre, grapheme, post, phones)
type Rule = (&'static str, &'static str, &'static str, &'static str);
#[rustfmt::skip]
const RULES: &[Rule] = &[
    ("", "tion", "", "ʃ ə n"), ("", "sion", "", "ʒ ə n"), ("", "ture", "", "tʃ ɚ"), ("", "ough", "#", "oʊ"), ("", "augh", "", "ɔ"),
    ("", "igh", "", "aɪ"), ("", "eigh", "", "eɪ"), ("", "tch", "", "tʃ"), ("", "dge", "", "dʒ"), ("", "sch", "", "s k"),
    ("", "ch", "", "tʃ"), ("", "sh", "", "ʃ"), ("", "th", "", "θ"), ("", "ph", "", "f"), ("", "wh", "", "w"), ("", "ck", "", "k"),
    ("", "ng", "#", "ŋ"), ("", "ng", "", "ŋ g"), ("", "qu", "", "k w"), ("#", "kn", "", "n"), ("#", "wr", "", "ɹ"), ("", "gh", "", ""),
    ("", "ee", "", "i"), ("", "ea", "", "i"), ("", "oo", "", "u"), ("", "ou", "", "aʊ"), ("", "ow", "#", "oʊ"), ("", "ow", "", "aʊ"),
    ("", "oi", "", "ɔɪ"), ("", "oy", "", "ɔɪ"), ("", "ai", "", "eɪ"), ("", "ay", "", "eɪ"), ("", "au", "", "ɔ"), ("", "aw", "", "ɔ"),
    ("", "ie", "#", "aɪ"), ("", "ie", "", "i"), ("", "ei", "", "eɪ"), ("", "ey", "#", "i"), ("", "oa", "", "oʊ"), ("", "ue", "#", "u"),
    ("", "er", "#", "ɚ"), ("", "er", "C", "ɝ"), ("", "ir", "", "ɝ"), ("", "ur", "", "ɝ"), ("", "or", "", "ɔ ɹ"), ("", "ar", "", "ɑ ɹ"),
    ("", "le", "#", "ə ɫ"), ("", "ed", "#", "d"), ("", "es", "#", "z"), ("C", "s", "#", "s"), ("V", "s", "#", "z"), ("", "y", "#", "i"),
    ("#", "y", "", "j"), ("C", "y", "", "aɪ"), ("", "e", "#", ""),
    ("", "a", "CV", "eɪ"), ("", "a", "", "æ"), ("", "e", "", "ɛ"), ("", "i", "CV", "aɪ"), ("", "i", "", "ɪ"), ("", "o", "CV", "oʊ"),
    ("", "o", "", "ɑ"), ("", "u", "CV", "u"), ("", "u", "", "ʌ"), ("", "y", "", "ɪ"),
    ("", "c", "e", "s"), ("", "c", "i", "s"), ("", "c", "y", "s"), ("", "c", "", "k"), ("", "g", "e", "dʒ"), ("", "g", "i", "dʒ"), ("", "g", "", "g"),
    ("", "x", "", "k s"), ("", "j", "", "dʒ"), ("", "q", "", "k"), ("", "b", "", "b"), ("", "d", "", "d"), ("", "f", "", "f"), ("", "h", "", "h"),
    ("", "k", "", "k"), ("", "l", "", "l"), ("", "m", "", "m"), ("", "n", "", "n"), ("", "p", "", "p"), ("", "r", "", "ɹ"), ("", "s", "", "s"),
    ("", "t", "", "t"), ("", "v", "", "v"), ("", "w", "", "w"), ("", "z", "", "z"),
];
// The word is indexed in UTF-16 code units, as the JS string was.
fn is_v(ch: Option<u16>) -> bool {
    ch.is_some_and(|c| "aeiouy".bytes().any(|v| v as u16 == c))
}
fn match_ctx(word: &[u16], i: isize, ctx: &str, dir: isize) -> bool {
    if ctx.is_empty() {
        return true;
    }
    let ctx = ctx.as_bytes();
    let mut pos = i;
    for k in 0..ctx.len() {
        let c = if dir == 1 { ctx[k] } else { ctx[ctx.len() - 1 - k] };
        let ch = if pos >= 0 { word.get(pos as usize).copied() } else { None };
        if c == b'#' {
            if ch.is_some() {
                return false;
            }
        } else if c == b'V' {
            if !is_v(ch) {
                return false;
            }
        } else if c == b'C' {
            if ch.is_none() || is_v(ch) {
                return false;
            }
        } else if ch != Some(c as u16) {
            return false;
        }
        pos += dir;
    }
    true
}
fn starts_with_at(word: &[u16], i: usize, g: &str) -> bool {
    let g = g.as_bytes();
    word.len() >= i + g.len() && word[i..i + g.len()].iter().zip(g).all(|(a, b)| *a == *b as u16)
}
pub fn letter_to_sound(word: &str) -> Vec<Segment> {
    let word: Vec<u16> = word.encode_utf16().collect();
    let mut phones: Vec<&'static str> = Vec::new();
    let mut i = 0usize;
    while i < word.len() {
        let mut done = false;
        for &(pre, g, post, ph) in RULES {
            if !starts_with_at(&word, i, g) {
                continue;
            }
            if !match_ctx(&word, i as isize - 1, pre, -1) {
                continue;
            }
            if !match_ctx(&word, (i + g.len()) as isize, post, 1) {
                continue;
            }
            if !ph.is_empty() {
                phones.extend(ph.split(' '));
            }
            i += g.len();
            done = true;
            break;
        }
        if !done {
            i += 1;
        }
    }
    // stress the first vowel (crude but serviceable)
    let mut stressed = false;
    phones
        .into_iter()
        .map(|ipa| {
            let v = is_vowel(ipa);
            let seg = Segment { ipa: ipa.to_string(), stress: Some(if v && !stressed { 1 } else { 0 }), ..Default::default() };
            if v {
                stressed = true;
            }
            seg
        })
        .collect()
}
