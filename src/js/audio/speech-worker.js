import { SPEECH_PLANNER } from '../../wasm/speech/manifest.js';
import { validateSpeechPhrase } from './speech-plan.js';
self.onmessage=async ({data})=>{
    try {
        if(typeof data.text!=='string'||data.text.length>240)throw new Error('Use at most 240 characters.');
        const api=await import(SPEECH_PLANNER.moduleUrl);
        await api.default();
        const response=await fetch(SPEECH_PLANNER.dictionaryUrl);
        if(!response.ok)throw new Error('The pronunciation dictionary could not be loaded.');
        const dictionary=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
        const planner=new api.SpeechPlanner(dictionary);
        try { self.postMessage({phrase:validateSpeechPhrase(JSON.parse(planner.plan(data.text)))}); }
        finally { planner.free(); }
    }catch(error){self.postMessage({error:error?.message||String(error)});}
};
