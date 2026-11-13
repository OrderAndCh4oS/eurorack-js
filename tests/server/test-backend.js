import { MemoryStore } from '../../server/memory-store.js';
import { MemoryImageStore, createLocalImageStore } from '../../server/local-image-store.js';
import { createHandler } from '../../server/handler.js';
import { createPatchService } from '../../server/patch-service.js';

// Imported only by an explicit test/dev harness. Production has no route, cookie or
// environment fallback that enables this identity provider.
export function createTestBackend({ baseUrl = 'http://127.0.0.1:4173', imageDirectory } = {}) {
    if (process.env.NODE_ENV !== 'test' || process.env.VERCEL) throw new Error('The test backend requires NODE_ENV=test and cannot run on Vercel.');
    const users = { alice: { id: 'fixture-alice', name: 'Alice' }, bob: { id: 'fixture-bob', name: 'Bob' } };
    const store = new MemoryStore();
    const imageStore = imageDirectory ? createLocalImageStore(imageDirectory) : new MemoryImageStore();
    const authenticate = async request => {
        const value = /(?:^|;\s*)eurorack-test-user=(alice|bob)(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1];
        return users[value] || null;
    };
    const service = createPatchService({ store, imageStore });
    return { handler: createHandler({ store, imageStore, authenticate, baseUrl, service }), service, store, imageStore, users };
}
