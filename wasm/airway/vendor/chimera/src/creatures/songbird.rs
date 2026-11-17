//! Two-voice songbird (thrush-sized). Each side of the syrinx has its own labial oscillator and
//! pitch; both bronchi merge into the trachea → larynx → oropharyngeal–oesophageal cavity (OEC,
//! a Helmholtz resonator whose volume can track f0 for pure tones) → beak (gape controls radiation).

use super::build::{TubeArea, TubeOpts, fill_areas, tube};
use super::types::{CallDef, CallKey, CreatureDef, CreatureGroup, CreatureSim, Curve, GateTimes, ParamDef};
use crate::airway::network::{AirwayNetwork, PortSpec, Tube};
use crate::math::{cbrt, js_max, js_min, pow};
use crate::physics::WALL_TRACHEA;
use crate::sources::syrinx::SyrinxLabia;

const OEC_NECK: f64 = 0.03; // cm² (larynx)
const OEC_LEN: f64 = 0.35; // cm, with end corrections
const AMAX: f64 = 0.03;

// parameter indices (order of `def().params`)
const PITCH: usize = 0;
const INTERVAL: usize = 1;
const VOICES: usize = 2;
const DRIVE: usize = 3;
const TENSION: usize = 4;
const PRESSURE: usize = 5;
const PURITY: usize = 6;
const OEC: usize = 7;
const GAPE: usize = 8;

