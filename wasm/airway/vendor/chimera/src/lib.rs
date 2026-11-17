//! CHIMERA: a physical-modelling voice engine. Every sound comes from a simulated airway.
//!
//! The crate is headless and deterministic: no I/O, no global mutable state, and all
//! transcendental math goes through [`math`] (pure-Rust libm), so native and wasm32 builds
//! render bit-identical samples. Voices are `Send` and allocate nothing while rendering.

pub mod math;
pub mod physics;

pub mod airway {
    pub mod decimator;
    pub mod frequency;
    pub mod network;
}

pub mod anatomy {
    pub mod geom;
    pub mod human;
}

pub mod sources {
    pub mod glottis;
    pub mod syrinx;
    pub mod valves;
}

pub mod control {
    pub mod articulators;
    pub mod beat_player;
    pub mod score;
}

pub mod voice {
    pub mod human_airway;
    pub mod human_voice;
}

pub mod analysis {
    pub mod fft;
    pub mod lpc;
    pub mod pitch;
}

pub mod util {
    pub mod optimize;
}

pub mod creatures;
pub mod engine;
pub mod phonetics;

/// Parse every embedded data table now (an `Engine` does this when it is created), so nothing
/// initialises lazily on an audio thread later.
pub fn init() {
    phonetics::planner::init();
    phonetics::inventory::init();
    phonetics::beatbox::init();
    phonetics::ipa::init();
    creatures::init();
}
