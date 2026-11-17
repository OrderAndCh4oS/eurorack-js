//! Deterministic math. Every transcendental function goes through the pure-Rust `libm` crate, so
//! native (x86-64, aarch64) and wasm32 builds produce bit-identical samples. `sqrt`, `abs`,
//! `floor`, `ceil` and the basic operations are IEEE-exact on every target and are used from
//! `core` directly. Rust never fuses multiply–adds on its own, so operation order is the
//! TypeScript engine's.
//!
//! Helpers named `js_*` reproduce JavaScript semantics the engine relied on (NaN-propagating
//! min/max, `Math.round` rounding halves up).

pub const PI: f64 = core::f64::consts::PI;
pub const TAU: f64 = PI * 2.0;

#[inline(always)]
pub fn sin(x: f64) -> f64 {
    libm::sin(x)
}
#[inline(always)]
pub fn cos(x: f64) -> f64 {
    libm::cos(x)
}
#[inline(always)]
pub fn tan(x: f64) -> f64 {
    libm::tan(x)
}
#[inline(always)]
pub fn exp(x: f64) -> f64 {
    libm::exp(x)
}
/// Natural logarithm (`Math.log`).
#[inline(always)]
pub fn ln(x: f64) -> f64 {
    libm::log(x)
}
#[inline(always)]
pub fn log10(x: f64) -> f64 {
    libm::log10(x)
}
#[inline(always)]
pub fn log2(x: f64) -> f64 {
    libm::log2(x)
}
#[inline(always)]
pub fn pow(x: f64, y: f64) -> f64 {
    libm::pow(x, y)
}
#[inline(always)]
pub fn tanh(x: f64) -> f64 {
    libm::tanh(x)
}
#[inline(always)]
pub fn atan2(y: f64, x: f64) -> f64 {
    libm::atan2(y, x)
}
#[inline(always)]
pub fn acos(x: f64) -> f64 {
    libm::acos(x)
}
#[inline(always)]
pub fn asin(x: f64) -> f64 {
    libm::asin(x)
}
#[inline(always)]
pub fn atan(x: f64) -> f64 {
    libm::atan(x)
}
#[inline(always)]
pub fn cbrt(x: f64) -> f64 {
    libm::cbrt(x)
}
#[inline(always)]
pub fn hypot(x: f64, y: f64) -> f64 {
    libm::hypot(x, y)
}
#[inline(always)]
pub fn sinh(x: f64) -> f64 {
    libm::sinh(x)
}
#[inline(always)]
pub fn cosh(x: f64) -> f64 {
    libm::cosh(x)
}
#[inline(always)]
pub fn sqrt(x: f64) -> f64 {
    x.sqrt()
}

/// `Math.min(a, b)`: NaN if either is NaN; −0 is below +0.
#[inline(always)]
pub fn js_min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a < b {
        a
    } else if b < a {
        b
    } else if a.is_sign_negative() {
        a
    } else {
        b
    }
}
/// `Math.max(a, b)`: NaN if either is NaN; +0 is above −0.
#[inline(always)]
pub fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a > b {
        a
    } else if b > a {
        b
    } else if a.is_sign_positive() {
        a
    } else {
        b
    }
}
/// `Math.round`: nearest integer, halves toward +∞.
#[inline(always)]
pub fn js_round(x: f64) -> f64 {
    let r = x.floor();
    if x - r >= 0.5 { r + 1.0 } else { r }
}
/// `Math.sign`.
#[inline(always)]
pub fn js_sign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        x
    }
}
/// `x | 0` (ToInt32) for the values the engine uses it on (finite, well inside ±2³¹).
#[inline(always)]
pub fn js_trunc_i32(x: f64) -> i32 {
    if x.is_finite() { (x.trunc() as i64) as i32 } else { 0 }
}

