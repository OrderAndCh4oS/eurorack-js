import { expect } from 'vitest';

const CONTROL_KEYS = {
    knobs: 'param',
    switches: 'param',
    buttons: 'param',
    actions: 'param',
    inputs: 'port',
    outputs: 'port'
};

function sorted(values) {
    return [...values].sort();
}

/**
 * Keeps behavioral coverage lists synchronized with the module panel. A new
 * control or port must be added to an explicit behavior test before this guard
 * will pass.
 */
export function expectExhaustivePanelCoverage(moduleDefinition, coverage) {
    Object.entries(CONTROL_KEYS).forEach(([group, key]) => {
        const declared = (moduleDefinition.ui[group] || []).map(item => item[key]);
        expect(sorted(coverage[group] || []), `${moduleDefinition.id} ${group} behavior coverage`)
            .toEqual(sorted(declared));
    });
    expect(sorted(coverage.leds || []), `${moduleDefinition.id} LED behavior coverage`)
        .toEqual(sorted(moduleDefinition.ui.leds || []));
}

export function energy(values) {
    return values.reduce((sum, value) => sum + value * value, 0) / values.length;
}

export function maxAbs(values) {
    return Math.max(...values.map(Math.abs));
}

export function expectFiniteVoltage(outputs, limit) {
    Object.values(outputs).forEach(output => output.forEach(value => {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(limit + 1e-5);
    }));
}
