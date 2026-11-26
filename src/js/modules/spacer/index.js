import { MAX_HP_PER_ROW } from '../../rack/module-contract.js';
import { paintSpacer, SPACER_PRINTS } from './artwork.js';

const defaults = { hp: 4, style: 'contour' };

export default {
    id: 'spacer',
    name: 'Spacer',
    category: 'other',
    role: 'spacer',
    hp: defaults.hp,
    color: SPACER_PRINTS[defaults.style].color,
    telemetry: { fields: [], methods: [], params: [] },
    ui: {
        inputs: [], outputs: [],
        state: [
            { param: 'hp', default: defaults.hp, min: 1, max: MAX_HP_PER_ROW, step: 1 },
            { param: 'style', default: defaults.style, values: Object.keys(SPACER_PRINTS) }
        ]
    },
    createDSP() {
        return { params: { ...defaults }, inputs: {}, outputs: {}, leds: {}, process() {}, reset() {} };
    },
    render(content, { instance, onCleanup }) {
        const panel = instance.element;
        const doc = panel.ownerDocument;
        const canvas = doc.createElement('canvas');
        canvas.className = 'spacer-print';
        canvas.setAttribute('aria-hidden', 'true');
        const legend = doc.createElement('button');
        legend.type = 'button';
        legend.className = 'spacer-legend';
        const name = doc.createElement('span');
        const size = doc.createElement('span');
        legend.append(name, size);
        content.append(canvas, legend);
        for (const corner of ['tl', 'tr', 'bl', 'br']) {
            const screw = doc.createElement('i');
            screw.className = 'spacer-screw ' + corner;
            screw.setAttribute('aria-hidden', 'true');
            content.append(screw);
        }
        let lastPrint;
        let panelHP = defaults.hp;
        let panelColor = instance.def.color;
        function refresh() {
            const { hp, style } = instance.dsp?.params || defaults;
            const dark = doc.body.classList.contains('theme-dark');
            const key = [hp, style, dark].join('/');
            if (key === lastPrint) return;
            lastPrint = key;
            const print = SPACER_PRINTS[style];
            panel.classList.replace(panelColor, print.color);
            panelColor = print.color;
            paintSpacer(canvas, style, hp * 18, 360);
            panel.classList.replace(`module-${panelHP}hp`, `module-${hp}hp`);
            panelHP = hp;
            panel.style.width = `calc(var(--hp-unit) * ${hp})`;
            panel.classList.toggle('spacer-narrow', hp < 5);
            panel.classList.toggle('spacer-strip', hp < 3);
            panel.dataset.spacerStyle = style;
            name.textContent = print.name;
            size.textContent = hp + ' HP';
            legend.title = 'Change spacer artwork';
            legend.setAttribute('aria-label', `Change artwork for ${name.textContent}, ${hp} HP spacer`);
            panel.title = `${name.textContent} · ${hp} HP. Right-click to change artwork.`;
        }
        panel.addEventListener('spacer-change', refresh);
        doc.addEventListener('theme-mode-change', refresh);
        onCleanup(() => doc.removeEventListener('theme-mode-change', refresh));
        refresh();
    },
    css: `
        body .module.module-type-spacer {
            overflow: hidden; padding: 0; box-sizing: border-box;
            background: var(--factory-module-header, var(--factory-panel-light)) !important;
            box-shadow: inset 0 0 0 1px var(--factory-rule);
        }
        body .module.module-type-spacer::before { display: none; }
        body .module.module-type-spacer > .module-content { position: absolute; inset: 0; display: block; z-index: 0; }
        body .module.module-type-spacer > .module-label {
            position: absolute; z-index: 1; inset: 0 0 auto; height: 18px; margin: 0;
            padding: 0; display: grid; place-items: center; font: bold 8px/1 'Courier New', monospace;
            letter-spacing: .16em; color: var(--factory-ink); text-shadow: none;
        }
        .module-type-spacer .spacer-print {
            position: absolute; top: 19px; left: 0; width: 100%; height: calc(100% - 47px);
            display: block; pointer-events: none; background-color: var(--factory-module-bg, var(--factory-panel));
            border-block: 1px solid var(--factory-rule);
        }
        .module-type-spacer .spacer-legend {
            position: absolute; bottom: 0; inset-inline: 15px; height: 28px;
            padding: 0 2px; display: flex; justify-content: space-between; align-items: center; gap: 2px;
            background: transparent; border: 0; color: var(--factory-ink);
            text-transform: uppercase; white-space: nowrap; font: bold 9px/1 'Courier New', monospace; cursor: pointer;
        }
        .spacer-legend span:last-child { font-size: 8px; font-weight: normal; }
        .spacer-legend:hover span:first-child { text-decoration: underline; text-underline-offset: 3px; }
        .spacer-legend:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
        .spacer-screw {
            position: absolute; width: 7px; height: 7px; pointer-events: none;
            border-radius: 50%; border: 1px solid var(--hw-edge);
            background: linear-gradient(140deg, var(--hw-face-top), var(--hw-face-bottom));
            box-shadow: 0 1px 1px var(--hw-shadow);
        }
        .spacer-screw::after { content: ''; position: absolute; height: 1px; inset: 50% 0 auto; background: var(--hw-ink); transform: rotate(-38deg); }
        .spacer-screw.tl, .spacer-screw.tr { top: 6px; }
        .spacer-screw.bl, .spacer-screw.br { bottom: 10px; }
        .spacer-screw.tl, .spacer-screw.bl { left: 5px; }
        .spacer-screw.tr, .spacer-screw.br { right: 5px; }
        .module-5hp .spacer-legend { inset-inline: 14px; padding: 0; }
        body .module.module-type-spacer.spacer-narrow > .module-label { font-size: 0; }
        .spacer-narrow .spacer-legend { inset-inline: 1px; bottom: 14px; height: 14px; justify-content: center; }
        .spacer-narrow .spacer-legend span:last-child { display: none; }
        .spacer-narrow .spacer-screw.tl, .spacer-narrow .spacer-screw.bl { left: calc(50% - 3.5px); }
        .spacer-narrow .spacer-screw.bl { bottom: 4px; }
        .spacer-narrow .spacer-screw.tr, .spacer-narrow .spacer-screw.br { display: none; }
        .spacer-strip .spacer-legend { height: 46px; }
        .spacer-strip .spacer-legend span:first-child { writing-mode: vertical-rl; }
        .spacer-strip .spacer-print { height: calc(100% - 80px); }
        .module.module-type-spacer.spacer-strip .remove-btn { top: 1px; right: 0; }
    `
};
