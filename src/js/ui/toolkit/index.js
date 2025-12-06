/**
 * Module Toolkit
 *
 * A collection of helper utilities for building module UIs.
 * Provides component factories, layout helpers, and interaction handlers.
 *
 * Usage:
 *   import { createModuleToolkit } from './toolkit/index.js';
 *   const toolkit = createModuleToolkit();
 *   container.appendChild(toolkit.createKnob({ id: 'freq', label: 'Freq', ... }));
 */

// Re-export individual component factories
export {
    createKnob,
    createJack,
    createSwitch,
    createLED,
    createButtonBank,
    createCanvas,
    updateKnobRotation,
    setupKnobDrag,
    setKnobValue,
    getKnobValue,
    updateLED,
    setSwitchState
} from './components.js';

// Re-export layout helpers
export {
    createRow,
    createSection,
    createSpacer,
    createContent,
    createModuleLabel,
    createPanel,
    groupInRow,
    appendAll
} from './layout.js';

// Re-export interaction helpers
export {
    createKnobController,
    initKnobInteractions
} from './interactions.js';

// Import for toolkit factory
import {
    createKnob,
    createJack,
    createSwitch,
    createLED,
    createButtonBank,
    createCanvas,
    updateKnobRotation,
    updateLED
} from './components.js';

import {
    createRow,
    createSection,
    createSpacer,
    createContent,
    createModuleLabel,
    createPanel,
    groupInRow,
    appendAll
} from './layout.js';

/**
 * Create a toolkit instance with all helpers bound
 * @returns {Object} Toolkit with all component and layout factories
 */
export function createModuleToolkit() {
    return {
        // Component factories
        createKnob,
        createJack,
        createSwitch,
        createLED,
        createButtonBank,
        createCanvas,

        // Layout helpers
        createRow,
        createSection,
        createSpacer,
        createContent,
        createModuleLabel,
        createPanel,
        groupInRow,
        appendAll,

        // Utility functions
        updateKnobRotation,
        updateLED,

        /**
         * Apply a CSS variable theme to an element
         * @param {HTMLElement} element - Target element
         * @param {Object} theme - Theme object with CSS variable values
         */
        applyTheme(element, theme) {
            Object.entries(theme).forEach(([key, value]) => {
                element.style.setProperty(`--module-${key}`, value);
            });
        },

        /**
         * Set a single CSS variable on an element
         * @param {HTMLElement} element - Target element
         * @param {string} name - Variable name (without --module- prefix)
         * @param {string} value - Variable value
         */
        setCSSVar(element, name, value) {
            element.style.setProperty(`--module-${name}`, value);
        }
    };
}

/**
 * Pre-defined color themes for modules
 */
export const THEMES = {
    dark: {
        'panel-bg': '#2a2a2a',
        'panel-bg-dark': '#1a1a1a',
        'label-color': '#999',
        'knob-color': '#555',
        'jack-input': '#4a4',
        'jack-output': '#c44',
        'led-off': '#030',
        'led-on': '#4f4'
    },
    light: {
        'panel-bg': '#e0e0e0',
        'panel-bg-dark': '#c0c0c0',
        'label-color': '#333',
        'knob-color': '#888',
        'jack-input': '#2a8a2a',
        'jack-output': '#a44',
        'led-off': '#030',
        'led-on': '#4f4'
    },
    vintage: {
        'panel-bg': '#d4c5a9',
        'panel-bg-dark': '#b8a88c',
        'label-color': '#4a4a4a',
        'knob-color': '#5a5a5a',
        'jack-input': '#3a6a3a',
        'jack-output': '#8a3a3a',
        'led-off': '#3a2a2a',
        'led-on': '#ff6a6a'
    }
};

/**
 * Default LED thresholds by module type
 */
export const LED_THRESHOLDS = {
    gate: 0.5,      // For gate/trigger LEDs
    level: 0.1,     // For level meter LEDs
    activity: 0.3   // For activity indicator LEDs
};
