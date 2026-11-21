const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
let vendor;
export const loadCloudVendor = () => {
    const url = new URL('../../vendor/cloud.js', import.meta.url).href;
    return (vendor ||= import(/* @vite-ignore */ url));
};
export async function newRequestId() { return (await loadCloudVendor()).ulid(); }

export async function uploadThemedPreview(cloud, state, preview, assertCurrent = () => {}) {
    const light = await preview.capturePatchPreview(state, { mode: 'light' });
    assertCurrent();
    const darkImage = await preview.capturePatchPreview(state, { mode: 'dark' });
    assertCurrent();
    return cloud.uploadPreview(state, light, { darkImage, theme: 'industrial', rendererVersion: preview.PATCH_PREVIEW_RENDERER_VERSION });
}
export function savedPatchUrl(id, base = globalThis.location?.origin) {
    if (!ULID_PATTERN.test(id)) throw new Error('This patch link is invalid.');
    return new URL(`/patches/${id}`, base).href;
}
export function rackPatchUrl(id, base = globalThis.location?.origin) {
    return savedPatchUrl(id, base);
}
export function parsePatchLocation(hash, pathname = '') {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const savedPath = /^\/patches\/([^/]+)\/?$/.exec(pathname);
    const sources = ['saved', 'patch', 'local'].filter(key => params.has(key));
    if (sources.length + Number(!!savedPath) > 1) throw new Error('This link points to more than one patch. Copy a new link and try again.');
    if (savedPath) {
        const id = savedPath[1];
        if (!ULID_PATTERN.test(id)) throw new Error('This patch link is invalid.');
        return { source: 'cloud', id };
    }
    if (params.has('saved')) {
        const id = params.get('saved');
        if (!ULID_PATTERN.test(id)) throw new Error('This patch link is invalid.');
        return { source: 'cloud', id };
    }
    if (params.has('local')) {
        const id = params.get('local'); if (!ULID_PATTERN.test(id)) throw new Error('This patch link is invalid.');
        return { source: 'local', id };
    }
    return params.has('patch') ? { source: 'snapshot' } : null;
}
export class CloudError extends Error {
    constructor(message, status, code) { super(message); this.name = 'CloudError'; this.status = status; this.code = code; }
}
const READ_TIMEOUT_MS = 15000;
const READ_RETRY_DELAYS = [500, 1500];
const aborted = signal => signal.reason || new DOMException('The request was cancelled.', 'AbortError');
const transientReadError = error => error.name === 'TypeError' ||
    (error instanceof CloudError && error.code !== 'cloud_not_configured' &&
        (error.status === 408 || error.status >= 500 && error.status < 600));
function waitForRetry(delay, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(aborted(signal)); return; }
        const onAbort = () => { clearTimeout(timer); reject(aborted(signal)); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, delay);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
