//! Branched airway acoustics: staggered-grid FDTD transmission-line network.
//!
//! Nodes carry pressure p (dyn/cm²) and a volume V = A·Δ; branches carry volume velocity
//! U (cm³/s) between two nodes. Leapfrog in time: branches update U(n+½) from p(n), then
//! nodes update p(n+1) from U(n+½).
//!
//! Branch momentum: the state is Φ = L·U (∝ particle velocity), so as a branch closes
//! (L → ∞) its volume flow goes to zero without remembering stale momentum. Update solves
//!   (L/T)·U' + R·U' + k·|U'|·U' = Δp + Φ/T      (exact quadratic, k = kinetic loss)
//! with Borda–Carnot expansion loss k = ρ/2·(1/A_up − 1/A_down)² chosen by flow direction.
//!
//! Node continuity (moving walls included):
//!   (V/ρc²)·dp/dt = ΣU_in − ΣU_out − U_wall − dV/dt
//! Yielding walls: per-node mass–spring–damper per unit area, times wall area (perimeter·Δ).
//! Radiation: Flanagan parallel R–L load at open ends; output is d/dt of radiated flow.
//!
//! Real time: `step()` and the control-rate setters allocate nothing.

use crate::math::{PI, Rng, cbrt, exp, js_max, js_min, sqrt};
use crate::physics::{C_SOUND, MU, NU, RE_CRIT, RHO, RHO_C2, WallParams};

/// Initial cross-sectional area(s) of a tube.
#[derive(Clone, Debug)]
pub enum Area {
    Uniform(f64),
    Profile(Vec<f64>),
}

#[derive(Clone, Debug)]
pub struct TubeSpec {
    pub name: String,
    /// number of sections (pressure nodes)
    pub n: usize,
    /// total length (cm); may change at control rate
    pub length: f64,
    pub area: Area,
    /// yielding wall parameters, or None for rigid
    pub wall: Option<WallParams>,
    /// cross-section perimeter relative to a circle of equal area (≥1)
    pub perimeter_factor: f64,
    /// multiplier on viscous resistance
    pub viscous_factor: f64,
    /// fraction of wall volume velocity radiated as sound (skin radiation)
    pub wall_radiation: f64,
}

impl TubeSpec {
    pub fn new(name: &str, n: usize, length: f64, area: Area) -> Self {
        TubeSpec { name: name.to_string(), n, length, area, wall: None, perimeter_factor: 1.0, viscous_factor: 1.0, wall_radiation: 0.0 }
    }
    pub fn wall(mut self, w: Option<WallParams>) -> Self {
        self.wall = w;
        self
    }
    pub fn perimeter(mut self, f: f64) -> Self {
        self.perimeter_factor = f;
        self
    }
    pub fn viscous(mut self, f: f64) -> Self {
        self.viscous_factor = f;
        self
    }
    pub fn radiating(mut self, f: f64) -> Self {
        self.wall_radiation = f;
        self
    }
}

/// A tube's place in the network (its nodes are `first..first + n`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Tube {
    pub index: usize,
    pub n: usize,
    pub first: usize,
    /// index of the internal branch between node 0 and 1
    pub branch_base: usize,
}

impl Tube {
    #[inline]
    pub fn node(&self, i: usize) -> usize {
        self.first + i
    }
    #[inline]
    pub fn first_node(&self) -> usize {
        self.first
    }
    #[inline]
    pub fn last_node(&self) -> usize {
        self.first + self.n - 1
    }
    #[inline]
    pub fn branch(&self, i: usize) -> usize {
        self.branch_base + i
    }
}

const KIND_SERIES: u8 = 0; // inertance from adjacent half-sections
const KIND_PORT: u8 = 1; // own duct (area, length) in series with adjacent half-sections

#[derive(Clone, Copy, Debug)]
pub struct PortSpec {
    /// duct area (cm²)
    pub area: f64,
    /// duct length (cm)
    pub length: f64,
    /// kinetic loss coefficient for flow entering the duct (contraction)
    pub k_entrance: f64,
    /// kinetic loss coefficient for flow leaving the duct (jet expansion)
    pub k_exit: f64,
    /// slit-viscous width factor: if >0, viscous R = 12μ·len·w²/A³ (glottis-like slit of length w)
    pub slit_width: f64,
    /// include the adjacent half-section inertances
    pub include_half_sections: bool,
    /// additional constant series resistance (CGS acoustic ohms)
    pub extra_resistance: f64,
}

impl PortSpec {
    pub fn new(area: f64, length: f64) -> Self {
        PortSpec { area, length, k_entrance: 0.4, k_exit: 1.0, slit_width: 0.0, include_half_sections: true, extra_resistance: 0.0 }
    }
    pub fn kinetic(mut self, k_entrance: f64, k_exit: f64) -> Self {
        self.k_entrance = k_entrance;
        self.k_exit = k_exit;
        self
    }
    pub fn slit(mut self, w: f64) -> Self {
        self.slit_width = w;
        self
    }
    pub fn no_half_sections(mut self) -> Self {
        self.include_half_sections = false;
        self
    }
    pub fn resistance(mut self, r: f64) -> Self {
        self.extra_resistance = r;
        self
    }
}

/// Linearised element values for frequency-domain analysis.
#[derive(Clone, Debug)]
pub struct LinearElements {
    pub n_nodes: usize,
    pub n_branches: usize,
    pub a: Vec<usize>,
    pub b: Vec<usize>,
    pub l: Vec<f64>,
    pub r: Vec<f64>,
    pub open: Vec<bool>,
    pub c: Vec<f64>,
    pub wall_area: Vec<f64>,
    pub wall_m: Vec<f64>,
    pub wall_r: Vec<f64>,
    pub wall_k: Vec<f64>,
    pub wall_rad: Vec<f64>,
    pub fixed: Vec<bool>,
    pub rad_nodes: Vec<usize>,
    pub rad_area: Vec<f64>,
}

/// Below this a state is nothing (the network's own silence is 1e-9): see `flush_tiny`.
pub const TINY: f64 = 1e-30;
#[inline]
pub fn tiny(x: &mut f64) {
    if x.abs() < TINY {
        *x = 0.0;
    }
}
/// A number too small to be held at full precision, which a processor computes with slowly.
#[inline]
pub fn is_denormal(x: f64) -> bool {
    x != 0.0 && x.abs() < f64::MIN_POSITIVE
}

