import { expect, test } from '@playwright/test';

async function evaluate(page, source, options = {}) {
    return page.evaluate(async ({ source, options }) => {
        const { evaluatePatchScript } = await import('/js/patch-script/evaluator.js');
        try { return { ok: true, description: await evaluatePatchScript(source, options) }; }
        catch (error) { return { ok: false, message: error.message, name: error.name }; }
    }, { source, options });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!window.eurorackApp?.patchWorkbench);
});

test('isolated evaluator builds ordinary JavaScript patches and cleans up failed or cancelled workers', async ({ page }) => {
    const result = await evaluate(page, `
        const p = patch();
        for (let i = 0; i < 3; i++) p.module('vco', 'osc' + i, { coarse: Math.random() });
        p.module('out', 'main').connect('osc0.ramp', 'main.L');
    `);
    expect(result.ok, result.message).toBe(true);
    expect(result.description.modules).toHaveLength(4);
    expect(result.description.connections).toHaveLength(1);
    const timeout = await evaluate(page, 'while (true) {}', { timeoutMs: 100 });
    expect(timeout.message).toContain('evaluation limit');
    const cancelled = await page.evaluate(async () => {
        const { evaluatePatchScript } = await import('/js/patch-script/evaluator.js');
        const controller = new AbortController();
        const result = evaluatePatchScript('while (true) {}', { signal: controller.signal });
        setTimeout(() => controller.abort(), 100);
        try { await result; } catch (error) { return error.name; }
    });
    expect(cancelled).toBe('AbortError');
    expect((await evaluate(page, 'patch().module("out", "main")')).ok).toBe(true);
    expect((await evaluate(page, 'patch().module("vco", "huge", { value: "x".repeat(1100000) })')).message).toContain('1 MiB');
    await expect(page.locator('[data-patch-evaluator]')).toHaveCount(0);
});

test('sandbox has no app origin, DOM or storage and prevents network and external script requests', async ({ page }) => {
    const attempts = [];
    await page.route('**/__evaluator_probe__*', route => {
        attempts.push(route.request().url());
        return route.fulfill({ contentType: 'text/javascript', body: 'globalThis.loadedExternal = true;' });
    });
    await page.routeWebSocket('**/__evaluator_probe__socket', socket => {
        attempts.push(socket.url());
        socket.close();
    });
    await page.evaluate(() => {
        localStorage.setItem('evaluator-secret', 'private');
        document.cookie = 'evaluator-secret=private; SameSite=Strict';
    });
    const origin = new URL(page.url()).origin;
    const result = await evaluate(page, `
        const state = { origin: self.origin, document: typeof document, parent: typeof parent,
            storage: typeof localStorage, beacon: typeof navigator.sendBeacon,
            worker: typeof Worker, sharedWorker: typeof SharedWorker };
        try { indexedDB.open('evaluator-secret'); state.indexedDB = 'opened'; }
        catch { state.indexedDB = 'blocked'; }
        try { importScripts('${origin}/__evaluator_probe__script'); state.importScripts = 'loaded'; }
        catch { state.importScripts = 'blocked'; }
        try { const xhr = new XMLHttpRequest(); xhr.open('GET', '${origin}/__evaluator_probe__xhr', false); xhr.send(); state.xhr = 'sent'; }
        catch { state.xhr = 'blocked'; }
        // These APIs are asynchronous; all are denied by inherited CSP before
        // network I/O, including if the script deliberately keeps its worker alive.
        fetch('${origin}/__evaluator_probe__fetch', { credentials: 'include' }).catch(() => {});
        import('${origin}/__evaluator_probe__import').catch(() => {});
        try { new WebSocket('${origin.replace('http:', 'ws:')}/__evaluator_probe__socket'); } catch {}
        const until = performance.now() + 100;
        while (performance.now() < until) {} // Give network processes time to issue any allowed request.
        patch().module('probe', 'result', state);
    `);
    expect(result.ok, result.message).toBe(true);
    expect(result.description.modules[0].params).toEqual({
        origin: 'null', document: 'undefined', parent: 'undefined', storage: 'undefined',
        beacon: 'undefined', worker: 'undefined', sharedWorker: 'undefined', indexedDB: 'blocked',
        importScripts: 'blocked', xhr: 'blocked'
    });
    expect(attempts).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('evaluator-secret'))).toBe('private');
    await expect(page.locator('[data-patch-evaluator]')).toHaveCount(0);
});

test('evaluator asset refuses unsandboxed embedding by another origin and top-level use', async ({ page }) => {
    const appOrigin = new URL(page.url()).origin;
    // A hostile site could otherwise omit the iframe sandbox and ask a worker
    // running on the app's origin to return local storage through its message port.
    await page.route('https://attacker.example/**', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Untrusted parent</title>'
    }));
    await page.goto('https://attacker.example/');
    const embedded = await page.evaluate(async origin => {
        let ready = false;
        let response = false;
        window.addEventListener('message', event => {
            if (event.data?.type === 'eurorack-patch-sandbox-ready') ready = true;
        });
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { response = true; };
        const frame = document.createElement('iframe');
        frame.src = origin + '/patch-script-sandbox.html';
        await new Promise(resolve => { frame.onload = resolve; document.body.appendChild(frame); });
        frame.contentWindow.postMessage({ type: 'eurorack-patch-evaluate', source: 'patch()' }, '*', [channel.port2]);
        await new Promise(resolve => setTimeout(resolve, 200));
        channel.port1.close();
        return { ready, response };
    }, appOrigin);
    expect(embedded).toEqual({ ready: false, response: false });

    await page.goto(appOrigin + '/patch-script-sandbox.html');
    const topLevel = await page.evaluate(async () => {
        let response = false;
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { response = true; };
        window.postMessage({ type: 'eurorack-patch-evaluate', source: 'patch()' }, '*', [channel.port2]);
        await new Promise(resolve => setTimeout(resolve, 200));
        channel.port1.close();
        return response;
    });
    expect(topLevel).toBe(false);
});
