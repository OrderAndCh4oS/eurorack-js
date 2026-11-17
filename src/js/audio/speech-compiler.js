import { validateSpeechPhrase } from './speech-plan.js';
const cancelled=()=>{const error=new Error('Speech preparation cancelled.');error.name='AbortError';return error;};
/** One disposable Worker per edit; cancellation never queues old paragraphs. */
export function createSpeechCompiler({WorkerClass=globalThis.Worker,timeoutMs=15000}={}) {
    let pending=null,disposed=false;
    const cancel=()=>{if(pending)pending.finish(cancelled());};
    return {
        prepare(text){
            cancel();
            if(disposed)return Promise.reject(cancelled());
            if(typeof text!=='string'||text.length>240)return Promise.reject(new Error('Use at most 240 characters.'));
            if(!text.trim())return Promise.resolve({schema:1,text:'',bodies:[0,1].map(()=>({duration:0,gestures:[],segments:[]}))});
            return new Promise((resolve,reject)=>{
                let worker;
                try{worker=new WorkerClass(new URL('./speech-worker.js',import.meta.url),{type:'module'});}
                catch(error){reject(error);return;}
                let done=false;
                const job={finish(error,value){
                    if(done)return;done=true;clearTimeout(timer);worker.terminate();
                    if(pending===job)pending=null;
                    if(error)reject(error);else resolve(value);
                }};
                const timer=setTimeout(()=>job.finish(new Error('Speech preparation timed out. Try a shorter passage.')),timeoutMs);
                pending=job;
                worker.onmessage=({data})=>{
                    if(data.error)job.finish(new Error(data.error));
                    else{try{job.finish(null,validateSpeechPhrase(data.phrase));}catch(error){job.finish(error);}}
                };
                worker.onerror=event=>job.finish(new Error(event.message||'Speech preparation failed.'));
                worker.postMessage({text});
            });
        },
        dispose(){disposed=true;cancel();}
    };
}
