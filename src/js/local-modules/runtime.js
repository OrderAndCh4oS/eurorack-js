const LOCAL_PLUGIN = /^local-([0-7][0-9a-hjkmnp-tv-z]{25})$/;
const IMPORT_ERROR = 'Use a self-contained module with export default. Imports and re-exports are not supported.';

// This small lexical check enforces the supported authoring format, not a
// security boundary. The user's JavaScript is trusted application code.
export function assertSelfContainedSource(source) {
    if (typeof source !== 'string' || !source.trim()) throw new Error('Write a module with export default before using it.');
    let index = 0;
    let defaults = 0;
    const skipQuoted = quote => {
        index++;
        while (index < source.length) {
            if (source[index] === '\\') index += 2;
            else if (source[index++] === quote) return;
        }
    };
    const skipRegex = () => {
        index++;
        let characterClass = false;
        while (index < source.length) {
            const character = source[index++];
            if (character === '\\') index++;
            else if (character === '[') characterClass = true;
            else if (character === ']') characterClass = false;
            else if (character === '/' && !characterClass) break;
            else if (character === '\n') break;
        }
        while (/[a-z]/i.test(source[index] || '') && index < source.length) index++;
    };
    const code = (templateExpression = false) => {
        let braces = 0, regexAllowed = true, previous = '', exportDefault = false;
        const parentheses = [];
        while (index < source.length) {
            const character = source[index];
            if (/\s/.test(character)) { index++; continue; }
            if (source.startsWith('//', index)) { index = source.indexOf('\n', index + 2); if (index < 0) index = source.length; continue; }
            if (source.startsWith('/*', index)) { const end = source.indexOf('*/', index + 2); index = end < 0 ? source.length : end + 2; continue; }
            if (exportDefault && !source.startsWith('default', index)) throw new Error(IMPORT_ERROR);
            if (character === '"' || character === "'") { skipQuoted(character); regexAllowed = false; previous = 'literal'; continue; }
            if (character === '`') {
                index++;
                while (index < source.length) {
                    if (source[index] === '\\') { index += 2; continue; }
                    if (source[index] === '`') { index++; break; }
                    if (source.startsWith('${', index)) { index += 2; code(true); }
                    else index++;
                }
                regexAllowed = false; previous = 'literal'; continue;
            }
            if (character === '/' && regexAllowed) { skipRegex(); regexAllowed = false; previous = 'literal'; continue; }
            if (/[a-z_$]/i.test(character)) {
                const start = index++;
                while (index < source.length && /[a-z\d_$]/i.test(source[index])) index++;
                const word = source.slice(start, index);
                if (word === 'import' && previous !== '.') throw new Error(IMPORT_ERROR);
                if (word === 'export' && previous !== '.') { exportDefault = true; }
                else if (exportDefault) {
                    if (word !== 'default') throw new Error(IMPORT_ERROR);
                    defaults++; exportDefault = false;
                }
                regexAllowed = /^(return|throw|case|delete|void|typeof|instanceof|in|of|yield|await|else|do|new|default)$/.test(word);
                previous = word;
                continue;
            }
            index++;
            if (character === '(') parentheses.push(/^(if|while|for|with|switch|catch)$/.test(previous));
            if (character === '{') braces++;
            if (character === '}') {
                if (templateExpression && braces === 0) return;
                braces--;
            }
            regexAllowed = character === ')' ? !!parentheses.pop() : !/[\w\]}]/.test(character);
            previous = character;
        }
    };
    code();
    if (defaults !== 1) throw new Error('Export one default module definition before using it.');
}

