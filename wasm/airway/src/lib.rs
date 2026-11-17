//! Airway's narrow ABI. Every instance owns one real CHIMERA HumanVoice.
//! Only init/setup allocate; JS restores complete linear memory between ABI calls.
use chimera::anatomy::human::{ArticKey, ArticPatch, BodyMix, NEUTRAL, rest_tip};
use chimera::phonetics::inventory::{phoneme, PhonemeDef, Voicing};
use chimera::control::beat_player::BeatPlayer;
use chimera::control::score::{ControlKey, Gesture, Targets, N_CONTROL};
use chimera::phonetics::{beatbox, planner};
use chimera::phonetics::beatbox::{BEAT_SOUNDS, BeatStep, MAX_SOUND_GESTURES, beat_ready};
use chimera::voice::human_voice::{HumanVoice, SourcePatch, oversample_for};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicU32, Ordering};

struct CountedAllocator;
static ALLOCATIONS: AtomicU32 = AtomicU32::new(0);
unsafe impl GlobalAlloc for CountedAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.alloc(layout) }
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.alloc_zeroed(layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.realloc(ptr, layout, size) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}
#[global_allocator]
static ALLOCATOR: CountedAllocator = CountedAllocator;

const OUTPUT_CAPACITY: usize = 2048;
pub struct Airway {
    voice: HumanVoice,
    vowels: [ArticPatch; 5],
    consonants: [PhonemeDef; 8],
    alphabet: [Option<PhonemeDef>; 32],
    releases: [Option<PhonemeDef>; 32],
    scratch: Vec<Gesture>,
    player: BeatPlayer,
    beat_gestures: Vec<Gesture>,
    beat_onset: f64,
    output: [f32; OUTPUT_CAPACITY],
    rendered_samples: u64,
    score_end_sample: u64,
    hum_active: bool,
    hum_target: f64,
    vocal_voicing: f64,
    vocal_nasal: f64,
    vocal_twang: f64,
    speech_frame: [f64; N_CONTROL * 3],
}

impl Airway {
    fn new(rate: f64) -> Self {
        Self::new_for_body(rate, BodyMix::MALE)
    }

    fn new_for_body(rate: f64, body: BodyMix) -> Self {
        // Parse tables before taking any snapshot. No LazyLock may initialize later.
        beatbox::init();
        let vowels = ["ɑ", "e", "i", "o", "u"].map(|ipa| planner::vowel_artic(ipa, body).unwrap());
        let consonants = ["m", "n", "b", "d", "g", "f", "s", "ʃ"]
            .map(|ipa| phoneme(ipa, body).expect("Vocal consonant inventory"));
        // A–Z, SH CH TH DH NG ZH. Vowels use the existing five calibrated postures.
        let alphabet = ["", "b", "k", "d", "", "f", "g", "h", "", "dʒ", "k", "l", "m", "n", "", "p",
            "k", "ɹ", "s", "t", "", "v", "w", "k", "j", "z", "ʃ", "tʃ", "θ", "ð", "ŋ", "ʒ"]
            .map(|ipa| if ipa.is_empty() { None } else { Some(phoneme(ipa, body).expect("Vocal alphabet inventory")) });
        let releases = std::array::from_fn(|index| {
            let release = match index { 16 => Some("w"), 23 => Some("s"), _ => alphabet[index].and_then(|p| p.release) };
            release.map(|ipa| phoneme(ipa, body).expect("Vocal release inventory"))
        });
        let mut voice = HumanVoice::new(rate, body.body(), oversample_for(rate));
        voice.set_source(&SourcePatch {
            roughness: Some(0.0), drift: Some(0.0), vibrato_depth: Some(0.0),
            glide: Some(0.005), ..Default::default()
        });
        // HumanAirway lazily allocates four area-history buffers on its first
        // positive-dt geometry update. Warm them without advancing voice time.
        voice.airway.apply(&voice.artic.x, 64.0 / rate);
        voice.airway.net.snap_to_targets();
        Self { voice, vowels, consonants, alphabet, releases, scratch: Vec::with_capacity(MAX_SOUND_GESTURES),
            player: BeatPlayer::new(), beat_gestures: Vec::with_capacity(MAX_SOUND_GESTURES), beat_onset: 0.0, output: [0.0; OUTPUT_CAPACITY],
            rendered_samples: 0, score_end_sample: 0, hum_active: false, hum_target: 0.0,
            vocal_voicing: 1.0, vocal_nasal: 0.0, vocal_twang: 0.0, speech_frame: [0.0; N_CONTROL * 3] }
    }

