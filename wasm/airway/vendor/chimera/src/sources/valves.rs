//! Flow-induced and driven sources beyond the vocal folds.
//!  - LipReed: outward-striking "brass player's lips" valve (elephant trumpet, beatbox lip buzz)
//!  - Whistle: aerodynamic whistle at a narrow constriction (elk bugle), a van der Pol oscillator
//!    coupled to the local acoustic pressure so it pulls toward and locks onto tract resonances
//!  - ClickTrain: impulsive sources (sperm-whale phonic lips, cicada tymbal ribs)
//!  - Bubble: cavitation bubble (Rayleigh–Plesset) for the snapping shrimp

use crate::math::{PI, cos, exp, js_max, js_min, pow, sin};

/// Outward-striking lip valve: m·h'' + r·h' + k·(h − h0) = S·(p_up − p_down). Opening area = w·max(h, 0).
#[derive(Clone, Debug)]
pub struct LipReed {
    h: f64,
    v: f64,
    /// natural frequency (Hz) of the lip mass–spring
    pub f: f64,
    /// damping ratio
    pub zeta: f64,
    /// rest opening (cm): >0 leaks, <0 pressed together
    pub h0: f64,
    /// lip width (cm)
    pub width: f64,
    /// effective pressure surface per unit mass (cm²/g)
    pub surface_per_mass: f64,
    dt: f64,
    pub opening: f64,
}

impl LipReed {
    pub fn new(fs: f64) -> Self {
        LipReed { h: 0.0, v: 0.0, f: 400.0, zeta: 0.12, h0: -0.01, width: 1.2, surface_per_mass: 0.08, dt: 1.0 / fs, opening: 0.0 }
    }

    /// Advance one sample with the pressure difference across the lips; returns the opening area (cm²).
    #[inline]
    pub fn next(&mut self, dp: f64) -> f64 {
        let w = 2.0 * PI * self.f;
        let acc = self.surface_per_mass * dp - 2.0 * self.zeta * w * self.v - w * w * (self.h - self.h0);
        // semi-implicit Euler (stable for w·dt < 1 at the internal rate)
        self.v += acc * self.dt;
        self.h += self.v * self.dt;
        // the lips cannot interpenetrate: inelastic collision at h = 0 with tissue compliance
        if self.h < -0.05 {
            self.h = -0.05;
            if self.v < 0.0 {
                self.v = 0.0;
            }
        }
        if self.h > 0.8 {
            self.h = 0.8;
            if self.v > 0.0 {
                self.v = 0.0;
            }
        }
        let a = if self.h > 0.0 { self.h * self.width } else { 0.0 };
        self.opening = a;
        a
    }
}

/// Supraglottal whistle: van der Pol oscillator excited by the jet (flow through the constriction)
/// and coupled to the local acoustic pressure, so its frequency is pulled toward the tract's
/// resonances (the elk bugle's G0 hops between formants as the tract lengthens).
#[derive(Clone, Debug)]
pub struct Whistle {
    x: f64,
    v: f64,
    /// target frequency (Hz)
    pub f: f64,
    /// coupling to the local pressure (frequency pulling)
    pub coupling: f64,
    dt: f64,
    pub out: f64,
}

impl Whistle {
    pub fn new(fs: f64) -> Self {
        Whistle { x: 0.01, v: 0.0, f: 2200.0, coupling: 0.6, dt: 1.0 / fs, out: 0.0 }
    }

    /// drive 0..1 (jet strength), p_local = acoustic pressure at the whistle (dyn/cm²). Returns a pressure source (dyn/cm²).
    #[inline]
    pub fn next(&mut self, drive: f64, p_local: f64, gain: f64) -> f64 {
        let w = 2.0 * PI * self.f;
        let mu = 0.15 * drive;
        // x'' − μ w (1 − x²) x' + w² x = c·w²·p̂
        let pn = js_max(-1.0, js_min(1.0, p_local / 2000.0));
        let acc = mu * w * (1.0 - self.x * self.x) * self.v - w * w * self.x + self.coupling * w * w * pn * drive;
        self.v += acc * self.dt;
        self.x += self.v * self.dt;
        if !self.x.is_finite() || self.x.abs() > 5.0 {
            self.x = 0.01;
            self.v = 0.0;
        }
        if drive < 0.02 {
            self.x *= 0.999;
            self.v *= 0.999;
        }
        self.out = self.x * gain * drive;
        self.out
    }
}

#[derive(Clone, Copy, Debug)]
struct PendingClick {
    at: f64,
    amp: f64,
}

#[derive(Clone, Copy, Debug)]
struct ActiveClick {
    start: f64,
    amp: f64,
}

/// Impulse source: smooth pulses (raised cosine) triggered by events, optionally ringing (tymbal ribs).
///
/// The pending and active lists are preallocated for [`ClickTrain::CAPACITY`] clicks each, so
/// scheduling up to that many outstanding clicks allocates nothing.
#[derive(Clone, Debug)]
pub struct ClickTrain {
    fs: f64,
    pending: Vec<PendingClick>,
    t: f64,
    /// click width (s)
    pub width: f64,
    /// ring frequency (Hz) and decay (s) for each click; ring = 0 → plain pulse
    pub ring: f64,
    pub ring_decay: f64,
    active: Vec<ActiveClick>,
}

impl ClickTrain {
    /// Outstanding clicks (pending or sounding) held without allocating.
    pub const CAPACITY: usize = 256;

