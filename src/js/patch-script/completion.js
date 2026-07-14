import { getModulePorts } from '../rack/module-contract.js';

const BUILDER_METHODS = ['module', 'add', 'port', 'set', 'connect', 'midi'];
const CONSOLE_COMMANDS = [
    ':help', ':modules', ':describe', ':rack', ':json', ':validate', ':apply', ':snapshot',
    ':profile start', ':profile stop', ':profile report', ':clear'
];

function controlsFor(definition) {
    const ui = definition?.ui || {};
    return [
        ...(ui.knobs || []).map(control => ({ ...control, kind: 'knob' })),
        ...(ui.switches || []).map(control => ({ ...control, kind: 'switch' })),
        ...(ui.buttons || []).map(control => ({ ...control, kind: 'button' })),
        ...(ui.actions || []).map(control => ({ ...control, kind: 'action' })),
        ...(ui.state || []).map(control => ({ ...control, kind: 'state' }))
    ];
}

export function scanLiteralPatchSource(source) {
    const modules = new Map();
    const declarations = [];
    const modulePattern = /\.module\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3/g;
    let match;
    while ((match = modulePattern.exec(source))) {
        declarations.push({ index: match.index, id: match[4], type: match[2] });
    }
    const modernModulePattern = /\.module\s*\(\s*(['"])(.*?)\1(?!\s*,\s*['"])([^)]*)\)/g;
    while ((match = modernModulePattern.exec(source))) {
        const optionsName = match[3].match(/\b(?:name|id)\s*:\s*(['"])(.*?)\1/)?.[2] || null;
        declarations.push({ index: match.index, id: optionsName, type: match[2], estimate: !optionsName });
    }
    const addPattern = /\.add\s*\(\s*(['"])(.*?)\1/g;
    while ((match = addPattern.exec(source))) {
        declarations.push({ index: match.index, id: null, type: match[2], estimate: true });
    }
    const typeCounts = {};
    declarations.sort((a, b) => a.index - b.index).forEach(declaration => {
        const escaped = declaration.type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reserved = declaration.id?.match(new RegExp(`^${escaped}_(\\d+)$`));
        if (reserved) typeCounts[declaration.type] = Math.max(typeCounts[declaration.type] || 0, Number(reserved[1]));
        if (!declaration.id) {
            typeCounts[declaration.type] = (typeCounts[declaration.type] || 0) + 1;
            declaration.id = `${declaration.type}_${typeCounts[declaration.type]}`;
        }
        modules.set(declaration.id, {
            id: declaration.id,
            type: declaration.type,
            provenance: declaration.estimate ? 'draft estimate' : 'draft'
        });
    });
    const connections = [];
    const connectionPattern = /\.connect\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)/g;
    while ((match = connectionPattern.exec(source))) {
        connections.push({ from: match[2], to: match[4] });
    }
    return { modules, connections };
}

function createModel(source, registry, lastPatch) {
    const scanned = scanLiteralPatchSource(source);
    const modules = new Map();
    (lastPatch?.modules || []).forEach(module => {
        modules.set(module.id, { id: module.id, type: module.type, provenance: 'validated' });
    });
    scanned.modules.forEach((module, id) => modules.set(id, module));
    const occupiedInputs = new Map();
    (lastPatch?.cables || []).forEach(cable => {
        occupiedInputs.set(`${cable.toModule}.${cable.toPort}`, `${cable.fromModule}.${cable.fromPort}`);
    });
    scanned.connections.forEach(connection => occupiedInputs.set(connection.to, connection.from));
    return { modules, occupiedInputs };
}

function filterItems(items, prefix) {
    const needle = prefix.toLowerCase();
    return items
        .filter(item => !needle || item.label.toLowerCase().includes(needle) || item.insertText.toLowerCase().includes(needle))
        .sort((a, b) => Number(a.unavailable) - Number(b.unavailable) || a.label.localeCompare(b.label));
}

function result(items, from, to, prefix = '') {
    return { items: filterItems(items, prefix), from, to };
}

function quotedContentEnd(source, cursor, quote) {
    let index = cursor;
    while (index < source.length && source[index] !== quote && source[index] !== '\n') index++;
    return index;
}

function scalarValueEnd(source, cursor) {
    const candidate = source.slice(cursor).match(/^[^,}\n)]*/)?.[0] || '';
    return cursor + candidate.trimEnd().length;
}

function parameterKeyEnd(source, cursor) {
    let index = cursor;
    while (/[\w.-]/.test(source[index] || '')) index++;
    if (source[index] === '"' || source[index] === "'") index++;
    let afterSpace = index;
    while (/\s/.test(source[afterSpace] || '') && source[afterSpace] !== '\n') afterSpace++;
    if (source[afterSpace] !== ':') return index;
    afterSpace++;
    while (/\s/.test(source[afterSpace] || '') && source[afterSpace] !== '\n') afterSpace++;
    return afterSpace;
}

function moduleItems(registry) {
    return registry.getAllDefinitions().map(definition => ({
        label: definition.id,
        insertText: definition.id,
        detail: `${definition.name} · ${definition.category} · ${definition.hp}HP · ${registry.getPluginForModule(definition.id)}`
    }));
}

function instanceItems(model) {
    return [...model.modules.values()].map(module => ({
        label: module.id,
        insertText: module.id,
        detail: `${module.type} · ${module.provenance}`
    }));
}

function parameterItems(module, registry, { objectKey = false } = {}) {
    const definition = module ? registry.get(module.type) : null;
    return controlsFor(definition).map(control => {
        let detail = `${control.kind} · ${control.label || control.param}`;
        if (control.kind === 'knob') detail += ` · ${control.min}..${control.max} · default ${control.default}`;
        if (control.positions) detail += ` · ${control.positions.map((label, index) => `${index}:${label}`).join(', ')}`;
        if (control.values) detail += ` · ${control.values.join(', ')}`;
        if (control.kind === 'action') detail += ` · ${control.mode || 'toggle'}`;
        return {
            label: control.param,
            insertText: objectKey ? `${JSON.stringify(control.param)}: ` : control.param,
            detail
        };
    });
}

function uniqueValues(values) {
    const seen = new Set();
    return values.filter(item => {
        const key = JSON.stringify(item.value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function valueItems(control) {
    if (!control) return [];
    let values = [];
    if (control.kind === 'knob') {
        values = uniqueValues([
            { value: control.default, label: 'Default' },
            { value: control.min, label: 'Minimum' },
            { value: control.max, label: 'Maximum' }
        ].filter(item => item.value !== undefined));
    } else if (Array.isArray(control.positions)) {
        values = control.positions.map((label, value) => ({ value, label }));
    } else if (Array.isArray(control.values)) {
        values = control.values.map(value => ({ value, label: `Value ${value}` }));
    } else if (control.kind === 'action' && control.mode === 'trigger') {
        values = [{ value: 0, label: 'Idle' }, { value: 1, label: 'Fire on Apply', warning: true }];
    } else if (control.kind === 'action' && control.mode === 'momentary') {
        values = [{ value: 0, label: 'Released' }, { value: 1, label: 'Held', warning: true }];
    } else if (control.kind === 'state') {
        values = [{ value: control.default, label: 'Default state' }];
    } else {
        values = [{ value: 0, label: 'Off' }, { value: 1, label: 'On' }];
    }
    return values.map(item => ({
        label: `${JSON.stringify(item.value)} — ${item.label}`,
        insertText: JSON.stringify(item.value),
        detail: item.warning ? 'Transient state; applying may cause an action' : `${control.kind} state`
    }));
}

function socketItems(model, registry, direction) {
    const items = [];
    model.modules.forEach(module => {
        const definition = registry.get(module.type);
        if (!definition) return;
        getModulePorts(definition, direction).forEach(port => {
            const endpoint = `${module.id}.${port.port}`;
            const source = model.occupiedInputs.get(endpoint);
            const voltage = direction === 'input'
                ? `${port.voltage.min}..${port.voltage.max}V, normal ${port.voltage.normal}V`
                : `${port.voltage.min}..${port.voltage.max}V`;
            items.push({
                label: endpoint,
                insertText: endpoint,
                unavailable: direction === 'input' && !!source,
                detail: `${port.label || port.port} · ${port.signal} · ${voltage} · ${module.provenance}${source ? ` · occupied by ${source}` : ''}`
            });
        });
    });
    return items;
}

function portsForInstance(model, registry, instanceId, direction) {
    const module = model.modules.get(instanceId);
    const definition = module ? registry.get(module.type) : null;
    if (!definition) return [];
    return getModulePorts(definition, direction).map(port => ({
        label: port.port,
        insertText: port.port,
        detail: `${port.label || port.port} · ${port.signal} · ${port.voltage.min}..${port.voltage.max}V${direction === 'input' ? ` · normal ${port.voltage.normal}V` : ''}`
    }));
}

function findModuleParamContext(source, cursor, model, registry) {
    const before = source.slice(0, cursor);
    const moduleCall = before.lastIndexOf('.module(');
    const setCall = before.lastIndexOf('.set(');
    const start = Math.max(moduleCall, setCall);
    if (start < 0) return null;
    const tail = before.slice(start);
    let module;
    let objectBody;
    if (start === moduleCall) {
        const named = tail.match(/^\.module\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*,\s*\{([\s\S]*)$/);
        const modern = tail.match(/^\.module\s*\(\s*(['"])(.*?)\1\s*,\s*\{([\s\S]*)$/);
        if (!named && !modern) return null;
        module = named
            ? { id: named[4], type: named[2], provenance: 'draft' }
            : { id: null, type: modern[2], provenance: 'draft' };
        objectBody = named ? named[5] : modern[3];
    } else {
        const match = tail.match(/^\.set\s*\(\s*(['"])(.*?)\1\s*,\s*\{([\s\S]*)$/);
        if (!match) return null;
        module = model.modules.get(match[2]);
        objectBody = match[3];
    }
    if (!module || objectBody.includes('}')) return null;
    const definition = registry.get(module.type);
    const controls = controlsFor(definition);
    const valueMatch = objectBody.match(/(?:^|,)\s*['"]?([\w.-]+)['"]?\s*:\s*([^,}]*)$/);
    if (valueMatch) {
        const prefix = valueMatch[2].trim();
        return {
            kind: 'value',
            prefix,
            from: before.length - prefix.length,
            to: scalarValueEnd(source, cursor),
            items: valueItems(controls.find(control => control.param === valueMatch[1]))
        };
    }
    const keyMatch = objectBody.match(/(?:^|,)(\s*)(['"]?)([\w.-]*)$/);
    if (!keyMatch) return null;
    const used = new Set([...objectBody.matchAll(/['"]?([\w.-]+)['"]?\s*:/g)].map(match => match[1]));
    return {
        kind: 'parameter',
        prefix: keyMatch[3],
        from: before.length - keyMatch[3].length - keyMatch[2].length,
        to: parameterKeyEnd(source, cursor),
        items: parameterItems(module, registry, { objectKey: true }).filter(item => !used.has(item.label))
    };
}

export function getPatchScriptCompletions({ source, cursor, registry, lastPatch = null }) {
    const before = source.slice(0, cursor);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    const model = createModel(source, registry, lastPatch);

    if (line.trimStart().startsWith(':')) {
        const prefix = line.trim();
        return result(CONSOLE_COMMANDS.map(command => ({ label: command, insertText: command, detail: 'Console command' })), lineStart + line.indexOf(':'), cursor, prefix);
    }

    const midiModuleEarly = before.match(/\.midi\s*\([\s\S]*?\{[\s\S]*?moduleId\s*:\s*(['"])([^'"]*)$/);
    if (midiModuleEarly) {
        const prefix = midiModuleEarly[2];
        return result(instanceItems(model), cursor - prefix.length, quotedContentEnd(source, cursor, midiModuleEarly[1]), prefix);
    }
    const midiParamEarly = before.match(/\.midi\s*\([\s\S]*?\{([\s\S]*?)paramId\s*:\s*(['"])([^'"]*)$/);
    if (midiParamEarly) {
        const moduleId = midiParamEarly[1].match(/moduleId\s*:\s*(['"])(.*?)\1/)?.[2];
        const prefix = midiParamEarly[3];
        return result(parameterItems(model.modules.get(moduleId), registry), cursor - prefix.length, quotedContentEnd(source, cursor, midiParamEarly[2]), prefix);
    }

    const connectSecond = before.match(/\.connect\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])([^'"]*)$/);
    if (connectSecond) {
        const prefix = connectSecond[4];
        return result(socketItems(model, registry, 'input'), cursor - prefix.length, quotedContentEnd(source, cursor, connectSecond[3]), prefix);
    }
    const connectFirst = before.match(/\.connect\s*\(\s*(['"])([^'"]*)$/);
    if (connectFirst) {
        const prefix = connectFirst[2];
        return result(socketItems(model, registry, 'output'), cursor - prefix.length, quotedContentEnd(source, cursor, connectFirst[1]), prefix);
    }

    const secondObjectPort = before.match(/\.connect\s*\([\s\S]*?\}\s*,\s*\{\s*module\s*:\s*(['"])(.*?)\1\s*,\s*port\s*:\s*(['"])([^'"]*)$/);
    if (secondObjectPort) {
        const prefix = secondObjectPort[4];
        return result(portsForInstance(model, registry, secondObjectPort[2], 'input'), cursor - prefix.length, quotedContentEnd(source, cursor, secondObjectPort[3]), prefix);
    }
    const firstObjectPort = before.match(/\.connect\s*\(\s*\{\s*module\s*:\s*(['"])(.*?)\1\s*,\s*port\s*:\s*(['"])([^'"]*)$/);
    if (firstObjectPort) {
        const prefix = firstObjectPort[4];
        return result(portsForInstance(model, registry, firstObjectPort[2], 'output'), cursor - prefix.length, quotedContentEnd(source, cursor, firstObjectPort[3]), prefix);
    }
    const secondObjectModule = before.match(/\.connect\s*\([\s\S]*?\}\s*,\s*\{\s*module\s*:\s*(['"])([^'"]*)$/);
    if (secondObjectModule) {
        const prefix = secondObjectModule[2];
        return result(instanceItems(model), cursor - prefix.length, quotedContentEnd(source, cursor, secondObjectModule[1]), prefix);
    }
    const firstObjectModule = before.match(/\.connect\s*\(\s*\{\s*module\s*:\s*(['"])([^'"]*)$/);
    if (firstObjectModule) {
        const prefix = firstObjectModule[2];
        return result(instanceItems(model), cursor - prefix.length, quotedContentEnd(source, cursor, firstObjectModule[1]), prefix);
    }

    const firstModuleType = before.match(/\.module\s*\(\s*(['"])([^'"]*)$/);
    if (firstModuleType) {
        const prefix = firstModuleType[2];
        return result(moduleItems(registry), cursor - prefix.length, quotedContentEnd(source, cursor, firstModuleType[1]), prefix);
    }
    const addType = before.match(/\.add\s*\(\s*(['"])([^'"]*)$/);
    if (addType) {
        const prefix = addType[2];
        return result(moduleItems(registry), cursor - prefix.length, quotedContentEnd(source, cursor, addType[1]), prefix);
    }
    const setParam = before.match(/\.set\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])([^'"]*)$/);
    if (setParam) {
        const prefix = setParam[4];
        return result(parameterItems(model.modules.get(setParam[2]), registry), cursor - prefix.length, quotedContentEnd(source, cursor, setParam[3]), prefix);
    }
    const setValue = before.match(/\.set\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*,\s*([^,)]*)$/);
    if (setValue) {
        const prefix = setValue[4].trim();
        const module = model.modules.get(setValue[2]);
        const control = controlsFor(module ? registry.get(module.type) : null).find(item => item.param === setValue[4]);
        const valuePrefix = setValue[5].trim();
        return result(valueItems(control), cursor - valuePrefix.length, scalarValueEnd(source, cursor), valuePrefix);
    }
    const setInstance = before.match(/\.set\s*\(\s*(['"])([^'"]*)$/);
    if (setInstance) {
        const prefix = setInstance[2];
        return result(instanceItems(model), cursor - prefix.length, quotedContentEnd(source, cursor, setInstance[1]), prefix);
    }

    const paramContext = findModuleParamContext(source, cursor, model, registry);
    if (paramContext) return result(paramContext.items, paramContext.from, paramContext.to, paramContext.prefix);

    const placement = before.match(/\.module\s*\([\s\S]*?,\s*\{[^}]*\}\s*,\s*\{\s*([a-z]*)$/i);
    if (placement) {
        return result([
            { label: 'name', insertText: 'name: ', detail: 'Optional module instance name; auto-generated when omitted' },
            { label: 'row', insertText: 'row: ', detail: 'Positive rack row' },
            { label: 'index', insertText: 'index: ', detail: 'Zero-based position within the row' }
        ], cursor - placement[1].length, cursor, placement[1]);
    }

    const midiField = before.match(/\.midi\s*\([\s\S]*?,\s*\{[\s\S]*?(?:^|,)\s*([a-z]*)$/i);
    if (midiField) {
        return result(['moduleId', 'paramId', 'min', 'max'].map(field => ({
            label: field,
            insertText: `${field}: `,
            detail: 'MIDI mapping field'
        })), cursor - midiField[1].length, cursor, midiField[1]);
    }

    const method = before.match(/(?:patch\(\)|\))\.([a-z]*)$/i);
    if (method) {
        return result(BUILDER_METHODS.map(name => ({ label: name, insertText: name, detail: 'Patch builder method' })), cursor - method[1].length, cursor, method[1]);
    }
    return { items: [], from: cursor, to: cursor };
}
