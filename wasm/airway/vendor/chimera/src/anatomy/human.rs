//! Human midsagittal articulatory model.
//!
//! Head frame (cm): x forward, y up, glottis at (0,0) for a neutral larynx (adult male template,
//! scaled for other bodies). Fixed outer wall: posterior pharyngeal wall, velum (moves), hard
//! palate, alveolar ridge, upper incisors, upper lip. Moving inner wall: epiglottis, tongue root,
//! tongue body (circle), blade, tip, sublingual floor, lower incisors, lower lip — the lower parts
//! are carried by the jaw (rotation about the condyle).
//!
//! Area function: a semipolar grid (horizontal lines in the pharynx, radial lines in the
//! oral cavity, vertical lines at the teeth/lips) is intersected with both walls; the
//! midsagittal distance d gives area A = α·d^β per region (lips: elliptical slit d·w·π/4).
//! The epilarynx is a short parametric tube above the glottis.
//!
//! Real time: `compute` writes into a caller's [`HumanFrame`] and keeps every temporary in the
//! tract's own buffers, so a voice computing a frame per control step allocates nothing once warm.

use super::geom::{Polyline, Vec2, add, arc, bezier2, bezier3, catmull_rom, dist, lerp_v, norm, polar, ray_crossings, ray_polyline, rotate_about, scale, sub, tangent_angle, v};
use crate::math::{PI, atan2, clamp, cos, hypot, js_max, js_min, lerp, pow, sin, smoothstep, sqrt};
use serde::{Deserialize, Serialize};

/// Articulator state (template coordinates, cm, unless noted).
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HumanArtic {
    /// jaw opening at the incisors (cm)
    pub jaw: f64,
    /// tongue body centre (cm, head frame)
    pub tb_x: f64,
    pub tb_y: f64,
    /// tongue tip (cm, head frame)
    pub tt_x: f64,
    pub tt_y: f64,
    /// retroflex curl 0..1
    pub tt_curl: f64,
    /// tongue root advance (+) / retraction (−), cm
    pub root: f64,
    /// lip aperture (cm); negative = compressed
    pub lip_ap: f64,
    /// lip protrusion (cm)
    pub lip_prot: f64,
    /// lip spreading 0 (rounded) .. 1 (spread)
    pub lip_width: f64,
    /// lower lip to upper teeth 0..1
    pub labiodental: f64,
    /// velopharyngeal port area (cm²)
    pub velum: f64,
    /// larynx height offset (cm, + raised)
    pub larynx: f64,
    /// epilaryngeal narrowing 0..1 (twang)
    pub epilarynx: f64,
    /// ventricular-fold narrowing 0..1
    pub ventricular: f64,
    /// lateral channel opening 0..1 (for /l/)
    pub lateral: f64,
    /// tongue dorsum depression between closures 0..1 (clicks)
    pub dorsum: f64,
}

/// The articulators, in the engine's canonical order (telemetry arrays use it).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[repr(u8)]
pub enum ArticKey {
    Jaw,
    TbX,
    TbY,
    TtX,
    TtY,
    TtCurl,
    Root,
    LipAp,
    LipProt,
    LipWidth,
    Labiodental,
    Velum,
    Larynx,
    Epilarynx,
    Ventricular,
    Lateral,
    Dorsum,
}

pub const N_ARTIC: usize = 17;

impl ArticKey {
    pub const ALL: [ArticKey; N_ARTIC] = [
        ArticKey::Jaw,
        ArticKey::TbX,
        ArticKey::TbY,
        ArticKey::TtX,
        ArticKey::TtY,
        ArticKey::TtCurl,
        ArticKey::Root,
        ArticKey::LipAp,
        ArticKey::LipProt,
        ArticKey::LipWidth,
        ArticKey::Labiodental,
        ArticKey::Velum,
        ArticKey::Larynx,
        ArticKey::Epilarynx,
        ArticKey::Ventricular,
        ArticKey::Lateral,
        ArticKey::Dorsum,
    ];
    pub const NAMES: [&'static str; N_ARTIC] = ["jaw", "tbX", "tbY", "ttX", "ttY", "ttCurl", "root", "lipAp", "lipProt", "lipWidth", "labiodental", "velum", "larynx", "epilarynx", "ventricular", "lateral", "dorsum"];
    #[inline]
    pub fn index(self) -> usize {
        self as usize
    }
    pub fn name(self) -> &'static str {
        Self::NAMES[self as usize]
    }
    pub fn from_name(s: &str) -> Option<ArticKey> {
        Self::NAMES.iter().position(|n| *n == s).map(|i| Self::ALL[i])
    }
}

impl HumanArtic {
    #[inline]
    pub fn get(&self, k: ArticKey) -> f64 {
        match k {
            ArticKey::Jaw => self.jaw,
            ArticKey::TbX => self.tb_x,
            ArticKey::TbY => self.tb_y,
            ArticKey::TtX => self.tt_x,
            ArticKey::TtY => self.tt_y,
            ArticKey::TtCurl => self.tt_curl,
            ArticKey::Root => self.root,
            ArticKey::LipAp => self.lip_ap,
            ArticKey::LipProt => self.lip_prot,
            ArticKey::LipWidth => self.lip_width,
            ArticKey::Labiodental => self.labiodental,
            ArticKey::Velum => self.velum,
            ArticKey::Larynx => self.larynx,
            ArticKey::Epilarynx => self.epilarynx,
            ArticKey::Ventricular => self.ventricular,
            ArticKey::Lateral => self.lateral,
            ArticKey::Dorsum => self.dorsum,
        }
    }
    #[inline]
    pub fn get_mut(&mut self, k: ArticKey) -> &mut f64 {
        match k {
            ArticKey::Jaw => &mut self.jaw,
            ArticKey::TbX => &mut self.tb_x,
            ArticKey::TbY => &mut self.tb_y,
            ArticKey::TtX => &mut self.tt_x,
            ArticKey::TtY => &mut self.tt_y,
            ArticKey::TtCurl => &mut self.tt_curl,
            ArticKey::Root => &mut self.root,
            ArticKey::LipAp => &mut self.lip_ap,
            ArticKey::LipProt => &mut self.lip_prot,
            ArticKey::LipWidth => &mut self.lip_width,
            ArticKey::Labiodental => &mut self.labiodental,
            ArticKey::Velum => &mut self.velum,
            ArticKey::Larynx => &mut self.larynx,
            ArticKey::Epilarynx => &mut self.epilarynx,
            ArticKey::Ventricular => &mut self.ventricular,
            ArticKey::Lateral => &mut self.lateral,
            ArticKey::Dorsum => &mut self.dorsum,
        }
    }
    #[inline]
    pub fn set(&mut self, k: ArticKey, x: f64) {
        *self.get_mut(k) = x;
    }
    pub fn to_array(&self) -> [f64; N_ARTIC] {
        ArticKey::ALL.map(|k| self.get(k))
    }
    pub fn from_array(a: &[f64]) -> HumanArtic {
        let mut out = NEUTRAL;
        for (i, k) in ArticKey::ALL.iter().enumerate() {
            if i < a.len() {
                out.set(*k, a[i]);
            }
        }
        out
    }
}

/// A partial articulation (`Partial<HumanArtic>`): the keys present, in canonical order.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct ArticPatch {
    pub values: [Option<f64>; N_ARTIC],
}

impl ArticPatch {
    pub fn get(&self, k: ArticKey) -> Option<f64> {
        self.values[k.index()]
    }
    pub fn set(&mut self, k: ArticKey, x: f64) -> &mut Self {
        self.values[k.index()] = Some(x);
        self
    }
    pub fn with(mut self, k: ArticKey, x: f64) -> Self {
        self.values[k.index()] = Some(x);
        self
    }
    pub fn iter(&self) -> impl Iterator<Item = (ArticKey, f64)> + '_ {
        ArticKey::ALL.iter().filter_map(|k| self.values[k.index()].map(|x| (*k, x)))
    }
    /// `{ ...base, ...self }`
    pub fn apply_to(&self, base: &HumanArtic) -> HumanArtic {
        let mut out = *base;
        for (k, x) in self.iter() {
            out.set(k, x);
        }
        out
    }
    pub fn merge(&mut self, other: &ArticPatch) {
        for (k, x) in other.iter() {
            self.values[k.index()] = Some(x);
        }
    }
    pub fn is_empty(&self) -> bool {
        self.values.iter().all(|x| x.is_none())
    }
    /// Each key's weighted mean over the parts that have it (parts weighing 0 or less are left
    /// out). Allocates nothing.
    pub fn blend(parts: &[(f64, ArticPatch)]) -> ArticPatch {
        let mut out = ArticPatch::default();
        for i in 0..N_ARTIC {
            let (mut sum, mut wsum) = (0.0, 0.0);
            for (w, p) in parts {
                if let (true, Some(x)) = (*w > 0.0, p.values[i]) {
                    sum += w * x;
                    wsum += w;
                }
            }
            if wsum > 0.0 {
                out.values[i] = Some(sum / wsum);
            }
        }
        out
    }
}

