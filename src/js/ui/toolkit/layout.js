/**
 * Module Toolkit - Layout Helpers
 *
 * Provides factory functions for creating layout elements:
 * rows, sections, spacers, and containers.
 */

/**
 * Create a row container for horizontal layout
 * @param {string} className - CSS class name (default: 'jack-row')
 * @returns {HTMLElement} Row container
 */
export function createRow(className = 'jack-row') {
    const row = document.createElement('div');
    row.className = className;
    return row;
}

/**
 * Create a section label/divider
 * @param {string} label - Section title text
 * @returns {HTMLElement} Section label element
 */
export function createSection(label) {
    const section = document.createElement('div');
    section.className = 'section-label';
    section.textContent = label;
    return section;
}

/**
 * Create a flexible spacer element
 * @returns {HTMLElement} Spacer element
 */
export function createSpacer() {
    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    return spacer;
}

/**
 * Create a module content container
 * @returns {HTMLElement} Content container
 */
export function createContent() {
    const content = document.createElement('div');
    content.className = 'module-content';
    return content;
}

/**
 * Create a module label element
 * @param {string} name - Module name
 * @returns {HTMLElement} Label element
 */
export function createModuleLabel(name) {
    const label = document.createElement('div');
    label.className = 'module-label';
    label.textContent = name;
    return label;
}

/**
 * Create a module panel container
 * @param {Object} options
 * @param {string} options.id - Module ID
 * @param {number} options.hp - Width in HP units (2, 4, or 8)
 * @param {string} options.color - Background color (hex)
 * @param {string} options.className - Additional CSS class
 * @returns {HTMLElement} Module panel element
 */
export function createPanel({
    id,
    hp,
    color,
    className = ''
}) {
    const panel = document.createElement('div');
    panel.className = `module module-${hp}hp ${className}`.trim();
    panel.id = `module-${id}`;

    // Apply gradient background
    const darkerColor = adjustColorBrightness(color, -30);
    panel.style.background = `linear-gradient(to bottom, ${color}, ${darkerColor})`;

    return panel;
}

/**
 * Adjust color brightness
 * @param {string} hex - Hex color string
 * @param {number} amount - Brightness adjustment (-255 to 255)
 * @returns {string} Adjusted hex color
 */
function adjustColorBrightness(hex, amount) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse RGB values
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Adjust brightness
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));

    // Convert back to hex
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Group elements into a row
 * @param {HTMLElement[]} elements - Elements to group
 * @param {string} className - Row class name
 * @returns {HTMLElement} Row containing elements
 */
export function groupInRow(elements, className = 'jack-row') {
    const row = createRow(className);
    elements.forEach(el => row.appendChild(el));
    return row;
}

/**
 * Append multiple elements to a container
 * @param {HTMLElement} container - Target container
 * @param {HTMLElement[]} elements - Elements to append
 */
export function appendAll(container, elements) {
    elements.forEach(el => {
        if (el) container.appendChild(el);
    });
}