/// A turbulence noise source request (control rate).
#[derive(Clone, Copy, Debug)]
pub struct NoiseSpec {
    /// branch whose Reynolds number drives the source
    pub src: usize,
    /// branch to inject into when flow is positive (a→b)
    pub fwd: usize,
    /// branch to inject into when flow is negative
    pub bwd: usize,
    pub gain: f64,
    pub lowpass_hz: f64,
    pub highpass_hz: f64,
}

impl NoiseSpec {
    pub fn new(src: usize, fwd: usize, bwd: usize, gain: f64) -> Self {
        NoiseSpec { src, fwd, bwd, gain, lowpass_hz: 7000.0, highpass_hz: 400.0 }
    }
    pub fn band(mut self, lowpass_hz: f64, highpass_hz: f64) -> Self {
        self.lowpass_hz = lowpass_hz;
        self.highpass_hz = highpass_hz;
        self
    }
}

#[derive(Clone, Copy, Debug)]
pub struct NoiseSource {
    pub src: usize,
    pub fwd: usize,
    pub bwd: usize,
    pub gain: f64,
    // band-shaping filter state
    hp: f64,
    lp1: f64,
    lp2: f64,
    lp_coef: f64,
    hp_coef: f64,
    /// last amplitude (telemetry)
    pub level: f64,
}

#[derive(Clone, Debug)]
pub struct AirwayNetwork {
    pub fs: f64,
    pub t: f64,
    inv_t: f64,

    pub tubes: Vec<Tube>,
    pub tube_names: Vec<String>,
    /// current total length of each tube (cm)
    pub tube_length: Vec<f64>,
    tube_specs: Vec<TubeSpec>,
    finalized: bool,

    // --- nodes ---
    pub n_nodes: usize,
    pub p: Vec<f64>,
    /// current node area (cm²)
    pub area: Vec<f64>,
    area_target: Vec<f64>,
    area_step: Vec<f64>,
    /// current minimum (sub-section) area per node: drives kinetic losses and Reynolds numbers
    pub amin: Vec<f64>,
    amin_target: Vec<f64>,
    amin_step: Vec<f64>,
    /// nodes with ≥3 connections get a compliance floor for leapfrog stability
    is_junction: Vec<bool>,
    inv_lsum: Vec<f64>,
    /// per-sample reciprocal minimum area (jet losses)
    inv_amin: Vec<f64>,
    /// neighbour lists (CSR) for redistributing squeezed volume of nearly closed nodes
    nbr_start: Vec<usize>,
    nbr_list: Vec<usize>,
    spill: Vec<f64>,
    /// band-limited moving-wall volume source (2-pole low-pass state per node)
    vol_src1: Vec<f64>,
    vol_src2: Vec<f64>,
    vol_lp_coef: f64,
    /// cut-off of the moving-wall volume source (Hz): articulator-driven flow is sub-audio
    pub volume_source_hz: f64,
    /// below this node area (cm²) displaced volume is pushed into the neighbours
    pub squeeze_area: f64,
    /// model switches (diagnostics / ablation)
    pub enable_volume_source: bool,
    pub enable_junction_floor: bool,
    pub energy_safe: bool,
    /// diagnostics: use the larger kinetic coefficient for both flow directions
    pub symmetric_kinetic: bool,
    /// current section length (cm)
    pub dx: Vec<f64>,
    dx_target: Vec<f64>,
    dx_step: Vec<f64>,
    vol: Vec<f64>,
    inv_a: Vec<f64>,
    /// per-sample half-section terms of each node, shared by its branches (same operations, in
    /// the same order, as computing them per branch): Δ/A, and S·Δ·√A/A²·visc factor
    half_l: Vec<f64>,
    half_r: Vec<f64>,
    sqrt_a: Vec<f64>,
    flow_sum: Vec<f64>,
    /// external volume-velocity injection per node for the next step (cleared after use)
    pub ext_flow: Vec<f64>,
    fixed: Vec<bool>,
    wall_m: Vec<f64>,
    wall_r: Vec<f64>,
    wall_k: Vec<f64>,
    /// perimeter factor·2√π (multiply by √A·Δ for wall area)
    wall_perim: Vec<f64>,
    wall_rad: Vec<f64>,
    has_wall: Vec<bool>,
    pub wall_y: Vec<f64>,
    wall_v: Vec<f64>,
    /// per-node wall volume velocity (telemetry)
    pub wall_u: Vec<f64>,
    node_tube: Vec<usize>,
    visc_f: Vec<f64>,
    rad_of: Vec<i32>,

    // --- branches ---
    pub n_branches: usize,
    b_a: Vec<usize>,
    b_b: Vec<usize>,
    b_kind: Vec<u8>,
    port_specs: Vec<Option<PortSpec>>,
    pub u: Vec<f64>,
    mom: Vec<f64>,
    l_prev: Vec<f64>,
    /// extra series pressure sources (noise, driven sources), cleared each sample
    pub psrc: Vec<f64>,
    /// port branch area (cm²), current
    pub port_area: Vec<f64>,
    port_area_target: Vec<f64>,
    port_area_step: Vec<f64>,
    port_len: Vec<f64>,
    port_kin: Vec<f64>,
    port_kex: Vec<f64>,
    port_slit: Vec<f64>,
    port_half: Vec<bool>,
    port_extra_r: Vec<f64>,
    /// branch "effective" area used for telemetry and Reynolds numbers
    pub branch_area: Vec<f64>,

    // --- radiation ---
    rad_nodes: Vec<usize>,
    rad_ul: Vec<f64>,
    rad_l_prev: Vec<f64>,
    /// radiated volume velocity of each radiator (telemetry)
    pub rad_u: Vec<f64>,
    rad_prev_total: f64,

    // --- sources/boundaries ---
    noise: Vec<NoiseSource>,
    noise_next: Vec<NoiseSource>,
    rng: Rng,
    pending_fixed: Vec<usize>,
    /// closure threshold (cm²): below this a branch passes no flow
    pub closed_area: f64,
    /// node area floor for volume/compliance (cm²)
    pub min_node_area: f64,
    /// global viscous loss scale
    pub viscous_scale: f64,
    /// reference angular frequency for frequency-independent viscous loss
    pub viscous_omega: f64,
    /// scale on turbulence noise gain
    pub noise_scale: f64,
    /// last output sample (radiated pressure derivative)
    pub out: f64,
}