    // The off-thread planner supplies full overlapping gestures. JS blends them
    // at speech time; these single-channel constant gestures preserve the native
    // weighting/speed laws without loading an unbounded sentence into the score.
    fn set_speech(&mut self, f0: f64, breath: f64) {
        let f0 = finite(f0, 110.0, 40.0, 1100.0);
        self.voice.set_source_live(&SourcePatch {
            f0: Some(f0), pressure: Some(8.0), breathiness: Some(finite(breath, 0.15, 0.0, 1.0)),
            tension: Some(0.5), glide: Some(0.03), ..Default::default()
        });
        self.voice.set_gate(0.0);
        self.voice.artic.tip_free = false;
        self.voice.score.clear();
        self.score_end_sample = 0;
        let t = self.voice.clock;
        for i in 0..N_CONTROL {
            let key = ControlKey::from_index(i);
            let raw = self.speech_frame[i*3];
            let value = if let ControlKey::Artic(k) = key {
                let spec = chimera::control::articulators::artic_spec(k);
                finite(raw, 0.0, spec.min, spec.max)
            } else if key == ControlKey::F0 { f0 }
            else { finite(raw, 0.0, -1.0, 200.0) };
            let weight = finite(self.speech_frame[i*3+1], 0.0, 0.0, 1000.0);
            let speed = finite(self.speech_frame[i*3+2], 1.0, 1.0, 100.0);
            let g = Gesture::new(t-0.001, t+1.0, 0.0, 0.0, weight, Targets::default().with(key,value)).speed(speed);
            self.voice.score.add(g);
        }
    }

    fn voice_baseline(&mut self) {
        self.voice.artic.snap(&self.vowels[0]);
        self.voice.artic.tip_free = true;
        let x = self.voice.artic.x;
        let tip = rest_tip(x.jaw, x.tb_x, x.tb_y);
        self.voice.artic.snap(&ArticPatch::default().with(ArticKey::TtX, tip.x).with(ArticKey::TtY, tip.y));
        self.voice.airway.apply(&self.voice.artic.x, 0.0);
        self.voice.airway.net.snap_to_targets();
    }

    fn prepare_beat(&mut self, sound: usize) -> usize {
        let id = BEAT_SOUNDS[sound].id;
        self.voice.artic.snap(&beat_ready(BodyMix::MALE));
        self.voice.artic.tip_free = false;
        let lead = BeatPlayer::lead_in_with(id, BodyMix::MALE, &mut self.scratch);
        self.beat_onset = lead;
        self.scratch.clear();
        self.player.gestures(&BeatStep::new(id), lead, 0.18, &mut self.scratch);
        assert!(self.scratch.len() <= MAX_SOUND_GESTURES);
        self.voice.schedule(&self.scratch);
        // Gesture.end includes ramp_out and release_hold. Track output frames,
        // not voice.clock, which advances at the start of each 64-frame control
        // interval and therefore runs ahead of partially rendered intervals.
        self.score_end_sample = (self.voice.score.end * self.voice.fs_out).ceil() as u64;
        self.hum_active = sound == 9;
        self.hum_target = 0.0;
        ((lead - 0.003) * self.voice.fs_out).round() as usize
    }

    // Edit the prepared score once at a hit. Preserve its existing closure and
    // onset; Decay stretches the post-onset endings, Snap changes the releases.
    fn configure_beat(&mut self, decay: f64, snap: f64) {
        let decay = finite(decay, 1.0, 0.125, 8.0);
        let speed = 2.0_f64.powf(2.0 * (finite(snap, 0.5, 0.0, 1.0) - 0.5));
        let onset = self.beat_onset;
        self.beat_gestures.clear();
        for original in self.voice.score.gestures() {
            let mut g = *original;
            if g.t1 > onset { g.t1 = (onset + (g.t1 - onset) * decay).max(g.t0 + 0.001); }
            g.ramp_out *= decay / speed;
            if let Some(hold) = g.release_hold { g.release_hold = Some(hold * decay / speed); }
            if let Some(s) = g.speed { g.speed = Some(s * speed); }
            self.beat_gestures.push(g);
        }
        self.voice.score.clear();
        self.voice.schedule(&self.beat_gestures);
        self.score_end_sample = (self.voice.score.end * self.voice.fs_out).ceil() as u64;
    }

