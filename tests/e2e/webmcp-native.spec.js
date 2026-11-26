import {expect, test} from '@playwright/test';

const source = `patch().module('vco','osc',{coarse:0.25,fine:Math.random()})
  .module('lfo','motion').module('out','main',{volume:0.2})
  .connect('osc.triangle','main.L')`;

async function connectTools(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.webmcp);
    expect(await page.evaluate(() => window.eurorackApp.webmcp.supported),
        'Use an installed Chrome supporting document.modelContext with WebMCP enabled.').toBe(true);
    const cdp = await page.context().newCDPSession(page);
    const tools = new Map();
    const responses = new Map();
    const waiting = new Map();
    cdp.on('WebMCP.toolsAdded', event => event.tools.forEach(tool => tools.set(tool.name,tool)));
    cdp.on('WebMCP.toolResponded', event => {
        responses.set(event.invocationId,event);
        waiting.get(event.invocationId)?.(event);
    });
    await cdp.send('WebMCP.enable');
    await expect.poll(() => tools.size).toBe(10);
    const start = async (name,input = {}) => {
        const tool = tools.get(name);
        const {invocationId} = await cdp.send('WebMCP.invokeTool',{frameId:tool.frameId,toolName:name,input});
        const response = responses.has(invocationId) ? Promise.resolve(responses.get(invocationId))
            : new Promise((resolve,reject) => {
                const timer = setTimeout(() => {waiting.delete(invocationId);reject(new Error(`${name} did not respond`));},35000);
                waiting.set(invocationId,value => {clearTimeout(timer);waiting.delete(invocationId);resolve(value);});
            });
        return {invocationId,response};
    };
    const invoke = async (name,input) => {
        const event = await (await start(name,input)).response;
        expect(event.status,JSON.stringify(event)).toBe('Completed');
        return typeof event.output === 'string' ? JSON.parse(event.output) : event.output;
    };
    return {tools,cdp,invoke,start};
}

test('native Chrome discovers all tools, catches wiring issues and applies the exact validated patch', async ({page,browser},testInfo) => {
    testInfo.annotations.push({type:'browser',description:browser.version()});
    const {tools,cdp,invoke,start} = await connectTools(page);
    try {
        expect([...tools.keys()].sort()).toEqual(['apply_draft','debug_rack','describe_modules','edit_spacer','get_rack','map_midi_cc','measure_audio','perform_controls','present_step','validate_script']);
        const navigations = [];
        page.on('framenavigated',frame => navigations.push(frame.url()));
        const before = await invoke('get_rack');
        const definitions = await invoke('describe_modules',{types:['vco','lfo','out']});
        expect(definitions.ok).toBe(true);
        expect(definitions.modules[0].outputs.some(port=>port.port==='triangle')).toBe(true);
        const loose = await invoke('validate_script',{source,expectedRevision:before.revision});
        expect(loose.ok).toBe(true);
        expect(loose.diagnostics.issues).toContainEqual(expect.objectContaining({code:'module-unconnected',moduleIds:['motion']}));
        expect((await invoke('get_rack')).patch).toEqual(before.patch);
        await expect(page.getByRole('textbox',{name:'Patch script editor',exact:true})).toHaveValue(source);
        // Send a full-sized script through Chrome's native tool transport.
        const fixedSource = `${source}.connect('motion.primary','osc.fm')`.padEnd(128 * 1024);
        const fixed = await invoke('validate_script',{source:fixedSource,expectedRevision:before.revision});
        expect(fixed.ok).toBe(true);
        expect(fixed.diagnostics.issues).toEqual([]);
        expect(await invoke('apply_draft',{draftId:fixed.draftId})).toEqual({ok:true,applied:true});
        const fitted = await invoke('get_rack');
        expect(fitted.patch).toEqual(fixed.patch);
        const spacer = await invoke('edit_spacer', {action:'add', row:1, hp:'fill', style:'weave', expectedRevision:fitted.revision});
        expect(spacer).toMatchObject({ok:true, hp:fitted.rows[0].freeHP, freeHP:0});
        await expect(page.locator('#module-' + spacer.moduleId)).toHaveAttribute('data-spacer-style', 'weave');
        const freed = await invoke('edit_spacer', {action:'remove', moduleId:spacer.moduleId, expectedRevision:spacer.revision});
        expect(freed).toMatchObject({ok:true, freeHP:fitted.rows[0].freeHP});
        expect((await invoke('get_rack')).patch).toEqual(fixed.patch);
        expect((await invoke('debug_rack')).issues).toEqual([]);
        const caption = 'The LFO now modulates the oscillator.';
        const held = await start('present_step', {caption, moduleId: 'motion', holdSeconds: 0.8});
        await expect(page.locator('#agent-caption')).toContainText(caption);
        expect((await held.response).status).toBe('Completed');
        await expect(page.locator('#agent-caption')).toBeHidden();
        expect(await page.evaluate(()=>window.eurorackApp.patchLibrary.isDirty())).toBe(true);
        expect(await page.evaluate(()=>window.eurorackApp.host.engine)).toBeNull();
        await expect(page.locator('#module-osc')).toBeVisible();
        // Opaque host is prepared before registration; no tool call may navigate a child frame.
        expect(navigations).toEqual([]);
        await expect(page.locator('iframe[data-patch-evaluator]')).toHaveCount(1);
    } finally {await cdp.detach();}
});

