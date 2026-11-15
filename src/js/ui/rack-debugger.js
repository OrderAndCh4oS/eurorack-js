import { analyseRackConnections } from '../rack/diagnostics.js';

const CONNECTION_EVENTS = new Set(['module-added', 'module-removed', 'cables-changed', 'patch-loaded', 'registry']);

function element(document, tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/** Connection diagnostics are view state only; nothing is written to the patch. */
export class RackDebugger {
    constructor({ app, document: documentRef = document, registry, analyse = analyseRackConnections }) {
        this.app = app;
        this.document = documentRef;
        this.window = documentRef.defaultView;
        this.registry = registry;
        this.analyse = analyse;
        this.enabled = false;
        this.frame = null;
        this.highlights = new Map();
        this.handleToggle = () => this.toggle();
        this.handleClose = () => this.toggle(false, { restoreFocus: true });
        this.handleKeyDown = event => {
            if (event.key !== 'Escape' || event.defaultPrevented || !this.enabled) return;
            if (!this.panel.contains(event.target) && event.target !== this.toggleButton && !this.highlights.has(event.target)) return;
            event.preventDefault();
            this.handleClose();
        };
    }

    init() {
        this.rackView = this.document.getElementById('rackView');
        this.toggleButton = this.document.getElementById('rackDebuggerToggle');
        if (!this.rackView || !this.toggleButton) return this;

        this.panel = element(this.document, 'aside', 'rack-debugger');
        this.panel.id = 'rack-debugger';
        this.panel.hidden = true;
        this.panel.setAttribute('aria-labelledby', 'rack-debugger-heading');
        const header = element(this.document, 'div', 'rack-debugger-header');
        const heading = element(this.document, 'h2', '', 'Connections');
        heading.id = 'rack-debugger-heading';
        this.closeButton = element(this.document, 'button', 'rack-debugger-close', 'Close');
        this.closeButton.type = 'button';
        this.closeButton.title = 'Close connection checks';
        header.append(heading, this.closeButton);

        this.summary = element(this.document, 'p', 'rack-debugger-summary');
        this.summary.setAttribute('role', 'status');
        this.summary.setAttribute('aria-live', 'polite');
        this.summary.setAttribute('aria-atomic', 'true');
        this.summary.tabIndex = -1;
        this.list = element(this.document, 'ol', 'rack-debugger-list');
        this.list.setAttribute('aria-label', 'Connection issues');
        this.note = element(this.document, 'p', 'rack-debugger-note', 'Checks cable routing only. Unused connections can be intentional.');
        this.panel.append(header, this.summary, this.list, this.note);
        this.rackView.append(this.panel);

        this.toggleButton.addEventListener('click', this.handleToggle);
        this.closeButton.addEventListener('click', this.handleClose);
        this.document.addEventListener('keydown', this.handleKeyDown);
        this.unsubscribe = this.app.host.subscribe(event => {
            if (CONNECTION_EVENTS.has(event.type)) this.scheduleRefresh();
        });

        // The Code drawer can be resized; keep every finding above it and
        // redraw cable positions whenever the debug panel changes rack width.
        if (this.window.ResizeObserver) {
            const workbench = this.document.getElementById('patch-workbench');
            this.resizeObserver = new this.window.ResizeObserver(() => {
                this.panel.style.setProperty('--rack-debugger-workbench-height', `${workbench?.offsetHeight || 0}px`);
                this.app.renderAllCables?.();
            });
            if (this.app.rackContainer) this.resizeObserver.observe(this.app.rackContainer);
            if (workbench) this.resizeObserver.observe(workbench);
        }
        return this;
    }

    toggle(enabled = !this.enabled, { restoreFocus = false } = {}) {
        if (!this.panel) return;
        this.enabled = enabled;
        this.panel.hidden = !enabled;
        this.rackView.classList.toggle('rack-debugger-open', enabled);
        this.toggleButton.classList.toggle('active', enabled);
        this.toggleButton.setAttribute('aria-expanded', String(enabled));
        this.toggleButton.setAttribute('aria-pressed', String(enabled));
        if (enabled) this.refresh();
        else {
            this.cancelRefresh();
            this.clearHighlights();
        }
        this.app.renderAllCables?.();
        if (restoreFocus) this.toggleButton.focus();
    }

    scheduleRefresh() {
        if (!this.enabled || this.frame !== null) return;
        // Host events precede app rendering. Wait until the new module DOM exists.
        this.frame = this.window.requestAnimationFrame(() => {
            this.frame = null;
            if (this.enabled) this.refresh();
        });
    }

    cancelRefresh() {
        if (this.frame !== null) this.window.cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    refresh() {
        if (!this.enabled) return;
        const patch = this.app.host.serializePatch();
        const report = this.analyse(patch, this.registry);
        const focusKey = this.list.contains(this.document.activeElement)
            ? this.document.activeElement.dataset.findingKey : null;
        this.clearHighlights();
        this.list.replaceChildren();
        const count = report.issues.length;
        const summary = count ? `${count} ${count === 1 ? 'thing' : 'things'} to check`
            : report.moduleCount ? 'No connection issues found.' : 'Add modules to check their connections.';
        if (this.summary.textContent !== summary) this.summary.textContent = summary;
        this.note.hidden = report.moduleCount === 0;
        this.list.hidden = count === 0;
        const modules = new Map(patch.modules.map(module => [module.id, module]));
        let restoreTarget;
        report.issues.forEach((issue, index) => {
            const key = JSON.stringify([issue.code, issue.moduleIds]);
            const row = element(this.document, 'li', 'rack-debugger-issue');
            row.dataset.issueCode = issue.code;
            const target = issue.moduleIds.length ? element(this.document, 'button', 'rack-debugger-finding')
                : element(this.document, 'div', 'rack-debugger-finding');
            const number = element(this.document, 'span', 'rack-debugger-number', String(index + 1));
            number.setAttribute('aria-hidden', 'true');
            const text = element(this.document, 'span', 'rack-debugger-finding-text');
            const name = issue.moduleIds.map(id => {
                const module = modules.get(id);
                return `${this.registry.get(module?.type)?.name || module?.type || 'Module'} · ${id}`;
            }).join(', ');
            const label = element(this.document, 'strong', 'rack-debugger-module-name', name || 'Rack');
            const message = element(this.document, 'span', 'rack-debugger-message', issue.message);
            message.id = `rack-debugger-issue-${index}`;
            text.append(label, message);
            target.append(number, text);
            target.dataset.findingKey = key;
            if (issue.moduleIds.length) {
                target.type = 'button';
                target.title = `Show ${name} in rack`;
                target.addEventListener('click', () => this.focusModule(issue.moduleIds[0]));
            }
            row.append(target);
            this.list.append(row);
            issue.moduleIds.forEach(id => this.highlightModule(id, index + 1, message));
            if (key === focusKey) restoreTarget = target;
        });
        if (focusKey) (restoreTarget || this.summary).focus({ preventScroll: true });
    }

    highlightModule(id, number, message) {
        const module = this.app.state.getModule(id)?.element;
        if (!module?.isConnected) return;
        let highlight = this.highlights.get(module);
        if (!highlight) {
            const marker = element(this.document, 'span', 'rack-debugger-marker', String(number));
            marker.setAttribute('aria-hidden', 'true');
            highlight = { marker, descriptionIds: [], addedTabIndex: !module.hasAttribute('tabindex') };
            this.highlights.set(module, highlight);
            module.classList.add('rack-debugger-flagged');
            if (highlight.addedTabIndex) module.tabIndex = -1;
            module.append(marker);
        }
        highlight.descriptionIds.push(message.id);
        const descriptionIds = new Set((module.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        descriptionIds.add(message.id);
        module.setAttribute('aria-describedby', [...descriptionIds].join(' '));
    }

    focusModule(id) {
        const module = this.app.state.getModule(id)?.element;
        if (!module?.isConnected) return;
        module.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        module.focus({ preventScroll: true });
        this.app.renderAllCables?.();
    }

    clearHighlights() {
        this.highlights.forEach(({ marker, descriptionIds, addedTabIndex }, module) => {
            marker.remove();
            module.classList.remove('rack-debugger-flagged');
            if (addedTabIndex) module.removeAttribute('tabindex');
            const remaining = (module.getAttribute('aria-describedby') || '').split(/\s+/)
                .filter(id => id && !descriptionIds.includes(id));
            if (remaining.length) module.setAttribute('aria-describedby', remaining.join(' '));
            else module.removeAttribute('aria-describedby');
        });
        this.highlights.clear();
    }

    dispose() {
        this.toggle(false);
        this.unsubscribe?.();
        this.resizeObserver?.disconnect();
        this.toggleButton?.removeEventListener('click', this.handleToggle);
        this.closeButton?.removeEventListener('click', this.handleClose);
        this.document.removeEventListener('keydown', this.handleKeyDown);
        this.panel?.remove();
    }
}

export function createRackDebugger(options) {
    return new RackDebugger(options);
}