    // Controls act on canonical targets, never on last tick's modified values.
    // No score/physical restart and no allocations at the control boundary.
    #[allow(clippy::too_many_arguments)]
    fn set_beat(&mut self, f0: f64, shape: f64, pressure: f64, breath: f64,
                tension: f64, fry: f64, noise: f64, nasal: f64, lips: f64,
                tongue: f64, throat: f64, voicing: f64) {
        let nasal = finite(nasal, 0.0, 0.0, 1.0);
        let lips = finite(lips, 0.0, -1.0, 1.0);
        let tongue = finite(tongue, 0.0, -1.0, 1.0);
        let throat = finite(throat, 0.0, 0.0, 1.0);
        if !self.beat_gestures.is_empty() && self.remaining_samples() > 0 {
            self.scratch.clear();
            for original in &self.beat_gestures {
                let mut g = *original;
                for (key, amount) in [(ArticKey::LipAp, lips * 0.3), (ArticKey::LipProt, lips * 0.25),
                    (ArticKey::TbX, tongue * 0.3), (ArticKey::TbY, tongue * 0.3), (ArticKey::TtX, tongue * 0.25)] {
                    if amount != 0.0 { if let Some(value) = g.targets.get(key) {
                        let spec = chimera::control::articulators::artic_spec(key);
                        g.targets.set(key, (value + amount).clamp(spec.min, spec.max));
                    } }
                }
                if nasal > 0.0 { g.targets.set(ArticKey::Velum, g.targets.get(ArticKey::Velum).unwrap_or(-0.15).max(nasal * 0.9)); }
                if throat > 0.0 { g.targets.set(ArticKey::Epilarynx, g.targets.get(ArticKey::Epilarynx).unwrap_or(0.0).max(throat * 0.8)); }
                if let Some(_) = g.targets.get(ControlKey::F0) { g.targets.set(ControlKey::F0, finite(f0, 110.0, 40.0, 1100.0)); }
                self.scratch.push(g);
            }
            self.voice.score.clear();
            self.voice.schedule(&self.scratch);
        }
        self.set_voice(f0, shape, pressure, breath, tension, fry, 0.0);
        let noise = finite(noise, 1.0, 0.0, 2.0);
        self.voice.airway.noise_gain.glottis = 3.2e-6 * noise;
        self.voice.airway.noise_gain.constriction = 2.2e-6 * noise;
        self.voice.airway.noise_gain.teeth = 3.0e-6 * noise;
        self.voice.glottis.params.amplitude *= finite(voicing, 1.0, 0.0, 1.0);
        // Set the whole neutral base each time so removed CV leaves no stale key.
        let position = finite(shape, 0.0, 0.0, 4.0);
        let index = position as usize;
        let fraction = position - index as f64;
        let vowel = ArticPatch::blend(&[(1.0 - fraction, self.vowels[index]), (fraction, self.vowels[(index + 1).min(4)])]);
        let mut base = vowel.apply_to(&NEUTRAL);
        base.lip_ap += lips * 0.3;
        base.lip_prot += lips * 0.25;
        base.tb_x += tongue * 0.3;
        base.tb_y += tongue * 0.3;
        base.velum = -0.15 + 1.05 * nasal;
        base.epilarynx = throat * 0.8;
        let tip = rest_tip(base.jaw, base.tb_x, base.tb_y);
        base.tt_x = tip.x + tongue * 0.25;
        base.tt_y = tip.y;
        let mut posture = ArticPatch::default();
        for key in ArticKey::ALL { posture.set(key, base.get(key)); }
        self.voice.set_articulation(&posture, Some(self.remaining_samples() == 0));
    }

    fn retarget_hum(&mut self, f0: f64) {
        if !self.hum_active || self.remaining_samples() == 0 || self.hum_target == f0 { return; }
        // Public score access is read-only. Reuse reserved scratch to replace every
        // remaining pitch gesture; setting source.f0 alone would lose to the score.
        self.scratch.clear();
        self.scratch.extend_from_slice(self.voice.score.gestures());
        for gesture in &mut self.scratch {
            if gesture.targets.get(ControlKey::F0).is_some() {
                gesture.targets.set(ControlKey::F0, f0);
            }
        }
        self.voice.score.clear();
        self.voice.schedule(&self.scratch);
        // F0 is a target consumed by the native control tick. Applying the
        // whole source here would overwrite the held glottal score controls.
        self.voice.source.f0 = f0;
        self.hum_target = f0;
    }

    fn remaining_samples(&self) -> usize {
        self.score_end_sample.saturating_sub(self.rendered_samples) as usize
    }

    fn render(&mut self, count: usize) {
        let count = count.min(OUTPUT_CAPACITY);
        let remaining = self.remaining_samples();
        let first = if remaining > 0 { count.min(remaining) } else { count };
        self.voice.render(&mut self.output[..first]);
        self.rendered_samples += first as u64;
        if remaining > 0 && self.remaining_samples() == 0 {
            // Every ramp and release hold has finished. Preserve the existing
            // pressure, gate, RNG and filters; only retire the score and allow
            // the tongue tip to return through its normal target dynamics.
            self.voice.score.clear();
            self.voice.artic.tip_free = true;
            self.hum_active = false;
        }
        if first < count {
            self.voice.render(&mut self.output[first..count]);
            self.rendered_samples += (count - first) as u64;
        }
    }

