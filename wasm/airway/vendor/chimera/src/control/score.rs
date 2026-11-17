//! Gestural score (Articulatory-Phonology style). A gesture drives a subset of control keys
//! toward targets over an activation interval with smooth ramps and a blending strength.
//! At each control step, every key's target is the strength-weighted mean of the active
//! gestures' targets, blended with the performer's base value (weight 1 when nothing is active).
//! Consonant gestures use high strength on their articulators; vowel gestures are long and
//! overlapping, so the tongue body keeps moving vowel-to-vowel through consonants (coarticulation).
//!
//! Real time: a [`Gesture`] is `Copy` (its label is stored inline), the score keeps its
//! gestures in one `Vec` that is pruned in place, and blending all keys is one pass.

use crate::anatomy::human::{ArticKey, N_ARTIC};
use crate::math::{PI, acos, cos, js_max, js_min};
use serde::{Deserialize, Serialize};

/// Non-articulator control channels a gesture may drive.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum SourceKey {
    /// extra glottal abduction (cm², body-scaled at use)
    Abduction,
    /// forced glottal closure 0..1 (glottal stop, ejectives)
    Closure,
    /// breath pressure multiplier (0 = no breath, 1 = performer's pressure, <0 = ingressive)
    Breath,
    /// pitch in Hz (absolute)
    F0,
    /// vibrato depth (cents): singers let it bloom a few hundred ms into a held note
    Vibrato,
}

pub const N_SOURCE: usize = 5;
/// Articulators then source channels.
pub const N_CONTROL: usize = N_ARTIC + N_SOURCE;

/// A control key: an articulator or a source channel, as one index 0..N_CONTROL.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ControlKey {
    Artic(ArticKey),
    Source(SourceKey),
}

pub const SOURCE_NAMES: [&str; N_SOURCE] = ["abduction", "closure", "breath", "f0", "vibrato"];

impl ControlKey {
    pub const ABDUCTION: ControlKey = ControlKey::Source(SourceKey::Abduction);
    pub const CLOSURE: ControlKey = ControlKey::Source(SourceKey::Closure);
    pub const BREATH: ControlKey = ControlKey::Source(SourceKey::Breath);
    pub const F0: ControlKey = ControlKey::Source(SourceKey::F0);
    pub const VIBRATO: ControlKey = ControlKey::Source(SourceKey::Vibrato);

    #[inline]
    pub fn index(self) -> usize {
        match self {
            ControlKey::Artic(k) => k.index(),
            ControlKey::Source(s) => N_ARTIC + s as usize,
        }
    }
    pub fn from_index(i: usize) -> ControlKey {
        if i < N_ARTIC {
            ControlKey::Artic(ArticKey::ALL[i])
        } else {
            ControlKey::Source([SourceKey::Abduction, SourceKey::Closure, SourceKey::Breath, SourceKey::F0, SourceKey::Vibrato][i - N_ARTIC])
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            ControlKey::Artic(k) => k.name(),
            ControlKey::Source(s) => SOURCE_NAMES[s as usize],
        }
    }
    pub fn from_name(s: &str) -> Option<ControlKey> {
        if let Some(k) = ArticKey::from_name(s) {
            return Some(ControlKey::Artic(k));
        }
        SOURCE_NAMES.iter().position(|n| *n == s).map(|i| ControlKey::from_index(N_ARTIC + i))
    }
}

impl From<ArticKey> for ControlKey {
    fn from(k: ArticKey) -> Self {
        ControlKey::Artic(k)
    }
}

/// `Partial<Record<ControlKey, number>>`: NaN marks an absent key.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Targets(pub [f64; N_CONTROL]);

impl Default for Targets {
    fn default() -> Self {
        Targets([f64::NAN; N_CONTROL])
    }
}