impl AirwayNetwork {
    pub fn new(fs: f64) -> Self {
        AirwayNetwork {
            fs,
            t: 1.0 / fs,
            inv_t: fs,
            tubes: Vec::new(),
            tube_names: Vec::new(),
            tube_length: Vec::new(),
            tube_specs: Vec::new(),
            finalized: false,
            n_nodes: 0,
            p: Vec::new(),
            area: Vec::new(),
            area_target: Vec::new(),
            area_step: Vec::new(),
            amin: Vec::new(),
            amin_target: Vec::new(),
            amin_step: Vec::new(),
            is_junction: Vec::new(),
            inv_lsum: Vec::new(),
            inv_amin: Vec::new(),
            nbr_start: Vec::new(),
            nbr_list: Vec::new(),
            spill: Vec::new(),
            vol_src1: Vec::new(),
            vol_src2: Vec::new(),
            vol_lp_coef: 0.0,
            volume_source_hz: 60.0,
            squeeze_area: 0.12,
            enable_volume_source: true,
            enable_junction_floor: true,
            energy_safe: true,
            symmetric_kinetic: false,
            dx: Vec::new(),
            dx_target: Vec::new(),
            dx_step: Vec::new(),
            vol: Vec::new(),
            inv_a: Vec::new(),
            half_l: Vec::new(),
            half_r: Vec::new(),
            sqrt_a: Vec::new(),
            flow_sum: Vec::new(),
            ext_flow: Vec::new(),
            fixed: Vec::new(),
            wall_m: Vec::new(),
            wall_r: Vec::new(),
            wall_k: Vec::new(),
            wall_perim: Vec::new(),
            wall_rad: Vec::new(),
            has_wall: Vec::new(),
            wall_y: Vec::new(),
            wall_v: Vec::new(),
            wall_u: Vec::new(),
            node_tube: Vec::new(),
            visc_f: Vec::new(),
            rad_of: Vec::new(),
            n_branches: 0,
            b_a: Vec::new(),
            b_b: Vec::new(),
            b_kind: Vec::new(),
            port_specs: Vec::new(),
            u: Vec::new(),
            mom: Vec::new(),
            l_prev: Vec::new(),
            psrc: Vec::new(),
            port_area: Vec::new(),
            port_area_target: Vec::new(),
            port_area_step: Vec::new(),
            port_len: Vec::new(),
            port_kin: Vec::new(),
            port_kex: Vec::new(),
            port_slit: Vec::new(),
            port_half: Vec::new(),
            port_extra_r: Vec::new(),
            branch_area: Vec::new(),
            rad_nodes: Vec::new(),
            rad_ul: Vec::new(),
            rad_l_prev: Vec::new(),
            rad_u: Vec::new(),
            rad_prev_total: 0.0,
            noise: Vec::with_capacity(16),
            noise_next: Vec::with_capacity(16),
            rng: Rng::new(12345),
            pending_fixed: Vec::new(),
            closed_area: 2e-4,
            min_node_area: 0.02,
            viscous_scale: 1.0,
            viscous_omega: 2.0 * PI * 700.0,
            noise_scale: 1.0,
            out: 0.0,
        }
    }

    pub fn add_tube(&mut self, spec: TubeSpec) -> Tube {
        assert!(!self.finalized, "network finalized");
        let t = Tube { index: self.tubes.len(), n: spec.n, first: self.n_nodes, branch_base: self.b_a.len() };
        self.tubes.push(t);
        self.tube_names.push(spec.name.clone());
        self.tube_length.push(spec.length);
        self.n_nodes += spec.n;
        // internal branches
        for i in 0..spec.n.saturating_sub(1) {
            self.push_branch(t.node(i), t.node(i + 1), KIND_SERIES, None);
        }
        self.tube_specs.push(spec);
        t
    }

    /// Connect two nodes with series half-section inertance (e.g. tube end to tube end).
    pub fn connect(&mut self, a: usize, b: usize) -> usize {
        self.push_branch(a, b, KIND_SERIES, None)
    }

    /// Connect two nodes through a duct with its own (time-varying) area: glottis, velum port, valves, necks.
    pub fn add_port(&mut self, a: usize, b: usize, spec: PortSpec) -> usize {
        self.push_branch(a, b, KIND_PORT, Some(spec))
    }

    /// Add a lumped cavity node (Helmholtz resonator volume) — returns node index.
    pub fn add_cavity(&mut self, name: &str, volume: f64, wall: Option<WallParams>) -> usize {
        // cavity = 1-node tube with area·length = volume (use a cube-ish proportion)
        let len = cbrt(volume);
        let t = self.add_tube(TubeSpec::new(name, 1, len, Area::Uniform(volume / len)).wall(wall).perimeter(1.2));
        t.first_node()
    }

    /// Prescribed-pressure boundary node (lungs, air sacs). Returns node index.
    pub fn add_pressure_node(&mut self, name: &str) -> usize {
        let t = self.add_tube(TubeSpec::new(name, 1, 1.0, Area::Uniform(100.0)));
        self.pending_fixed.push(t.first_node());
        t.first_node()
    }

    /// Attach a radiation load at an open end node. Returns radiator index.
    pub fn add_radiation(&mut self, node: usize) -> usize {
        self.rad_nodes.push(node);
        self.rad_nodes.len() - 1
    }

    fn push_branch(&mut self, a: usize, b: usize, kind: u8, spec: Option<PortSpec>) -> usize {
        self.b_a.push(a);
        self.b_b.push(b);
        self.b_kind.push(kind);
        self.port_specs.push(spec);
        self.b_a.len() - 1
    }

