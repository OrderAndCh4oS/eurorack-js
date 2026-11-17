//! Generic runtime for non-human creatures: parameter smoothing, breath gate, call playback
//! (keyframed automation), control-rate scheduling, oversampled simulation, decimation, DC block,
//! limiter and fixed-size telemetry. Runs on the audio thread and offline, sample for sample.
//!
//! Real time: once constructed, `render`, `set_params`, `set_gate`, `play_call`, `stop_call` and
//! `telemetry` (into a struct from [`CreatureVoice::new_telemetry`], or one filled before)
//! allocate nothing. Parameters and calls are addressed by index ([`CreatureDef::param_index`],
//! [`CreatureDef::call_index`]).

use super::types::{CallTarget, CreatureDef, CreatureSim, Curve, GateTimes};
use crate::airway::decimator::Decimator;
use crate::airway::network::tiny;
use crate::math::{PI, exp, js_max, js_min, js_round, js_sign, pow, sqrt, tanh};
use serde::ser::{SerializeMap, Serializer};
use serde::Serialize;

/// Per tube: areas (cm²) and acoustic pressure RMS (dyn/cm², static pressure removed) per node.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct TubeTelemetry {
    pub name: &'static str,
    pub areas: Vec<f32>,
    pub rms: Vec<f32>,
}

/// A telemetry snapshot. `out_rms` and the tubes' `rms` are interval measures: they cover the
/// time since the previous snapshot, whose read resets them. Everything else is the current state.
///
/// Serialises to the TS `CreatureTelemetry` shape: `{kind: "creature", id, params: {key: value},
/// gate, outRms, clock, tubes: {name: {areas, rms}}, source: {key: value}, call}`.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CreatureTelemetry {
    pub id: &'static str,
    /// smoothed parameter values, in the def's order
    pub params: Vec<(&'static str, f64)>,
    pub gate: f64,
    pub out_rms: f64,
    pub clock: f64,
    pub tubes: Vec<TubeTelemetry>,
    pub source: Vec<(&'static str, f64)>,
    pub call: Option<&'static str>,
}

struct Named<'a>(&'a [(&'static str, f64)]);
impl Serialize for Named<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut m = s.serialize_map(Some(self.0.len()))?;
        for (k, v) in self.0 {
            m.serialize_entry(k, v)?;
        }
        m.end()
    }
}

/// f32 values as the f64 numbers JS reads out of a `Float32Array`.
struct F32s<'a>(&'a [f32]);
impl Serialize for F32s<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.collect_seq(self.0.iter().map(|x| *x as f64))
    }
}

struct Tubes<'a>(&'a [TubeTelemetry]);
impl Serialize for Tubes<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Entry<'a> {
            areas: F32s<'a>,
            rms: F32s<'a>,
        }
        let mut m = s.serialize_map(Some(self.0.len()))?;
        for t in self.0 {
            m.serialize_entry(t.name, &Entry { areas: F32s(&t.areas), rms: F32s(&t.rms) })?;
        }
        m.end()
    }
}

impl Serialize for CreatureTelemetry {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut m = s.serialize_map(Some(9))?;
        m.serialize_entry("kind", "creature")?;
        m.serialize_entry("id", self.id)?;
        m.serialize_entry("params", &Named(&self.params))?;
        m.serialize_entry("gate", &self.gate)?;
        m.serialize_entry("outRms", &self.out_rms)?;
        m.serialize_entry("clock", &self.clock)?;
        m.serialize_entry("tubes", &Tubes(&self.tubes))?;
        m.serialize_entry("source", &Named(&self.source))?;
        m.serialize_entry("call", &self.call)?;
        m.end()
    }
}

#[derive(Clone, Copy, Debug)]
struct ActiveCall {
    /// index into the def's calls
    call: usize,
    t0: f64,
    pitch: f64,
    amp: f64,
}

const DEFAULT_GATE_TIMES: GateTimes = GateTimes { attack: 0.012, release: 0.06 };

/// JS truthiness of a number.
fn truthy(x: f64) -> bool {
    x != 0.0 && !x.is_nan()
}

