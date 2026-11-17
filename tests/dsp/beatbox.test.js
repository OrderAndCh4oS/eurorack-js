import { afterEach, describe, expect, it } from 'vitest';
import beatbox from '../../src/js/modules/beatbox/index.js';
import vocal from '../../src/js/modules/vocal/index.js';
import { validateModuleDefinition } from '../../src/js/rack/module-contract.js';
const live=[];
function make(params={},rate=48000,size=128,def=beatbox){const d=def.createDSP({sampleRate:rate,bufferSize:size});Object.assign(d.params,params);live.push(d);return d;}
afterEach(()=>live.splice(0).forEach(d=>d.dispose()));
function render(d,count,schedule){const size=d.outputs.out.length,out=new Float32Array(Math.ceil(count/size)*size);for(let n=0;n<out.length;n+=size){if(schedule)for(let i=0;i<size;i++)schedule(n+i,i,d);d.process();out.set(d.outputs.out,n);}return out;}
const peak=x=>x.reduce((s,v)=>Math.max(s,Math.abs(v)),0);
const energy=x=>x.reduce((s,v)=>s+v*v,0)/x.length;
const hit=(d,count=12288)=>render(d,count,(n,i)=>d.inputs.trig[i]=n<240?10:0);
describe('Beatbox dedicated percussion voice',()=>{
 it('declares only percussion controls and has no sustaining Gate or vocal mode',()=>{
  validateModuleDefinition(beatbox,{sampleRate:48000,blockSize:128});const d=make();
  expect(beatbox.id).toBe('beatbox');expect(beatbox.hp).toBe(16);expect(beatbox.ui.knobs).toHaveLength(8);
  expect(Object.keys(d.inputs)).toEqual(['trig','soundCV','accent','vOct','shapeCV','pressureCV','decayCV','snapCV']);
  for(const c of [...beatbox.ui.knobs,...beatbox.ui.actions])expect(d.params[c.param]).toBe(c.default);
  for(const key of ['gate','vowelCV','articulationCV'])expect(d.inputs).not.toHaveProperty(key);
  expect(d.params).not.toHaveProperty('mode');expect(render(d,1024).every(v=>v===0)).toBe(true);
 });
 it.each([44100,48000,96000].flatMap(rate=>Array.from({length:10},(_,sound)=>[rate,sound])))('renders sound %i/%i with prompt onset and finite bounded output',(rate,sound)=>{
  const d=make({sound},rate);const audio=hit(d,Math.round(rate*.6)),p=peak(audio);
  expect(p).toBeGreaterThan(.001);expect(p).toBeLessThanOrEqual(5);expect(audio.every(Number.isFinite)).toBe(true);
  expect(audio.findIndex(v=>Math.abs(v)>p*.1)/rate).toBeLessThan(.012);
 });
 it('detects 1 V rising edges, coalesces Hit/Trig, holds once and rearms',()=>{
  const d=make();d.inputs.trig.fill(.999);expect(peak(render(d,1024))).toBe(0);
  d.inputs.trig.fill(1);const first=render(d,8192);expect(peak(first)).toBeGreaterThan(.01);
  expect(peak(render(d,48000).slice(-4096))).toBeLessThan(.001);
  d.reset();d.params.audition=1;d.inputs.trig.fill(1);expect(render(d,8192)).toEqual(first);
  d.params.audition=0;d.inputs.trig.fill(0);render(d,128);d.inputs.trig.fill(1);expect(peak(render(d,4096))).toBeGreaterThan(.01);
 });
 it('captures Sound and Accent at the actual trigger sample',()=>{
  const d=make({sound:1});render(d,128,(n,i)=>{d.inputs.trig[i]=n>=31?10:0;d.inputs.soundCV[i]=n===31?2.5:0;d.inputs.accent[i]=n===31?5:0;});
  expect(d.soundIndex).toBe(6);d.inputs.soundCV.fill(4);d.inputs.trig.fill(10);render(d,1024);expect(d.soundIndex).toBe(6);
  const a=make({sound:3}),b=make({sound:3});b.inputs.accent.fill(5);const lo=hit(a),hi=hit(b);
  expect(energy(hi)).toBeGreaterThan(energy(lo)*1.4);
 });
 it('applies pitch/shape/pressure CV continuously, including Hum',()=>{
  const d=make({sound:9,pitch:12,shape:1});d.inputs.vOct.fill(1);d.inputs.shapeCV.fill(2.5);d.inputs.pressureCV.fill(2.5);hit(d,1024);
  expect(d.pitchHz).toBe(220);expect(d.shapePosition).toBe(3);expect(d.pressureValue).toBe(18);
  d.inputs.vOct.fill(-1);render(d,128);expect(d.pitchHz).toBe(110);expect(d.soundIndex).toBe(9);
 });
 it.each([['pitch',-24,24],['shape',0,4],['pressure',0,22],['breath',0,1],['level',0,1]])('responds to %s and stays within audio rails',(param,min,max)=>{
  const a=make({sound:9,[param]:min}),b=make({sound:9,[param]:max});const lo=hit(a),hi=hit(b);
  expect(lo).not.toEqual(hi);expect(peak(lo)).toBeLessThanOrEqual(5);expect(peak(hi)).toBeLessThanOrEqual(5);
 });
    it('hard-chokes different previous scores at 62.5 ms with exactly one 1 ms transition', () => {
        const a = make({ level: 0.8 });
        const b = make({ level: 0.8 });
        const schedules = [a, b].map((dsp, previous) => render(dsp, 8192, (sample, i) => {
            dsp.inputs.trig[i] = sample < 240 || (sample >= 3000 && sample < 3240) ? 10 : 0;
            dsp.inputs.soundCV[i] = sample < 3000 ? previous * 4 : 1.5;
        }));
        expect(schedules[0].subarray(0, 3000)).not.toEqual(schedules[1].subarray(0, 3000));
        expect(schedules[0][3000]).toBe(schedules[0][2999]);
        expect(schedules[1][3000]).toBe(schedules[1][2999]);
        // The new Pf score is independent of its predecessor after 48 samples.
        expect(schedules[0].subarray(3048)).toEqual(schedules[1].subarray(3048));
        expect(peak(schedules[0].subarray(3000, 3500))).toBeGreaterThan(0.01);
    });

 it('runs independently beside a held Vocal and resets its own buffers deterministically',()=>{
  const v=make({},48000,128,vocal),reference=make({},48000,128,vocal),b=make({sound:3});v.inputs.gate.fill(10);reference.inputs.gate.fill(10);
  const expected=render(reference,8192);const actual=new Float32Array(8192);
  for(let n=0;n<8192;n+=128){b.inputs.trig.fill(n%512===0?10:0);b.process();v.process();actual.set(v.outputs.out,n);}
  expect(actual).toEqual(expected);const stable=b.outputs.out,inputs={...b.inputs};b.reset();const first=hit(b);b.reset();expect(hit(b)).toEqual(first);
  expect(b.outputs.out).toBe(stable);for(const [key,value] of Object.entries(inputs))expect(b.inputs[key]).toBe(value);
  for(const c of beatbox.ui.knobs)b.params[c.param]=NaN;for(const input of Object.values(b.inputs))input.fill(Infinity);expect(render(b,512).every(Number.isFinite)).toBe(true);
  b.dispose();expect(peak(render(b,128))).toBe(0);
 });
});