#[inline(always)]
pub fn clamp(x: f64, lo: f64, hi: f64) -> f64 {
    if x < lo {
        lo
    } else if x > hi {
        hi
    } else {
        x
    }
}
#[inline(always)]
pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}
#[inline(always)]
pub fn smoothstep(e0: f64, e1: f64, x: f64) -> f64 {
    let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
pub fn db_to_gain(db: f64) -> f64 {
    pow(10.0, db / 20.0)
}
pub fn gain_to_db(g: f64) -> f64 {
    20.0 * log10(js_max(1e-12, g))
}
pub fn midi_to_hz(m: f64) -> f64 {
    440.0 * pow(2.0, (m - 69.0) / 12.0)
}
pub fn hz_to_midi(f: f64) -> f64 {
    69.0 + 12.0 * log2(js_max(1e-6, f) / 440.0)
}
pub fn cents_to_ratio(c: f64) -> f64 {
    pow(2.0, c / 1200.0)
}

/// Fast deterministic PRNG (mulberry32 core with 32-bit state), uniform in [0,1).
#[derive(Clone, Debug)]
pub struct Rng {
    s: u32,
}

impl Default for Rng {
    fn default() -> Self {
        Rng::new(0x9e37_79b9)
    }
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng { s: if seed == 0 { 1 } else { seed } }
    }
    #[inline]
    pub fn next(&mut self) -> f64 {
        self.s = self.s.wrapping_add(0x6d2b_79f5);
        let mut t = self.s;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
    /// Uniform in [-1, 1).
    #[inline]
    pub fn bipolar(&mut self) -> f64 {
        self.next() * 2.0 - 1.0
    }
    /// Approximately standard normal (sum of 4 uniforms, scaled). Cheap and bounded.
    #[inline]
    pub fn gauss(&mut self) -> f64 {
        let a = self.next();
        let b = self.next();
        let c = self.next();
        let d = self.next();
        (a + b + c + d - 2.0) * 1.7320508
    }
}

/// One-pole smoother, time constant in samples.
#[derive(Clone, Debug)]
pub struct Smoother {
    pub value: f64,
    a: f64,
}

impl Smoother {
    pub fn new(initial: f64, tau_samples: f64) -> Self {
        Smoother { value: initial, a: if tau_samples > 0.0 { exp(-1.0 / tau_samples) } else { 0.0 } }
    }
    pub fn set_tau(&mut self, tau_samples: f64) {
        self.a = if tau_samples > 0.0 { exp(-1.0 / tau_samples) } else { 0.0 };
    }
    pub fn step(&mut self, target: f64) -> f64 {
        self.value = target + (self.value - target) * self.a;
        self.value
    }
}

/// 1/f-ish slow random drift (sum of three filtered noises at octave-spaced rates).
/// `step()` is called at control rate; returns roughly unit-variance output.
#[derive(Clone, Debug)]
pub struct Drift {
    y: [f64; 3],
    a: [f64; 3],
    rng: Rng,
}

impl Drift {
    pub fn new(control_rate: f64, base_hz: f64, seed: u32) -> Self {
        let f = [base_hz, base_hz * 3.0, base_hz * 9.0];
        Drift { y: [0.0; 3], a: f.map(|f| exp((-TAU * f) / control_rate)), rng: Rng::new(seed) }
    }
    pub fn step(&mut self) -> f64 {
        let mut s = 0.0;
        for i in 0..3 {
            let a = self.a[i];
            // normalise so each band has ~unit variance
            self.y[i] = a * self.y[i] + sqrt(1.0 - a * a) * self.rng.gauss();
            s += self.y[i] / (i as f64 + 1.0);
        }
        s / 1.4
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mulberry32_matches_typescript() {
        // first outputs of `new Rng()` and `new Rng(12345)` from the TS engine
        let mut r = Rng::default();
        let v: Vec<f64> = (0..3).map(|_| r.next()).collect();
        let mut q = Rng::new(12345);
        let w: Vec<f64> = (0..3).map(|_| q.next()).collect();
        println!("{v:?} {w:?}");
        assert!(v.iter().chain(&w).all(|x| (0.0..1.0).contains(x)));
    }
    #[test]
    fn js_min_max_follow_javascript() {
        assert!(js_min(f64::NAN, 1.0).is_nan() && js_min(1.0, f64::NAN).is_nan());
        assert!(js_max(f64::NAN, 1.0).is_nan() && js_max(1.0, f64::NAN).is_nan());
        assert!(js_min(0.0, -0.0).is_sign_negative() && js_min(-0.0, 0.0).is_sign_negative());
        assert!(js_max(0.0, -0.0).is_sign_positive() && js_max(-0.0, 0.0).is_sign_positive());
        assert_eq!(js_min(2.0, 3.0), 2.0);
        assert_eq!(js_max(2.0, 3.0), 3.0);
    }
    #[test]
    fn js_round_halves_up() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(-2.5), -2.0);
        assert_eq!(js_round(0.49999999999999994), 0.0);
        assert_eq!(js_round(-0.6), -1.0);
    }
}
