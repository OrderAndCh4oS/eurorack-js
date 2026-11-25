import { clamp } from '../../utils/math.js';
import { readWavFile } from './media.js';
import { channels, choices, ui } from './schema.js';

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(text, title) {
    const node = element('button', 'hardware-button', text);
    node.type = 'button';
    node.title = title;
    return node;
}

function label(text, control) {
    const wrapper = element('label', 'slice-field');
    wrapper.append(element('span', '', text), control);
    return wrapper;
}

function choose(control, options, context) {
    const { instance, onParamChange, toolkit } = context;
    const select = element('select', 'hardware-select');
    select.setAttribute('aria-label',control.label + ' ' + control.param.slice(-1));
    options.forEach((name,index) => select.add(new Option(name,index)));
    select.value = String(instance.dsp.params[control.param]);
    toolkit.registerParamControl(control.param, select, value => { select.value = String(value); });
    select.addEventListener('change', () => onParamChange(control.param, Number(select.value)));
    return select;
}

function addEditor(root, ch, context) {
    const { instance, toolkit, onParamChange, onRuntimeCommand, onCleanup } = context;
    const params = instance.dsp.params;
    const fields = Object.fromEntries(ui.buttons.filter(c => c.param.endsWith(ch)).map(control => {
        const stem = control.param.slice(0,-1);
        return [stem,choose(control, choices[stem], context)];
    }));
    const editor = element('div','slice-editor');
    editor.dataset.channel = ch;
    const sourceRow = element('div','slice-source');
    const load = button('Import WAV','Import a mono or stereo 16-bit PCM WAV into player ' + ch);
    const file = element('input');
    file.type = 'file';
    file.accept = '.wav,audio/wav,audio/wave';
    file.hidden = true;
    load.disabled = typeof onRuntimeCommand !== 'function';
    file.disabled = load.disabled;
    const status = element('span','slice-status');
    status.setAttribute('role','status');
    let error = '', pending = false, disposed = false;
    onCleanup?.(() => { disposed = true; });
    load.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
        const selected = file.files?.[0];
        if (!selected || pending || !onRuntimeCommand) return;
        pending = true;
        load.disabled = file.disabled = true;
        error = '';
        status.textContent = 'Loading…';
        try {
            const decoded = await readWavFile(selected);
            if (disposed) return;
            await onRuntimeCommand({ type:'load-sample',channel:ch,name:selected.name,...decoded }, [decoded.pcm.buffer]);
            if (!disposed) onParamChange('source'+ch, 1);
        } catch (reason) {
            error = reason instanceof Error ? reason.message : 'Could not load WAV.';
        } finally {
            pending = false;
            if (!disposed) {
                file.value = '';
                load.disabled = file.disabled = false;
                refresh();
            }
        }
    });
    sourceRow.append(fields.source,load,file,status);
    const wave = toolkit.createCanvas({ width: 256, height: 36, className: 'slice-wave' });
    wave.setAttribute('aria-label','Waveform and slice starts for player ' + ch);
    const cuts = element('div','slice-edit-tools');
    const cursor = element('input','slice-position');
    cursor.type = 'number'; cursor.min = '0'; cursor.max = '100'; cursor.step = '0.1'; cursor.value = '50';
    cursor.setAttribute('aria-label','Cursor percent');
    cursor.title = 'Cursor position in percent';
    const marker = element('select','hardware-select');
    marker.setAttribute('aria-label','Selected marker');
    const controls = ['add','move','remove'].map(verb => {
        const control = button(verb.charAt(0).toUpperCase() + verb.slice(1),verb + ' an interior slice marker');
        control.dataset.edit = verb;
        control.addEventListener('click', () => edit(verb));
        return control;
    });
    cuts.append(marker,cursor,element('span','','%'),...controls);

    const legend = element('div','slice-legend');
    const modes = element('div','slice-fields');
    modes.append(label('Playback',fields.playMode),label('Order',fields.order),label('Slice method',fields.method));
    const knobs = element('div','slice-knobs');
    for (const c of ui.knobs.filter(c => c.param.endsWith(ch))) {
        knobs.append(toolkit.createKnob({...c, value:params[c.param],small:true}));
    }
    const cvs = element('div','slice-fields');
    for (const i of [1,2,3]) cvs.append(label('CV ' + i,fields['assign'+i]));
    const actions = element('div','slice-actions');
    for (const c of ui.actions.filter(c => c.param.endsWith(ch))) {
        const node = toolkit.createActionButton({...c,value:0});
        node.classList.add('hardware-button');
        actions.append(node);
    }
    editor.append(sourceRow,wave,legend,cuts,modes,knobs,cvs,actions);
    root.append(editor);

    let selected = 0, lastCount = -1;
    let lastOverview, lastStarts, lastCursor, lastMarker;
    const getInfo = () => instance.dsp.samplerInfo[ch];
    function positions(info) {
        if (params['method'+ch] === 2) {
            const values = params['markers'+ch];
            return Array.isArray(values) ? [...new Set(values.slice(0,31).filter(v => Number.isFinite(v) && v > 0 && v < 1))].sort((a,b) => a-b) : [];
        }
        return Array.from(info.starts).slice(1).map(at => at / info.frames);
    }

    function edit(verb) {
        const info = getInfo();
        if (!info.frames) return;
        const points = positions(info);
        const value = clamp(Number(cursor.value),0,100)/100;
        if (verb !== 'remove' && (!Number.isFinite(value) || value <= 0 || value >= 1)) return;
        if (verb === 'add') {
            if (points.length >= 31 || points.includes(value)) return;
            points.push(value);
        } else {
            if (selected >= points.length) return;
            if (verb === 'remove') points.splice(selected,1);
            else {
                if (points.some((v,i) => i !== selected && v === value)) return;
                points[selected] = value;
            }
        }
        points.sort((a,b) => a-b);
        selected = verb === 'remove' ? Math.min(selected, Math.max(0,points.length-1)) : points.indexOf(value);
        onParamChange('markers'+ch, points);
        if (params['method'+ch] !== 2) onParamChange('method'+ch,2);
        fields.method.value = '2';
        refresh();
    }

    function draw(info, cursorValue) {
        if (info.overview === lastOverview && info.starts === lastStarts &&
            cursorValue === lastCursor && selected === lastMarker) return;
        lastOverview = info.overview;
        lastStarts = info.starts;
        lastCursor = cursorValue;
        lastMarker = selected;
        const ctx = wave.getContext('2d');
        if (!ctx) return;
        const w = wave.width, h = wave.height;
        ctx.fillStyle = '#172126'; ctx.fillRect(0,0,w,h);
        const bins = info.overview.length/2;
        ctx.fillStyle = '#9dc5be';
        for (let i=0;i<bins;i++) {
            const hi = info.overview[2*i+1], lo = info.overview[2*i];
            ctx.fillRect(i*w/bins, h*(0.5-hi*0.45), Math.max(1,w/bins), Math.max(1,(hi-lo)*h*0.45));
        }
        info.starts.forEach((frame,i) => {
            ctx.fillStyle = i === selected+1 ? '#fff1c7' : '#df9865';
            ctx.fillRect(frame/info.frames*w,0,1,h);
        });
        ctx.fillStyle = '#fcdf73';
        ctx.fillRect(clamp(cursorValue/100)*(w-1),0,1,h);
    }

    function refresh() {
        const info = getInfo();
        const text = error || (pending ? 'Loading…' : info.frames ?
            info.name + ' · ' + (info.frames/info.sampleRate).toFixed(2)+' s' : 'Load local WAV');
        if (status.textContent !== text) status.textContent = status.title = text;
        fields.source.value = String(params['source'+ch]);
        const count = params['method'+ch] === 2 ? positions(info).length : Math.max(0,info.starts.length-1);
        selected = Math.max(0,Math.min(selected,count-1));
        if (count !== lastCount) {
            marker.replaceChildren();
            if (!count) marker.add(new Option('No cut',0));
            for (let i=0;i<count;i++) marker.add(new Option('Cut '+(i+1),i));
            lastCount = count;
        }
        marker.value = String(selected);
        controls[0].disabled = !info.frames || count >= 31;
        controls[1].disabled = controls[2].disabled = marker.disabled = !info.frames || !count;
        const statusLine = info.starts.length + ' slices · ' + (count ? 'cut '+(selected+1)+' selected' : 'no interior cuts') +
            (info.recording ? ' · recording' : info.playing ? ' · playing '+(info.region+1) : '');
        if (legend.textContent !== statusLine) legend.textContent = statusLine;
        draw(info, Number(cursor.value));
    }
    marker.addEventListener('change', () => {
        selected = Number(marker.value);
        cursor.value = String(+(positions(getInfo())[selected]*100).toFixed(3));
        refresh();
    });
    cursor.addEventListener('input',refresh);
    wave.addEventListener('pointerdown', event => {
        const rect = wave.getBoundingClientRect();
        if (rect.width) cursor.value = String(+(clamp((event.clientX-rect.left)/rect.width)*100).toFixed(3));
        refresh();
    });
    return { editor,refresh };
}

