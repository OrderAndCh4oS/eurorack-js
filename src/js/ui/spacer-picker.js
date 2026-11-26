import { paintSpacer, SPACER_PRINTS } from '../modules/spacer/artwork.js';

export function openSpacerPicker(app, panel = null) {
    const doc = app.document;
    const dialog = doc.getElementById('spacerPicker');
    if (!dialog || dialog.open || app.inPlayerView) return;
    const form = dialog.querySelector('form');
    const { row, hp } = form.elements;
    const fill = form.querySelector('[data-fill-gap]');
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('[role="alert"]');
    const swatches = form.querySelector('.spacer-swatches');
    const events = new doc.defaultView.AbortController();
    const options = { signal: events.signal };
    const destination = app.selection.destination();
    const available = n => app.state.getRowSpace(n, app.host.registry).freeHP +
        (panel?.row === n ? panel.params.hp : 0);
    const showError = message => {
        error.textContent = message;
        error.hidden = !message;
    };
    const rows = app.state.getRowNumbers();
    row.replaceChildren();
    for (const n of rows) {
        const option = doc.createElement('option');
        option.value = n;
        option.textContent = `Row ${n} · ${available(n)} HP free`;
        option.disabled = available(n) === 0;
        row.append(option);
    }
    row.value = panel?.row ?? (available(destination.row) ? destination.row : rows.find(n => available(n)) ?? rows[0]);
    row.parentElement.hidden = !!panel;
    const widthLimit = () => available(panel?.row ?? Number(row.value));
    const updateWidth = value => {
        const limit = widthLimit();
        hp.max = limit;
        hp.value = value ?? (limit || '');
        hp.disabled = fill.disabled = submit.disabled = limit < 1;
        showError(limit ? '' : 'All rows are full. Add a rack row to place a spacer.');
    };
    updateWidth(panel?.params.hp);
    row.addEventListener('change', () => updateWidth(), options);
    fill.addEventListener('click', () => updateWidth(), options);

    dialog.querySelector('h2').textContent = panel ? 'Edit spacer' : 'Add spacer';
    submit.textContent = panel ? 'Apply' : 'Add spacer';
    swatches.replaceChildren();
    for (const [style, print] of Object.entries(SPACER_PRINTS)) {
        const label = doc.createElement('label');
        label.className = 'spacer-swatch ' + print.color;
        const radio = doc.createElement('input');
        radio.type = 'radio';
        radio.name = 'artwork';
        radio.value = style;
        radio.checked = style === (panel?.params.style ?? 'contour');
        const canvas = doc.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const caption = doc.createElement('span');
        caption.textContent = print.name;
        label.append(radio, canvas, caption);
        swatches.append(label);
        const paint = () => paintSpacer(canvas, style, 176, 110, 210);
        paint();
        doc.addEventListener('theme-mode-change', paint, options);
    }
    form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close(), options);
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (app.inPlayerView || (panel && app.state.getModule(panel.id) !== panel)) {
            dialog.close();
            return;
        }
        const targetRow = panel?.row ?? Number(row.value);
        if (!app.state.rows[targetRow] || hp.valueAsNumber > widthLimit()) {
            updateWidth();
            showError('The rack changed. Check the available width and try again.');
            return;
        }
        const width = hp.valueAsNumber;
        const style = form.elements.artwork.value;
        if (panel) {
            if (width !== panel.params.hp) app.setParam(panel.id, 'hp', width);
            if (style !== panel.params.style) app.setParam(panel.id, 'style', style);
        } else {
            const anchor = app.state.getRow(targetRow).indexOf(destination.afterId);
            const id = app.addModule('spacer', { row: targetRow, index: anchor < 0 ? null : anchor + 1, params: { hp: width, style } });
            if (!id) {
                showError('The spacer could not be placed in this row.');
                return;
            }
        }
        app.patchLibrary?.updateActiveLabel();
        dialog.close();
    }, options);
    dialog.addEventListener('close', () => events.abort(), { once: true });
    dialog.showModal();
    if (panel) form.querySelector('[name="artwork"]:checked').focus();
}
