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

test('shows the exact agent measurement and loads WASM only on demand', async ({page}, testInfo) => {
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
    await expect(page.locator('#analysisToggle')).toContainText('Agent activity');
    await page.locator('#analysisToggle').click();
    const panel = page.getByRole('complementary', {name: 'Audio analysis'});
    await expect(panel.getByRole('heading', {name: 'Last measurement'})).toBeVisible();
    await expect(panel.locator('[data-field="measurement"]')).toContainText(`rack revision ${revision}`);
    await expect(panel.getByText('Stereo correlation').locator('..')).toContainText('1.000');
    await page.screenshot({path: testInfo.outputPath('agent-measurement.png')});
    const raw = panel.locator('details').filter({has: page.getByText('Exact measurement JSON', {exact: true})});
    await raw.locator('summary').click();
    expect(JSON.parse(await raw.locator('pre').innerText())).toEqual(result);
    await panel.getByRole('tab', {name: /Activity/}).click();
    const row = panel.getByRole('listitem').first();
    await expect(row).toContainText('Agent · Measure audio');
    await row.locator('summary').click();
    await expect(row.locator('pre').last()).toContainText('"schemaVersion"');
    expect(JSON.parse(await row.locator('pre').first().innerText())).toEqual({expectedRevision:revision,durationSeconds:0.5});
    expect(JSON.parse(await row.locator('pre').last().innerText())).toEqual(result);
    expect((await call(page,'get_rack')).revision).toBe(revision);
    await page.evaluate(() => window.eurorackApp.setParam('main', 'volume', 0.2));
    await panel.getByRole('tab', {name: 'Measurements'}).click();
    await expect(panel.getByText('Captured before the last rack edit.')).toBeVisible();
});

test('cancels capture on edits and tool cancellation and can measure again', async ({page}) => {
    await boot(page); const revision = await startTone(page);
    await page.evaluate(revision => {
        window.measurement = window.rackTools.measure_audio.execute({expectedRevision:revision,durationSeconds:10});
    }, revision);
    await page.waitForFunction(() => window.eurorackApp.host.engine.pendingOutputCapture);
    await expect(page.locator('#analysisToggle')).toContainText('Agent measuring');
    await page.locator('#analysisToggle').click();
    await expect(page.locator('.analysis-status')).toHaveText('Agent · Capturing audio');
    await expect(page.getByLabel('Capture length (s)')).toHaveValue('10');
    await expect(page.getByRole('button', {name: 'Measure', exact: true})).toBeDisabled();
    await page.evaluate(() => window.eurorackApp.setParam('main','volume',0.25));
    expect(await page.evaluate(() => window.measurement)).toMatchObject({ok:false,error:{code:'rack-changed'}});
    await expect(page.locator('.analysis-status')).toContainText('The rack changed');
    await expect(page.getByLabel('Capture length (s)')).toHaveValue('5');
    const current = (await call(page,'get_rack')).revision;
    await page.evaluate(revision => {
        window.measureAbort = new AbortController();
        window.measurement = window.rackTools.measure_audio.execute({expectedRevision:revision,durationSeconds:10},{signal:window.measureAbort.signal});
    }, current);
    await page.waitForFunction(() => window.eurorackApp.host.engine.pendingOutputCapture);
    await page.evaluate(() => window.measureAbort.abort());
    expect(await page.evaluate(() => window.measurement)).toMatchObject({ok:false,error:{code:'cancelled'}});
    await expect(page.locator('.analysis-status')).toContainText('Cancelled');
    expect(await call(page,'measure_audio',{expectedRevision:current,durationSeconds:0.5})).toMatchObject({ok:true});
});

test('a user can measure silence, cancel and retry when agent registration fails', async ({page}, testInfo) => {
    await page.setViewportSize({width: 820, height: 844});
    await page.addInitScript(() => Object.defineProperty(document, 'modelContext', {
        value: {registerTool: () => { throw new Error('Registration unavailable'); }}
    }));
    const wasm = [];
    page.on('request', request => {if (request.url().endsWith('.wasm')) wasm.push(request.url());});
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.webmcp?.supported === false);
    const toggle = page.locator('#analysisToggle');
    await toggle.click();
    const panel = page.getByRole('complementary', {name: 'Audio analysis'});
    const measure = panel.getByRole('button', {name: 'Measure', exact: true});
    await expect(measure).toBeDisabled();
    expect(wasm).toHaveLength(0);
    const patch = () => page.evaluate(() => window.eurorackApp.host.serializePatch());
    const initial = await patch();
    await page.locator('#startButton').click();
    await panel.getByLabel('Capture length (s)').fill('0.5');
    await measure.click();
    await expect(panel.getByRole('heading', {name: 'Output level'})).toBeVisible();
    await expect(panel.locator('.analysis-levels b').first()).toHaveText('—');
    await expect(panel.locator('.analysis-highlights dd').first()).toHaveText('—');
    await expect(panel.locator('[data-field="measurement"]')).toContainText('You ·');
    expect(wasm.length).toBeGreaterThan(0);
    expect((await panel.boundingBox()).width).toBeLessThanOrEqual(390);
    await page.screenshot({path: testInfo.outputPath('compact-measurement.png')});
    await panel.getByLabel('Capture length (s)').fill('10');
    await measure.click();
    await page.waitForFunction(() => window.eurorackApp.host.engine.pendingOutputCapture);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true})));
    await panel.getByRole('button', {name: 'Cancel'}).click();
    await expect(panel.getByRole('status')).toContainText('Cancelled');
    await expect(measure).toBeEnabled();
    await expect(panel.locator('[data-field="measurement"]')).toContainText('0.5 s');
    await panel.getByRole('tab', {name: /Activity/}).click();
    await expect(panel.getByRole('listitem').first()).toContainText('You · Measure audio');
    await expect(panel.getByRole('listitem').first()).toContainText('Cancelled');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
    expect(await patch()).toEqual(initial);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: false})));
    expect(await page.evaluate(() => window.eurorackApp.audioAnalysis.measure().catch(error => error.code))).toBe('analysis-unavailable');
});

