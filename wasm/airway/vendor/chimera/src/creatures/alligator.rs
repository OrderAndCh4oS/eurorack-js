//! American alligator: bellows are noisy and chaotic with most power far below 100 Hz; the body
//! vibrates the water into a "dance" before the audible roar. Chaotic laryngeal source, long tract,
//! closed mouth (sound leaves through nostrils and skin).

use super::build::{CMH2O, fill_areas};
use super::mammal::{MammalAirway, MammalSpec, mammal_airway, mammal_noise, step_glottis};
use super::types::{CallDef, CallKey, CreatureDef, CreatureGroup, CreatureSim, ParamDef};
use crate::airway::network::{AirwayNetwork, Tube};
use crate::math::js_min;

const PITCH: usize = 0;
const CHAOS: usize = 1;
const PRESSURE: usize = 2;
const MOUTH: usize = 3;
const NOSTRILS: usize = 4;
const HISS: usize = 5;

pub struct Alligator {
    a: MammalAirway,
    tubes: Vec<(&'static str, Tube)>,
    velum: usize,
}

fn create(fs: f64) -> Box<dyn CreatureSim> {
    let mut a = mammal_airway(fs, MammalSpec { trachea: (30.0, 6.0), pharynx: (18.0, 7.0), oral: (24.0, 6.0), nasal: Some((26.0, 1.8)), wall: None, wall_radiation: Some(1.0), coarse: Some(1.3), nasal_radiates: None }, |_, _| {});
    a.glottis_src.threshold = 1.5 * CMH2O;
    let nasal = a.nasal.expect("alligator has a nasal tube");
    let velum = a.velum.expect("alligator has a velum");
    let tubes = vec![("trachea", a.trachea), ("pharynx", a.pharynx), ("oral", a.oral), ("nasal", nasal)];
    Box::new(Alligator { a, tubes, velum })
}

impl CreatureSim for Alligator {
    fn net(&self) -> Option<&AirwayNetwork> {
        Some(&self.a.net)
    }
    fn net_mut(&mut self) -> Option<&mut AirwayNetwork> {
        Some(&mut self.a.net)
    }
    fn tubes(&self) -> &[(&'static str, Tube)] {
        &self.tubes
    }
    fn gain(&self) -> f64 {
        2.8e-7
    }
    fn control(&mut self, p: &[f64], gate: f64, _dt: f64) {
        let a = &mut self.a;
        a.net.set_fixed_pressure(a.lungs, p[PRESSURE] * CMH2O * gate);
        let g = &mut a.glottis_src.params;
        g.f0 = p[PITCH];
        g.amplitude = 0.9 * (1.0 - p[HISS]);
        g.abduction = 0.02 + 0.8 * p[HISS];
        g.open_quotient = 0.5;
        g.closure_sharpness = 0.8;
        g.effort = 1.0;
        g.chaos = p[CHAOS];
        g.jitter = 0.01 + 0.05 * p[CHAOS];
        g.shimmer = 0.05 + 0.25 * p[CHAOS];
        g.drift = 8.0;
        let ph_areas = fill_areas(a.pharynx, |_| 7.0, &mut a.phar_area);
        a.net.set_tube_targets(a.pharynx, ph_areas, None, None);
        let m = p[MOUTH];
        let or_areas = fill_areas(a.oral, |u| if u > 0.85 { 0.05 + 12.0 * m } else { 6.0 }, &mut a.oral_area);
        a.net.set_tube_targets(a.oral, or_areas, None, None);
        a.net.set_port_target(self.velum, 0.4 + 1.6 * p[NOSTRILS]);
        mammal_noise(a, 6e-6, Some(4e-6));
    }
    #[inline]
    fn sample(&mut self) -> f64 {
        step_glottis(&mut self.a);
        self.a.net.step()
    }
    fn flush_tiny(&mut self) {
        self.a.glottis_src.flush_tiny();
    }
    fn source_state(&self, out: &mut Vec<(&'static str, f64)>) {
        out.clear();
        out.push(("glottis", js_min(1.0, self.a.glottis_src.area / 1.0)));
    }
}

pub fn def() -> CreatureDef {
    let k = CallKey::new;
    CreatureDef {
        id: "alligator",
        name: "American alligator",
        latin: "Alligator mississippiensis",
        group: CreatureGroup::Reptile,
        blurb: "A chaotic, very low laryngeal roar through a long, closed-mouthed tract; the whole body radiates.",
        role: "Distorted sub drones, noise bass, impacts",
        oversample: 2,
        gate_times: None,
        params: vec![
            ParamDef::new("pitch", "Pitch", 12.0, 120.0, 28.0).unit("Hz").log().smooth(0.05).pitch(),
            ParamDef::new("chaos", "Bifurcation (period doubling → chaos)", 0.0, 1.0, 0.75).smooth(0.05),
            ParamDef::new("pressure", "Breath pressure", 3.0, 40.0, 18.0).unit("cmH₂O").smooth(0.03),
            ParamDef::new("mouth", "Mouth opening", 0.0, 1.0, 0.02).smooth(0.05),
            ParamDef::new("nostrils", "Nasal passage", 0.0, 1.0, 0.8).smooth(0.05),
            ParamDef::new("hiss", "Hiss (open glottis)", 0.0, 1.0, 0.0).smooth(0.04),
        ],
        calls: vec![
            CallDef::new(
                "bellow",
                "Bellow",
                "Two seconds of chaotic roar, rising into full chaos",
                Some(28.0),
                vec![k(0.0, &[("gate", 0.0), ("chaos", 0.55), ("pitch", 30.0), ("hiss", 0.0), ("mouth", 0.02)]), k(0.15, &[("gate", 1.0)]), k(1.6, &[("gate", 1.0), ("chaos", 0.95), ("pitch", 24.0)]), k(2.0, &[("gate", 0.0)])],
            ),
            CallDef::new("growl", "Growl", "Short, rough warning", Some(45.0), vec![k(0.0, &[("gate", 1.0), ("chaos", 0.7), ("pitch", 45.0), ("mouth", 0.15)]), k(0.5, &[("pitch", 38.0)]), k(0.6, &[("gate", 0.0)])]),
            CallDef::new(
                "hiss",
                "Hiss",
                "Open mouth, open glottis: pure turbulence",
                None,
                vec![k(0.0, &[("gate", 0.0), ("hiss", 1.0), ("mouth", 0.9)]), k(0.1, &[("gate", 1.0)]), k(1.2, &[("gate", 1.0)]), k(1.3, &[("gate", 0.0), ("hiss", 0.0), ("mouth", 0.02)])],
            ),
            CallDef::new("dance", "Water dance", "Steady subsonic throb that shakes the water", Some(18.0), vec![k(0.0, &[("gate", 1.0), ("chaos", 0.0), ("pitch", 18.0), ("mouth", 0.0)]), k(1.6, &[("gate", 1.0)]), k(1.7, &[("gate", 0.0), ("chaos", 0.75)])]),
        ],
        events: vec![],
        create,
    }
    .resolved()
}
