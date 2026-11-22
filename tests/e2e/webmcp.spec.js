import {expect, test} from '@playwright/test';

async function bootWithTools(page) {
    await page.addInitScript(() => {
        window.rackTools = {};
        Object.defineProperty(document, 'modelContext', {value: {
            registerTool: async (tool, {signal}) => {
                window.rackTools[tool.name] = tool;
                signal.addEventListener('abort', () => { delete window.rackTools[tool.name]; }, {once:true});
            }
        }});
    });
    await page.goto('/');
    await page.waitForFunction(() => Object.keys(window.rackTools).length === 7);
}
const invoke = (page, name, input = {}) => page.evaluate(async ({name,input}) => window.rackTools[name].execute(input), {name,input});
const source = `patch().module('vco','osc',{coarse:Math.random()}).module('out','main').connect('osc.triangle','main.L')`;
const validate = async page => invoke(page, 'validate_script', {source, expectedRevision:(await invoke(page,'get_rack')).revision});

test('validates and applies 256 modules from exactly 128 KiB of UTF-8 source', async ({page}) => {
    await bootWithTools(page);
    const byteLimit = 128 * 1024;
    const {revision} = await invoke(page, 'get_rack');
    const script = "const p = patch(); for (let i = 0; i < 256; i++) p.module('mult');\n//é";
    const source = script + ' '.repeat(byteLimit - Buffer.byteLength(script));
    expect(await page.evaluate(() => window.rackTools.validate_script.inputSchema.properties.source.maxLength)).toBe(byteLimit);

    const draft = await invoke(page, 'validate_script', {source, expectedRevision: revision});
    expect(draft.ok).toBe(true);
    expect(draft.patch.modules).toHaveLength(256);
    const oversized = await invoke(page, 'validate_script', {source: source + '!', expectedRevision: revision});
    expect(oversized).toMatchObject({ok: false, error: {code: 'source-limit'}});

    expect(await invoke(page, 'apply_draft', {draftId: draft.draftId})).toEqual({ok: true, applied: true});
    expect((await invoke(page, 'get_rack')).patch).toEqual(draft.patch);
});

test('a desktop draft stays available when the rack switches to the phone player and back', async ({page}) => {
    await bootWithTools(page);
    const before = await invoke(page, 'get_rack');
    const draft = await validate(page);
    expect(draft.ok).toBe(true);
    await page.setViewportSize({width: 390, height: 844});
    await expect(page.locator('#playerFooter')).toBeVisible();
    await expect(page.locator('#patch-workbench')).toBeHidden();
    expect(await validate(page)).toMatchObject({ok: false, error: {code: 'player-read-only'}});
    expect(await invoke(page, 'apply_draft', {draftId: draft.draftId})).toMatchObject({ok: false, error: {code: 'player-read-only'}});
    expect((await invoke(page, 'get_rack')).patch).toEqual(before.patch);
    await page.setViewportSize({width: 1280, height: 720});
    await expect(page.locator('#sidebar')).toBeVisible();
    expect(await invoke(page, 'apply_draft', {draftId: draft.draftId})).toMatchObject({ok: true, applied: true});
});

test('registered tools validate isolated code, apply the exact draft and preserve unsaved patch identity', async ({page}) => {
    await bootWithTools(page);
    const before = await invoke(page,'get_rack');
    const draft = await validate(page);
    expect(draft.ok).toBe(true);
    expect(draft.draftId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    await expect(page.locator('#patch-workbench')).toBeVisible();
    await expect(page.getByRole('textbox',{name:'Patch script editor',exact:true})).toHaveValue(source);
    expect((await invoke(page,'get_rack')).patch).toEqual(before.patch);
    expect(await invoke(page,'apply_draft',{draftId:draft.draftId})).toEqual({ok:true,applied:true});
    const applied = await invoke(page,'get_rack');
    expect(applied.patch).toEqual(draft.patch);
    expect(await page.evaluate(() => window.eurorackApp.patchLibrary.isDirty())).toBe(true);
    expect(await page.evaluate(() => window.eurorackApp.host.engine)).toBeNull();
    await expect(page.locator('#module-osc')).toBeVisible();

    // Applying Code to a saved rack remains an edit, preserving credit/identity and baseline.
    await page.evaluate(() => {
        const app = window.eurorackApp;
        app.patchLibrary.setActive({source:'local',id:'fixture-local',key:'Fixture',name:'Fixture',state:app.host.serializePatch(),canEdit:true});
    });
    const next = await validate(page);
    expect(await invoke(page,'apply_draft',{draftId:next.draftId})).toEqual({ok:true,applied:true});
    expect(await page.evaluate(() => ({id:window.eurorackApp.patchLibrary.active.id,dirty:window.eurorackApp.patchLibrary.isDirty()})))
        .toEqual({id:'fixture-local',dirty:true});
    await expect(page.locator('#activePatchLabel')).toContainText('Fixture');
    await expect(page.locator('#activePatchLabel')).toContainText('Edited');
});

test('stale drafts and cancelled or changed-rack confirmations do not replace the rack', async ({page}) => {
    await bootWithTools(page);
    const first = await validate(page);
    await invoke(page,'apply_draft',{draftId:first.draftId});
    const stale = await validate(page);
    await page.evaluate(() => window.eurorackApp.setParam('osc','coarse',0.12));
    expect(await invoke(page,'apply_draft',{draftId:stale.draftId})).toMatchObject({ok:false,error:{code:'rack-changed'}});
    const draft = await validate(page);
    await page.evaluate(draftId => { window.pendingApply = window.rackTools.apply_draft.execute({draftId}); }, draft.draftId);
    const dialog = page.getByRole('dialog',{name:'Unsaved rack changes',exact:true});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    expect(await page.evaluate(() => window.pendingApply)).toEqual({ok:true,applied:false});
    await page.evaluate(draftId => {
        window.toolAbort = new AbortController();
        window.pendingApply = window.rackTools.apply_draft.execute({draftId},{signal:window.toolAbort.signal});
    }, draft.draftId);
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.toolAbort.abort());
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => window.pendingApply)).toMatchObject({ok:false,error:{code:'cancelled'}});
    await page.evaluate(draftId => { window.pendingApply = window.rackTools.apply_draft.execute({draftId}); }, draft.draftId);
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.eurorackApp.setParam('osc','coarse',0.27));
    await dialog.getByRole('button',{name:'Discard changes',exact:true}).click();
    expect(await page.evaluate(() => window.pendingApply)).toMatchObject({ok:false,error:{code:'rack-changed'}});
    expect((await invoke(page,'get_rack')).patch.params.osc.coarse).toBe(0.27);
});