    pub fn new(fs: f64) -> Self {
        ClickTrain { fs, pending: Vec::with_capacity(Self::CAPACITY), t: 0.0, width: 0.0004, ring: 0.0, ring_decay: 0.002, active: Vec::with_capacity(Self::CAPACITY) }
    }

    /// Schedule a click after `delay` seconds (`amp` was 1 by default in TS).
    pub fn click(&mut self, delay: f64, amp: f64) {
        self.pending.push(PendingClick { at: self.t + delay, amp });
    }

    pub fn clear(&mut self) {
        self.pending.clear();
        self.active.clear();
    }

    /// Advance one sample; returns the source value (unit-ish).
    pub fn next(&mut self) -> f64 {
        let t = self.t;
        if !self.pending.is_empty() {
            let mut i = self.pending.len();
            while i > 0 {
                i -= 1;
                if self.pending[i].at <= t {
                    self.active.push(ActiveClick { start: self.pending[i].at, amp: self.pending[i].amp });
                    self.pending.remove(i);
                }
            }
        }
        let mut y = 0.0;
        let mut i = self.active.len();
        while i > 0 {
            i -= 1;
            let c = self.active[i];
            let age = t - c.start;
            let life = if self.ring > 0.0 { self.width + 6.0 * self.ring_decay } else { self.width };
            if age > life {
                self.active.remove(i);
                continue;
            }
            if self.ring > 0.0 {
                let env = if age < self.width { age / self.width } else { exp(-(age - self.width) / self.ring_decay) };
                y += c.amp * env * sin(2.0 * PI * self.ring * age);
            } else {
                y += c.amp * 0.5 * (1.0 - cos((2.0 * PI * age) / self.width));
            }
        }
        self.t += 1.0 / self.fs;
        y
    }
}

/// Cavitation bubble in water (Rayleigh–Plesset):
///   R R'' + 1.5 R'² = (p_gas(R) − p∞(t) − 2σ/R − 4μ R'/R) / ρ
/// A "snap" drops the ambient pressure (the claw's jet), the bubble grows, then collapses violently.
/// Radiated pressure ∝ d²V/dt² = 4π(R²R'' + 2RR'²).
#[derive(Clone, Debug)]
pub struct Bubble {
    r: f64,
    rd: f64,
    /// equilibrium radius (m)
    pub r0: f64,
    dt: f64,
    tension: f64,
    viscosity: f64, // effective, includes thermal/acoustic damping
    rho: f64,
    p0: f64,
    kappa: f64,
    /// ambient pressure drop (Pa) while the jet passes, and its time course
    drop_until: f64,
    drop_amount: f64,
    t: f64,
    pub out: f64,
}

impl Bubble {
    pub fn new(fs: f64) -> Self {
        let r0 = 0.0005;
        Bubble { r: r0, rd: 0.0, r0, dt: 1.0 / fs, tension: 0.072, viscosity: 0.0015, rho: 1000.0, p0: 101325.0, kappa: 1.33, drop_until: 0.0, drop_amount: 0.0, t: 0.0, out: 0.0 }
    }

    /// Trigger a snap: the ambient pressure falls for `dur` seconds (larger drop → larger bubble).
    /// TS defaulted `dur` to 0.0012; see [`Bubble::DEFAULT_SNAP`].
    pub fn snap(&mut self, strength: f64, dur: f64) {
        self.drop_amount = self.p0 * (0.9 + 0.09 * js_max(0.0, js_min(1.0, strength)));
        self.drop_until = self.t + dur;
        self.r = js_max(self.r, self.r0);
    }

    /// The default snap duration (s).
    pub const DEFAULT_SNAP: f64 = 0.0012;

    #[inline]
    fn acc(&self, r: f64, rd: f64, pinf: f64) -> f64 {
        let pg = (self.p0 + (2.0 * self.tension) / self.r0) * pow(self.r0 / r, 3.0 * self.kappa);
        ((pg - pinf - (2.0 * self.tension) / r - (4.0 * self.viscosity * rd) / r) / self.rho - 1.5 * rd * rd) / r
    }

    /// Advance one audio sample (with adaptive sub-stepping for the collapse); returns radiated pressure (arb.).
    pub fn next(&mut self) -> f64 {
        let pinf = if self.t < self.drop_until { self.p0 - self.drop_amount } else { self.p0 };
        let mut r = self.r;
        let mut rd = self.rd;
        // sub-steps: the collapse is stiff
        let speed = rd.abs() / js_max(r, 1e-6);
        let n = js_min(64.0, js_max(2.0, (speed * self.dt * 20.0).ceil()));
        let h = self.dt / n;
        let mut a = 0.0;
        // a float loop counter, as in TS: a NaN step count runs no sub-steps
        let mut i = 0.0;
        while i < n {
            // velocity-Verlet-like midpoint step
            let a1 = self.acc(r, rd, pinf);
            let rm = r + 0.5 * h * rd;
            let rdm = rd + 0.5 * h * a1;
            a = self.acc(js_max(rm, self.r0 * 0.02), rdm, pinf);
            r += h * rdm;
            rd += h * a;
            if r < self.r0 * 0.02 {
                r = self.r0 * 0.02;
                rd = rd.abs() * 0.3; // lossy rebound
            }
            i += 1.0;
        }
        if !r.is_finite() || !rd.is_finite() {
            r = self.r0;
            rd = 0.0;
        }
        self.r = r;
        self.rd = rd;
        self.t += self.dt;
        // d²V/dt² / 4π
        let y = r * r * a + 2.0 * r * rd * rd;
        self.out = y;
        y
    }

    pub fn radius(&self) -> f64 {
        self.r
    }
}
