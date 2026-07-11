/** Public Eurorack host and trusted-plugin API. */

export {
    PLUGIN_API_VERSION,
    PluginRegistry,
    pluginRegistry,
    loadCorePlugin,
    registerPlugin,
    unregisterPlugin
} from './rack/registry.js';

export { RackHost, createRackHost } from './app/rack-host.js';
export {
    MODULE_MANIFEST,
    MODULE_ORDER,
    MODULE_ORDER as DEFAULT_MODULE_ORDER,
    CORE_PLUGIN_MANIFEST,
    CATEGORY_ORDER,
    CATEGORY_LABELS
} from './rack/module-manifest.js';
export {
    SIGNAL_TYPES,
    assertModuleParam,
    getModuleParamPaths,
    getModulePort,
    getModulePorts,
    normalizePortDefinition,
    validateModuleDefinition
} from './rack/module-contract.js';

export {
    cleanupRenderedModule,
    renderModule,
    syncParamToModuleUI,
    updateModuleLEDs,
    applyParamsToUI
} from './ui/renderer.js';

export {
    createModuleToolkit,
    THEMES,
    LED_THRESHOLDS,
    createKnob,
    createJack,
    createSwitch,
    createLED,
    createButtonBank,
    createActionButton,
    createCanvas,
    createRow,
    createSection,
    createSpacer,
    createContent,
    createModuleLabel,
    createPanel,
    groupInRow,
    appendAll,
    updateKnobRotation,
    setupKnobDrag,
    setKnobValue,
    getKnobValue,
    updateLED,
    setSwitchState
} from './ui/toolkit/index.js';

export { clamp, expMap } from './utils/math.js';
export { createLinearCircularReader, linearInterpolate } from './utils/interpolation.js';
export { polyBlep, wrapPhase } from './utils/oscillator.js';
export { createSlew } from './utils/slew.js';
export { createRealFft } from './utils/fft.js';
export { softLimitVoltage } from './utils/voltage.js';
export { SAMPLE_RATE, BUFFER, CABLE_COLORS } from './config/constants.js';
