// Reproducible native Chrome WebMCP demo client. No tool registration stub.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('./', import.meta.url);
const stateFile = new URL('session.json', directory);
const command = process.argv[2] || 'inspect';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9237', {noDefaults: true});
const context = browser.contexts()[0];
let session;
try { session = JSON.parse(await readFile(stateFile, 'utf8')); } catch { session = {}; }
let page;
for (const candidate of context.pages()) {
    const connection = await context.newCDPSession(candidate);
    const {targetInfo} = await connection.send('Target.getTargetInfo');
    await connection.detach();
    if (targetInfo.targetId === session.targetId) page = candidate;
}
if (command === 'init') {
    if (!page) page = await context.newPage();
    await page.goto('https://eurorackjs.orderandchaos.xyz/');
    const connection = await context.newCDPSession(page);
    session.targetId = (await connection.send('Target.getTargetInfo')).targetInfo.targetId;
    await connection.detach();
    await writeFile(stateFile, JSON.stringify(session, null, 2));
}
if (!page) throw new Error('Run init first. The demo has its own Chrome tab.');
if (['play', 'measure', 'save', 'reload', 'verify'].includes(command)) await page.bringToFront();
await page.waitForFunction(() => window.eurorackApp?.webmcp, null, {timeout: 20000});
const cdp = await context.newCDPSession(page);
const catalogue = new Map();
const responses = new Map();
const waiters = new Map();
cdp.on('WebMCP.toolsAdded', event => event.tools.forEach(tool => catalogue.set(tool.name, tool)));
cdp.on('WebMCP.toolResponded', event => {
    responses.set(event.invocationId, event);
    waiters.get(event.invocationId)?.(event);
});
await cdp.send('WebMCP.enable');
for (let tries = 0; catalogue.size < 5 && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 50));
if (catalogue.size < 5) throw new Error('Native WebMCP tools were not registered in Chrome.');

async function invoke(name, input = {}) {
    const tool = catalogue.get(name);
    if (!tool) throw new Error(`Tool unavailable: ${name}`);
    const {invocationId} = await cdp.send('WebMCP.invokeTool', {frameId: tool.frameId, toolName: name, input});
    const response = responses.get(invocationId) || await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { waiters.delete(invocationId); reject(new Error(`${name} timed out`)); }, 20000);
        waiters.set(invocationId, result => { clearTimeout(timeout); waiters.delete(invocationId); resolve(result); });
    });
    const output = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;
    await writeFile(new URL(`${name}-result.json`, directory), JSON.stringify({status: response.status, output}, null, 2));
    if (response.status !== 'Completed' || !output?.ok) throw new Error(JSON.stringify(response));
    return output;
}