pub struct CreatureVoice {
    pub def: &'static CreatureDef,
    pub fs_out: f64,
    pub fs: f64,
    pub m: usize,
    pub sim: Box<dyn CreatureSim>,
    /// performer settings, targets (performer or call automation) and smoothed values, indexed
    /// like the def's params
    performer: Vec<f64>,
    target: Vec<f64>,
    value: Vec<f64>,
    pub gate: f64,
    gate_target: f64,
    call_gate: f64,
    pub clock: f64,
    call: Option<ActiveCall>,
    /// one-shot events already fired, per key of the active call (preallocated for the longest call)
    fired: Vec<bool>,
    dec: Decimator,
    ctrl_every: usize,
    ctrl_counter: i64,
    dc_x: f64,
    dc_y: f64,
    dc_coef: f64,
    out_acc: f64,
    out_count: u64,
    /// per tube (in `sim.tubes()` order), per node
    rms_acc: Vec<Vec<f64>>,
    mean_acc: Vec<Vec<f64>>,
    rms_count: u64,
    sub: u32,
    /// master trim (performer)
    pub level: f64,
}

impl CreatureVoice {
    /// A voice at output rate `fs_out`. `initial` sets parameters by index (a later entry for the
    /// same index wins; non-finite values are ignored, as missing keys were in TS).
    pub fn new(def: &'static CreatureDef, fs_out: f64, initial: &[(usize, f64)]) -> Self {
        let m = js_max(1.0, js_round(def.oversample as f64 * if fs_out > 60000.0 { 0.5 } else { 1.0 })) as usize;
        let fs = fs_out * m as f64;
        let sim = def.create(fs);
        let ctrl_every = 64 * m;
        let mut performer = Vec::with_capacity(def.params.len());
        for (i, p) in def.params.iter().enumerate() {
            let x = initial.iter().rev().find(|(k, _)| *k == i).map(|(_, x)| *x);
            performer.push(match x {
                Some(x) if x.is_finite() => js_min(p.max, js_max(p.min, x)),
                _ => p.default,
            });
        }
        let rms_acc: Vec<Vec<f64>> = sim.tubes().iter().map(|(_, t)| vec![0.0; t.n]).collect();
        let max_keys = def.calls.iter().map(|c| c.plan.keys.len()).max().unwrap_or(0);
        let mut v = CreatureVoice {
            def,
            fs_out,
            fs,
            m,
            sim,
            target: performer.clone(),
            value: performer.clone(),
            performer,
            gate: 0.0,
            gate_target: 0.0,
            call_gate: 0.0,
            clock: 0.0,
            call: None,
            fired: Vec::with_capacity(max_keys),
            dec: Decimator::new(m),
            ctrl_every,
            ctrl_counter: 0,
            dc_x: 0.0,
            dc_y: 0.0,
            dc_coef: exp((-2.0 * PI * 12.0) / fs_out),
            out_acc: 0.0,
            out_count: 0,
            mean_acc: rms_acc.clone(),
            rms_acc,
            rms_count: 0,
            sub: 0,
            level: 1.0,
        };
        v.sim.control(&v.value, 0.0, v.ctrl_every as f64 / v.fs);
        if let Some(net) = v.sim.net_mut() {
            net.snap_to_targets();
        }
        v
    }

    /// Performer parameter values (what the player set), by param index.
    pub fn performer(&self) -> &[f64] {
        &self.performer
    }
    /// Current targets (performer or call automation).
    pub fn targets(&self) -> &[f64] {
        &self.target
    }
    /// Smoothed values, as the simulation sees them.
    pub fn values(&self) -> &[f64] {
        &self.value
    }

    /// Set performer parameters by index. Unknown indices and non-finite values are ignored;
    /// params the active call automates take the new value when the call ends.
    pub fn set_params(&mut self, v: &[(usize, f64)]) {
        for &(k, x) in v {
            let Some(d) = self.def.params.get(k) else { continue };
            if !x.is_finite() {
                continue;
            }
            let v = js_min(d.max, js_max(d.min, x));
            self.performer[k] = v;
            let owned = self.call.is_some_and(|c| self.def.calls[c.call].plan.owns_mask[k]);
            if !owned {
                self.target[k] = v;
            }
        }
    }

    pub fn set_gate(&mut self, level: f64) {
        self.gate_target = js_max(0.0, js_min(1.5, level));
    }

