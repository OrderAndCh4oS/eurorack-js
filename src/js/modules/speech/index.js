import { createAirwayKernel, prepareAirway } from '../../audio/chimera-kernel.js';
import { createSpeechCursor, validateSpeechPhrase } from '../../audio/speech-plan.js';
import { DEFAULT_SPEECH } from '../../../wasm/speech/manifest.js';
import { createSlew } from '../../utils/slew.js';
import { softLimitVoltage } from '../../utils/voltage.js';
import { renderSpeechPanel, SPEECH_CSS } from './panel.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(x,f=0)=>Number.isFinite(x)?x:f;
const control=(x,f,a,b)=>clamp(finite(x,f),a,b);
const input=(port,label,signal='cv')=>({id:port,port,label,signal,voltage:{min:signal==='cv'?-5:0,max:signal==='cv'?5:10,normal:0}});
export const SPEECH_UI={
    leds:['busy','level'],
    knobs:[
        {id:'pitch',param:'pitch',label:'Pitch',min:-24,max:24,default:0},
        {id:'rate',param:'rate',label:'Rate',min:.5,max:2,default:1},
        {id:'contour',param:'contour',label:'Contour',min:0,max:2,default:1},
        {id:'breath',param:'breath',label:'Breath',min:0,max:1,default:.15},
        {id:'level',param:'level',label:'Level',min:0,max:1,default:.8}
    ],
    switches:[{id:'female',param:'female',label:'Female',default:0},{id:'restart',param:'restart',label:'Restart',default:0}],
    actions:[{id:'speak',param:'speak',label:'Speak',mode:'trigger',default:0},{id:'stopAction',param:'stopAction',label:'Stop',mode:'trigger',default:0}],
    state:[
        {param:'text',default:DEFAULT_SPEECH.text,validate(value){if(typeof value!=='string'||value.length>240)throw new Error('Speech text must contain at most 240 characters.');}},
        {param:'phrase',default:DEFAULT_SPEECH,validate:validateSpeechPhrase}
    ],
    inputs:[input('trig','Trig','trigger'),input('stop','Stop','trigger'),input('vOct','V/Oct'),input('rateCV','Rate'),input('contourCV','Contour'),input('breathCV','Breath')],
    outputs:[{id:'out',port:'out',label:'Out',signal:'audio',voltage:{min:-5,max:5}},
        {id:'busy',port:'busy',label:'Busy',signal:'gate',voltage:{min:0,max:10}},
        {id:'end',port:'end',label:'End',signal:'trigger',voltage:{min:0,max:10}}]
};

