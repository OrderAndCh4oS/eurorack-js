import { renderMeasurement } from './measurement-report.js';
import { MEASUREMENT_CHANGES } from '../audio/audio-analysis.js';

const TOOL_NAMES = {
    get_rack: 'Read rack', describe_modules: 'Inspect modules', validate_script: 'Validate patch',
    apply_draft: 'Apply patch', edit_spacer: 'Edit spacer', map_midi_cc: 'Map MIDI control', perform_controls: 'Perform controls',
    debug_rack: 'Check wiring', measure_audio: 'Measure audio', present_step: 'Present step'
};
const PHASES = {loading: 'Loading analyser', capturing: 'Capturing audio', analysing: 'Analysing audio', presenting: 'Showing caption', performing: 'Moving controls'};
const STATUS = {running: 'In progress', complete: 'Complete', cancelled: 'Cancelled', failed: 'Failed'};
const actor = entry => entry.source === 'agent' ? 'Agent' : 'You';

function write(node, text) {
    if (node.textContent !== text) node.textContent = text;
}

function activityRow(doc, entry) {
    const item = doc.createElement('li');
    const details = doc.createElement('details');
    details.innerHTML = `<summary><span class="activity-title"></span><span class="activity-time"></span>
        <span class="activity-state"></span><span class="activity-summary"></span></summary>
        <div class="activity-payload"><code></code><h4>Request</h4><pre></pre><h4>Response</h4><pre></pre></div>`;
    details.querySelector('.activity-title').textContent = `${actor(entry)} · ${TOOL_NAMES[entry.tool]}`;
    details.querySelector('.activity-time').textContent = new Date(entry.startedAt).toLocaleTimeString();
    details.querySelector('code').textContent = entry.tool;
    const [request, response] = details.querySelectorAll('pre');
    const showPayload = () => {
        if (!details.open) return;
        write(request, entry.request);
        write(response, entry.response ?? 'Waiting for the response…');
    };
    details.addEventListener('toggle', showPayload);
    item.append(details);
    const state = details.querySelector('.activity-state');
    const description = details.querySelector('.activity-summary');
    return {item, update() {
        if (entry.status === 'running') write(state, PHASES[entry.phase] ?? STATUS.running);
        else {
            const ms = Math.max(0, entry.finishedAt - entry.startedAt);
            const elapsed = ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
            write(state, `${STATUS[entry.status]} · ${elapsed}`);
        }
        write(description, entry.summary ?? entry.step?.caption ?? '');
        item.dataset.status = entry.status;
        showPayload();
    }};
}

