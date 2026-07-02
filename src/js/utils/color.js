/**
 * Adjust a hex color's brightness.
 * @param {string} hex - Hex color string (e.g., "#ff5500")
 * @param {number} amount - Amount to adjust (-255 to 255)
 * @returns {string} Adjusted hex color
 */
export function adjustColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

export const FACTORY_MODULE_SHADES = [
    '#f0eee2',
    '#ebe7da',
    '#e3ded1',
    '#d9d2c2',
    '#cec6b6',
    '#c3baaa',
    '#ddddd6',
    '#d2d1c8',
    '#c8c7be'
];

export const FACTORY_DARK_MODULE_SHADES = [
    '#0d0e0d',
    '#121312',
    '#171817',
    '#1c1d1b',
    '#22221f',
    '#151615',
    '#1a1b1a',
    '#242421',
    '#191a19',
    '#20201e',
    '#161817',
    '#262623'
];

function hashString(value) {
    return [...String(value || '')].reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }, 0);
}

export function getFactoryModuleShade(seed) {
    const index = Math.abs(hashString(seed)) % FACTORY_MODULE_SHADES.length;
    return FACTORY_MODULE_SHADES[index];
}

export function getFactoryModuleHeaderShade(seed) {
    return adjustColor(getFactoryModuleShade(seed), 12);
}

export function getFactoryModuleDarkShade(seed) {
    const index = Math.abs(hashString(seed)) % FACTORY_DARK_MODULE_SHADES.length;
    return FACTORY_DARK_MODULE_SHADES[index];
}

export function getFactoryModuleDarkHeaderShade(seed) {
    return adjustColor(getFactoryModuleDarkShade(seed), 14);
}