function createDSP({sampleRate=44100,bufferSize=512}={}) {
    const kernels=[createAirwayKernel(sampleRate),createAirwayKernel(sampleRate,'female')];
    const inputs=Object.fromEntries(SPEECH_UI.inputs.map(p=>[p.port,new Float32Array(bufferSize)]));
    const outputs=Object.fromEntries(SPEECH_UI.outputs.map(p=>[p.port,new Float32Array(bufferSize)]));
    const params=Object.fromEntries([...SPEECH_UI.knobs,...SPEECH_UI.switches,...SPEECH_UI.actions,...SPEECH_UI.state].map(c=>[c.param,c.default]));
    let ready=DEFAULT_SPEECH;
    Object.defineProperty(params,'phrase',{enumerable:true,get:()=>ready,set:value=>{ready=validateSpeechPhrase(value);}});
    const cursor=createSpeechCursor(), emptyFrame=new Float64Array(66);
    const gainEnvelope=new Float64Array(bufferSize), bridgeEnvelope=new Float64Array(bufferSize);
    const levelSlew=createSlew({sampleRate,timeMs:5}), rateSlew=createSlew({sampleRate,timeMs:5});
    const pitchSlew=createSlew({sampleRate:sampleRate/64,timeMs:5});
    const contourSlew=createSlew({sampleRate:sampleRate/64,timeMs:5}), breathSlew=createSlew({sampleRate:sampleRate/64,timeMs:5});
    const releaseSamples=Math.ceil(.15*sampleRate), stopSamples=Math.ceil(.005*sampleRate), fadeSamples=Math.ceil(.01*sampleRate), bridgeSamples=Math.ceil(.005*sampleRate);
    const meterDecay=Math.exp(-1/(sampleRate*.05));
    let state=0, active=ready, body=ready.bodies[0], tract=0, position=0, phase=0, tail=0, attack=0;
    let lastTrig=0,lastStop=0,lastSpeak=0,lastStopAction=0,endRemaining=0,disposed=false,initialized=false;
    let meter=0,lastRaw=0,bridgeBase=0,spanStart=0,levelTarget=.8,rateTarget=1,segmentIndex=0;
    const dsp={params,inputs,outputs,leds:{busy:0,level:0},position:0,progress:0,activeText:'',activeTract:0,
        phoneme:'',pitchHz:110,rateValue:1,contourValue:1,breathValue:.15,displayTick:0,
        process(){
            if(disposed){for(const out of Object.values(outputs))out.fill(0);return;}
            levelTarget=control(params.level,.8,0,1);
            if(!initialized){levelSlew.reset(levelTarget);initialized=true;}
            spanStart=0;
            const speak=finite(params.speak)>=.5, stopAction=finite(params.stopAction)>=.5;
            for(let i=0;i<bufferSize;i++) {
                const trig=finite(inputs.trig[i]), stop=finite(inputs.stop[i]);
                const startEdge=(trig>=1&&lastTrig<1)||(i===0&&speak&&!lastSpeak);
                const stopEdge=(stop>=1&&lastStop<1)||(i===0&&stopAction&&!lastStopAction);
                lastTrig=trig;lastStop=stop;
                if(state===1&&position>=body.duration){flush(i);state=2;tail=releaseSamples;phase=0;}
                if((state===2||state===3)&&tail<=0){
                    flush(i); if(state===2)endRemaining=Math.ceil(.01*sampleRate); state=0;lastRaw=0;
                }
                if(stopEdge){
                    flush(i);if(state){state=3;tail=stopSamples;phase=0;}
                } else if(startEdge&&(!state||finite(params.restart)>=.5)) {
                    flush(i);
                    const nextTract=finite(params.female)>=.5?1:0;
                    if(ready.bodies[nextTract].gestures.length){
                        bridgeBase=lastRaw; active=ready;tract=nextTract;body=active.bodies[tract];position=0;state=1;phase=0;attack=0;segmentIndex=0;
                        kernels[tract].reset();cursor.start(body);resetControls(i);
                        dsp.activeText=active.text;dsp.activeTract=tract;
                    }else if(state){state=3;tail=stopSamples;phase=0;}
                }
                if(state&&phase===0){flush(i);updateControls(i);}
                outputs.busy[i]=state?10:0;
                outputs.end[i]=endRemaining>0?10:0; if(endRemaining>0)endRemaining--;
                const fade=state===1?Math.min(1,attack/bridgeSamples):state===2?Math.min(1,tail/fadeSamples):state===3?tail/stopSamples:0;
                gainEnvelope[i]=fade;bridgeEnvelope[i]=state===1?1-fade:0;
                if(state===1){dsp.rateValue=rateSlew.process(rateTarget);position+=dsp.rateValue/sampleRate;attack++;}
                else if(state)tail--;
                if(state)phase=(phase+1)&63;
            }
            flush(bufferSize);lastSpeak=speak;lastStopAction=stopAction;
            dsp.position=position;dsp.progress=state?clamp(position/Math.max(body.duration,.001),0,1):0;
            dsp.leds.busy=state?1:0;dsp.leds.level=clamp(meter,0,1);dsp.displayTick=(dsp.displayTick+1)>>>0;
        },
        reset(){
            if(disposed)return;
            for(const kernel of kernels)kernel.reset();state=0;position=0;phase=0;tail=0;attack=0;endRemaining=0;
            lastTrig=lastStop=lastSpeak=lastStopAction=0;lastRaw=bridgeBase=meter=0;initialized=false;
            for(const out of Object.values(outputs))out.fill(0);for(const inp of Object.values(inputs))inp.fill(0);
            dsp.position=dsp.progress=dsp.displayTick=0;dsp.activeText='';dsp.phoneme='';dsp.leds.busy=dsp.leds.level=0;
        },
        getKernelDiagnostics(){return kernels.map(k=>({memoryBytes:k.memoryBytes,allocations:k.allocationCount,stack:k.boundaryStackPointer}));},
        dispose(){if(disposed)return;dsp.reset();for(const kernel of kernels)kernel.dispose();disposed=true;}
    };
    function flush(end){
        const length=end-spanStart;if(!length)return;
        const audio=state?kernels[tract].render(length):null;
        for(let j=0;j<length;j++){
            const i=spanStart+j;
            lastRaw=(audio?audio[j]*gainEnvelope[i]:0)+bridgeBase*bridgeEnvelope[i];
            const value=softLimitVoltage(lastRaw*5*levelSlew.process(levelTarget),5,.8);
            outputs.out[i]=value;meter=Math.max(Math.abs(value)/5,meter*meterDecay);
        }
        spanStart=end;
    }
    function resetControls(i){
        rateTarget=clamp(control(params.rate,1,.5,2)*2**(finite(inputs.rateCV[i])/5),.5,2);
        rateSlew.reset(rateTarget);pitchSlew.reset(control(params.pitch,0,-24,24)/12+finite(inputs.vOct[i]));
        contourSlew.reset(clamp(control(params.contour,1,0,2)+finite(inputs.contourCV[i])/5,0,2));
        breathSlew.reset(clamp(control(params.breath,.15,0,1)+finite(inputs.breathCV[i])/5,0,1));
    }
    function updateControls(i){
        const frame=state===1?cursor.blend(position):emptyFrame;
        const contour=contourSlew.process(clamp(control(params.contour,1,0,2)+finite(inputs.contourCV[i])/5,0,2));
        const breath=breathSlew.process(clamp(control(params.breath,.15,0,1)+finite(inputs.breathCV[i])/5,0,1));
        const pitch=pitchSlew.process(control(params.pitch,0,-24,24)/12+finite(inputs.vOct[i]));
        const planned=(110*.02+frame[60]*frame[61])/(.02+frame[61]);
        const hz=clamp(110*2**(pitch+contour*Math.log2(planned/110)),40,1100);
        kernels[tract].setSpeech(frame,hz,breath);
        rateTarget=clamp(control(params.rate,1,.5,2)*2**(finite(inputs.rateCV[i])/5),.5,2);
        dsp.pitchHz=hz;dsp.contourValue=contour;dsp.breathValue=breath;
        while(segmentIndex<body.segments.length-1&&body.segments[segmentIndex][1]<position)segmentIndex++;
        dsp.phoneme=state===1&&body.segments.length?body.segments[segmentIndex][2]:'';
    }
    return dsp;
}

export default {id:'speech',name:'SPEECH',hp:28,color:'module-color-six',category:'voice',
    prepareDSP({sampleRate}){prepareAirway(sampleRate);prepareAirway(sampleRate,'female');},createDSP,
    ui:SPEECH_UI,render(container,context){return renderSpeechPanel(container,context,SPEECH_UI);},css:SPEECH_CSS,
    telemetry:{fields:['position','progress','activeText','activeTract','phoneme','pitchHz','rateValue','contourValue','breathValue','displayTick'],methods:[]}
};
