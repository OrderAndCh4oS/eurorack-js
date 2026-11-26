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
    await page.waitForFunction(() => window.rackTools.present_step);
}
const invoke = (page, name, input = {}) => page.evaluate(async ({name,input}) => window.rackTools[name].execute(input), {name,input});
const source = `patch().module('vco','osc',{coarse:Math.random()}).module('out','main').connect('osc.triangle','main.L')`;
const validate = async page => invoke(page, 'validate_script', {source, expectedRevision:(await invoke(page,'get_rack')).revision});

test('performs consecutive gestures on the playing graph with panel mappings and MIDI-to-CV', async ({page}) => {
    await bootWithTools(page);
    const start = await invoke(page, 'get_rack');
    expect(start.audioRunning).toBe(false);
    const draft = await invoke(page, 'validate_script', {expectedRevision: start.revision, source: `patch()
        .module('vco','osc').module('midi-cc','cc').module('vca','amp').module('out','main',{volume:0})
        .connect('osc.triangle','amp.ch1In').connect('cc.cv1','amp.ch1CV')
        .connect('amp.ch1Out','main.L').connect('amp.ch1Out','main.R')`});
    expect(await invoke(page, 'apply_draft', {draftId: draft.draftId})).toEqual({ok: true, applied: true});
    await page.getByRole('button', {name: 'Close Code', exact: true}).click();
    const rack = await invoke(page, 'get_rack');
    const volume = {moduleId: 'main', paramId: 'volume'};
    const mappedCC = {channel: 1, cc: 74};
    expect(await invoke(page, 'perform_controls', {expectedRevision: rack.revision, controls: [{...volume, value: 1}]}))
        .toMatchObject({ok: false, error: {code: 'audio-not-running'}});
    await page.locator('#startButton').click();
    await page.waitForFunction(() => window.eurorackApp.host.engine?.running);
    const topology = await page.evaluate(() => window.eurorackApp.host.engine.activeRevision);
    const mapped = await invoke(page, 'map_midi_cc', {expectedRevision: rack.revision, ...mappedCC, ...volume, max: 0.6});
    expect(mapped).toMatchObject({ok: true, key: '0:74'});
    const knob = page.locator('#module-main .knob[data-param="volume"]');
    await expect(knob).toHaveClass(/midi-mapped/);
    const played = await invoke(page, 'perform_controls', {expectedRevision: mapped.revision, controls: [
        {...mappedCC, value: 127, durationSeconds: 0.35, easing: 'ease-in-out'},
        {channel: 1, cc: 1, value: 100}, // The MIDI-CC module opens the VCA.
        {moduleId: 'osc', paramId: 'coarse', value: 0.425, durationSeconds: 0.2, easing: 'ease-out'}
    ]});
    expect(played).toMatchObject({ok: true, controls: [{paramValue: 0.6}, {value: 100}, {paramValue: 0.425}]});
    await expect(knob).toHaveAttribute('data-value', '0.6');
    const loud = await invoke(page, 'measure_audio', {expectedRevision: played.revision, durationSeconds: 0.5});
    expect(loud).toMatchObject({ok: true, capture: {engineRevision: topology}});
    expect(loud.report.levels.left.rms).toBeGreaterThan(0.1);

    const faded = await invoke(page, 'perform_controls', {expectedRevision: played.revision, controls: [
        {...volume, value: 0.15, durationSeconds: 0.2, easing: 'ease-in'}
    ]});
    expect(faded).toMatchObject({ok: true, controls: [{paramValue: 0.15}]});
    const quiet = await invoke(page, 'measure_audio', {expectedRevision: faded.revision, durationSeconds: 0.5});
    expect(quiet).toMatchObject({ok: true, capture: {engineRevision: topology}});
    expect(quiet.report.levels.left.rms / loud.report.levels.left.rms).toBeCloseTo(0.25, 2);
    expect(await invoke(page, 'get_rack')).toMatchObject({audioRunning: true, hasUnsavedChanges: true,
        patch: {midiMappings: {'0:74': {...volume, min: 0, max: 0.6}}, params: {main: {volume: 0.15}}}});
    await expect(page.locator('#patch-workbench')).toBeHidden();
    await expect(page.locator('#activePatchLabel')).toContainText('Edited');
});

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
    expect(before.hasUnsavedChanges).toBe(false);
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
        app.setParam('osc', 'coarse', 0.12);
    });
    const dirty = await invoke(page,'get_rack');
    expect(dirty.hasUnsavedChanges).toBe(true);
    const next = await validate(page);
    expect(await invoke(page,'apply_draft',{draftId:next.draftId})).toMatchObject({ok:false,error:{code:'unsaved-changes'}});
    await expect(page.getByRole('dialog',{name:'Unsaved rack changes'})).toHaveCount(0);
    expect(await invoke(page,'get_rack')).toEqual(dirty);
    expect(await invoke(page,'apply_draft',{draftId:next.draftId,discardUnsavedChanges:true})).toEqual({ok:true,applied:true});
    expect((await invoke(page,'get_rack')).patch).toEqual(next.patch);
    expect(await page.evaluate(() => ({id:window.eurorackApp.patchLibrary.active.id,dirty:window.eurorackApp.patchLibrary.isDirty()})))
        .toEqual({id:'fixture-local',dirty:true});
    await expect(page.locator('#activePatchLabel')).toContainText('Fixture');
    await expect(page.locator('#activePatchLabel')).toContainText('Edited');
});

test('stale tool retries and cancelled or stale manual applies preserve the rack', async ({page}) => {
    await bootWithTools(page);
    const first = await validate(page);
    await invoke(page,'apply_draft',{draftId:first.draftId});
    const stale = await validate(page);
    expect(await invoke(page,'apply_draft',{draftId:stale.draftId})).toMatchObject({ok:false,error:{code:'unsaved-changes'}});
    await page.evaluate(() => window.eurorackApp.setParam('osc','coarse',0.12));
    expect(await invoke(page,'apply_draft',{draftId:stale.draftId,discardUnsavedChanges:true})).toMatchObject({ok:false,error:{code:'rack-changed'}});
    await validate(page);
    const apply = page.locator('#patch-workbench [data-action="apply"]');
    await apply.click();
    const dialog = page.getByRole('dialog',{name:'Unsaved rack changes',exact:true});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    expect((await invoke(page,'get_rack')).patch.params.osc.coarse).toBe(0.12);
    await apply.click();
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.eurorackApp.setParam('osc','coarse',0.27));
    await dialog.getByRole('button',{name:'Discard changes',exact:true}).click();
    await expect(page.locator('#patch-workbench [data-role="status"]')).toContainText('rack changed');
    expect((await invoke(page,'get_rack')).patch.params.osc.coarse).toBe(0.27);
});