    pub fn finalize(&mut self) {
        if self.finalized {
            return;
        }
        self.finalized = true;
        let n = self.n_nodes;
        let b = self.b_a.len();
        self.n_branches = b;
        let zf = |len: usize| vec![0.0f64; len];
        self.p = zf(n);
        self.area = zf(n);
        self.area_target = zf(n);
        self.area_step = zf(n);
        self.amin = zf(n);
        self.amin_target = zf(n);
        self.amin_step = zf(n);
        self.is_junction = vec![false; n];
        self.inv_lsum = zf(n);
        self.inv_amin = zf(n);
        self.dx = zf(n);
        self.dx_target = zf(n);
        self.dx_step = zf(n);
        self.vol = zf(n);
        self.inv_a = zf(n);
        self.half_l = zf(n);
        self.half_r = zf(n);
        self.sqrt_a = zf(n);
        self.flow_sum = zf(n);
        self.ext_flow = zf(n);
        self.fixed = vec![false; n];
        self.wall_m = zf(n);
        self.wall_r = zf(n);
        self.wall_k = zf(n);
        self.wall_perim = zf(n);
        self.wall_rad = zf(n);
        self.has_wall = vec![false; n];
        self.wall_y = zf(n);
        self.wall_v = zf(n);
        self.wall_u = zf(n);
        self.node_tube = vec![0; n];
        self.visc_f = zf(n);
        self.rad_of = vec![-1; n];
        for ti in 0..self.tubes.len() {
            let t = self.tubes[ti];
            let spec = &self.tube_specs[ti];
            let dx = spec.length / spec.n as f64;
            for i in 0..t.n {
                let k = t.node(i);
                let a = match &spec.area {
                    Area::Uniform(a) => *a,
                    Area::Profile(v) => v[i],
                };
                self.area[k] = a;
                self.area_target[k] = a;
                self.amin[k] = a;
                self.amin_target[k] = a;
                self.dx[k] = dx;
                self.dx_target[k] = dx;
                self.node_tube[k] = t.index;
                self.visc_f[k] = spec.viscous_factor;
                if let Some(w) = spec.wall {
                    self.has_wall[k] = true;
                    self.wall_m[k] = w.mass;
                    self.wall_r[k] = w.resistance;
                    self.wall_k[k] = w.stiffness;
                }
                self.wall_perim[k] = spec.perimeter_factor * 2.0 * sqrt(PI);
                self.wall_rad[k] = spec.wall_radiation;
            }
        }
        for &k in &self.pending_fixed {
            self.fixed[k] = true;
        }
        self.u = zf(b);
        self.mom = zf(b);
        self.l_prev = zf(b);
        let mut degree = vec![0usize; n];
        for j in 0..b {
            degree[self.b_a[j]] += 1;
            degree[self.b_b[j]] += 1;
        }
        for k in 0..n {
            self.is_junction[k] = degree[k] >= 3;
        }
        self.nbr_start = vec![0; n + 1];
        for k in 0..n {
            self.nbr_start[k + 1] = self.nbr_start[k] + degree[k];
        }
        self.nbr_list = vec![0; self.nbr_start[n]];
        let mut fill_n: Vec<usize> = self.nbr_start[..n].to_vec();
        for j in 0..b {
            let (a, bb) = (self.b_a[j], self.b_b[j]);
            self.nbr_list[fill_n[a]] = bb;
            fill_n[a] += 1;
            self.nbr_list[fill_n[bb]] = a;
            fill_n[bb] += 1;
        }
        self.spill = zf(n);
        self.vol_src1 = zf(n);
        self.vol_src2 = zf(n);
        self.vol_lp_coef = 1.0 - exp((-2.0 * PI * self.volume_source_hz) / self.fs);
        self.psrc = zf(b);
        self.port_area = zf(b);
        self.port_area_target = zf(b);
        self.port_area_step = zf(b);
        self.port_len = zf(b);
        self.port_kin = zf(b);
        self.port_kex = zf(b);
        self.port_slit = zf(b);
        self.port_half = vec![false; b];
        self.port_extra_r = zf(b);
        self.branch_area = zf(b);
        for j in 0..b {
            if let Some(s) = self.port_specs[j] {
                self.port_area[j] = s.area;
                self.port_area_target[j] = s.area;
                self.port_len[j] = s.length;
                self.port_kin[j] = s.k_entrance;
                self.port_kex[j] = s.k_exit;
                self.port_slit[j] = s.slit_width;
                self.port_half[j] = s.include_half_sections;
                self.port_extra_r[j] = s.extra_resistance;
            }
        }
        let nr = self.rad_nodes.len();
        self.rad_ul = zf(nr);
        self.rad_l_prev = zf(nr);
        self.rad_u = zf(nr);
        for r in 0..nr {
            self.rad_of[self.rad_nodes[r]] = r as i32;
        }
        for k in 0..n {
            let a = js_max(self.area[k], self.min_node_area);
            self.vol[k] = a * self.dx[k];
            self.inv_a[k] = 1.0 / js_max(self.area[k], 1e-6);
        }
        self.check_cfl();
    }

    /// Courant number of the shortest non-fixed section (informational).
    pub fn check_cfl(&self) -> f64 {
        let mut min_dx = f64::INFINITY;
        for k in 0..self.n_nodes {
            if !self.fixed[k] {
                min_dx = js_min(min_dx, self.dx_target[k]);
            }
        }
        (C_SOUND * self.t) / min_dx
    }

    // ---------------------------------------------------------------- control-rate API

    /// Set target areas (and optionally total length) of a tube, reached at the end of the next block.
    pub fn set_tube_targets(&mut self, t: Tube, areas: &[f64], length: Option<f64>, min_areas: Option<&[f64]>) {
        for i in 0..t.n {
            let a = js_max(0.0, areas[i]);
            self.area_target[t.node(i)] = a;
            self.amin_target[t.node(i)] = match min_areas {
                Some(m) => js_max(0.0, js_min(a, m[i])),
                None => a,
            };
        }
        if let Some(length) = length {
            self.tube_length[t.index] = length;
            let d = length / t.n as f64;
            for i in 0..t.n {
                self.dx_target[t.node(i)] = d;
            }
        }
    }

    pub fn set_node_area_target(&mut self, node: usize, area: f64) {
        self.area_target[node] = js_max(0.0, area);
        self.amin_target[node] = self.area_target[node];
    }

    pub fn set_port_target(&mut self, branch: usize, area: f64) {
        self.port_area_target[branch] = js_max(0.0, area);
    }

    /// Immediately set a port area (per-sample sources such as the glottis call this every sample).
    #[inline]
    pub fn set_port_area(&mut self, branch: usize, area: f64) {
        self.port_area[branch] = if area < 0.0 { 0.0 } else { area };
        self.port_area_target[branch] = self.port_area[branch];
        self.port_area_step[branch] = 0.0;
    }

    #[inline]
    pub fn set_fixed_pressure(&mut self, node: usize, p: f64) {
        self.p[node] = p;
    }