    fn set_voice(&mut self, f0: f64, vowel: f64, pressure: f64, breath: f64, tension: f64, fry: f64, gate: f64) {
        let f0 = finite(f0, 110.0, 40.0, 1100.0);
        let vowel = finite(vowel, 0.0, 0.0, 4.0);
        let index = vowel as usize;
        let fraction = vowel - index as f64;
        let posture = ArticPatch::blend(&[(1.0 - fraction, self.vowels[index]), (fraction, self.vowels[(index + 1).min(4)])]);
        self.retarget_hum(f0);
        self.voice.set_articulation(&posture, Some(self.remaining_samples() == 0));
        self.voice.set_source_live(&SourcePatch {
            f0: Some(f0),
            pressure: Some(finite(pressure, 8.0, 0.0, 22.0)),
            breathiness: Some(finite(breath, 0.15, 0.0, 1.0)),
            tension: Some(finite(tension, 0.5, 0.0, 1.0)),
            fry: Some(finite(fry, 0.0, 0.0, 1.0)),
            ..Default::default()
        });
        self.voice.set_gate(finite(gate, 0.0, 0.0, 1.0));
    }

    // Vocal is a continuously controlled mouth. It never invokes prepare_beat,
    // replaces a score, or restores physical memory. See research/modules/vocal.md.
    fn set_vocal(&mut self, f0: f64, vowel: f64, pressure: f64, breath: f64, tension: f64, fry: f64, gate: f64, consonant: f64, amount: f64) {
        self.set_voice(f0, vowel, pressure, breath, tension, fry, gate);
        let selected = self.consonants[finite(consonant, 0.0, 0.0, 7.0) as usize];
        self.apply_vocal(vowel, Some(selected), None, amount);
    }

    // Source values are applied with the next set_phoneme, before the phoneme's
    // voiced/unvoiced blend. Keeping one blend avoids accumulating abduction.
    fn set_vocal_controls(&mut self, brightness: f64, roughness: f64, voicing: f64,
                          nasal: f64, twang: f64, glide: f64, morph: f64) {
        self.voice.source.brightness = finite(brightness, 0.25, 0.0, 1.0);
        self.voice.source.roughness = finite(roughness, 0.0, 0.0, 1.0);
        self.voice.source.glide = finite(glide, 0.005, 0.002, 1.0);
        self.vocal_voicing = finite(voicing, 1.0, 0.0, 1.0);
        self.vocal_nasal = finite(nasal, 0.0, 0.0, 1.0);
        self.vocal_twang = finite(twang, 0.0, 0.0, 1.0);
        // Only slow the native critically damped dynamics: never exceed their
        // numerical stability limit. See vocal.md for timing and source evidence.
        self.voice.artic.speed.fill(1.0 / (1.0 + 19.0 * finite(morph, 0.0, 0.0, 1.0)));
    }

    #[allow(clippy::too_many_arguments)]
    fn set_phoneme(&mut self, f0: f64, vowel: f64, pressure: f64, breath: f64,
                   tension: f64, fry: f64, gate: f64, sound: f64, amount: f64) {
        let index = finite(sound, 0.0, 0.0, 31.0) as usize;
        let position = match index { 0 => 0.0, 4 => 1.0, 8 => 2.0, 14 => 3.0, 20 => 4.0, _ => vowel };
        self.set_voice(f0, position, pressure, breath, tension, fry, gate);
        self.apply_vocal(position, self.alphabet[index], self.releases[index], amount);
    }

    fn apply_vocal(&mut self, vowel: f64, selected: Option<PhonemeDef>, release: Option<PhonemeDef>, amount: f64) {
        let position = finite(vowel, 0.0, 0.0, 4.0);
        let index = position as usize;
        let fraction = position - index as f64;
        let vowel_patch = ArticPatch::blend(&[(1.0 - fraction, self.vowels[index]), (fraction, self.vowels[(index + 1).min(4)])]);
        let mut base = vowel_patch.apply_to(&NEUTRAL);
        let tip = rest_tip(base.jaw, base.tb_x, base.tb_y);
        base.tt_x = tip.x;
        base.tt_y = tip.y;
        base.velum = -0.15;
        let amount = finite(amount, 0.0, 0.0, 1.0);
        let mut target = base;
        let mut voicing = 1.0;
        if let Some(selected) = selected {
            let mut closed = selected.targets.apply_to(&base);
            closed.velum = if selected.nasal == Some(true) { 0.9 } else { -0.15 };
            let closed_voicing = if selected.voicing == Voicing::Voiceless { 0.0 } else { 1.0 };
            let mut from = base;
            let mut to = closed;
            let mut from_voicing = 1.0;
            let mut to_voicing = closed_voicing;
            let mut mix = amount;
            if let Some(release) = release {
                let mut released = release.targets.apply_to(&base);
                released.velum = if release.nasal == Some(true) { 0.9 } else { -0.15 };
                let release_voicing = if release.voicing == Voicing::Voiceless { 0.0 } else { 1.0 };
                // External Articulate traces closure -> release -> vowel as it falls.
                // See the alphabet-bank research; no internal phoneme timer is added.
                if amount <= 0.6 {
                    to = released; to_voicing = release_voicing; mix = amount / 0.6;
                } else {
                    from = released; from_voicing = release_voicing; mix = (amount - 0.6) / 0.4;
                }
            }
            for key in ArticKey::ALL { target.set(key, from.get(key) + mix * (to.get(key) - from.get(key))); }
            voicing = from_voicing + mix * (to_voicing - from_voicing);
        }
        target.velum = target.velum.max(-0.15 + 1.05 * self.vocal_nasal);
        // CHIMERA's epilarynx has little geometric change below .45. Preserve
        // exact neutral at zero and spend the knob travel on the useful region.
        if self.vocal_twang > 0.0 { target.epilarynx = target.epilarynx.max(0.45 + 0.55 * self.vocal_twang); }
        let mut posture = ArticPatch::default();
        for key in ArticKey::ALL { posture.set(key, target.get(key)); }
        self.voice.set_articulation(&posture, Some(false));
        self.voice.set_voicing_live(voicing * self.vocal_voicing);
    }

}

