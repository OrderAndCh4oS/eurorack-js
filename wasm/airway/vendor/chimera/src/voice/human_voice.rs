//! Real-time human voice: lungs → parametric glottis → articulated airway, rendered at an
//! oversampled internal rate and decimated. The same code renders in real time (the browser's
//! AudioWorklet, a DAW's audio thread) and offline, sample for sample.

use super::human_airway::HumanAirway;
use crate::airway::decimator::Decimator;
use crate::anatomy::geom::Vec2;
use crate::anatomy::human::{ArticKey, ArticPatch, BODY_MALE, HumanBody, N_ARTIC};
use crate::control::articulators::ArticulatorBank;
use crate::control::score::{Blended, ControlKey, Gesture, GestureScore, Label, N_CONTROL};
use crate::math::{PI, clamp, exp, js_max, js_min, js_sign, js_trunc_i32, pow, sqrt, tanh};
use crate::physics::CM_H2O;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSource {
    /// target fundamental frequency (Hz)
    pub f0: f64,
    /// pitch glide time constant (s)
    pub glide: f64,
    /// lung pressure while breathing out (cmH2O); negative = ingressive
    pub pressure: f64,
    /// 0..1 breathy (abducted, chink)
    pub breathiness: f64,
    /// 0 lax … 1 pressed
    pub tension: f64,
    /// vocal fry 0..1
    pub fry: f64,
    /// jitter / shimmer / period doubling 0..1
    pub roughness: f64,
    pub vibrato_depth: f64,
    pub vibrato_rate: f64,
    /// random pitch drift (cents)
    pub drift: f64,
    /// false → whisper (no fold vibration)
    pub voiced: bool,
    /// 0 dark … 1 bright: how abruptly the folds close, at any tension. The default (0.25) leaves
    /// it to tension; it sits low because a spoken or sung voice already closes nearly as softly as
    /// the model can, so there is little room to darken and a lot to brighten.
    #[serde(default = "default_brightness")]
    pub brightness: f64,
}

fn default_brightness() -> f64 {
    DEFAULT_SOURCE.brightness
}

pub const DEFAULT_SOURCE: VoiceSource = VoiceSource { f0: 110.0, glide: 0.06, pressure: 8.0, breathiness: 0.15, tension: 0.5, fry: 0.0, roughness: 0.1, vibrato_depth: 0.0, vibrato_rate: 6.0, drift: 5.0, voiced: true, brightness: 0.25 };

/// `Partial<VoiceSource>`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SourcePatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub f0: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub glide: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pressure: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breathiness: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tension: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fry: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roughness: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vibrato_depth: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vibrato_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drift: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voiced: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brightness: Option<f64>,
}

impl SourcePatch {
    pub fn f0(f0: f64) -> Self {
        SourcePatch { f0: Some(f0), ..Default::default() }
    }
    /// `Object.assign(source, patch)`
    pub fn apply(&self, s: &mut VoiceSource) {
        macro_rules! set {
            ($($f:ident),*) => { $( if let Some(x) = self.$f { s.$f = x; } )* };
        }
        set!(f0, glide, pressure, breathiness, tension, fry, roughness, vibrato_depth, vibrato_rate, drift, voiced, brightness);
    }
    pub fn merge(&mut self, o: &SourcePatch) {
        macro_rules! set {
            ($($f:ident),*) => { $( if o.$f.is_some() { self.$f = o.$f; } )* };
        }
        set!(f0, glide, pressure, breathiness, tension, fry, roughness, vibrato_depth, vibrato_rate, drift, voiced, brightness);
    }
    pub fn from_source(s: &VoiceSource) -> Self {
        SourcePatch {
            f0: Some(s.f0),
            glide: Some(s.glide),
            pressure: Some(s.pressure),
            breathiness: Some(s.breathiness),
            tension: Some(s.tension),
            fry: Some(s.fry),
            roughness: Some(s.roughness),
            vibrato_depth: Some(s.vibrato_depth),
            vibrato_rate: Some(s.vibrato_rate),
            drift: Some(s.drift),
            voiced: Some(s.voiced),
            brightness: Some(s.brightness),
        }
    }
}

pub const SCOPE_POINTS: usize = 256;
const SCOPE_LEN: usize = 4096;