    /// Jump the geometry to the current targets immediately (initialisation; no dV/dt transient).
    pub fn snap_to_targets(&mut self) {
        for k in 0..self.n_nodes {
            self.area[k] = self.area_target[k];
            self.amin[k] = self.amin_target[k];
            self.dx[k] = self.dx_target[k];
            self.vol[k] = js_max(self.area[k], self.min_node_area) * self.dx[k];
            self.inv_a[k] = 1.0 / js_max(self.area[k], 1e-6);
            self.area_step[k] = 0.0;
            self.amin_step[k] = 0.0;
            self.dx_step[k] = 0.0;
        }
        for j in 0..self.n_branches {
            if self.b_kind[j] == KIND_PORT {
                self.port_area[j] = self.port_area_target[j];
                self.port_area_step[j] = 0.0;
            }
        }
    }

    /// Prepare per-sample linear ramps toward the targets over `samples` internal samples.
    pub fn begin_block(&mut self, samples: usize) {
        let inv = 1.0 / js_max(1.0, samples as f64);
        let mut max_p = 0.0;
        for k in 0..self.n_nodes {
            self.area_step[k] = (self.area_target[k] - self.area[k]) * inv;
            self.amin_step[k] = (self.amin_target[k] - self.amin[k]) * inv;
            self.dx_step[k] = (self.dx_target[k] - self.dx[k]) * inv;
            if !self.fixed[k] {
                let ap = self.p[k].abs();
                if ap > max_p {
                    max_p = ap;
                }
            }
        }
        // flush decayed state to zero (avoids denormal slowdowns in silent tails)
        if max_p < 1e-9 {
            let mut max_u = 0.0;
            for j in 0..self.n_branches {
                max_u = js_max(max_u, self.u[j].abs());
            }
            if max_u < 1e-9 {
                self.flush_state();
            }
        }
        for j in 0..self.n_branches {
            if self.b_kind[j] == KIND_PORT {
                self.port_area_step[j] = (self.port_area_target[j] - self.port_area[j]) * inv;
            }
        }
        self.flush_tiny();
    }

    /// How many of the states `flush_tiny` looks after are denormal (for tests: none should be).
    pub fn denormal_states(&self) -> usize {
        let per_node = [&self.p, &self.wall_v, &self.wall_y, &self.vol_src1, &self.vol_src2];
        let per_branch = [&self.u, &self.mom, &self.rad_ul, &self.rad_u];
        let arrays = per_node.iter().chain(per_branch.iter()).map(|a| a.iter().filter(|x| is_denormal(**x)).count()).sum::<usize>();
        let noise = self.noise.iter().map(|s| [s.hp, s.lp1, s.lp2, s.level].iter().filter(|x| is_denormal(**x)).count()).sum::<usize>();
        arrays + noise + is_denormal(self.rad_prev_total) as usize
    }

    /// Zero whatever has decayed to nothing, each on its own. The flush above waits for the whole
    /// network to fall silent, but one part can die away while another sounds: a nasal tract shut
    /// off by the velum, a sealed cell, the wall-movement source once the mouth has stopped moving.
    /// Their states then shrink into the denormal range and stay there (a one-pole decay rounds a
    /// small enough denormal back to itself), and arithmetic on denormals is several times slower:
    /// measured, a block took four times as long after the velum had been lowered and raised.
    /// WebAssembly has no flush-to-zero mode, so it is done here, once a control block.
    fn flush_tiny(&mut self) {
        for k in 0..self.n_nodes {
            if !self.fixed[k] {
                tiny(&mut self.p[k]);
            }
            tiny(&mut self.wall_v[k]);
            tiny(&mut self.wall_y[k]);
            tiny(&mut self.vol_src1[k]);
            tiny(&mut self.vol_src2[k]);
        }
        for j in 0..self.n_branches {
            tiny(&mut self.u[j]);
            tiny(&mut self.mom[j]);
        }
        for r in 0..self.rad_ul.len() {
            tiny(&mut self.rad_ul[r]);
            tiny(&mut self.rad_u[r]);
        }
        tiny(&mut self.rad_prev_total);
        for s in self.noise.iter_mut() {
            tiny(&mut s.hp);
            tiny(&mut s.lp1);
            tiny(&mut s.lp2);
            tiny(&mut s.level);
        }
    }

    /// Replace the set of turbulence noise sources (called at control rate). Filter states of
    /// sources whose (src, fwd) pair persists are kept, to avoid clicks.
    pub fn set_noise_sources(&mut self, list: &[NoiseSpec]) {
        self.noise_next.clear();
        for s in list {
            let prev = self.noise.iter().find(|o| o.src == s.src && o.fwd == s.fwd);
            self.noise_next.push(NoiseSource {
                src: s.src,
                fwd: s.fwd,
                bwd: s.bwd,
                gain: s.gain,
                hp: prev.map_or(0.0, |p| p.hp),
                lp1: prev.map_or(0.0, |p| p.lp1),
                lp2: prev.map_or(0.0, |p| p.lp2),
                lp_coef: 1.0 - exp((-2.0 * PI * s.lowpass_hz) / self.fs),
                hp_coef: exp((-2.0 * PI * s.highpass_hz) / self.fs),
                level: 0.0,
            });
        }
        core::mem::swap(&mut self.noise, &mut self.noise_next);
    }

    fn flush_state(&mut self) {
        for k in 0..self.n_nodes {
            if !self.fixed[k] {
                self.p[k] = 0.0;
            }
            self.wall_v[k] = 0.0;
            if self.wall_y[k].abs() < 1e-12 {
                self.wall_y[k] = 0.0;
            }
        }
        self.u.fill(0.0);
        self.mom.fill(0.0);
        self.rad_ul.fill(0.0);
    }

    pub fn noise_sources(&self) -> &[NoiseSource] {
        &self.noise
    }

    // ---------------------------------------------------------------- per-sample step

