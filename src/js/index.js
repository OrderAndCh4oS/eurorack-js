/**
 * Eurorack System Entry Point
 *
 * Main entry point for the rack and module system.
 * Exports everything needed to work with modules.
 *
 * Usage:
 *   import { loadModules, createRack } from './index.js';
 *
 *   await loadModules();
 *   const rack = createRack({
 *     container: document.getElementById('rack'),
 *     modules: ['clk', 'div', 'vco', 'vcf', 'vca', 'out']
 *   });
 *   rack.render();
 */

// Registry exports
export {
    moduleRegistry,
    loadModules,
    registerModule,
    hotReloadModule
} from './rack/registry.js';

// Rack exports
export { createRack } from './rack/rack.js';

// Renderer exports
export {
    renderModule,
    updateModuleLEDs,
    applyParamsToUI
} from './ui/renderer.js';

// Toolkit exports (for custom modules)
export {
    createModuleToolkit,
    THEMES,
    LED_THRESHOLDS,
    // Individual component factories
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
    setupKnobDrag,
    setKnobValue,
    getKnobValue,
    updateLED,
    setSwitchState
} from './ui/toolkit/index.js';

// Re-export commonly used utilities for module authors
export { clamp, expMap } from './utils/math.js';
export { createSlew } from './utils/slew.js';
export { SAMPLE_RATE, BUFFER, CABLE_COLORS } from './config/constants.js';

/**
 * Default module order (can be customized)
 */
export const DEFAULT_MODULE_ORDER = [
    'clk',
    'div',
    'lfo',
    'nse',
    'sh',
    'quant',
    'arp',
    'seq',
    'euclid',
    'logic',
    'mult',
    'vco',
    'vcf',
    'fold',
    'adsr',
    'vca',
    'atten',
    'slew',
    'dly',
    'verb',
    'kick',
    'snare',
    'hat',
    'mix',
    'scope',
    'out'
];

/**
 * Convenience function to set up a complete rack
 * @param {HTMLElement} container - DOM container
 * @param {Object} options - Options
 * @param {string[]} options.modules - Module IDs (default: DEFAULT_MODULE_ORDER)
 * @param {AudioContext} options.audioCtx - Audio context
 * @returns {Promise<Object>} Initialized rack
 */
export async function setupRack(container, options = {}) {
    const {
        modules = DEFAULT_MODULE_ORDER,
        audioCtx = null
    } = options;

    // Load all module definitions
    await loadModules();

    // Create and render rack
    const { createRack } = await import('./rack/rack.js');
    const rack = createRack({
        container,
        modules,
        audioCtx
    });

    rack.render();

    return rack;
}
