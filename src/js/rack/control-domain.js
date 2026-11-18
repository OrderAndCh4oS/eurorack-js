import laws from './verified-laws.js';

const binary = Object.freeze([0, 1]);

export function switchValues(control) {
    return control.values ?? control.positions?.map((_, index) => index) ?? binary;
}

export function getControlDomain(definition, param) {
    const ui = definition?.ui;
    const knob = ui?.knobs?.find(control => control.param === param);
    if (knob) return { min: knob.min ?? 0, max: knob.max ?? 1, step: knob.step ?? 0 };
    const sw = ui?.switches?.find(control => control.param === param);
    if (sw) return { values: switchValues(sw) };
    const button = ui?.buttons?.find(control => control.param === param);
    if (button) return { values: button.values ?? binary };
    if (ui?.actions?.some(control => control.param === param)) return { values: binary };
    return null;
}

export function inRange(value, min, max) {
    return Number.isFinite(value) && laws.in_range(min <= value, value <= max);
}

export function controlRange(domain) {
    if (domain.values) return { min: Math.min(...domain.values), max: Math.max(...domain.values) };
    return { min: domain.min, max: domain.max };
}

export function legalControlValue(domain, value) {
    if (domain.values) return domain.values.includes(value);
    const { min, max, step } = domain;
    if (!inRange(value, min, max)) return false;
    if (!step || value === min || value === max) return true;
    if (Number.isInteger(min) && Number.isInteger(step)) return (value - min) % step === 0;
    const position = (value - min) / step;
    // Allow rounding in the subtraction and division of decimal step sizes.
    const tolerance = 4 * Number.EPSILON * Math.max(1, Math.abs(value / step), Math.abs(min / step));
    return Math.abs(position - Math.round(position)) <= Math.min(0.25, tolerance);
}

export function snapKnobValue(value, min, max, step) {
    const bounded = Math.max(min, Math.min(max, value));
    if (!step || bounded === min || bounded === max) return bounded;
    const last = Math.ceil((max - min) / step);
    const index = laws.position(Math.round((bounded - min) / step), last);
    const nearestStep = Math.min(max, min + index * step);
    // The upper endpoint can be a shorter final step.
    return max - bounded <= Math.abs(nearestStep - bounded) ? max : nearestStep;
}

export function snapControlValue(domain, value) {
    if (!domain.values) return snapKnobValue(value, domain.min, domain.max, domain.step);
    const values = domain.values;
    let nearest = 0;
    for (let i = 1; i < values.length; i++) {
        if (Math.abs(values[i] - value) <= Math.abs(values[nearest] - value)) nearest = i;
    }
    return values[nearest];
}