export class LocalModuleRuntime {
    constructor({ store, registry, importModule = url => import(/* @vite-ignore */ url),
        createObjectURL = blob => URL.createObjectURL(blob), revokeObjectURL = url => URL.revokeObjectURL(url) } = {}) {
        this.store = store;
        this.registry = registry;
        this.importModule = importModule;
        this.createObjectURL = createObjectURL;
        this.revokeObjectURL = revokeObjectURL;
        this.loaded = new Map();
        this.pending = new Map();
        this.urls = new Set();
        this.disposed = false;
    }
    assertActive() { if (this.disposed) throw new Error('The local module runtime has been closed.'); }
    async activate(moduleId) {
        this.assertActive();
        const revision = await this.store.saveRevision(moduleId);
        this.assertActive();
        return this.loadRevision(revision);
    }
    async preparePatch(patch) {
        this.assertActive();
        const state = patch?.state || patch;
        if (!state?.plugins || typeof state.plugins !== 'object' || Array.isArray(state.plugins)) throw new Error('Patch dependencies are missing.');
        const dependencies = Object.entries(state.plugins);
        if (dependencies.length > 256) throw new Error('This patch has too many module dependencies.');
        const revisions = [];
        for (const [pluginId, version] of dependencies) {
            if (pluginId === 'core') continue;
            const match = LOCAL_PLUGIN.exec(pluginId);
            if (!match) {
                // Hosts may already have explicitly registered trusted plugins.
                // Leave version/ownership validation to the strict patch loader.
                if (this.registry.getPlugin(pluginId)) continue;
                throw new Error(`Patch requires unavailable plugin "${pluginId}".`);
            }
            if (version !== 1) throw new Error(`Local module "${pluginId}" requires an unsupported patch contract.`);
            const revision = this.store.getRevision(match[1].toUpperCase());
            if (!revision) throw new Error(`This patch needs a local module revision that is not saved in this browser: ${pluginId}.`);
            revisions.push(revision);
        }
        // Resolve all records before importing any code: a missing dependency
        // cannot trigger partial source execution or network fallback.
        for (const revision of revisions) await this.loadRevision(revision);
        this.assertActive();
        return state;
    }
    async loadRevision(revision) {
        this.assertActive();
        if (this.loaded.has(revision.id)) return this.loaded.get(revision.id);
        if (this.pending.has(revision.id)) return this.pending.get(revision.id);
        const pending = this.install(revision);
        this.pending.set(revision.id, pending);
        try { return await pending; }
        finally { if (this.pending.get(revision.id) === pending) this.pending.delete(revision.id); }
    }
    async install(revision) {
        const type = `local-${revision.id.toLowerCase()}`;
        if (!LOCAL_PLUGIN.test(type)) throw new Error('The local module revision ID is invalid.');
        if (this.registry.getPlugin(type)) throw new Error('This local module revision is already registered outside this library.');
        assertSelfContainedSource(revision.source);
        const urls = [];
        const urlFor = source => {
            const url = this.createObjectURL(new Blob([source], { type: 'text/javascript' }));
            urls.push(url); this.urls.add(url); return url;
        };
        let manifest;
        try {
            const sourceUrl = urlFor(revision.source);
            const imported = await this.importModule(sourceUrl);
            this.assertActive();
            if (!imported.default || typeof imported.default !== 'object' || Array.isArray(imported.default)) throw new Error('Export a default module definition object.');
            const definition = { ...imported.default, id: type, name: revision.name };
            const workletUrl = urlFor(`import source from ${JSON.stringify(sourceUrl)};\n` +
                `const definition = { ...source, id: ${JSON.stringify(type)}, name: ${JSON.stringify(revision.name)} };\n` +
                `globalThis.registerEurorackWorkletPlugin({ id: ${JSON.stringify(type)}, apiVersion: 1, patchVersion: 1, modules: new Map([[${JSON.stringify(type)}, definition]]) });\n`);
            manifest = { id: type, name: revision.name, version: revision.id, apiVersion: 1, patchVersion: 1, workletUrl,
                modules: [{ id: type, definition }] };
            await this.registry.registerPlugin(manifest);
            this.assertActive();
            const result = { type, pluginId: type, revision, definition };
            this.loaded.set(revision.id, result);
            return result;
        } catch (error) {
            if (manifest && this.registry.getPlugin(type)?.manifest === manifest) {
                try { this.registry.unregisterPlugin(type); } catch { /* Preserve an already-used registration. */ }
            }
            // If a registry listener put the definition into use, its worklet
            // still needs these URLs. Keep them until application disposal.
            const retained = manifest && this.registry.getPlugin(type)?.manifest === manifest;
            if (!retained) for (const url of urls) {
                if (this.urls.delete(url)) this.revokeObjectURL(url);
            }
            throw error;
        }
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const url of this.urls) this.revokeObjectURL(url);
        this.urls.clear();
        this.loaded.clear();
    }
}
