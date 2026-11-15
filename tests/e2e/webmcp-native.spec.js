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
    await expect.poll(() => tools.size).toBe(5);
    const start = async (name,input = {}) => {
        const tool = tools.get(name);
        const {invocationId} = await cdp.send('WebMCP.invokeTool',{frameId:tool.frameId,toolName:name,input});
        const response = responses.has(invocationId) ? Promise.resolve(responses.get(invocationId))
            : new Promise((resolve,reject) => {
                const timer = setTimeout(() => {waiting.delete(invocationId);reject(new Error(`${name} did not respond`));},10000);
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
    const {tools,cdp,invoke} = await connectTools(page);
    try {
        expect([...tools.keys()].sort()).toEqual(['apply_draft','debug_rack','describe_modules','get_rack','validate_script']);
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
        const fixedSource = `${source}.connect('motion.primary','osc.fm')`;
        const fixed = await invoke('validate_script',{source:fixedSource,expectedRevision:before.revision});
        expect(fixed.ok).toBe(true);
        expect(fixed.diagnostics.issues).toEqual([]);
        expect(await invoke('apply_draft',{draftId:fixed.draftId})).toEqual({ok:true,applied:true});
        expect((await invoke('get_rack')).patch).toEqual(fixed.patch);
        expect((await invoke('debug_rack')).issues).toEqual([]);
        expect(await page.evaluate(()=>window.eurorackApp.patchLibrary.isDirty())).toBe(true);
        expect(await page.evaluate(()=>window.eurorackApp.host.engine)).toBeNull();
        await expect(page.locator('#module-osc')).toBeVisible();
        // Opaque host is prepared before registration; no tool call may navigate a child frame.
        expect(navigations).toEqual([]);
        await expect(page.locator('iframe[data-patch-evaluator]')).toHaveCount(1);
    } finally {await cdp.detach();}
});

test('native cancellation closes confirmation, and stale edits are preserved', async ({page}) => {
    const {cdp,invoke,start} = await connectTools(page);
    const validate = async () => invoke('validate_script',{source,expectedRevision:(await invoke('get_rack')).revision});
    try {
        const first = await validate();
        expect(first.ok).toBe(true);
        await invoke('apply_draft',{draftId:first.draftId});
        const next = await validate();
        const pending = await start('apply_draft',{draftId:next.draftId});
        const dialog = page.getByRole('dialog',{name:'Unsaved rack changes',exact:true});
        await expect(dialog).toBeVisible();
        await cdp.send('WebMCP.cancelInvocation',{invocationId:pending.invocationId});
        expect((await pending.response).status).toBe('Canceled');
        await expect(dialog).toHaveCount(0);
        await expect.poll(()=>page.evaluate(()=>window.eurorackApp.patchWorkbench.operationPending)).toBe(false);
        expect((await invoke('get_rack')).patch).toEqual(first.patch);
        await page.evaluate(()=>window.eurorackApp.setParam('osc','coarse',0.48));
        expect(await invoke('apply_draft',{draftId:next.draftId})).toMatchObject({ok:false,error:{code:'rack-changed'}});
        expect((await invoke('get_rack')).patch.params.osc.coarse).toBe(0.48);
        const bad = await invoke('validate_script',{source:'while(true) {}',expectedRevision:(await invoke('get_rack')).revision});
        expect(bad).toMatchObject({ok:false});
        expect(bad.error.message).toContain('evaluation limit');
        const recovered = await validate();
        expect(recovered.ok).toBe(true);
    } finally {await cdp.detach();}
});