/// Fixed-size telemetry snapshot (~60 Hz) for visuals. Buffers are reused between snapshots.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceTelemetry {
    pub artic: Vec<f32>,
    pub ph_areas: Vec<f32>,
    pub or_areas: Vec<f32>,
    pub ph_len: f64,
    pub or_len: f64,
    pub pressure_rms: Vec<f32>,
    pub flow: Vec<f32>,
    pub velum_port: f64,
    pub glottal_area: Vec<f32>,
    pub glottal_flow: Vec<f32>,
    pub f0: f64,
    pub voicing: f64,
    pub p_lung: f64,
    pub out_rms: f64,
    pub noise_level: f64,
    pub noise_node: i32,
    pub gate: f64,
    /// voice clock (s) for score playheads
    pub clock: f64,
    /// labels of gestures active now (at most 4)
    pub active: Vec<Label>,
}

#[derive(Clone, Debug)]
pub struct HumanVoice {
    pub fs_out: f64,
    pub m: usize,
    pub fs: f64,
    pub airway: HumanAirway,
    pub glottis: crate::sources::glottis::ParametricGlottis,
    pub artic: ArticulatorBank,
    pub source: VoiceSource,
    dec: Decimator,
    /// internal samples per control step
    ctrl_every: usize,
    ctrl_counter: i64,
    /// breath gate 0..1 (note on/off)
    pub gate: f64,
    gate_target: f64,
    /// time left (s) during which a release of the gate follows the score's own breath ramp
    score_breath_hold: f64,
    p_lung: f64,
    /// lung pressure applied this sample, ramped toward `p_lung` across the control block
    p_lung_now: f64,
    p_lung_step: f64,
    f0: f64,
    pub output_gain: f64,
    dc_x: f64,
    dc_y: f64,
    dc_coef: f64,
    // telemetry accumulators
    rms_acc: Vec<f64>,
    rms_count: u32,
    flow_sm: Vec<f64>,
    scope_area: Vec<f32>,
    scope_flow: Vec<f32>,
    scope_pos: usize,
    cycle_starts: [usize; 8],
    cycle_idx: usize,
    last_phase: f64,
    out_acc: f64,
    out_count: u32,
    sub: u32,
    /// gestural score and voice clock (s)
    pub score: GestureScore,
    pub clock: f64,
    blend: [Blended; N_CONTROL],
    base_abduction: f64,
    base_closure: f64,
    score_f0: Option<f64>,
    lim_env: f64,
    lim_hold: i64,
    lim_hold_n: i64,
    lim_release: f64,
    /// tissue may compress this far (cm) before the palate stops the articulator
    pub max_penetration: f64,
}

/// How many times the airway is oversampled at this output rate: the smallest factor that puts
/// the simulation above 60 kHz (2× at 44.1 and 48 kHz, 1× at 88.2 and 96 kHz). The tubes keep a
/// minimum section count, so a lower simulation rate makes the sections shorter than one step of
/// sound and the airway blows up: at 2× a 16 kHz output (a Bluetooth headset's) went NaN within a
/// second, and 24 kHz ran at the limiter ceiling (issue #33).
pub fn oversample_for(fs_out: f64) -> usize {
    js_max(1.0, (60000.0 / fs_out).floor() + 1.0) as usize
}

