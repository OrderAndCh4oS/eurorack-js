import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODULE_MANIFEST } from '../../src/js/rack/module-manifest.js';
import { ModuleSourceBrowser } from '../../src/js/patch-script/module-source-browser.js';

const mounted = [];
const sourceResponse = source => ({ ok: true, text: async () => source });

function deferred() {
    let resolve;
    const promise = new Promise(next => { resolve = next; });
    return { promise, resolve };
}

function localStore(initial = []) {
    let records = initial.map(record => ({ ...record }));
    const listeners = new Set();
    const store = {
        list: () => records.map(record => ({ ...record })),
        get: id => records.find(record => record.id === id),
        emit: () => listeners.forEach(listener => listener()),
        unsubscribe: vi.fn(),
        subscribe: listener => {
            listeners.add(listener);
            return () => { listeners.delete(listener); store.unsubscribe(); };
        },
        create: vi.fn(async draft => {
            const record = { id: `draft-${records.length + 1}`, ...draft };
            records = [...records, record];
            store.emit();
            return { ...record };
        }),
        save: vi.fn((id, values) => {
            const record = { ...store.get(id), ...values };
            records = records.map(item => item.id === id ? record : item);
            store.emit();
            return { ...record };
        })
    };
    return store;
}

function createBrowser(options = {}) {
    const fetch = vi.fn(async () => sourceResponse('export default { id: "example" };'));
    const browser = new ModuleSourceBrowser({
        document,
        registry: { get: id => ({ id, name: id === 'vco' ? 'Oscillator' : id }) },
        fetch,
        copy: vi.fn(async () => {}),
        ...options
    });
    browser.mount(document.body);
    mounted.push(browser);
    return browser;
}

beforeEach(() => {
    document.body.replaceChildren();
    delete globalThis.__moduleSourceExecuted;
});

afterEach(() => {
    for (const browser of mounted.splice(0)) browser.dispose();
    delete globalThis.__moduleSourceExecuted;
});