test('presents two playable stages and their live checks while the rack keeps running', async ({page}, testInfo) => {
    await page.setViewportSize({width: 1440, height: 900});
    await boot(page);
    await startTone(page);
    const before = await call(page, 'get_rack');
    const first = {caption: 'The triangle voice now feeds both speakers.', moduleId: 'osc', holdSeconds: 0.8};
    const presenting = call(page, 'present_step', first);
    await expect(page.locator('#agent-caption')).toContainText(first.caption);
    await expect(page.locator('#module-osc')).toHaveClass(/agent-step-target/);
    expect(await presenting).toEqual({ok: true, ...first});
    await expect(page.locator('#agent-caption')).toBeHidden();

    const draft = await call(page, 'validate_script', {expectedRevision: before.revision,
        source: before.source + ".module('lfo','motion',{rateKnob:0.1}).connect('motion.primary','osc.fm')"});
    expect(draft.ok).toBe(true);
    const applying = call(page, 'apply_draft', {draftId: draft.draftId});
    await page.getByRole('dialog', {name: 'Unsaved rack changes'}).getByRole('button', {name: 'Discard changes'}).click();
    expect(await applying).toEqual({ok: true, applied: true});
    await expect(page.locator('#module-motion')).toBeVisible();
    const wiring = await call(page, 'debug_rack');
    expect(wiring.moduleCount).toBe(before.patch.modules.length + 1);
    const measured = await call(page, 'measure_audio', {expectedRevision: wiring.revision, durationSeconds: 0.5});
    expect(measured.report.levels.left.rms).toBeGreaterThan(0);
    await page.locator('#analysisToggle').click();
    await page.getByRole('tab', {name: /Activity/}).click();
    const caption = `The LFO modulates pitch. Measured left RMS is ${measured.report.levels.left.rmsDbfs.toFixed(1)} dBFS.`;
    await page.evaluate(caption => {
        window.stepAbort = new AbortController();
        window.stepResult = window.rackTools.present_step.execute({caption, moduleId: 'motion', holdSeconds: 30}, {signal: window.stepAbort.signal});
    }, caption);
    await expect(page.locator('#agent-caption')).toContainText(caption);
    await expect(page.locator('#module-motion')).toHaveClass(/agent-step-target/);
    await expect(page.getByRole('list', {name: 'Recent activity'}).getByRole('listitem').first()).toContainText('Showing caption');
    await page.screenshot({path: testInfo.outputPath('agent-walkthrough.png')});
    await page.evaluate(() => window.stepAbort.abort());
    expect(await page.evaluate(() => window.stepResult)).toMatchObject({ok: false, error: {code: 'cancelled'}});
    await expect(page.locator('#module-motion')).not.toHaveClass(/agent-step-target/);
    await expect(page.locator('#agent-caption')).toBeHidden();
    expect((await call(page, 'get_rack')).revision).toBe(wiring.revision);
    expect(await page.evaluate(() => window.eurorackApp.audioCtx.state)).toBe('running');
});

test('brings a lower-row walkthrough target into the visible rack above the Code drawer', async ({page}) => {
    await page.setViewportSize({width: 1280, height: 900});
    await boot(page);
    const {revision} = await call(page, 'get_rack');
    const draft = await call(page, 'validate_script', {expectedRevision: revision,
        source: "patch().module('lfo','lower',{}, {row:4,index:0})"});
    expect(await call(page, 'apply_draft', {draftId: draft.draftId})).toEqual({ok:true, applied:true});
    const held = call(page, 'present_step', {caption: 'Modulation on row four', moduleId: 'lower', holdSeconds: 1});
    const target = page.locator('#module-lower');
    await expect(target).toHaveClass(/agent-step-target/);
    const module = await target.boundingBox();
    const rack = await page.locator('#rack-container').boundingBox();
    const code = await page.locator('#patch-workbench').boundingBox();
    expect(module.y).toBeGreaterThanOrEqual(rack.y - 1);
    expect(module.y + module.height).toBeLessThanOrEqual(code.y + 1);
    expect(await held).toMatchObject({ok:true});
});