impl Serialize for ArticPatch {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(None)?;
        for (k, x) in self.iter() {
            m.serialize_entry(k.name(), &x)?;
        }
        m.end()
    }
}

impl<'de> Deserialize<'de> for ArticPatch {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let m: std::collections::BTreeMap<String, f64> = Deserialize::deserialize(d)?;
        let mut p = ArticPatch::default();
        for (k, x) in m {
            if let Some(key) = ArticKey::from_name(&k) {
                p.values[key.index()] = Some(x);
            }
        }
        Ok(p)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HumanBody {
    pub name: &'static str,
    /// overall size scale (1 = adult male)
    pub scale: f64,
    /// extra pharynx length scale (female/child have proportionally shorter pharynx)
    pub pharynx: f64,
    /// tongue body radius (cm, before scale)
    pub tongue_radius: f64,
    /// max lip width (cm, before scale)
    pub lip_width: f64,
}

pub const BODY_MALE: HumanBody = HumanBody { name: "Adult male", scale: 1.0, pharynx: 1.0, tongue_radius: 2.25, lip_width: 4.6 };
pub const BODY_FEMALE: HumanBody = HumanBody { name: "Adult female", scale: 0.9, pharynx: 0.88, tongue_radius: 2.2, lip_width: 4.4 };
pub const BODY_CHILD: HumanBody = HumanBody { name: "Child", scale: 0.74, pharynx: 0.8, tongue_radius: 2.15, lip_width: 4.0 };

/// The three human bodies by their short names.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BodyName {
    Male,
    Female,
    Child,
}

impl BodyName {
    pub fn body(self) -> HumanBody {
        match self {
            BodyName::Male => BODY_MALE,
            BodyName::Female => BODY_FEMALE,
            BodyName::Child => BODY_CHILD,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            BodyName::Male => "male",
            BodyName::Female => "female",
            BodyName::Child => "child",
        }
    }
    /// The phonetics tables key bodies by name; anything else is treated as male, as in TS.
    pub fn parse(s: &str) -> BodyName {
        match s {
            "female" => BodyName::Female,
            "child" => BodyName::Child,
            _ => BodyName::Male,
        }
    }
}

/// A body anywhere between the three calibrated ones: `female` runs from the adult male (0) to
/// the adult female (1), `child` from adult (0) to child (1). The child has no female axis, so
/// the weights are male (1−c)(1−f), female (1−c)·f, child c. Everything body-dependent (the
/// anatomy, the calibrated phoneme targets, the default pitch) blends with these weights; at a
/// preset it is exactly that preset.
///
/// Deserializes from a preset name (`"female"`) or `{ "female": f, "child": c }`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
pub struct BodyMix {
    pub female: f64,
    pub child: f64,
}

impl BodyMix {
    pub const MALE: BodyMix = BodyMix { female: 0.0, child: 0.0 };
    pub const FEMALE: BodyMix = BodyMix { female: 1.0, child: 0.0 };
    pub const CHILD: BodyMix = BodyMix { female: 0.0, child: 1.0 };

    /// Clamped to 0..1 (non-finite values count as 0).
    pub fn new(female: f64, child: f64) -> BodyMix {
        let c = |x: f64| if x.is_finite() { clamp(x, 0.0, 1.0) } else { 0.0 };
        BodyMix { female: c(female), child: c(child) }
    }

    /// Weights of male, female and child (they sum to 1).
    pub fn weights(self) -> [(BodyName, f64); 3] {
        let BodyMix { female: f, child: c } = BodyMix::new(self.female, self.child);
        [(BodyName::Male, (1.0 - c) * (1.0 - f)), (BodyName::Female, (1.0 - c) * f), (BodyName::Child, c)]
    }

    /// The preset this is exactly, if any.
    pub fn preset(self) -> Option<BodyName> {
        self.weights().iter().find(|(_, w)| *w == 1.0).map(|(b, _)| *b)
    }

    /// The preset with the largest weight.
    pub fn nearest(self) -> BodyName {
        let w = self.weights();
        let mut best = w[0];
        for x in &w[1..] {
            if x.1 > best.1 {
                best = *x;
            }
        }
        best.0
    }

    /// `f` of each preset, blended by weight (exactly `f(preset)` at a preset).
    pub fn blend(self, f: impl Fn(BodyName) -> f64) -> f64 {
        if let Some(b) = self.preset() {
            return f(b);
        }
        self.weights().iter().fold(0.0, |acc, (b, w)| acc + w * f(*b))
    }

    /// The blended anatomy (named after the nearest preset).
    pub fn body(self) -> HumanBody {
        if let Some(b) = self.preset() {
            return b.body();
        }
        HumanBody {
            name: self.nearest().body().name,
            scale: self.blend(|b| b.body().scale),
            pharynx: self.blend(|b| b.body().pharynx),
            tongue_radius: self.blend(|b| b.body().tongue_radius),
            lip_width: self.blend(|b| b.body().lip_width),
        }
    }
}

impl From<BodyName> for BodyMix {
    fn from(b: BodyName) -> BodyMix {
        match b {
            BodyName::Male => BodyMix::MALE,
            BodyName::Female => BodyMix::FEMALE,
            BodyName::Child => BodyMix::CHILD,
        }
    }
}

impl From<&str> for BodyMix {
    fn from(s: &str) -> BodyMix {
        BodyName::parse(s).into()
    }
}

impl<'de> Deserialize<'de> for BodyMix {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Wire {
            Name(String),
            Mix {
                #[serde(default)]
                female: f64,
                #[serde(default)]
                child: f64,
            },
        }
        Ok(match Wire::deserialize(d)? {
            Wire::Name(s) => BodyMix::from(s.as_str()),
            Wire::Mix { female, child } => BodyMix::new(female, child),
        })
    }
}

/// Neutral (schwa-like) articulation for the male template, unscaled coordinates.
pub const NEUTRAL: HumanArtic = HumanArtic {
    jaw: 0.6,
    tb_x: 2.9,
    tb_y: 6.85,
    tt_x: 6.45,
    tt_y: 7.3,
    tt_curl: 0.0,
    root: 0.0,
    lip_ap: 0.7,
    lip_prot: 0.2,
    lip_width: 0.5,
    labiodental: 0.0,
    velum: -0.15,
    larynx: 0.0,
    epilarynx: 0.0,
    ventricular: 0.0,
    lateral: 0.0,
    dorsum: 0.0,
};

