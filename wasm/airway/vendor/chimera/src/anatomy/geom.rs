//! 2D geometry helpers for articulatory models. Builders that produce point lists write into a
//! caller's `Vec` (cleared first) so per-control-step geometry allocates nothing once warm.

use crate::math::{acos, atan2, cos, hypot, sin};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

#[inline(always)]
pub const fn v(x: f64, y: f64) -> Vec2 {
    Vec2 { x, y }
}
#[inline(always)]
pub fn add(a: Vec2, b: Vec2) -> Vec2 {
    v(a.x + b.x, a.y + b.y)
}
#[inline(always)]
pub fn sub(a: Vec2, b: Vec2) -> Vec2 {
    v(a.x - b.x, a.y - b.y)
}
#[inline(always)]
pub fn scale(a: Vec2, s: f64) -> Vec2 {
    v(a.x * s, a.y * s)
}
#[inline(always)]
pub fn len(a: Vec2) -> f64 {
    hypot(a.x, a.y)
}
#[inline(always)]
pub fn dist(a: Vec2, b: Vec2) -> f64 {
    hypot(a.x - b.x, a.y - b.y)
}
#[inline(always)]
pub fn norm(a: Vec2) -> Vec2 {
    let l = hypot(a.x, a.y);
    let l = if l == 0.0 || l.is_nan() { 1.0 } else { l };
    v(a.x / l, a.y / l)
}
#[inline(always)]
pub fn lerp_v(a: Vec2, b: Vec2, t: f64) -> Vec2 {
    v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
}
#[inline(always)]
pub fn polar(c: Vec2, r: f64, ang: f64) -> Vec2 {
    v(c.x + r * cos(ang), c.y + r * sin(ang))
}
#[inline(always)]
pub fn rotate_about(p: Vec2, c: Vec2, ang: f64) -> Vec2 {
    let s = sin(ang);
    let co = cos(ang);
    let dx = p.x - c.x;
    let dy = p.y - c.y;
    v(c.x + dx * co - dy * s, c.y + dx * s + dy * co)
}

/// Polyline stored as flat arrays for fast intersection.
#[derive(Clone, Debug, Default)]
pub struct Polyline {
    pub xs: Vec<f64>,
    pub ys: Vec<f64>,
}

impl Polyline {
    pub fn with_capacity(n: usize) -> Self {
        Polyline { xs: Vec::with_capacity(n), ys: Vec::with_capacity(n) }
    }
    #[inline]
    pub fn push(&mut self, p: Vec2) -> &mut Self {
        self.xs.push(p.x);
        self.ys.push(p.y);
        self
    }
    pub fn append(&mut self, pts: &[Vec2], skip_first: bool) -> &mut Self {
        for p in &pts[usize::from(skip_first).min(pts.len())..] {
            self.push(*p);
        }
        self
    }
    #[inline]
    pub fn len(&self) -> usize {
        self.xs.len()
    }
    pub fn is_empty(&self) -> bool {
        self.xs.is_empty()
    }
    #[inline]
    pub fn point(&self, i: usize) -> Vec2 {
        v(self.xs[i], self.ys[i])
    }
    pub fn to_points(&self, out: &mut Vec<Vec2>) {
        out.clear();
        out.extend(self.xs.iter().zip(&self.ys).map(|(&x, &y)| v(x, y)));
    }
    pub fn clear(&mut self) {
        self.xs.clear();
        self.ys.clear();
    }
}

/// All intersections of the ray o + t·d (t in [t_min, t_max]) with a polyline.
/// Writes parameters t into `out` and returns their count.
#[allow(clippy::too_many_arguments)]
pub fn ray_polyline(ox: f64, oy: f64, dx: f64, dy: f64, pl: &Polyline, t_min: f64, t_max: f64, out: &mut [f64]) -> usize {
    let mut n = 0;
    let (xs, ys) = (&pl.xs, &pl.ys);
    for i in 0..xs.len().saturating_sub(1) {
        let t = crossing_t(ox, oy, dx, dy, xs[i], ys[i], xs[i + 1], ys[i + 1]);
        if t >= t_min && t <= t_max && n < out.len() {
            out[n] = t;
            n += 1;
        }
    }
    n
}

