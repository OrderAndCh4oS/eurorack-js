import { createSpeechCompiler } from '../../audio/speech-compiler.js';
export function renderSpeechPanel(container,{instance,toolkit,onParamChange,onCleanup},ui){
    const dsp=instance.dsp,compiler=createSpeechCompiler();
    let disposed=false,preparing=false,error='',revision=0;
    const root=document.createElement('div');root.className='speech-panel';
    const label=document.createElement('label');label.className='speech-text-label';label.textContent='TEXT · ENGLISH';
    const editor=document.createElement('textarea');editor.className='speech-text';editor.rows=3;editor.maxLength=240;editor.spellcheck=false;
    editor.setAttribute('aria-label','Speech text');editor.value=dsp.params.text;label.append(editor);root.append(label);
    editor.addEventListener('keydown',event=>event.stopPropagation());
    editor.addEventListener('input',()=>{onParamChange('text',editor.value);error='';update();});
    toolkit.registerParamControl('text',editor,value=>{if(document.activeElement!==editor)editor.value=value;});
    const actions=toolkit.createRow('speech-actions');
    const apply=document.createElement('button');apply.type='button';apply.className='action-btn';apply.dataset.rendererManaged='true';apply.textContent='Apply';
    apply.addEventListener('click',async()=>{
        const mine=++revision,text=editor.value;preparing=true;error='';update();
        try{const phrase=await compiler.prepare(text);if(!disposed&&mine===revision)onParamChange('phrase',phrase);}
        catch(e){if(!disposed&&mine===revision&&e.name!=='AbortError')error=e.message;}
        finally{if(!disposed&&mine===revision){preparing=false;update();}}
    });
    actions.append(apply,toolkit.createActionButton({...ui.actions[0],value:0}),toolkit.createActionButton({...ui.actions[1],value:0}));root.append(actions);
    const status=document.createElement('div');status.className='speech-status';status.setAttribute('role','status');root.append(status);
    const playing=document.createElement('div');playing.className='speech-playing';root.append(playing);
    const progress=document.createElement('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Phrase progress');root.append(progress);
    const knobs=toolkit.createRow('speech-knobs');for(const c of ui.knobs)knobs.append(toolkit.createKnob({...c,value:dsp.params[c.param],small:true}));root.append(knobs);
    const choices=[];
    for(const [param,title,options] of [['female','TRACT',['Male','Female']],['restart','RETRIGGER',['Finish','Restart']]]){
        const row=toolkit.createRow('speech-choices'),caption=document.createElement('span');caption.textContent=title;row.append(caption);
        options.forEach((label,value)=>{
            const button=document.createElement('button');button.type='button';button.className='action-btn';button.dataset.rendererManaged='true';button.dataset.param=param;button.textContent=label;
            button.setAttribute('aria-label',`${title==='TRACT'?'Tract':'Retrigger'} ${label}`);
            button.addEventListener('click',()=>onParamChange(param,value));row.append(button);
            choices.push(()=>{const active=(dsp.params[param]>=.5?1:0)===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
        });root.append(row);
    }
    const lights=toolkit.createRow('speech-lights');for(const id of ui.leds){const cell=document.createElement('span');cell.append(toolkit.createLED({id,color:'green'}),document.createTextNode(id==='busy'?'BUSY':'OUT'));lights.append(cell);}root.append(lights);
    const sockets=toolkit.createRow('speech-sockets');
    for(const [ports,direction] of [[ui.inputs,'input'],[ui.outputs,'output']])for(const p of ports)sockets.append(toolkit.createJack({id:p.port,label:p.label,signal:p.signal,direction}));
    root.append(sockets);container.append(root);
    let lastTick=0,lastTelemetry=-Infinity;
    function update(){
        const now=performance.now();if(dsp.displayTick!==lastTick){lastTick=dsp.displayTick;lastTelemetry=lastTick?now:-Infinity;}
        const live=now-lastTelemetry<250,busy=live&&dsp.leds.busy>0;
        const dirty=editor.value.trim()!==dsp.params.phrase.text;
        status.textContent=error|| (preparing?'Preparing pronunciation…':dirty?'Edits unapplied · Speak uses the ready text':dsp.params.phrase.text?'Ready · trigger reads the whole text':'Empty · enter text and Apply');
        status.classList.toggle('error',Boolean(error));
        const pitch=live?dsp.pitchHz:110*2**(dsp.params.pitch/12),rate=live?dsp.rateValue:dsp.params.rate;
        playing.textContent=busy?`${dsp.activeText} · ${dsp.phoneme}`:`${pitch.toFixed(0)} Hz · ${rate.toFixed(2)}× · ${dsp.params.restart>=.5?'Restart on trigger':'Finish current phrase'}`;
        playing.title=busy?dsp.activeText:dsp.params.phrase.text;
        progress.value=busy?dsp.progress:0;for(const sync of choices)sync();
    }
    update();toolkit.animate(update);
    onCleanup(()=>{disposed=true;revision++;compiler.dispose();});
}
export const SPEECH_CSS=`
.module-type-speech .module-content{gap:0;min-height:0}
.speech-panel{display:flex;flex-direction:column;width:100%;height:100%;gap:5px;min-height:0}
.speech-text-label{display:flex;flex-direction:column;gap:3px;font-size:8px;letter-spacing:.5px}
.speech-text{resize:none;box-sizing:border-box;width:100%;height:70px;padding:6px;font:12px/1.4 monospace;border:1px solid #8888;border-radius:2px;background:#171b1d;color:#f2e8d3;letter-spacing:normal}
.speech-actions{display:flex;gap:8px;justify-content:center}.speech-actions button{min-width:65px;min-height:24px}
.speech-status{font-size:9px;min-height:24px;line-height:12px;text-align:center;overflow-wrap:anywhere}.speech-status.error{color:#c44926}
.speech-playing{font-size:10px;height:29px;line-height:14px;overflow:hidden;text-align:center;padding:0 3px}
.speech-panel progress{width:100%;height:5px;accent-color:#f58639}
.speech-knobs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:4px 2px}.speech-knobs .knob-label{font-size:9px}
.speech-choices{display:flex;align-items:center;justify-content:center;gap:7px;font-size:9px}.speech-choices>span{width:65px;text-align:right}.speech-choices button{min-width:68px;min-height:22px}
.speech-lights{display:flex;justify-content:center;gap:24px;font-size:8px}.speech-lights>span{display:flex;align-items:center;gap:4px}
.speech-sockets{margin-top:auto;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:2px;padding-top:7px;border-top:1px solid #8885}.speech-sockets .jack-label{font-size:8px}
`;
