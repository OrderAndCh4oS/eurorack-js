const CHANNELS = ['left', 'right'];
const BANDS = ['low', 'mid', 'high'];
const number = (value, digits = 1, unit = '') => Number.isFinite(value) ? value.toFixed(digits) + unit : '—';
const percent = value => Number.isFinite(value) ? number(value * 100, 1, '%') : '—';

function node(doc, tag, text) {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    return el;
}

function table(doc, headings, rows) {
    const el = doc.createElement('table');
    const header = el.createTHead().insertRow();
    for (const heading of headings) {
        const th = node(doc, 'th', heading);
        th.scope = 'col';
        header.append(th);
    }
    const body = el.createTBody();
    for (const [label, ...values] of rows) {
        const row = body.insertRow();
        const th = node(doc, 'th', label);
        th.scope = 'row';
        row.append(th);
        for (const value of values) row.insertCell().textContent = value;
    }
    return el;
}

function levelMeters(doc, levels) {
    const meters = node(doc, 'div');
    meters.className = 'analysis-levels';
    for (const channel of CHANNELS) {
        for (const [label, key] of [['Peak', 'peakDbfs'], ['RMS', 'rmsDbfs']]) {
            const value = levels[channel][key];
            const row = node(doc, 'div');
            const channelLabel = channel === 'left' ? 'L' : 'R';
            const track = node(doc, 'span');
            track.className = 'analysis-track';
            track.setAttribute('aria-hidden', 'true');
            const fill = node(doc, 'i');
            fill.style.width = Number.isFinite(value) ? `${Math.max(0, Math.min(100, (value + 60) / 60 * 100))}%` : '0%';
            track.append(fill);
            row.append(node(doc, 'span', `${channelLabel} ${label}`), track, node(doc, 'b', number(value, 1, ' dBFS')));
            meters.append(row);
        }
    }
    const scale = node(doc, 'div');
    scale.className = 'analysis-scale';
    scale.append(node(doc, 'span', '−60'), node(doc, 'span', '−30'), node(doc, 'span', '0 dBFS'));
    meters.append(scale);
    return meters;
}

function spectrum(doc, spectral) {
    const el = node(doc, 'div');
    for (const channel of CHANNELS) {
        const row = node(doc, 'div');
        row.className = 'analysis-bands';
        row.setAttribute('aria-hidden', 'true'); // Channel percentages are also tabulated below.
        const track = node(doc, 'span');
        const fractions = spectral[channel].bandEnergyFractions;
        if (fractions) {
            for (const band of BANDS) {
                const part = node(doc, 'i');
                part.className = `analysis-${band}`;
                part.style.width = `${fractions[band] * 100}%`;
                track.append(part);
            }
        }
        row.append(node(doc, 'b', channel === 'left' ? 'L' : 'R'), track);
        el.append(row);
    }
    const [low, high] = spectral.bandEdgesHz;
    const labels = [`Low · <${low} Hz`, `Mid · ${low}–<${high} Hz`, `High · ≥${high} Hz`];
    const bands = table(doc, ['Band', 'Left', 'Right'], BANDS.map((band, i) =>
        [labels[i], ...CHANNELS.map(channel => percent(spectral[channel].bandEnergyFractions?.[band]))]));
    for (const [i, row] of [...bands.tBodies[0].rows].entries()) {
        row.cells[0].className = `analysis-band-label analysis-${BANDS[i]}`;
    }
    el.append(bands);
    return el;
}

export function renderMeasurement(container, entry) {
    const doc = container.ownerDocument;
    const result = JSON.parse(entry.response);
    const {capture, report} = result;
    const {levels, spectral, loudness, stereo} = report;
    const fragment = doc.createDocumentFragment();
    const edited = node(doc, 'p', 'Captured before the last rack edit.');
    edited.className = 'analysis-edited';
    fragment.append(node(doc, 'h3', 'Last measurement'),
        node(doc, 'p', `${entry.source === 'agent' ? 'Agent' : 'You'} · ${new Date(entry.startedAt).toLocaleTimeString()} · rack revision ${result.revision}`),
        node(doc, 'p', `${capture.durationSeconds.toLocaleString()} s · ${capture.sampleRate.toLocaleString()} Hz · ${capture.frames.toLocaleString()} frames`), edited);

    const highlights = node(doc, 'dl');
    highlights.className = 'analysis-highlights';
    for (const [label, value] of [
        ['Integrated loudness', number(loudness.integratedLufs, 1, ' LUFS')],
        ['Stereo correlation', number(stereo.correlation, 3)]
    ]) {
        const pair = node(doc, 'div');
        pair.append(node(doc, 'dt', label), node(doc, 'dd', value));
        highlights.append(pair);
    }
    fragment.append(highlights, node(doc, 'h3', 'Output level'), levelMeters(doc, levels),
        node(doc, 'h3', 'Spectral energy'), spectrum(doc, spectral));
    const channels = read => CHANNELS.map(read);
    const details = node(doc, 'details');
    details.append(node(doc, 'summary', 'Measurement details'), table(doc, ['Channel', 'Left', 'Right'], [
        ['Peak amplitude', ...channels(ch => number(levels[ch].peak, 4))],
        ['RMS amplitude', ...channels(ch => number(levels[ch].rms, 4))],
        ['DC offset', ...channels(ch => number(levels[ch].dcOffset, 5))],
        ['Full-scale samples', ...channels(ch => levels[ch].fullScaleSamples.toLocaleString())],
        ['Full-scale fraction', ...channels(ch => percent(levels[ch].fullScaleFraction))],
        ['True peak estimate', ...channels(ch => number(loudness.truePeakEstimate[ch + 'Dbtp'], 2, ' dBTP'))],
        ['Centroid', ...channels(ch => number(spectral[ch].centroidHz, 1, ' Hz'))],
        ['85% rolloff', ...channels(ch => number(spectral[ch].rolloff85Hz, 1, ' Hz'))],
        ['Flatness', ...channels(ch => number(spectral[ch].flatness, 4))],
        ['Active FFT frames', ...channels(ch => `${spectral[ch].activeFrameCount} / ${spectral[ch].frameCount}`)]
    ]), table(doc, ['Stereo / loudness', 'Value'], [
        ['Mid RMS', number(stereo.midRms, 4)], ['Side RMS', number(stereo.sideRms, 4)],
        ['Side-to-mid energy', number(stereo.sideToMidEnergyRatio, 4)],
        ['Momentary loudness', number(loudness.momentaryLufs, 1, ' LUFS')],
        ['Short-term loudness', number(loudness.shortTermLufs, 1, ' LUFS')]
    ]));
    const raw = node(doc, 'details');
    raw.append(node(doc, 'summary', 'Exact measurement JSON'), node(doc, 'pre', entry.response));
    fragment.append(node(doc, 'p', '— indicates an unavailable value.'), details, raw);
    container.replaceChildren(fragment);
    return edited;
}