    /// Advance one internal sample. Returns radiated pressure (arbitrary units ∝ dU_rad/dt).
    pub fn step(&mut self) -> f64 {
        let n = self.n_nodes;
        let nb = self.n_branches;
        let t = self.t;
        let inv_t = self.inv_t;
        let min_a = self.min_node_area;

        // 1) geometry ramps and the moving-wall volume source. The raw −dV/dt of each node is first
        //    split between the node and its open neighbours (a nearly closed cell cannot hold the air
        //    its walls displace), THEN each node's total injection is low-passed: dV/dt is piecewise
        //    constant across control blocks and the split switches as cells close, and the output is a
        //    derivative of flow, so unfiltered steps would radiate as clicks. Linear filtering after
        //    the split keeps mass conserved.
        let sq = self.squeeze_area;
        let vol_on = self.enable_volume_source;
        if vol_on {
            self.spill.fill(0.0);
        }
        {
            let area = &mut self.area;
            let amin = &mut self.amin;
            let dx = &mut self.dx;
            let inj = &mut self.spill; // the per-node raw injection accumulator
            for k in 0..n {
                let mut a = area[k] + self.area_step[k];
                if a < 0.0 {
                    a = 0.0;
                }
                area[k] = a;
                let mut am = amin[k] + self.amin_step[k];
                if am < 0.0 {
                    am = 0.0;
                }
                let amk = if am > a { a } else { am };
                amin[k] = amk;
                dx[k] += self.dx_step[k];
                let d = dx[k];
                let ia = 1.0 / (if a > 1e-6 { a } else { 1e-6 });
                self.inv_a[k] = ia;
                self.inv_amin[k] = 1.0 / (if amk > 1e-6 { amk } else { 1e-6 });
                let sa = sqrt(a);
                self.sqrt_a[k] = sa;
                self.half_l[k] = d * ia;
                self.half_r[k] = self.wall_perim[k] * d * sa * ia * ia * self.visc_f[k];
                let v = (if a > min_a { a } else { min_a }) * d;
                if vol_on {
                    let raw = -(v - self.vol[k]) * inv_t;
                    let ae = if amin[k] < a { amin[k] } else { a }; // a node sealed at its minimum cannot hold air either
                    if raw != 0.0 && ae < sq {
                        let tt = ae / sq;
                        let keep = tt * tt * (3.0 - 2.0 * tt);
                        inj[k] += raw * keep;
                        let sp = raw * (1.0 - keep);
                        let (s0, s1) = (self.nbr_start[k], self.nbr_start[k + 1]);
                        let mut n_open = 0usize;
                        for e in s0..s1 {
                            let m = self.nbr_list[e];
                            if js_min(area[m], amin[m]) >= sq || self.amin_target[m] >= sq {
                                n_open += 1;
                            }
                        }
                        if n_open > 0 {
                            let share = sp / n_open as f64;
                            for e in s0..s1 {
                                let m = self.nbr_list[e];
                                if js_min(area[m], amin[m]) >= sq || self.amin_target[m] >= sq {
                                    inj[m] += share;
                                }
                            }
                        } // else: fully sealed pocket, the squeezed air leaves laterally (absorbed)
                    } else {
                        inj[k] += raw;
                    }
                }
                self.vol[k] = v;
                self.inv_lsum[k] = 0.0;
                self.flow_sum[k] = self.ext_flow[k];
                self.ext_flow[k] = 0.0;
            }
        }
        if vol_on {
            let c = self.vol_lp_coef;
            for k in 0..n {
                self.vol_src1[k] += c * (self.spill[k] - self.vol_src1[k]);
                let s1 = self.vol_src1[k];
                self.vol_src2[k] += c * (s1 - self.vol_src2[k]);
                self.flow_sum[k] += self.vol_src2[k];
            }
        }

        // 2) turbulence noise → series pressure sources
        self.psrc.fill(0.0);
        if !self.noise.is_empty() {
            self.compute_noise();
        }

        // 3) branches
        let visc = sqrt((RHO * MU * self.viscous_omega) / 2.0) * self.viscous_scale;
        let closed = self.closed_area;
        let half_rho = 0.5 * RHO;
        let enable_energy_safe = self.energy_safe;
        let symmetric = self.symmetric_kinetic;
        {
            // the arrays the branch loop reads, borrowed once (checked indexing costs nothing
            // measurable here, against get_unchecked)
            let area = &self.area[..n];
            let amin = &self.amin[..n];
            let inv_a = &self.inv_a[..n];
            let inv_amin = &self.inv_amin[..n];
            let half_l = &self.half_l[..n];
            let half_r = &self.half_r[..n];
            let is_j = &self.is_junction[..n];
            let p = &self.p[..n];
            let flow_sum = &mut self.flow_sum[..n];
            let inv_lsum = &mut self.inv_lsum[..n];
            let (b_a, b_b, b_kind) = (&self.b_a[..nb], &self.b_b[..nb], &self.b_kind[..nb]);
            let (u_arr, mom, l_prev, psrc) = (&mut self.u[..nb], &mut self.mom[..nb], &mut self.l_prev[..nb], &self.psrc[..nb]);
            let branch_area = &mut self.branch_area[..nb];
            let port_area = &mut self.port_area[..nb];
            let (port_area_step, port_len, port_half, port_slit, port_extra_r, port_kin, port_kex) = (&self.port_area_step[..nb], &self.port_len[..nb], &self.port_half[..nb], &self.port_slit[..nb], &self.port_extra_r[..nb], &self.port_kin[..nb], &self.port_kex[..nb]);
            for j in 0..nb {
                let a = b_a[j];
                let b = b_b[j];
                let l: f64;
                let r: f64;
                let mut kf: f64;
                let mut kb: f64;
                let a_eff: f64;
                if b_kind[j] == KIND_SERIES {
                    let aa = area[a];
                    let ab = area[b];
                    let ma = amin[a];
                    let mb = amin[b];
                    a_eff = if ma < mb { ma } else { mb };
                    if (if aa < ab { aa } else { ab }) < closed || a_eff < closed {
                        u_arr[j] = 0.0;
                        mom[j] = 0.0;
                        branch_area[j] = a_eff;
                        continue;
                    }
                    let ia = inv_a[a];
                    let ib = inv_a[b];
                    l = half_rho * (half_l[a] + half_l[b]);
                    // viscous: R = S·l/A² · sqrt(ρμω/2) with S = perimeter of each half-section
                    r = 0.5 * visc * (half_r[a] + half_r[b]);
                    // Borda–Carnot: the jet leaving the narrowest point of the upstream node expands into
                    // the downstream node (sub-section minima make short constrictions lossy as they should be)
                    let ima = inv_amin[a];
                    let imb = inv_amin[b];
                    let ef = ima - ib; // a→b
                    let eb = imb - ia; // b→a
                    kf = if ef > 0.0 { half_rho * ef * ef } else { 0.0 };
                    kb = if eb > 0.0 { half_rho * eb * eb } else { 0.0 };
                    // small contraction (vena contracta) loss entering a narrower node
                    let cf = imb - ia;
                    let cb = ima - ib;
                    if cf > 0.0 {
                        kf += 0.1 * half_rho * cf * cf;
                    }
                    if cb > 0.0 {
                        kb += 0.1 * half_rho * cb * cb;
                    }
                } else {
                    port_area[j] += port_area_step[j];
                    let mut ap = port_area[j];
                    if ap < 0.0 {
                        port_area[j] = 0.0;
                        ap = 0.0;
                    }
                    a_eff = ap;
                    if ap < closed {
                        u_arr[j] = 0.0;
                        mom[j] = 0.0;
                        branch_area[j] = ap;
                        continue;
                    }
                    let ip = 1.0 / ap;
                    let len = port_len[j];
                    let mut ll = RHO * len * ip;
                    if port_half[j] {
                        ll += half_rho * (half_l[a] + half_l[b]);
                    }
                    l = ll;
                    let w = port_slit[j];
                    let mut rr = if w > 0.0 { (12.0 * MU * len * w * w) * ip * ip * ip } else { visc * 2.0 * sqrt(PI) * len * sqrt(ap) * ip * ip };
                    rr += port_extra_r[j];
                    r = rr;
                    // kinetic: entrance (contraction) + exit (jet expansion into the downstream node)
                    let ex_f = ip - inv_a[b]; // flow a→b exits into b
                    let ex_b = ip - inv_a[a]; // flow b→a exits into a
                    let kin = port_kin[j] * half_rho * ip * ip;
                    kf = kin + port_kex[j] * half_rho * (if ex_f > 0.0 { ex_f * ex_f } else { 0.0 });
                    kb = kin + port_kex[j] * half_rho * (if ex_b > 0.0 { ex_b * ex_b } else { 0.0 });
                }
                branch_area[j] = a_eff;
                // energy-safe momentum transfer when the inertance changes: closing (L↑) conserves
                // momentum (flow drops), opening (L↓) conserves flow — never injects kinetic energy
                if symmetric {
                    let km = if kf > kb { kf } else { kb };
                    kf = km;
                    kb = km;
                }
                let lp = l_prev[j];
                let m0 = if enable_energy_safe && l < lp { l * u_arr[j] } else { mom[j] };
                let c = p[a] - p[b] + psrc[j] + m0 * inv_t;
                let bq = l * inv_t + r;
                let u = if c >= 0.0 {
                    if kf > 0.0 { (2.0 * c) / (bq + sqrt(bq * bq + 4.0 * kf * c)) } else { c / bq }
                } else if kb > 0.0 {
                    (2.0 * c) / (bq + sqrt(bq * bq - 4.0 * kb * c))
                } else {
                    c / bq
                };
                u_arr[j] = u;
                mom[j] = l * u;
                l_prev[j] = l;
                flow_sum[a] -= u;
                flow_sum[b] += u;
                if is_j[a] | is_j[b] {
                    let il = 1.0 / l;
                    inv_lsum[a] += il;
                    inv_lsum[b] += il;
                }
            }
        }

        // 4) walls (velocity at half step from p(n), displacement integrates)
        let mut wall_rad_sum = 0.0;
        for k in 0..n {
            if !self.has_wall[k] {
                continue;
            }
            let m = self.wall_m[k];
            let r = self.wall_r[k];
            let v = ((m * inv_t - 0.5 * r) * self.wall_v[k] + self.p[k] - self.wall_k[k] * self.wall_y[k]) / (m * inv_t + 0.5 * r);
            self.wall_v[k] = v;
            self.wall_y[k] += t * v;
            let sa = if self.area[k] > min_a { self.sqrt_a[k] } else { sqrt(min_a) };
            let uw = self.wall_perim[k] * sa * self.dx[k] * v;
            self.wall_u[k] = uw;
            self.flow_sum[k] -= uw;
            wall_rad_sum += uw * self.wall_rad[k];
        }

        // 5) nodes (radiation loads handled semi-implicitly)
        let t2 = t * t;
        let mut rad_total = wall_rad_sum;
        let cl = self.closed_area;
        for k in 0..n {
            if self.fixed[k] {
                continue;
            }
            // sealed if the cell itself, or its narrowest point, is closed (then all its series
            // branches are closed too, and compressing its remaining volume would trap pressure)
            if self.area[k] < cl || self.amin[k] < cl {
                let rr = self.rad_of[k];
                if rr >= 0 {
                    // sealed aperture: its outer face is the atmosphere, so it relaxes to 0 (tracking the
                    // pressurised cavity behind would discharge as a radiated spike on reopening)
                    self.p[k] *= 0.98;
                } else {
                    // sealed interior cell (tissue contact): no air of its own; follow open neighbours
                    let mut sum = 0.0;
                    let mut cnt = 0usize;
                    for e in self.nbr_start[k]..self.nbr_start[k + 1] {
                        let m = self.nbr_list[e];
                        if self.area[m] >= cl && self.amin[m] >= cl {
                            sum += self.p[m];
                            cnt += 1;
                        }
                    }
                    if cnt > 0 {
                        self.p[k] += 0.02 * (sum / cnt as f64 - self.p[k]);
                    }
                }
                if rr >= 0 {
                    let rr = rr as usize;
                    // sealed aperture: let the radiated flow die away smoothly (no derivative step)
                    self.rad_ul[rr] *= 0.995;
                    self.rad_u[rr] = self.rad_ul[rr];
                    rad_total += self.rad_ul[rr];
                }
                continue;
            }
            let mut c = self.vol[k] / RHO_C2;
            // junction stability: local breathing mode ω² ≈ ΣL⁻¹/C must satisfy T²ω² ≤ 2.4
            if self.is_junction[k] && self.enable_junction_floor {
                let c_min = (t2 * self.inv_lsum[k]) / 2.4;
                if c < c_min {
                    c = c_min;
                }
            }
            let r = self.rad_of[k];
            if r < 0 {
                self.p[k] += (t / c) * self.flow_sum[k];
            } else {
                let r = r as usize;
                let a = if self.area[k] > 1e-4 { self.area[k] } else { 1e-4 };
                let lr = (8.0 * RHO) / (3.0 * PI * sqrt(PI * a));
                let rr = (128.0 * RHO * C_SOUND) / (9.0 * PI * PI * a);
                let p_old = self.p[k];
                // energy-safe: when the radiation inertance grows (aperture closing) conserve momentum
                let lp = self.rad_l_prev[r];
                let mut ul_prev = self.rad_ul[r];
                if lp > 0.0 && lr > lp {
                    ul_prev *= lp / lr;
                }
                self.rad_l_prev[r] = lr;
                // Crank–Nicolson coupling of the node and its parallel R–L load (A-stable, energy-
                // conserving for the reactive part): Lr ∝ A^-½ against C ∝ A makes the explicit form
                // unstable at small apertures. U_L lives at integer steps; the node sees its mean.
                let h = t / (2.0 * lr);
                let g = 0.5 / rr;
                let p_new = (p_old * (c * inv_t - 0.5 * h - g) + self.flow_sum[k] - ul_prev) / (c * inv_t + 0.5 * h + g);
                self.p[k] = p_new;
                let ul = ul_prev + h * (p_old + p_new);
                self.rad_ul[r] = ul;
                let ur = 0.5 * (ul_prev + ul) + g * (p_new + p_old);
                self.rad_u[r] = ur;
                rad_total += ur;
            }
        }
        let out = (rad_total - self.rad_prev_total) * inv_t;
        self.rad_prev_total = rad_total;
        self.out = out;
        out
    }

