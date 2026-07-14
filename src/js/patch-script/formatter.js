import { createDefaultParams } from '../app/rack-state.js';

function equal(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function quote(value) {
    return JSON.stringify(value);
}

function formatInline(value) {
    if (Array.isArray(value)) return `[${value.map(formatInline).join(', ')}]`;
    if (value && typeof value === 'object') {
        const fields = Object.entries(value).map(([key, item]) => `${quote(key)}: ${formatInline(item)}`);
        return fields.length ? `{ ${fields.join(', ')} }` : '{}';
    }
    if (typeof value === 'number') {
        const rounded = Number(value.toFixed(5));
        return String(Object.is(rounded, -0) ? 0 : rounded);
    }
    return JSON.stringify(value);
}

function formatPlacement(module) {
    return `{ row: ${module.row}, index: ${module.index} }`;
}

function nonDefaultParams(module, params, registry) {
    const definition = registry.get(module.type);
    const defaults = createDefaultParams(definition);
    (definition.ui?.state || []).forEach(item => { defaults[item.param] = item.default; });
    return Object.fromEntries(Object.entries(params || {}).filter(([param, value]) => !equal(value, defaults[param])));
}

function endpoint(moduleId, port) {
    if (!moduleId.includes('.') && !port.includes('.')) return quote(`${moduleId}.${port}`);
    return `{ module: ${quote(moduleId)}, port: ${quote(port)} }`;
}

export function formatPatchScript(patch, registry) {
    const lines = ['patch()'];
    patch.modules.forEach(module => {
        const params = nonDefaultParams(module, patch.params?.[module.id], registry);
        lines.push(`  .module(${quote(module.type)}, ${quote(module.id)}, ${formatInline(params)}, ${formatPlacement(module)})`);
    });
    (patch.cables || []).forEach(cable => {
        lines.push(`  .connect(${endpoint(cable.fromModule, cable.fromPort)}, ${endpoint(cable.toModule, cable.toPort)})`);
    });
    Object.entries(patch.midiMappings || {}).forEach(([key, mapping]) => {
        lines.push(`  .midi(${quote(key)}, ${formatInline(mapping)})`);
    });
    return `${lines.join('\n')}\n`;
}
