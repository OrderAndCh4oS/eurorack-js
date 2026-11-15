import { newRequestId } from '../patches/cloud-client.js';

export const LOCAL_MODULE_STORAGE_KEY = 'eurorack-local-modules-v1';
export const LOCAL_MODULE_LIMITS = Object.freeze({ sourceBytes: 256 * 1024, totalBytes: 2 * 1024 * 1024, modules: 64 });
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const copy = value => value === null ? null : JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(value).byteLength;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

function fields({ name, source }) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
        throw new Error('Use a module name between 1 and 80 characters.');
    }
    if (typeof source !== 'string') throw new Error('Module source must be text.');
    if (bytes(source) > LOCAL_MODULE_LIMITS.sourceBytes) throw new Error('Module source exceeds 256 KiB.');
    return { name: name.trim(), source };
}

function validateData(value) {
    if (!plain(value) || value.version !== 1 || !Array.isArray(value.modules) || value.modules.length > LOCAL_MODULE_LIMITS.modules) throw new Error('Invalid module collection');
    const ids = new Set();
    const identifier = id => {
        if (typeof id !== 'string' || !ULID.test(id) || ids.has(id)) throw new Error('Invalid or duplicate module ID');
        ids.add(id);
    };
    const timestamp = value => {
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid module timestamp');
    };
    for (const record of value.modules) {
        if (!plain(record) || !Array.isArray(record.revisions)) throw new Error('Invalid module record');
        identifier(record.id); fields(record); timestamp(record.createdAt); timestamp(record.updatedAt);
        for (const revision of record.revisions) {
            if (!plain(revision) || revision.moduleId !== record.id) throw new Error('Invalid module revision');
            identifier(revision.id); fields(revision); timestamp(revision.createdAt);
        }
    }
    return value;
}

// Draft text is inert. Only the separate runtime imports a revision, when the
// user chooses Use or opens a patch that already references their local code.
export class LocalModuleStore {
    constructor({ storage, createId = newRequestId } = {}) {
        this.suppliedStorage = storage;
        this.createId = createId;
        this.listeners = new Set();
    }
    get storage() { return this.suppliedStorage || globalThis.localStorage; }
    read() {
        try {
            const raw = this.storage.getItem(LOCAL_MODULE_STORAGE_KEY);
            if (raw === null) return { version: 1, modules: [] };
            if (typeof raw !== 'string' || bytes(raw) > LOCAL_MODULE_LIMITS.totalBytes) throw new Error('Invalid module storage');
            return validateData(JSON.parse(raw));
        } catch (cause) {
            throw new Error('Could not read your local modules. Saved data has not been changed.', { cause });
        }
    }
    list() { return copy(this.read().modules); }
    get(id) { return copy(this.read().modules.find(record => record.id === id) || null); }
    getRevision(id) {
        for (const record of this.read().modules) {
            const revision = record.revisions.find(revision => revision.id === id);
            if (revision) return copy(revision);
        }
        return null;
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    write(data, type, record) {
        validateData(data);
        const serialized = JSON.stringify(data);
        if (bytes(serialized) > LOCAL_MODULE_LIMITS.totalBytes) throw new Error('Local module storage exceeds 2 MiB. Your previous modules are unchanged.');
        try { this.storage.setItem(LOCAL_MODULE_STORAGE_KEY, serialized); }
        catch (cause) { throw new Error('Could not save your local module. Your previous modules are unchanged.', { cause }); }
        // Subscribers only observe successful writes. Each receives its own copy.
        for (const listener of this.listeners) {
            try { listener({ type, moduleId: record.id, record: copy(record) }); }
            catch (error) { console.error('Local module update listener failed', error); }
        }
        return copy(record);
    }
    async nextId(data) {
        const id = await this.createId();
        if (typeof id !== 'string' || !ULID.test(id)) throw new Error('Could not create a valid module ID.');
        if (data.modules.some(record => record.id === id || record.revisions.some(revision => revision.id === id))) throw new Error('A module ID already exists. Try again.');
        return id;
    }
    async create(input) {
        const draft = fields(input);
        const id = await this.nextId(this.read());
        const data = this.read();
        if (data.modules.length >= LOCAL_MODULE_LIMITS.modules) throw new Error('This browser already has 64 local modules.');
        const time = new Date().toISOString();
        const record = { id, ...draft, createdAt: time, updatedAt: time, revisions: [] };
        data.modules.push(record);
        return this.write(data, 'created', record);
    }
    save(id, changes) {
        const data = this.read();
        const record = data.modules.find(record => record.id === id);
        if (!record) throw new Error('This local module could not be found.');
        Object.assign(record, fields({ name: changes.name ?? record.name, source: changes.source ?? record.source }), { updatedAt: new Date().toISOString() });
        return this.write(data, 'saved', record);
    }
    async saveRevision(moduleId) {
        const snapshot = this.get(moduleId);
        if (!snapshot) throw new Error('This local module could not be found.');
        const matches = revision => revision.name === snapshot.name && revision.source === snapshot.source;
        const existing = snapshot.revisions.find(matches);
        if (existing) return copy(existing);
        const id = await this.nextId(this.read());
        const data = this.read();
        const record = data.modules.find(record => record.id === moduleId);
        if (!record || record.name !== snapshot.name || record.source !== snapshot.source) throw new Error('The module changed while preparing it. Use the module again.');
        // Another activation may have saved this same draft while ID creation awaited.
        const concurrent = record.revisions.find(matches);
        if (concurrent) return copy(concurrent);
        const revision = { id, moduleId, name: record.name, source: record.source, createdAt: new Date().toISOString() };
        record.revisions.push(revision);
        this.write(data, 'revision-saved', record);
        return copy(revision);
    }
}
