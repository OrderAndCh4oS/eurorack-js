import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

// For explicit local integration only; never selected by the production handler.
export function createLocalImageStore(directory) {
    const root = resolve(directory);
    function path(key) {
        const file = resolve(root, key);
        if (!file.startsWith(`${root}${sep}`)) throw new Error('Invalid image key');
        return file;
    }
    return {
        async put(key, body) { const file = path(key); await mkdir(dirname(file), { recursive: true }); await writeFile(file, body); },
        async get(key) { return readFile(path(key)); },
        async delete(key) { await unlink(path(key)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    };
}
export class MemoryImageStore {
    constructor() { this.objects = new Map(); }
    async put(key, body) { this.objects.set(key, Buffer.from(body)); }
    async get(key) { const body = this.objects.get(key); if (!body) throw new Error('Image missing'); return Buffer.from(body); }
    async delete(key) { this.objects.delete(key); }
}