impl Targets {
    #[inline]
    pub fn get(&self, k: impl Into<ControlKey>) -> Option<f64> {
        let x = self.0[k.into().index()];
        if x.is_nan() { None } else { Some(x) }
    }
    #[inline]
    pub fn set(&mut self, k: impl Into<ControlKey>, x: f64) -> &mut Self {
        self.0[k.into().index()] = x;
        self
    }
    pub fn with(mut self, k: impl Into<ControlKey>, x: f64) -> Self {
        self.0[k.into().index()] = x;
        self
    }
    pub fn has(&self, k: impl Into<ControlKey>) -> bool {
        !self.0[k.into().index()].is_nan()
    }
    pub fn remove(&mut self, k: impl Into<ControlKey>) {
        self.0[k.into().index()] = f64::NAN;
    }
    pub fn iter(&self) -> impl Iterator<Item = (ControlKey, f64)> + '_ {
        self.0.iter().enumerate().filter(|(_, x)| !x.is_nan()).map(|(i, x)| (ControlKey::from_index(i), *x))
    }
    pub fn is_empty(&self) -> bool {
        self.0.iter().all(|x| x.is_nan())
    }
}

impl Serialize for Targets {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(None)?;
        for (k, x) in self.iter() {
            m.serialize_entry(k.name(), &x)?;
        }
        m.end()
    }
}

impl<'de> Deserialize<'de> for Targets {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let m: std::collections::BTreeMap<String, f64> = Deserialize::deserialize(d)?;
        let mut t = Targets::default();
        for (k, x) in m {
            if let Some(key) = ControlKey::from_name(&k) {
                t.set(key, x);
            }
        }
        Ok(t)
    }
}

/// A short label stored inline (UTF-8, at most 24 bytes, cut at a character boundary).
#[derive(Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct Label {
    len: u8,
    bytes: [u8; Label::CAP],
}

impl Label {
    pub const CAP: usize = 24;
    pub fn new(s: &str) -> Label {
        let mut n = s.len().min(Self::CAP);
        while !s.is_char_boundary(n) {
            n -= 1;
        }
        let mut bytes = [0u8; Self::CAP];
        bytes[..n].copy_from_slice(&s.as_bytes()[..n]);
        Label { len: n as u8, bytes }
    }
    pub fn from_bytes(b: &[u8]) -> Label {
        Label::new(core::str::from_utf8(b).unwrap_or(""))
    }
    pub fn as_str(&self) -> &str {
        core::str::from_utf8(&self.bytes[..self.len as usize]).unwrap_or("")
    }
    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes[..self.len as usize]
    }
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
}

impl core::fmt::Debug for Label {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{:?}", self.as_str())
    }
}

impl From<&str> for Label {
    fn from(s: &str) -> Self {
        Label::new(s)
    }
}

