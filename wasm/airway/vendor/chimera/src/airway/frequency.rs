//! Frequency-domain analysis of the (linearised) airway network: the same lumped elements
//! as the FDTD, solved per frequency by tree elimination (O(N) per frequency).
//! Used as a test oracle, for vowel calibration, and for the live transfer-function display.
//!
//! Complex arithmetic is written out on separate real/imaginary parts exactly as the
//! TypeScript did, so every operation (and its rounding) is the same.

use crate::airway::network::LinearElements;
use crate::math::{PI, hypot, js_max, log10, sqrt};
use crate::physics::{C_SOUND, RHO};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct TransferResult {
    pub freqs: Vec<f64>,
    /// |U_rad / U_in|
    pub mag: Vec<f64>,
    /// radiated pressure ∝ |jω·U_rad/U_in| (dB, arbitrary reference)
    pub pressure_db: Vec<f64>,
}

/// Transfer function from a volume-velocity source injected at `inject` to total radiated
/// volume velocity. Branches in `cut` are removed (e.g. the glottis: an ideal flow source has
/// infinite internal impedance, which decouples the subglottal system).
pub fn transfer_function(el: &LinearElements, inject: usize, freqs: &[f64], cut: &[usize]) -> TransferResult {
    let n = el.n_nodes;
    // adjacency of open branches
    let mut adj_start = vec![0usize; n + 1];
    let is_cut = |j: usize| cut.contains(&j);
    for j in 0..el.n_branches {
        if !el.open[j] || is_cut(j) {
            continue;
        }
        adj_start[el.a[j] + 1] += 1;
        adj_start[el.b[j] + 1] += 1;
    }
    for k in 0..n {
        adj_start[k + 1] += adj_start[k];
    }
    let mut adj = vec![0usize; adj_start[n]];
    let mut fill = adj_start[..n].to_vec();
    for j in 0..el.n_branches {
        if !el.open[j] || is_cut(j) {
            continue;
        }
        adj[fill[el.a[j]]] = j;
        fill[el.a[j]] += 1;
        adj[fill[el.b[j]]] = j;
        fill[el.b[j]] += 1;
    }
    // BFS tree from the injection node
    const UNVISITED: isize = -2;
    let mut order: Vec<usize> = Vec::with_capacity(n);
    let mut parent = vec![UNVISITED; n];
    let mut parent_branch = vec![usize::MAX; n];
    parent[inject] = -1;
    order.push(inject);
    let mut q = 0;
    while q < order.len() {
        let m = order[q];
        for e in adj_start[m]..adj_start[m + 1] {
            let j = adj[e];
            let k = if el.a[j] == m { el.b[j] } else { el.a[j] };
            if parent[k] != UNVISITED {
                continue; // visited (a loop would be ignored here)
            }
            parent[k] = m as isize;
            parent_branch[k] = j;
            order.push(k);
        }
        q += 1;
    }
    let mut rad_of: Vec<Option<usize>> = vec![None; n];
    for (r, &node) in el.rad_nodes.iter().enumerate() {
        rad_of[node] = Some(r);
    }

    let nf = freqs.len();
    let mut mag = vec![0.0; nf];
    let mut pdb = vec![0.0; nf];
    let mut yr = vec![0.0; n]; // total admittance of subtree (incl. node shunt)
    let mut yi = vec![0.0; n];
    let mut er = vec![0.0; n]; // equivalent admittance seen from parent (incl. series branch)
    let mut ei = vec![0.0; n];
    let mut pr = vec![0.0; n];
    let mut pi = vec![0.0; n];
    let mut rad_yr = vec![0.0; n];
    let mut rad_yi = vec![0.0; n];
    let mut w_yr = vec![0.0; n];
    let mut w_yi = vec![0.0; n];

    for f in 0..nf {
        let w = 2.0 * PI * js_max(freqs[f], 1e-3);
        // shunt admittances
        for &k in &order {
            let mut gr = 0.0;
            let mut gi = w * el.c[k];
            w_yr[k] = 0.0;
            w_yi[k] = 0.0;
            if el.wall_area[k] > 0.0 {
                // Y = S / (r + j(ωm − k/ω))
                let zr = el.wall_r[k];
                let zi = w * el.wall_m[k] - el.wall_k[k] / w;
                let d = zr * zr + zi * zi;
                w_yr[k] = (el.wall_area[k] * zr) / d;
                w_yi[k] = (-el.wall_area[k] * zi) / d;
                gr += w_yr[k];
                gi += w_yi[k];
            }
            rad_yr[k] = 0.0;
            rad_yi[k] = 0.0;
            if let Some(r) = rad_of[k] {
                let a = el.rad_area[r];
                let lr = (8.0 * RHO) / (3.0 * PI * sqrt(PI * a));
                let rr = (128.0 * RHO * C_SOUND) / (9.0 * PI * PI * a);
                rad_yr[k] = 1.0 / rr;
                rad_yi[k] = -1.0 / (w * lr);
                gr += rad_yr[k];
                gi += rad_yi[k];
            }
            if el.fixed[k] {
                gr += 1e30;
            }
            yr[k] = gr;
            yi[k] = gi;
        }
        // eliminate leaves → root
        for q in (1..order.len()).rev() {
            let k = order[q];
            let j = parent_branch[k];
            // Y_eq = Y / (1 + Z·Y), Z = R + jωL
            let zr = el.r[j];
            let zi = w * el.l[j];
            let dr = 1.0 + zr * yr[k] - zi * yi[k];
            let di = zr * yi[k] + zi * yr[k];
            let dd = dr * dr + di * di;
            er[k] = (yr[k] * dr + yi[k] * di) / dd;
            ei[k] = (yi[k] * dr - yr[k] * di) / dd;
            let m = parent[k] as usize;
            yr[m] += er[k];
            yi[m] += ei[k];
        }
        // root pressure for unit injected flow
        {
            let dd = yr[inject] * yr[inject] + yi[inject] * yi[inject];
            pr[inject] = yr[inject] / dd;
            pi[inject] = -yi[inject] / dd;
        }
        // back-substitute root → leaves: I = p_m·Y_eq(k); p_k = p_m − Z·I
        let mut ur = 0.0;
        let mut ui = 0.0;
        for (q, &k) in order.iter().enumerate() {
            if q > 0 {
                let m = parent[k] as usize;
                let j = parent_branch[k];
                let ir = pr[m] * er[k] - pi[m] * ei[k];
                let ii = pr[m] * ei[k] + pi[m] * er[k];
                let zr = el.r[j];
                let zi = w * el.l[j];
                pr[k] = pr[m] - (zr * ir - zi * ii);
                pi[k] = pi[m] - (zr * ii + zi * ir);
            }
            if rad_of[k].is_some() {
                ur += pr[k] * rad_yr[k] - pi[k] * rad_yi[k];
                ui += pr[k] * rad_yi[k] + pi[k] * rad_yr[k];
            }
            if el.wall_rad[k] > 0.0 && el.wall_area[k] > 0.0 {
                ur += el.wall_rad[k] * (pr[k] * w_yr[k] - pi[k] * w_yi[k]);
                ui += el.wall_rad[k] * (pr[k] * w_yi[k] + pi[k] * w_yr[k]);
            }
        }
        mag[f] = hypot(ur, ui);
        pdb[f] = 20.0 * log10(mag[f] * w + 1e-30);
    }
    TransferResult { freqs: freqs.to_vec(), mag, pressure_db: pdb }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Peak {
    pub freq: f64,
    /// -3 dB bandwidth (Hz), NaN if not measurable
    pub bw: f64,
    pub db: f64,
}

/// Local maxima of |H| (dB) with parabolic refinement and −3 dB bandwidths.
/// (`minFreq` defaulted to 80 Hz in TypeScript.)
pub fn find_peaks(freqs: &[f64], mag: &[f64], min_freq: f64) -> Vec<Peak> {
    let n = mag.len();
    let db: Vec<f64> = mag.iter().map(|m| 20.0 * log10(m + 1e-30)).collect();
    let mut out = Vec::new();
    for i in 1..n.saturating_sub(1) {
        if freqs[i] < min_freq {
            continue;
        }
        if db[i] > db[i - 1] && db[i] >= db[i + 1] {
            let (a, b, c) = (db[i - 1], db[i], db[i + 1]);
            let den = a - 2.0 * b + c;
            let off = if den.abs() > 1e-12 { (0.5 * (a - c)) / den } else { 0.0 };
            let df = freqs[i + 1] - freqs[i];
            let f = freqs[i] + off * df;
            let peak_db = b - 0.25 * (a - c) * off;
            // -3 dB points
            let (mut lo, mut hi) = (i, i);
            while lo > 0 && db[lo] > peak_db - 3.0 {
                lo -= 1;
            }
            while hi < n - 1 && db[hi] > peak_db - 3.0 {
                hi += 1;
            }
            let mut bw = f64::NAN;
            if db[lo] <= peak_db - 3.0 && db[hi] <= peak_db - 3.0 {
                let fl = freqs[lo] + ((peak_db - 3.0 - db[lo]) / (db[lo + 1] - db[lo])) * (freqs[lo + 1] - freqs[lo]);
                let fh = freqs[hi - 1] + ((db[hi - 1] - (peak_db - 3.0)) / (db[hi - 1] - db[hi])) * (freqs[hi] - freqs[hi - 1]);
                bw = fh - fl;
            }
            out.push(Peak { freq: f, bw, db: peak_db });
        }
    }
    out
}

pub fn linspace(a: f64, b: f64, n: usize) -> Vec<f64> {
    (0..n).map(|i| a + ((b - a) * i as f64) / (n as f64 - 1.0)).collect()
}