    /// Play call `call` (an index into the def's calls; others are ignored); `pitch` scales the
    /// call's pitch params relative to its reference. (`amp` defaulted to 1 in TS.)
    pub fn play_call(&mut self, call: usize, pitch: Option<f64>, amp: f64) {
        let Some(def) = self.def.calls.get(call) else { return };
        let r = def.pitch_ref.unwrap_or(0.0);
        self.end_call();
        let pitch = match pitch {
            Some(p) if truthy(p) && truthy(r) => p / r,
            _ => 1.0,
        };
        self.fired.clear();
        self.fired.resize(def.plan.keys.len(), false);
        self.call = Some(ActiveCall { call, t0: self.clock, pitch, amp });
    }

    /// [`play_call`](Self::play_call) by call id (a lookup; no allocation).
    pub fn play_call_id(&mut self, id: &str, pitch: Option<f64>, amp: f64) {
        if let Some(i) = self.def.call_index(id) {
            self.play_call(i, pitch, amp);
        }
    }

    pub fn stop_call(&mut self) {
        self.end_call();
    }

    /// End the active call and hand its parameters back to the performer.
    fn end_call(&mut self) {
        if let Some(c) = self.call {
            for &n in &self.def.calls[c.call].plan.owns {
                self.target[n] = self.performer[n];
            }
        }
        self.call = None;
        self.call_gate = 0.0;
    }

