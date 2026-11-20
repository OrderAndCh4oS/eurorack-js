const valueControls = '.knob, input[type="range"], [role="slider"]';
const moduleTitle = '#rack-container .module:not(.dragging, .drop-indicator) > .module-label';
const selector = `${valueControls}, ${moduleTitle}`;
const fractions = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: false });
const tooltip = document.createElement('div');
tooltip.id = 'control-value-tooltip';
tooltip.setAttribute('role', 'tooltip');
tooltip.hidden = true;

let hovered = null, focused = null, pressed = null, pointerId = null;
let active = null, label = '', frame = 0;

function controlAt(node) {
    return node?.closest?.(selector) ?? null;
}

function valueText(control) {
    const nativeRange = control.matches('input[type="range"]');
    const raw = nativeRange ? control.value : control.dataset.value ?? control.getAttribute('aria-valuenow');
    const value = Number(raw);
    const description = control.getAttribute('aria-valuetext');
    if (description) return description;
    if (raw == null || raw === '' || !Number.isFinite(value)) return '';
    const step = Number(nativeRange ? control.step || 1 : control.dataset.step);
    if (Number.isInteger(step) && step > 0 && Number.isInteger(value)) return String(value);
    return fractions.format(Math.abs(value) < 0.0005 ? 0 : value);
}

function describe(control, visible) {
    const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    if (visible) ids.add(tooltip.id);
    else ids.delete(tooltip.id);
    if (ids.size) control.setAttribute('aria-describedby', [...ids].join(' '));
    else control.removeAttribute('aria-describedby');
}

// Only the visible tooltip tracks its control. MIDI, patch loads and custom
// sliders can change values without dispatching DOM input events.
function draw() {
    const box = active.getBoundingClientRect();
    const isTitle = active.classList.contains('module-label');
    if ((isTitle && !active.matches(moduleTitle)) || !box.width || !box.height || box.bottom <= 0 || box.top >= window.innerHeight ||
        box.right <= 0 || box.left >= document.documentElement.clientWidth) { clear(); return; }
    const text = isTitle ? active.parentElement.dataset.instanceId : [label, valueText(active)].filter(Boolean).join(' ');
    if (tooltip.textContent !== text) tooltip.textContent = text;
    const gap = 6;
    // A circular knob's CSS rotation changes its bounding box, not its diameter.
    const height = active.matches('.knob') ? active.offsetHeight : box.height;
    const top = box.top + (box.height - height) / 2;
    const width = tooltip.offsetWidth, tipHeight = tooltip.offsetHeight;
    const left = Math.max(gap, Math.min(box.left + (box.width - width) / 2, document.documentElement.clientWidth - width - gap));
    const above = top - tipHeight - gap;
    const y = above >= gap ? above : Math.min(top + height + gap, window.innerHeight - tipHeight - gap);
    const position = `translate(${Math.round(left)}px, ${Math.round(y)}px)`;
    if (tooltip.style.transform !== position) tooltip.style.transform = position;
    frame = requestAnimationFrame(draw);
}

function select() {
    const next = pressed || hovered || focused;
    if (active === next) return;
    cancelAnimationFrame(frame);
    if (active) describe(active, false);
    active = next;
    tooltip.hidden = !active;
    if (!active) return;
    label = active.getAttribute('aria-label') || active.labels?.[0]?.textContent.trim()
        || active.closest('.knob-container')?.querySelector('.knob-label')?.textContent || active.title || '';
    (active.closest('dialog[open]') || document.body).append(tooltip);
    describe(active, true);
    draw();
}

function clear() {
    hovered = null;
    focused = null;
    pressed = null;
    pointerId = null;
    select();
}

document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'touch') { hovered = controlAt(event.target); select(); }
});
document.addEventListener('pointerout', event => {
    if (event.pointerType !== 'touch') { hovered = controlAt(event.relatedTarget); select(); }
});
document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pressed = event.target.closest?.(valueControls) ?? null;
    pointerId = pressed ? event.pointerId : null;
    focused = null;
    select();
}, true);
document.addEventListener('pointerup', event => {
    if (event.pointerId !== pointerId) return;
    pressed = null;
    pointerId = null;
    hovered = event.pointerType === 'touch' ? null : controlAt(document.elementFromPoint(event.clientX, event.clientY));
    select();
}, true);
document.addEventListener('pointercancel', event => { if (event.pointerId === pointerId) clear(); }, true);
document.addEventListener('focusin', event => {
    focused = !pressed && event.target.matches(':focus-visible') ? controlAt(event.target) : null;
    if (focused) hovered = null;
    select();
});
document.addEventListener('focusout', () => { focused = null; select(); });
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') clear();
    else if (!pressed && controlAt(event.target)) {
        focused = controlAt(event.target);
        hovered = null;
        select();
    }
});
window.addEventListener('blur', clear);
