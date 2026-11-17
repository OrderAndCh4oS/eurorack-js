//! Creature definitions: physics (airway + sources), playable parameters and calls.
//!
//! The drawing data (`visual` in TS: silhouette, parts, tube paths, view, source glyphs) stays in
//! the UI, joined to these definitions by creature id.
//!
//! Calls are authored with string keys, as in TS (`"gate"`, a parameter key, or `"!event"`). Each
//! [`CallDef`] resolves them once, when its [`CreatureDef`] is built, into a [`CallPlan`] of
//! indices, so call playback on the audio thread does no string work and allocates nothing.

use crate::airway::network::{AirwayNetwork, Tube};
use serde::ser::{SerializeMap, Serializer};
use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CreatureGroup {
    Human,
    Bird,
    Mammal,
    Marine,
    Reptile,
    Amphibian,
    Insect,
    Crustacean,
    Fantasy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ParamRole {
    /// "pitch" params follow the keyboard
    Pitch,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ParamDef {
    pub key: &'static str,
    pub label: &'static str,
    pub min: f64,
    pub max: f64,
    pub default: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log: Option<bool>,
    /// smoothing time constant (s)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smooth: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<ParamRole>,
    /// decimals for display
    #[serde(skip_serializing_if = "Option::is_none")]
    pub digits: Option<u32>,
}

impl ParamDef {
    /// A parameter with only the required fields; the builders below add the optional ones.
    pub const fn new(key: &'static str, label: &'static str, min: f64, max: f64, default: f64) -> Self {
        ParamDef { key, label, min, max, default, unit: None, log: None, smooth: None, role: None, digits: None }
    }
    pub const fn unit(mut self, u: &'static str) -> Self {
        self.unit = Some(u);
        self
    }
    pub const fn log(mut self) -> Self {
        self.log = Some(true);
        self
    }
    pub const fn smooth(mut self, s: f64) -> Self {
        self.smooth = Some(s);
        self
    }
    pub const fn pitch(mut self) -> Self {
        self.role = Some(ParamRole::Pitch);
        self
    }
    pub const fn digits(mut self, d: u32) -> Self {
        self.digits = Some(d);
        self
    }
}

/// Interpolation from the previous key: linear (default), exponential (for frequencies), or step.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Curve {
    Lin,
    Exp,
    Step,
}

/// `Record<string, number>` in insertion order (serialised as a JSON object).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Values(pub Vec<(&'static str, f64)>);

impl Serialize for Values {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut m = s.serialize_map(Some(self.0.len()))?;
        for (k, v) in &self.0 {
            m.serialize_entry(k, v)?;
        }
        m.end()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct CallKey {
    pub t: f64,
    pub v: Values,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub curve: Option<Curve>,
}

impl CallKey {
    pub fn new(t: f64, v: &[(&'static str, f64)]) -> Self {
        CallKey { t, v: Values(v.to_vec()), curve: None }
    }
    pub fn curve(mut self, c: Curve) -> Self {
        self.curve = Some(c);
        self
    }
}

/// What a call key's name refers to, resolved against the creature's parameters and events.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CallTarget {
    /// `"gate"`: the call's breath gate
    Gate,
    /// a parameter, by its index in [`CreatureDef::params`]
    Param(usize),
    /// `"!name"`: a one-shot event, by its index in [`CreatureDef::events`]. `None` names an event
    /// the creature's simulation doesn't handle (TS passed it to `trigger`, which ignored it).
    Event(Option<usize>),
    /// a name that is none of these (TS evaluated it and then skipped it)
    Unknown,
}

/// One call key with its names resolved.
#[derive(Clone, Debug, PartialEq)]
pub struct PlanKey {
    pub t: f64,
    pub v: Vec<(CallTarget, f64)>,
    pub curve: Option<Curve>,
}

/// The playback form of a call, computed once per call definition (TS built `owns` and `names`
/// in `playCall`).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CallPlan {
    pub keys: Vec<PlanKey>,
    /// every name the call mentions (gate, params, events), in first-mention order; names that
    /// resolve to nothing are left out, because evaluating them had no effect
    pub names: Vec<CallTarget>,
    /// params the call automates (restored to the performer's values when it ends), by index
    pub owns: Vec<usize>,
    /// `owns` as a mask over the params
    pub owns_mask: Vec<bool>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallDef {
    pub id: &'static str,
    pub name: &'static str,
    pub hint: &'static str,
    pub keys: Vec<CallKey>,
    /// pitch params in the call are scaled by playedPitch / pitchRef when triggered from the keys
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch_ref: Option<f64>,
    #[serde(skip)]
    pub plan: CallPlan,
}

impl CallDef {
    pub fn new(id: &'static str, name: &'static str, hint: &'static str, pitch_ref: Option<f64>, keys: Vec<CallKey>) -> Self {
        CallDef { id, name, hint, keys, pitch_ref, plan: CallPlan::default() }
    }

    fn resolve(&mut self, params: &[ParamDef], events: &[&'static str]) {
        let target = |n: &str| -> CallTarget {
            if n == "gate" {
                CallTarget::Gate
            } else if let Some(e) = n.strip_prefix('!') {
                CallTarget::Event(events.iter().position(|x| *x == e))
            } else if let Some(i) = params.iter().position(|p| p.key == n) {
                CallTarget::Param(i)
            } else {
                CallTarget::Unknown
            }
        };
        let keys: Vec<PlanKey> = self.keys.iter().map(|k| PlanKey { t: k.t, v: k.v.0.iter().map(|(n, x)| (target(n), *x)).collect(), curve: k.curve }).collect();
        let mut names = Vec::new();
        let mut owns = Vec::new();
        for k in &keys {
            for (n, _) in &k.v {
                if *n != CallTarget::Unknown && !names.contains(n) {
                    names.push(*n);
                }
                if let CallTarget::Param(i) = n
                    && !owns.contains(i)
                {
                    owns.push(*i);
                }
            }
        }
        let mut owns_mask = vec![false; params.len()];
        for &i in &owns {
            owns_mask[i] = true;
        }
        self.plan = CallPlan { keys, names, owns, owns_mask };
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct GateTimes {
    pub attack: f64,
    pub release: f64,
}

/// A creature's simulation at one internal sample rate (a closure object in TS).
pub trait CreatureSim: Send {
    fn net(&self) -> Option<&AirwayNetwork>;
    fn net_mut(&mut self) -> Option<&mut AirwayNetwork>;
    /// tubes exposed to telemetry/visuals, by name (in the TS object's key order)
    fn tubes(&self) -> &[(&'static str, Tube)];
    /// control-rate update with smoothed parameters (indexed like [`CreatureDef::params`]); gate
    /// 0..1 is the breath
    fn control(&mut self, p: &[f64], gate: f64, dt: f64);
    /// one internal sample → radiated output (arbitrary units)
    fn sample(&mut self) -> f64;
    /// fixed output normalisation
    fn gain(&self) -> f64;
    /// a few named source values for the source glyph (0..1), written into `out` (cleared first)
    fn source_state(&self, out: &mut Vec<(&'static str, f64)>) {
        out.clear();
    }
    /// discrete events from calls (e.g. clicks, snaps), by index in [`CreatureDef::events`]
    fn trigger(&mut self, _event: usize, _amount: f64) {}
    /// zero the source's states that have decayed to nothing (control rate; the airway network
    /// does its own: see `AirwayNetwork::flush_tiny`)
    fn flush_tiny(&mut self) {}
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatureDef {
    pub id: &'static str,
    pub name: &'static str,
    pub latin: &'static str,
    pub group: CreatureGroup,
    /// how it makes sound, one sentence
    pub blurb: &'static str,
    /// musical role in a track
    pub role: &'static str,
    /// internal oversampling factor relative to the output rate
    pub oversample: u32,
    /// breath gate attack/release time constants (s)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gate_times: Option<GateTimes>,
    pub params: Vec<ParamDef>,
    pub calls: Vec<CallDef>,
    /// the event names (`"!name"` in call keys) the simulation's `trigger` handles
    #[serde(skip)]
    pub events: Vec<&'static str>,
    #[serde(skip)]
    pub create: fn(f64) -> Box<dyn CreatureSim>,
}

impl CreatureDef {
    /// Resolve every call's keys against the params and events (call once, after building).
    pub fn resolved(mut self) -> Self {
        for c in &mut self.calls {
            c.resolve(&self.params, &self.events);
        }
        self
    }

    pub fn param_index(&self, key: &str) -> Option<usize> {
        self.params.iter().position(|p| p.key == key)
    }

    pub fn call_index(&self, id: &str) -> Option<usize> {
        self.calls.iter().position(|c| c.id == id)
    }

    pub fn create(&self, fs: f64) -> Box<dyn CreatureSim> {
        (self.create)(fs)
    }
}

impl std::fmt::Debug for CreatureDef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CreatureDef").field("id", &self.id).finish_non_exhaustive()
    }
}
