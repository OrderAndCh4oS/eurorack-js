//! Linear prediction and formant estimation (autocorrelation method + Levinson–Durbin,
//! roots via Durand–Kerner). Used by tests, offline tools and the UI.

use crate::math::{PI, atan2, cos, exp, hypot, js_max, js_round, ln, log10, pow, sin};
use std::cmp::Ordering;

pub fn autocorr(x: &[f64], order: usize) -> Vec<f64> {
    let mut r = vec![0.0; order + 1];
    let n = x.len();
    for (k, rk) in r.iter_mut().enumerate() {
        let mut s = 0.0;
        for i in k..n {
            s += x[i] * x[i - k];
        }
        *rk = s;
    }
    r
}

/// An LPC polynomial a[0..p] with a[0] = 1 (A(z) = 1 + a1 z^-1 + ...), and prediction error.
#[derive(Clone, Debug, PartialEq)]
pub struct Lpc {
    pub a: Vec<f64>,
    pub err: f64,
}

/// Returns LPC polynomial a[0..p] with a[0] = 1 (A(z) = 1 + a1 z^-1 + ...), and prediction error.
pub fn levinson(r: &[f64], p: usize) -> Lpc {
    let mut a = vec![0.0; p + 1];
    a[0] = 1.0;
    let mut err = r[0] * (1.0 + 1e-9) + 1e-30;
    let mut tmp = vec![0.0; p + 1];
    for i in 1..=p {
        let mut acc = r[i];
        for j in 1..i {
            acc += a[j] * r[i - j];
        }
        let k = -acc / err;
        tmp.copy_from_slice(&a);
        for j in 1..i {
            a[j] = tmp[j] + k * tmp[i - j];
        }
        a[i] = k;
        err *= 1.0 - k * k;
        if err <= 0.0 {
            break;
        }
    }
    Lpc { a, err }
}

/// Complex roots (real parts, imaginary parts) of a polynomial with real coefficients
/// c[0] z^n + c[1] z^(n-1) + ... + c[n]. (`iters` defaulted to 400 in TypeScript.)
pub fn poly_roots(c: &[f64], iters: usize) -> (Vec<f64>, Vec<f64>) {
    let n = c.len() - 1;
    let lead = c[0];
    let coef: Vec<f64> = c.iter().map(|x| x / lead).collect();
    let mut re = vec![0.0; n];
    let mut im = vec![0.0; n];
    for i in 0..n {
        let ang = (2.0 * PI * i as f64) / n as f64 + 0.4;
        re[i] = 0.9 * cos(ang);
        im[i] = 0.9 * sin(ang);
    }
    for _ in 0..iters {
        let mut max_delta: f64 = 0.0;
        for i in 0..n {
            // evaluate p(z_i) by Horner
            let (mut pr, mut pi) = (1.0, 0.0);
            for &ck in &coef[1..=n] {
                let nr = pr * re[i] - pi * im[i] + ck;
                let ni = pr * im[i] + pi * re[i];
                pr = nr;
                pi = ni;
            }
            // denominator prod (z_i - z_j)
            let (mut dr, mut di) = (1.0, 0.0);
            for j in 0..n {
                if j == i {
                    continue;
                }
                let xr = re[i] - re[j];
                let xi = im[i] - im[j];
                let nr = dr * xr - di * xi;
                let ni = dr * xi + di * xr;
                dr = nr;
                di = ni;
            }
            let den = dr * dr + di * di + 1e-300;
            let qr = (pr * dr + pi * di) / den;
            let qi = (pi * dr - pr * di) / den;
            re[i] -= qr;
            im[i] -= qi;
            max_delta = js_max(max_delta, qr.abs() + qi.abs());
        }
        if max_delta < 1e-12 {
            break;
        }
    }
    (re, im)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Formant {
    pub freq: f64,
    pub bw: f64,
}

/// Options of [`estimate_formants`]; `None` takes the default noted on each field.
#[derive(Clone, Copy, Debug, Default)]
pub struct FormantOpts {
    /// LPC order (default round(2 + sampleRate/1000))
    pub order: Option<usize>,
    /// pre-emphasis coefficient (default 0.97)
    pub pre_emph: Option<f64>,
    /// widest bandwidth kept (Hz, default 600)
    pub max_bw: Option<f64>,
    /// lowest frequency kept (Hz, default 90)
    pub min_freq: Option<f64>,
}

/// Estimate formants of a voiced frame. Pre-emphasis, Hamming window, LPC order p.
/// Returns formants sorted by frequency with bandwidth filter.
pub fn estimate_formants(frame: &[f64], sample_rate: f64, opts: FormantOpts) -> Vec<Formant> {
    let order = opts.order.unwrap_or_else(|| js_round(2.0 + sample_rate / 1000.0) as usize);
    let pre = opts.pre_emph.unwrap_or(0.97);
    let n = frame.len();
    let mut x = vec![0.0; n];
    for i in 0..n {
        let v = frame[i] - if i > 0 { pre * frame[i - 1] } else { 0.0 };
        x[i] = v * (0.54 - 0.46 * cos((2.0 * PI * i as f64) / (n as f64 - 1.0)));
    }
    let mut r = autocorr(&x, order);
    // lag window (mild) for numerical robustness
    for (k, rk) in r.iter_mut().enumerate().skip(1) {
        *rk *= exp(-0.5 * pow((2.0 * PI * 40.0 * k as f64) / sample_rate, 2.0));
    }
    let Lpc { a, .. } = levinson(&r, order);
    let (re, im) = poly_roots(&a, 400);
    let mut out = Vec::new();
    for i in 0..re.len() {
        if im[i] <= 0.0 {
            continue;
        }
        let mag = hypot(re[i], im[i]);
        let freq = (atan2(im[i], re[i]) * sample_rate) / (2.0 * PI);
        let bw = (-ln(mag) * sample_rate) / PI;
        if freq < opts.min_freq.unwrap_or(90.0) || bw > opts.max_bw.unwrap_or(600.0) {
            continue;
        }
        out.push(Formant { freq, bw });
    }
    // stable sort by frequency, as `sort((p, q) => p.freq - q.freq)`; a NaN frequency (which
    // made the JS comparator inconsistent) sorts last
    out.sort_by(|p, q| num_order(p.freq, q.freq));
    out
}

/// The order of a JS `(a, b) => a - b` comparator (±0 equal) made total: NaN after all numbers.
pub(crate) fn num_order(a: f64, b: f64) -> Ordering {
    match a.partial_cmp(&b) {
        Some(o) => o,
        None => a.is_nan().cmp(&b.is_nan()),
    }
}

/// LPC spectral envelope in dB at given frequencies.
pub fn lpc_envelope_db(a: &[f64], err: f64, sample_rate: f64, freqs: &[f64]) -> Vec<f64> {
    freqs
        .iter()
        .map(|&fr| {
            let w = (2.0 * PI * fr) / sample_rate;
            let (mut re, mut im) = (0.0, 0.0);
            for (k, &ak) in a.iter().enumerate() {
                re += ak * cos(w * k as f64);
                im -= ak * sin(w * k as f64);
            }
            10.0 * log10(err / (re * re + im * im + 1e-30))
        })
        .collect()
}
