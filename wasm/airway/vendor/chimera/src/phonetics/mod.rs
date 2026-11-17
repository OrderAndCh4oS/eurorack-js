//! Phonetics: IPA, English G2P, syllables, durations, the gestural planner, singing, beatbox.
//! These run off the audio thread (they allocate); their output is a [`Plan`] of gestures that a
//! voice plays.

use crate::control::score::Gesture;
use serde::{Deserialize, Serialize};

pub mod beatbox;
pub mod durations;
pub mod english;
pub mod inventory;
pub mod ipa;
pub mod korean;
pub mod planner;
pub mod russian;
pub mod sing;
pub mod songs;
pub mod syllables;
pub mod vowel_data;

/// One phoneme in an utterance.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub ipa: String,
    /// duration override (s)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dur: Option<f64>,
    /// 0 unstressed, 1 primary, 2 secondary
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stress: Option<u8>,
    /// explicit pitch (Hz) for this segment (singing)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub f0: Option<f64>,
    /// word boundary after this segment
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub word_end: Option<bool>,
    /// a voiceless stop or affricate's aspiration, as its front end decides it (Mandarin and Korean
    /// contrast it); None: the planner's default, English's rule (aspirated syllable-initially
    /// before a vowel, not after /s/)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aspirated: Option<bool>,
    /// how long an aspirated stop or affricate aspirates (voice onset time, s), as its front end
    /// decides it (Korean's lax stops aspirate briefly, its aspirated ones long); None: 50 ms
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vot: Option<f64>,
    /// a vowel said with the velum lowered (IPA combining tilde); None or false: oral
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nasalized: Option<bool>,
    /// a consonant made with a second, palatal gesture: the tongue body raised and fronted toward
    /// the palate (IPA ʲ); None or false: plain
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub palatalized: Option<bool>,
    /// breathy voice: a voiced stop or affricate released with the folds apart (IPA ʱ), or a
    /// vowel said with them part-open (IPA combining diaeresis below); None or false: modal
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breathy: Option<bool>,
}

impl Segment {
    pub fn new(ipa: &str) -> Segment {
        Segment { ipa: ipa.to_string(), ..Default::default() }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Intonation {
    /// final fall
    #[default]
    Statement,
    /// final rise
    Question,
    Flat,
}

/// A segment as the planner timed it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedSegment {
    pub ipa: String,
    pub t0: f64,
    pub t1: f64,
    /// lexical stress of vowels (0 unstressed, 1 primary, 2 secondary)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stress: Option<u8>,
    pub kind: String,
}

/// Gestures for a voice plus the timeline they realise (times relative to the plan's t0 origin).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub gestures: Vec<Gesture>,
    pub segments: Vec<PlannedSegment>,
    pub end: f64,
}

/// A sung syllable.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Syllable {
    /// lyric text shown on the note
    pub text: String,
    pub onset: Vec<Segment>,
    /// vowel (a diphthong stays one nucleus: "aɪ")
    pub nucleus: Segment,
    pub coda: Vec<Segment>,
    /// continue the previous syllable's vowel at a new pitch
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub melisma: Option<bool>,
    /// last syllable of a word (codas sound here; phrase breaks follow punctuation); may be left
    /// out of hand-written JSON (false)
    #[serde(default)]
    pub word_end: bool,
    /// a breath follows (comma, full stop, line break); may be left out (false)
    #[serde(default)]
    pub phrase_end: bool,
}
