use eurorack_audio_analysis::analyze_stereo;
use std::f64::consts::TAU;

fn sine(sample_rate: u32, seconds: f64, hz: f64, amplitude: f64) -> Vec<f32> {
    (0..(f64::from(sample_rate) * seconds) as usize)
        .map(|i| (amplitude * (TAU * hz * i as f64 / f64::from(sample_rate)).sin()) as f32)
        .collect()
}

fn close(actual: f64, expected: f64, tolerance: f64) {
    assert!(
        (actual - expected).abs() <= tolerance,
        "{actual} differs from {expected} by more than {tolerance}"
    );
}

#[test]
fn silence_is_defined_without_nan_or_negative_infinity() {
    let audio = vec![0.0; 24_000];
    let result = analyze_stereo(&audio, &audio, 48_000).unwrap();
    assert_eq!(result.schema_version, 1);
    assert_eq!(result.input.frames, 24_000);
    assert_eq!(result.input.sample_rate, 48_000);
    assert_eq!(result.input.duration_seconds, 0.5);
    assert_eq!(result.levels.left.peak, 0.0);
    assert_eq!(result.levels.left.rms, 0.0);
    assert_eq!(result.levels.left.peak_dbfs, None);
    assert_eq!(result.levels.left.rms_dbfs, None);
    assert_eq!(result.stereo.correlation, None);
    assert_eq!(result.stereo.side_to_mid_energy_ratio, None);
    assert_eq!(result.spectral.left.active_frame_count, 0);
    assert_eq!(result.spectral.left.centroid_hz, None);
    assert_eq!(result.spectral.left.rolloff85_hz, None);
    assert_eq!(result.spectral.left.flatness, None);
    assert!(result.spectral.left.band_energy_fractions.is_none());
    assert_eq!(result.loudness.integrated_lufs, None);
    assert_eq!(result.loudness.momentary_lufs, None);
    assert_eq!(result.loudness.short_term_lufs, None);
    assert_eq!(result.loudness.true_peak_estimate.left, 0.0);
    assert_eq!(result.loudness.true_peak_estimate.left_dbtp, None);
    let json = serde_json::to_value(&result).unwrap();
    assert_eq!(json["schemaVersion"], 1);
    assert!(json["levels"]["left"]["rmsDbfs"].is_null());
    assert!(json["spectral"]["left"]["rolloff85Hz"].is_null());
    assert!(json["loudness"]["truePeakEstimate"]["leftDbtp"].is_null());
}

#[test]
fn sine_has_known_levels_and_spectrum() {
    let audio = sine(48_000, 1.0, 1_500.0, 0.5);
    let result = analyze_stereo(&audio, &audio, 48_000).unwrap();
    close(result.levels.left.peak, 0.5, 1e-7);
    close(result.levels.left.rms, 0.5 / 2.0_f64.sqrt(), 1e-7);
    close(result.levels.left.peak_dbfs.unwrap(), -6.0206, 1e-4);
    close(result.levels.left.rms_dbfs.unwrap(), -9.0309, 1e-4);
    close(result.levels.left.dc_offset, 0.0, 1e-7);
    assert_eq!(result.levels.left.full_scale_samples, 0);
    close(result.stereo.correlation.unwrap(), 1.0, 1e-10);
    close(result.stereo.mid_rms, result.levels.left.rms, 1e-10);
    assert_eq!(result.stereo.side_rms, 0.0);
    assert_eq!(result.stereo.side_to_mid_energy_ratio, Some(0.0));
    close(result.spectral.left.centroid_hz.unwrap(), 1_500.0, 0.1);
    close(
        result.spectral.left.rolloff85_hz.unwrap(),
        1_500.0,
        48_000.0 / 2048.0,
    );
    assert!(result.spectral.left.flatness.unwrap() < 0.001);
    let bands = result.spectral.left.band_energy_fractions.unwrap();
    close(bands.mid, 1.0, 1e-8);
    close(bands.low + bands.mid + bands.high, 1.0, 1e-12);
    assert!(result.loudness.integrated_lufs.is_some());
    assert!(result.loudness.momentary_lufs.is_some());
    assert!(result.loudness.short_term_lufs.is_none());
    assert!(result.loudness.true_peak_estimate.left >= result.levels.left.peak);
}

#[test]
fn dc_is_measured_but_excluded_from_spectral_analysis_and_correlation() {
    let left = vec![0.25; 48_000];
    let right = vec![-0.5; 48_000];
    let result = analyze_stereo(&left, &right, 48_000).unwrap();
    assert_eq!(result.levels.left.dc_offset, 0.25);
    assert_eq!(result.levels.left.rms, 0.25);
    assert_eq!(result.levels.right.dc_offset, -0.5);
    assert_eq!(result.stereo.correlation, None);
    assert_eq!(result.spectral.left.active_frame_count, 0);
    assert_eq!(result.spectral.right.active_frame_count, 0);
    assert_eq!(result.spectral.left.centroid_hz, None);
    assert_eq!(result.spectral.right.band_energy_fractions, None);
}

