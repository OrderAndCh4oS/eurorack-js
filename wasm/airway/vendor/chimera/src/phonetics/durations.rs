//! Segment durations by the Klatt (1979) / MITalk rules (Allen, Hunnicutt & Klatt 1987, ch. 9):
//!   DUR = MIN + (INH − MIN) · PRCNT
//! with PRCNT the product of context factors: phrase-final lengthening, non-final shortening,
//! non-word-final and polysyllabic shortening, unstressed shortening (MIN halved), the vowel
//! length cue of the following consonant (bat/bad), cluster shortening, and aspiration.
//! Inherent / minimum durations (ms) per phoneme follow Klatt's table.

use super::Segment;
use super::inventory::Manner;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Klatt's inherent / minimum durations (ms).
fn table(ipa: &str) -> Option<(f64, f64)> {
    Some(match ipa {
        // vowels
        "i" => (155.0, 55.0),
        "ɪ" => (135.0, 40.0),
        "e" => (190.0, 70.0),
        "eɪ" => (190.0, 70.0),
        "ɛ" => (150.0, 70.0),
        "æ" => (230.0, 80.0),
        "a" => (230.0, 80.0),
        "ɑ" => (240.0, 100.0),
        "ɒ" => (240.0, 100.0),
        "ɔ" => (240.0, 100.0),
        "o" => (220.0, 80.0),
        "oʊ" => (220.0, 80.0),
        "ʊ" => (160.0, 60.0),
        "u" => (210.0, 70.0),
        "ʌ" => (140.0, 60.0),
        "ə" => (120.0, 60.0),
        "ɚ" => (180.0, 80.0),
        "ɝ" => (180.0, 80.0),
        "aɪ" => (250.0, 150.0),
        "aʊ" => (240.0, 100.0),
        "ɔɪ" => (280.0, 150.0),
        "ɨ" => (110.0, 40.0),
        // consonants
        "p" => (85.0, 50.0),
        "t" => (75.0, 50.0),
        "k" => (80.0, 60.0),
        "b" => (85.0, 60.0),
        "d" => (75.0, 50.0),
        "g" => (80.0, 60.0),
        "ʔ" => (40.0, 30.0),
        "tʃ" => (70.0, 50.0),
        "dʒ" => (50.0, 30.0),
        "f" => (100.0, 80.0),
        "v" => (60.0, 40.0),
        "θ" => (90.0, 60.0),
        "ð" => (50.0, 30.0),
        "s" => (105.0, 60.0),
        "z" => (75.0, 40.0),
        "ʃ" => (105.0, 80.0),
        "ʒ" => (70.0, 40.0),
        "h" => (80.0, 20.0),
        "m" => (70.0, 60.0),
        "n" => (60.0, 50.0),
        "ŋ" => (95.0, 45.0),
        "l" => (80.0, 40.0),
        "ɫ" => (80.0, 40.0),
        "ɹ" => (80.0, 30.0),
        "w" => (80.0, 60.0),
        "j" => (80.0, 40.0),
        "ɾ" => (20.0, 20.0),
        _ => return None,
    })
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegInfo {
    pub vowel: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manner: Option<Manner>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voiced: Option<bool>,
    /// fallback inherent duration (s) for phonemes outside the table
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dur: Option<f64>,
}

/// Durations (s) for one phrase of segments (explicit `dur` values are kept).
pub fn klatt_durations(segs: &[Segment], info: impl Fn(&Segment) -> SegInfo) -> Vec<f64> {
    let n = segs.len();
    let inf: Vec<SegInfo> = segs.iter().map(info).collect();
    // words: index ranges split after wordEnd
    let mut word = vec![0usize; n];
    let mut word_start: Vec<usize> = Vec::new();
    for i in 0..n {
        if i == 0 || segs[i - 1].word_end == Some(true) {
            word_start.push(i);
        }
        word[i] = word_start.len() - 1;
    }
    let mut vowels_in_word: BTreeMap<usize, usize> = BTreeMap::new();
    for i in 0..n {
        if inf[i].vowel {
            *vowels_in_word.entry(word[i]).or_insert(0) += 1;
        }
    }
    let mut last_vowel: isize = -1;
    for i in 0..n {
        if inf[i].vowel {
            last_vowel = i as isize;
        }
    }

    segs.iter()
        .enumerate()
        .map(|(i, s)| {
            if let Some(d) = s.dur {
                return d;
            }
            let fallback = inf[i].dur.unwrap_or(0.08);
            let (inh0, min0) = table(&s.ipa).unwrap_or((1000.0 * fallback, 600.0 * fallback));
            let (inh, mut min, mut p) = (inh0, min0, 1.0f64);
            if inf[i].vowel {
                let stress = s.stress.unwrap_or(0);
                let final_syl = i as isize == last_vowel;
                let mut word_final_syl = true;
                let mut k = i + 1;
                while k < n && word[k] == word[i] {
                    if inf[k].vowel {
                        word_final_syl = false;
                    }
                    k += 1;
                }
                if final_syl {
                    p *= 1.4; // clause-final lengthening
                } else {
                    p *= 0.6; // non-phrase-final shortening
                }
                if !word_final_syl {
                    p *= 0.85; // non-word-final shortening
                }
                if vowels_in_word.get(&word[i]).copied().unwrap_or(1) > 1 {
                    p *= 0.8; // polysyllabic shortening
                }
                if stress == 0 {
                    min *= 0.5; // unstressed: minimum halved, shortened
                    p *= 0.7;
                }
                // the following consonant (same word): voiced fricatives lengthen, voiceless stops shorten
                let nx = if i + 1 < n && word[i + 1] == word[i] && !inf[i + 1].vowel { Some(inf[i + 1]) } else { None };
                if let Some(nx) = nx {
                    let voiced = nx.voiced == Some(true);
                    let mut f = 1.0;
                    if nx.manner == Some(Manner::Fricative) {
                        f = if voiced { 1.6 } else { 1.0 };
                    } else if nx.manner == Some(Manner::Stop) || nx.manner == Some(Manner::Affricate) {
                        f = if voiced { 1.2 } else { 0.7 };
                    } else if nx.manner == Some(Manner::Nasal) {
                        f = 0.85;
                    }
                    p *= if final_syl { f } else { 0.7 + 0.3 * f };
                }
                // vowel next to vowel
                if i + 1 < n && inf[i + 1].vowel {
                    p *= 1.2;
                }
                if i > 0 && inf[i - 1].vowel {
                    p *= 0.7;
                }
                let mut d = min + (inh - min) * p;
                // aspiration after a voiceless stop eats into a stressed vowel's onset: give it back
                let pv = if i > 0 { Some(inf[i - 1]) } else { None };
                if stress > 0 && pv.is_some_and(|pv| pv.manner == Some(Manner::Stop) && pv.voiced != Some(true)) {
                    d += 20.0;
                }
                return d / 1000.0;
            }
            // consonants
            let word_initial = i == word_start[word[i]];
            if i as isize > last_vowel && matches!(inf[i].manner, Some(Manner::Nasal | Manner::Lateral | Manner::Approximant)) {
                p *= 1.4;
            }
            if !word_initial {
                p *= 0.85;
            }
            let prev_c = i > 0 && !inf[i - 1].vowel;
            let next_c = i + 1 < n && !inf[i + 1].vowel;
            if prev_c && next_c {
                p *= 0.5;
            } else if prev_c || next_c {
                p *= 0.7;
            }
            (min + (inh - min) * p) / 1000.0
        })
        .collect()
}