export class CloudClient {
    constructor({ fetch = globalThis.fetch?.bind(globalThis), vendorLoader = loadCloudVendor } = {}) {
        this.fetch = fetch; this.vendorLoader = vendorLoader; this.pending = new Set();
    }
    cancel() { for (const controller of this.pending) controller.abort(); this.pending.clear(); }
    async request(path, { method = 'GET', body, signal } = {}) {
        const controller = new AbortController(); this.pending.add(controller);
        const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) controller.abort();
        const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
        try {
            // Retry only reads: a failed save may already have reached the server.
            // Keep one operation registered through backoff so cancel() also stops
            // a retry that has not yet sent its next request.
            for (let attempt = 0; ; attempt++) {
                if (controller.signal.aborted) throw aborted(controller.signal);
                const attemptController = new AbortController(); let timedOut = false;
                const cancelAttempt = () => attemptController.abort();
                controller.signal.addEventListener('abort', cancelAttempt, { once: true });
                const timer = method === 'GET' ? setTimeout(() => { timedOut = true; attemptController.abort(); }, READ_TIMEOUT_MS) : null;
                try {
                    const response = await this.fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal: attemptController.signal,
                        ...(body === undefined ? {} : { headers: multipart ? {} : { 'Content-Type': 'application/json' }, body: multipart ? body : JSON.stringify(body) }) });
                    let data; try { data = await response.json(); } catch (error) {
                        if (attemptController.signal.aborted) throw error;
                        throw new CloudError('Saved patches are unavailable. Try again later.', response.status, 'unavailable');
                    }
                    if (controller.signal.aborted) throw aborted(controller.signal);
                    if (!response.ok) throw new CloudError(data.error?.message || 'The request could not be completed.', response.status, data.error?.code);
                    return data;
                } catch (error) {
                    if (controller.signal.aborted) throw aborted(controller.signal);
                    if (timedOut) error = new CloudError('Saved patches are taking too long to respond. Try again.', 408, 'request_timeout');
                    if (method !== 'GET' || attempt >= READ_RETRY_DELAYS.length || !transientReadError(error)) throw error;
                } finally {
                    clearTimeout(timer); controller.signal.removeEventListener('abort', cancelAttempt);
                }
                await waitForRetry(READ_RETRY_DELAYS[attempt], controller.signal);
            }
        } finally { this.pending.delete(controller); signal?.removeEventListener('abort', abort); }
    }
    async configuration() {
        try { return await this.request('/api/config'); }
        catch (error) { if (error.name === 'AbortError') throw error; return { enabled: false, authEnabled: false, imagesEnabled: false }; }
    }
    me() { return this.request('/api/me'); }
    updateProfile(name) { return this.request('/api/me', { method: 'PATCH', body: { name } }); }
    list({ publicOnly = false, cursor, query = '', sort = 'newest', period = 'all' } = {}, { signal } = {}) {
        const params = new URLSearchParams(); if (cursor) params.set('cursor', cursor); if (query) params.set('q', query);
        if (publicOnly) { params.set('sort', sort); params.set('period', period); }
        return this.request(`/api/${publicOnly ? 'public-patches' : 'patches'}?${params}`, { signal });
    }
    get(id) { return this.request(`/api/patches/${id}`); }
    ensurePreviews(id, signal) { return this.request(`/api/patches/${id}/previews`, { method: 'POST', signal }); }
    create(body) { return this.request('/api/patches', { method: 'POST', body }); }
    update(id, body) { return this.request(`/api/patches/${id}`, { method: 'PUT', body }); }
    copy(id, body) { return this.request(`/api/patches/${id}/copies`, { method: 'POST', body }); }
    visibility(id, body) { return this.request(`/api/patches/${id}/visibility`, { method: 'PUT', body }); }
    remove(id, expectedRevision) { return this.request(`/api/patches/${id}`, { method: 'DELETE', body: { expectedRevision } }); }
    like(id, liked) { return this.request(`/api/patches/${id}/like`, { method: 'PUT', body: { liked } }); }
    uploadPreview(state, blob, { darkImage, theme = 'industrial-light', rendererVersion = 'rack-v1' } = {}) {
        const body = new FormData(); body.append('image', blob, 'rack.png'); body.append('state', JSON.stringify(state));
        if (darkImage) body.append('darkImage', darkImage, 'rack-dark.png');
        body.append('theme', theme); body.append('rendererVersion', rendererVersion);
        return this.request('/api/patch-previews', { method: 'POST', body });
    }
    async auth() { return (this.authClient ||= (await this.vendorLoader()).createAuthClient({ basePath: '/api/auth' })); }
    async signIn(callbackURL = globalThis.location.href) {
        const result = await (await this.auth()).signIn.social({ provider: 'google', callbackURL });
        if (result.error) throw new Error(result.error.message || 'Could not sign in. Try again.');
        return result;
    }
    async sendEmailLink(email) {
        const { error } = await (await this.auth()).signIn.magicLink({ email });
        if (error) throw new Error(error.message || 'Could not send the sign-in link. Try again.');
    }
    async confirmEmailLink(token) {
        const { error } = await (await this.auth()).magicLink.confirm({ token });
        if (error) throw new Error(error.message || 'Could not sign in. Request a new link.');
    }
    async signOut() {
        const result = await (await this.auth()).signOut();
        if (result.error) throw new Error(result.error.message || 'Could not sign out. Try again.');
        this.cancel();
    }
}
