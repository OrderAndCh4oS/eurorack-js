//! Parametrised mammalian/reptilian airway: lungs → trachea → glottis → pharynx ─┬─ oral → mouth
//!                                                                             └─ velum → nasal → nostrils

use super::build::{TubeArea, TubeOpts, lungs, tube};
use crate::airway::network::{AirwayNetwork, NoiseSpec, PortSpec, Tube};
use crate::math::{js_max, sqrt};
use crate::physics::{WALL_NASAL, WALL_SOFT, WALL_TRACHEA, WallParams};
use crate::sources::glottis::ParametricGlottis;

#[derive(Clone, Copy, Debug)]
pub struct MammalSpec {
    /// (length, area)
    pub trachea: (f64, f64),
    pub pharynx: (f64, f64),
    pub oral: (f64, f64),
    pub nasal: Option<(f64, f64)>,
    pub wall: Option<WallParams>,
    /// fraction of wall motion that radiates (body/skin radiation)
    pub wall_radiation: Option<f64>,
    /// coarse sections for very long tubes (×dxMin)
    pub coarse: Option<f64>,
    /// the nasal tube ends in nostrils (default) or continues into something else (trunk)
    pub nasal_radiates: Option<bool>,
}

/// The tubes handed to `mammal_airway`'s `extra` builder.
#[derive(Clone, Copy, Debug)]
pub struct MammalTubes {
    pub trachea: Tube,
    pub pharynx: Tube,
    pub oral: Tube,
    pub nasal: Option<Tube>,
}

#[derive(Clone, Debug)]
pub struct MammalAirway {
    pub net: AirwayNetwork,
    pub trachea: Tube,
    pub pharynx: Tube,
    pub oral: Tube,
    pub nasal: Option<Tube>,
    pub lungs: usize,
    pub glottis: usize,
    /// the velum port (TS: −1 without a nasal tube)
    pub velum: Option<usize>,
    pub glottis_src: ParametricGlottis,
    pub phar_area: Vec<f64>,
    pub oral_area: Vec<f64>,
}

pub fn mammal_airway(fs: f64, s: MammalSpec, extra: impl FnOnce(&mut AirwayNetwork, &MammalTubes)) -> MammalAirway {
    let mut net = AirwayNetwork::new(fs);
    let wall = s.wall.unwrap_or(WALL_SOFT);
    let coarse = s.coarse.unwrap_or(1.0);
    let wall_radiation = s.wall_radiation.unwrap_or(0.25);
    let trachea = tube(&mut net, "trachea", fs, s.trachea.0, TubeArea::Uniform(s.trachea.1), TubeOpts { wall: Some(WALL_TRACHEA), coarse: Some(js_max(coarse, 1.6)), max: Some(60.0), ..Default::default() });
    let pharynx = tube(&mut net, "pharynx", fs, s.pharynx.0, TubeArea::Uniform(s.pharynx.1), TubeOpts { wall: Some(wall), coarse: Some(coarse), wall_radiation: Some(wall_radiation), perimeter_factor: Some(1.3), ..Default::default() });
    let oral = tube(&mut net, "oral", fs, s.oral.0, TubeArea::Uniform(s.oral.1), TubeOpts { wall: Some(wall), coarse: Some(coarse), wall_radiation: Some(wall_radiation), perimeter_factor: Some(1.5), ..Default::default() });
    let nasal = s.nasal.map(|(len, area)| tube(&mut net, "nasal", fs, len, TubeArea::Uniform(area), TubeOpts { wall: Some(WALL_NASAL), coarse: Some(coarse), perimeter_factor: Some(2.6), viscous_factor: Some(2.0), ..Default::default() }));
    let lung_node = lungs(&mut net, trachea.first_node(), s.trachea.1);
    let glottis = net.add_port(trachea.last_node(), pharynx.first_node(), PortSpec::new(0.0, 0.4).kinetic(0.37, 1.0).slit(sqrt(s.trachea.1) * 0.9));
    net.connect(pharynx.last_node(), oral.first_node());
    let velum = nasal.map(|nasal| net.add_port(pharynx.last_node(), nasal.first_node(), PortSpec::new(0.0, 1.0).kinetic(0.3, 0.8)));
    net.add_radiation(oral.last_node());
    if let Some(nasal) = nasal
        && s.nasal_radiates != Some(false)
    {
        net.add_radiation(nasal.last_node());
    }
    extra(&mut net, &MammalTubes { trachea, pharynx, oral, nasal });
    net.finalize();
    MammalAirway { net, trachea, pharynx, oral, nasal, lungs: lung_node, glottis, velum, glottis_src: ParametricGlottis::new(fs), phar_area: vec![0.0; pharynx.n], oral_area: vec![0.0; oral.n] }
}

/// Register turbulence sources: aspiration at the glottis (hiss, breathiness) and the narrowest
/// point of the oral tube (mouth/teeth hiss). Call at control rate. `oral: None` (or 0) adds no
/// oral source, as TS's falsy `gains.oral` did.
pub fn mammal_noise(a: &mut MammalAirway, glottis: f64, oral: Option<f64>) {
    let mut list = [NoiseSpec::new(a.glottis, a.pharynx.branch(1.min(a.pharynx.n - 2)), a.trachea.branch(a.trachea.n - 2), glottis).band(4000.0, 250.0); 2];
    let mut len = 1;
    if let Some(gain) = oral
        && gain != 0.0
        && !gain.is_nan()
    {
        let mut mi = 0usize;
        let mut mv = f64::INFINITY;
        for i in 0..a.oral.n - 1 {
            let v = a.oral_area[i];
            if v > 0.0 && v < mv {
                mv = v;
                mi = i;
            }
        }
        if mv < 2.0 {
            list[1] = NoiseSpec::new(a.oral.branch(mi), a.oral.branch((a.oral.n - 2).min(mi + 1)), a.oral.branch(mi.saturating_sub(1)), gain).band(5000.0, 600.0);
            len = 2;
        }
    }
    a.net.set_noise_sources(&list[..len]);
}

/// Drive the glottal port from its source for one sample.
#[inline]
pub fn step_glottis(a: &mut MammalAirway) {
    let p = &a.net.p;
    let dp = p[a.trachea.last_node()] - p[a.pharynx.first_node()];
    let area = a.glottis_src.next(dp);
    a.net.set_port_area(a.glottis, area);
}
