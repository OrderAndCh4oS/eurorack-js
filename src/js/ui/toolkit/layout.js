import { getModuleColorToken } from '../../utils/color.js';

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
 * @param {string} options.color - Module color token
 * @param {string} options.type - Module definition ID
 * @param {string} options.className - Additional CSS class
 * @returns {HTMLElement} Module panel element
 */
export function createPanel({
    id,
    hp,
    color,
    type,
    className = ''
}) {
    const panel = document.createElement('div');
    const colorToken = getModuleColorToken(color);
    panel.className = ['module', `module-${hp}hp`, type && `module-type-${type}`, colorToken, className]
        .filter(Boolean)
        .join(' ');
    panel.id = `module-${id}`;

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