impl HumanVoice {
    /// A voice rendering at `fs_out`, simulating at `fs_out · oversample`.
    pub fn new(fs_out: f64, body: HumanBody, oversample: usize) -> Self {
        let m = oversample;
        let fs = fs_out * m as f64;
        let airway = HumanAirway::new(fs, body);
        let n_tract = airway.n_ph + airway.n_or;
        let mut v = HumanVoice {
            fs_out,
            m,
            fs,
            airway,
            glottis: crate::sources::glottis::ParametricGlottis::new(fs),
            artic: ArticulatorBank::new(),
            source: DEFAULT_SOURCE,
            dec: Decimator::new(m),
            ctrl_every: 64 * m,
            ctrl_counter: 0,
            gate: 0.0,
            gate_target: 0.0,
            score_breath_hold: 0.0,
            p_lung: 0.0,
            p_lung_now: 0.0,
            p_lung_step: 0.0,
            f0: DEFAULT_SOURCE.f0,
            output_gain: 5.5e-7,
            dc_x: 0.0,
            dc_y: 0.0,
            dc_coef: exp((-2.0 * PI * 25.0) / fs_out),
            rms_acc: vec![0.0; n_tract],
            rms_count: 0,
            flow_sm: vec![0.0; n_tract],
            scope_area: vec![0.0; SCOPE_LEN],
            scope_flow: vec![0.0; SCOPE_LEN],
            scope_pos: 0,
            cycle_starts: [0; 8],
            cycle_idx: 0,
            last_phase: 0.0,
            out_acc: 0.0,
            out_count: 0,
            sub: 0,
            score: GestureScore::new(),
            clock: 0.0,
            blend: [Blended::default(); N_CONTROL],
            base_abduction: 0.0,
            base_closure: 0.0,
            score_f0: None,
            lim_env: 0.0,
            lim_hold: 0,
            lim_hold_n: crate::math::js_round(0.025 * fs_out) as i64,
            lim_release: exp(-1.0 / (0.2 * fs_out)),
            max_penetration: 0.1,
        };
        let x = v.artic.x;
        v.airway.apply(&x, 0.0);
        v.airway.net.snap_to_targets();
        // smaller bodies radiate more high-frequency (derivative) energy at their higher f0
        // (a ramp from the adult female's scale up to the adult male's, so blended bodies have no step)
        let sc = v.airway.body.scale;
        v.output_gain *= if sc >= 1.0 {
            1.0
        } else if sc <= 0.9 {
            0.55
        } else {
            0.55 + 0.45 * (sc - 0.9) / 0.1
        };
        v.apply_source();
        v
    }

    /// The defaults the browser uses: male body, oversampled by [`oversample_for`].
    pub fn with_defaults(fs_out: f64) -> Self {
        Self::new(fs_out, BODY_MALE, oversample_for(fs_out))
    }

    pub fn set_articulation(&mut self, values: &ArticPatch, tip_free: Option<bool>) {
        if let Some(t) = tip_free {
            self.artic.tip_free = t;
        }
        self.artic.set_target(values);
    }

    pub fn set_source(&mut self, values: &SourcePatch) {
        values.apply(&mut self.source);
        self.apply_source();
    }

    /// Airway extension: update live baseline controls between native control
    /// ticks without discarding the currently held score contribution. A
    /// prepared beat's control phase need not align with the rack's 64-frame
    /// grid. The original set_source is retained for upstream/setup semantics.
    pub fn set_source_live(&mut self, values: &SourcePatch) {
        let old_base = self.base_abduction;
        let held_abduction = self.glottis.params.abduction;
        let held_vibrato = self.glottis.params.vibrato_depth;
        self.set_source(values);
        let g = &mut self.glottis.params;
        // Preserve exact bits for an unchanged baseline; moving breath still
        // changes its baseline component while retaining the held score delta.
        g.abduction = if self.base_abduction == old_base {
            held_abduction
        } else {
            self.base_abduction + (held_abduction - old_base)
        };
        if values.vibrato_depth.is_none() {
            g.vibrato_depth = held_vibrato;
        }
        // Same gated-pressure law as control(), including ingressive breaths.
        // apply_source's ungated initialization value is not a live target.
        g.effort = clamp(((self.source.pressure * self.gate).abs() - 3.0) / 10.0, 0.0, 1.0);
    }

    /// Vocal adapter extension: apply a continuous voiced/unvoiced blend after
    /// set_source_live on a score-free voice. No phase, airflow or filter reset.
    pub fn set_voicing_live(&mut self, amount: f64) {
        debug_assert_eq!(self.score.size(), 0);
        let voicing = clamp(amount, 0.0, 1.0);
        let k2 = self.airway.body.scale * self.airway.body.scale;
        self.glottis.params.amplitude *= voicing;
        self.base_abduction += 0.2 * (1.0 - voicing) * k2;
        self.glottis.params.abduction = self.base_abduction;
    }

    /// Add gestures (times on the voice clock).
    pub fn schedule(&mut self, gestures: &[Gesture]) {
        self.score.add_all(gestures);
    }

    /// End the open-ended gestures with this tag now (a sung note's key was released).
    pub fn release(&mut self, tag: f64) {
        self.score.release(tag, self.clock);
    }

    /// Cancel scheduled gestures (speech stops; the voice returns to the performer's posture).
    pub fn cancel_score(&mut self) {
        self.score.clear();
    }

