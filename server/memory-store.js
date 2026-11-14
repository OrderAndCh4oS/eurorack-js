// Explicit dependency for tests/local integration only. Production never imports this adapter.
export class MemoryStore {
    constructor() { this.data = { patches: new Map(), requests: new Map(), previews: new Map(), garbage: new Set(), likes: new Map(), rates: new Map() }; this.queue = Promise.resolve(); }
    async transaction(work) {
        const previous = this.queue;
        let release;
        this.queue = new Promise(resolve => { release = resolve; });
        await previous;
        const before = structuredClone(this.data);
        try { return await work(this); } catch (error) { this.data = before; throw error; } finally { release(); }
    }
    async getPatch(id) { return structuredClone(this.data.patches.get(id)); }
    async putPatch(record) {
        this.data.patches.set(record.id, structuredClone(record));
        this.data.requests.set(`${record.ownerId}:${record.requestId}`, { id: record.id, requestHash: record.requestHash });
    }
    async deletePatch(id) { this.data.patches.delete(id); this.data.likes.delete(id); }
    async findRequest(ownerId, requestId) {
        const request = this.data.requests.get(`${ownerId}:${requestId}`);
        return request ? structuredClone(this.data.patches.get(request.id) || { ...request, deleted: true }) : undefined;
    }
    async listPatches({ ownerId, publicOnly, query = '', sort, asOf, since, direction, boundary, limit }) {
        const compare = (a, b) => b.popularityCount - a.popularityCount || b.id.localeCompare(a.id);
        const records = [...this.data.patches.values()]
            .filter(p => (!ownerId || p.ownerId === ownerId) && (!publicOnly || p.visibility === 'public') && p.createdAt <= asOf && `${p.name} ${p.description} ${p.authorName}`.toLowerCase().includes(query.toLowerCase()))
            .map(p => ({ ...p, popularityCount: sort === 'popular' ? [...(this.data.likes.get(p.id)?.values() || [])].filter(time => time <= asOf && (!since || time >= since)).length : 0 }))
            .filter(p => !boundary || (direction === 'previous' ? compare(p, { id: boundary.id, popularityCount: boundary.score }) < 0 : compare(p, { id: boundary.id, popularityCount: boundary.score }) > 0))
            .sort((a, b) => direction === 'previous' ? compare(b, a) : compare(a, b));
        return structuredClone(records.slice(0, limit));
    }
    async totals(ownerId) {
        const patches = [...this.data.patches.values()].filter(p => p.ownerId === ownerId);
        const previews = [...this.data.previews.values()].filter(p => p.ownerId === ownerId);
        return { count: patches.length, stateBytes: patches.reduce((n, p) => n + p.stateBytes, 0), imageBytes: previews.reduce((n, p) => n + p.bytes, 0) };
    }
    async getPreview(id) { return structuredClone(this.data.previews.get(id)); }
    async putPreview(record) { this.data.previews.set(record.id, structuredClone(record)); }
    async deletePreview(id) { this.data.previews.delete(id); }
    async previewReferences(id) { return [...this.data.patches.values()].filter(p => p.previewId === id).length; }
    async listPreviews() { return structuredClone([...this.data.previews.values()]); }
    async objectReferences(key) { return [...this.data.previews.values()].filter(p => Object.values(p.variants).some(v => v.key === key)).length; }
    async addGarbage(key) { this.data.garbage.add(key); }
    async listGarbage() { return [...this.data.garbage]; }
    async garbageCount() { return this.data.garbage.size; }
    async deleteGarbage(key) { this.data.garbage.delete(key); }
    async setLike(patchId, userId, liked, createdAt = new Date().toISOString()) {
        const users = this.data.likes.get(patchId) || new Map();
        if (liked) { if (!users.has(userId)) users.set(userId, createdAt); } else users.delete(userId);
        this.data.likes.set(patchId, users);
    }
    async likes(patchId, userId) { const users = this.data.likes.get(patchId) || new Map(); return { likeCount: users.size, likedByMe: users.has(userId) }; }
    async consumeRate(key, bucket, maximum) {
        const fullKey = `${key}:${bucket}`;
        const count = (this.data.rates.get(fullKey) || 0) + 1;
        this.data.rates.set(fullKey, count); return count <= maximum;
    }
}
