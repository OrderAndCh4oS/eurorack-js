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

export const MODULE_COLOR_TOKENS = [
    'module-color-one',
    'module-color-two',
    'module-color-three',
    'module-color-four',
    'module-color-five',
    'module-color-six',
    'module-color-seven',
    'module-color-eight',
    'module-color-nine',
    'module-color-ten',
    'module-color-eleven',
    'module-color-twelve'
];

export function isModuleColorToken(value) {
    return MODULE_COLOR_TOKENS.includes(value);
}

export function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value || '');
}

export function getModuleColorToken(value) {
    return isModuleColorToken(value) ? value : null;
}
