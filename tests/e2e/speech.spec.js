import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import patch from '../../src/js/config/patches/test-speech.js';
async function capture(page,seconds=1){return page.evaluate(async seconds=>{
    const audio=await window.eurorackApp.host.engine.captureOutput({durationSeconds:seconds});
    let peak=0,sum=0;for(const x of audio.left){if(!Number.isFinite(x))throw new Error('Nonfinite audio');peak=Math.max(peak,Math.abs(x));sum+=x*x;}
    return {peak,rms:Math.sqrt(sum/audio.left.length)};
},seconds);}
test('Speech edits prepare off-thread and saved phrases play with live controls',async({page},testInfo)=>{
    test.slow();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&!/MIDI access denied|Failed to load resource/.test(m.text()))errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400&&/\/(js|wasm)\//.test(r.url()))errors.push(`${r.status()} ${r.url()}`);});
    await page.goto('/');
    await page.waitForFunction(()=>window.eurorackApp?.host,null,{timeout:20000}).catch(e=>{throw new Error(`${e.message}\nBrowser errors: ${errors.join('; ')}`);});
    const state=structuredClone(patch.state);state.cables=state.cables.filter(c=>c.toModule!=='speech');state.params.speech.rate=.5;
    await page.evaluate(state=>window.eurorackApp.loadPatchState(state,{managed:true}),state);
    const panel=page.locator('#module-speech');await expect(panel.locator('.knob')).toHaveCount(5);
    await expect(panel.locator('.jack[data-dir="input"]')).toHaveCount(6);await expect(panel.locator('.jack[data-dir="output"]')).toHaveCount(3);
    const bounds=await panel.boundingBox();
    for(const element of await panel.locator('textarea, button, .knob-container, .jack-container').all()){
        const box=await element.boundingBox();expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width);
        expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height-7);
    }
    await page.locator('#startButton').click();
    await page.waitForFunction(()=>window.eurorackApp.host.engine?.running,null,{timeout:20000}).catch(e=>{throw new Error(`${e.message}\nAudio errors: ${errors.join('; ')}`);});
    await panel.getByRole('button',{name:'Speak',exact:true}).click();
    const audio=await capture(page);expect(audio.rms).toBeGreaterThan(.001);expect(audio.peak).toBeLessThanOrEqual(1);
    const text='She chose three blue shoes. Can you hear my voice?';
    await panel.getByRole('textbox',{name:'Speech text'}).fill(text);
    await expect(panel.locator('.speech-status')).toContainText('unapplied');
    await panel.getByRole('button',{name:'Apply',exact:true}).click();
    await expect(panel.locator('.speech-status')).toContainText('Ready',{timeout:20000});
    await expect.poll(()=>page.evaluate(()=>window.eurorackApp.state.getModule('speech').params.phrase.text)).toBe(text);
    await panel.getByRole('button',{name:'Stop',exact:true}).click();await capture(page,.1);expect((await capture(page,.15)).peak).toBeLessThan(.00001);
    await panel.getByRole('button',{name:'Tract Female',exact:true}).click();
    await page.evaluate(()=>{const h=window.eurorackApp.host;h.setParam('speech','pitch',12);h.setParam('speech','rate',1);});
    await panel.getByRole('button',{name:'Speak',exact:true}).click();
    const female=await capture(page,1);expect(female.rms).toBeGreaterThan(.001);
    await page.evaluate(()=>{const h=window.eurorackApp.host;h.setParam('speech','pitch',0);h.setParam('speech','rate',2);h.setParam('speech','contour',0);});
    await expect.poll(()=>page.evaluate(()=>window.eurorackApp.state.getModule('speech').instance.pitchHz)).toBeCloseTo(110,0);
    // Unsupported text must retain the ready passage.
    await panel.getByRole('textbox',{name:'Speech text'}).fill('你好');await panel.getByRole('button',{name:'Apply',exact:true}).click();
    await expect(panel.locator('.speech-status')).toContainText('English');
    expect(await page.evaluate(()=>window.eurorackApp.state.getModule('speech').params.phrase.text)).toBe(text);
    await panel.getByRole('textbox',{name:'Speech text'}).fill(text);
    const sharedPlanPreserved=await page.evaluate(async()=>{
        const app=window.eurorackApp,options={registry:app.host.registry};
        const {createPatchUrlHash,parsePatchUrlHash}=await import('/js/app/patch-format.js');
        const state=app.host.state.serializePatch(app.host.registry),before=JSON.stringify(state.params.speech.phrase);
        const hash=await createPatchUrlHash({name:'Speech round trip',state},options);
        const parsed=await parsePatchUrlHash(hash,options);
        await app.loadPatchState(parsed.state,{managed:true});
        return JSON.stringify(parsed.state.params.speech.phrase)===before;
    });
    expect(sharedPlanPreserved).toBe(true);
    await expect(panel.getByRole('textbox',{name:'Speech text'})).toHaveValue(text);
    await expect(panel.getByRole('button',{name:'Tract Female',exact:true})).toHaveAttribute('aria-pressed','true');
    await panel.getByRole('button',{name:'Speak',exact:true}).click();expect((await capture(page,1)).rms).toBeGreaterThan(.001);
    await page.evaluate(()=>{const h=window.eurorackApp.host;h.setParam('speech','restart',1);h.setParam('speech','rate',.5);h.setParam('speech','speak',1);h.engine.setProfiling(true,{reset:true});});
    await capture(page,2);
    const singleVoiceProfile=await page.evaluate(()=>window.eurorackApp.host.engine.requestProfilingReport());
    expect(singleVoiceProfile.modules.speech.samples).toBeGreaterThan(100);
    const extra=await page.evaluate(()=>window.eurorackApp.host.addModule('speech').id);
    await page.waitForFunction(()=>{const e=window.eurorackApp.host.engine;return e.activeRevision===e.revision&&!e.pendingTopologies.size;});
    await page.evaluate(id=>{const h=window.eurorackApp.host;h.setParam('speech','restart',1);h.setParam('speech','rate',.5);h.setParam('speech','speak',1);h.setParam(id,'speak',1);h.engine.setProfiling(true,{reset:true});},extra);
    await expect(panel.getByRole('button',{name:'Retrigger Restart',exact:true})).toHaveAttribute('aria-pressed','true');
    await capture(page,2);
    const profile=await page.evaluate(()=>window.eurorackApp.host.engine.requestProfilingReport());
    expect(profile.modules[extra].samples).toBeGreaterThan(100);
    await writeFile(testInfo.outputPath('audio-profile.json'),JSON.stringify({audio,female,singleVoiceProfile,profile},null,2));
    await page.evaluate(id=>window.eurorackApp.host.removeModule(id),extra);
    await page.screenshot({path:testInfo.outputPath('speech.png'),fullPage:true});
    expect(errors).toEqual([]);
});
