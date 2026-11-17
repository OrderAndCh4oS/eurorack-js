export const SPEECH_CHANNELS = 22;
export const SPEECH_MAX_ACTIVE = 64;
const fail = () => { throw new Error('Invalid or unsupported prepared speech. Apply the text again.'); };
const number = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Admission runs when a prepared state is assigned, never on a playback tick. */
export function validateSpeechPhrase(value) {
    if (!value || value.schema !== 1 || typeof value.text !== 'string' || value.text.length > 240 ||
        !Array.isArray(value.bodies) || value.bodies.length !== 2) fail();
    for (const body of value.bodies) {
        if (!body || !number(body.duration, 0, 20) || !Array.isArray(body.gestures) || body.gestures.length > 2048 ||
            !Array.isArray(body.segments) || body.segments.length > 1024) fail();
        let previous = -Infinity;
        const activeEnds = [];
        for (const g of body.gestures) {
            if (!Array.isArray(g) || g.length !== 8 || !number(g[0], 0, 20) || !number(g[1], g[0], 20) ||
                !number(g[2], 0, 1) || !number(g[3], 0, 1) || !number(g[4], 0, 100) ||
                !number(g[5], 0, 100) || !number(g[6], 0, 1) || !Array.isArray(g[7]) || g[7].length > 44 || g[7].length % 2) fail();
            const start = g[0]-g[2], end = g[1]+g[3]+g[6];
            if (start < -1e-8 || start < previous || end > body.duration + 1e-8) fail();
            previous = start;
            for (let i=activeEnds.length-1;i>=0;i--) if (activeEnds[i] < start) activeEnds.splice(i,1);
            activeEnds.push(end); if (activeEnds.length > SPEECH_MAX_ACTIVE) fail();
            let lastKey = -1;
            for (let i=0;i<g[7].length;i+=2) {
                const key=g[7][i], target=g[7][i+1];
                if (!Number.isInteger(key) || key <= lastKey || key >= SPEECH_CHANNELS || !number(target,-100,2000)) fail();
                if ((key===20&&!number(target,40,1100)) || ((key===17||key===18)&&!number(target,0,1)) ||
                    (key===19&&!number(target,-1,2)) || (key===21&&!number(target,0,200))) fail();
                lastKey=key;
            }
        }
        let lastSegment = -Infinity;
        for (const s of body.segments) {
            if (!Array.isArray(s) || s.length!==3 || !number(s[0],0,body.duration) || !number(s[1],s[0],body.duration) ||
                typeof s[2]!=='string' || s[2].length>16 || s[0]<lastSegment) fail();
            lastSegment=s[0];
        }
        if (body.gestures.length === 0 && (body.duration !== 0 || body.segments.length !== 0)) fail();
    }
    if (!value.text.trim() && value.bodies.some(b=>b.gestures.length)) fail();
    return value;
}

/** Exact native activation law with a fixed active set and reused frame buffer. */
export function createSpeechCursor() {
    const active = new Int32Array(SPEECH_MAX_ACTIVE);
    const frame = new Float64Array(SPEECH_CHANNELS * 3);
    let gestures = [], next = 0, count = 0;
    return {
        start(body) { gestures = body.gestures; next = 0; count = 0; frame.fill(0); },
        blend(time) {
            for (let k=0;k<SPEECH_CHANNELS;k++) { frame[k*3]=0; frame[k*3+1]=0; frame[k*3+2]=1; }
            let kept=0;
            for(let i=0;i<count;i++) {
                const g=gestures[active[i]];
                if (g[1]+g[3]+g[6]>=time) active[kept++]=active[i];
            }
            count=kept;
            while(next<gestures.length && gestures[next][0]-gestures[next][2]<=time) {
                const g=gestures[next];
                if (g[1]+g[3]+g[6]>=time) {
                    if(count>=SPEECH_MAX_ACTIVE) throw new Error('Speech gesture overlap exceeded its admitted bound.');
                    active[count++]=next;
                }
                next++;
            }
            for(let i=0;i<count;i++) {
                const g=gestures[active[i]], lo=g[0]-g[2];
                let activation=1;
                if(time<=lo || time>=g[1]+g[3]) activation=0;
                else if(time<g[0]) activation=.5-.5*Math.cos(Math.PI*(time-lo)/Math.max(1e-6,g[2]));
                else if(time>g[1]) activation=.5+.5*Math.cos(Math.PI*(time-g[1])/Math.max(1e-6,g[3]));
                const weight=activation*g[4], targets=g[7];
                for(let j=0;j<targets.length;j+=2) {
                    const offset=targets[j]*3;
                    frame[offset]+=weight*targets[j+1]; frame[offset+1]+=weight;
                    frame[offset+2]=Math.max(frame[offset+2],g[5]);
                }
            }
            for(let k=0;k<SPEECH_CHANNELS;k++) if(frame[k*3+1]>0) frame[k*3]/=frame[k*3+1];
            return frame;
        }
    };
}
