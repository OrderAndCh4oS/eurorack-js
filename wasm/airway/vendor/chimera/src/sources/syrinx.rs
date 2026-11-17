//! Songbird syrinx: one labial pair modelled by the Gardner–Mindlin normal form
//!   X' = Y,  Y' = −α − βX − X³ − X²Y + X² − XY     (τ = γ·t)
//! γ is a pure time scale for fixed (α, β), so pitch is exact: γ = f0·T(α, β), with the limit-cycle
//! period T tabulated offline (tools/gen-syrinx-table.ts). α (drive ≈ air-sac pressure) moves the
//! waveform from a near-sine (Hopf onset) to rich relaxation pulses; β (labial tension) shapes it.
//! The labial displacement maps to the valve opening of its bronchus.

use crate::math::{js_max, js_min};
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize)]
struct RawTable {
    alphas: Vec<f64>,
    betas: Vec<f64>,
    #[serde(rename = "T")]
    t: Vec<Vec<Option<f64>>>,
    lo: Vec<Vec<Option<f64>>>,
    hi: Vec<Vec<Option<f64>>>,
}

#[derive(Debug)]
/// The limit-cycle table: period T and the displacement range [lo, hi] per (β row, α column).
pub struct SyrinxTable {
    pub alphas: Vec<f64>,
    pub betas: Vec<f64>,
    pub t: Vec<Vec<f64>>,
    pub lo: Vec<Vec<f64>>,
    pub hi: Vec<Vec<f64>>,
}

/// `grid[i]?.[j]` with JS's "missing or null" folded into `None`.
fn at(grid: &[Vec<Option<f64>>], i: usize, j: usize) -> Option<f64> {
    grid.get(i).and_then(|r| r.get(j).copied().flatten())
}

fn build() -> SyrinxTable {
    let mut tb: RawTable = serde_json::from_str(include_str!("syrinxTable.generated.json")).expect("syrinxTable.generated.json");
    // fill cells without a limit cycle from their neighbours
    for bi in 0..tb.betas.len() {
        for ai in (0..tb.alphas.len()).rev() {
            let v = tb.t[bi][ai];
            if v.is_none_or(|v| !v.is_finite()) {
                tb.t[bi][ai] = Some(at(&tb.t, bi, ai + 1).or(at(&tb.t, bi + 1, ai)).unwrap_or(10.0));
                tb.lo[bi][ai] = Some(at(&tb.lo, bi, ai + 1).unwrap_or(-1.0));
                tb.hi[bi][ai] = Some(at(&tb.hi, bi, ai + 1).unwrap_or(1.0));
            }
        }
    }
    // a null left anywhere else reads as 0 in the TS arithmetic (`null as number`)
    let fin = |g: Vec<Vec<Option<f64>>>| g.into_iter().map(|r| r.into_iter().map(|x| x.unwrap_or(0.0)).collect()).collect();
    SyrinxTable { alphas: tb.alphas, betas: tb.betas, t: fin(tb.t), lo: fin(tb.lo), hi: fin(tb.hi) }
}

/// The limit-cycle table (parsed and filled once).
pub fn table() -> &'static SyrinxTable {
    static T: OnceLock<SyrinxTable> = OnceLock::new();
    T.get_or_init(build)
}

/// Parse the table now, so nothing initialises lazily on the audio thread.
pub fn init() {
    table();
}

fn bilinear(tb: &SyrinxTable, grid: &[Vec<f64>], a: f64, b: f64) -> f64 {
    let as_ = &tb.alphas;
    let bs = &tb.betas;
    let fa = js_max(0.0, js_min(as_.len() as f64 - 1.0001, ((a - as_[0]) / (as_[as_.len() - 1] - as_[0])) * (as_.len() as f64 - 1.0)));
    let fb = js_max(0.0, js_min(bs.len() as f64 - 1.0001, ((b - bs[0]) / (bs[bs.len() - 1] - bs[0])) * (bs.len() as f64 - 1.0)));
    let ia = fa.floor();
    let ib = fb.floor();
    let u = fa - ia;
    let w = fb - ib;
    let (ia, ib) = (ia as usize, ib as usize);
    let g = |i: usize, j: usize| grid[j][i];
    (1.0 - w) * ((1.0 - u) * g(ia, ib) + u * g(ia + 1, ib)) + w * ((1.0 - u) * g(ia, ib + 1) + u * g(ia + 1, ib + 1))
}

