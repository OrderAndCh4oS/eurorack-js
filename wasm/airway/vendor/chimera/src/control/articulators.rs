//! Articulator dynamics: each articulator is a critically damped second-order system tracking
//! its target (Task-Dynamics style), with physiological natural frequencies. Runs at control
//! rate. Velocities are bounded implicitly by the dynamics, so UI drags and gestures produce
//! physiologically plausible motion (and therefore plausible dV/dt in the airway).

use super::score::Blended;
use crate::anatomy::human::{ArticKey, ArticPatch, HumanArtic, N_ARTIC, NEUTRAL, rest_tip};
use crate::math::{PI, js_max, js_min};
use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct ArticSpec {
    pub min: f64,
    pub max: f64,
    /// natural frequency (Hz) of the critically damped tracking dynamics
    pub hz: f64,
}

const fn spec(min: f64, max: f64, hz: f64) -> ArticSpec {
    ArticSpec { min, max, hz }
}

/// Per-articulator range and speed, in `ArticKey::ALL` order.
pub const ARTIC_SPECS: [ArticSpec; N_ARTIC] = [
    // vowel articulators fast enough to reach their targets in Klatt-length vowels (VocalTractLab's
    // fitted time constants are mostly 5–40 ms; second-order ω = 2π·hz here)
    spec(-0.1, 2.6, 10.0), // jaw
    spec(1.0, 4.8, 12.0),  // tbX
    spec(4.8, 9.2, 12.0),  // tbY
    spec(3.5, 8.0, 13.0),  // ttX
    spec(5.0, 10.8, 13.0), // ttY
    spec(0.0, 1.0, 9.0),   // ttCurl
    spec(-1.0, 1.0, 9.0),  // root
    spec(-0.4, 2.4, 11.0), // lipAp
    spec(-0.2, 1.5, 11.0), // lipProt
    spec(0.0, 1.0, 11.0),  // lipWidth
    spec(0.0, 1.0, 10.0),  // labiodental
    // the velum moves fast (it must seal within a few tens of ms after a nasal) and rests a
    // little past closed, so a closure seals in finite time instead of creeping to zero
    spec(-0.25, 1.4, 12.0), // velum
    spec(-1.6, 1.6, 8.0),   // larynx
    spec(0.0, 1.0, 6.0),    // epilarynx
    spec(0.0, 1.0, 6.0),    // ventricular
    spec(0.0, 1.0, 10.0),   // lateral
    spec(0.0, 1.0, 9.0),    // dorsum
];

pub fn artic_spec(k: ArticKey) -> ArticSpec {
    ARTIC_SPECS[k.index()]
}

/// keys blended as base + min(1, w/2)·(value − base) instead of a weighted mean
#[inline]
fn bounded(k: ArticKey) -> bool {
    k == ArticKey::Velum
}

#[derive(Clone, Debug)]
pub struct ArticulatorBank {
    pub x: HumanArtic,
    pub v: [f64; N_ARTIC],
    pub target: HumanArtic,
    /// when true the tongue tip rests behind the lower incisors (follows jaw & tongue body)
    pub tip_free: bool,
    /// per-articulator speed multiplier (gestures can request faster/slower motion)
    pub speed: [f64; N_ARTIC],
    omega: [f64; N_ARTIC],
    /// effective targets used in the last step (base blended with gestures), for telemetry
    pub effective: HumanArtic,
}

impl Default for ArticulatorBank {
    fn default() -> Self {
        Self::new()
    }
}

impl ArticulatorBank {
    pub fn new() -> Self {
        let mut b = ArticulatorBank { x: NEUTRAL, v: [0.0; N_ARTIC], target: NEUTRAL, tip_free: true, speed: [1.0; N_ARTIC], omega: ARTIC_SPECS.map(|s| 2.0 * PI * s.hz), effective: NEUTRAL };
        let tip = rest_tip(NEUTRAL.jaw, NEUTRAL.tb_x, NEUTRAL.tb_y);
        b.x.tt_x = tip.x;
        b.target.tt_x = tip.x;
        b.x.tt_y = tip.y;
        b.target.tt_y = tip.y;
        b
    }

    pub fn set_target(&mut self, values: &ArticPatch) {
        for (k, val) in values.iter() {
            if !val.is_finite() {
                continue;
            }
            let s = artic_spec(k);
            self.target.set(k, js_min(s.max, js_max(s.min, val)));
        }
    }

    /// Jump immediately (no dynamics), e.g. on voice creation.
    pub fn snap(&mut self, values: &ArticPatch) {
        self.set_target(values);
        self.x = self.target;
        self.v = [0.0; N_ARTIC];
    }

    /// Advance the dynamics. `blend[k]` (when given) is the gesture blend for each key: weighted
    /// mean value, total weight and a speed multiplier. The performer's base target joins with
    /// weight `base_weight`.
    pub fn step(&mut self, dt: f64, blend: Option<&[Blended]>, base_weight: f64) {
        if self.tip_free {
            let tip = rest_tip(self.x.jaw, self.x.tb_x, self.x.tb_y);
            self.target.tt_x = tip.x;
            self.target.tt_y = tip.y;
        }
        for k in ArticKey::ALL {
            let i = k.index();
            let mut tgt = self.target.get(k);
            let mut sp = self.speed[i];
            if let Some(blend) = blend {
                let b = blend[i];
                if b.weight > 0.0 {
                    if bounded(k) {
                        // keys only consonant gestures touch (the velum): follow the gesture's own ramps
                        // (with the weighted mean, a strength-4 gesture at 5 % activation already took 80 %
                        // of the step, so nasality spread far into neighbouring vowels)
                        tgt += js_min(1.0, b.weight / 2.0) * (b.value - tgt);
                    } else {
                        let bw = base_weight;
                        tgt = (tgt * bw + b.value * b.weight) / (bw + b.weight);
                    }
                    sp *= b.speed;
                }
            }
            let s = ARTIC_SPECS[i];
            if tgt < s.min {
                tgt = s.min;
            } else if tgt > s.max {
                tgt = s.max;
            }
            self.effective.set(k, tgt);
            let w = self.omega[i] * sp;
            // semi-implicit Euler on x'' = w²(T − x) − 2w x'  (stable for w·dt < 1)
            let x = self.x.get(k);
            let acc = w * w * (tgt - x) - 2.0 * w * self.v[i];
            self.v[i] += acc * dt;
            let mut nx = x + self.v[i] * dt;
            // an articulator sent to zero (the velum raised, the tongue's sides back up) arrives
            // asymptotically, which in floating point means among the denormals, for good
            // (see `AirwayNetwork::flush_tiny`): once it is there to all purposes, it is there
            if tgt == 0.0 {
                crate::airway::network::tiny(&mut nx);
            }
            crate::airway::network::tiny(&mut self.v[i]);
            self.x.set(k, nx);
        }
    }
}