/// Resting tongue-tip position (template coordinates) for a given jaw and tongue body:
/// behind the lower incisors, carried by the jaw and dragged by the tongue body.
pub fn rest_tip(jaw: f64, tb_x: f64, tb_y: f64) -> Vec2 {
    let (cx, cy) = (-2.5, 10.5);
    let (px, py) = (6.45, 7.35);
    let ang = -jaw / 9.84;
    let (dx, dy) = (px - cx, py - cy);
    let x = cx + dx * cos(ang) - dy * sin(ang);
    let y = cy + dx * sin(ang) + dy * cos(ang);
    v(x + 0.3 * (tb_x - NEUTRAL.tb_x), y + 0.35 * (tb_y - NEUTRAL.tb_y))
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct GridSample {
    pub inner: Vec2,
    pub outer: Vec2,
    pub mid: Vec2,
    /// midsagittal distance (cm), 0 when closed
    pub d: f64,
    /// area (cm²)
    pub area: f64,
    /// distance from the glottis along the centreline (cm)
    pub s: f64,
    /// 0 epilarynx, 1 pharynx, 2 oral (radial), 3 front (teeth/lips)
    pub region: u8,
    /// the gap the ray measured, before the contact models (cm)
    pub ray: f64,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HumanFrame {
    /// outer wall (posterior pharynx → velum → palate → incisors → upper lip)
    pub outer: Vec<Vec2>,
    /// inner wall (epiglottis → tongue → floor → lower incisors → lower lip)
    pub inner: Vec<Vec2>,
    /// tongue outline for drawing (closed)
    pub tongue: Vec<Vec2>,
    pub velum: Vec<Vec2>,
    pub upper_lip: Vec<Vec2>,
    pub lower_lip: Vec<Vec2>,
    pub upper_teeth: Vec<Vec2>,
    pub lower_teeth: Vec<Vec2>,
    pub jaw_bone: Vec<Vec2>,
    pub epiglottis: Vec<Vec2>,
    pub nasal_cavity: Vec<Vec2>,
    /// glottis position
    pub glottis: Vec2,
    pub grid: Vec<GridSample>,
    /// total length glottis → lips (cm)
    pub length: f64,
    /// length glottis → velopharyngeal junction (cm)
    pub pharynx_length: f64,
    /// s position of the upper incisor edge (cm from glottis)
    pub teeth_s: f64,
    /// s of the lip opening (end)
    pub lip_s: f64,
    pub velum_port: f64,
    pub lip_area: f64,
    pub tongue_center: Vec2,
    pub tongue_radius: f64,
    pub tip: Vec2,
    /// grid index where the oral tube begins (−1: none)
    pub split_index: i32,
}

const DEG: f64 = PI / 180.0;
/// labiodental value by which the lips' own contact has handed over to the incisor constriction
const LAB_HANDOVER: f64 = 0.5;
/// how fast the lip-to-lip gap opens over that handover (cm, body-scaled): it grows as
/// `LAB_GAP·s/(1−s)`, `s` the smoothstep of the handover, so it leaves without a step
const LAB_GAP: f64 = 0.3;
/// labiodental value from which the space in front of the tucked lower lip opens out
const LAB_FRONT_OPENS: f64 = 0.7;
/// how far in front of the lower lip's edge (cm, body-scaled) that opening reaches its full depth
const LAB_FRONT_RAMP: f64 = 0.1;
/// points on the tongue body's arc
const ARC_POINTS: usize = 32;
const MAX_CROSS: usize = 64;

/// Area-law coefficients per region [α, β].
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AreaLaw {
    pub pharynx: (f64, f64),
    pub oral: (f64, f64),
    pub front: (f64, f64),
    /// oral rays in front of the raised tongue tip: the space under the alveolar ridge lies inside
    /// the anterior dental arch and above the sublingual floor, far narrower than the mid-oral
    /// cavity between the molars that `oral` describes
    pub ahead: (f64, f64),
}

/// Flat polyline views of a measured ray.
#[derive(Clone, Copy)]
struct Measured {
    inner: Vec2,
    outer: Vec2,
    d: f64,
}

#[derive(Clone, Debug, Default)]
struct Scratch {
    tmp: Vec<f64>,
    cross_t: Vec<f64>,
    cross_exit: Vec<bool>,
    vel: Vec<Vec2>,
    vel_oral: Vec<Vec2>,
    vel_nasal: Vec<Vec2>,
    outer: Polyline,
    inner: Polyline,
    upper_lip_in: Vec<Vec2>,
    lower_lip_in: Vec<Vec2>,
    lip_out: Vec<Vec2>,
    root: Vec<Vec2>,
    arc_pts: Vec<Vec2>,
    blade: Vec<Vec2>,
    under: Vec<Vec2>,
    back: Vec<Vec2>,
    roof: Polyline,
    cum: Vec<f64>,
    tip_pts: Vec<Vec2>,
    outline: Polyline,
}

/// Room reserved in every point buffer: the outlines' lengths vary with the posture (how much of
/// the pharyngeal wall and tongue root they take), and reserving the most they can hold up front
/// keeps a voice from allocating the first time it meets a new posture.
const POINTS: usize = 256;

impl Scratch {
    fn new() -> Scratch {
        let pts = || Vec::with_capacity(POINTS);
        let line = || Polyline::with_capacity(POINTS);
        Scratch {
            tmp: vec![0.0; MAX_CROSS],
            cross_t: vec![0.0; MAX_CROSS],
            cross_exit: vec![false; MAX_CROSS],
            vel: pts(),
            vel_oral: pts(),
            vel_nasal: pts(),
            outer: line(),
            inner: line(),
            upper_lip_in: pts(),
            lower_lip_in: pts(),
            lip_out: pts(),
            root: pts(),
            arc_pts: pts(),
            blade: pts(),
            under: pts(),
            back: pts(),
            roof: line(),
            cum: Vec::with_capacity(POINTS),
            tip_pts: pts(),
            outline: line(),
        }
    }
}

impl HumanFrame {
    /// A frame with room for any posture's outlines (see [`HumanVocalTract::compute`]).
    pub fn with_capacity() -> HumanFrame {
        let pts = || Vec::with_capacity(POINTS);
        HumanFrame {
            outer: pts(),
            inner: pts(),
            tongue: pts(),
            velum: pts(),
            upper_lip: pts(),
            lower_lip: pts(),
            upper_teeth: pts(),
            lower_teeth: pts(),
            jaw_bone: pts(),
            epiglottis: pts(),
            nasal_cavity: pts(),
            grid: Vec::with_capacity(64),
            ..Default::default()
        }
    }
}

#[derive(Clone, Debug)]
pub struct HumanVocalTract {
    pub body: HumanBody,
    k: f64,
    // fixed landmarks (scaled)
    phar_wall: Vec<Vec2>,
    palate: Vec<Vec2>,
    pns: Vec2,
    condyle: Vec2,
    polar_c: Vec2,
    polar_c2: Vec2,
    nasal_cavity: Vec<Vec2>,
    sc: Scratch,
    /// signed closest approach (cm) of tongue tip / dorsum to the oral roof in the last frame
    pub contact_tip: f64,
    pub contact_body: f64,
    /// unit normals at the contacts, pointing from the roof into the airway (body coords)
    pub contact_tip_n: Vec2,
    pub contact_body_n: Vec2,
    pub area_law: AreaLaw,
}

impl HumanVocalTract {
    pub fn new(body: HumanBody) -> Self {
        let mut t = HumanVocalTract {
            body,
            k: body.scale,
            phar_wall: Vec::new(),
            palate: Vec::new(),
            pns: v(0.0, 0.0),
            condyle: v(0.0, 0.0),
            polar_c: v(0.0, 0.0),
            polar_c2: v(0.0, 0.0),
            nasal_cavity: Vec::new(),
            sc: Scratch::new(),
            contact_tip: 1.0,
            contact_body: 1.0,
            contact_tip_n: v(0.0, -1.0),
            contact_body_n: v(0.0, -1.0),
            area_law: AreaLaw { pharynx: (2.0, 1.4), oral: (2.6, 1.4), front: (2.0, 1.4), ahead: (1.6, 1.4) },
        };
        let p = |x: f64, y: f64| t.p(x, y);
        // posterior pharyngeal wall, bottom → top (curving forward into nasopharynx roof)
        let phar_wall = catmull_rom(&[p(-1.0, -1.5), p(-1.1, 1.5), p(-1.2, 3.6), p(-1.3, 5.6), p(-1.38, 7.5), p(-1.33, 8.9), p(-1.05, 10.1), p(-0.45, 10.9), p(0.4, 11.3)], 4);
        let pns = p(1.0, 9.75);
        let palate = catmull_rom(&[p(1.0, 9.6), p(1.8, 9.92), p(2.7, 10.18), p(3.6, 10.3), p(4.4, 10.25), p(5.1, 10.05), p(5.7, 9.72), p(6.15, 9.36), p(6.5, 9.05), p(6.78, 8.7), p(6.98, 8.3), p(7.12, 7.95)], 3);
        let condyle = p(-2.5, 10.5);
        let polar_c = p(2.6, 6.95);
        let polar_c2 = p(5.0, 6.85);
        let nasal_cavity = catmull_rom(&[pns, p(2.5, 10.8), p(5.0, 11.2), p(7.3, 10.6), p(8.0, 10.1)], 4);
        t.phar_wall = phar_wall;
        t.pns = pns;
        t.palate = palate;
        t.condyle = condyle;
        t.polar_c = polar_c;
        t.polar_c2 = polar_c2;
        t.nasal_cavity = nasal_cavity;
        t
    }

    /// Template point → body coordinates. The oral region (x > 0.5) is compressed by 0.86 so the
    /// template's landmarks give a ≈17.5 cm neutral tract; the pharynx (y < 7) is shortened by the
    /// body's pharynx factor; everything is scaled by the body size.
    #[inline]
    pub fn p(&self, x: f64, y: f64) -> Vec2 {
        let k = self.k;
        let ph = self.body.pharynx;
        let xx = if x > 0.5 { 0.5 + (x - 0.5) * 0.86 } else { x };
        let yy = if y < 7.0 { 7.0 - (7.0 - y) * ph } else { y };
        v(xx * k, yy * k)
    }

    /// Inverse of `p()`: body coordinates → template coordinates (for direct manipulation).
    pub fn un_p(&self, x: f64, y: f64) -> Vec2 {
        let k = self.k;
        let ph = self.body.pharynx;
        let mut xx = x / k;
        let mut yy = y / k;
        if xx > 0.5 {
            xx = 0.5 + (xx - 0.5) / 0.86;
        }
        if yy < 7.0 {
            yy = 7.0 - (7.0 - yy) / ph;
        }
        v(xx, yy)
    }

    pub fn scale(&self) -> f64 {
        self.k
    }

    /// The outer and inner walls' hard landmarks, for drawing.
    pub fn palate(&self) -> &[Vec2] {
        &self.palate
    }

    /// Compute a new frame (allocates; for the UI and tests).
    pub fn compute_new(&mut self, a: &HumanArtic) -> HumanFrame {
        let mut f = HumanFrame::default();
        self.compute(a, &mut f);
        f
    }

    /// Geometry for an articulation, written into `f` (its buffers are reused).
    pub fn compute(&mut self, a: &HumanArtic, f: &mut HumanFrame) {
        let k = self.k;
        let sc = &mut self.sc;
        let this = HumanVocalTractView { k, body: self.body, condyle: self.condyle };
        let lar = a.larynx * k;
        let glottis = add(this.p(0.0, 0.0), v(0.0, lar));

        // ---- jaw (rotation about the condyle)
        let jaw_ref = this.p(6.95, 7.75);
        let jaw_r = dist(self.condyle, jaw_ref);
        let phi = -clamp(a.jaw, -0.2, 3.0) * k / jaw_r;
        let j = |x: f64, y: f64| rotate_about(this.p(x, y), this.condyle, phi);

        // ---- velum flap from PNS; angle from port area
        let v_open = clamp(a.velum / 1.2, 0.0, 1.0);
        let v_ang = (194.0 + 46.0 * v_open) * DEG;
        let v_len = 2.8 * k;
        sc.vel.clear();
        sc.vel_oral.clear();
        sc.vel_nasal.clear();
        for i in 0..=10 {
            let s = i as f64 / 10.0;
            let sag = sin(s * PI) * k * (0.3 * v_open - 0.12);
            let c = add(polar(self.pns, v_len * s, v_ang), v(0.0, -sag));
            let nrm = v(-sin(v_ang), cos(v_ang)); // oral-side normal (forward-down)
            let th = (0.48 - 0.2 * s) * k;
            sc.vel_oral.push(add(c, scale(nrm, th)));
            sc.vel_nasal.push(sub(c, scale(nrm, th)));
            sc.vel.push(c);
        }
        // the velum's oral surface runs into the hard palate's: its root sat below the palate's edge,
        // folding the roof back on itself there, and rays crossed the fold as the velum turned
        let pal0 = self.palate[0];
        for i in 0..sc.vel_oral.len() {
            let u = i as f64 / 10.0 / 0.35;
            if u < 1.0 {
                sc.vel_oral[i] = lerp_v(sc.vel_oral[i], pal0, (1.0 - u) * (1.0 - u));
            }
        }

        // ---- outer contour: pharyngeal wall up to just below the uvula, then velum oral surface
        // (tip→PNS), palate, incisors, upper lip
        let outer = &mut sc.outer;
        outer.clear();
        // The port window's lid runs from the posterior wall up to the uvula's tip. It must slope
        // up: a lid leaving the wall above the tip left rays just under the tip to hit the wall far
        // behind, so the back of the oral tract jumped as the velum moved.
        let uv_y = sc.vel_oral[sc.vel_oral.len() - 1].y - 0.3 * k;
        for i in 0..self.phar_wall.len() {
            let p = self.phar_wall[i];
            if p.y < uv_y {
                outer.push(p);
                continue;
            }
            // end exactly at that height: whole wall points popping in and out made the port
            // window, and every ray through it, jump as the velum moved
            if i > 0 {
                let aa = self.phar_wall[i - 1];
                outer.push(lerp_v(aa, p, clamp((uv_y - aa.y) / js_max(1e-9, p.y - aa.y), 0.0, 1.0)));
            }
            break;
        }
        // bridge to the uvula tip (velopharyngeal port window)
        let roof_start = outer.len();
        for i in (0..sc.vel_oral.len()).rev() {
            outer.push(sc.vel_oral[i]);
        }
        outer.append(&self.palate, true);
        let roof_end = outer.len() - 1;
        // upper lip
        let prot = clamp(a.lip_prot, -0.2, 1.6) * k;
        let spread_w = clamp(a.lip_width, 0.0, 1.0);
        let y_mid = (7.85 - 0.3 * a.jaw) * k;
        let lab = clamp(a.labiodental, 0.0, 1.0);
        let ap = a.lip_ap * k;
        let lip_front_x = this.p(8.15 + 0.12 * (1.0 - spread_w), 0.0).x + prot * 0.95;
        let mut ul_edge = v(lip_front_x - 0.15 * k, y_mid + ap * 0.35 + lab * 0.35 * k);
        let mut ll_edge = v(lip_front_x - 0.25 * k, y_mid - ap * 0.65);
        if lab > 0.0 {
            // lower lip tucks under the upper incisor edge for /f v/
            let incisor = self.palate[self.palate.len() - 1];
            let target = v(incisor.x + 0.05 * k, incisor.y - js_max(a.lip_ap * k, -0.1));
            ll_edge = lerp_v(ll_edge, target, lab);
            ul_edge = lerp_v(ul_edge, v(incisor.x + 0.55 * k, incisor.y + 0.45 * k), lab * 0.7);
        }
        let ul_base = this.p(7.32, 8.35);
        bezier3(ul_base, add(ul_base, v(0.3 * k + prot * 0.4, 0.05 * k)), add(ul_edge, v(-0.35 * k, 0.12 * k)), ul_edge, 7, &mut sc.upper_lip_in);
        outer.append(&sc.upper_lip_in, false);

        // ---- tongue
        let r = self.body.tongue_radius * k;
        let b = this.p(a.tb_x, a.tb_y);
        let b0 = this.p(NEUTRAL.tb_x, NEUTRAL.tb_y);
        let vallecula = add(this.p(0.75, 3.3), v(0.45 * (b.x - b0.x) + a.root * k, 0.3 * (b.y - b0.y) + 0.55 * lar));
        let epi_base = add(this.p(0.3, 2.4), v(0.0, lar));
        let epi_tip = add(this.p(0.0, 4.5), v(0.35 * (vallecula.x - 0.75 * k), lar * 0.8 + 0.15 * (b.y - b0.y)));
        let th_b = 200.0 * DEG;
        let p_b = polar(b, r, th_b);
        let tan_b = v(sin(th_b), -cos(th_b));
        let h_r = dist(vallecula, p_b) / 3.0;
        bezier3(vallecula, add(vallecula, v(0.08 * k, h_r)), sub(p_b, scale(tan_b, h_r)), p_b, 9, &mut sc.root);
        let mut tip = this.p(a.tt_x, a.tt_y);
        // keep tip outside the body circle
        let d_t = dist(tip, b);
        if d_t < r * 1.05 {
            tip = add(b, scale(norm(sub(tip, b)), r * 1.05));
        }
        let mut th_f = match tangent_angle(b, r, tip, true) {
            Some(x) => x,
            None => atan2(tip.y - b.y, tip.x - b.x),
        };
        // arc runs from thB (200°) decreasing to thF
        while th_f > th_b {
            th_f -= 2.0 * PI;
        }
        while th_f < th_b - 2.0 * PI {
            th_f += 2.0 * PI;
        }
        // a fixed number of points: a count that changed with the angle re-spaced every vertex at once
        arc(b, r, th_b, th_f, ARC_POINTS, &mut sc.arc_pts);
        let p_f = sc.arc_pts[sc.arc_pts.len() - 1];
        let tan_f = v(sin(th_f), -cos(th_f)); // direction of decreasing angle
        // blade: quadratic from the tangent point to the tip; curl lifts the tip and turns it back
        let bl = dist(p_f, tip);
        let curl = clamp(a.tt_curl, 0.0, 1.0);
        let ctrl = add(add(p_f, scale(tan_f, bl * 0.5)), v(0.0, (0.18 + 0.5 * curl) * k));
        // dorsum depression (clicks): hollow the tongue between the back (velar) contact at the top
        // of the body and the tip, leaving both contacts in place, so a sealed pocket expands
        bezier2(p_f, ctrl, tip, 7, &mut sc.blade);
        if a.dorsum > 0.0 {
            let (x0, x1) = (b.x, tip.x);
            let dip = |p: Vec2| -> Vec2 {
                let u = (p.x - x0) / js_max(1e-6, x1 - x0);
                if u <= 0.0 || u >= 1.0 {
                    return p;
                }
                let w = sin(PI * pow(u, 0.8));
                add(p, v(0.0, -a.dorsum * 0.9 * k * w * w))
            };
            for q in sc.arc_pts.iter_mut() {
                *q = dip(*q);
            }
            let nb = sc.blade.len();
            for q in sc.blade[1..nb - 1].iter_mut() {
                *q = dip(*q);
            }
        }
        // underside back to the frenulum / floor of mouth (jaw-carried)
        let fren = j(5.7, 6.15);
        bezier2(tip, add(tip, v(-0.3 * k - curl * 0.4 * k, -0.6 * k)), fren, 6, &mut sc.under);
        let floor = [fren, j(6.2, 6.25), j(6.45, 6.55)];
        // lower incisors (jaw)
        let li_tip = j(6.95, 7.75);
        let lower_teeth_pts = [j(6.45, 6.55), j(6.72, 7.15), li_tip, j(7.12, 7.45)];
        // lower lip: from labial base of lower incisor to the edge
        let ll_base = j(7.12, 7.45);
        bezier3(ll_base, add(ll_base, v(0.25 * k + prot * 0.3, -0.05 * k)), add(ll_edge, v(-0.3 * k, -0.12 * k)), ll_edge, 7, &mut sc.lower_lip_in);

        // acoustic inner wall: epiglottis (laryngeal surface) then the tongue root *above* the
        // epiglottis tip — the vallecula pocket is omitted so the wall is single-valued along the
        // pharyngeal rays (a pocket makes ray crossings flip discontinuously)
        let inner = &mut sc.inner;
        inner.clear();
        inner.push(epi_base).push(epi_tip);
        // The wall leaves the epiglottis tip upward, for where the tongue's back (root, then the
        // dorsum arc) first rises above it: with the tongue low and the larynx high the whole root
        // can sit below the tip, and a wall coming back down from it made the tip a peak that a
        // horizontal ray measured past (to the root) or not (to the epiglottis) — a jump.
        let y_root = epi_tip.y + 0.05 * k;
        sc.back.clear();
        sc.back.extend_from_slice(&sc.root);
        sc.back.extend_from_slice(&sc.arc_pts[1..]);
        let back = &sc.back;
        let root_len = sc.root.len();
        let start = match back.iter().position(|q| q.y > y_root) {
            None => back.len() - 1,
            Some(s) => {
                if s > 0 {
                    // start exactly at that height, not at the next sample point (which jumped along the root)
                    let (aa, bb) = (back[s - 1], back[s]);
                    inner.push(lerp_v(aa, bb, clamp((y_root - aa.y) / js_max(1e-9, bb.y - aa.y), 0.0, 1.0)));
                }
                s
            }
        };
        if start < root_len {
            for i in start..root_len {
                inner.push(sc.root[i]);
            }
            inner.append(&sc.arc_pts, true);
        } else {
            inner.append(&sc.arc_pts[start - root_len + 1..], true);
        }
        inner.append(&sc.blade, true);
        inner.append(&sc.under, true);
        inner.append(&floor, true);
        inner.append(&lower_teeth_pts, true);
        inner.append(&sc.lower_lip_in, false);

        // ---- grid
        let grid = &mut f.grid;
        grid.clear();
        let y_epi_top = glottis.y + 2.4 * k * self.body.pharynx;
        let y_phar_top = self.polar_c.y;
        let n_ph = 12usize;
        let mut split_index: i32 = -1;
        let teeth_idx;
        {
            let outer = &sc.outer;
            let inner = &sc.inner;
            let tmp = &mut sc.tmp;
            let cross_t = &mut sc.cross_t;
            let cross_exit = &mut sc.cross_exit;
            // A fan ray's inner surface. The ray starts in the tongue: the gap begins where it leaves it
            // (or, if the tongue has moved off the origin, at the surface behind it: a fixed fallback
            // gap jumped as the surface crossed the origin). The gap is the air along the ray up to the
            // roof: tissue the ray passes through on the way (a curled tip with air beneath it) is taken
            // out by its thickness, so a layer that vanishes as the ray grazes it changes nothing.
            let mut fan_inner = |o: Vec2, dir: Vec2, t_out: f64, tmp: &mut [f64]| -> f64 {
                let n = ray_crossings(o.x, o.y, dir.x, dir.y, inner, 0.0, t_out + 1.5 * k, cross_t, cross_exit);
                // sort the crossings along the ray (there are only a few)
                for i in 1..n {
                    let (t, e) = (cross_t[i], cross_exit[i]);
                    let mut jj = i as isize - 1;
                    while jj >= 0 && cross_t[jj as usize] > t {
                        cross_t[jj as usize + 1] = cross_t[jj as usize];
                        cross_exit[jj as usize + 1] = cross_exit[jj as usize];
                        jj -= 1;
                    }
                    cross_t[(jj + 1) as usize] = t;
                    cross_exit[(jj + 1) as usize] = e;
                }
                let t_in;
                let mut i = 0usize;
                if n > 0 && cross_exit[0] {
                    t_in = cross_t[0];
                    i = 1;
                } else {
                    let back = 2.5 * k;
                    let n_back = ray_polyline(o.x, o.y, -dir.x, -dir.y, inner, 0.0, back, tmp);
                    let mut tb = back;
                    for q in 0..n_back {
                        tb = js_min(tb, tmp[q]);
                    }
                    t_in = -tb;
                }
                let mut tissue = 0.0;
                while i < n && cross_t[i] < t_out {
                    if cross_exit[i] {
                        i += 1;
                        continue; // a surface without its entry: nothing to take out
                    }
                    let bb = if i + 1 < n { cross_t[i + 1] } else { t_out + 1.5 * k };
                    tissue += js_min(bb, t_out) - cross_t[i];
                    i += 2; // skip the layer's exit
                }
                t_in + tissue
            };
            // `fan`: a ray of the oral fan, whose origin the tongue can move off (the others start below
            // or in front of all tissue they measure)
            let mut measure = |o: Vec2, dir: Vec2, max_len: f64, fan: bool| -> Option<Measured> {
                // walk from o along dir: last inner crossing before the first outer crossing
                let n_out = ray_polyline(o.x, o.y, dir.x, dir.y, outer, 0.0, max_len, tmp);
                if n_out == 0 {
                    return None;
                }
                let mut t_out = f64::INFINITY;
                for i in 0..n_out {
                    t_out = js_min(t_out, tmp[i]);
                }
                let mut t_in;
                if fan {
                    t_in = fan_inner(o, dir, t_out, tmp);
                } else {
                    let n_in = ray_polyline(o.x, o.y, dir.x, dir.y, inner, 0.0, t_out + 1.5 * k, tmp);
                    t_in = f64::NEG_INFINITY;
                    for i in 0..n_in {
                        if tmp[i] > t_in && tmp[i] < t_out + 1.5 * k {
                            t_in = tmp[i];
                        }
                    }
                    if t_in == f64::NEG_INFINITY {
                        t_in = js_max(0.0, t_out - 3.5 * k);
                    }
                }
                // if the tongue crosses the wall, the outermost inner crossing lies beyond tOut → closed
                let d = js_max(0.0, t_out - t_in);
                let p_in = add(o, scale(dir, js_min(t_in, t_out)));
                let p_out = add(o, scale(dir, t_out));
                Some(Measured { inner: p_in, outer: p_out, d })
            };
            let sample = |m: Measured, region: u8| GridSample { inner: m.inner, outer: m.outer, mid: lerp_v(m.inner, m.outer, 0.5), d: m.d, area: 0.0, s: 0.0, region, ray: m.d };
            // pharyngeal horizontals (origin in front, looking back)
            for i in 0..n_ph {
                let y = lerp(y_epi_top + 0.12 * k, y_phar_top, i as f64 / n_ph as f64);
                if let Some(m) = measure(v(4.6 * k, y), v(-1.0, 0.0), 9.0 * k, false) {
                    grid.push(sample(m, 1));
                }
            }
            // oral family: rays from a centre that glides from C1 (mid-oral) to C2 (behind the incisors)
            // while the angle sweeps back → up → forward; consecutive rays never cross inside the airway.
            let n_rad = 30;
            for i in 0..=n_rad {
                let t = i as f64 / n_rad as f64;
                let ang = lerp(180.0, 36.0, t) * DEG;
                let w = if t < 0.45 { 0.0 } else { (t - 0.45) / 0.55 };
                let c = lerp_v(self.polar_c, self.polar_c2, w * w * (3.0 - 2.0 * w));
                let dir = v(cos(ang), sin(ang));
                let Some(m) = measure(c, dir, 8.0 * k, true) else { continue };
                if split_index < 0 && ang <= 150.0 * DEG {
                    split_index = grid.len() as i32;
                }
                // rays behind the velum still measure the (laterally wide) oropharynx
                grid.push(sample(m, if split_index < 0 { 1 } else { 2 }));
            }
            // front verticals (upper incisor edge → lip opening), looking up
            let incisor_tip = self.palate[self.palate.len() - 1];
            let x_start = incisor_tip.x + 0.03 * k;
            let x_end = js_max(x_start + 0.3 * k, js_min(ul_edge.x, ll_edge.x) - 0.04 * k);
            let n_fr = 6;
            teeth_idx = grid.len();
            for i in 0..n_fr {
                let x = lerp(x_start, x_end, i as f64 / (n_fr as f64 - 1.0));
                if let Some(mut m) = measure(v(x, 4.0 * k), v(0.0, 1.0), 8.0 * k, false) {
                    // in front of the lower lip's edge (tucked under the incisors for /f v/) the ray
                    // meets no lower lip, and the fallback floor 3.5 cm down jumped the gap by ~2 cm
                    // and the tract's length by ~1 cm as the edge passed it: a click on every /f/.
                    // The floor there starts as the lip's outer face, leaving the edge down and
                    // forward as its outline does (tangent 0.3 : −0.4), and opens to the old depth
                    // as the tuck completes, so a held /f/ keeps its open front. The opening grows
                    // from nothing at the edge itself, so a ray the edge passes late in the tuck
                    // doesn't jump from the lip to the open floor (up to 1.3 cm² in one step).
                    if x > ll_edge.x {
                        let face = js_min(ll_edge.y - (x - ll_edge.x) * 4.0 / 3.0, m.outer.y);
                        let open = smoothstep(LAB_FRONT_OPENS, 1.0, lab) * smoothstep(0.0, LAB_FRONT_RAMP * k, x - ll_edge.x);
                        let y_in = lerp(face, m.outer.y - 3.5 * k, open);
                        m.inner = v(x, y_in);
                        m.d = m.outer.y - y_in;
                    }
                    grid.push(sample(m, 3));
                }
            }
        }
        f.split_index = split_index;
        let lip_w = (1.1 + (self.body.lip_width - 1.1) * spread_w) * k;

        // ---- soft-tissue contact model: near the oral roof, the gap at each roof point is its
        // distance to the tongue surface itself (dorsum arc, blade, tip and underside), negative
        // where the tongue is pressed into the roof. The raw ray crossings of the tissue polygon can
        // leave sealed pockets beside a contact, and a jet released into such a pocket water-hammers;
        // the surface distance has none, gives seals whose length grows with contact pressure, and
        // handles two contacts at once (a single contact point hopped between them, jumping areas).
        let roof = &mut sc.roof;
        roof.clear();
        roof.xs.extend_from_slice(&sc.outer.xs[roof_start..=roof_end]);
        roof.ys.extend_from_slice(&sc.outer.ys[roof_start..=roof_end]);
        let cum = &mut sc.cum;
        cum.clear();
        cum.resize(roof.xs.len(), 0.0);
        for i in 1..roof.xs.len() {
            cum[i] = cum[i - 1] + hypot(roof.xs[i] - roof.xs[i - 1], roof.ys[i] - roof.ys[i - 1]);
        }
        sc.tip_pts.clear();
        sc.tip_pts.extend_from_slice(&sc.blade[2..]);
        sc.tip_pts.extend_from_slice(&sc.under[1..3]);
        let tip_c = closest_approach(roof, cum, &sc.tip_pts);
        let body_c = closest_approach(roof, cum, &sc.arc_pts);
        self.contact_tip = tip_c.0;
        self.contact_body = body_c.0;
        self.contact_tip_n = tip_c.1;
        self.contact_body_n = body_c.1;
        // No outer gate: each ray's own weight fades the contact in. A gate on the sampled
        // tongue-to-roof distance could open with the per-ray correction already part-way on.
        {
            // the whole tongue outline, closed: distance to its surface, signed by whether the roof
            // point is inside it (so the sign only changes where the distance is zero)
            let outl = &mut sc.outline;
            outl.clear();
            outl.append(&sc.root, false);
            outl.append(&sc.arc_pts, true);
            outl.append(&sc.blade, true);
            outl.append(&sc.under, true);
            outl.append(&floor, true);
            outl.push(sc.root[0]);
            let outl = &*outl;
            let tongue_gap = |x: f64, y: f64| signed_gap(outl, x, y);
            // Each roof ray takes the narrowest gap along its own stretch of roof: ±1 mm, so the rays
            // near a contact seal together and open together (a sharp burst), widening to ±2 mm while
            // the tongue is pressed in, because the tip's contact on the alveolar ridge is narrower
            // than the ~4 mm between rays there and could otherwise fall between two and never seal.
            let press = 1.0 - smoothstep(-0.06 * k, 0.0, js_min(tip_c.0, body_c.0));
            let half = 0.1 * k * (1.0 + press);
            let roof_len = cum[cum.len() - 1];
            for g in grid.iter_mut() {
                if g.region == 0 {
                    continue;
                }
                // only rays ending on the oral roof, fading out (not switching off) as they leave it
                let pr = project_on(roof, cum, g.outer.x, g.outer.y);
                let on_roof = 1.0 - smoothstep(0.15 * k, 0.25 * k, pr.dist);
                if on_roof <= 0.0 {
                    continue;
                }
                let mut dc = tongue_gap(g.outer.x, g.outer.y);
                // the gap changes no faster than the distance moved, so a neighbour within `half`
                // along the roof can be closer only by `half`, plus how far off the roof this ray
                // ends: rays ending on the velopharyngeal port window, just behind the uvula's tip,
                // are still faded in by `on_roof`, and a bound without that distance switched the
                // search on with a neighbour already well inside the contact range (an area jump)
                if dc - half - pr.dist <= 0.6 * k {
                    for fr in [-1.0, -0.5, 0.5, 1.0] {
                        let q = point_along(roof, cum, clamp(pr.s + fr * half, 0.0, roof_len));
                        dc = js_min(dc, tongue_gap(q.x, q.y));
                    }
                }
                // the surface distance takes over as the tongue comes within ~6 mm of this roof point,
                // fully from 1.5 mm; it also caps the ray's gap from 4.5 mm in
                let w = (1.0 - smoothstep(0.15 * k, 0.6 * k, dc)) * on_roof;
                let cap = (1.0 - smoothstep(0.45 * k, 0.6 * k, dc)) * on_roof;
                if w <= 0.0 && cap <= 0.0 {
                    continue;
                }
                let dp = js_max(0.0, dc);
                let dm = g.d + (js_min(g.d, dp) - g.d) * cap;
                g.d = dm + (dp - dm) * w;
            }
        }

        // lip contact: between the lips the gap follows aperture + Δx²/2R back from the lip edge, so
        // compressed lips (aperture < 0) seal over a length that grows with compression
        {
            let edge_x = js_min(ul_edge.x, ll_edge.x);
            let rl = 0.6 * k;
            // labiodental uses its own geometry: as the lower lip tucks under the incisors it leaves
            // the upper lip, so the lip-to-lip gap stops constraining. It hands over gradually: a
            // switch at lab 0.5 opened the near-closed lips of an /f/ in one control step, a [b]-like
            // release before every /f/ and /v/
            let lab_open = smoothstep(0.0, LAB_HANDOVER, lab);
            let ap_eff = if lab_open >= 1.0 { f64::INFINITY } else { ap + LAB_GAP * k * lab_open / (1.0 - lab_open) };
            let px = self.palate[self.palate.len() - 1].x;
            for g in grid.iter_mut() {
                if g.region != 3 || g.mid.x < px {
                    continue;
                }
                let dxl = js_max(0.0, edge_x - g.mid.x);
                g.d = js_min(g.d, js_max(0.0, ap_eff + (dxl * dxl) / (2.0 * rl)));
            }
        }

        // ---- areas
        let (a_p, b_p) = self.area_law.pharynx;
        let (a_o, b_o) = self.area_law.oral;
        let (a_f, b_f) = self.area_law.front;
        let (a_h, b_h) = self.area_law.ahead;
        let teeth_x = self.palate[self.palate.len() - 1].x;
        for g in grid.iter_mut() {
            if g.region == 1 {
                g.area = a_p * pow(g.d, b_p);
            } else if g.region == 2 {
                let ahead = smoothstep(0.0, 0.4 * k, g.mid.x - tip.x);
                g.area = lerp(a_o * pow(g.d, b_o), a_h * pow(g.d, b_h), ahead);
            } else {
                // behind the incisors: dental arch; in front: elliptical lip slit of width lipW
                let u = clamp((g.mid.x - teeth_x) / (0.45 * k), 0.0, 1.0);
                let dental = a_f * pow(g.d, b_f);
                let lip = (PI / 4.0) * g.d * lip_w;
                g.area = lerp(dental, lip, u);
            }
        }
        // suppress isolated spikes (rays grazing the port window / tooth corners): clamp each open
        // sample to 1.35× the larger of its neighbours
        for i in 1..grid.len().saturating_sub(1) {
            let lim = 1.35 * js_max(grid[i - 1].area, grid[i + 1].area);
            if grid[i].area > lim {
                grid[i].area = lim;
            }
        }
        // lateral channel (for /l/): keeps a side passage open around a midline tip closure
        if a.lateral > 0.0 {
            for g in grid.iter_mut() {
                if g.region >= 2 && dist(g.mid, tip) < 1.4 * k {
                    g.area = js_max(g.area, a.lateral * 0.35 * k * k);
                }
            }
        }

        // ---- centreline s
        let epi_len = 2.4 * k * self.body.pharynx;
        let mut s = epi_len;
        for i in 0..grid.len() {
            if i > 0 {
                s += dist(grid[i].mid, grid[i - 1].mid);
            }
            grid[i].s = s;
        }
        // teeth position along s (first front line sits at the upper incisor edge)
        let last = grid.len() - 1;
        f.teeth_s = if teeth_idx < grid.len() { grid[teeth_idx].s } else { grid[last].s };
        f.lip_s = grid[last].s;
        f.pharynx_length = if split_index > 0 { grid[split_index as usize].s } else { grid[n_ph].s };
        f.length = f.lip_s;
        f.lip_area = grid[last].area;

        // ---- drawing parts
        f.tongue.clear();
        f.tongue.extend_from_slice(&sc.root);
        f.tongue.extend_from_slice(&sc.arc_pts[1..]);
        f.tongue.extend_from_slice(&sc.blade[1..]);
        f.tongue.extend_from_slice(&sc.under[1..]);
        f.tongue.extend_from_slice(&floor[1..]);
        f.upper_lip.clear();
        f.upper_lip.extend_from_slice(&sc.upper_lip_in);
        bezier3(ul_edge, add(ul_edge, v(0.25 * k, 0.35 * k)), this.p(8.3 + 0.0, 9.6), this.p(7.9, 10.4), 6, &mut sc.lip_out);
        f.upper_lip.extend_from_slice(&sc.lip_out[1..]);
        f.lower_lip.clear();
        f.lower_lip.extend_from_slice(&sc.lower_lip_in);
        bezier3(ll_edge, add(ll_edge, v(0.3 * k, -0.4 * k)), j(8.1, 6.3), j(7.6, 5.6), 6, &mut sc.lip_out);
        f.lower_lip.extend_from_slice(&sc.lip_out[1..]);
        f.jaw_bone.clear();
        f.jaw_bone.extend_from_slice(&[j(7.25, 6.75), j(7.4, 5.4), j(6.4, 4.6), j(3.5, 4.4), j(1.2, 5.2), j(-0.6, 7.4), j(-1.9, 9.6)]);
        sc.outer.to_points(&mut f.outer);
        sc.inner.to_points(&mut f.inner);
        f.velum.clear();
        f.velum.extend_from_slice(&sc.vel_nasal);
        f.velum.extend(sc.vel_oral.iter().rev());
        f.upper_teeth.clear();
        f.upper_teeth.extend_from_slice(&[this.p(6.15, 9.36), this.p(6.78, 8.7), this.p(7.12, 7.95), this.p(7.38, 8.7), this.p(7.4, 9.3)]);
        f.lower_teeth.clear();
        f.lower_teeth.extend_from_slice(&lower_teeth_pts);
        f.epiglottis.clear();
        f.epiglottis.extend_from_slice(&[epi_base, epi_tip, vallecula]);
        f.nasal_cavity.clear();
        f.nasal_cavity.extend_from_slice(&self.nasal_cavity);
        f.glottis = glottis;
        f.velum_port = js_max(0.0, a.velum) * k * k;
        f.tongue_center = b;
        f.tongue_radius = r;
        f.tip = tip;
    }

    /// Epilarynx area profile at s ∈ [0, epiLen].
    pub fn epilarynx_area(&self, a: &HumanArtic, s: f64, epi_len: f64) -> f64 {
        let u = s / epi_len;
        let vent = 0.95 * (1.0 - 0.75 * clamp(a.ventricular, 0.0, 1.0));
        let top = lerp(1.9, 0.35, clamp(a.epilarynx, 0.0, 1.0));
        // laryngeal ventricle, ventricular folds, then the tube to its top
        // Narrowing holds over the whole tube above the ventricular folds (none of it is wider than
        // the outlet), as the aryepiglottic sphincter narrows the tube in singing: a narrow
        // epilaryngeal tube over a wide ventricle and hypopharynx puts a resonance near 3 kHz, the
        // singer's formant (Sundberg 1974; Titze & Story 1997). Narrowing only the outlet left F4 at
        // 3.45-3.65 kHz; narrowing the ventricle too was worse. The folds themselves keep their own
        // control (ventricular). Below epilarynx 0.45 nothing changes (the outlet is wider than 1.2).
        let f = |x: f64| if x < 0.3 { 1.3 } else if x < 0.5 { vent } else { js_min(lerp(1.2, top, (x - 0.5) / 0.5), top) };
        // the steps between them are short ramps: a section boundary sliding across a step made
        // that section's area jump
        let r = 0.03;
        let mut area = f(u);
        for u0 in [0.3, 0.5] {
            if (u - u0).abs() < r {
                area = lerp(f(u0 - r), f(u0 + r), (u - (u0 - r)) / (2.0 * r));
            }
        }
        area * self.k * self.k
    }

    /// Resample the tract into two uniform tubes (pharynx: glottis→velum, oral: velum→lips).
    /// Uses the harmonic mean of area over each section (preserves constriction inertance and
    /// exact closures). Returns (phLen, orLen).
    #[allow(clippy::too_many_arguments)]
    pub fn resample(&self, a: &HumanArtic, f: &HumanFrame, out_ph: &mut [f64], out_or: &mut [f64], min_ph: Option<&mut [f64]>, min_or: Option<&mut [f64]>) -> (f64, f64) {
        let epi_len = 2.4 * self.k * self.body.pharynx;
        let g = &f.grid;
        // the epilarynx's last few millimetres flare into the pharynx (no step at its top)
        let flare = 0.1 * epi_len;
        let area_at = |s: f64| -> f64 {
            if s <= epi_len - flare {
                return self.epilarynx_area(a, s, epi_len);
            }
            if s <= epi_len {
                return lerp(self.epilarynx_area(a, s, epi_len), g[0].area, (s - (epi_len - flare)) / flare);
            }
            if s <= g[0].s {
                return g[0].area;
            }
            // binary search
            let mut lo = 0usize;
            let mut hi = g.len() - 1;
            if s >= g[hi].s {
                return g[hi].area;
            }
            while hi - lo > 1 {
                let m = (lo + hi) >> 1;
                if g[m].s <= s {
                    lo = m;
                } else {
                    hi = m;
                }
            }
            let t = (s - g[lo].s) / js_max(1e-9, g[hi].s - g[lo].s);
            lerp(g[lo].area, g[hi].area, t)
        };
        let fill = |s0: f64, s1: f64, out: &mut [f64], mut mins: Option<&mut [f64]>| {
            let n = out.len();
            let d = (s1 - s0) / n as f64;
            let sub = 8;
            let mut gi = 0usize;
            for i in 0..n {
                let mut inv = 0.0;
                let mut closed = false;
                let mut mn = f64::INFINITY;
                for jj in 0..sub {
                    let area = area_at(s0 + d * (i as f64 + (jj as f64 + 0.5) / sub as f64));
                    if area < mn {
                        mn = area;
                    }
                    if area <= 1e-5 {
                        closed = true;
                        break;
                    }
                    inv += 1.0 / area;
                }
                // actual grid samples inside the section (a point closure must seal the section)
                let a0 = s0 + d * i as f64;
                let a1 = s0 + d * (i as f64 + 1.0) + if i == n - 1 { 1e-6 } else { 0.0 };
                while gi < g.len() && g[gi].s < a0 {
                    gi += 1;
                }
                let mut q = gi;
                while q < g.len() && g[q].s <= a1 {
                    if g[q].area < mn {
                        mn = g[q].area;
                    }
                    if g[q].area <= 1e-5 {
                        closed = true;
                    }
                    q += 1;
                }
                out[i] = if closed { 0.0 } else { sub as f64 / inv };
                if let Some(m) = mins.as_deref_mut() {
                    m[i] = if closed { 0.0 } else { js_min(mn, out[i]) };
                }
            }
        };
        let sp = f.pharynx_length;
        fill(0.0, sp, out_ph, min_ph);
        fill(sp, f.lip_s, out_or, min_or);
        (sp, f.lip_s - sp)
    }
}

/// The parts of the tract `compute` needs while its scratch buffers are borrowed.
#[derive(Clone, Copy)]
struct HumanVocalTractView {
    k: f64,
    body: HumanBody,
    condyle: Vec2,
}

impl HumanVocalTractView {
    #[inline]
    fn p(&self, x: f64, y: f64) -> Vec2 {
        let k = self.k;
        let ph = self.body.pharynx;
        let xx = if x > 0.5 { 0.5 + (x - 0.5) * 0.86 } else { x };
        let yy = if y < 7.0 { 7.0 - (7.0 - y) * ph } else { y };
        v(xx * k, yy * k)
    }
}

struct Projection {
    s: f64,
    dist: f64,
    signed: f64,
    x: f64,
    y: f64,
    seg: usize,
}

/// Project a point onto a polyline: arc position, distance, and the side (cross<0 = airway side).
fn project_on(pl: &Polyline, cum: &[f64], px: f64, py: f64) -> Projection {
    let mut best = f64::INFINITY;
    let (mut bs, mut bx, mut by, mut sign, mut bseg) = (0.0, 0.0, 0.0, 1.0, 0usize);
    for i in 0..pl.xs.len().saturating_sub(1) {
        let (ax, ay) = (pl.xs[i], pl.ys[i]);
        let (ex, ey) = (pl.xs[i + 1] - ax, pl.ys[i + 1] - ay);
        let l2 = ex * ex + ey * ey;
        if l2 < 1e-12 {
            continue;
        }
        let mut t = ((px - ax) * ex + (py - ay) * ey) / l2;
        t = if t < 0.0 {
            0.0
        } else if t > 1.0 {
            1.0
        } else {
            t
        };
        let (qx, qy) = (ax + ex * t, ay + ey * t);
        let d = hypot(px - qx, py - qy);
        if d < best {
            best = d;
            bs = cum[i] + t * sqrt(l2);
            bx = qx;
            by = qy;
            let cross = ex * (py - ay) - ey * (px - ax);
            sign = if cross < 0.0 { 1.0 } else { -1.0 };
            bseg = i;
        }
    }
    Projection { s: bs, dist: best, signed: sign * best, x: bx, y: by, seg: bseg }
}

/// The point at arc length s along a polyline.
fn point_along(pl: &Polyline, cum: &[f64], s: f64) -> Vec2 {
    let mut i = 0usize;
    while i + 2 < cum.len() && cum[i + 1] < s {
        i += 1;
    }
    let l = cum[i + 1] - cum[i];
    let u = if l > 1e-9 { clamp((s - cum[i]) / l, 0.0, 1.0) } else { 0.0 };
    v(pl.xs[i] + (pl.xs[i + 1] - pl.xs[i]) * u, pl.ys[i] + (pl.ys[i + 1] - pl.ys[i]) * u)
}

/// Distance from a point to a closed polygon's boundary (its last point repeats its first),
/// negative inside (even-odd rule), in one pass over the edges.
fn signed_gap(pl: &Polyline, px: f64, py: f64) -> f64 {
    let mut best = f64::INFINITY;
    let mut inside = false;
    let (xs, ys) = (&pl.xs, &pl.ys);
    for i in 0..xs.len().saturating_sub(1) {
        let (ax, ay, bx, by) = (xs[i], ys[i], xs[i + 1], ys[i + 1]);
        let (ex, ey) = (bx - ax, by - ay);
        let l2 = ex * ex + ey * ey;
        let mut t = if l2 > 1e-12 { ((px - ax) * ex + (py - ay) * ey) / l2 } else { 0.0 };
        t = if t < 0.0 {
            0.0
        } else if t > 1.0 {
            1.0
        } else {
            t
        };
        let (dx, dy) = (px - ax - ex * t, py - ay - ey * t);
        let d2 = dx * dx + dy * dy;
        if d2 < best {
            best = d2;
        }
        if (ay > py) != (by > py) && px < ax + ((py - ay) * ex) / ey {
            inside = !inside;
        }
    }
    let d = sqrt(best);
    if inside { -d } else { d }
}

/// Closest approach of a set of tissue points to the roof: signed gap δ (negative = pressed in) and the roof normal there.
fn closest_approach(pl: &Polyline, cum: &[f64], pts: &[Vec2]) -> (f64, Vec2) {
    let mut d = f64::INFINITY;
    let mut seg = 0usize;
    for p in pts {
        let pr = project_on(pl, cum, p.x, p.y);
        if pr.signed < d {
            d = pr.signed;
            seg = pr.seg;
        }
    }
    // inward normal of the roof segment (airway side is to the right of travel: (ey, −ex))
    let (ex, ey) = (pl.xs[seg + 1] - pl.xs[seg], pl.ys[seg + 1] - pl.ys[seg]);
    let l = hypot(ex, ey);
    let l = if l == 0.0 || l.is_nan() { 1.0 } else { l };
    (d, v(ey / l, -ex / l))
}

/// Clamp drawn tissue points that penetrate a wall onto its surface (drawing only).
pub fn clamp_to_wall(points: &[Vec2], wall: &[Vec2]) -> Vec<Vec2> {
    let mut pl = Polyline::with_capacity(wall.len());
    pl.append(wall, false);
    let mut cum = vec![0.0; wall.len()];
    for i in 1..wall.len() {
        cum[i] = cum[i - 1] + hypot(wall[i].x - wall[i - 1].x, wall[i].y - wall[i - 1].y);
    }
    points
        .iter()
        .map(|p| {
            let pr = project_on(&pl, &cum, p.x, p.y);
            if pr.signed < 0.0 && pr.dist < 1.5 { v(pr.x, pr.y) } else { *p }
        })
        .collect()
}
