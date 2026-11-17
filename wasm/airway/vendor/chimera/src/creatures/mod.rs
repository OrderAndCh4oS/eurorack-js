//! Non-human creatures: their airways, sources, playable parameters and calls.
pub mod alligator;
pub mod build;
pub mod elephant;
pub mod mammal;
pub mod seal;
pub mod songbird;
pub mod types;
pub mod voice;

pub use types::{CreatureDef, CreatureSim};
pub use voice::{CreatureTelemetry, CreatureVoice};

use std::sync::LazyLock;

/// Creature registry (built once; [`init`] forces it).
pub static CREATURES: LazyLock<Vec<CreatureDef>> = LazyLock::new(|| vec![songbird::def(), seal::def(), alligator::def(), elephant::def()]);

pub fn creature_by_id(id: &str) -> Option<&'static CreatureDef> {
    CREATURES.iter().find(|c| c.id == id)
}

/// Build the registry and the tables the creatures use now, so nothing initialises lazily on the
/// audio thread.
pub fn init() {
    LazyLock::force(&CREATURES);
    crate::sources::syrinx::init();
}
