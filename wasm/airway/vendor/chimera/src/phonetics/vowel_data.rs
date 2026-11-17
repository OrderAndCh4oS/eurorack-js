//! Reference vowel formants (Hz) used to calibrate articulatory vowel targets.
//! English vowels: Hillenbrand, Getty, Clark & Wheeler (1995) means (men / women / children).
//! Other cardinal-ish vowels: typical literature values (men), scaled for women/children.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VowelRef {
    pub ipa: &'static str,
    /// example word / description
    pub example: &'static str,
    pub male: [f64; 3],
    pub female: [f64; 3],
    pub child: [f64; 3],
    pub round: bool,
    /// 0 close … 1 open
    pub height: f64,
    /// 0 front … 1 back
    pub back: f64,
}

const fn scale_ref(m: [f64; 3], k: [f64; 3]) -> [f64; 3] {
    [m[0] * k[0], m[1] * k[1], m[2] * k[2]]
}
const FEM: [f64; 3] = [1.17, 1.2, 1.15];
const CHI: [f64; 3] = [1.3, 1.33, 1.24];

#[allow(clippy::too_many_arguments)]
const fn vref(ipa: &'static str, example: &'static str, male: [f64; 3], female: Option<[f64; 3]>, child: Option<[f64; 3]>, round: bool, height: f64, back: f64) -> VowelRef {
    let female = match female {
        Some(f) => f,
        None => scale_ref(male, FEM),
    };
    let child = match child {
        Some(c) => c,
        None => scale_ref(male, CHI),
    };
    VowelRef { ipa, example, male, female, child, round, height, back }
}

#[rustfmt::skip]
pub static VOWELS: &[VowelRef] = &[
    vref("i", "heed", [342.0, 2322.0, 3000.0], Some([437.0, 2761.0, 3372.0]), Some([452.0, 3081.0, 3702.0]), false, 0.0, 0.0),
    vref("ɪ", "hid", [427.0, 2034.0, 2684.0], Some([483.0, 2365.0, 3053.0]), Some([511.0, 2552.0, 3403.0]), false, 0.2, 0.15),
    vref("e", "hayed", [476.0, 2089.0, 2691.0], Some([536.0, 2530.0, 3047.0]), Some([564.0, 2656.0, 3323.0]), false, 0.3, 0.05),
    vref("ɛ", "head", [580.0, 1799.0, 2605.0], Some([731.0, 2058.0, 2979.0]), Some([749.0, 2267.0, 3310.0]), false, 0.55, 0.1),
    vref("æ", "had", [640.0, 1760.0, 2500.0], Some([669.0, 2349.0, 2972.0]), Some([717.0, 2501.0, 3289.0]), false, 0.8, 0.15),
    vref("a", "front open (Fr. patte)", [780.0, 1450.0, 2550.0], None, None, false, 1.0, 0.35),
    vref("ɑ", "hod", [768.0, 1333.0, 2522.0], Some([936.0, 1551.0, 2815.0]), Some([1002.0, 1688.0, 2950.0]), false, 1.0, 0.85),
    vref("ɒ", "Br. lot", [620.0, 880.0, 2500.0], None, None, true, 0.9, 1.0),
    vref("ɔ", "hawed", [652.0, 997.0, 2538.0], Some([781.0, 1136.0, 2824.0]), Some([803.0, 1210.0, 2982.0]), true, 0.65, 1.0),
    vref("o", "hoed", [497.0, 910.0, 2459.0], Some([555.0, 1035.0, 2828.0]), Some([597.0, 1137.0, 2987.0]), true, 0.35, 1.0),
    vref("ʊ", "hood", [469.0, 1122.0, 2434.0], Some([519.0, 1225.0, 2827.0]), Some([568.0, 1490.0, 3072.0]), true, 0.2, 0.85),
    vref("u", "who'd", [378.0, 997.0, 2343.0], Some([459.0, 1105.0, 2735.0]), Some([494.0, 1345.0, 2988.0]), true, 0.0, 1.0),
    vref("ʌ", "hud", [623.0, 1200.0, 2550.0], Some([753.0, 1426.0, 2933.0]), Some([749.0, 1546.0, 3145.0]), false, 0.6, 0.7),
    vref("ə", "sofa", [500.0, 1450.0, 2450.0], None, None, false, 0.5, 0.5),
    vref("ɐ", "near-open central", [640.0, 1350.0, 2500.0], None, None, false, 0.8, 0.5),
    vref("ɝ", "heard", [474.0, 1379.0, 1710.0], Some([523.0, 1588.0, 1929.0]), Some([586.0, 1719.0, 2143.0]), true, 0.45, 0.5),
    vref("y", "Fr. tu", [300.0, 1800.0, 2150.0], None, None, true, 0.0, 0.0),
    vref("ø", "Fr. peu", [390.0, 1550.0, 2250.0], None, None, true, 0.3, 0.1),
    vref("œ", "Fr. peur", [520.0, 1450.0, 2350.0], None, None, true, 0.55, 0.15),
    vref("ɨ", "close central", [330.0, 1600.0, 2400.0], None, None, false, 0.0, 0.5),
    vref("ɯ", "close back unrounded", [340.0, 1350.0, 2400.0], None, None, false, 0.0, 1.0),
    vref("ɤ", "close-mid back unrounded", [460.0, 1250.0, 2450.0], None, None, false, 0.35, 1.0),
];
