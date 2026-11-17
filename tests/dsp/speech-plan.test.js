// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateSpeechPhrase, createSpeechCursor, SPEECH_CHANNELS } from '../../src/js/audio/speech-plan.js';
const gesture = (t0, t1, targets, rest = {}) => [t0,t1,rest.rampIn ?? .1,rest.rampOut ?? .1,rest.strength ?? 1,rest.speed ?? 1,rest.hold ?? 0,targets];
const phrase = gestures => ({ schema: 1, text: 'test', bodies: [0,1].map(() => ({ duration: 2, gestures, segments: [[.1,1,'a']] })) });
describe('Speech plan admission and overlapping gesture cursor', () => {
    it('preserves ramp weights, weighted means and release speed without allocating each tick', () => {
        const p = phrase([gesture(.1,.4,[0,2],{strength:2,speed:4,hold:.2}),gesture(.2,.6,[0,6])]);
        expect(validateSpeechPhrase(p)).toBe(p);
        const c = createSpeechCursor(); c.start(p.bodies[0]);
        const values = c.blend(.05);
        expect(values.length).toBe(SPEECH_CHANNELS * 3);
        expect(values[0]).toBeCloseTo(2); expect(values[1]).toBeCloseTo(1);
        expect(c.blend(.3)).toBe(values);
        expect(values[0]).toBeCloseTo(10/3); expect(values[1]).toBeCloseTo(3); expect(values[2]).toBe(4);
        c.blend(.55); expect(values[0]).toBeCloseTo(6); expect(values[2]).toBe(4);
        c.blend(.8); expect(values[1]).toBe(0); expect(values[2]).toBe(1);
        c.start(p.bodies[0]); expect(c.blend(.3)[0]).toBeCloseTo(10/3);
    });
    it('rejects corrupt, oversized and unsupported plans before rendering', () => {
        for (const p of [null, {}, {...phrase([]),schema:2}, {...phrase([]),text:'a'.repeat(241)},
            phrase([gesture(.1,.4,[99,1])]), phrase([gesture(.1,.4,[0,NaN])]),
            phrase([gesture(.2,.4,[0,2]),gesture(.1,.3,[0,1])]),
            phrase(Array.from({length:65},()=>gesture(.1,.4,[0,1])))]) {
            expect(() => validateSpeechPhrase(p)).toThrow();
        }
    });
    it('retains all gestures of a long passage with a bounded active set', () => {
        const p = phrase(Array.from({length:200},(_,i)=>gesture(.01+i*.008,.02+i*.008,[0,i%4],{rampIn:0,rampOut:0})));
        const c = createSpeechCursor(); c.start(validateSpeechPhrase(p).bodies[0]);
        for(let i=0;i<200;i++) expect(c.blend(.01+i*.008+.001)[1]).toBeGreaterThan(0);
        expect(c.blend(2)[1]).toBe(0);
    });
});
