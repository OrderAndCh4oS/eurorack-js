use chimera::anatomy::human::BodyMix;
use chimera::phonetics::english::EnglishG2P;
use chimera::phonetics::planner::{self, PhraseInput, PlanOptions};
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SpeechPlanner { g2p: EnglishG2P }

#[wasm_bindgen]
impl SpeechPlanner {
    #[wasm_bindgen(constructor)]
    pub fn new(dictionary: &str) -> Self {
        planner::init();
        let mut g2p = EnglishG2P::new();
        if !dictionary.is_empty() { g2p.load_dict(dictionary); }
        Self { g2p }
    }
    pub fn plan(&self, text: &str) -> Result<String, JsValue> {
        self.prepare(text).map(|v| v.to_string()).map_err(|e| JsValue::from_str(&e))
    }
}

impl SpeechPlanner {
    pub fn prepare(&self, text: &str) -> Result<Value, String> {
        if text.chars().count() > 240 { return Err("Use at most 240 characters.".into()); }
        if text.chars().any(|c| !c.is_ascii() && c != '’') {
            return Err("Use English letters, numbers and punctuation.".into());
        }
        let text = text.trim();
        let phrases = self.g2p.to_phrases(text);
        if !text.is_empty() && phrases.is_empty() { return Err("Enter some English words or numbers.".into()); }
        let input: Vec<PhraseInput> = phrases.iter().map(|p| PhraseInput {
            segments: p.segments.clone(), intonation: Some(p.intonation), pause: Some(p.pause)
        }).collect();
        let mut bodies = Vec::new();
        for body in [BodyMix::MALE, BodyMix::FEMALE] {
            let mut plan = planner::plan_phrases(&input, &PlanOptions {
                body, f0: Some(110.0), rate: Some(1.0), ..Default::default()
            });
            let shift = -plan.gestures.iter().map(|g| g.t0 - g.ramp_in).fold(0.0_f64, f64::min);
            for g in &mut plan.gestures { g.t0 += shift; g.t1 += shift; }
            plan.gestures.sort_by(|a,b| (a.t0-a.ramp_in).total_cmp(&(b.t0-b.ramp_in)));
            let duration = plan.gestures.iter().map(|g| g.end()).fold(plan.end + shift, f64::max);
            if duration > 20.0 { return Err("This passage exceeds 20 seconds at normal rate. Shorten it.".into()); }
            if plan.gestures.len() > 2048 { return Err("Too many speech gestures. Shorten the passage.".into()); }
            let overlap = plan.gestures.iter().map(|g| {
                let t = g.t0-g.ramp_in;
                plan.gestures.iter().filter(|h| h.t0-h.ramp_in <= t && h.end() >= t).count()
            }).max().unwrap_or(0);
            if overlap > 64 { return Err("Too many overlapping speech gestures.".into()); }
            let gestures: Vec<Value> = plan.gestures.iter().map(|g| {
                let targets: Vec<Value> = g.targets.iter().flat_map(|(key,value)| [json!(key.index()), json!(value)]).collect();
                json!([g.t0, g.t1, g.ramp_in, g.ramp_out, g.strength, g.speed.unwrap_or(1.0), g.release_hold.unwrap_or(0.0), targets])
            }).collect();
            let segments: Vec<Value> = plan.segments.iter().map(|s| json!([s.t0+shift, s.t1+shift, s.ipa])).collect();
            bodies.push(json!({"duration": duration, "gestures": gestures, "segments": segments}));
        }
        Ok(json!({"schema": 1, "text": text, "bodies": bodies}))
    }
}

pub fn prepare(text: &str, dictionary: &str) -> Result<Value, String> { SpeechPlanner::new(dictionary).prepare(text) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn connected_phrase_retains_full_inventory_and_overlapping_gestures() {
        let p = prepare("She chose three blue shoes. Are you ready? We can speak in complete sentences, with different voices.", "").unwrap();
        assert_eq!(p["schema"], 1);
        for body in p["bodies"].as_array().unwrap() {
            assert!(body["gestures"].as_array().unwrap().len() > 64);
            assert!(body["duration"].as_f64().unwrap() > 1.0);
            assert!(body["segments"].as_array().unwrap().iter().any(|s| s[2] == "ʃ"));
        }
        assert_ne!(p["bodies"][0]["gestures"], p["bodies"][1]["gestures"]);
    }
    #[test]
    fn dictionary_stress_numbers_empty_and_limits() {
        let p = prepare("Hello 12!", "hello\tHH AH0 L OW1\n").unwrap();
        assert!(p["bodies"][0]["duration"].as_f64().unwrap() > 0.5);
        assert_eq!(prepare("   ", "").unwrap()["bodies"][0]["gestures"].as_array().unwrap().len(), 0);
        assert!(prepare(&"a".repeat(241), "").is_err());
        assert!(prepare("你好", "").is_err());
    }
}
