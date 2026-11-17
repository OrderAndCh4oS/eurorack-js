export const BEATBOX_SOUNDS = Object.freeze([
    ['B', 'Kick'], ['t', 'Hi-hat'], ['tss', 'Open hat'], ['Pf', 'Snare'],
    ['K', 'Rimshot'], ['^K', 'Inward snare'], ['!', 'Tongue click'],
    ['P!', 'Lip pop'], ['kch', 'Crash'], ['m', 'Hum']
].map(sound => Object.freeze(sound)));
const finite = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;
export const BEATBOX_TELEMETRY = { fields: ['pitchHz', 'tuneSemitones', 'shapePosition', 'soundIndex', 'selectedSoundIndex', 'pressureValue', 'decayValue', 'snapValue', 'gestureActive', 'displayTick'], methods: [] };
export function renderBeatboxPanel(container, { instance, toolkit }, ui, advanced = false) {
    const dsp = instance.dsp;
    const root = document.createElement('div');
    root.className = `beatbox-panel${advanced ? ' beatbox-pro-panel' : ''}`;
    const display = document.createElement('div'); display.className = 'beatbox-display';
    const heading = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('span');
    display.append(heading, name, detail); root.append(display);
    const lights = toolkit.createRow('beatbox-lights');
    for (const id of ui.leds) { const lamp = document.createElement('span'); lamp.append(toolkit.createLED({ id, color: 'green' }), document.createTextNode(id === 'active' ? 'HIT' : 'OUT')); lights.append(lamp); }
    root.append(lights);
    const knobs = toolkit.createRow('beatbox-knobs');
    for (const definition of ui.knobs) knobs.append(toolkit.createKnob({ ...definition, value: dsp.params[definition.param], small: true }));
    root.append(knobs);
    const actions = toolkit.createRow('beatbox-actions');
    actions.append(toolkit.createActionButton({ id: 'audition', label: 'Hit', mode: 'trigger', value: 0 }));
    actions.append(toolkit.createSwitch({ ...ui.switches[0], value: dsp.params.wrap }));
    root.append(actions);
    const sockets = toolkit.createRow('beatbox-sockets');
    for (const p of ui.inputs) sockets.append(toolkit.createJack({ id: p.port, label: p.label, signal: p.signal, direction: 'input' }));
    for (const p of ui.outputs) sockets.append(toolkit.createJack({ id: p.port, label: p.label, signal: p.signal, direction: 'output' }));
    root.append(sockets); container.append(root);
    let lastTick = 0, lastTelemetryAt = -Infinity;
    function update() {
        const now = performance.now();
        if (lastTick !== dsp.displayTick) { lastTick = dsp.displayTick; lastTelemetryAt = lastTick === 0 ? -Infinity : now; }
        const live = now - lastTelemetryAt < 250;
        const selected = Math.max(0, Math.min(9, live ? (dsp.gestureActive ? dsp.soundIndex : dsp.selectedSoundIndex) : Math.floor(finite(dsp.params.sound))));
        const sound = BEATBOX_SOUNDS[selected];
        const tune = live ? dsp.tuneSemitones : finite(dsp.params.pitch);
        const decay = live ? dsp.decayValue : finite(dsp.params.decay, 1);
        const snap = live ? dsp.snapValue : finite(dsp.params.snap, .5);
        heading.textContent = `${live && dsp.gestureActive ? 'HIT' : 'SOUND'} ${selected + 1}/10 · ${dsp.params.wrap >= .5 ? 'WRAP' : 'CLAMP'}`;
        name.textContent = `${sound[1]} · ${sound[0]}`;
        detail.textContent = `${tune >= 0 ? '+' : ''}${tune.toFixed(1)} st · DEC ${decay.toFixed(2)}× · SNAP ${Math.round(snap * 100)}%`;
    }
    update(); toolkit.animate(update);
}
export const BEATBOX_CSS = `
    .module-type-beatbox .module-content, .module-type-beatbox-pro .module-content { gap: 0; min-height: 0; }
    .beatbox-panel { display: flex; flex-direction: column; gap: 5px; width: 100%; height: 100%; min-height: 0; }
    .beatbox-display { display: flex; flex-direction: column; justify-content: center; min-height: 48px; padding: 5px 8px; background: #14221f; color: #d4f2da; border: 1px solid #426251; border-radius: 4px; }
    .beatbox-display > span { font-size: 8px; letter-spacing: .3px; opacity: .8; }
    .beatbox-display > strong { font-size: 18px; line-height: 1.3; font-weight: 500; }
    .beatbox-lights { display: flex; justify-content: center; gap: 18px; font-size: 7px; }
    .beatbox-lights > span { display: flex; align-items: center; gap: 4px; }
    .beatbox-knobs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 4px; padding: 1px 3px; }
    .beatbox-knobs .knob-container { gap: 2px; }
    .beatbox-knobs .knob-label { font-size: 8px; }
    .beatbox-actions { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 0 5px; }
    .beatbox-actions .knob-container { flex-direction: row; gap: 6px; }
    .beatbox-actions .switch { width: 14px; height: 22px; }
    .beatbox-actions button { min-height: 22px; }
    .beatbox-sockets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px 2px; margin-top: auto; padding: 5px 2px 0; border-top: 1px solid #8885; }
    .beatbox-sockets .jack-label { font-size: 8px; }
    .beatbox-pro-panel { gap: 3px; }
    .beatbox-pro-panel .beatbox-display { min-height: 37px; padding: 3px 8px; }
    .beatbox-pro-panel .beatbox-display > strong { font-size: 16px; }
    .beatbox-pro-panel .beatbox-knobs { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px 5px; }
    .beatbox-pro-panel .beatbox-knobs .knob { width: 26px; height: 26px; }
    .beatbox-pro-panel .beatbox-sockets { grid-template-columns: repeat(7, 1fr); gap: 3px 2px; padding-top: 3px; }
    .beatbox-pro-panel .beatbox-sockets .jack { width: 23px; height: 23px; }
`;
