//! Russian spelling → the existing inventory (no new sounds).
//!
//! Stress: a combining acute (молоко́) wins, then ё, then a short table of frequent words, then
//! the first vowel (a guess: mark the stress for anything else). Vowels reduce in speech
//! (`reduce`), not in singing.
//!
//! Approximations: a soft consonant is the plain one plus a 25 ms /j/ glide, not a palatalised
//! articulation; щ is a long /ʃ/ with that glide; р is one tap. Stress and voicing do not cross
//! word boundaries, except that a preposition takes its voicing from the word after it
//! (`word_before`).
use super::inventory::phoneme;
use super::syllables::{is_english_onset, syllabify_with, FrontEnd};
use super::{Segment, Syllable};
use crate::anatomy::human::BodyMix;

pub fn is_letter(c: char) -> bool {
    matches!(c, 'а'..='я' | 'А'..='Я' | 'ё' | 'Ё')
}
pub fn contains_russian(s: &str) -> bool {
    s.chars().any(is_letter)
}
/// false for в, с, к: a word that cannot carry a note
pub fn has_vowel(s: &str) -> bool {
    s.chars().any(|c| c.to_lowercase().any(vowel))
}
fn vowel(c: char) -> bool {
    "аэыоуяеёию".contains(c)
}
fn devoiced(s: &str) -> Option<&'static str> {
    Some(match s { "b" => "p", "d" => "t", "g" => "k", "v" => "f", "z" => "s", "ʐ" => "ʂ", _ => return None })
}
fn voiced(s: &str) -> Option<&'static str> {
    Some(match s { "p" => "b", "t" => "d", "k" => "g", "f" => "v", "s" => "z", "ʂ" => "ʐ", _ => return None })
}

/// Prepositions and the particles не, ни: said as part of the next word, so unstressed, and
/// their last consonant is not word-final.
#[rustfmt::skip]
const PROCLITICS: &[&str] = &[
    "в", "во", "к", "ко", "с", "со", "из", "от", "до", "по", "за", "на", "над", "под", "об", "о", "у",
    "при", "про", "для", "без", "через", "перед", "не", "ни",
];

/// Frequent words whose stress is not on the first vowel: (word, index of the stressed vowel).
#[rustfmt::skip]
const STRESS: &[(&str, usize)] = &[
    ("меня", 1), ("тебя", 1), ("себя", 1), ("тебе", 1), ("себе", 1), ("его", 1), ("ему", 1), ("она", 1), ("оно", 1), ("они", 1),
    ("моя", 1), ("твоя", 1), ("своя", 1), ("мои", 1), ("твои", 1), ("свои", 1), ("один", 1), ("одна", 1), ("одни", 1),
    ("когда", 1), ("тогда", 1), ("всегда", 1), ("куда", 1), ("туда", 1), ("сюда", 1), ("сейчас", 1), ("теперь", 1),
    ("зачем", 1), ("потом", 1), ("опять", 1), ("уже", 1), ("пока", 1), ("привет", 1), ("давай", 1), ("прости", 1),
    ("большой", 1), ("какой", 1), ("такой", 1), ("другой", 1), ("домой", 1), ("назад", 1), ("вокруг", 1),
    ("вода", 1), ("зима", 1), ("весна", 1), ("луна", 1), ("рука", 1), ("нога", 1), ("земля", 1), ("любовь", 1),
    ("хочу", 1), ("могу", 1), ("люблю", 1), ("пою", 1), ("иду", 1), ("сегодня", 1), ("спасибо", 1), ("пожалуйста", 1),
    ("хорошо", 2), ("почему", 2), ("потому", 2), ("никогда", 2), ("человек", 2), ("говорит", 2), ("говорю", 2),
    ("молоко", 2), ("голова", 2), ("далеко", 2), ("высоко", 2),
];

/// Words ending in -ого / -его where г is /g/, not the /v/ of the genitive ending.
const G_STAYS: &[&str] = &["много", "немного", "намного", "строго", "дорого", "недорого", "убого", "ого"];

/// г said /v/: его, сегодня, and the genitive endings -ого / -его (кра́сного, ничего́).
fn g_as_v(clean: &str, i: usize, n: usize) -> bool {
    if clean == "сегодня" || clean.starts_with("сегодняшн") {
        return i == 2;
    }
    i + 2 == n && (clean.ends_with("ого") || clean.ends_with("его")) && !G_STAYS.contains(&clean)
}

