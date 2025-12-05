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