pub const ALPHA_RANGE: [f64; 2] = [0.09, 0.6];
pub const BETA_RANGE: [f64; 2] = [0.2, 1.3];

#[derive(Clone, Debug)]
pub struct SyrinxLabia {
    x: f64,
    y: f64,
    /// drive 0..1 → α; tension 0..1 → β
    pub drive: f64,
    pub tension: f64,
    pub f0: f64,
    /// 0..1 gate (syringeal muscle opening this side)
    pub gate: f64,
    fs: f64,
    /// last opening 0..1 (telemetry)
    pub opening: f64,
    gate_sm: f64,
    table: &'static SyrinxTable,
}

impl SyrinxLabia {
    /// `seed` offsets the initial displacement (TS default 0).
    pub fn new(fs: f64, seed: f64) -> Self {
        SyrinxLabia { x: 0.2 + 0.05 * seed, y: 0.0, drive: 0.5, tension: 0.4, f0: 3000.0, gate: 1.0, fs, opening: 0.0, gate_sm: 0.0, table: table() }
    }

    #[inline(always)]
    fn rhs(x: f64, y: f64, a: f64, b: f64) -> (f64, f64) {
        (y, -a - b * x - x * x * x - x * x * y + x * x - x * y)
    }

    /// Advance one sample; returns the valve opening 0..1.
    pub fn next(&mut self) -> f64 {
        let tb = self.table;
        let a = ALPHA_RANGE[0] + (ALPHA_RANGE[1] - ALPHA_RANGE[0]) * js_max(0.0, js_min(1.0, self.drive));
        let b = BETA_RANGE[0] + (BETA_RANGE[1] - BETA_RANGE[0]) * js_max(0.0, js_min(1.0, self.tension));
        let t = bilinear(tb, &tb.t, a, b);
        let dtau = (t * self.f0) / self.fs;
        let n = js_max(1.0, (dtau / 0.06).ceil());
        let h = dtau / n;
        let mut x = self.x;
        let mut y = self.y;
        // a float loop counter, as in TS (a NaN step count runs no steps)
        let mut i = 0.0;
        while i < n {
            // RK4 (allocation-free)
            let (k1x, k1y) = Self::rhs(x, y, a, b);
            let (k2x, k2y) = Self::rhs(x + 0.5 * h * k1x, y + 0.5 * h * k1y, a, b);
            let (k3x, k3y) = Self::rhs(x + 0.5 * h * k2x, y + 0.5 * h * k2y, a, b);
            let (k4x, k4y) = Self::rhs(x + h * k3x, y + h * k3y, a, b);
            x += (h / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
            y += (h / 6.0) * (k1y + 2.0 * k2y + 2.0 * k3y + k4y);
            i += 1.0;
        }
        if !x.is_finite() || x.abs() > 10.0 {
            x = 0.2;
            y = 0.0;
        }
        self.x = x;
        self.y = y;
        let lo = bilinear(tb, &tb.lo, a, b);
        let hi = bilinear(tb, &tb.hi, a, b);
        let u = js_max(0.0, js_min(1.0, (x - lo) / js_max(1e-3, hi - lo)));
        self.gate_sm += (self.gate - self.gate_sm) * 0.002;
        let open = u * u * self.gate_sm;
        self.opening = open;
        open
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn table_is_filled() {
        let t = table();
        assert_eq!(t.t.len(), t.betas.len());
        assert!(t.t.iter().flatten().all(|v| v.is_finite()));
    }
}