/// What follows the word's last sound.
#[derive(Clone, Copy, PartialEq)]
enum After {
    /// a pause or another word: a final obstruent devoices
    Devoice,
    /// a preposition before a voiced obstruent (с горы́ → z)
    Voice,
    /// a preposition before a vowel or sonorant (над ле́сом keeps its d)
    Keep,
}

pub fn word(input: &str, reduce: bool) -> Vec<Segment> {
    word_before(input, None, reduce)
}

/// One word → segments. `next` is the word said after it (speech): a preposition's last
/// consonant assimilates to it. Without it a preposition keeps its spelling's voicing.
pub fn word_before(input: &str, next: Option<&str>, reduce: bool) -> Vec<Segment> {
    if input.contains('-') {
        let parts: Vec<&str> = input.split('-').filter(|p| !p.is_empty()).collect();
        return parts.iter().enumerate().flat_map(|(i, p)| word_before(p, parts.get(i + 1).copied().or(next), reduce)).collect();
    }
    let lower = input.to_lowercase().replace("е\u{308}", "ё").replace("и\u{306}", "й");
    let mut letters = Vec::new();
    let mut explicit = None;
    for c in lower.chars() {
        if c == '\u{301}' {
            if letters.last().copied().is_some_and(vowel) {
                explicit = Some(letters.len() - 1);
            }
        } else if is_letter(c) {
            letters.push(c);
        }
    }
    let n = letters.len();
    let clean: String = letters.iter().collect();
    let clean = clean.as_str();
    let proclitic = PROCLITICS.contains(&clean);
    let positions: Vec<usize> = (0..n).filter(|&i| vowel(letters[i])).collect();
    let listed = || STRESS.iter().find(|(w, _)| *w == clean).and_then(|(_, k)| positions.get(*k).copied());
    let stress = explicit
        .or_else(|| letters.iter().position(|c| *c == 'ё'))
        .or_else(|| if proclitic { None } else { listed().or_else(|| positions.first().copied()) });

    let mut out: Vec<Segment> = Vec::new();
    let mut long = false;
    let mut i = 0;
    while i < n {
        let at = i;
        let mut c = letters[i];
        let prev = i.checked_sub(1).map(|p| letters[p]);
        let rest = &letters[i..];
        i += 1;
        if vowel(c) {
            let iotated = ("яеёю".contains(c) && prev.is_none_or(|p| vowel(p) || "ьъ".contains(p))) || ("ио".contains(c) && prev == Some('ь'));
            if iotated {
                out.push(Segment::new("j"));
            }
            let stressed = stress == Some(at);
            let weak = reduce && !stressed;
            let last = at + 1 == n;
            let hard_hiss = prev.is_some_and(|p| "жшц".contains(p));
            let ipa = match c {
                'а' if weak && !last && prev.is_some_and(|p| "чщ".contains(p)) => "ɪ",
                'а' | 'о' if weak => "ɐ",
                'я' if weak => if last { "ɐ" } else { "ɪ" },
                'е' if weak => if hard_hiss { "ɨ" } else { "ɪ" },
                'э' if weak => "ɪ",
                'а' | 'я' => "a", 'о' | 'ё' => "o", 'у' | 'ю' => "u",
                'и' if hard_hiss => "ɨ", 'и' => "i", 'ы' => "ɨ", 'э' | 'е' => "e", _ => unreachable!(),
            };
            let mut seg = Segment { stress: Some(u8::from(stressed)), ..Segment::new(ipa) };
            if weak {
                // The duration rules are English's (Klatt), and have no /ɐ/: an unstressed
                // vowel came out at 40–50 ms and the syllable was swallowed. Most Russian
                // syllables are unstressed, so they get Russian lengths: the one before the
                // stress is the longest, an open final one is longer again at a phrase's end.
                let k = positions.iter().position(|&p| p == at).unwrap_or(0);
                let pretonic = stress.is_some() && positions.get(k + 1).copied() == stress;
                seg.dur = Some(if last && next.is_none() {
                    0.12
                } else if last || pretonic {
                    0.09
                } else {
                    0.07
                });
            } else if reduce && ipa == "ɨ" {
                // The table's /ɨ/ is English's reduced vowel (roses), 110 ms: a stressed ы came
                // out half as long as у, and "дым" was heard as "дум"
                seg.dur = Some(if next.is_none() && positions.last() == Some(&at) { 0.19 } else { 0.12 });
            }
            out.push(seg);
            continue;
        }
        // -тся, -ться: a long /ts/ and an unstressed vowel
        if rest == ['т', 'с', 'я'] || rest == ['т', 'ь', 'с', 'я'] {
            out.push(lengthened("ts"));
            let dur = reduce.then_some(if next.is_none() { 0.12 } else { 0.09 });
            out.push(Segment { stress: Some(0), dur, ..Segment::new(if reduce { "ɐ" } else { "a" }) });
            break;
        }
        // a doubled letter is one consonant, long between vowels (ва́нна), plain otherwise (ру́сский)
        if rest.get(1) == Some(&c) && "ьъй".find(c).is_none() {
            long = true;
            continue;
        }
        // silent letters: стн (гру́стный), стл (счастли́вый), здн (по́здно), рдц (се́рдце),
        // лнц (со́лнце), вств (чу́вство)
        let silent = match c {
            'т' => prev == Some('с') && matches!(rest.get(1), Some('н' | 'л')),
            'д' => matches!((prev, rest.get(1)), (Some('з'), Some('н')) | (Some('р'), Some('ц'))),
            'л' => rest.starts_with(&['л', 'н', 'ц']),
            'в' => rest.starts_with(&['в', 'с', 'т', 'в']),
            _ => false,
        };
        if silent {
            continue;
        }
        // сч, зч, жч are щ (сча́стье, мужчи́на)
        if "сзж".contains(c) && rest.get(1) == Some(&'ч') {
            c = 'щ';
            i += 1;
        }
        let next_c = letters.get(i).copied();
        // ч is /ʂ/ in что and a few -чн- words
        let ch_as_sh = c == 'ч'
            && ((next_c == Some('т') && matches!(clean, "что" | "чтобы" | "чтоб" | "ничто"))
                || (next_c == Some('н') && matches!(clean, "конечно" | "скучно" | "нарочно")));
        let ipa = match c {
            'г' if g_as_v(clean, at, n) => "v",
            'ч' if ch_as_sh => "ʂ",
            'б' => "b", 'п' => "p", 'в' => "v", 'ф' => "f", 'г' => "g", 'к' => "k",
            'д' => "d", 'т' => "t", 'з' => "z", 'с' => "s", 'ж' => "ʐ", 'ш' => "ʂ",
            'х' => "x", 'ц' => "ts", 'ч' => "tʃ", 'щ' => "ʃ", 'м' => "m", 'н' => "n",
            // р is one tap. The trill held the tip near the ridge for ~100 ms and the voicing
            // all but stopped, so "рыба" was heard as "дыба".
            'л' => "ɫ", 'р' => "ɾ", 'й' => "j", _ => continue, // ь, ъ
        };
        let soft = !ch_as_sh && ("чщ".contains(c) || (!"жшцй".contains(c) && next_c.is_some_and(|x| "яеёиюь".contains(x))));
        let ipa = if c == 'л' && soft { "l" } else { ipa };
        let mut seg = if long && next_c.is_some_and(vowel) { lengthened(ipa) } else { Segment::new(ipa) };
        long = false;
        if c == 'щ' {
            seg.dur = Some(0.18);
        }
        out.push(seg);
        // a timed glide keeps softness audible without adding a vowel (a sung syllable)
        if soft {
            out.push(Segment { dur: Some(0.025), ..Segment::new("j") });
        }
    }

    // Voicing spreads backwards from an obstruent through the cluster before it (в does not
    // start it: твой keeps its t). The end of the word devoices, unless it's a preposition.
    let after = if !proclitic {
        After::Devoice
    } else {
        match next.and_then(|w| w.chars().find(|c| is_letter(*c))).and_then(|c| c.to_lowercase().next()) {
            Some(c) if "пткфсшхцчщ".contains(c) => After::Devoice,
            Some(c) if "бдгзж".contains(c) => After::Voice,
            _ => After::Keep,
        }
    };
    for i in (0..out.len()).rev() {
        // the softness glide between two consonants doesn't block assimilation
        let next = out[i + 1..].iter().find(|s| s.ipa != "j").map(|s| s.ipa.as_str());
        let replacement = match next {
            None if after == After::Keep => None,
            None if after == After::Voice => voiced(&out[i].ipa),
            None | Some("p" | "t" | "k" | "f" | "s" | "ʂ" | "ʃ" | "x" | "ts" | "tʃ") => devoiced(&out[i].ipa),
            Some("b" | "d" | "g" | "z" | "ʐ") => voiced(&out[i].ipa),
            _ => None,
        };
        if let Some(s) = replacement {
            out[i].ipa = s.to_owned();
        }
    }
    out
}

