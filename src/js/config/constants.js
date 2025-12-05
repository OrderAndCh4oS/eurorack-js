/**
 * Global constants for the eurorack synthesizer
 */

/** Audio sample rate in Hz */
export const SAMPLE_RATE = 44100;

/** Audio buffer size in samples */
export const BUFFER = 512;

/** Cable colors for visual distinction when patching */
export const CABLE_COLORS = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Teal
    '#e91e63', // Pink
    '#00bcd4'  // Cyan
];

/** localStorage key for patch storage */
export const PATCH_STORAGE_KEY = 'eurorack-patches';

/** Buffer duration in seconds */
export const BUFFER_DURATION = BUFFER / SAMPLE_RATE;