export function render(container, context) {
    const root = element('div','slice-panel');
    const tabs = element('div','slice-tabs');
    let active = 'A';
    const editors = {}, buttons = {};
    function select(ch) {
        active = ch;
        for (const key of channels) {
            editors[key].editor.hidden = key !== ch;
            buttons[key].setAttribute('aria-pressed',String(key === ch));
            buttons[key].classList.toggle('active',key === ch);
        }
        editors[ch].refresh();
    }
    for (const ch of channels) {
        const tab = button('Player '+ch,'Edit player '+ch);
        tab.addEventListener('click',()=>select(ch));
        buttons[ch] = tab;
        tabs.append(tab,context.toolkit.createLED({id:'playing'+ch,color:'green'}),context.toolkit.createLED({id:'recording'+ch,color:'red'}));
    }
    root.append(tabs);
    for (const ch of channels) editors[ch] = addEditor(root,ch,context);
    for (const ch of channels) {
        const row = element('div','slice-jacks');
        row.append(element('strong','',ch));
        for (const spec of [...ui.inputs,...ui.outputs].filter(p => p.port.endsWith(ch))) {
            row.append(context.toolkit.createJack({...spec,direction:spec.signal === 'audio' && spec.port.startsWith('out') ? 'output' : 'input'}));
        }
        root.append(row);
    }
    container.append(root);
    select('A');
    context.toolkit.animate(() => editors[active].refresh());
}

