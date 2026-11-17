import { createPercussion, preparePercussion } from '../../audio/chimera-percussion.js';
import { renderBeatboxPanel, BEATBOX_CSS, BEATBOX_TELEMETRY } from './panel.js';
export const BEATBOX_UI = {
    leds: ['active', 'level'],
    knobs: [
        { id: 'sound', label: 'Sound', param: 'sound', min: 0, max: 9, step: 1, default: 0 },
        { id: 'pitch', label: 'Tune', param: 'pitch', min: -12, max: 12, default: 0 },
        { id: 'shape', label: 'Shape', param: 'shape', min: 0, max: 4, default: 0 },
        { id: 'decay', label: 'Decay', param: 'decay', min: .25, max: 4, default: 1 },
        { id: 'snap', label: 'Snap', param: 'snap', min: 0, max: 1, default: .5 },
        { id: 'pressure', label: 'Pressure', param: 'pressure', min: 0, max: 22, default: 8 },
        { id: 'breath', label: 'Breath', param: 'breath', min: 0, max: 1, default: 0.15 },
        { id: 'level', label: 'Level', param: 'level', min: 0, max: 1, default: 0.8 }
    ],
    switches: [{ id: 'wrap', label: 'Wrap', param: 'wrap', default: 0 }],
    actions: [{ id: 'audition', label: 'Hit', param: 'audition', mode: 'trigger', default: 0 }],
    inputs: [
        { id: 'trig', label: 'Trig', port: 'trig', signal: 'trigger', voltage: { min: 0, max: 10, normal: 0 } },
        { id: 'soundCV', label: 'Sound', port: 'soundCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'accent', label: 'Accent', port: 'accent', signal: 'cv', voltage: { min: 0, max: 5, normal: 0 } },
        { id: 'vOct', label: 'Tune V/O', port: 'vOct', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'shapeCV', label: 'Shape', port: 'shapeCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'pressureCV', label: 'Press', port: 'pressureCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'decayCV', label: 'Decay', port: 'decayCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } },
        { id: 'snapCV', label: 'Snap', port: 'snapCV', signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } }
    ],
    outputs: [{ id: 'out', label: 'Out', port: 'out', signal: 'audio', voltage: { min: -5, max: 5 } }]
};

export default {
    id: 'beatbox', name: 'BEATBOX', hp: 16, color: 'module-color-eight', category: 'voice',
    prepareDSP: preparePercussion,
    createDSP(options) { return createPercussion(options, BEATBOX_UI); },
    ui: BEATBOX_UI,
    render(container, context) { return renderBeatboxPanel(container, context, BEATBOX_UI); },
    telemetry: BEATBOX_TELEMETRY,
    css: BEATBOX_CSS
};
