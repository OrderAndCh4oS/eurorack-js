/**
 * Module Toolkit - Interactions
 *
 * Handles mouse/touch interactions for UI components like knobs.
 * Provides both low-level controllers and high-level initialization helpers.
 */

import { updateKnobRotation } from './components.js';

/**
 * Create a knob controller for handling drag interactions
 * @param {Object} options
 * @param {Function} options.onParamChange - Callback when param changes (moduleId, param, value)
 * @returns {Object} Knob controller
 */
export function createKnobController({ onParamChange = null } = {}) {
    let dragState = null;

    /**
     * Start dragging a knob
     * @param {HTMLElement} knobEl - Knob element
     * @param {MouseEvent|TouchEvent} e - Event
     */
    function startDrag(knobEl, e) {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragState = {
            knob: knobEl,
            startY: clientY,
            startValue: parseFloat(knobEl.dataset.value)
        };
    }

    /**
     * Update knob during drag
     * @param {MouseEvent|TouchEvent} e - Event
     */
    function updateDrag(e) {
        if (!dragState) return;

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const knob = dragState.knob;
        const min = parseFloat(knob.dataset.min);
        const max = parseFloat(knob.dataset.max);
        const step = parseFloat(knob.dataset.step) || 0;
        const range = max - min;
        const dy = dragState.startY - clientY;
        let newValue = dragState.startValue + (dy / 150) * range;

        // Apply stepping if defined
        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }

        // Clamp to range
        newValue = Math.max(min, Math.min(max, newValue));

        // Update knob
        knob.dataset.value = newValue;
        updateKnobRotation(knob);

        // Notify of change
        if (onParamChange) {
            const moduleId = knob.dataset.module;
            const param = knob.dataset.param;
            onParamChange(moduleId, param, newValue);
        }
    }

    /**
     * End knob drag
     */
    function endDrag() {
        dragState = null;
    }

    /**
     * Check if currently dragging
     * @returns {boolean}
     */
    function isDragging() {
        return dragState !== null;
    }

    return {
        startDrag,
        updateDrag,
        endDrag,
        isDragging
    };
}

/**
 * Initialize knob interactions on a container
 * @param {HTMLElement} container - Container element
 * @param {Object} options
 * @param {Function} options.onParamChange - Callback for param changes
 * @returns {Function} Cleanup function
 */
export function initKnobInteractions(container, { onParamChange } = {}) {
    const controller = createKnobController({ onParamChange });

    function handleMouseDown(e) {
        const knob = e.target.closest('.knob');
        if (knob) {
            e.preventDefault();
            controller.startDrag(knob, e);
        }
    }

    function handleMouseMove(e) {
        if (controller.isDragging()) {
            e.preventDefault();
            controller.updateDrag(e);
        }
    }

    function handleMouseUp() {
        controller.endDrag();
    }

    // Mouse events
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Touch events
    container.addEventListener('touchstart', handleMouseDown, { passive: false });
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);

    // Return cleanup function
    return () => {
        container.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('touchstart', handleMouseDown);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
    };
}
