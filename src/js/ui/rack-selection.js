const CLIPBOARD_SCHEMA = 'eurorack-js/module-selection';
const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

export class RackSelection {
    constructor(app) {
        this.app = app;
        this.ids = new Set();
        this.anchor = null;
        this.row = 1;
    }

    set(ids, anchor = null) {
        const previous = this.ids;
        this.ids = new Set(ids);
        this.anchor = anchor;
        for (const id of new Set([...previous, ...this.ids])) {
            if (previous.has(id) === this.ids.has(id)) continue;
            const panel = this.app.state.getModule(id)?.element;
            const selected = this.ids.has(id);
            panel?.classList.toggle('module-selected', selected);
            panel?.querySelector('.module-label')?.setAttribute('aria-pressed', String(selected));
        }
    }

    clear(row = 1) {
        this.set([]);
        this.row = row;
    }

    remove(id) {
        if (!this.ids.has(id)) return;
        const remaining = [...this.ids].filter(selected => selected !== id);
        this.set(remaining, this.anchor === id ? remaining.at(-1) : this.anchor);
    }

    select(id, event) {
        const state = this.app.state;
        const toggle = event.ctrlKey || event.metaKey;
        if (event.shiftKey && this.anchor && state.getModule(this.anchor)) {
            const ordered = state.getRowNumbers().flatMap(row => state.getRow(row));
            const start = ordered.indexOf(this.anchor);
            const end = ordered.indexOf(id);
            const range = ordered.slice(Math.min(start, end), Math.max(start, end) + 1);
            this.set(toggle ? [...this.ids, ...range] : range, this.anchor);
        } else if (toggle && this.ids.has(id)) {
            this.remove(id);
        } else {
            this.set(toggle ? [...this.ids, id] : [id], id);
        }
        this.row = state.getModule(id).row;
    }

    destination() {
        const state = this.app.state;
        for (const row of state.getRowNumbers()) {
            const last = state.getRow(row).filter(id => this.ids.has(id)).at(-1);
            if (last) return { row, afterId: last };
        }
        return { row: state.rows[this.row] ? this.row : 1 };
    }

    bind(rack) {
        if (!rack) return;
        const doc = rack.ownerDocument;
        rack.addEventListener('mousedown', event => {
            if (event.button !== 0 || event.target.closest('.module')) return;
            const row = event.target.closest('.rack-row');
            if (row) {
                this.clear(Number(row.dataset.row));
                rack.focus({ preventScroll: true });
            }
        });
        rack.addEventListener('keydown', event => {
            const header = event.target.closest('.module-label');
            if (header && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                if (!event.repeat) this.select(header.closest('.module').dataset.instanceId, event);
            }
        });
        rack.addEventListener('click', event => {
            const header = event.target.closest('.module-label');
            if (header && event.detail === 0) this.select(header.closest('.module').dataset.instanceId, event);
        });
        const inRack = event => !this.app.inPlayerView && !rack.closest('[hidden]') && !doc.querySelector('dialog[open]')
            && (event.target === doc || event.target === doc.body || rack.contains(event.target))
            && !event.target.closest?.(TEXT_FIELD) && !event.target.isContentEditable;

        doc.addEventListener('copy', event => {
            if (!inRack(event) || !event.clipboardData || !this.ids.size || doc.getSelection()?.isCollapsed === false) return;
            const patch = this.app.host.copyModules(this.ids);
            if (!patch.modules.length) return;
            event.clipboardData.setData('text/plain', JSON.stringify({ schema: CLIPBOARD_SCHEMA, version: 1, patch }));
            event.preventDefault();
        });
        doc.addEventListener('paste', async event => {
            if (!inRack(event) || !event.clipboardData) return;
            let data;
            try { data = JSON.parse(event.clipboardData.getData('text/plain')); } catch { return; }
            if (data?.schema !== CLIPBOARD_SCHEMA) return;
            event.preventDefault();
            try {
                if (data.version !== 1) throw new Error('Unsupported module clipboard version.');
                const modules = await this.app.pasteModules(data.patch, this.destination());
                if (!modules.length) return;
                this.set(modules.map(module => module.id), modules[0].id);
                modules[0].element?.querySelector('.module-label')?.focus({ preventScroll: true });
                modules[0].element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (error) { this.app.patchLibrary?.notice(error.message); }
        });
        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape' && inRack(event) && !event.defaultPrevented) this.clear(this.row);
        });
    }
}