    /// breath/voice on (1) or off (0); intermediate values scale the pressure
    pub fn set_gate(&mut self, level: f64) {
        self.gate_target = clamp(level, 0.0, 1.5);
    }

    fn apply_source(&mut self) {
        let s = self.source;
        let g = &mut self.glottis.params;
        let k2 = self.airway.body.scale * self.airway.body.scale;
        g.amplitude = 0.17 * k2 * (if s.voiced { 1.0 } else { 0.0 });
        g.abduction = (if s.voiced { 0.1 * s.breathiness * s.breathiness } else { 0.2 + 0.1 * s.breathiness }) * k2;
        self.base_abduction = g.abduction;
        self.base_closure = 0.0;
        // Most voices, women's and trained singers' included, leave a small posterior gap between
        // the arytenoids through the closed phase (Södersten & Lindestad 1990). It leaks a little
        // air and damps the tract, which lifts H1 and the band below 500 Hz.
        g.chink = (0.008 + 0.03 * s.breathiness) * k2;
        g.open_quotient = 0.78 - 0.36 * s.tension;
        // The folds close along their length and depth over a return phase, not all at once, so
        // a sung or spoken voice closes softly (0.22 at tension 0.55): an abrupt closure put
        // 3-8 dB too much energy above 2 kHz. Pressing harder than that brings the abrupt closure
        // back, up to 0.95 at full tension, so a pressed voice still has its edge. Brightness moves
        // the closure from there, and shortens or lengthens the closing phase: 0 closes as softly as
        // the model allows, 1 about as abruptly as a pressed voice.
        let bright = s.brightness - DEFAULT_SOURCE.brightness;
        let by_tension = 0.4 * s.tension + 1.375 * js_max(0.0, s.tension - 0.6);
        g.closure_sharpness = clamp(by_tension + 0.8 * bright, 0.0, 1.0);
        g.skew = 0.56 + 0.16 * s.tension + 0.2 * bright;
        g.fry = s.fry;
        // Jitter of a healthy, trained voice at the default roughness (0.1): about 0.45 %, well
        // under the clinical threshold (MDVP: 1.04 %).
        g.jitter = 0.0021 + 0.0245 * s.roughness;
        g.shimmer = 0.02 + 0.22 * s.roughness;
        g.diplophonia = if s.roughness > 0.5 { (s.roughness - 0.5) * 1.4 } else { 0.0 };
        g.vibrato_depth = s.vibrato_depth;
        g.vibrato_rate = s.vibrato_rate;
        g.drift = s.drift;
        g.effort = clamp((s.pressure.abs() - 3.0) / 10.0, 0.0, 1.0);
    }

    /// Render `out.len()` output samples.
    pub fn render(&mut self, out: &mut [f32]) {
        let m = self.m;
        let lungs = self.airway.lungs;
        let sub_node = self.airway.trachea.last_node();
        let supra = self.airway.pharynx.first_node();
        let gp = self.airway.glottis_port;
        let n_ph = self.airway.n_ph;
        let n_or = self.airway.n_or;
        let ph_first = self.airway.pharynx.first_node();
        let or_first = self.airway.oral.first_node();
        for o in out.iter_mut() {
            for _ in 0..m {
                if self.ctrl_counter <= 0 {
                    self.control();
                }
                self.ctrl_counter -= 1;
                let net = &mut self.airway.net;
                self.p_lung_now += self.p_lung_step;
                net.set_fixed_pressure(lungs, self.p_lung_now);
                let a = self.glottis.next(net.p[sub_node] - net.p[supra]);
                net.set_port_area(gp, a);
                let y = net.step();
                if self.dec.push(y) {
                    // output sample
                    let mut v = self.dec.value * self.output_gain;
                    // DC blocker
                    let hp = v - self.dc_x + self.dc_coef * self.dc_y;
                    self.dc_x = v;
                    self.dc_y = hp;
                    v = hp;
                    // output limiter: a peak envelope held for longer than a glottal period, so a loud
                    // sung vowel is turned down by a steady gain instead of being squared off; only a
                    // rising level touches the soft clip
                    let av = v.abs();
                    if av >= self.lim_env {
                        self.lim_env = av;
                        self.lim_hold = self.lim_hold_n;
                    } else if self.lim_hold > 0 {
                        self.lim_hold -= 1;
                    } else {
                        self.lim_env *= self.lim_release;
                    }
                    if self.lim_env > 0.75 {
                        v *= 0.75 / self.lim_env;
                    }
                    let al = v.abs();
                    if al > 0.85 {
                        v = js_sign(v) * (0.85 + 0.15 * tanh((al - 0.85) / 0.15));
                    }
                    *o = v as f32;
                    self.out_acc += v * v;
                    self.out_count += 1;
                    // glottal scope at output rate
                    self.scope_area[self.scope_pos] = a as f32;
                    self.scope_flow[self.scope_pos] = net.u[gp] as f32;
                    let ph = self.glottis.cycle_phase();
                    if ph < self.last_phase {
                        self.cycle_starts[self.cycle_idx & 7] = self.scope_pos;
                        self.cycle_idx += 1;
                    }
                    self.last_phase = ph;
                    self.scope_pos = (self.scope_pos + 1) % SCOPE_LEN;
                }
                // decimated RMS accumulation for the pressure visualisation
                self.sub = self.sub.wrapping_add(1);
                if self.sub & 3 == 0 {
                    let p = &self.airway.net.p;
                    for k in 0..n_ph {
                        let v = p[ph_first + k];
                        self.rms_acc[k] += v * v;
                    }
                    for k in 0..n_or {
                        let v = p[or_first + k];
                        self.rms_acc[n_ph + k] += v * v;
                    }
                    self.rms_count += 1;
                }
            }
        }
    }