/// A consonant held half again as long as usual.
fn lengthened(ipa: &str) -> Segment {
    Segment { dur: phoneme(ipa, BodyMix::MALE).map(|p| p.dur * 1.5), ..Segment::new(ipa) }
}

/// Onsets for the lyric syllabifier. Russian singing keeps syllables open, so the next syllable
/// takes the whole cluster (я-бло-ко, мо-сква́), except that a leading sonorant stays with the
/// vowel before it (се́р-дце, вой-ска́). A /j/ after a consonant (its softness glide, or the /j/
/// after ь in се-мья́) goes with that consonant.
pub fn is_onset(cluster: &[Segment]) -> bool {
    let first = cluster.first().map(|s| s.ipa.as_str());
    let consonants = cluster.iter().enumerate().filter(|(i, s)| *i == 0 || s.ipa != "j").count();
    consonants == 1 || first.is_some_and(|c| !["ɾ", "ɫ", "l", "n", "m", "j"].contains(&c))
}

/// Split a written word into n chunks, each ending after a vowel (and its stress mark).
pub fn split_spelling(word: &str, n: usize) -> Vec<String> {
    if n <= 1 {
        return vec![word.to_owned()];
    }
    let chars: Vec<char> = word.chars().collect();
    let vowels: Vec<usize> = chars.iter().enumerate().filter(|(_, c)| c.to_lowercase().any(vowel)).map(|(i, _)| i).collect();
    if vowels.len() != n {
        let mut out = vec![word.to_owned()];
        out.extend(std::iter::repeat_n("~".to_owned(), n - 1));
        return out;
    }
    let mut cuts = vec![0];
    for &i in vowels.iter().take(n - 1) {
        let mut cut = i + 1;
        while chars.get(cut).is_some_and(|c| *c == '\u{301}') {
            cut += 1;
        }
        // a sonorant before another consonant stays on this note, as is_onset leaves it (се́р-дце,
        // вой-ска́, бо́ль-но)
        let lower = |k: usize| chars.get(k).and_then(|c| c.to_lowercase().next());
        if lower(cut).is_some_and(|c| "рлнмй".contains(c)) {
            let soft = usize::from(lower(cut + 1) == Some('ь'));
            if lower(cut + 1 + soft).is_some_and(|c| is_letter(c) && !vowel(c) && !"ьъ".contains(c)) {
                cut += 1 + soft;
            }
        }
        cuts.push(cut);
    }
    cuts.push(chars.len());
    cuts.windows(2).map(|w| chars[w[0]..w[1]].iter().collect()).collect()
}