#[test]
fn antiphase_is_detected_without_dividing_by_zero() {
    let left = sine(44_100, 0.5, 440.0, 0.4);
    let right: Vec<f32> = left.iter().map(|sample| -sample).collect();
    let result = analyze_stereo(&left, &right, 44_100).unwrap();
    close(result.stereo.correlation.unwrap(), -1.0, 1e-12);
    assert_eq!(result.stereo.mid_rms, 0.0);
    close(result.stereo.side_rms, result.levels.left.rms, 1e-12);
    assert_eq!(result.stereo.side_to_mid_energy_ratio, None);
}

#[test]
fn one_silent_channel_does_not_have_a_stereo_correlation() {
    let audio = sine(48_000, 0.5, 1_000.0, 0.25);
    let silent = vec![0.0; audio.len()];
    let result = analyze_stereo(&audio, &silent, 48_000).unwrap();
    assert_eq!(result.stereo.correlation, None);
    close(result.stereo.side_to_mid_energy_ratio.unwrap(), 1.0, 1e-12);
    assert!(result.spectral.left.centroid_hz.is_some());
    assert!(result.spectral.right.centroid_hz.is_none());
}

#[test]
fn accumulated_white_noise_is_flatter_than_a_tone() {
    let mut seed = 0x9e37_79b9_u32;
    let audio: Vec<f32> = (0..144_000)
        .map(|_| {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            (f64::from(seed) / f64::from(u32::MAX) - 0.5) as f32
        })
        .collect();
    let result = analyze_stereo(&audio, &audio, 48_000).unwrap();
    assert!(result.spectral.left.flatness.unwrap() > 0.9);
    close(result.spectral.left.centroid_hz.unwrap(), 12_000.0, 400.0);
    let bands = result.spectral.left.band_energy_fractions.unwrap();
    close(bands.low + bands.mid + bands.high, 1.0, 1e-12);
}

#[test]
fn full_scale_count_counts_equal_and_exceeding_samples() {
    let mut audio = vec![0.0; 4_000];
    audio[0] = 1.0;
    audio[1] = -1.0;
    audio[2] = 1.5;
    audio[3] = -1.5;
    audio[4] = 0.999;
    let result = analyze_stereo(&audio, &audio, 8_000).unwrap();
    assert_eq!(result.levels.left.peak, 1.5);
    assert_eq!(result.levels.left.full_scale_samples, 4);
    close(result.levels.left.full_scale_fraction, 0.001, 1e-12);
}

#[test]
fn active_floor_excludes_quiet_signal_without_hiding_level_measurement() {
    let audio = sine(48_000, 0.5, 1_500.0, 0.00001);
    let result = analyze_stereo(&audio, &audio, 48_000).unwrap();
    assert!(result.levels.left.rms > 0.0);
    assert!(result.levels.left.rms_dbfs.unwrap() < -80.0);
    assert_eq!(result.spectral.left.active_frame_count, 0);
    assert!(result.spectral.left.flatness.is_none());
}

#[test]
fn left_right_swap_preserves_symmetric_metrics_and_swaps_channel_metrics() {
    let left = sine(48_000, 0.5, 93.75, 0.3);
    let right = sine(48_000, 0.5, 9_000.0, 0.1);
    let lr = analyze_stereo(&left, &right, 48_000).unwrap();
    let rl = analyze_stereo(&right, &left, 48_000).unwrap();
    assert_eq!(lr.levels.left, rl.levels.right);
    assert_eq!(lr.levels.right, rl.levels.left);
    assert_eq!(lr.spectral.left, rl.spectral.right);
    assert_eq!(lr.spectral.right, rl.spectral.left);
    assert_eq!(lr.stereo, rl.stereo);
    close(
        lr.loudness.integrated_lufs.unwrap(),
        rl.loudness.integrated_lufs.unwrap(),
        1e-10,
    );
    assert_eq!(
        lr.loudness.true_peak_estimate.left,
        rl.loudness.true_peak_estimate.right
    );
    assert!(lr.spectral.left.band_energy_fractions.unwrap().low > 0.99);
    assert!(lr.spectral.right.band_energy_fractions.unwrap().high > 0.99);
}

#[test]
fn short_term_loudness_requires_three_seconds() {
    let audio = sine(48_000, 3.0, 1_000.0, 0.1);
    let result = analyze_stereo(&audio, &audio, 48_000).unwrap();
    assert!(result.loudness.short_term_lufs.is_some());
    // A stereo 1 kHz sine at -20 dBFS amplitude is approximately -20 LUFS.
    close(result.loudness.integrated_lufs.unwrap(), -20.0, 0.2);
    let short = &audio[..143_999];
    assert!(analyze_stereo(short, short, 48_000)
        .unwrap()
        .loudness
        .short_term_lufs
        .is_none());
}