/// Where segment A→B crosses the line through o along d (as t along d), or NaN. A segment
/// crosses only if its ends lie on different sides of the line, a point on the line counting as
/// the positive side: a polyline passing through a vertex then crosses once, and one that only
/// touches the line at a vertex crosses twice at the same t or not at all.
#[allow(clippy::too_many_arguments)]
#[inline]
fn crossing_t(ox: f64, oy: f64, dx: f64, dy: f64, ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let sa = dx * (ay - oy) - dy * (ax - ox) >= 0.0;
    let sb = dx * (by - oy) - dy * (bx - ox) >= 0.0;
    if sa == sb {
        return f64::NAN;
    }
    let ex = bx - ax;
    let ey = by - ay;
    let den = dx * ey - dy * ex;
    if den.abs() < 1e-15 {
        return f64::NAN;
    }
    ((ax - ox) * ey - (ay - oy) * ex) / den
}

/// Like `ray_polyline`, also telling for each crossing whether the ray leaves the tissue (the
/// polyline's right-hand side, along its direction) for the air: `exit[i]` is true then.
#[allow(clippy::too_many_arguments)]
pub fn ray_crossings(ox: f64, oy: f64, dx: f64, dy: f64, pl: &Polyline, t_min: f64, t_max: f64, out_t: &mut [f64], exit: &mut [bool]) -> usize {
    let mut n = 0;
    let (xs, ys) = (&pl.xs, &pl.ys);
    for i in 0..xs.len().saturating_sub(1) {
        let t = crossing_t(ox, oy, dx, dy, xs[i], ys[i], xs[i + 1], ys[i + 1]);
        if t >= t_min && t <= t_max && n < out_t.len() {
            out_t[n] = t;
            // leaving the tissue (on the polyline's right) for the air: the ray turns left across it
            exit[n] = dx * (ys[i + 1] - ys[i]) - dy * (xs[i + 1] - xs[i]) < 0.0;
            n += 1;
        }
    }
    n
}

/// Sample a cubic Bézier into `count` points (including both ends), appended to `out`.
pub fn bezier3(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, count: usize, out: &mut Vec<Vec2>) {
    out.clear();
    for i in 0..count {
        let t = i as f64 / (count as f64 - 1.0);
        let u = 1.0 - t;
        let a = u * u * u;
        let b = 3.0 * u * u * t;
        let c = 3.0 * u * t * t;
        let d = t * t * t;
        out.push(v(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y));
    }
}

/// Sample a quadratic Bézier into `out` (cleared first).
pub fn bezier2(p0: Vec2, p1: Vec2, p2: Vec2, count: usize, out: &mut Vec<Vec2>) {
    out.clear();
    for i in 0..count {
        let t = i as f64 / (count as f64 - 1.0);
        let u = 1.0 - t;
        out.push(v(u * u * p0.x + 2.0 * u * t * p1.x + t * t * p2.x, u * u * p0.y + 2.0 * u * t * p1.y + t * t * p2.y));
    }
}

/// Arc from angle a0 to a1 (radians, either direction), `count` points, into `out` (cleared first).
pub fn arc(c: Vec2, r: f64, a0: f64, a1: f64, count: usize, out: &mut Vec<Vec2>) {
    out.clear();
    for i in 0..count {
        out.push(polar(c, r, a0 + ((a1 - a0) * i as f64) / (count as f64 - 1.0)));
    }
}

/// Catmull–Rom spline through points (uniform), `per` samples per segment.
pub fn catmull_rom(pts: &[Vec2], per: usize) -> Vec<Vec2> {
    if pts.len() < 3 {
        return pts.to_vec();
    }
    let mut out = Vec::with_capacity((pts.len() - 1) * per + 1);
    for i in 0..pts.len() - 1 {
        let p0 = pts[i.saturating_sub(1)];
        let p1 = pts[i];
        let p2 = pts[i + 1];
        let p3 = pts[(i + 2).min(pts.len() - 1)];
        for k in 0..per {
            let t = k as f64 / per as f64;
            let t2 = t * t;
            let t3 = t2 * t;
            out.push(v(
                0.5 * (2.0 * p1.x + (-p0.x + p2.x) * t + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2 + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3),
                0.5 * (2.0 * p1.y + (-p0.y + p2.y) * t + (2.0 * p0.y - 5.0 * p1.y + 4.0 * p2.y - p3.y) * t2 + (-p0.y + 3.0 * p1.y - 3.0 * p2.y + p3.y) * t3),
            ));
        }
    }
    out.push(pts[pts.len() - 1]);
    out
}

/// Upper (or lower) tangent point from external point p to circle (c, r): its angle on the circle.
pub fn tangent_angle(c: Vec2, r: f64, p: Vec2, upper: bool) -> Option<f64> {
    let d = dist(c, p);
    if d <= r * 1.0001 {
        return None;
    }
    let base = atan2(p.y - c.y, p.x - c.x);
    let off = acos(r / d);
    Some(if upper { base + off } else { base - off })
}