    pub fn active_call(&self) -> Option<&'static str> {
        let def = self.def;
        self.call.map(|c| def.calls[c.call].id)
    }

    /// Evaluate the active call's automation at the current clock (writes into targets).
    fn eval_call(&mut self) {
        let Some(c) = self.call else { return };
        let t = self.clock - c.t0;
        let def = self.def;
        let plan = &def.calls[c.call].plan;
        let keys = &plan.keys;
        let last = &keys[keys.len() - 1];
        if t > last.t + 0.05 {
            self.end_call();
            return;
        }
        for &n in &plan.names {
            // find surrounding keys that define n
            let mut prev: Option<(f64, f64)> = None;
            let mut next: Option<(f64, f64, Option<Curve>)> = None;
            for k in keys {
                let Some(&(_, x)) = k.v.iter().find(|(m, _)| *m == n) else { continue };
                if k.t <= t {
                    prev = Some((k.t, x));
                } else {
                    next = Some((k.t, x, k.curve));
                    break;
                }
            }
            let Some((prev_t, prev_x)) = prev else { continue };
            let mut x = prev_x;
            if let Some((next_t, next_x, curve)) = next
                && curve != Some(Curve::Step)
            {
                let u = (t - prev_t) / js_max(1e-6, next_t - prev_t);
                if curve == Some(Curve::Exp) && prev_x > 0.0 && next_x > 0.0 {
                    x = prev_x * pow(next_x / prev_x, u);
                } else {
                    x = prev_x + (next_x - prev_x) * u;
                }
            }
            match n {
                CallTarget::Gate => self.call_gate = x * c.amp,
                // events: "!click" etc. fire once when crossing the key time with value = amount
                CallTarget::Event(_) | CallTarget::Unknown => {}
                CallTarget::Param(i) => {
                    let d = &def.params[i];
                    if d.role.is_some() {
                        x *= c.pitch;
                    }
                    self.target[i] = js_min(d.max, js_max(d.min, x));
                }
            }
        }
        // one-shot events
        for (i, k) in keys.iter().enumerate() {
            if k.t > t || self.fired[i] {
                continue;
            }
            for &(n, amount) in &k.v {
                if let CallTarget::Event(Some(e)) = n {
                    self.sim.trigger(e, amount * c.amp);
                }
            }
            self.fired[i] = true;
        }
    }

    fn control(&mut self) {
        let dt = self.ctrl_every as f64 / self.fs;
        self.eval_call();
        for (i, p) in self.def.params.iter().enumerate() {
            let tau = p.smooth.unwrap_or(0.03);
            let a = 1.0 - exp(-dt / js_max(0.001, tau));
            let cur = self.value[i];
            let tgt = self.target[i];
            self.value[i] = if p.log == Some(true) && cur > 0.0 && tgt > 0.0 { cur * pow(tgt / cur, a) } else { cur + (tgt - cur) * a };
        }
        let goal = js_max(self.gate_target, self.call_gate);
        let gt = self.def.gate_times.unwrap_or(DEFAULT_GATE_TIMES);
        let tau = if goal > self.gate { gt.attack } else { gt.release };
        self.gate += (goal - self.gate) * (1.0 - exp(-dt / tau));
        // what dies away must end at zero, not among the denormals (see `AirwayNetwork::flush_tiny`):
        // a breath let go would leave a denormal lung pressure feeding the whole airway
        tiny(&mut self.gate);
        tiny(&mut self.dc_x);
        tiny(&mut self.dc_y);
        self.sim.flush_tiny();
        self.sim.control(&self.value, self.gate, dt);
        let every = self.ctrl_every;
        if let Some(net) = self.sim.net_mut() {
            net.begin_block(every);
        }
        self.ctrl_counter = self.ctrl_every as i64;
        self.clock += dt;
    }

    /// Render `out.len()` output samples.
    pub fn render(&mut self, out: &mut [f32]) {
        let m = self.m;
        let gain = self.sim.gain() * self.level;
        for o in out.iter_mut() {
            for _ in 0..m {
                if self.ctrl_counter <= 0 {
                    self.control();
                }
                self.ctrl_counter -= 1;
                let y = self.sim.sample();
                self.sub = self.sub.wrapping_add(1);
                if self.sub & 7 == 0
                    && let Some(net) = self.sim.net()
                {
                    let p = &net.p;
                    for (ti, (_, t)) in self.sim.tubes().iter().enumerate() {
                        let acc = &mut self.rms_acc[ti];
                        let mean = &mut self.mean_acc[ti];
                        for k in 0..t.n {
                            let v = p[t.first + k];
                            acc[k] += v * v;
                            mean[k] += v;
                        }
                    }
                    self.rms_count += 1;
                }
                if self.dec.push(y) {
                    let mut v = self.dec.value * gain;
                    let hp = v - self.dc_x + self.dc_coef * self.dc_y;
                    self.dc_x = v;
                    self.dc_y = hp;
                    v = hp;
                    let av = v.abs();
                    if av > 0.7 {
                        v = js_sign(v) * (0.7 + 0.3 * tanh((av - 0.7) / 0.3));
                    }
                    if !v.is_finite() {
                        v = 0.0;
                    }
                    *o = v as f32;
                    self.out_acc += v * v;
                    self.out_count += 1;
                }
            }
        }
    }

    /// A telemetry struct with every buffer sized for this voice (so filling it never allocates).
    pub fn new_telemetry(&self) -> CreatureTelemetry {
        CreatureTelemetry {
            params: Vec::with_capacity(self.def.params.len()),
            tubes: self.sim.tubes().iter().map(|(name, t)| TubeTelemetry { name, areas: Vec::with_capacity(t.n), rms: Vec::with_capacity(t.n) }).collect(),
            source: Vec::with_capacity(8),
            ..Default::default()
        }
    }

    /// Fill a telemetry snapshot and reset the interval measures.
    pub fn telemetry(&mut self, out: &mut CreatureTelemetry) {
        let c = js_max(1.0, self.rms_count as f64);
        let tubes = self.sim.tubes();
        if out.tubes.len() != tubes.len() {
            out.tubes.resize_with(tubes.len(), TubeTelemetry::default);
        }
        for (ti, (name, t)) in tubes.iter().enumerate() {
            let o = &mut out.tubes[ti];
            o.name = name;
            o.areas.clear();
            o.rms.clear();
            let acc = &mut self.rms_acc[ti];
            let mean = &mut self.mean_acc[ti];
            if let Some(net) = self.sim.net() {
                for k in 0..t.n {
                    o.areas.push(net.area[t.first + k] as f32);
                    let m = mean[k] / c;
                    o.rms.push(sqrt(js_max(0.0, acc[k] / c - m * m)) as f32);
                }
            }
            acc.fill(0.0);
            mean.fill(0.0);
        }
        self.rms_count = 0;
        let out_rms = sqrt(self.out_acc / js_max(1.0, self.out_count as f64));
        self.out_acc = 0.0;
        self.out_count = 0;
        out.id = self.def.id;
        out.params.clear();
        out.params.extend(self.def.params.iter().zip(&self.value).map(|(p, v)| (p.key, *v)));
        out.gate = self.gate;
        out.out_rms = out_rms;
        out.clock = self.clock;
        self.sim.source_state(&mut out.source);
        out.call = self.active_call();
    }
}
