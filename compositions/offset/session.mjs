// Local composition/measurement session through Chrome's native WebMCP API.
import {chromium} from 'playwright';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const folder = new URL('./', import.meta.url);
const stateFile = join(tmpdir(), 'eurorack-offset-session.json');
const command = process.argv[2] || 'status';
if (command === 'trial' || command === 'verify') {
    const run = (...args) => execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {stdio:'inherit'});
    if (command === 'trial') {
        const label = process.argv[3] || 'baseline';
        run('apply'); run('play');
        try {for (let n = 1; n <= 3; n++) run('measure', `${label}-${n}`, '8');}
        finally {run('stop');}
    } else {
        for (const variant of ['mono','inverted','half-right','mute']) {
            run('apply',variant); run('play');
            try {run('measure',variant,'4');} finally {run('stop');}
            const {report} = JSON.parse(await readFile(new URL(`measurements/${variant}.json`,folder),'utf8'));
            if (variant === 'mono') {
                assert.equal(report.stereo.correlation,1); assert.equal(report.stereo.sideRms,0);
                assert.equal(report.stereo.sideToMidEnergyRatio,0);
                assert.deepEqual(report.levels.left,report.levels.right);
                assert.deepEqual(report.spectral.left,report.spectral.right);
            } else if (variant === 'inverted' || variant === 'half-right') {
                const close = (a,b,tolerance = 1e-7) => assert.ok(Math.abs(a-b) <= tolerance, `${a} != ${b}`);
                const ratio = variant === 'inverted' ? -1 : 0.5;
                close(report.stereo.correlation, Math.sign(ratio));
                close(report.levels.right.rms, report.levels.left.rms * Math.abs(ratio));
                close(report.levels.right.peak, report.levels.left.peak * Math.abs(ratio));
                close(report.levels.right.dcOffset, report.levels.left.dcOffset * ratio);
                if (variant === 'inverted') {
                    assert.equal(report.stereo.midRms,0);
                    assert.equal(report.stereo.sideToMidEnergyRatio,null);
                    close(report.stereo.sideRms,report.levels.left.rms);
                } else {
                    close(report.levels.right.rmsDbfs-report.levels.left.rmsDbfs,20*Math.log10(0.5),1e-5);
                    close(report.stereo.sideToMidEnergyRatio,1/9);
                    close(report.spectral.left.centroidHz,report.spectral.right.centroidHz,1e-4);
                }
            } else {
                for (const channel of ['left','right']) {
                    assert.equal(report.levels[channel].peak,0); assert.equal(report.levels[channel].rms,0);
                    assert.equal(report.levels[channel].dcOffset,0); assert.equal(report.levels[channel].fullScaleSamples,0);
                    assert.equal(report.spectral[channel].activeFrameCount,0); assert.equal(report.spectral[channel].centroidHz,null);
                    assert.equal(report.loudness.truePeakEstimate[channel],0);
                }
                assert.equal(report.stereo.correlation,null);
                for (const key of ['integratedLufs','momentaryLufs','shortTermLufs']) assert.equal(report.loudness[key],null);
            }
            console.log(`${variant} end-to-end assertions passed.`);
        }
        run('apply'); run('save');
    }
    process.exit(0);
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9237', {noDefaults:true});
const context = browser.contexts()[0];
let state = {};
try {state = JSON.parse(await readFile(stateFile, 'utf8'));} catch {}
let page;
for (const candidate of context.pages()) {
    const cdp = await context.newCDPSession(candidate);
    const {targetInfo} = await cdp.send('Target.getTargetInfo');
    await cdp.detach();
    if (targetInfo.targetId === state.targetId) page = candidate;
}
if (command === 'init') {
    if (!page) page = await context.newPage();
    await page.goto('http://127.0.0.1:4189/');
    const cdp = await context.newCDPSession(page);
    state.targetId = (await cdp.send('Target.getTargetInfo')).targetInfo.targetId;
    await cdp.detach();
    await writeFile(stateFile, JSON.stringify(state));
}
if (!page) throw new Error('Run init first; this session uses its own local tab.');
await page.bringToFront();
if (command === 'open-saved') {
    if (!state.patchId) throw new Error('Save the patch first.');
    await page.goto(`http://127.0.0.1:4189/#local=${state.patchId}`);
    await page.waitForFunction(id => window.eurorackApp?.patchLibrary?.active?.id === id, state.patchId);
}
await page.waitForFunction(() => window.eurorackApp?.webmcp);
if (!await page.evaluate(() => window.eurorackApp.webmcp.supported)) throw new Error('Native WebMCP is unavailable.');
const cdp = await context.newCDPSession(page);
const tools = new Map(), responses = new Map(), waiters = new Map();
cdp.on('WebMCP.toolsAdded', event => event.tools.forEach(tool => tools.set(tool.name, tool)));
cdp.on('WebMCP.toolResponded', event => {responses.set(event.invocationId, event); waiters.get(event.invocationId)?.(event);});
await cdp.send('WebMCP.enable');
for (let n = 0; tools.size < 6 && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 50));
if (!tools.has('measure_audio')) throw new Error('Local analysis tool missing. Rebuild the app.');
async function invoke(name, input = {}) {
    const tool = tools.get(name);
    const {invocationId} = await cdp.send('WebMCP.invokeTool', {frameId:tool.frameId, toolName:name, input});
    const response = responses.get(invocationId) || await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {waiters.delete(invocationId); reject(new Error(`${name} timed out`));}, 35000);
        waiters.set(invocationId, result => {clearTimeout(timeout); waiters.delete(invocationId); resolve(result);});
    });
    const output = typeof response.output === 'string' ? JSON.parse(response.output) : response.output;
    if (response.status !== 'Completed' || !output?.ok) throw new Error(JSON.stringify(response));
    return output;
}
async function playback(running) {
    const close = page.getByRole('button', {name:'Close Code',exact:true});
    if (await close.isVisible()) await close.click();
    const active = await page.evaluate(() => window.eurorackApp.host.engine?.running === true);
    if (active !== running) await page.locator('#startButton').click();
    if (running) await page.waitForFunction(() => window.eurorackApp.audioCtx?.state === 'running' && window.eurorackApp.host.engine?.running);
}
try {
    if (command === 'init' || command === 'status') {
        console.log(JSON.stringify({chrome:browser.version(),url:page.url(),tools:[...tools.keys()],rack:await invoke('get_rack')}, null, 2));
    } else if (command === 'describe') {
        console.log(JSON.stringify(await invoke('describe_modules', {types:process.argv.slice(3)}), null, 2));
    } else if (command === 'apply') {
        await playback(false);
        let source = await readFile(new URL('patch.js', folder), 'utf8');
        const variant = process.argv[3] || 'stereo';
        if (variant === 'mono') source = source.replace(".connect('right.out', 'main.R')", ".connect('left.out', 'main.R')");
        else if (variant === 'inverted' || variant === 'half-right') {
            source = source.replace(".connect('right.out', 'main.R')", `.module('atten','probe',{atten1:${variant === 'inverted' ? 0 : 0.75},offset1:0.5},{row:2,index:9})\n  .connect('left.out','probe.in1').connect('probe.out1','main.R')`);
        } else if (variant === 'mute') source = source.replace(/(\.module\('out', 'main', \{volume: )[\d.]+/, (_,prefix) => prefix+'0');
        else if (variant !== 'stereo') throw new Error('Unknown patch variant.');
        const before = await invoke('get_rack');
        const draft = await invoke('validate_script', {source,expectedRevision:before.revision});
        const applied = await invoke('apply_draft', {draftId:draft.draftId, discardUnsavedChanges:before.hasUnsavedChanges});
        if (!applied.applied) throw new Error('Draft was not applied.');
        state.variant = variant;
        await writeFile(stateFile, JSON.stringify(state));
        const rack = await invoke('get_rack');
        if (variant === 'stereo') await writeFile(new URL('patch.json',folder), JSON.stringify(rack.patch,null,2)+'\n');
        console.log(JSON.stringify({variant,revision:rack.revision,diagnostics:await invoke('debug_rack')}));
    } else if (command === 'play' || command === 'stop') {
        await playback(command === 'play');
        console.log(JSON.stringify({playing:command === 'play'}));
    } else if (command === 'measure') {
        const label = process.argv[3] || 'measurement';
        if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple measurement label.');
        const rack = await invoke('get_rack');
        const result = await invoke('measure_audio', {expectedRevision:rack.revision,durationSeconds:Number(process.argv[4] || 8)});
        await mkdir(new URL('measurements/',folder), {recursive:true});
        await writeFile(new URL(`measurements/${label}.json`,folder), JSON.stringify({variant:state.variant,patch:rack.patch,...result},null,2)+'\n');
        console.log(JSON.stringify({label,capture:result.capture,levels:result.report.levels,stereo:result.report.stereo,
            loudness:result.report.loudness,spectral:result.report.spectral},null,2));
    } else if (command === 'save') {
        await playback(false);
        const dialog = page.getByRole('dialog',{name:'Save patch',exact:true});
        if (!await dialog.isVisible()) await page.locator('#savePatch').click();
        await dialog.getByRole('textbox',{name:'Patch name',exact:true}).fill('Offset');
        await dialog.getByRole('combobox',{name:'Save to',exact:true}).selectOption('local');
        await dialog.getByRole('button',{name:'Save',exact:true}).click();
        await dialog.waitFor({state:'hidden'});
        const saved = await page.evaluate(() => window.eurorackApp.patchLibrary.active);
        state.patchId = saved.id;
        await writeFile(stateFile,JSON.stringify(state));
        console.log(JSON.stringify({name:saved.name,source:saved.source,id:saved.id,url:page.url()}));
    } else if (command === 'snapshot') {
        await page.screenshot({path:fileURLToPath(new URL('rack.png',folder)),fullPage:true});
        console.log(fileURLToPath(new URL('rack.png',folder)));
    } else if (command === 'open-saved') {
        const rack = await invoke('get_rack');
        assert.deepEqual(rack.patch, JSON.parse(await readFile(new URL('patch.json',folder),'utf8')));
        const diagnostics = await invoke('debug_rack');
        const snapshotUrl = await page.evaluate(() => window.eurorackApp.getPatchUrl({name:'Offset',state:window.eurorackApp.host.serializePatch()}));
        await writeFile(new URL('snapshot-url.txt',folder), snapshotUrl+'\n');
        await page.screenshot({path:fileURLToPath(new URL('rack.png',folder)),fullPage:true});
        console.log(JSON.stringify({name:'Offset',url:page.url(),restoredExactly:true,diagnostics}));
    } else throw new Error(`Unknown command: ${command}`);
} finally {await cdp.detach(); await browser.close();}