fn finite(value: f64, fallback: f64, min: f64, max: f64) -> f64 {
    if value.is_finite() { value.clamp(min, max) } else { fallback }
}

#[unsafe(no_mangle)]
pub extern "C" fn airway_create(rate: f64) -> *mut Airway {
    Box::into_raw(Box::new(Airway::new(finite(rate, 48000.0, 8000.0, 192000.0))))
}

#[unsafe(no_mangle)]
pub extern "C" fn airway_create_female(rate: f64) -> *mut Airway {
    Box::into_raw(Box::new(Airway::new_for_body(finite(rate, 48000.0, 8000.0, 192000.0), BodyMix::FEMALE)))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_output(ptr: *mut Airway) -> *mut f32 {
    unsafe { (*ptr).output.as_mut_ptr() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_voice_baseline(ptr: *mut Airway) {
    unsafe { (*ptr).voice_baseline() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_prepare_beat(ptr: *mut Airway, sound: u32) -> u32 {
    unsafe { (*ptr).prepare_beat((sound as usize).min(9)) as u32 }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_retarget_hum(ptr: *mut Airway, f0: f64) {
    unsafe { (*ptr).retarget_hum(finite(f0, 110.0, 40.0, 1100.0)) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_set_voice(ptr: *mut Airway, f0: f64, vowel: f64, pressure: f64, breath: f64, tension: f64, fry: f64, gate: f64) {
    unsafe { (*ptr).set_voice(f0, vowel, pressure, breath, tension, fry, gate) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_set_vocal(ptr: *mut Airway, f0: f64, vowel: f64, pressure: f64, breath: f64, tension: f64, fry: f64, gate: f64, consonant: f64, amount: f64) {
    unsafe { (*ptr).set_vocal(f0, vowel, pressure, breath, tension, fry, gate, consonant, amount) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_set_phoneme(ptr: *mut Airway, f0: f64, vowel: f64, pressure: f64, breath: f64, tension: f64, fry: f64, gate: f64, sound: f64, amount: f64) {
    unsafe { (*ptr).set_phoneme(f0, vowel, pressure, breath, tension, fry, gate, sound, amount) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_set_vocal_controls(ptr: *mut Airway, brightness: f64, roughness: f64, voicing: f64, nasal: f64, twang: f64, glide: f64, morph: f64) {
    unsafe { (*ptr).set_vocal_controls(brightness, roughness, voicing, nasal, twang, glide, morph) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_configure_beat(ptr: *mut Airway, decay: f64, snap: f64) {
    unsafe { (*ptr).configure_beat(decay, snap) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_set_beat(ptr: *mut Airway, f0: f64, shape: f64, pressure: f64, breath: f64, tension: f64, fry: f64, noise: f64, nasal: f64, lips: f64, tongue: f64, throat: f64, voicing: f64) {
    unsafe { (*ptr).set_beat(f0, shape, pressure, breath, tension, fry, noise, nasal, lips, tongue, throat, voicing) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_speech_frame(ptr: *mut Airway) -> *mut f64 {
    unsafe { (*ptr).speech_frame.as_mut_ptr() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_set_speech(ptr: *mut Airway, f0: f64, breath: f64) {
    unsafe { (*ptr).set_speech(f0, breath) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_render(ptr: *mut Airway, count: u32) {
    let a = unsafe { &mut *ptr };
    a.render(count as usize);
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_remaining_samples(ptr: *mut Airway) -> u32 {
    unsafe { (*ptr).remaining_samples() as u32 }
}

#[unsafe(no_mangle)]
pub extern "C" fn airway_allocations() -> u32 { ALLOCATIONS.load(Ordering::Relaxed) }

#[unsafe(no_mangle)]
pub unsafe extern "C" fn airway_destroy(ptr: *mut Airway) {
    if !ptr.is_null() { drop(unsafe { Box::from_raw(ptr) }); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn speech_frame_preserves_voicing_controls_and_never_allocates() {
        let mut a = Airway::new(48000.0);
        a.voice_baseline();
        let before = ALLOCATIONS.load(Ordering::Relaxed);
        for _ in 0..400 {
            a.speech_frame[ControlKey::BREATH.index()*3] = 1.0;
            a.speech_frame[ControlKey::BREATH.index()*3+1] = 1.0;
            a.set_speech(220.0, 0.15);
            a.render(64);
            assert!(a.output[..64].iter().all(|x| x.is_finite()));
        }
        assert!(a.output[..64].iter().any(|x| x.abs()>0.001));
        assert_eq!(before, ALLOCATIONS.load(Ordering::Relaxed));
        assert_eq!(a.voice.score.dropped, 0);
        a.speech_frame[ControlKey::ABDUCTION.index()*3] = 0.3;
        a.speech_frame[ControlKey::ABDUCTION.index()*3+1] = 6.0;
        a.set_speech(220.0, 0.15); a.render(64);
        assert!(a.voice.glottis.params.abduction > 0.2);
    }
    #[test]
    fn female_voice_uses_distinct_anatomy_and_calibrated_targets_at_equal_pitch() {
        let mut male = Airway::new(48000.0);
        let mut female = Airway::new_for_body(48000.0, BodyMix::FEMALE);
        assert_eq!(male.voice.airway.body.scale, 1.0);
        assert_eq!(female.voice.airway.body.scale, 0.9);
        assert_eq!(female.voice.airway.body.pharynx, 0.88);
        male.voice_baseline(); female.voice_baseline();
        for a in [&mut male, &mut female] {
            a.set_phoneme(220.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 0.0, 1.0);
            for _ in 0..8 { a.render(2048); }
            assert!((a.voice.glottis.params.f0 - 220.0).abs() < 0.01);
            assert!(a.output.iter().all(|x| x.is_finite()));
        }
        let target_difference: f64 = ArticKey::ALL.iter().map(|k|
            (male.voice.artic.target.get(*k) - female.voice.artic.target.get(*k)).abs()).sum();
        assert!(target_difference > 0.1);
        assert_ne!(male.output, female.output);
    }
    #[test]
    fn voice_controls_restore_canonical_targets_and_preserve_phoneme_voicing() {
        let mut a = Airway::new(48000.0);
        a.voice_baseline();
        for _ in 0..10 {
            a.set_vocal_controls(1.0, 1.0, 0.5, 1.0, 1.0, 0.4, 1.0);
            a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 0.0, 1.0);
            assert_eq!(a.voice.artic.target.velum, 0.9);
            assert_eq!(a.voice.artic.target.epilarynx, 1.0);
            assert_eq!(a.voice.glottis.params.amplitude, 0.17 * 0.5);
            assert_eq!(a.voice.source.brightness, 1.0);
            assert_eq!(a.voice.source.roughness, 1.0);
        }
        a.set_vocal_controls(0.25, 0.0, 1.0, 0.0, 0.0, 0.005, 0.0);
        a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 26.0, 1.0); // SH stays unvoiced
        assert_eq!(a.voice.glottis.params.amplitude, 0.0);
        assert_eq!(a.voice.artic.target.epilarynx, 0.0);
        a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 12.0, 1.0); // M stays nasal
        assert_eq!(a.voice.artic.target.velum, 0.9);
        a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 0.0, 1.0);
        assert_eq!(a.voice.artic.target.velum, -0.15);
        assert_eq!(a.voice.artic.speed, [1.0; 17]);
        assert_eq!(a.voice.glottis.params.amplitude, 0.17);
    }

    #[test]
    fn glide_and_morph_change_settling_time_without_changing_targets() {
        let mut fast = Airway::new(48000.0);
        fast.voice_baseline();
        let mut slow = Airway::new(48000.0);
        slow.voice_baseline();
        fast.set_vocal_controls(0.25, 0.0, 1.0, 0.0, 0.0, 0.005, 0.0);
        slow.set_vocal_controls(0.25, 0.0, 1.0, 0.0, 0.0, 0.5, 1.0);
        for a in [&mut fast, &mut slow] {
            a.set_phoneme(440.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 20.0, 1.0); // A -> U
            for _ in 0..5 { a.render(960); } // 100 ms
        }
        assert!((fast.voice.glottis.params.f0 - 440.0).abs() < 1.0);
        assert!(slow.voice.glottis.params.f0 > 110.0 && slow.voice.glottis.params.f0 < 200.0);
        let target = fast.voice.artic.target.lip_ap;
        assert_eq!(target, slow.voice.artic.target.lip_ap);
        let fast_error = (fast.voice.artic.x.lip_ap - target).abs();
        let slow_error = (slow.voice.artic.x.lip_ap - target).abs();
        assert!(slow_error > fast_error * 5.0);
        for _ in 0..120 { slow.render(2048); }
        assert!((slow.voice.glottis.params.f0 - 440.0).abs() < 0.1);
        assert!((slow.voice.artic.x.lip_ap - target).abs() < 0.001);
    }
    #[test]
    fn beat_timing_changes_retained_score_without_restarting_physical_time() {
        let mut a = Airway::new(48000.0);
        let pre = a.prepare_beat(2);
        for _ in 0..pre / OUTPUT_CAPACITY { a.render(OUTPUT_CAPACITY); }
        a.render(pre % OUTPUT_CAPACITY);
        let before = a.remaining_samples();
        let clock = a.voice.clock;
        a.configure_beat(3.0, 0.5);
        assert!(a.remaining_samples() > before * 2);
        assert_eq!(a.voice.clock, clock);
        assert_eq!(a.beat_gestures.len(), a.voice.score.size());
    }
    #[test]
    fn physical_modifiers_use_canonical_targets_and_return_to_neutral() {
        let mut a = Airway::new(48000.0);
        a.prepare_beat(3);
        a.configure_beat(1.0, 0.5);
        a.set_beat(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 2.0, 0.4, 0.3, -0.2, 0.4, 0.5);
        let first = a.voice.score.gestures().to_vec();
        for _ in 0..20 { a.set_beat(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 2.0, 0.4, 0.3, -0.2, 0.4, 0.5); }
        for (a, b) in a.voice.score.gestures().iter().zip(first.iter()) {
            assert_eq!(a.t1, b.t1);
            for (key, value) in a.targets.iter() { assert_eq!(Some(value), b.targets.get(key)); }
        }
        a.set_beat(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);
        assert_eq!(a.voice.airway.noise_gain.teeth, 3.0e-6);
        for (actual, original) in a.voice.score.gestures().iter().zip(a.beat_gestures.iter()) {
            for (key, value) in original.targets.iter() { assert_eq!(Some(value), actual.targets.get(key)); }
        }
    }

    #[test]
    fn alphabet_targets_cover_laterals_nasals_fricatives_and_compound_releases() {
        let mut a = Airway::new(48000.0);
        a.voice_baseline();
        a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 11.0, 1.0); // L
        assert!(a.voice.artic.target.lateral > 0.5);
        a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 30.0, 1.0); // NG
        assert!(a.voice.artic.target.velum > 0.5);
        a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, 26.0, 1.0); // SH
        assert_eq!(a.voice.glottis.params.amplitude, 0.0);
        assert!(a.voice.artic.target.velum < 0.0);
        assert!(a.voice.artic.target.lateral < 0.1);
        for index in [9, 16, 23, 27] { // J, Q, X, CH
            a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, index as f64, 1.0);
            let closed = a.voice.artic.target;
            a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, index as f64, 0.6);
            assert!(ArticKey::ALL.iter().any(|key| closed.get(*key) != a.voice.artic.target.get(*key)));
        }
        assert_eq!(a.voice.score.size(), 0);
    }

    #[test]
    fn alphabet_vowels_ignore_articulation_and_restore_the_complete_posture() {
        let mut a = Airway::new(48000.0);
        a.voice_baseline();
        for index in [0, 4, 8, 14, 20] {
            a.set_phoneme(110.0, 4.0, 8.0, 0.15, 0.5, 0.0, 1.0, index as f64, 0.0);
            let target = a.voice.artic.target;
            a.set_phoneme(110.0, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0, index as f64, 1.0);
            for key in ArticKey::ALL { assert_eq!(target.get(key), a.voice.artic.target.get(key)); }
        }
    }

    #[test]
    fn consonants_change_targets_without_resetting_or_scheduling_the_voice() {
        let mut a = Airway::new(48000.0);
        a.voice_baseline();
        a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 0.0, 0.0);
        a.render(1024);
        let clock = a.voice.clock;
        let phase = a.voice.glottis.cycle_phase();
        a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 0.0, 1.0);
        assert!(a.voice.artic.target.lip_ap < 0.0);
        assert!(a.voice.artic.target.velum > 0.0);
        assert_eq!(a.voice.clock, clock);
        assert_eq!(a.voice.glottis.cycle_phase(), phase);
        assert_eq!(a.voice.score.size(), 0);
        a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 0.0, 0.0);
        assert!(a.voice.artic.target.lip_ap > 0.0);
        assert!(a.voice.artic.target.velum <= 0.0);
    }

    #[test]
    fn fricative_voicing_is_continuous_and_identical_updates_do_not_accumulate() {
        let mut a = Airway::new(48000.0);
        a.voice_baseline();
        a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 6.0, 0.0);
        let full = a.voice.glottis.params.amplitude;
        a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 6.0, 0.5);
        assert!((a.voice.glottis.params.amplitude - full * 0.5).abs() < 1e-12);
        let abduction = a.voice.glottis.params.abduction;
        for _ in 0..20 {
            a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 6.0, 0.5);
            assert_eq!(a.voice.glottis.params.abduction, abduction);
        }
        a.set_vocal(220.0, 0.0, 8.0, 0.1, 0.5, 0.0, 1.0, 6.0, 1.0);
        assert_eq!(a.voice.glottis.params.amplitude, 0.0);
    }

    #[test]
    fn recipes_fit_the_local_fixed_capacity_and_render_finite() {
        for index in 0..10 {
            let mut a = Airway::new(48000.0);
            let pre = a.prepare_beat(index);
            assert!(pre > 0 && pre < 9600);
            assert!(a.voice.score.size() <= MAX_SOUND_GESTURES);
            if index == 9 { a.retarget_hum(440.0); }
            for _ in 0..16 {
                a.voice.render(&mut a.output);
                assert!(a.output.iter().all(|x| x.is_finite()));
            }
        }
    }

    #[test]
    fn complete_score_expiry_frees_the_tip_without_resetting_the_voice() {
        for sound in 0..10 {
            let mut a = Airway::new(48000.0);
            let pre = a.prepare_beat(sound);
            let end = a.voice.score.gestures().iter().map(|g| g.end()).fold(0.0_f64, f64::max);
            assert_eq!(a.score_end_sample, (end * 48000.0).ceil() as u64);
            assert!(!a.voice.artic.tip_free);
            for _ in 0..pre / OUTPUT_CAPACITY { a.render(OUTPUT_CAPACITY); }
            a.render(pre % OUTPUT_CAPACITY);
            assert_eq!(a.remaining_samples(), a.score_end_sample as usize - pre);
            while a.remaining_samples() > 1 { a.render((a.remaining_samples() - 1).min(OUTPUT_CAPACITY)); }
            let clock = a.voice.clock;
            a.render(1);
            assert_eq!(a.remaining_samples(), 0);
            assert!(a.voice.artic.tip_free);
            assert!(a.voice.clock >= clock);
            assert_eq!(a.voice.score.size(), 0);
        }
    }

    #[test]
    fn live_hum_pitch_changes_preserve_times_and_replace_every_f0_target() {
        let mut a = Airway::new(48000.0);
        a.prepare_beat(9);
        let end = a.score_end_sample;
        let count = a.voice.score.size();
        a.set_voice(440.0, 2.0, 10.0, 0.3, 0.7, 0.0, 1.0);
        assert_eq!(a.score_end_sample, end);
        assert_eq!(a.voice.score.size(), count);
        assert!(!a.voice.artic.tip_free);
        let mut pitch_gestures = 0;
        for gesture in a.voice.score.gestures() {
            if let Some(f0) = gesture.targets.get(ControlKey::F0) {
                pitch_gestures += 1;
                assert_eq!(f0, 440.0);
            }
        }
        assert!(pitch_gestures > 0);
        for pitch in [55.0, 110.0, 220.0, 440.0] {
            a.set_voice(pitch, 0.0, 8.0, 0.15, 0.5, 0.0, 1.0);
        }
    }

    #[test]
    fn moving_baseline_preserves_the_held_score_abduction_and_gated_effort() {
        let mut a = Airway::new(48000.0);
        let pre = a.prepare_beat(3);
        for _ in 0..pre / OUTPUT_CAPACITY { a.render(OUTPUT_CAPACITY); }
        a.render(pre % OUTPUT_CAPACITY);
        let held_abduction = a.voice.glottis.params.abduction;
        let held_closure = a.voice.glottis.params.closure;
        let clock = a.voice.clock;
        let old_base = 0.1 * 0.15_f64.powi(2);
        assert!(held_abduction > old_base + 0.1);
        a.set_voice(220.0, 2.0, 16.0, 0.7, 0.8, 0.2, 1.0);
        let expected_abduction = 0.1 * 0.7_f64.powi(2) + held_abduction - old_base;
        assert!((a.voice.glottis.params.abduction - expected_abduction).abs() < 1e-12);
        assert_eq!(a.voice.glottis.params.closure, held_closure);
        assert_eq!(a.voice.glottis.params.effort, ((16.0 * a.voice.gate).abs() - 3.0).clamp(0.0, 10.0) / 10.0);
        assert_eq!(a.voice.source.breathiness, 0.7);
        assert_eq!(a.voice.source.pressure, 16.0);
        assert_eq!(a.voice.glottis.params.fry, 0.2);
        assert_eq!(a.voice.clock, clock);
    }
}