pub struct Songbird {
    net: AirwayNetwork,
    tubes: Vec<(&'static str, Tube)>,
    beak: Tube,
    sac: usize,
    v_l: usize,
    v_r: usize,
    oec: usize,
    oec_len: f64,
    lab_l: SyrinxLabia,
    lab_r: SyrinxLabia,
    beak_areas: Vec<f64>,
}

fn create(fs: f64) -> Box<dyn CreatureSim> {
    let mut net = AirwayNetwork::new(fs);
    let bron_l = tube(&mut net, "bronchusL", fs, 0.8, TubeArea::Uniform(0.02), TubeOpts::default());
    let bron_r = tube(&mut net, "bronchusR", fs, 0.8, TubeArea::Uniform(0.02), TubeOpts::default());
    let trachea = tube(&mut net, "trachea", fs, 3.6, TubeArea::Uniform(0.045), TubeOpts { wall: Some(WALL_TRACHEA), ..Default::default() });
    let sac = net.add_pressure_node("air sac");
    net.add_port(sac, bron_l.first_node(), PortSpec::new(0.05, 0.4));
    net.add_port(sac, bron_r.first_node(), PortSpec::new(0.05, 0.4));
    let v_l = net.add_port(bron_l.last_node(), trachea.first_node(), PortSpec::new(0.0, 0.08).kinetic(0.5, 1.0));
    let v_r = net.add_port(bron_r.last_node(), trachea.first_node(), PortSpec::new(0.0, 0.08).kinetic(0.5, 1.0));
    let oec = net.add_cavity("oec", 0.4, None);
    net.add_port(trachea.last_node(), oec, PortSpec::new(OEC_NECK, 0.25).kinetic(0.3, 0.8));
    let beak = tube(&mut net, "beak", fs, 1.3, TubeArea::Uniform(0.08), TubeOpts::default());
    net.connect(oec, beak.first_node());
    net.add_radiation(beak.last_node());
    net.finalize();
    Box::new(Songbird {
        net,
        tubes: vec![("trachea", trachea), ("beak", beak), ("bronchusL", bron_l), ("bronchusR", bron_r)],
        beak,
        sac,
        v_l,
        v_r,
        oec,
        oec_len: cbrt(0.4),
        lab_l: SyrinxLabia::new(fs, 0.0),
        lab_r: SyrinxLabia::new(fs, 1.0),
        beak_areas: vec![0.0; beak.n],
    })
}

impl CreatureSim for Songbird {
    fn net(&self) -> Option<&AirwayNetwork> {
        Some(&self.net)
    }
    fn net_mut(&mut self) -> Option<&mut AirwayNetwork> {
        Some(&mut self.net)
    }
    fn tubes(&self) -> &[(&'static str, Tube)] {
        &self.tubes
    }
    fn gain(&self) -> f64 {
        4.8e-7
    }
    fn control(&mut self, p: &[f64], gate: f64, _dt: f64) {
        let (lab_l, lab_r) = (&mut self.lab_l, &mut self.lab_r);
        self.net.set_fixed_pressure(self.sac, p[PRESSURE] * 1000.0 * gate * 10.0); // kPa → dyn/cm² (×10 000)
        lab_l.f0 = p[PITCH];
        lab_r.f0 = p[PITCH] * pow(2.0, p[INTERVAL] / 12.0);
        lab_l.drive = p[DRIVE];
        lab_r.drive = p[DRIVE];
        lab_l.tension = p[TENSION];
        lab_r.tension = p[TENSION];
        // voices: 0 = left only, 0.5 = both, 1 = right only
        lab_l.gate = if p[VOICES] <= 0.5 { 1.0 } else { js_max(0.0, 2.0 - 2.0 * p[VOICES]) };
        lab_r.gate = if p[VOICES] >= 0.5 { 1.0 } else { js_max(0.0, 2.0 * p[VOICES]) };
        // OEC tracks the (lower) fundamental for pure tones, or stays at its own size
        let f_t = js_min(lab_l.f0, lab_r.f0);
        let v_track = OEC_NECK / (OEC_LEN * pow(f_t / 5570.0, 2.0));
        let vol = js_min(2.5, js_max(0.04, p[PURITY] * v_track + (1.0 - p[PURITY]) * p[OEC]));
        self.net.set_node_area_target(self.oec, vol / self.oec_len);
        let gape = p[GAPE];
        let areas = fill_areas(self.beak, |u| 0.012 + gape * (0.05 + 0.22 * u), &mut self.beak_areas);
        self.net.set_tube_targets(self.beak, areas, None, None);
    }
    #[inline]
    fn sample(&mut self) -> f64 {
        let a = AMAX * self.lab_l.next();
        self.net.set_port_area(self.v_l, a);
        let a = AMAX * self.lab_r.next();
        self.net.set_port_area(self.v_r, a);
        self.net.step()
    }
    fn source_state(&self, out: &mut Vec<(&'static str, f64)>) {
        out.clear();
        out.push(("left", self.lab_l.opening));
        out.push(("right", self.lab_r.opening));
    }
}

// --- calls --------------------------------------------------------------------------------------
fn trill(f0: f64, rate: f64, n: usize, sweep: f64) -> Vec<CallKey> {
    let mut keys = Vec::new();
    let per = 1.0 / rate;
    for i in 0..n {
        let t = i as f64 * per;
        keys.push(CallKey::new(t, &[("gate", 0.0), ("pitch", f0 * (1.0 - sweep / 2.0))]).curve(Curve::Step));
        keys.push(CallKey::new(t + per * 0.08, &[("gate", 1.0)]));
        keys.push(CallKey::new(t + per * 0.62, &[("gate", 1.0), ("pitch", f0 * (1.0 + sweep / 2.0))]).curve(Curve::Exp));
        keys.push(CallKey::new(t + per * 0.75, &[("gate", 0.0)]));
    }
    keys
}

pub fn def() -> CreatureDef {
    let k = CallKey::new;
    let mut trill_keys = vec![k(0.0, &[("voices", 0.15), ("drive", 0.3)])];
    trill_keys.extend(trill(3000.0, 16.0, 18, 0.35));
    let mut chirp_keys = vec![k(0.0, &[("voices", 0.15), ("drive", 0.4)])];
    for i in 0..9 {
        let fi = i as f64;
        let t = fi * (0.14 - fi * 0.008);
        chirp_keys.push(k(t, &[("gate", 0.0), ("pitch", 7000.0 - fi * 300.0)]).curve(Curve::Step));
        chirp_keys.push(k(t + 0.01, &[("gate", 1.0)]));
        chirp_keys.push(k(t + 0.06, &[("gate", 1.0), ("pitch", 2400.0 - fi * 80.0)]).curve(Curve::Exp));
        chirp_keys.push(k(t + 0.07, &[("gate", 0.0)]));
    }
    let mut buzz_keys = vec![k(0.0, &[("voices", 0.5), ("drive", 0.95), ("tension", 0.15), ("interval", 0.5), ("pitch", 1200.0), ("purity", 0.1), ("gate", 0.0)])];
    for i in 0..8 {
        let fi = i as f64;
        buzz_keys.push(k(0.02 + fi * 0.07, &[("gate", 1.0)]));
        buzz_keys.push(k(0.06 + fi * 0.07, &[("gate", 0.35)]));
    }
    buzz_keys.push(k(0.6, &[("gate", 0.0)]));
    CreatureDef {
        id: "songbird",
        name: "Songbird",
        latin: "Hylocichla mustelina & kin",
        group: CreatureGroup::Bird,
        blurb: "Two independent labial pairs in the syrinx, one per bronchus, each with its own pitch; a throat cavity tracks the note.",
        role: "Shimmering two-note leads, arpeggio trills, glitchy chirps",
        oversample: 4,
        gate_times: Some(GateTimes { attack: 0.004, release: 0.012 }),
        params: vec![
            ParamDef::new("pitch", "Pitch, left voice", 400.0, 9000.0, 2600.0).unit("Hz").log().smooth(0.008).pitch(),
            ParamDef::new("interval", "Right voice interval", -12.0, 12.0, 7.0).unit("st").smooth(0.02).digits(1),
            ParamDef::new("voices", "Left ↔ both ↔ right", 0.0, 1.0, 0.5).smooth(0.02),
            ParamDef::new("drive", "Drive (pure → raspy)", 0.0, 1.0, 0.35).smooth(0.02),
            ParamDef::new("tension", "Labial tension", 0.0, 1.0, 0.4).smooth(0.02),
            ParamDef::new("pressure", "Air-sac pressure", 0.1, 2.0, 0.9).unit("kPa").smooth(0.01).digits(2),
            ParamDef::new("purity", "Throat tracks note", 0.0, 1.0, 0.8).smooth(0.02),
            ParamDef::new("oec", "Throat cavity size", 0.05, 2.0, 0.4).unit("cm³").log().smooth(0.03).digits(2),
            ParamDef::new("gape", "Beak gape", 0.0, 1.0, 0.55).smooth(0.02),
        ],
        calls: vec![
            CallDef::new(
                "flute",
                "Flute phrase",
                "Wood-thrush style: three notes, then a two-voice shimmer",
                Some(2600.0),
                vec![
                    k(0.0, &[("gate", 0.0), ("pitch", 2000.0), ("voices", 0.15), ("drive", 0.25), ("interval", 7.0)]),
                    k(0.02, &[("gate", 1.0)]),
                    k(0.2, &[("gate", 1.0), ("pitch", 2100.0)]).curve(Curve::Exp),
                    k(0.23, &[("gate", 0.0)]),
                    k(0.3, &[("gate", 1.0), ("pitch", 2600.0)]).curve(Curve::Step),
                    k(0.5, &[("pitch", 2500.0)]).curve(Curve::Exp),
                    k(0.53, &[("gate", 0.0)]),
                    k(0.6, &[("gate", 1.0), ("pitch", 3300.0), ("voices", 0.5), ("interval", 4.0)]).curve(Curve::Step),
                    k(1.1, &[("pitch", 3500.0), ("interval", 5.0)]).curve(Curve::Exp),
                    k(1.2, &[("gate", 0.0)]),
                ],
            ),
            CallDef::new("trill", "Canary trill", "16 notes a second, each a quick upsweep", Some(3000.0), trill_keys),
            CallDef::new("chirps", "Chirp cascade", "Falling chirps, faster and faster", Some(4500.0), chirp_keys),
            CallDef::new("buzz", "Finch buzz", "Zebra-finch style: raspy, pulsed by mini-breaths", Some(1200.0), buzz_keys),
        ],
        events: vec![],
        create,
    }
    .resolved()
}
