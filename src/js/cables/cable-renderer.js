/**
 * Cable Renderer - Renders SVG patch cables
 *
 * Creates and updates SVG path elements for visualizing
 * patch cable connections between module jacks.
 */

import { createCablePath, getJackCenter } from './cable-manager.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create a cable renderer for managing SVG cable visuals
 * @param {SVGElement} svgContainer - SVG container element
 * @returns {Object} Cable renderer
 */
export function createCableRenderer(svgContainer) {
    const pathElements = new Map(); // cable.id -> SVGPathElement

    return {
        /**
         * Create SVG path for a cable
         * @param {Object} cable - Cable object with id and color
         * @param {HTMLElement} fromJack - Source jack element
         * @param {HTMLElement} toJack - Destination jack element
         * @returns {SVGPathElement} Created path element
         */
        createCable(cable, fromJack, toJack) {
            const path = document.createElementNS(SVG_NS, 'path');
            path.classList.add('cable');
            path.style.stroke = cable.color;
            path.dataset.cableId = cable.id;

            const from = getJackCenter(fromJack);
            const to = getJackCenter(toJack);
            path.setAttribute('d', createCablePath(from.x, from.y, to.x, to.y));

            svgContainer.appendChild(path);
            pathElements.set(cable.id, { path, fromJack, toJack });

            return path;
        },

        /**
         * Update a cable's path (e.g., after window resize)
         * @param {string} cableId - Cable ID
         */
        updateCable(cableId) {
            const entry = pathElements.get(cableId);
            if (!entry) return;

            const from = getJackCenter(entry.fromJack);
            const to = getJackCenter(entry.toJack);
            entry.path.setAttribute('d', createCablePath(from.x, from.y, to.x, to.y));
        },

        /**
         * Update all cable paths
         */
        updateAllCables() {
            pathElements.forEach((entry, cableId) => {
                this.updateCable(cableId);
            });
        },

        /**
         * Remove a cable's SVG path
         * @param {string} cableId - Cable ID
         */
        removeCable(cableId) {
            const entry = pathElements.get(cableId);
            if (entry) {
                entry.path.remove();
                pathElements.delete(cableId);
            }
        },

        /**
         * Remove all cable paths
         */
        clear() {
            pathElements.forEach(entry => {
                entry.path.remove();
            });
            pathElements.clear();
        },

        /**
         * Mark jacks as connected/disconnected
         * @param {HTMLElement} jackEl - Jack element
         * @param {boolean} connected - Connection state
         */
        setJackConnected(jackEl, connected) {
            jackEl.classList.toggle('connected', connected);
        },

        /**
         * Get path element for a cable
         * @param {string} cableId - Cable ID
         * @returns {SVGPathElement|null}
         */
        getPathElement(cableId) {
            const entry = pathElements.get(cableId);
            return entry ? entry.path : null;
        },

        /**
         * Create a preview cable (for dragging)
         * @param {string} color - Cable color
         * @returns {SVGPathElement}
         */
        createPreviewCable(color) {
            const path = document.createElementNS(SVG_NS, 'path');
            path.classList.add('cable', 'cable-preview');
            path.style.stroke = color;
            svgContainer.appendChild(path);
            return path;
        },

        /**
         * Update preview cable path
         * @param {SVGPathElement} previewPath - Preview path element
         * @param {number} x1 - Start X
         * @param {number} y1 - Start Y
         * @param {number} x2 - End X
         * @param {number} y2 - End Y
         */
        updatePreviewCable(previewPath, x1, y1, x2, y2) {
            previewPath.setAttribute('d', createCablePath(x1, y1, x2, y2));
        },

        /**
         * Remove preview cable
         * @param {SVGPathElement} previewPath - Preview path element
         */
        removePreviewCable(previewPath) {
            if (previewPath) {
                previewPath.remove();
            }
        }
    };
}
