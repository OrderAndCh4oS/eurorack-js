export const PATCH_SCRIPT_STORAGE_KEY = 'eurorack-patch-scripts';
export const PATCH_SCRIPT_STORAGE_VERSION = 1;

function createId() {
    return globalThis.crypto?.randomUUID?.() || `script-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class PatchScriptStore {
    constructor(storage = globalThis.localStorage) {
        this.storage = storage;
        this.data = this.load();
    }

    load() {
        try {
            const parsed = JSON.parse(this.storage?.getItem(PATCH_SCRIPT_STORAGE_KEY) || 'null');
            if (parsed?.version === PATCH_SCRIPT_STORAGE_VERSION && Array.isArray(parsed.scripts)) return parsed;
        } catch {
            // Replace malformed storage with a clean bank.
        }
        return { version: PATCH_SCRIPT_STORAGE_VERSION, activeScriptId: null, scripts: [] };
    }

    persist() {
        try {
            this.storage?.setItem(PATCH_SCRIPT_STORAGE_KEY, JSON.stringify(this.data));
        } catch {
            // Keep the in-memory bank usable when browser storage is unavailable.
        }
    }

    list() {
        return this.data.scripts.map(script => ({ ...script }));
    }

    get(id) {
        const script = this.data.scripts.find(item => item.id === id);
        return script ? { ...script } : null;
    }

    create(name, source) {
        const now = new Date().toISOString();
        const script = { id: createId(), name: name?.trim() || 'Untitled Script', source: String(source || ''), created: now, updated: now };
        this.data.scripts.push(script);
        this.data.activeScriptId = script.id;
        this.persist();
        return { ...script };
    }

    update(id, changes) {
        const script = this.data.scripts.find(item => item.id === id);
        if (!script) return null;
        if (typeof changes.name === 'string' && changes.name.trim()) script.name = changes.name.trim();
        if (typeof changes.source === 'string') script.source = changes.source;
        script.updated = new Date().toISOString();
        this.data.activeScriptId = id;
        this.persist();
        return { ...script };
    }

    remove(id) {
        const before = this.data.scripts.length;
        this.data.scripts = this.data.scripts.filter(item => item.id !== id);
        if (this.data.activeScriptId === id) this.data.activeScriptId = this.data.scripts[0]?.id || null;
        if (before !== this.data.scripts.length) this.persist();
        return before !== this.data.scripts.length;
    }

    setActive(id) {
        if (!this.data.scripts.some(item => item.id === id)) return false;
        this.data.activeScriptId = id;
        this.persist();
        return true;
    }
}