try {
    if (command === 'init' || command === 'inspect') {
        console.log(JSON.stringify({chrome: browser.version(), tools: [...catalogue.values()], rack: await invoke('get_rack')}, null, 2));
    } else if (command === 'status') {
        console.log(JSON.stringify(await page.evaluate(() => ({url: location.href, title: document.title,
            audio: window.eurorackApp.audioCtx?.state,
            active: window.eurorackApp.patchLibrary.active,
            buttons: [...document.querySelectorAll('button')].filter(button => button.checkVisibility()).map(button => button.textContent.trim()).slice(0, 35)})), null, 2));
        console.log(JSON.stringify(await invoke('debug_rack')));
        await page.screenshot({path: fileURLToPath(new URL('rack.png', directory)), fullPage: true});
    } else if (command === 'describe') {
        console.log(JSON.stringify(await invoke('describe_modules', {types: process.argv.slice(3)}), null, 2));
    } else if (command === 'import') {
        const drawer = page.locator('#patch-workbench');
        if (!await drawer.isVisible()) await page.locator('#patchWorkbenchToggle').click();
        await page.getByRole('tab', {name: 'Modules', exact: true}).click();
        await page.locator('.module-source-browser input[type="file"]').setInputFiles(fileURLToPath(new URL('hocket.mjs', directory)));
        const name = page.getByRole('textbox', {name: 'Module name', exact: true});
        await name.waitFor();
        await name.fill('HOCKET');
        await page.locator('.module-source-browser').getByRole('button', {name: 'Save', exact: true}).click();
        await page.locator('.module-source-browser').getByRole('button', {name: 'Use module', exact: true}).click();
        await page.waitForFunction(() => {
            const status = document.querySelector('.module-source-status');
            return status?.textContent === 'Added to rack.' || status?.dataset.kind === 'error';
        });
        const status = await page.locator('.module-source-status').textContent();
        if (status !== 'Added to rack.') throw new Error(status);
        const rack = await invoke('get_rack');
        const local = rack.patch.modules.find(module => module.type.startsWith('local-'));
        if (!local) throw new Error('Local module did not appear in the rack.');
        session.type = local.type;
        await writeFile(stateFile, JSON.stringify(session, null, 2));
        console.log(JSON.stringify({status, type: session.type, definition: await invoke('describe_modules', {types: [session.type]})}, null, 2));
    } else if (command === 'validate') {
        const source = (await readFile(new URL('patch.js', directory), 'utf8')).replaceAll('HOCKET_TYPE', session.type);
        const rack = await invoke('get_rack');
        const result = await invoke('validate_script', {source, expectedRevision: rack.revision});
        session.draftId = result.draftId;
        await writeFile(stateFile, JSON.stringify(session, null, 2));
        await writeFile(new URL('patch-resolved.js', directory), source);
        console.log(JSON.stringify(result, null, 2));
    } else if (command === 'apply') {
        // This client owns a new demo tab. Replace only the just-created local
        // prototype/previous demo in that tab, never another user's rack tab.
        const confirm = page.getByRole('button', {name: 'Discard changes', exact: true});
        const confirmation = confirm.waitFor({timeout: 5000}).then(() => confirm.click()).catch(() => {});
        console.log(JSON.stringify(await invoke('apply_draft', {draftId: session.draftId})));
        await confirmation;
        console.log(JSON.stringify(await invoke('debug_rack')));
        await writeFile(new URL('patch.json', directory), JSON.stringify((await invoke('get_rack')).patch, null, 2));
    } else if (command === 'play') {
        const close = page.getByRole('button', {name: 'Close Code', exact: true});
        if (await close.isVisible()) await close.click();
        if (!(await page.locator('#startButton').getAttribute('class'))?.includes('active')) await page.locator('#startButton').click();
        await page.waitForFunction(() => window.eurorackApp?.host.engine);
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(JSON.stringify(await page.evaluate(() => ({audio: window.eurorackApp.audioCtx.state,
            meter: window.eurorackApp.state.getModule('meter')?.instance.leds,
            revision: window.eurorackApp.host.engine.revision})), null, 2));
    } else if (command === 'measure') {
        if (!await page.evaluate(() => window.eurorackApp.audioCtx?.state === 'running')) {
            await page.locator('#startButton').click();
            await page.waitForFunction(() => window.eurorackApp.audioCtx?.state === 'running' && window.eurorackApp.host.engine?.node);
        }
        const result = await page.evaluate(async () => {
            const app = window.eurorackApp;
            if (app.audioCtx.state !== 'running') throw new Error('Start audio first.');
            const splitter = app.audioCtx.createChannelSplitter(2);
            const analysers = [app.audioCtx.createAnalyser(), app.audioCtx.createAnalyser()];
            analysers.forEach((analyser, channel) => { analyser.fftSize = 4096; splitter.connect(analyser, channel); });
            const buffer = new Float32Array(4096);
            const channels = analysers.map(() => ({peak: 0, sumSquares: 0, samples: 0, nonFinite: 0, atOrAboveFullScale: 0}));
            app.host.engine.node.connect(splitter);
            const started = performance.now();
            try {
                while (performance.now() - started < 20000) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    analysers.forEach((analyser, channel) => {
                        analyser.getFloatTimeDomainData(buffer);
                        const stats = channels[channel];
                        for (const sample of buffer) {
                            stats.samples++;
                            if (!Number.isFinite(sample)) { stats.nonFinite++; continue; }
                            stats.peak = Math.max(stats.peak, Math.abs(sample));
                            stats.sumSquares += sample * sample;
                            if (Math.abs(sample) >= 1) stats.atOrAboveFullScale++;
                        }
                    });
                }
                return {audio: app.audioCtx.state, durationSeconds: (performance.now() - started) / 1000,
                    note: 'Sampled live worklet output with overlapping analyser windows; not a listening assessment or a continuous true-peak scan.',
                    channels: channels.map(({sumSquares, ...stats}) => ({...stats, rms: Math.sqrt(sumSquares / stats.samples)}))};
            } finally {
                app.host.engine.node.disconnect(splitter);
                splitter.disconnect();
                analysers.forEach(analyser => analyser.disconnect());
            }
        });
        await writeFile(new URL('audio-measurements.json', directory), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result, null, 2));
    } else if (command === 'save') {
        await page.locator('#savePatch').click();
        const dialog = page.getByRole('dialog', {name: 'Save patch', exact: true});
        await dialog.getByRole('textbox', {name: 'Patch name', exact: true}).fill('Hocket Study');
        await dialog.getByRole('combobox', {name: 'Save to', exact: true}).selectOption('local');
        await dialog.getByRole('button', {name: 'Save', exact: true}).click();
        await dialog.waitFor({state: 'hidden'});
        const saved = await page.evaluate(() => window.eurorackApp.patchLibrary.active);
        session.patchId = saved.id;
        await writeFile(stateFile, JSON.stringify(session, null, 2));
        console.log(JSON.stringify({name: saved.name, source: saved.source, id: saved.id}));
    } else if (command === 'verify') {
        const rack = await invoke('get_rack');
        if (rack.patch.modules.find(module => module.id === 'router')?.type !== session.type) throw new Error('The saved local module revision changed.');
        const diagnostics = await invoke('debug_rack');
        if (diagnostics.issues.length) throw new Error(JSON.stringify(diagnostics));
        const close = page.getByRole('button', {name: 'Close Code', exact: true});
        if (await close.isVisible()) await close.click();
        if (!await page.evaluate(() => window.eurorackApp.audioCtx?.state === 'running')) await page.locator('#startButton').click();
        await page.waitForFunction(() => window.eurorackApp.audioCtx?.state === 'running' && window.eurorackApp.host.engine?.node);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result = await page.evaluate(() => ({audio: window.eurorackApp.audioCtx.state,
            patch: {name: window.eurorackApp.patchLibrary.active.name, id: window.eurorackApp.patchLibrary.active.id,
                source: window.eurorackApp.patchLibrary.active.source},
            meter: window.eurorackApp.state.getModule('meter')?.instance.leds}));
        result.diagnostics = diagnostics;
        result.localModuleType = session.type;
        await writeFile(new URL('reload-verification.json', directory), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result, null, 2));
        await page.locator('#startButton').click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({path: fileURLToPath(new URL('rack.png', directory)), fullPage: false});
    } else if (command === 'debug') {
        console.log(JSON.stringify(await invoke('debug_rack'), null, 2));
    } else if (command === 'screenshot') {
        await page.screenshot({path: fileURLToPath(new URL('rack.png', directory)), fullPage: true});
        console.log(fileURLToPath(new URL('rack.png', directory)));
    } else if (command === 'reload') {
        await page.reload();
        await page.waitForFunction(() => window.eurorackApp?.patchWorkbench);
        await page.locator('[data-patch-view="mine"]').click();
        await page.locator('[data-patch-name="Hocket Study"]').getByRole('button', {name: 'Open in rack'}).click();
        await page.locator('#module-router').waitFor();
        console.log('Browser-saved patch reopened after reload.');
    } else throw new Error(`Unknown command ${command}`);
} finally {
    await cdp.detach();
    // Closing a connectOverCDP client disconnects it; the user's Chrome stays open.
    await browser.close();
}