export const css = `
.slice-panel { width:100%; height:100%; min-width:0; display:flex; flex-direction:column; gap:3px; color:inherit; }
.slice-editor { display:flex; flex-direction:column; gap:3px; min-width:0; }
.slice-editor[hidden] { display:none; }
.slice-tabs,.slice-source,.slice-edit-tools,.slice-knobs,.slice-actions,.slice-jacks { display:flex; align-items:center; gap:4px; }
.slice-tabs,.slice-knobs,.slice-actions,.slice-jacks { justify-content:space-around; }
.slice-tabs { border-bottom:1px solid currentColor; padding-bottom:3px; }
.slice-tabs button { flex:1; }
.slice-panel button,.slice-panel select,.slice-position,.slice-field { font:inherit; }
.slice-panel { font-size:9px; }
.slice-panel .hardware-button,.slice-panel .hardware-select,.slice-panel .slice-position { height:20px; min-height:18px; font-size:9px; padding:1px 5px; line-height:1.1; }
.slice-panel .hardware-select { min-width:0; padding-right:10px; }
.slice-source { min-width:0; }
.slice-status { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.slice-wave { width:100%; height:33px; border:1px solid #394441; touch-action:none; cursor:crosshair; }
.slice-legend { min-height:10px; font-size:9px; }
.slice-edit-tools { justify-content:space-between; }
.slice-position { width:46px; }
.slice-fields { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:3px; }
.slice-field { display:flex; flex-direction:column; gap:0; min-width:0; }
.slice-field span { font-size:8px; line-height:10px; }
.slice-panel .slice-field select { width:100%; }
.slice-actions button { flex:1; }
.slice-jacks { border-top:1px solid currentColor; padding-top:2px; }
.slice-editor + .slice-jacks { margin-top:auto; }
.slice-jacks strong { font-size:10px; }
.slice-jacks .jack-container { gap:1px; }
`;
