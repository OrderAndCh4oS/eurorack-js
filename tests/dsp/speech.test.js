// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import speech from '../../src/js/modules/speech/index.js';
import { DEFAULT_SPEECH } from '../../src/wasm/speech/manifest.js';
import { assertModuleParam } from '../../src/js/rack/module-contract.js';
const instances=[];
function make(options={}) { const d=speech.createDSP({sampleRate:48000,bufferSize:128,...options}); instances.push(d); return d; }
afterEach(()=>{ for(const d of instances) d.dispose(); instances.length=0; });
function tick(d,n=1) { for(let i=0;i<n;i++) d.process(); }
function hit(d) { d.inputs.trig[0]=10; d.process(); d.inputs.trig.fill(0); }
function capture(d,samples) { const out=new Float32Array(samples); for(let i=0;i<samples;i+=d.outputs.out.length) { d.process(); out.set(d.outputs.out.subarray(0,Math.min(samples-i,d.outputs.out.length)),i); } return out; }
const rms = x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);
describe('SPEECH physical phrase voice',()=>{
    it('tracks octave CV in the rendered voiced waveform',()=>{
        const phrase={schema:1,text:'Ah',bodies:DEFAULT_SPEECH.bodies.map(body=>{
            const posture=body.gestures.find(g=>g[4]===1&&g[7].length>12)[7];
            return {duration:.9,segments:[[.02,.8,'ɛ']],gestures:[[.01,.8,.01,.02,1,1,0,[19,1]],[.02,.8,.01,.05,1,1,0,posture]]};
        })};
        for(const cv of [0,1,2]){
            const d=make();d.params.phrase=phrase;d.params.contour=0;d.inputs.vOct.fill(cv);hit(d);
            const sound=capture(d,30000),expected=110*2**cv;let best=-1,lagBest=0;
            for(let lag=Math.floor(48000/(expected*1.1));lag<=Math.ceil(48000/(expected*.9));lag++){
                let sum=0,a=0,b=0;for(let i=12000;i<20000;i++){sum+=sound[i]*sound[i+lag];a+=sound[i]*sound[i];b+=sound[i+lag]*sound[i+lag];}
                const correlation=sum/Math.sqrt(a*b);if(correlation>best){best=correlation;lagBest=lag;}
            }
            expect(best).toBeGreaterThan(.95);expect(Math.abs(48000/lagBest/expected-1)).toBeLessThan(.02);
        }
    });
    it.each([44100,48000,96000].flatMap(rate=>[128,512].map(size=>[rate,size])))('audits sounding controls at %s Hz / %s frames', (sampleRate,bufferSize)=>{
        // The generic audit drives Stop and Trig simultaneously. Explicitly
        // leave Stop normal here so every voice-control extreme produces sound.
        for(const c of speech.ui.knobs)for(const value of [c.min,c.max]){
            const d=make({sampleRate,bufferSize});d.params[c.param]=value;hit(d);
            const sound=capture(d,Math.ceil(sampleRate*.4));
            expect(sound.every(v=>Number.isFinite(v)&&Math.abs(v)<=5)).toBe(true);
            if(c.param!=='level'||value!==0)expect(rms(sound)).toBeGreaterThan(.00001);
            d.dispose();instances.pop();
        }
    });
    it('initializes ready but silent, with stable buffers and bounded ports',()=>{
        const d=make(), input=d.inputs.trig, out=d.outputs.out;
        tick(d,3); expect(out.every(v=>v===0)).toBe(true); expect(d.params.phrase.text).toBe(DEFAULT_SPEECH.text);
        expect(d.outputs.busy.every(v=>v===0)).toBe(true);
        hit(d); const sound=capture(d,48000); expect(rms(sound)).toBeGreaterThan(.01);
        expect(sound.every(v=>Number.isFinite(v)&&Math.abs(v)<=5)).toBe(true);
        expect(d.inputs.trig).toBe(input); expect(d.outputs.out).toBe(out); expect(d.leds.busy).toBe(1);
    });
    it.each([.5,1,2])('Rate %s controls completion independently of Pitch and emits exactly 10 ms End',rate=>{
        const d=make(); d.params.rate=rate; d.params.pitch=12; d.inputs.trig[0]=10;
        let samples=0, endSamples=0, completed=-1;
        const expected=DEFAULT_SPEECH.bodies[0].duration/rate+.15;
        while(samples<Math.ceil((expected+.05)*48000)) {
            d.process(); d.inputs.trig.fill(0);
            for(let i=0;i<128;i++) if(d.outputs.end[i]>0) { if(completed<0) completed=samples+i; endSamples++; }
            samples+=128;
        }
        expect(completed/48000).toBeCloseTo(expected,3); expect(endSamples).toBe(480);
        expect(d.outputs.busy.every(v=>v===0)).toBe(true); expect(d.outputs.out.every(v=>v===0)).toBe(true);
    });
    it('Finish ignores held/repeated triggers; Restart starts the current ready revision',()=>{
        const d=make(); hit(d); tick(d,100); const position=d.position;
        hit(d); expect(d.position).toBeGreaterThan(position);
        d.params.restart=1; hit(d); expect(d.position).toBeLessThan(.005);
        d.inputs.trig.fill(10); tick(d,20); expect(d.position).toBeGreaterThan(.04);
        expect(d.outputs.end.every(v=>v===0)).toBe(true);
    });
    it('Stop wins simultaneous triggers and releases silently without End',()=>{
        const d=make(); hit(d); tick(d,100);
        d.inputs.stop[0]=10; d.inputs.trig[0]=10; d.process();
        d.inputs.stop.fill(0); d.inputs.trig.fill(0); tick(d,4);
        expect(d.outputs.out.every(v=>v===0)).toBe(true); expect(d.leds.busy).toBe(0);
        expect(d.outputs.end.every(v=>v===0)).toBe(true);
    });
    it('captures the prepared phrase at a trigger and clears intentionally empty text',()=>{
        const d=make(); hit(d); tick(d,40);
        const empty={schema:1,text:'',bodies:[0,1].map(()=>({duration:0,gestures:[],segments:[]}))};
        d.params.phrase=empty; tick(d,40); expect(d.activeText).toBe(DEFAULT_SPEECH.text); expect(d.leds.busy).toBe(1);
        d.params.restart=1; hit(d); tick(d,5); expect(d.outputs.out.every(v=>v===0)).toBe(true);
        expect(d.outputs.end.every(v=>v===0)).toBe(true);
    });
    it('validates prepared state at public parameter admission',()=>{
        expect(()=>assertModuleParam(speech,'phrase',{})).toThrow(/speech/i);
        expect(()=>assertModuleParam(speech,'text','a'.repeat(241))).toThrow();
        expect(()=>assertModuleParam(speech,'phrase',DEFAULT_SPEECH)).not.toThrow();
    });
    it('updates Rate, Pitch, Contour and Breath during the same phrase',()=>{
        const d=make(); hit(d); tick(d,40);
        d.inputs.rateCV.fill(5); d.inputs.vOct.fill(1); d.inputs.contourCV.fill(-5); d.inputs.breathCV.fill(5);
        tick(d,40); expect(d.rateValue).toBeCloseTo(2,3); expect(d.pitchHz).toBeCloseTo(220,1);
        expect(d.contourValue).toBeLessThan(.001); expect(d.breathValue).toBeCloseTo(1,3);
    });
    it('latches the tract at phrase start and produces distinct equal-pitch voices',()=>{
        const a=make(), b=make(); a.params.contour=b.params.contour=0; b.params.female=1;
        hit(a); hit(b); const male=capture(a,24000), female=capture(b,24000);
        expect(rms(male)).toBeGreaterThan(.01); expect(rms(female)).toBeGreaterThan(.01); expect(female).not.toEqual(male);
        a.params.female=1; tick(a); expect(a.activeTract).toBe(0);
        a.params.restart=1; hit(a); expect(a.activeTract).toBe(1);
    });
    it('is invariant across block sizes and resets all transport state',()=>{
        const a=make({bufferSize:128}), b=make({bufferSize:17});
        a.params.speak=b.params.speak=1;
        expect(capture(a,16384)).toEqual(capture(b,16384));
        a.reset(); expect(a.position).toBe(0); expect(a.outputs.out.every(v=>v===0)).toBe(true);
        a.params.speak=0; tick(a); expect(a.leds.busy).toBe(0);
    });
    it.each([44100,48000,96000])('bounds extremes and keeps memory fixed at %s Hz',sampleRate=>{
        const d=make({sampleRate}); d.params.pitch=24; d.params.rate=2; d.params.breath=1; d.params.contour=2;
        const before=d.getKernelDiagnostics(); hit(d); const audio=capture(d,16384);
        expect(audio.every(v=>Number.isFinite(v)&&Math.abs(v)<=5)).toBe(true);
        expect(d.getKernelDiagnostics()).toEqual(before);
        d.params.level=0; tick(d,Math.ceil(sampleRate*.1/128)); expect(Math.max(...d.outputs.out.map(Math.abs))).toBeLessThan(.00001);
    });
});