    fn compute_noise(&mut self) {
        // white noise power per Hz scales with fs: normalise to a 96 kHz reference
        let scale = self.noise_scale * sqrt(96000.0 / self.fs);
        let sat = 12000.0 * 12000.0 - RE_CRIT * RE_CRIT;
        for i in 0..self.noise.len() {
            let s = &mut self.noise[i];
            let a = self.branch_area[s.src];
            let u = self.u[s.src];
            let mut amp = 0.0;
            if a > self.closed_area {
                // Re = v·d_h/ν with d_h = 2√(A/π) → Re = |U|·2/(ν·√(πA))
                let re = (u.abs() * 2.0) / (NU * sqrt(PI * a));
                if re > RE_CRIT {
                    let x = re * re - RE_CRIT * RE_CRIT;
                    amp = (s.gain * scale * x) / (1.0 + x / sat); // bounded growth at very high Re
                }
            }
            // white → high-pass (1st order) → 2nd-order low-pass
            let w = self.rng.bipolar() * 1.732;
            s.hp += (1.0 - s.hp_coef) * (w - s.hp); // s.hp holds a low-passed copy
            let hp_out = w - s.hp;
            s.lp1 += s.lp_coef * (hp_out - s.lp1);
            s.lp2 += s.lp_coef * (s.lp1 - s.lp2);
            s.level = amp;
            if amp == 0.0 {
                continue;
            }
            let v = amp * s.lp2;
            if u >= 0.0 {
                self.psrc[s.fwd] += v;
            } else {
                self.psrc[s.bwd] -= v;
            }
        }
    }

