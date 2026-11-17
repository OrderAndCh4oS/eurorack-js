//! FIR decimator: Kaiser-windowed sinc low-pass, integer factor M.
//! `push()` one input sample at a time; when it returns true, `value` holds the next output sample.

use crate::math::{PI, js_max, sin, sqrt};

fn bessel_i0(x: f64) -> f64 {
    let mut sum = 1.0;
    let mut term = 1.0;
    for k in 1..30 {
        let q = x / (2.0 * k as f64);
        term *= q * q;
        sum += term;
        if term < 1e-12 * sum {
            break;
        }
    }
    sum
}

/// Kaiser-windowed sinc low-pass; `cutoff` as a fraction of the input sample rate (0..0.5).
pub fn design_lowpass(taps: usize, cutoff: f64, beta: f64) -> Vec<f64> {
    let mut h = vec![0.0; taps];
    let mid = (taps as f64 - 1.0) / 2.0;
    let i0b = bessel_i0(beta);
    let mut sum = 0.0;
    for (i, hi) in h.iter_mut().enumerate() {
        let x = i as f64 - mid;
        let sinc = if x == 0.0 { 2.0 * cutoff } else { sin(2.0 * PI * cutoff * x) / (PI * x) };
        let r = (2.0 * i as f64) / (taps as f64 - 1.0) - 1.0;
        let w = bessel_i0(beta * sqrt(js_max(0.0, 1.0 - r * r))) / i0b;
        *hi = sinc * w;
        sum += *hi;
    }
    for hi in h.iter_mut() {
        *hi /= sum;
    }
    h
}

#[derive(Clone, Debug)]
pub struct Decimator {
    pub factor: usize,
    h: Vec<f64>,
    buf: Vec<f64>,
    pos: usize,
    count: usize,
    pub value: f64,
}

impl Decimator {
    pub fn new(factor: usize) -> Self {
        Self::with_taps(factor, 24)
    }

    pub fn with_taps(factor: usize, taps_per_phase: usize) -> Self {
        let taps = if factor == 1 { 1 } else { factor * taps_per_phase + 1 };
        let h = if factor == 1 { vec![1.0] } else { design_lowpass(taps, 0.46 / factor as f64, 8.5) };
        Decimator { factor, h, buf: vec![0.0; taps * 2], pos: 0, count: 0, value: 0.0 }
    }

    /// Push one input sample; returns true when an output sample is ready in `value`.
    #[inline]
    pub fn push(&mut self, x: f64) -> bool {
        let n = self.h.len();
        self.buf[self.pos] = x;
        self.buf[self.pos + n] = x;
        self.pos = if self.pos + 1 == n { 0 } else { self.pos + 1 };
        self.count += 1;
        if self.count < self.factor {
            return false;
        }
        self.count = 0;
        let start = self.pos; // oldest sample
        let b = &self.buf[start..start + n];
        let mut acc = 0.0;
        for i in 0..n {
            acc += self.h[n - 1 - i] * b[i];
        }
        self.value = acc;
        true
    }
}