describe('ModuleSourceBrowser', () => {
    it('lists every built-in without fetching until activated, then fetches only the selection', async () => {
        const browser = createBrowser();
        await browser.refresh();
        expect(browser.list.querySelectorAll('[data-source-kind="builtin"]')).toHaveLength(MODULE_MANIFEST.length);
        expect(browser.fetch).not.toHaveBeenCalled();
        await browser.activate();
        expect(browser.fetch).toHaveBeenCalledTimes(1);
        const [url] = browser.fetch.mock.calls[0];
        expect(url.pathname).toMatch(/\/src\/js\/modules\/midi-cv\/index\.js$/);
        expect(browser.code.textContent).toBe('export default { id: "example" };');
        expect(browser.githubLink.href).toBe('https://github.com/OrderAndCh4oS/eurorack-js/blob/main/src/js/modules/midi-cv/index.js');
        expect(browser.pre.getAttribute('aria-label')).toBe('Module source');
        expect(browser.pre.tabIndex).toBe(0);
    });

    it('shows only the user’s stored source first and never runs it while browsing', async () => {
        const source = `globalThis.__moduleSourceExecuted = true;\nexport default '<img src=x onerror="alert(1)">';`;
        const store = localStore([{ id: 'mine', name: '<script>Mine</script>', source }]);
        const browser = createBrowser({ localStore: store });
        await browser.activate();
        const buttons = [...browser.list.querySelectorAll('[data-module-source]')];
        expect(buttons[0].dataset.sourceKind).toBe('local');
        expect(buttons[0].textContent).toContain('<script>Mine</script>');
        expect(browser.editor.value).toBe(source);
        expect(browser.editor.hidden).toBe(false);
        expect(browser.pre.hidden).toBe(true);
        expect(browser.root.querySelector('img, script')).toBeNull();
        expect(globalThis.__moduleSourceExecuted).toBeUndefined();
        expect(browser.fetch).not.toHaveBeenCalled();
        expect(browser.githubLink.hidden).toBe(true);
        expect(browser.githubLink.hasAttribute('href')).toBe(false);
    });

    it('searches names and IDs without fetching or losing the current selection', async () => {
        const browser = createBrowser();
        await browser.activate();
        browser.search.value = 'oscillator';
        browser.search.dispatchEvent(new Event('input'));
        expect(browser.list.querySelectorAll('[data-module-source]')).toHaveLength(1);
        expect(browser.list.querySelector('button').dataset.moduleSource).toBe('vco');
        browser.search.value = 'does-not-exist';
        browser.search.dispatchEvent(new Event('input'));
        expect(browser.list.textContent).toBe('No matching modules.');
        expect(browser.selectedKey).toBe('builtin:midi-cv');
        expect(browser.fetch).toHaveBeenCalledTimes(1);
        browser.focus();
        expect(document.activeElement).toBe(browser.search);
    });

    it('caches successful built-in responses and ignores arbitrary source IDs', async () => {
        const browser = createBrowser();
        await browser.select('vco');
        await browser.select('lfo');
        await browser.select('vco');
        expect(browser.fetch).toHaveBeenCalledTimes(2);
        expect(await browser.select('../../outside')).toBe(false);
        expect(await browser.select('https://evil.example/custom.js')).toBe(false);
        expect(browser.fetch).toHaveBeenCalledTimes(2);
        expect(browser.list.querySelector('[data-module-source="vco"]').getAttribute('aria-pressed')).toBe('true');
    });

    it('keeps the latest selection when fetches finish out of order and reuses in-flight requests', async () => {
        const vco = deferred();
        const lfo = deferred();
        const browser = createBrowser({ fetch: vi.fn(url => url.pathname.includes('/vco/') ? vco.promise : lfo.promise) });
        const first = browser.select('vco');
        const repeated = browser.select('vco');
        const latest = browser.select('lfo');
        expect(browser.fetch).toHaveBeenCalledTimes(2);
        lfo.resolve(sourceResponse('// lfo'));
        await latest;
        vco.resolve(sourceResponse('// vco'));
        await Promise.all([first, repeated]);
        expect(browser.code.textContent).toBe('// lfo');
        await browser.select('vco');
        expect(browser.code.textContent).toBe('// vco');
        expect(browser.fetch).toHaveBeenCalledTimes(2);
    });

    it('offers a retry after failure and does not cache an HTML fallback page', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, headers: { get: () => 'text/html' }, text: async () => '<html>App</html>' })
            .mockResolvedValueOnce(sourceResponse('// loaded'));
        const browser = createBrowser({ fetch });
        expect(await browser.select('vco')).toBe(false);
        expect(browser.status.textContent).toBe('Could not load source.');
        expect(browser.copyButton.disabled).toBe(true);
        expect(browser.retryButton.hidden).toBe(false);
        browser.retryButton.click();
        await vi.waitFor(() => expect(browser.code.textContent).toBe('// loaded'));
        expect(browser.retryButton.hidden).toBe(true);
        expect(browser.copyButton.disabled).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('escapes built-in source markup and copies exact whitespace with clear clipboard failures', async () => {
        const source = `// <img src=x>\nexport default { value: '<script>no</script>' };\n\n`;
        const copy = vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('Denied'));
        const browser = createBrowser({ fetch: vi.fn(async () => sourceResponse(source)), copy });
        await browser.select('vco');
        expect(browser.code.textContent).toBe(source);
        expect(browser.code.querySelector('img, script')).toBeNull();
        expect(browser.code.querySelector('.syntax-keyword')).not.toBeNull();
        expect(await browser.copySource()).toBe(true);
        expect(copy).toHaveBeenCalledWith(source);
        expect(browser.status.textContent).toBe('Copied code.');
        expect(await browser.copySource()).toBe(false);
        expect(browser.status.textContent).toBe('Could not copy code.');
        expect(browser.status.dataset.kind).toBe('error');
    });

    it('creates a local draft without running it or fetching built-in source', async () => {
        const store = localStore();
        const onUse = vi.fn();
        const browser = createBrowser({ localStore: store, onUse });
        expect(await browser.createModule()).toBe(true);
        expect(store.create).toHaveBeenCalledOnce();
        expect(browser.selectedKey).toBe('local:draft-1');
        expect(browser.editor.value).toContain('export default');
        expect(browser.editor.value).toContain('createDSP');
        expect(browser.editor.value).not.toMatch(/^import /m);
        expect(browser.nameInput.value).toBe('My module');
        expect(onUse).not.toHaveBeenCalled();
        expect(browser.fetch).not.toHaveBeenCalled();
    });

    it('imports a source file as an inert editable draft and rejects oversized files before reading', async () => {
        const store = localStore();
        const onUse = vi.fn();
        const browser = createBrowser({ localStore: store, onUse });
        const source = 'globalThis.__moduleSourceExecuted = true;';
        expect(await browser.importFile({ name: 'my-filter.js', size: 42, text: async () => source })).toBe(true);
        expect(store.get('draft-1')).toMatchObject({ name: 'my-filter', source });
        expect(browser.editor.value).toBe(source);
        expect(globalThis.__moduleSourceExecuted).toBeUndefined();
        expect(onUse).not.toHaveBeenCalled();
        const text = vi.fn();
        expect(await browser.importFile({ name: 'huge.js', size: 300 * 1024, text })).toBe(false);
        expect(text).not.toHaveBeenCalled();
        expect(store.create).toHaveBeenCalledOnce();
    });

    it('preserves unsaved edits during refresh and saves them before selecting another module', async () => {
        const store = localStore([{ id: 'mine', name: 'Mine', source: '// old' }]);
        const browser = createBrowser({ localStore: store });
        await browser.activate();
        browser.editor.value = '// changed';
        browser.editor.dispatchEvent(new Event('input'));
        browser.nameInput.value = 'Renamed';
        browser.nameInput.dispatchEvent(new Event('input'));
        store.emit();
        await browser.activate();
        expect(browser.editor.value).toBe('// changed');
        expect(browser.nameInput.value).toBe('Renamed');
        await browser.select('vco');
        expect(store.get('mine')).toMatchObject({ name: 'Renamed', source: '// changed' });
        expect(browser.selectedKey).toBe('builtin:vco');
        await browser.select('mine', 'local');
        expect(browser.editor.value).toBe('// changed');
    });

    it('does not leave the local editor or execute code if saving fails', async () => {
        const store = localStore([{ id: 'mine', name: 'Mine', source: '// old' }]);
        store.save.mockImplementation(() => { throw new Error('Browser storage is full.'); });
        const onUse = vi.fn();
        const browser = createBrowser({ localStore: store, onUse });
        await browser.activate();
        browser.editor.value = '// keep me';
        browser.editor.dispatchEvent(new Event('input'));
        expect(await browser.select('vco')).toBe(false);
        expect(browser.selectedKey).toBe('local:mine');
        expect(browser.editor.value).toBe('// keep me');
        expect(browser.status.textContent).toBe('Browser storage is full.');
        expect(await browser.useModule()).toBe(false);
        expect(onUse).not.toHaveBeenCalled();
        expect(browser.fetch).not.toHaveBeenCalled();
    });

    it('saves before Use module and shows activation errors even when revisions trigger a store update', async () => {
        const store = localStore([{ id: 'mine', name: 'Mine', source: '// old' }]);
        const onUse = vi.fn(async id => {
            expect(store.get(id).source).toBe('// changed');
            store.emit();
            throw new Error('Missing createDSP.');
        });
        const browser = createBrowser({ localStore: store, onUse });
        await browser.activate();
        browser.editor.value = '// changed';
        browser.editor.dispatchEvent(new Event('input'));
        expect(await browser.useModule()).toBe(false);
        expect(onUse).toHaveBeenCalledWith('mine');
        expect(browser.status.textContent).toBe('Missing createDSP.');
        expect(browser.useButton.disabled).toBe(false);
        expect(browser.editor.value).toBe('// changed');
    });

    it('saves local drafts with the keyboard shortcut without invoking Use module', async () => {
        const store = localStore([{ id: 'mine', name: 'Mine', source: '// old' }]);
        const onUse = vi.fn();
        const browser = createBrowser({ localStore: store, onUse });
        await browser.activate();
        browser.editor.value = '// keyboard';
        browser.editor.dispatchEvent(new Event('input'));
        browser.editor.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(store.get('mine').source).toBe('// keyboard');
        expect(browser.status.textContent).toBe('Saved in this browser.');
        expect(onUse).not.toHaveBeenCalled();
    });

    it('aborts pending source requests and unsubscribes when disposed', async () => {
        const response = deferred();
        const store = localStore();
        const browser = createBrowser({ localStore: store, fetch: vi.fn(() => response.promise) });
        const loading = browser.select('vco');
        const signal = browser.fetch.mock.calls[0][1].signal;
        browser.dispose();
        expect(signal.aborted).toBe(true);
        expect(store.unsubscribe).toHaveBeenCalledOnce();
        response.resolve(sourceResponse('// late'));
        await loading;
        expect(browser.code.textContent).toBe('');
        expect(browser.cache.size).toBe(0);
        expect(document.querySelector('.module-source-browser')).toBeNull();
    });
});