impl Serialize for Label {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Label {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s: String = Deserialize::deserialize(d)?;
        Ok(Label::new(&s))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Gesture {
    pub t0: f64,
    pub t1: f64,
    pub ramp_in: f64,
    pub ramp_out: f64,
    pub strength: f64,
    pub targets: Targets,
    /// articulator speed multiplier while active and during `release_hold` seconds after t1
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_hold: Option<f64>,
    /// label for visualisation (phoneme / gesture name)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<Label>,
    /// open-ended gestures (a sung note held until its key is released) end via release(tag)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag: Option<f64>,
}

impl Gesture {
    pub fn new(t0: f64, t1: f64, ramp_in: f64, ramp_out: f64, strength: f64, targets: Targets) -> Gesture {
        Gesture { t0, t1, ramp_in, ramp_out, strength, targets, speed: None, release_hold: None, label: None, tag: None }
    }
    pub fn label(mut self, l: &str) -> Self {
        self.label = Some(Label::new(l));
        self
    }
    pub fn speed(mut self, s: f64) -> Self {
        self.speed = Some(s);
        self
    }
    pub fn release_hold(mut self, s: f64) -> Self {
        self.release_hold = Some(s);
        self
    }
    pub fn tag(mut self, t: f64) -> Self {
        self.tag = Some(t);
        self
    }
    /// The end of everything this gesture does (ramp-out and release hold included).
    #[inline]
    pub fn end(&self) -> f64 {
        self.t1 + self.ramp_out + self.release_hold.unwrap_or(0.0)
    }
    pub fn label_str(&self) -> &str {
        self.label.as_ref().map_or("", |l| l.as_str())
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Blended {
    pub value: f64,
    /// total active weight (0 = no gesture controls this key)
    pub weight: f64,
    pub speed: f64,
}

impl Default for Blended {
    fn default() -> Self {
        Blended { value: 0.0, weight: 0.0, speed: 1.0 }
    }
}

/// Smooth activation 0..1..0 with cosine ramps.
#[inline]
pub fn activation(g: &Gesture, t: f64) -> f64 {
    if t <= g.t0 - g.ramp_in || t >= g.t1 + g.ramp_out {
        return 0.0;
    }
    if t < g.t0 {
        let u = (t - (g.t0 - g.ramp_in)) / js_max(1e-6, g.ramp_in);
        return 0.5 - 0.5 * cos(PI * u);
    }
    if t > g.t1 {
        let u = (t - g.t1) / js_max(1e-6, g.ramp_out);
        return 0.5 + 0.5 * cos(PI * u);
    }
    1.0
}

#[derive(Clone, Debug)]
pub struct GestureScore {
    gestures: Vec<Gesture>,
    /// end time of the latest gesture (s)
    pub end: f64,
    /// gestures refused because the score was full
    pub dropped: u64,
}

impl Default for GestureScore {
    fn default() -> Self {
        Self::new()
    }
}

impl GestureScore {
    /// Fixed capacity: the score never reallocates. Gestures added past it are dropped (and counted).
    pub const CAPACITY: usize = 64; // Airway: one bounded beat recipe, no speech/song scheduling.

    pub fn new() -> Self {
        GestureScore { gestures: Vec::with_capacity(Self::CAPACITY), end: 0.0, dropped: 0 }
    }

    pub fn add(&mut self, g: Gesture) {
        if self.gestures.len() >= Self::CAPACITY {
            self.dropped += 1;
            return;
        }
        self.gestures.push(g);
        self.end = js_max(self.end, g.end());
    }

    pub fn add_all(&mut self, gs: &[Gesture]) {
        for g in gs {
            self.add(*g);
        }
    }

    pub fn clear(&mut self) {
        self.gestures.clear();
        self.end = 0.0;
    }

    /// End every gesture with this tag at time t. One not yet begun is dropped; one still ramping
    /// in turns round and ramps out from its present activation (no later rise); one at full
    /// strength starts its ramp-out now. Those already ending are left alone.
    pub fn release(&mut self, tag: f64, t: f64) {
        self.gestures.retain(|g| g.tag != Some(tag) || t > g.t0 - g.ramp_in);
        for g in self.gestures.iter_mut() {
            if g.tag != Some(tag) || g.t1 <= t {
                continue;
            }
            if t < g.t0 {
                // the point on the ramp-out curve whose value is the present activation
                let a = activation(g, t);
                let u = acos(js_min(1.0, js_max(-1.0, 2.0 * a - 1.0))) / PI;
                g.t1 = t - u * js_max(1e-6, g.ramp_out);
                g.t0 = g.t1;
            } else {
                g.t1 = t;
            }
        }
        let mut end = 0.0;
        for g in &self.gestures {
            end = js_max(end, g.end());
        }
        self.end = end;
    }

    /// Drop gestures that have fully finished before time t.
    pub fn prune(&mut self, t: f64) {
        if self.gestures.is_empty() {
            return;
        }
        self.gestures.retain(|g| g.end() > t);
    }

    pub fn size(&self) -> usize {
        self.gestures.len()
    }

    pub fn gestures(&self) -> &[Gesture] {
        &self.gestures
    }

    /// Active gestures at time t (for visualisation), in score order.
    pub fn active_at(&self, t: f64) -> impl Iterator<Item = &Gesture> + '_ {
        self.gestures.iter().filter(move |g| activation(g, t) > 0.0)
    }

    /// Blend for one key at time t.
    pub fn blend(&self, key: impl Into<ControlKey>, t: f64) -> Blended {
        let ki = key.into().index();
        let (mut wsum, mut vsum, mut speed) = (0.0, 0.0, 1.0);
        for g in &self.gestures {
            let target = g.targets.0[ki];
            if target.is_nan() {
                continue;
            }
            let act = activation(g, t);
            if let Some(gs) = g.speed {
                if gs != 0.0 && gs > speed && t >= g.t0 - g.ramp_in && t <= g.end() {
                    speed = gs;
                }
            }
            if act <= 0.0 {
                continue;
            }
            let w = act * g.strength;
            wsum += w;
            vsum += w * target;
        }
        Blended { value: if wsum > 0.0 { vsum / wsum } else { 0.0 }, weight: wsum, speed }
    }

    /// Blend every key at time t in one pass over the score (same sums, in the same order, as
    /// calling `blend` per key).
    pub fn blend_all(&self, t: f64, out: &mut [Blended; N_CONTROL]) {
        let mut wsum = [0.0f64; N_CONTROL];
        let mut vsum = [0.0f64; N_CONTROL];
        let mut speed = [1.0f64; N_CONTROL];
        for g in &self.gestures {
            // quick reject: entirely outside its window (activation 0, speed window closed)
            let lo = g.t0 - g.ramp_in;
            let in_speed = g.speed.is_some_and(|s| s != 0.0) && t >= lo && t <= g.end();
            let act = activation(g, t);
            if act <= 0.0 && !in_speed {
                continue;
            }
            let w = act * g.strength;
            let gs = g.speed.unwrap_or(0.0);
            for (i, target) in g.targets.0.iter().enumerate() {
                if target.is_nan() {
                    continue;
                }
                if in_speed && gs > speed[i] {
                    speed[i] = gs;
                }
                if act <= 0.0 {
                    continue;
                }
                wsum[i] += w;
                vsum[i] += w * target;
            }
        }
        for i in 0..N_CONTROL {
            out[i] = Blended { value: if wsum[i] > 0.0 { vsum[i] / wsum[i] } else { 0.0 }, weight: wsum[i], speed: speed[i] };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blend_all_equals_per_key_blend() {
        let mut s = GestureScore::new();
        let mut t = Targets::default();
        t.set(ArticKey::TbX, 3.0).set(ControlKey::F0, 120.0);
        s.add(Gesture::new(0.1, 0.3, 0.05, 0.05, 1.0, t).speed(2.0));
        let mut t2 = Targets::default();
        t2.set(ArticKey::TbX, 4.0).set(ArticKey::Jaw, 1.0);
        s.add(Gesture::new(0.2, 0.5, 0.1, 0.1, 3.0, t2).speed(1.5).release_hold(0.2));
        let mut out = [Blended::default(); N_CONTROL];
        for i in 0..80 {
            let time = i as f64 * 0.01;
            s.blend_all(time, &mut out);
            for k in 0..N_CONTROL {
                assert_eq!(out[k], s.blend(ControlKey::from_index(k), time), "key {k} at {time}");
            }
        }
    }

    #[test]
    fn labels_cut_at_char_boundaries() {
        assert_eq!(Label::new("voiced frication").as_str(), "voiced frication");
        let long = "ʃʃʃʃʃʃʃʃʃʃʃʃʃʃ"; // 2 bytes each
        assert_eq!(Label::new(long).as_str().len(), 24);
        assert_eq!(Label::new("aaaaaaaaaaaaaaaaaaaaaaaʃ").as_str(), "aaaaaaaaaaaaaaaaaaaaaaa");
    }
}
