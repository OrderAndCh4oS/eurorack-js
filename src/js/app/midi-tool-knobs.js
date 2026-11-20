import { setKnobValue, setupKnobDrag } from '../ui/toolkit/components.js';

export function createMidiKnobs(container, ccNumbers, sendCC) {
    ccNumbers.forEach((cc, index) => {
        const group = document.createElement('div');
        group.className = 'knob-container';
        const label = `Knob ${index + 1}`;
        group.innerHTML = `
            <div class="knob-label">${label}</div>
            <div class="knob" data-cc="${cc}" data-min="0" data-max="127" data-step="1" aria-label="${label}"></div>
            <div class="knob-value" id="value-${cc}">64</div>
            <div class="cc-number">CC ${cc}</div>`;
        const knob = group.querySelector('.knob');
        const output = group.querySelector('.knob-value');
        setKnobValue(knob, 64);
        // These controllers use two vertical pixels per MIDI CC step.
        setupKnobDrag(knob, value => {
            if (Number(output.textContent) === value) return;
            output.textContent = String(value);
            sendCC(cc, value);
        }, 254);
        knob.addEventListener('dblclick', () => {
            setKnobValue(knob, 64);
            output.textContent = '64';
            sendCC(cc, 64);
        });
        container.appendChild(group);
    });
}
