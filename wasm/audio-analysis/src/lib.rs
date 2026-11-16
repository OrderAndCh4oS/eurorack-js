//! Bounded measurements of normalized stereo PCM. See README.md for definitions.

use ebur128::{EbuR128, Mode};
use realfft::RealFftPlanner;
use serde::Serialize;
use std::f64::consts::TAU;
use wasm_bindgen::prelude::*;

const FFT_SIZE: usize = 2048;
const HOP_SIZE: usize = 1024;
const ACTIVE_RMS: f64 = 0.0001;
const LOW_EDGE: f64 = 250.0;
const HIGH_EDGE: f64 = 4000.0;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub schema_version: u32,
    pub input: Input,
    pub levels: Channels<Level>,
    pub stereo: Stereo,
    pub spectral: Spectral,
    pub loudness: Loudness,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Input {
    pub frames: usize,
    pub sample_rate: u32,
    pub duration_seconds: f64,
}

#[derive(Debug, Serialize)]
pub struct Channels<T> {
    pub left: T,
    pub right: T,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Level {
    pub peak: f64,
    pub peak_dbfs: Option<f64>,
    pub rms: f64,
    pub rms_dbfs: Option<f64>,
    pub dc_offset: f64,
    pub full_scale_samples: usize,
    pub full_scale_fraction: f64,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stereo {
    pub correlation: Option<f64>,
    pub mid_rms: f64,
    pub side_rms: f64,
    pub side_to_mid_energy_ratio: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spectral {
    pub fft_size: usize,
    pub hop_size: usize,
    pub window: &'static str,
    pub active_floor_dbfs: i32,
    pub band_edges_hz: [u32; 2],
    pub left: Spectrum,
    pub right: Spectrum,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spectrum {
    pub frame_count: usize,
    pub active_frame_count: usize,
    pub centroid_hz: Option<f64>,
    pub rolloff85_hz: Option<f64>,
    pub flatness: Option<f64>,
    pub band_energy_fractions: Option<BandEnergy>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct BandEnergy {
    pub low: f64,
    pub mid: f64,
    pub high: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loudness {
    pub integrated_lufs: Option<f64>,
    pub momentary_lufs: Option<f64>,
    pub short_term_lufs: Option<f64>,
    pub true_peak_estimate: TruePeakEstimate,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TruePeakEstimate {
    pub left: f64,
    pub right: f64,
    pub left_dbtp: Option<f64>,
    pub right_dbtp: Option<f64>,
}

/// Browser entry point: normalized PCM in, versioned JSON out.
#[wasm_bindgen]
pub fn analyze(left: &[f32], right: &[f32], sample_rate: u32) -> Result<String, JsValue> {
    let result =
        analyze_stereo(left, right, sample_rate).map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
}

/// Native entry point, independent of browser APIs and suitable for signal tests.
pub fn analyze_stereo(left: &[f32], right: &[f32], sample_rate: u32) -> Result<Analysis, String> {
    validate(left, right, sample_rate)?;
    let levels = Channels {
        left: level(left),
        right: level(right),
    };
    let stereo = stereo(left, right, levels.left.dc_offset, levels.right.dc_offset);
    let mut planner = RealFftPlanner::<f64>::new();
    let spectral = Spectral {
        fft_size: FFT_SIZE,
        hop_size: HOP_SIZE,
        window: "periodic-hann",
        active_floor_dbfs: -80,
        band_edges_hz: [LOW_EDGE as u32, HIGH_EDGE as u32],
        left: spectrum(left, sample_rate, &mut planner)?,
        right: spectrum(right, sample_rate, &mut planner)?,
    };
    let loudness = loudness(
        left,
        right,
        sample_rate,
        levels.left.peak,
        levels.right.peak,
    )?;
    Ok(Analysis {
        schema_version: 1,
        input: Input {
            frames: left.len(),
            sample_rate,
            duration_seconds: left.len() as f64 / f64::from(sample_rate),
        },
        levels,
        stereo,
        spectral,
        loudness,
    })
}

fn validate(left: &[f32], right: &[f32], sample_rate: u32) -> Result<(), String> {
    if !(8_000..=192_000).contains(&sample_rate) {
        return Err("Sample rate must be between 8000 and 192000 Hz.".into());
    }
    if left.len() != right.len() {
        return Err("Left and right channels must have the same length.".into());
    }
    if left.len() < sample_rate.div_ceil(2) as usize || left.len() > sample_rate as usize * 10 {
        return Err("Audio duration must be between 0.5 and 10 seconds.".into());
    }
    if left.iter().chain(right).any(|sample| !sample.is_finite()) {
        return Err("Audio samples must be finite numbers.".into());
    }
    Ok(())
}

fn decibels(amplitude: f64) -> Option<f64> {
    (amplitude > 0.0).then(|| 20.0 * amplitude.log10())
}

fn finite(value: f64) -> Option<f64> {
    value.is_finite().then_some(value)
}

fn level(audio: &[f32]) -> Level {
    let mut peak = 0.0_f64;
    let mut sum = 0.0;
    let mut square_sum = 0.0;
    let mut full_scale_samples = 0;
    for &sample in audio {
        let value = f64::from(sample);
        peak = peak.max(value.abs());
        sum += value;
        square_sum += value * value;
        full_scale_samples += usize::from(value.abs() >= 1.0);
    }
    let rms = (square_sum / audio.len() as f64).sqrt();
    Level {
        peak,
        peak_dbfs: decibels(peak),
        rms,
        rms_dbfs: decibels(rms),
        dc_offset: sum / audio.len() as f64,
        full_scale_samples,
        full_scale_fraction: full_scale_samples as f64 / audio.len() as f64,
    }
}

fn stereo(left: &[f32], right: &[f32], left_mean: f64, right_mean: f64) -> Stereo {
    let mut left_variance = 0.0;
    let mut right_variance = 0.0;
    let mut covariance = 0.0;
    let mut mid_energy = 0.0;
    let mut side_energy = 0.0;
    for (&l, &r) in left.iter().zip(right) {
        let l = f64::from(l);
        let r = f64::from(r);
        let centered_l = l - left_mean;
        let centered_r = r - right_mean;
        left_variance += centered_l * centered_l;
        right_variance += centered_r * centered_r;
        covariance += centered_l * centered_r;
        mid_energy += ((l + r) / 2.0).powi(2);
        side_energy += ((l - r) / 2.0).powi(2);
    }
    Stereo {
        correlation: (left_variance > 0.0 && right_variance > 0.0)
            .then(|| (covariance / (left_variance * right_variance).sqrt()).clamp(-1.0, 1.0)),
        mid_rms: (mid_energy / left.len() as f64).sqrt(),
        side_rms: (side_energy / left.len() as f64).sqrt(),
        side_to_mid_energy_ratio: (mid_energy > 0.0).then(|| side_energy / mid_energy),
    }
}

fn spectrum(
    audio: &[f32],
    sample_rate: u32,
    planner: &mut RealFftPlanner<f64>,
) -> Result<Spectrum, String> {
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let mut input = fft.make_input_vec();
    let mut output = fft.make_output_vec();
    let mut scratch = fft.make_scratch_vec();
    let mut magnitude = vec![0.0; output.len()];
    let mut power = vec![0.0; output.len()];
    let window: Vec<f64> = (0..FFT_SIZE)
        .map(|i| 0.5 - 0.5 * (TAU * i as f64 / FFT_SIZE as f64).cos())
        .collect();
    let frame_count = (audio.len() - FFT_SIZE) / HOP_SIZE + 1;
    let mut active_frame_count = 0;
    for start in (0..=audio.len() - FFT_SIZE).step_by(HOP_SIZE) {
        let frame = &audio[start..start + FFT_SIZE];
        let mean = frame.iter().map(|&v| f64::from(v)).sum::<f64>() / FFT_SIZE as f64;
        let mut square_sum = 0.0;
        for (i, &sample) in frame.iter().enumerate() {
            let centered = f64::from(sample) - mean;
            square_sum += centered * centered;
            input[i] = centered * window[i];
        }
        if square_sum / (FFT_SIZE as f64) < ACTIVE_RMS * ACTIVE_RMS {
            continue;
        }
        active_frame_count += 1;
        fft.process_with_scratch(&mut input, &mut output, &mut scratch)
            .map_err(|error| format!("Spectrum analysis failed: {error}"))?;
        for (i, bin) in output.iter().enumerate() {
            let bin_power = bin.norm_sqr();
            magnitude[i] += bin_power.sqrt();
            power[i] += bin_power
                * if i == 0 || i == FFT_SIZE / 2 {
                    1.0
                } else {
                    2.0
                };
        }
    }
    if active_frame_count == 0 {
        return Ok(Spectrum {
            frame_count,
            active_frame_count,
            centroid_hz: None,
            rolloff85_hz: None,
            flatness: None,
            band_energy_fractions: None,
        });
    }
    let hz_per_bin = f64::from(sample_rate) / FFT_SIZE as f64;
    let total_magnitude = magnitude.iter().sum::<f64>();
    let total_power = power.iter().sum::<f64>();
    let centroid = magnitude
        .iter()
        .enumerate()
        .map(|(bin, value)| bin as f64 * hz_per_bin * value)
        .sum::<f64>()
        / total_magnitude;
    let mut cumulative = 0.0;
    let rolloff_bin = power
        .iter()
        .position(|value| {
            cumulative += value;
            cumulative >= total_power * 0.85
        })
        .unwrap_or(FFT_SIZE / 2);
    let log_floor = power.iter().copied().fold(0.0_f64, f64::max) * 1e-20;
    let log_mean = power
        .iter()
        .map(|value| value.max(log_floor).ln())
        .sum::<f64>()
        / power.len() as f64;
    let flatness = (log_mean.exp() / (total_power / power.len() as f64)).clamp(0.0, 1.0);
    let mut bands = BandEnergy {
        low: 0.0,
        mid: 0.0,
        high: 0.0,
    };
    for (bin, value) in power.iter().enumerate() {
        let hz = bin as f64 * hz_per_bin;
        if hz < LOW_EDGE {
            bands.low += value;
        } else if hz < HIGH_EDGE {
            bands.mid += value;
        } else {
            bands.high += value;
        }
    }
    bands.low /= total_power;
    bands.mid /= total_power;
    bands.high /= total_power;
    Ok(Spectrum {
        frame_count,
        active_frame_count,
        centroid_hz: Some(centroid),
        rolloff85_hz: Some(rolloff_bin as f64 * hz_per_bin),
        flatness: Some(flatness),
        band_energy_fractions: Some(bands),
    })
}

fn loudness(
    left: &[f32],
    right: &[f32],
    sample_rate: u32,
    left_sample_peak: f64,
    right_sample_peak: f64,
) -> Result<Loudness, String> {
    let map_error = |error: ebur128::Error| format!("Loudness analysis failed: {error}");
    let mut meter = EbuR128::new(2, sample_rate, Mode::I | Mode::M | Mode::S).map_err(map_error)?;
    meter
        .add_frames_planar_f32(&[left, right])
        .map_err(map_error)?;
    let integrated_lufs = finite(meter.loudness_global().map_err(map_error)?);
    let momentary_lufs = finite(meter.loudness_momentary().map_err(map_error)?);
    let short_term_lufs = if left.len() >= sample_rate as usize * 3 {
        finite(meter.loudness_shortterm().map_err(map_error)?)
    } else {
        None
    };

    // ebur128's true-peak interpolator uses f32. Normalize only its input for
    // extreme finite values, then restore amplitude; preserve loudness gating.
    // Scale channels independently so a loud channel cannot underflow a quiet one.
    let mut peak_meter = EbuR128::new(2, sample_rate, Mode::TRUE_PEAK).map_err(map_error)?;
    let left_scale = left_sample_peak.max(1.0);
    let right_scale = right_sample_peak.max(1.0);
    if left_scale > 1.0 || right_scale > 1.0 {
        let mut scaled_left = [0.0_f32; 4096];
        let mut scaled_right = [0.0_f32; 4096];
        for (l, r) in left.chunks(4096).zip(right.chunks(4096)) {
            for i in 0..l.len() {
                scaled_left[i] = (f64::from(l[i]) / left_scale) as f32;
                scaled_right[i] = (f64::from(r[i]) / right_scale) as f32;
            }
            peak_meter
                .add_frames_planar_f32(&[&scaled_left[..l.len()], &scaled_right[..r.len()]])
                .map_err(map_error)?;
        }
    } else {
        peak_meter
            .add_frames_planar_f32(&[left, right])
            .map_err(map_error)?;
    }
    // Upstream's FIR has 48 taps (12 or 24 input frames). Flush with 48 zero
    // frames so a transient at the capture end is included. This peak-only
    // meter does not affect the loudness window or the reported input length.
    let tail = [0.0_f32; 48];
    peak_meter
        .add_frames_planar_f32(&[&tail, &tail])
        .map_err(map_error)?;
    let left_peak =
        (peak_meter.true_peak(0).map_err(map_error)? * left_scale).max(left_sample_peak);
    let right_peak =
        (peak_meter.true_peak(1).map_err(map_error)? * right_scale).max(right_sample_peak);
    Ok(Loudness {
        integrated_lufs,
        momentary_lufs,
        short_term_lufs,
        true_peak_estimate: TruePeakEstimate {
            left: left_peak,
            right: right_peak,
            left_dbtp: decibels(left_peak),
            right_dbtp: decibels(right_peak),
        },
    })
}
