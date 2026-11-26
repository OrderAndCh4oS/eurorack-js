const valueControls = '.knob, input[type="range"], [role="slider"]';
const moduleTitle = '#rack-container .module:not(.dragging, .drop-indicator) > .module-label';
const selector = `${valueControls}, ${moduleTitle}`;
const fractions = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: false });

function createTooltip(id) {
    const tip = document.createElement('div');
    tip.id = id;
    tip.className = 'control-value-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    return tip;
}

const tooltip = createTooltip('control-value-tooltip');
const moving = new Map();
let movingFrame = 0, nextTooltipId = 0;

let hovered = null, focused = null, pressed = null, pointerId = null;
let active = null, label = '', frame = 0;

function controlAt(node) {
    return node?.closest?.(selector) ?? null;
}

function controlLabel(control) {
    return control.getAttribute('aria-label') || control.labels?.[0]?.textContent.trim()
        || control.closest('.knob-container')?.querySelector('.knob-label')?.textContent || control.title || control.dataset.param || '';
}

function valueText(control, readValue) {
    const description = control.getAttribute('aria-valuetext');
    if (description) return description;
    if (control.matches('select')) return control.selectedOptions[0]?.textContent ?? '';
    if (control.hasAttribute('aria-pressed')) return control.getAttribute('aria-pressed') === 'true' ? 'On' : 'Off';
    if (control.matches('.button-bank')) return control.querySelector('.active')?.textContent ?? '';
    const nativeRange = control.matches('input[type="range"]');
    const raw = nativeRange ? control.value : control.dataset.value ?? control.getAttribute('aria-valuenow') ?? readValue?.();
    const value = Number(raw);
    if (raw == null || raw === '' || !Number.isFinite(value)) return '';
    const step = Number(nativeRange ? control.step || 1 : control.dataset.step);
    if (Number.isInteger(step) && step > 0 && Number.isInteger(value)) return String(value);
    return fractions.format(Math.abs(value) < 0.0005 ? 0 : value);
}

function describe(control, tip, visible) {
    const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    if (visible) ids.add(tip.id);
    else ids.delete(tip.id);
    if (ids.size) control.setAttribute('aria-describedby', [...ids].join(' '));
    else control.removeAttribute('aria-describedby');
}

// The bounds of the circular face stay fixed while the knob element rotates.
function controlBounds(control) {
    const box = control.getBoundingClientRect();
    if (!box.width || !control.matches('.knob')) return box;
    const width = control.offsetWidth, height = control.offsetHeight;
    const left = box.left + (box.width - width) / 2, top = box.top + (box.height - height) / 2;
    return {left, top, width, height, right: left + width, bottom: top + height};
}

function positionTooltip(tip, control, label, box, occupied, readValue) {
    const isTitle = control.classList.contains('module-label');
    const rack = control.closest('#rack-container')?.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    if (control.closest('[inert]') || (isTitle && !control.matches(moduleTitle)) || !box.width || !box.height ||
        box.bottom <= (rack?.top ?? 0) || box.top >= (rack?.bottom ?? window.innerHeight) ||
        box.right <= (rack?.left ?? 0) || box.left >= (rack?.right ?? viewportWidth)) return false;
    tip.hidden = false;
    const text = isTitle ? control.parentElement.dataset.instanceId : [label, valueText(control, readValue)].filter(Boolean).join(' ');
    if (tip.textContent !== text) tip.textContent = text;
    const gap = 6;
    const width = tip.offsetWidth, tipHeight = tip.offsetHeight;
    const left = Math.max(gap, Math.min(box.left + (box.width - width) / 2, viewportWidth - width - gap));
    const above = box.top - tipHeight - gap;
    const below = box.bottom + gap;
    const bottomLimit = window.innerHeight - tipHeight - gap;
    let y = above >= gap ? above : Math.min(below, bottomLimit);
    if (occupied) {
        const neighbours = occupied.filter(rect => left < rect.right + gap && left + width + gap > rect.left);
        const candidates = [y, below, ...neighbours.flatMap(rect => [rect.top - gap - tipHeight, rect.bottom + gap])];
        y = candidates.find(pos => pos >= gap && pos <= bottomLimit &&
            neighbours.every(rect => pos + tipHeight + gap <= rect.top || pos >= rect.bottom + gap)) ?? y;
        occupied.push({left, right: left + width, top: y, bottom: y + tipHeight});
    }
    const position = `translate(${Math.round(left)}px, ${Math.round(y)}px)`;
    if (tip.style.transform !== position) tip.style.transform = position;
    return true;
}

function draw() {
    if (!positionTooltip(tooltip, active, label, controlBounds(active))) { clear(); return; }
    frame = requestAnimationFrame(draw);
}

function select() {
    const manual = pressed || hovered || focused;
    const next = moving.has(manual) ? null : manual;
    if (active === next) return;
    cancelAnimationFrame(frame);
    if (active) describe(active, tooltip, false);
    active = next;
    tooltip.hidden = !active;
    if (!active) return;
    label = controlLabel(active);
    (active.closest('dialog[open]') || document.body).append(tooltip);
    describe(active, tooltip, true);
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

// Agent sweeps can drive several controls without any pointer or focus events.
// Share one animation frame across their tips and release each at its endpoint.
function drawMoving() {
    if (!moving.size) return;
    const bounds = new Map();
    const headers = new Set();
    for (const [control, {header}] of moving) {
        bounds.set(control, controlBounds(control));
        if (header) headers.add(header);
    }
    // Keep the printed module names and the moving pointers clear for the camera.
    const occupied = [...bounds.values(), ...Array.from(headers, header => header.getBoundingClientRect())];
    if (!tooltip.hidden) occupied.push(tooltip.getBoundingClientRect());
    for (const [control, {tip, label, readValue}] of moving) {
        const wasHidden = tip.hidden;
        const visible = positionTooltip(tip, control, label, bounds.get(control), occupied, readValue);
        tip.hidden = !visible;
        if (wasHidden !== tip.hidden) describe(control, tip, visible);
    }
    movingFrame = requestAnimationFrame(drawMoving);
}

document.addEventListener('agent-controls-change', ({detail: targets}) => {
    for (const [control, {tip}] of moving) {
        if (targets.has(control)) continue;
        control.classList.remove('agent-control-target');
        describe(control, tip, false);
        tip.remove();
        moving.delete(control);
    }
    for (const [control, readValue] of targets) {
        if (moving.has(control)) continue;
        const tip = createTooltip(`agent-control-tooltip-${++nextTooltipId}`);
        document.body.append(tip);
        control.classList.add('agent-control-target');
        const header = control.closest('.module')?.querySelector('.module-label');
        moving.set(control, {tip, label: controlLabel(control), header, readValue});
    }
    select();
    cancelAnimationFrame(movingFrame);
    drawMoving();
});
