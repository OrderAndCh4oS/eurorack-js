import { createPercussion, preparePercussion } from '../../audio/chimera-percussion.js';
import { BEATBOX_UI } from '../beatbox/index.js';
import { renderBeatboxPanel, BEATBOX_CSS, BEATBOX_TELEMETRY } from '../beatbox/panel.js';
const advanced = [
    ['noise', 'Noise', 0, 2, 1], ['nasal', 'Nasal', 0, 1, 0],
    ['lips', 'Lips', -1, 1, 0], ['tongue', 'Tongue', -1, 1, 0],
    ['throat', 'Throat', 0, 1, 0], ['voicing', 'Hum Voice', 0, 1, 1],
    ['tension', 'Hum Tension', 0, 1, .5], ['fry', 'Hum Fry', 0, 1, 0]
];
const UI = {
    leds: [...BEATBOX_UI.leds],
    knobs: [...BEATBOX_UI.knobs, ...advanced.map(([id, label, min, max, value]) => ({ id, label, param: id, min, max, default: value }))],
    switches: [...BEATBOX_UI.switches], actions: [...BEATBOX_UI.actions],
    inputs: [...BEATBOX_UI.inputs, ...advanced.map(([id, label]) => ({ id: `${id}CV`, label, port: `${id}CV`, signal: 'cv', voltage: { min: -5, max: 5, normal: 0 } })),
        { id: 'choke', label: 'Choke', port: 'choke', signal: 'gate', voltage: { min: 0, max: 10, normal: 0 } }],
    outputs: [...BEATBOX_UI.outputs,
        { id: 'env', label: 'Env', port: 'env', signal: 'cv', voltage: { min: 0, max: 5 } },
        { id: 'active', label: 'Active', port: 'active', signal: 'gate', voltage: { min: 0, max: 10 } }]
};
export default {
    id: 'beatbox-pro', name: 'BEATBOX PRO', hp: 28, color: 'module-color-eight', category: 'voice',
    prepareDSP: preparePercussion,
    createDSP(options) { return createPercussion(options, UI, true); },
    ui: UI,
    render(container, context) { return renderBeatboxPanel(container, context, UI, true); },
    telemetry: BEATBOX_TELEMETRY,
    css: BEATBOX_CSS
};