#[test]
fn true_peak_includes_intersample_peaks() {
    let audio: Vec<f32> = (0..24_000)
        .map(|i| (0.8 * (TAU * 12_000.0 * i as f64 / 48_000.0 + TAU / 8.0).sin()) as f32)
        .collect();
    let result = analyze_stereo(&audio, &audio, 48_000).unwrap();
    close(result.levels.left.peak, 0.8 / 2.0_f64.sqrt(), 1e-6);
    assert!(result.loudness.true_peak_estimate.left > 0.78);
    assert!(result.loudness.true_peak_estimate.left > result.levels.left.peak * 1.2);
}

#[test]
fn true_peak_flush_includes_the_capture_end() {
    let transient = [0.2_f32, -0.1, -0.3, 0.2, 0.5, 0.8, 0.9, 0.9];
    let mut tail = vec![0.0; 24_000];
    let mut middle = vec![0.0; 24_000];
    tail[23_992..].copy_from_slice(&transient);
    middle[12_000..12_008].copy_from_slice(&transient);
    let tail_result = analyze_stereo(&tail, &tail, 48_000).unwrap();
    let middle_result = analyze_stereo(&middle, &middle, 48_000).unwrap();
    close(
        tail_result.loudness.true_peak_estimate.left,
        middle_result.loudness.true_peak_estimate.left,
        1e-10,
    );
    assert!(tail_result.loudness.true_peak_estimate.left > tail_result.levels.left.peak);
    assert_eq!(tail_result.input.frames, 24_000);
    assert_eq!(tail_result.input.duration_seconds, 0.5);
}

#[test]
fn boundaries_are_inclusive_and_other_lengths_rates_are_rejected() {
    for rate in [8_000_u32, 44_101, 192_000] {
        let audio = vec![0.0; rate.div_ceil(2) as usize];
        assert!(analyze_stereo(&audio, &audio, rate).is_ok());
        assert!(analyze_stereo(&audio[1..], &audio[1..], rate).is_err());
    }
    let maximum = vec![0.0; 80_000];
    assert!(analyze_stereo(&maximum, &maximum, 8_000).is_ok());
    let too_long = vec![0.0; 80_001];
    assert!(analyze_stereo(&too_long, &too_long, 8_000).is_err());
    for rate in [0, 7_999, 192_001, u32::MAX] {
        assert!(analyze_stereo(&maximum, &maximum, rate).is_err());
    }
    assert!(analyze_stereo(&[], &[], 48_000).is_err());
    assert!(analyze_stereo(&maximum, &maximum[1..], 8_000).is_err());
}

#[test]
fn all_non_finite_inputs_are_rejected_in_either_channel() {
    let valid = vec![0.0; 4_000];
    for invalid in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
        let mut audio = valid.clone();
        audio[3_999] = invalid;
        assert!(analyze_stereo(&audio, &valid, 8_000).is_err());
        assert!(analyze_stereo(&valid, &audio, 8_000).is_err());
    }
}

#[test]
fn extreme_finite_samples_do_not_overflow_measurements() {
    let audio: Vec<f32> = (0..4_000)
        .map(|i| if i % 2 == 0 { f32::MAX } else { -f32::MAX })
        .collect();
    let result = analyze_stereo(&audio, &audio, 8_000).unwrap();
    assert!(result.levels.left.rms.is_finite());
    assert!(result.spectral.left.centroid_hz.unwrap().is_finite());
    assert!(result.loudness.true_peak_estimate.left.is_finite());
    assert!(serde_json::to_string(&result).is_ok());
}

#[test]
fn true_peak_preserves_a_quiet_channel_next_to_extreme_finite_samples() {
    let extreme = vec![f32::MAX; 4_000];
    let quiet = vec![1e-10_f32; 4_000];
    for (left, right) in [(&extreme, &quiet), (&quiet, &extreme)] {
        let result = analyze_stereo(left, right, 8_000).unwrap();
        assert!(result.loudness.true_peak_estimate.left >= result.levels.left.peak);
        assert!(result.loudness.true_peak_estimate.right >= result.levels.right.peak);
        assert!(result.loudness.true_peak_estimate.left_dbtp.is_some());
        assert!(result.loudness.true_peak_estimate.right_dbtp.is_some());
    }
    let quiet_alone = analyze_stereo(&quiet, &quiet, 8_000).unwrap();
    let asymmetric = analyze_stereo(&extreme, &quiet, 8_000).unwrap();
    assert_eq!(
        asymmetric.loudness.true_peak_estimate.right,
        quiet_alone.loudness.true_peak_estimate.right,
    );
}
