import { adjustColor, getModuleColorToken, isHexColor } from '../../utils/color.js';

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
 * @param {number} options.hp - Width in HP units supported by the registry
 * @param {string} options.color - Module color token or legacy hex color
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
    const colorToken = getModuleColorToken(color);
    panel.className = ['module', `module-${hp}hp`, colorToken, className].filter(Boolean).join(' ');
    panel.id = `module-${id}`;

    if (!colorToken && isHexColor(color)) {
        const darkerColor = adjustColor(color, -30);
        const lighterColor = adjustColor(color, 18);
        panel.style.setProperty('--module-color', color);
        panel.style.setProperty('--module-color-dark', darkerColor);
        panel.style.setProperty('--factory-module-bg', color);
        panel.style.setProperty('--factory-module-header', lighterColor);
        panel.style.setProperty('--factory-module-dark-bg', darkerColor);
        panel.style.setProperty('--factory-module-dark-header', color);
        panel.style.background = `linear-gradient(to bottom, ${color}, ${darkerColor})`;
    }

    return panel;
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