    /// Control-rate update: articulator dynamics, geometry → areas, breath, pitch.
    fn control(&mut self) {
        let dt = self.ctrl_every as f64 / self.fs;
        let t = self.clock;
        let mut breath_act = 0.0;
        let mut breath_val = 0.0;
        let mut f0_target = self.source.f0;
        if self.score.size() > 0 {
            self.score.blend_all(t, &mut self.blend);
            let b = &self.blend;
            // performer's base posture keeps a small say on keys the score controls
            self.artic.step(dt, Some(&b[..]), 0.05);
            let gp = &mut self.glottis.params;
            let k2 = self.airway.body.scale * self.airway.body.scale;
            let ab = b[ControlKey::ABDUCTION.index()];
            let ab_act = if ab.weight > 0.0 { js_min(1.0, ab.weight / 2.0) } else { 0.0 };
            gp.abduction = self.base_abduction + ab.value * ab_act * k2;
            let cl = b[ControlKey::CLOSURE.index()];
            gp.closure = js_max(self.base_closure, if cl.weight > 0.0 { cl.value * js_min(1.0, cl.weight / 2.0) } else { 0.0 });
            let br = b[ControlKey::BREATH.index()];
            if br.weight > 0.0 {
                breath_act = js_min(1.0, br.weight);
                breath_val = br.value;
            }
            let vb = b[ControlKey::VIBRATO.index()];
            gp.vibrato_depth = if vb.weight > 0.0 { (self.source.vibrato_depth * 0.05 + vb.value * vb.weight) / (0.05 + vb.weight) } else { self.source.vibrato_depth };
            let pf = b[ControlKey::F0.index()];
            if pf.weight > 0.0 {
                f0_target = (self.source.f0 * 0.02 + pf.value * pf.weight) / (0.02 + pf.weight);
                self.score_f0 = Some(f0_target);
            } else {
                self.score_f0 = None;
            }
            if js_trunc_i32(self.clock * 10.0) != js_trunc_i32((self.clock - dt) * 10.0) {
                self.score.prune(t - 0.2);
            }
        } else {
            self.artic.step(dt, None, 1.0);
            self.glottis.params.abduction = self.base_abduction;
            self.glottis.params.closure = self.base_closure;
            self.score_f0 = None;
        }
        self.clock += dt;
        // contact constraint on the frame computed anyway; re-apply only if a correction was made
        let x = self.artic.x;
        self.airway.apply(&x, dt);
        if self.enforce_contacts() {
            let x = self.artic.x;
            self.airway.reapply(&x);
        }
        self.airway.net.begin_block(self.ctrl_every);
        self.ctrl_counter = self.ctrl_every as i64;
        // breath: fast attack, slower release; a speaking score breathes on its own
        // a negative breath gesture (ingressive: inward K snares, gasps) overrides the performer's breath
        let score_breath = breath_val * breath_act;
        let gate_goal = if score_breath < 0.0 { score_breath } else { js_max(self.gate_target, score_breath) };
        // a score shapes its own breath ramps (beatbox hits end their breath abruptly, phrases end
        // into silence), including the moments just after its breath gesture has ended; the slow
        // release is for the performer's note-offs
        self.score_breath_hold = if breath_act > 0.0 { 0.15 } else { js_max(0.0, self.score_breath_hold - dt) };
        let tau = if gate_goal > self.gate {
            0.025
        } else if self.score_breath_hold > 0.0 {
            0.02
        } else {
            0.07
        };
        self.gate += (gate_goal - self.gate) * (1.0 - exp(-dt / tau));
        // a breath let go decays toward zero for ever, and a denormal lung pressure makes denormals
        // of the whole airway (see `AirwayNetwork::flush_tiny`): nothing is nothing
        crate::airway::network::tiny(&mut self.gate);
        self.glottis.flush_tiny();
        crate::airway::network::tiny(&mut self.dc_x);
        crate::airway::network::tiny(&mut self.dc_y);
        crate::airway::network::tiny(&mut self.lim_env);
        self.p_lung = self.source.pressure * CM_H2O * self.gate;
        if self.p_lung == 0.0 {
            crate::airway::network::tiny(&mut self.p_lung_now);
        }
        self.p_lung_step = (self.p_lung - self.p_lung_now) / self.ctrl_every as f64;
        // vocal effort follows the pressure actually applied: a harder breath (a louder sung note)
        // gives wider, sharper-closing pulses, as in real phonation, not just more flow
        self.glottis.params.effort = clamp(((self.source.pressure * self.gate).abs() - 3.0) / 10.0, 0.0, 1.0);
        // pitch glide
        let g = js_max(0.002, if self.score_f0.is_some() { 0.03 } else { self.source.glide });
        self.f0 *= pow(f0_target / self.f0, 1.0 - exp(-dt / g));
        self.glottis.params.f0 = self.f0;
        // smoothed mean flow per tract node (for particle speeds)
        let a = 1.0 - exp(-dt / 0.03);
        let n_ph = self.airway.n_ph;
        for k in 0..n_ph + self.airway.n_or {
            let br = if k < n_ph { self.airway.branch_of(self.airway.pharynx, k as isize) } else { self.airway.branch_of(self.airway.oral, (k - n_ph) as isize) };
            self.flow_sm[k] += a * (self.airway.net.u[br] - self.flow_sm[k]);
            crate::airway::network::tiny(&mut self.flow_sm[k]);
        }
    }

