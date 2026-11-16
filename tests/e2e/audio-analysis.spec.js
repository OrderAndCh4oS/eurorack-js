import {expect, test} from '@playwright/test';

async function boot(page) {
    await page.addInitScript(() => {
        window.rackTools = {};
        Object.defineProperty(document, 'modelContext', {value: {registerTool: async tool => {window.rackTools[tool.name] = tool;}}});
    });
    await page.goto('/');
    await page.waitForFunction(() => window.rackTools.measure_audio);
}
const call = (page, name, input = {}) => page.evaluate(({name, input}) => window.rackTools[name].execute(input), {name, input});
async function startTone(page) {
    const rack = await call(page, 'get_rack');
    const draft = await call(page, 'validate_script', {expectedRevision: rack.revision,
        source: `patch().module('vco','osc',{coarse:0.35,fine:0}).module('out','main',{volume:0.3}).connect('osc.triangle','main.L').connect('osc.triangle','main.R')`});
    expect(draft.ok).toBe(true); expect(await call(page, 'apply_draft', {draftId: draft.draftId})).toEqual({ok:true,applied:true});
    await page.getByRole('button', {name:'Close Code',exact:true}).click();
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running && window.eurorackApp.audioCtx.state === 'running');
    return (await call(page, 'get_rack')).revision;
}

test('loads WASM only on demand and measures real stereo worklet output locally', async ({page}) => {
    const wasmResponses = [];
    page.on('response', response => {if (response.url().endsWith('.wasm')) wasmResponses.push(response);});
    await boot(page);
    expect(wasmResponses).toHaveLength(0);
    const initial = await call(page, 'get_rack');
    expect(await call(page, 'measure_audio', {expectedRevision:initial.revision})).toMatchObject({ok:false,error:{code:'audio-not-running'}});
    expect(wasmResponses).toHaveLength(0);
    const revision = await startTone(page);
    const requests = []; page.on('request', request => requests.push({method:request.method(),url:request.url()}));
    const result = await call(page, 'measure_audio', {expectedRevision:revision,durationSeconds:0.5});
    expect(result, JSON.stringify(result)).toMatchObject({ok:true,revision,report:{schemaVersion:1}});
    expect(result.capture.frames).toBe(Math.round(result.capture.sampleRate * 0.5));
    expect(result.capture.startTimeSeconds).toBeGreaterThanOrEqual(0);
    expect(result.report.levels.left.rms).toBeGreaterThan(0.03);
    expect(result.report.levels.left.peak).toBeLessThan(0.4);
    expect(result.report.levels.right.rms).toBeCloseTo(result.report.levels.left.rms, 6);
    expect(result.report.stereo.correlation).toBeCloseTo(1, 6);
    expect(result.report.spectral.left.centroidHz).toBeGreaterThan(20);
    expect(result.report.loudness.integratedLufs).toEqual(expect.any(Number));
    expect(result.report.loudness.shortTermLufs).toBeNull();
    expect(wasmResponses).toHaveLength(1);
    expect(await wasmResponses[0].headerValue('content-type')).toContain('application/wasm');
    expect(await wasmResponses[0].headerValue('cache-control')).toContain('immutable');
    expect(requests.every(request => ['GET','HEAD'].includes(request.method))).toBe(true);
    expect(await page.evaluate(() => window.eurorackApp.audioCtx.state)).toBe('running');
    expect((await call(page,'get_rack')).revision).toBe(revision);
});

test('cancels capture on edits and tool cancellation and can measure again', async ({page}) => {
    await boot(page); const revision = await startTone(page);
    await page.evaluate(revision => {
        window.measurement = window.rackTools.measure_audio.execute({expectedRevision:revision,durationSeconds:10});
    }, revision);
    await page.waitForFunction(() => window.eurorackApp.host.engine.pendingOutputCapture);
    await page.evaluate(() => window.eurorackApp.setParam('main','volume',0.25));
    expect(await page.evaluate(() => window.measurement)).toMatchObject({ok:false,error:{code:'rack-changed'}});
    const current = (await call(page,'get_rack')).revision;
    await page.evaluate(revision => {
        window.measureAbort = new AbortController();
        window.measurement = window.rackTools.measure_audio.execute({expectedRevision:revision,durationSeconds:10},{signal:window.measureAbort.signal});
    }, current);
    await page.waitForFunction(() => window.eurorackApp.host.engine.pendingOutputCapture);
    await page.evaluate(() => window.measureAbort.abort());
    expect(await page.evaluate(() => window.measurement)).toMatchObject({ok:false,error:{code:'cancelled'}});
    expect(await call(page,'measure_audio',{expectedRevision:current,durationSeconds:0.5})).toMatchObject({ok:true});
});
