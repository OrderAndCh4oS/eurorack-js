import { afterEach, describe, expect, it } from 'vitest';
import beatbox from '../../src/js/modules/beatbox/index.js';
import pro from '../../src/js/modules/beatbox-pro/index.js';
import { createAirwayKernel } from '../../src/js/audio/chimera-kernel.js';
const instances=[];
function make(def=beatbox,params={},rate=48000,size=128){const d=def.createDSP({sampleRate:rate,bufferSize:size});Object.assign(d.params,params);instances.push(d);return d;}
afterEach(()=>instances.splice(0).forEach(d=>d.dispose()));
function render(d,frames,schedule){const n=d.outputs.out.length,out=new Float32Array(Math.ceil(frames/n)*n);for(let b=0;b<out.length;b+=n){for(let i=0;i<n;i++){d.inputs.trig[i]=b+i<240?10:0;schedule?.(b+i,i,d);}d.process();out.set(d.outputs.out,b);}return out;}
const energy=a=>a.reduce((s,v)=>s+v*v,0)/a.length;
const peak=a=>a.reduce((s,v)=>Math.max(s,Math.abs(v)),0);
describe.each([['BEATBOX',beatbox],['BEATBOX PRO',pro]])('%s upgraded percussion',(name,def)=>{
 it('declares Tune/Decay/Snap with CV and a persistent Clamp/Wrap toggle',()=>{
  const d=make(def);expect(d.params).toMatchObject({pitch:0,decay:1,snap:.5,wrap:0});
  for(const port of ['vOct','decayCV','snapCV'])expect(d.inputs[port]).toBeInstanceOf(Float32Array);
  expect(def.ui.knobs.find(k=>k.param==='pitch').label).toBe('Tune');expect(def.ui.switches.find(k=>k.param==='wrap')).toBeTruthy();
 });
 it.each([[-.5,9],[0,0],[4.5,9],[5,0],[5.5,1],[-5.5,9]])('wraps Sound CV %s V to %s at the trigger',(cv,expected)=>{
  const d=make(def,{wrap:1});render(d,128,(n,i)=>{d.inputs.soundCV[i]=n===31?cv:2;d.inputs.trig[i]=n>=31?10:0;});expect(d.soundIndex).toBe(expected);
 });
 it('clamps when Wrap is disabled and never switches an already sounding hit',()=>{
  const d=make(def);d.inputs.soundCV.fill(8);render(d,128);expect(d.soundIndex).toBe(9);
  d.params.wrap=1;d.inputs.soundCV.fill(-.5);render(d,512,(n,i)=>d.inputs.trig[i]=10);expect(d.soundIndex).toBe(9);expect(d.selectedSoundIndex).toBe(9);
 });
 it('captures Decay/Snap at the trigger sample and exposes their effective values',()=>{
  const d=make(def);render(d,128,(n,i)=>{d.inputs.trig[i]=n>=31?10:0;d.inputs.decayCV[i]=n===31?2.5:-5;d.inputs.snapCV[i]=n===31?2.5:-5;});expect(d.decayValue).toBe(2);expect(d.snapValue).toBe(1);
 });
 it.each(Array.from({length:10},(_,i)=>i))('Tune changes the actual audio of sound %i',sound=>{
  const low=render(make(def,{sound,pitch:-12}),16384),high=render(make(def,{sound,pitch:12}),16384);
  expect(energy(low)).toBeGreaterThan(1e-8);expect(energy(high)).toBeGreaterThan(1e-8);expect(low).not.toEqual(high);
  expect(high.every(Number.isFinite)).toBe(true);expect(peak(high)).toBeLessThanOrEqual(5);
 });
 it('tracks Hum octaves in rendered audio',()=>{
  for(const pitch of [-12,0,12]){const d=make(def,{sound:9,pitch,decay:4});const a=render(d,24064).slice(4096),hz=110*2**(pitch/12),lag=48000/hz;let best=Infinity,found=0;
   for(let k=Math.floor(lag*.95);k<=lag*1.05;k++){let e=0;for(let j=0;j<8192;j++)e+=(a[j]-a[j+k])**2;if(e<best){best=e;found=k;}}
   expect(Math.abs(48000/found/hz-1)).toBeLessThan(.02);
  }
 });
 it('lengthens the open-hat tail and changes a snare release with Snap',()=>{
  const short=render(make(def,{sound:2,decay:.25}),32768),long=render(make(def,{sound:2,decay:4}),32768);
  expect(energy(long.slice(12000,24000))).toBeGreaterThan(energy(short.slice(12000,24000))*4);
  expect(render(make(def,{sound:3,snap:0}),8192)).not.toEqual(render(make(def,{sound:3,snap:1}),8192));
 });
 it('is block-size invariant under sample-timed triggers, pitch and sound changes',()=>{
  const a=make(def,{wrap:1},48000,128),b=make(def,{wrap:1},48000,512);
  const schedule=(n,i,d)=>{d.inputs.trig[i]=n%3000<120?10:0;d.inputs.soundCV[i]=n/1300-2;d.inputs.vOct[i]=Math.sin(n/3000)*.8;d.inputs.decayCV[i]=n%1000/500-1;};
  expect(render(a,8192,schedule)).toEqual(render(b,8192,schedule));
 });
});
describe('BEATBOX PRO physical controls and utility outputs',()=>{
 it.each([44100, 48000, 96000].flatMap(rate => [128, 512].map(size => [rate, size])))('renders audible bounded outputs with Choke released at %i Hz / %i frames', (rate, size) => {
  const d = make(pro, { sound: 9, pitch: 12, decay: 4 }, rate, size);
  const refs = { ...d.outputs };
  let audioPeak = 0, envPeak = 0, activePeak = 0;
  for (let block = 0; block < Math.ceil(rate * .1 / size); block++) {
   d.inputs.trig.fill(block === 0 ? 10 : 0);
   d.process();
   for (const [port, values] of Object.entries(d.outputs)) {
    expect(values).toBe(refs[port]);
    expect(values.every(Number.isFinite)).toBe(true);
   }
   expect(d.outputs.out.every(v => Math.abs(v) <= 5)).toBe(true);
   expect(d.outputs.env.every(v => v >= 0 && v <= 5)).toBe(true);
   expect(d.outputs.active.every(v => v === 0 || v === 10)).toBe(true);
   audioPeak = Math.max(audioPeak, peak(d.outputs.out));
   envPeak = Math.max(envPeak, peak(d.outputs.env));
   activePeak = Math.max(activePeak, peak(d.outputs.active));
  }
  expect(audioPeak).toBeGreaterThan(.001);
  expect(envPeak).toBeGreaterThan(.001);
  expect(activePeak).toBe(10);
 });
 it('matches the compact voice with advanced controls at their neutral defaults',()=>{
  expect(render(make(pro,{sound:3}),16384)).toEqual(render(make(beatbox,{sound:3}),16384));
 });
 it.each([['noise',0,2,3],['nasal',0,1,3],['lips',-1,1,0],['tongue',-1,1,4],['throat',0,1,9],['voicing',0,1,9],['tension',0,1,9],['fry',0,1,9]])('%s changes the physical output',(param,min,max,sound)=>{
  const a=render(make(pro,{sound,[param]:min}),16384),b=render(make(pro,{sound,[param]:max}),16384);
  expect(a).not.toEqual(b);expect(a.every(Number.isFinite)&&b.every(Number.isFinite)).toBe(true);expect(peak(a)).toBeLessThanOrEqual(5);expect(peak(b)).toBeLessThanOrEqual(5);
 });
 it.each([['noise',.4],['nasal',.2],['lips',.2],['tongue',.2],['throat',.2],['voicing',.2],['tension',.2],['fry',.2]])('%s CV matches the corresponding knob offset',(param,scale)=>{
  const base=param==='noise'?1:param==='voicing'?1:param==='tension'?.5:0,cv=base===1?-1:1;
  const a=make(pro,{sound:9,[param]:base+cv*scale}),b=make(pro,{sound:9});b.inputs[`${param}CV`].fill(cv);
  expect(render(a,8192)).toEqual(render(b,8192));
 });
 it('Choke wins over simultaneous hits, fades without a discontinuity and blocks while held',()=>{
  const d=make(pro,{sound:9,decay:4});render(d,8192);let previous=d.outputs.out.at(-1);
  d.inputs.choke.fill(10);const a=render(d,1024);expect(Math.abs(a[0]-previous)).toBeLessThan(1);expect(peak(a.slice(256))).toBe(0);expect(d.outputs.active.every(v=>v===0)).toBe(true);
  expect(peak(render(d,4096))).toBe(0);d.inputs.choke.fill(0);render(d,128,(n,i)=>d.inputs.trig[i]=0);expect(peak(render(d,8192))).toBeGreaterThan(.001);
 });
 it.each([44100,48000,96000])('bounds Env/Active and resets deterministically at %i Hz',rate=>{
  const d=make(pro,{sound:3},rate);const expected=render(d,8192);expect(d.outputs.env.every(v=>v>=0&&v<=5)).toBe(true);expect(d.outputs.active.every(v=>v===0||v===10)).toBe(true);
  const inputs={...d.inputs},outputs={...d.outputs};d.reset();expect(render(d,8192)).toEqual(expected);for(const [k,v]of Object.entries(inputs))expect(d.inputs[k]).toBe(v);for(const[k,v]of Object.entries(outputs))expect(d.outputs[k]).toBe(v);
  for(const p of Object.keys(d.params))d.params[p]=NaN;for(const input of Object.values(d.inputs))input.fill(Infinity);expect(render(d,2048).every(Number.isFinite)).toBe(true);
 });
 it('native timing and repeated physical modifiers allocate nothing and do not accumulate',()=>{
  const k=createAirwayKernel(48000),buffer=k.memoryBuffer,alloc=k.allocationCount;
  k.trigger(3);k.configureBeat(2,.7);const remaining=k.remainingGestureSamples;
  for(let i=0;i<100;i++){k.setBeat(110,0,8,.15,.5,0,1,.2,.3,.2,.2,1);k.render(64);}
  expect(k.memoryBuffer).toBe(buffer);expect(k.allocationCount).toBe(alloc);expect(k.remainingGestureSamples).toBeLessThan(remaining);k.dispose();
 });
});
