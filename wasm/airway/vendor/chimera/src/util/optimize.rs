//! Nelder–Mead simplex minimiser with box bounds (clamped).

use crate::analysis::lpc::num_order;
use crate::math::{js_max, js_min};

/// Options of [`nelder_mead`]; `None` takes the default noted on each field.
#[derive(Clone, Debug, Default)]
pub struct NelderMeadOpts {
    /// initial simplex step per coordinate (default 0.1·|x0| or 0.05 near zero)
    pub step: Option<Vec<f64>>,
    /// lower bounds (default −∞)
    pub lo: Option<Vec<f64>>,
    /// upper bounds (default +∞)
    pub hi: Option<Vec<f64>>,
    /// default 400·n
    pub max_iter: Option<usize>,
    /// relative spread of the simplex values at which to stop (default 1e-7)
    pub tol: Option<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct NelderMeadResult {
    pub x: Vec<f64>,
    pub fx: f64,
    pub iters: usize,
}

/// Nelder–Mead simplex minimiser with box bounds (clamped).
pub fn nelder_mead(mut f: impl FnMut(&[f64]) -> f64, x0: &[f64], opts: NelderMeadOpts) -> NelderMeadResult {
    let n = x0.len();
    let lo = opts.lo.unwrap_or_else(|| vec![f64::NEG_INFINITY; n]);
    let hi = opts.hi.unwrap_or_else(|| vec![f64::INFINITY; n]);
    let clamp_x = |x: Vec<f64>| -> Vec<f64> { x.iter().enumerate().map(|(i, &v)| js_min(hi[i], js_max(lo[i], v))).collect() };
    let step = opts.step.unwrap_or_else(|| x0.iter().map(|v| if v.abs() > 1e-3 { 0.1 * v.abs() } else { 0.05 }).collect());
    let max_iter = opts.max_iter.unwrap_or(400 * n);
    let tol = opts.tol.unwrap_or(1e-7);
    let mut simplex: Vec<Vec<f64>> = vec![clamp_x(x0.to_vec())];
    for i in 0..n {
        let mut p = x0.to_vec();
        p[i] += step[i];
        simplex.push(clamp_x(p));
    }
    let mut values: Vec<f64> = simplex.iter().map(|x| f(x)).collect();
    let mut it = 0;
    while it < max_iter {
        // stable sort by value, as `sort((a, b) => values[a] - values[b])`
        let mut idx: Vec<usize> = (0..values.len()).collect();
        idx.sort_by(|&a, &b| num_order(values[a], values[b]));
        simplex = idx.iter().map(|&i| simplex[i].clone()).collect();
        values = idx.iter().map(|&i| values[i]).collect();
        if (values[n] - values[0]).abs() < tol * (values[0].abs() + 1e-12) {
            break;
        }
        let mut centroid = vec![0.0; n];
        for s in &simplex[..n] {
            for j in 0..n {
                centroid[j] += s[j] / n as f64;
            }
        }
        let worst = simplex[n].clone();
        let xr = clamp_x(centroid.iter().enumerate().map(|(j, &c)| c + (c - worst[j])).collect());
        let fr = f(&xr);
        if fr < values[0] {
            let xe = clamp_x(centroid.iter().enumerate().map(|(j, &c)| c + 2.0 * (c - worst[j])).collect());
            let fe = f(&xe);
            if fe < fr {
                simplex[n] = xe;
                values[n] = fe;
            } else {
                simplex[n] = xr;
                values[n] = fr;
            }
        } else if fr < values[n - 1] {
            simplex[n] = xr;
            values[n] = fr;
        } else {
            let xc = clamp_x(centroid.iter().enumerate().map(|(j, &c)| c + 0.5 * (worst[j] - c)).collect());
            let fc = f(&xc);
            if fc < values[n] {
                simplex[n] = xc;
                values[n] = fc;
            } else {
                for i in 1..=n {
                    let s0 = &simplex[0];
                    let shrunk = clamp_x(simplex[i].iter().enumerate().map(|(j, &v)| s0[j] + 0.5 * (v - s0[j])).collect());
                    simplex[i] = shrunk;
                    values[i] = f(&simplex[i]);
                }
            }
        }
        it += 1;
    }
    let mut best = 0;
    for i in 1..=n {
        if values[i] < values[best] {
            best = i;
        }
    }
    NelderMeadResult { x: simplex[best].clone(), fx: values[best], iters: it }
}