/// The Russian front end for sung lyrics: Cyrillic words, unreduced (no data needed).
pub struct Russian;

impl FrontEnd for Russian {
    // a stress mark continues a word but never starts one: a lone U+0301 after a Latin word is
    // another front end's (pinyin typed with a separate tone mark, ni + U+0301)
    fn starts(&self, c: char) -> bool {
        is_letter(c)
    }
    fn continues(&self, c: char) -> bool {
        is_letter(c) || c == '\u{301}' || c == '-'
    }
    fn word(&self, word: &str) -> Vec<Syllable> {
        self.word_after(word, None)
    }
    fn word_after(&self, tok: &str, prev: Option<&str>) -> Vec<Syllable> {
        // typed hyphens split syllables explicitly, as in English
        let parts: Vec<&str> = tok.split('-').filter(|p| !p.is_empty()).collect();
        let mut syls: Vec<Syllable> = Vec::new();
        for part in &parts {
            let sy = syllabify_with(&word(&part.to_lowercase(), false), |c| is_english_onset(c) || is_onset(c));
            let spell: Vec<String> = if parts.len() > 1 {
                let mut v = vec![part.to_string()];
                v.extend(std::iter::repeat_n("~".to_string(), sy.len().saturating_sub(1)));
                v
            } else {
                split_spelling(part, sy.len())
            };
            for (i, s) in sy.into_iter().enumerate() {
                syls.push(Syllable { text: spell.get(i).cloned().unwrap_or_else(|| "~".into()), onset: s.onset, nucleus: s.nucleus, coda: s.coda, ..Default::default() });
            }
        }
        // a word with no vowel before this one (в, с, к) has no note of its own (it returned no
        // syllables): it starts this word's first syllable, voiced by this word
        if let (Some(c), Some(first)) = (prev.filter(|p| !has_vowel(p)), syls.first_mut()) {
            let mut onset = word_before(c, parts.first().copied(), false);
            onset.append(&mut first.onset);
            first.onset = onset;
            first.text = format!("{c} {}", first.text);
        }
        syls
    }
}
