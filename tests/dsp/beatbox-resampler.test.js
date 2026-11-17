import { describe,expect,it } from 'vitest';
import { createBeatboxResampler,prepareBeatboxResampler } from '../../src/js/audio/beatbox-resampler.js';
function oscillator(hz){let n=0;const out=new Float32Array(32);return {render(count){for(let i=0;i<count;i++)out[i]=Math.sin(2*Math.PI*hz*n++/48000);return out;},reset(){n=0;}};}
const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
describe('Beatbox streaming sinc reader',()=>{
 it('prepares shared tables once and preserves unity gain in the pass band',()=>{expect(prepareBeatboxResampler()).toBe(prepareBeatboxResampler());const r=createBeatboxResampler(oscillator(1000));const a=Float32Array.from({length:8192},()=>r.next(1));expect(rms(a.slice(512))).toBeCloseTo(Math.SQRT1_2,2);});
 it('suppresses source frequencies that would alias when tuning an octave up',()=>{const r=createBeatboxResampler(oscillator(18000));const a=Float32Array.from({length:8192},()=>r.next(2));expect(rms(a.slice(512))).toBeLessThan(.002);});
 it('resets all interpolation history and returns finite samples through live pitch changes',()=>{const source=oscillator(440),r=createBeatboxResampler(source);const a=Float32Array.from({length:1024},(_,i)=>r.next(.5+1.5*i/1024));source.reset();r.reset();const b=Float32Array.from({length:1024},(_,i)=>r.next(.5+1.5*i/1024));expect(a).toEqual(b);expect(a.every(Number.isFinite)).toBe(true);});
});