test('native tools resolve unsaved rack choices and reject stale retries', async ({page}) => {
    const {cdp,invoke} = await connectTools(page);
    const validate = async () => invoke('validate_script',{source,expectedRevision:(await invoke('get_rack')).revision});
    try {
        const first = await validate();
        expect(first.ok).toBe(true);
        await invoke('apply_draft',{draftId:first.draftId});
        const next = await validate();
        expect(await invoke('apply_draft',{draftId:next.draftId})).toMatchObject({ok:false,error:{code:'unsaved-changes'}});
        await expect(page.getByRole('dialog',{name:'Unsaved rack changes',exact:true})).toHaveCount(0);
        expect(await invoke('get_rack')).toMatchObject({patch:first.patch,hasUnsavedChanges:true});
        await page.evaluate(()=>window.eurorackApp.setParam('osc','coarse',0.48));
        expect(await invoke('apply_draft',{draftId:next.draftId,discardUnsavedChanges:true})).toMatchObject({ok:false,error:{code:'rack-changed'}});
        expect((await invoke('get_rack')).patch.params.osc.coarse).toBe(0.48);
        const bad = await invoke('validate_script',{source:'while(true) {}',expectedRevision:(await invoke('get_rack')).revision});
        expect(bad).toMatchObject({ok:false});
        expect(bad.error.message).toContain('evaluation limit');
        const recovered = await validate();
        expect(recovered.ok).toBe(true);
        expect(await invoke('apply_draft',{draftId:recovered.draftId})).toMatchObject({ok:false,error:{code:'unsaved-changes'}});
        expect(await invoke('apply_draft',{draftId:recovered.draftId,discardUnsavedChanges:true})).toEqual({ok:true,applied:true});
        expect((await invoke('get_rack')).patch).toEqual(recovered.patch);
    } finally {await cdp.detach();}
});

test('native WebMCP measures running audio through WASM and cancels a capture', async ({page}) => {
    const {cdp,invoke,start} = await connectTools(page);
    try {
        const before = await invoke('get_rack');
        expect(await invoke('measure_audio',{expectedRevision:before.revision})).toMatchObject({ok:false,error:{code:'audio-not-running'}});
        const draft = await invoke('validate_script',{source:`patch().module('vco','osc').module('out','main',{volume:0.2}).connect('osc.triangle','main.L').connect('osc.triangle','main.R')`,expectedRevision:before.revision});
        expect(await invoke('apply_draft',{draftId:draft.draftId})).toMatchObject({ok:true,applied:true});
        await page.getByRole('button',{name:'Close Code',exact:true}).click();
        await page.locator('#startButton').click();
        await page.waitForFunction(() => window.eurorackApp.audioCtx?.state === 'running' && window.eurorackApp.host.engine?.running);
        const revision = (await invoke('get_rack')).revision;
        const measured = await invoke('measure_audio',{expectedRevision:revision,durationSeconds:0.5});
        expect(measured,JSON.stringify(measured)).toMatchObject({ok:true,report:{schemaVersion:1}});
        expect(measured.report.levels.left.rms).toBeGreaterThan(0);
        const pending = await start('measure_audio',{expectedRevision:revision,durationSeconds:10});
        await page.waitForFunction(() => window.eurorackApp.host.engine.pendingOutputCapture);
        await cdp.send('WebMCP.cancelInvocation',{invocationId:pending.invocationId});
        expect((await pending.response).status).toBe('Canceled');
        await page.waitForFunction(() => !window.eurorackApp.host.engine.pendingOutputCapture);
        expect(await invoke('measure_audio',{expectedRevision:revision,durationSeconds:0.5})).toMatchObject({ok:true});
        expect(await page.evaluate(() => window.eurorackApp.audioCtx.state)).toBe('running');
    } finally {await cdp.detach();}
});

test('native WebMCP maps a running knob and cancels a timed gesture at its current position', async ({page}) => {
    const {cdp, invoke, start} = await connectTools(page);
    try {
        const rack = await invoke('get_rack');
        const draft = await invoke('validate_script', {source, expectedRevision: rack.revision});
        expect(await invoke('apply_draft', {draftId: draft.draftId})).toMatchObject({ok: true, applied: true});
        await page.getByRole('button', {name: 'Close Code', exact: true}).click();
        await page.locator('#startButton').click();
        await page.waitForFunction(() => window.eurorackApp.host.engine?.running);
        const mapped = await invoke('map_midi_cc', {expectedRevision: (await invoke('get_rack')).revision,
            channel: 1, cc: 7, moduleId: 'main', paramId: 'volume'});
        expect(mapped).toMatchObject({ok: true, key: '0:7'});
        const move = await start('perform_controls', {expectedRevision: mapped.revision,
            controls: [{channel: 1, cc: 7, value: 127, durationSeconds: 5, easing: 'ease-out'}]});
        await page.waitForFunction(() => window.eurorackApp.state.getParam('main', 'volume') > 0.22);
        await cdp.send('WebMCP.cancelInvocation', {invocationId: move.invocationId});
        expect((await move.response).status).toBe('Canceled');
        const held = await invoke('get_rack');
        expect(held.audioRunning).toBe(true);
        expect(held.patch.params.main.volume).toBeLessThan(1);
        expect(await invoke('perform_controls', {expectedRevision: held.revision,
            controls: [{moduleId: 'main', paramId: 'volume', value: 0.3}]})).toMatchObject({ok: true, controls: [{paramValue: 0.3}]});
    } finally { await cdp.detach(); }
});
