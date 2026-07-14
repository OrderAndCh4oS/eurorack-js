function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function assertText(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${label} must be a non-empty string`);
    }
    return value;
}

export class PatchScriptBuilder {
    constructor() {
        this.modules = [];
        this.moduleById = new Map();
        this.connections = [];
        this.midiMappings = {};
        this.typeCounters = {};
    }

    reserveId(type, id) {
        const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = id.match(new RegExp(`^${escaped}_(\\d+)$`));
        this.typeCounters[type] = Math.max(this.typeCounters[type] || 0, match ? Number(match[1]) : 0);
    }

    nextId(type) {
        let id;
        do {
            this.typeCounters[type] = (this.typeCounters[type] || 0) + 1;
            id = `${type}_${this.typeCounters[type]}`;
        } while (this.moduleById.has(id));
        return id;
    }

    declareModule(id, type, params = {}, placement = {}) {
        assertText(id, 'Module instance ID');
        assertText(type, 'Module type');
        if (!isPlainObject(params)) throw new Error(`Module "${id}" params must be an object`);
        if (!isPlainObject(placement)) throw new Error(`Module "${id}" placement must be an object`);
        if (this.moduleById.has(id)) throw new Error(`Module instance "${id}" is declared more than once`);

        const module = {
            id,
            type,
            params: cloneValue(params),
            placement: cloneValue(placement)
        };
        this.modules.push(module);
        this.moduleById.set(id, module);
        this.reserveId(type, id);
        return id;
    }

    resolveModuleName(type, options) {
        const { name = null, id = null } = options;
        if (name !== null && id !== null && name !== id) {
            throw new Error(`Module "${type}" options cannot declare different name and id values`);
        }
        const explicitName = name ?? id;
        return explicitName === null ? this.nextId(type) : assertText(explicitName, 'Module instance name');
    }

    module(type, nameOrParams = {}, paramsOrOptions = {}, namedPlacement = {}) {
        assertText(type, 'Module type');
        const named = typeof nameOrParams === 'string';
        const params = named ? paramsOrOptions : nameOrParams;
        const options = named ? { ...namedPlacement, name: nameOrParams } : paramsOrOptions;
        if (!isPlainObject(params)) throw new Error(`Module "${type}" params must be an object`);
        if (!isPlainObject(options)) throw new Error(`Module "${type}" options must be an object`);
        const placement = Object.fromEntries(
            Object.entries({ row: options.row, index: options.index }).filter(([, value]) => value !== undefined)
        );
        this.declareModule(this.resolveModuleName(type, options), type, params, placement);
        return this;
    }

    add(type, params = {}, options = {}) {
        assertText(type, 'Module type');
        if (!isPlainObject(options)) throw new Error(`Module "${type}" options must be an object`);
        const placement = Object.fromEntries(
            Object.entries({ row: options.row, index: options.index }).filter(([, value]) => value !== undefined)
        );
        return this.declareModule(this.resolveModuleName(type, options), type, params, placement);
    }

    port(module, port) {
        return { module: assertText(module, 'Module instance ID'), port: assertText(port, 'Port ID') };
    }

    set(id, paramOrValues, value) {
        const module = this.moduleById.get(assertText(id, 'Module instance ID'));
        if (!module) throw new Error(`Module instance "${id}" must be declared before set()`);

        if (isPlainObject(paramOrValues) && arguments.length === 2) {
            Object.assign(module.params, cloneValue(paramOrValues));
            return this;
        }
        assertText(paramOrValues, 'Parameter ID');
        module.params[paramOrValues] = cloneValue(value);
        return this;
    }

    connect(from, to) {
        this.connections.push({ from: cloneValue(from), to: cloneValue(to) });
        return this;
    }

    midi(key, mapping) {
        assertText(key, 'MIDI mapping key');
        if (!isPlainObject(mapping)) throw new Error(`MIDI mapping "${key}" must be an object`);
        this.midiMappings[key] = cloneValue(mapping);
        return this;
    }

    describe() {
        return {
            modules: this.modules.map(module => cloneValue(module)),
            connections: this.connections.map(connection => cloneValue(connection)),
            midiMappings: cloneValue(this.midiMappings)
        };
    }
}

export function executePatchScript(source) {
    if (typeof source !== 'string') throw new Error('Patch script source must be a string');
    const builders = [];
    const patch = () => {
        const builder = new PatchScriptBuilder();
        builders.push(builder);
        if (builders.length > 1) throw new Error('A patch script must create exactly one patch() builder');
        return builder;
    };

    const evaluate = new Function('patch', `"use strict";\n${source}\n//# sourceURL=eurorack-patch-script.js`);
    evaluate(patch);
    if (builders.length === 0) throw new Error('A patch script must call patch() exactly once');
    return builders[0].describe();
}