    /// Contact constraint: articulators cannot travel into the palate. Beyond `max_penetration` of
    /// tissue compression, the tongue tip/body is projected back along the contact normal and its
    /// inward velocity removed (inelastic). Keeps held closures still (no air pumping), makes
    /// releases start at the surface, and keeps the drawn anatomy physical.
    fn enforce_contacts(&mut self) -> bool {
        let tract = &self.airway.tract;
        let k = tract.scale();
        let lim = -self.max_penetration * k;
        let mut changed = false;
        let mut fix = |artic: &mut ArticulatorBank, d: f64, n: Vec2, kx: ArticKey, ky: ArticKey| {
            if !(d < lim) {
                return;
            }
            changed = true;
            let depth = lim - d; // > 0, body cm
            // body → template displacement (oral x is compressed by 0.86 in the template map)
            let sx = (if artic.x.get(kx) > 0.5 { 1.0 / 0.86 } else { 1.0 }) / k;
            let sy = 1.0 / k;
            *artic.x.get_mut(kx) += n.x * depth * sx;
            *artic.x.get_mut(ky) += n.y * depth * sy;
            let (ix, iy) = (kx.index(), ky.index());
            let vn = artic.v[ix] * n.x / sx + artic.v[iy] * n.y / sy; // normal velocity (body units)
            if vn < 0.0 {
                artic.v[ix] -= vn * n.x * sx;
                artic.v[iy] -= vn * n.y * sy;
            }
        };
        let (ct, ctn, cb, cbn) = (tract.contact_tip, tract.contact_tip_n, tract.contact_body, tract.contact_body_n);
        fix(&mut self.artic, ct, ctn, ArticKey::TtX, ArticKey::TtY);
        fix(&mut self.artic, cb, cbn, ArticKey::TbX, ArticKey::TbY);
        changed
    }

