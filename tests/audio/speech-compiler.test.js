// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSpeechCompiler } from '../../src/js/audio/speech-compiler.js';
import { DEFAULT_SPEECH } from '../../src/wasm/speech/manifest.js';
import { validateSpeechAssets } from '../../scripts/speech-assets.mjs';
describe('Speech preparation lifecycle',()=>{
    it('ships reproducible assets and dictionary',async()=>{expect((await validateSpeechAssets()).files).toHaveLength(5);});
    it('terminates superseded workers and never accepts a stale result',async()=>{
        const workers=[];
        class Worker {constructor(){workers.push(this);}postMessage=vi.fn();terminate=vi.fn();}
        const compiler=createSpeechCompiler({WorkerClass:Worker});
        const first=compiler.prepare('one').catch(e=>e.name),second=compiler.prepare('two');
        expect(await first).toBe('AbortError');expect(workers[0].terminate).toHaveBeenCalledOnce();
        workers[0].onmessage({data:{phrase:DEFAULT_SPEECH}});
        workers[1].onmessage({data:{phrase:DEFAULT_SPEECH}});
        expect(await second).toEqual(DEFAULT_SPEECH);expect(workers[1].terminate).toHaveBeenCalledOnce();compiler.dispose();
    });
    it('clears empty text without a worker and cancels on removal',async()=>{
        const workers=[];class Worker{constructor(){workers.push(this);}postMessage(){}terminate(){}}
        const c=createSpeechCompiler({WorkerClass:Worker});expect((await c.prepare('')).text).toBe('');expect(workers).toHaveLength(0);
        const pending=c.prepare('Hello').catch(e=>e.name);c.dispose();expect(await pending).toBe('AbortError');
        await expect(c.prepare('Hello')).rejects.toMatchObject({name:'AbortError'});
    });
    it('rejects failed or malformed results',async()=>{
        let worker;class Worker{constructor(){worker=this;}postMessage(){}terminate(){}}
        const c=createSpeechCompiler({WorkerClass:Worker});
        let p=c.prepare('Hello');worker.onmessage({data:{error:'Invalid text'}});await expect(p).rejects.toThrow('Invalid text');
        p=c.prepare('Hello');worker.onmessage({data:{phrase:{}}});await expect(p).rejects.toThrow(/Invalid/);c.dispose();
    });
});
