//! YIN fundamental-frequency estimator (de Cheveigné & Kawahara 2002) for one frame.
//! Returns 0 if unvoiced (aperiodicity above threshold).

use crate::math::{js_max, js_min};

/// Options of [`yin_pitch`]; `None` takes the default noted on each field.
#[derive(Clone, Copy, Debug, Default)]
pub struct YinOpts {
    /// lowest f0 searched (Hz, default 50)
    pub min_f0: Option<f64>,
    /// highest f0 searched (Hz, default 2000)
    pub max_f0: Option<f64>,
    /// aperiodicity threshold (default 0.15)
    pub threshold: Option<f64>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pitch {
    /// Hz, 0 if unvoiced
    pub f0: f64,
    pub aperiodicity: f64,
}

pub fn yin_pitch(frame: &[f64], sample_rate: f64, opts: YinOpts) -> Pitch {
    let min_f0 = opts.min_f0.unwrap_or(50.0);
    let max_f0 = opts.max_f0.unwrap_or(2000.0);
    let thr = opts.threshold.unwrap_or(0.15);
    let max_lag = js_min((sample_rate / min_f0).floor(), (frame.len() as f64 / 2.0).floor()) as usize;
    let min_lag = js_max(2.0, (sample_rate / max_f0).floor()) as usize;
    if frame.len() <= max_lag {
        return Pitch { f0: 0.0, aperiodicity: 1.0 };
    }
    let w = frame.len() - max_lag;
    let mut d = vec![0.0; max_lag + 1];
    for tau in 1..=max_lag {
        let mut s = 0.0;
        for i in 0..w {
            let diff = frame[i] - frame[i + tau];
            s += diff * diff;
        }
        d[tau] = s;
    }
    // cumulative mean normalized difference
    let mut cmnd = vec![0.0; max_lag + 1];
    cmnd[0] = 1.0;
    let mut run = 0.0;
    for tau in 1..=max_lag {
        run += d[tau];
        cmnd[tau] = if run > 0.0 { (d[tau] * tau as f64) / run } else { 1.0 };
    }
    let mut best: Option<usize> = None;
    let mut tau = min_lag;
    while tau <= max_lag {
        if cmnd[tau] < thr {
            while tau < max_lag && cmnd[tau + 1] < cmnd[tau] {
                tau += 1;
            }
            best = Some(tau);
            break;
        }
        tau += 1;
    }
    let Some(best) = best else {
        // global minimum as fallback, reported with its aperiodicity
        let mut mi = min_lag;
        for tau in min_lag..=max_lag {
            if cmnd[tau] < cmnd[mi] {
                mi = tau;
            }
        }
        // (min_lag > max_lag read past the array in TS, giving `undefined`; NaN here)
        return Pitch { f0: 0.0, aperiodicity: cmnd.get(mi).copied().unwrap_or(f64::NAN) };
    };
    // parabolic interpolation
    let mut tau_f = best as f64;
    if best > 1 && best < max_lag {
        let (a, b, c) = (cmnd[best - 1], cmnd[best], cmnd[best + 1]);
        let den = a - 2.0 * b + c;
        if den.abs() > 1e-12 {
            tau_f = best as f64 + (0.5 * (a - c)) / den;
        }
    }
    Pitch { f0: sample_rate / tau_f, aperiodicity: cmnd[best] }
}