    /// How many of the voice's decaying states are denormal numbers (for tests: none should be;
    /// see `AirwayNetwork::flush_tiny`).
    pub fn denormal_states(&self) -> usize {
        use crate::airway::network::is_denormal;
        let own = [self.gate, self.dc_x, self.dc_y, self.lim_env, self.p_lung_now];
        let artic = ArticKey::ALL.iter().filter(|k| is_denormal(self.artic.x.get(**k))).count() + self.artic.v.iter().filter(|v| is_denormal(**v)).count();
        self.airway.net.denormal_states() + self.glottis.denormal_states() + own.iter().filter(|x| is_denormal(**x)).count() + self.flow_sm.iter().filter(|x| is_denormal(**x)).count() + artic
    }

    /// Fill a telemetry snapshot and reset the accumulators.
    pub fn telemetry(&mut self, out: &mut VoiceTelemetry) {
        let n_t = self.airway.n_ph + self.airway.n_or;
        out.artic.clear();
        out.artic.extend(ArticKey::ALL.iter().map(|k| self.artic.x.get(*k) as f32));
        debug_assert_eq!(out.artic.len(), N_ARTIC);
        let c = js_max(1.0, self.rms_count as f64);
        out.pressure_rms.clear();
        out.pressure_rms.extend((0..n_t).map(|k| sqrt(self.rms_acc[k] / c) as f32));
        self.rms_acc.fill(0.0);
        self.rms_count = 0;
        // phase-locked glottal scope: two most recent complete cycles
        let mut start = (self.scope_pos + SCOPE_LEN - 1024) % SCOPE_LEN;
        let mut len = 1024usize;
        if self.cycle_idx >= 3 && self.glottis.voicing > 0.2 {
            let c2 = self.cycle_starts[(self.cycle_idx - 3) & 7];
            let c0 = self.cycle_starts[(self.cycle_idx - 1) & 7];
            let span = (c0 + SCOPE_LEN - c2) % SCOPE_LEN;
            if span > 8 && span < SCOPE_LEN / 2 {
                start = c2;
                len = span;
            }
        }
        out.glottal_area.clear();
        out.glottal_flow.clear();
        for i in 0..SCOPE_POINTS {
            let idx = (start + (i * len) / SCOPE_POINTS) % SCOPE_LEN;
            out.glottal_area.push(self.scope_area[idx]);
            out.glottal_flow.push(self.scope_flow[idx]);
        }
        let mut noise_level = 0.0;
        let mut noise_node = -1i32;
        for s in self.airway.net.noise_sources() {
            if s.level > noise_level {
                noise_level = s.level;
                noise_node = s.src as i32;
            }
        }
        let out_rms = sqrt(self.out_acc / js_max(1.0, self.out_count as f64));
        self.out_acc = 0.0;
        self.out_count = 0;
        out.ph_areas.clear();
        out.ph_areas.extend(self.airway.ph_areas.iter().map(|x| *x as f32));
        out.or_areas.clear();
        out.or_areas.extend(self.airway.or_areas.iter().map(|x| *x as f32));
        out.ph_len = self.airway.ph_len;
        out.or_len = self.airway.or_len;
        out.flow.clear();
        out.flow.extend(self.flow_sm.iter().map(|x| *x as f32));
        out.velum_port = self.airway.frame.as_ref().map_or(0.0, |f| f.velum_port);
        out.f0 = self.glottis.f0_now;
        out.voicing = self.glottis.voicing;
        out.p_lung = self.p_lung_now / CM_H2O; // the pressure applied, not the ramp's target
        out.out_rms = out_rms;
        out.noise_level = noise_level;
        out.noise_node = noise_node;
        out.gate = self.gate;
        out.clock = self.clock;
        out.active.clear();
        // room for every label it can hold, so the first labelled gesture does not allocate
        out.active.reserve(4);
        for g in self.score.active_at(self.clock) {
            if out.active.len() == 4 {
                break;
            }
            if let Some(l) = g.label
                && !l.is_empty()
                && l.as_str() != "breath"
                && l.as_str() != "pitch"
            {
                out.active.push(l);
            }
        }
        let _ = n_t;
    }
}