    /// Total radiated volume velocity of radiator r.
    pub fn radiated_flow(&self, r: usize) -> f64 {
        self.rad_u[r]
    }

    /// Linearised element values at the *target* geometry (what the next block ramps to), for
    /// frequency-domain analysis. Same formulas as step(); kinetic losses are omitted (they
    /// vanish for small signals about zero mean flow).
    pub fn linear_elements(&self) -> LinearElements {
        let n = self.n_nodes;
        let nb = self.n_branches;
        let visc = sqrt((RHO * MU * self.viscous_omega) / 2.0) * self.viscous_scale;
        let a_t = &self.area_target;
        let dx = &self.dx_target;
        let mut l = vec![0.0; nb];
        let mut r = vec![0.0; nb];
        let mut open = vec![false; nb];
        for j in 0..nb {
            let a = self.b_a[j];
            let b = self.b_b[j];
            let ia = 1.0 / js_max(a_t[a], 1e-6);
            let ib = 1.0 / js_max(a_t[b], 1e-6);
            if self.b_kind[j] == KIND_SERIES {
                if js_min(a_t[a], a_t[b]) < self.closed_area {
                    continue;
                }
                open[j] = true;
                l[j] = 0.5 * RHO * (dx[a] * ia + dx[b] * ib);
                r[j] = 0.5 * visc * (self.wall_perim[a] * dx[a] * sqrt(a_t[a]) * ia * ia * self.visc_f[a] + self.wall_perim[b] * dx[b] * sqrt(a_t[b]) * ib * ib * self.visc_f[b]);
            } else {
                let ap = self.port_area_target[j];
                if ap < self.closed_area {
                    continue;
                }
                open[j] = true;
                let ip = 1.0 / ap;
                let len = self.port_len[j];
                l[j] = RHO * len * ip + if self.port_half[j] { 0.5 * RHO * (dx[a] * ia + dx[b] * ib) } else { 0.0 };
                let w = self.port_slit[j];
                r[j] = (if w > 0.0 { 12.0 * MU * len * w * w * ip * ip * ip } else { visc * 2.0 * sqrt(PI) * len * sqrt(ap) * ip * ip }) + self.port_extra_r[j];
            }
        }
        let mut c = vec![0.0; n];
        let mut wall_area = vec![0.0; n];
        for k in 0..n {
            let a = js_max(a_t[k], self.min_node_area);
            c[k] = (a * dx[k]) / RHO_C2;
            wall_area[k] = if self.has_wall[k] { self.wall_perim[k] * sqrt(a) * dx[k] } else { 0.0 };
        }
        LinearElements {
            n_nodes: n,
            n_branches: nb,
            a: self.b_a.clone(),
            b: self.b_b.clone(),
            l,
            r,
            open,
            c,
            wall_area,
            wall_m: self.wall_m.clone(),
            wall_r: self.wall_r.clone(),
            wall_k: self.wall_k.clone(),
            wall_rad: self.wall_rad.clone(),
            fixed: self.fixed.clone(),
            rad_nodes: self.rad_nodes.clone(),
            rad_area: self.rad_nodes.iter().map(|&k| js_max(a_t[k], 1e-4)).collect(),
        }
    }

    /// Tube index of a node.
    pub fn tube_of_node(&self, node: usize) -> usize {
        self.node_tube[node]
    }

    /// Reset all acoustic state.
    pub fn reset(&mut self) {
        self.p.fill(0.0);
        self.u.fill(0.0);
        self.mom.fill(0.0);
        self.l_prev.fill(0.0);
        self.wall_y.fill(0.0);
        self.wall_v.fill(0.0);
        self.rad_ul.fill(0.0);
        self.rad_l_prev.fill(0.0);
        self.rad_prev_total = 0.0;
    }
}
