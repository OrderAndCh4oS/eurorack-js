//! In-place iterative radix-2 complex FFT on separate real/imag `f64` slices.
//! Size must be a power of two. Allocation-free after plan creation.

use crate::math::{PI, cos, js_min, log10, sin};

#[derive(Clone, Debug)]
pub struct Fft {
    pub n: usize,
    cos: Vec<f64>,
    sin: Vec<f64>,
    rev: Vec<u32>,
}

impl Fft {
    /// Panics unless `n` is a power of two ≥ 2 (the TypeScript threw).
    pub fn new(n: usize) -> Self {
        if (n & n.wrapping_sub(1)) != 0 || n < 2 {
            panic!("FFT size must be a power of two, got {n}");
        }
        let mut c = vec![0.0; n / 2];
        let mut s = vec![0.0; n / 2];
        for i in 0..n / 2 {
            c[i] = cos((2.0 * PI * i as f64) / n as f64);
            s[i] = -sin((2.0 * PI * i as f64) / n as f64);
        }
        let mut rev = vec![0u32; n];
        let bits = n.trailing_zeros(); // log2(n)
        for (i, r_out) in rev.iter_mut().enumerate() {
            let mut r = 0u32;
            for b in 0..bits {
                r |= (((i >> b) & 1) as u32) << (bits - 1 - b);
            }
            *r_out = r;
        }
        Fft { n, cos: c, sin: s, rev }
    }

    /// Forward transform (sign -1).
    pub fn transform(&self, re: &mut [f64], im: &mut [f64]) {
        let n = self.n;
        let rev = &self.rev;
        for i in 0..n {
            let j = rev[i] as usize;
            if j > i {
                re.swap(i, j);
                im.swap(i, j);
            }
        }
        let mut size = 2;
        while size <= n {
            let half = size >> 1;
            let step = n / size;
            let mut start = 0;
            while start < n {
                for k in 0..half {
                    let wr = self.cos[k * step];
                    let wi = self.sin[k * step];
                    let a = start + k;
                    let b = a + half;
                    let xr = re[b] * wr - im[b] * wi;
                    let xi = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - xr;
                    im[b] = im[a] - xi;
                    re[a] += xr;
                    im[a] += xi;
                }
                start += size;
            }
            size <<= 1;
        }
    }
}

pub fn hann(n: usize) -> Vec<f64> {
    (0..n).map(|i| 0.5 - 0.5 * cos((2.0 * PI * i as f64) / (n as f64 - 1.0))).collect()
}

pub fn hamming(n: usize) -> Vec<f64> {
    (0..n).map(|i| 0.54 - 0.46 * cos((2.0 * PI * i as f64) / (n as f64 - 1.0))).collect()
}

/// Magnitude spectrum in dB (n/2+1 bins) of a real frame, windowed.
pub fn power_spectrum_db(frame: &[f64], fft: &Fft, window: &[f64]) -> Vec<f64> {
    let n = fft.n;
    let mut re = vec![0.0; n];
    let mut im = vec![0.0; n];
    let m = js_min(js_min(frame.len() as f64, window.len() as f64), n as f64) as usize;
    for i in 0..m {
        re[i] = frame[i] * window[i];
    }
    fft.transform(&mut re, &mut im);
    (0..=n / 2).map(|k| 10.0 * log10(re[k] * re[k] + im[k] * im[k] + 1e-30)).collect()
}

pub fn next_pow2(x: f64) -> usize {
    let mut n = 1usize;
    while (n as f64) < x {
        n <<= 1;
    }
    n
}