export function initRackAnalysis({document: doc, host, analysis, activity, redrawCables}) {
    const panel = doc.getElementById('rack-analysis');
    const toggle = doc.getElementById('analysisToggle');
    if (!panel || !toggle) return;
    const indicator = doc.getElementById('analysisIndicator');
    const caption = doc.getElementById('agent-caption');
    const tabs = [...panel.querySelectorAll('[role="tab"]')];
    const form = panel.querySelector('form');
    const duration = form.elements.duration;
    const measure = form.querySelector('[type="submit"]');
    const cancel = form.querySelector('[data-action="cancel"]');
    const status = panel.querySelector('.analysis-status');
    const activityView = doc.getElementById('activity-view');
    const measurement = panel.querySelector('[data-field="measurement"]');
    const list = panel.querySelector('ol');
    const rows = new Map();
    let renderedMeasurement;
    let editedSinceMeasurement = false;
    let editNotice;
    let unread = false;
    let audioContext;
    let highlightedModule = null;
    let movingControls;
    let manualDuration;

    function renderActivity() {
        for (const [entry, row] of rows) {
            if (!activity.entries.includes(entry)) { row.item.remove(); rows.delete(entry); }
        }
        // Keep expanded requests and keyboard focus in place as new calls arrive.
        for (const entry of [...activity.entries].reverse()) {
            if (!rows.has(entry)) {
                const row = activityRow(doc, entry);
                rows.set(entry, row);
                list.prepend(row.item);
            }
            rows.get(entry).update();
        }
        panel.querySelector('[data-field="empty"]').hidden = rows.size > 0;
    }

    function showStep(step) {
        write(caption.querySelector('p'), step?.caption ?? '');
        caption.hidden = !step?.caption;
        const moduleId = step?.moduleId;
        const target = moduleId ? doc.getElementById(`module-${moduleId}`) : null;
        if (target !== highlightedModule) {
            highlightedModule?.classList.remove('agent-step-target');
            highlightedModule = target;
            if (target) {
                target.classList.add('agent-step-target');
                target.scrollIntoView({block: 'nearest', inline: 'nearest'});
                redrawCables();
            }
        }
    }

    function showMovingControls(controls) {
        if (movingControls === controls) return;
        movingControls = controls;
        const targets = new Map();
        for (const {moduleId, paramId} of controls ?? []) {
            const panel = doc.getElementById(`module-${moduleId}`);
            for (const element of panel?.querySelectorAll('[data-module][data-param]') ?? []) {
                if (element.dataset.module === moduleId && element.dataset.param === paramId) {
                    targets.set(element, () => host.state.getParam(moduleId, paramId));
                }
            }
        }
        doc.dispatchEvent(new doc.defaultView.CustomEvent('agent-controls-change', {detail: targets}));
    }

    function refresh(event) {
        const entries = activity.entries;
        const active = entries.filter(entry => entry.status === 'running');
        const capture = active.find(entry => entry.tool === 'measure_audio' && entry.phase);
        const performance = active.find(entry => entry.phase === 'performing')?.step;
        const step = performance?.caption || performance?.moduleId ? performance : active.find(entry => entry.phase === 'presenting')?.step;
        const agent = active.find(entry => entry.source === 'agent');
        if (event?.detail && event.detail === activity.lastMeasurement) editedSinceMeasurement = false;
        if (panel.hidden && event?.detail?.source === 'agent') unread = true;
        let badge = '';
        if (capture) badge = capture.source === 'agent' ? ' · Agent measuring' : ' · Measuring';
        else if (agent) badge = ' · Agent active';
        else if (unread) badge = ' · Agent activity';
        write(indicator, badge);
        toggle.classList.toggle('analysis-busy', active.length > 0);
        showStep(step);
        showMovingControls(performance?.controls);
        if (panel.hidden) return;
        const running = host.engine && host.audioCtx?.state === 'running';
        if (capture) {
            if (!duration.disabled) manualDuration = duration.value;
            duration.value = String(capture.durationSeconds);
        } else if (duration.disabled) duration.value = manualDuration;
        duration.disabled = !!capture;
        measure.disabled = !running || !!capture;
        cancel.hidden = !capture;
        const showingActivity = !activityView.hidden;
        const latest = showingActivity ? entries[0] : entries.find(entry => entry.tool === 'measure_audio');
        let message;
        if (capture) message = `${actor(capture)} · ${PHASES[capture.phase]}`;
        else if (performance) message = 'Agent · Moving controls';
        else if (step) message = 'Agent · Presenting a walkthrough step';
        else if (agent) message = `Agent · ${TOOL_NAMES[agent.tool]}`;
        else if (latest?.error && !(running && latest.error.code === 'audio-not-running')) message = `${actor(latest)} · ${STATUS[latest.status]}. ${latest.error.message}`;
        else if (showingActivity) message = latest ? `${actor(latest)} · ${TOOL_NAMES[latest.tool]} · ${STATUS[latest.status]}` : 'Waiting for activity.';
        else if (!running) message = 'Press Start in the rack to measure audio.';
        else message = 'Ready to measure.';
        write(status, message);
        write(panel.querySelector('[data-field="count"]'), String(entries.length));
        if (showingActivity) renderActivity();
        else if (activity.lastMeasurement && renderedMeasurement !== activity.lastMeasurement) {
            editNotice = renderMeasurement(measurement, activity.lastMeasurement);
            renderedMeasurement = activity.lastMeasurement;
        }
        if (editNotice) editNotice.hidden = !editedSinceMeasurement;
    }

    function selectTab(tab) {
        for (const button of tabs) {
            const selected = button === tab;
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
            doc.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
        }
        refresh();
    }

    function setOpen(open) {
        panel.hidden = !open;
        doc.getElementById('rackView').classList.toggle('rack-analysis-open', open);
        unread = false;
        toggle.classList.toggle('active', open);
        toggle.setAttribute('aria-expanded', String(open));
        refresh();
        if (open) panel.querySelector('[aria-selected="true"]').focus();
        else toggle.focus();
        redrawCables();
    }

    toggle.addEventListener('click', () => setOpen(panel.hidden));
    panel.querySelector('[data-action="close"]').addEventListener('click', () => setOpen(false));
    panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    });
    for (const [index, tab] of tabs.entries()) {
        tab.addEventListener('click', () => selectTab(tab));
        tab.addEventListener('keydown', event => {
            const next = {ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: 1}[event.key];
            if (next === undefined) return;
            event.preventDefault();
            selectTab(tabs[next]);
            tabs[next].focus();
        });
    }
    form.addEventListener('submit', event => {
        event.preventDefault();
        const input = {durationSeconds: duration.valueAsNumber};
        void activity.run('user', 'measure_audio', input, onPhase => analysis.measure({...input, onPhase}));
    });
    cancel.addEventListener('click', () => analysis.cancel());
    activity.addEventListener('change', refresh);
    function syncPlayback() {
        audioContext?.removeEventListener('statechange', refresh);
        audioContext = host.audioCtx;
        audioContext?.addEventListener('statechange', refresh);
        refresh();
    }
    const unsubscribe = host.subscribe(event => {
        if (event.type === 'audio-started' || event.type === 'audio-stopped') syncPlayback();
        else if (activity.lastMeasurement && !editedSinceMeasurement && MEASUREMENT_CHANGES.has(event.type)) {
            editedSinceMeasurement = true;
            refresh();
        }
    });
    syncPlayback();
    const workbench = doc.getElementById('patch-workbench');
    const Observer = doc.defaultView?.ResizeObserver;
    const observer = workbench && Observer && new Observer(() => {
        doc.getElementById('rackView').style.setProperty('--analysis-code-height', `${workbench.offsetHeight}px`);
    });
    observer?.observe(workbench);
    return {dispose() {
        activity.removeEventListener('change', refresh);
        showStep();
        showMovingControls();
        audioContext?.removeEventListener('statechange', refresh);
        observer?.disconnect();
        unsubscribe();
    }};
}
