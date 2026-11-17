//! Physical constants for airway acoustics, CGS units throughout
//! (cm, g, s; pressure in dyn/cm² = 0.1 Pa; volume velocity in cm³/s).

/// Air density at body temperature, saturated (g/cm³).
pub const RHO: f64 = 1.14e-3;
/// Speed of sound in warm humid air (cm/s).
pub const C_SOUND: f64 = 35000.0;
/// Dynamic viscosity of air (poise = g/(cm·s)).
pub const MU: f64 = 1.86e-4;
/// Kinematic viscosity (cm²/s).
pub const NU: f64 = MU / RHO;
/// ρc² — bulk modulus of air (dyn/cm²).
pub const RHO_C2: f64 = RHO * C_SOUND * C_SOUND;
/// 1 cm H2O in dyn/cm².
pub const CM_H2O: f64 = 980.665;

/// Soft-tissue wall parameters per unit area (Ishizaka, French & Flanagan 1975, cheek/neck).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WallParams {
    /// mass per unit area (g/cm²)
    pub mass: f64,
    /// resistance per unit area (dyn·s/cm³)
    pub resistance: f64,
    /// stiffness per unit area (dyn/cm³)
    pub stiffness: f64,
}

pub const WALL_SOFT: WallParams = WallParams { mass: 1.5, resistance: 1600.0, stiffness: 3.0e5 };
/// Cartilaginous trachea: stiffer and lighter.
pub const WALL_TRACHEA: WallParams = WallParams { mass: 0.6, resistance: 1000.0, stiffness: 1.0e6 };
/// Nasal mucosa: lossy.
pub const WALL_NASAL: WallParams = WallParams { mass: 1.0, resistance: 3000.0, stiffness: 1.0e6 };

/// Critical Reynolds number for onset of turbulence noise.
pub const RE_CRIT: f64 = 1800.0;
