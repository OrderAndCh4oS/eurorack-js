import { enhanceContentPage } from './content-page.js';

const PAGE_METADATA = [
    'link[rel~="canonical"]', 'meta[name="description"]', 'meta[name="robots"]',
    'meta[property^="og:"]', 'meta[name^="og:"]',
    'meta[name^="twitter:"]', 'meta[property^="twitter:"]'
].join(',');

function readMetadata(document) {
    return [...document.head.querySelectorAll(PAGE_METADATA)].map(node => node.cloneNode(true));
}

export function contentView(location) {
    if (/^\/docs(?:\/[a-z0-9-]+)?\/?$/.test(location.pathname)) return 'docs';
    if (/^\/introduction\/?$/.test(location.pathname)) return 'introduction';
    return null;
}

// Fetch the build-rendered page, keeping the instrument and unsaved work alive.
export class ContentViews {
    constructor({ document, surface }) {
        this.document = document;
        this.window = document.defaultView;
        this.surface = surface;
        this.pages = new Map();
        this.title = null;
        this.rackMetadata = null;
    }
    hide() {
        this.request?.abort();
        this.request = null;
        if (this.surface) this.surface.hidden = true;
        if (this.rackMetadata !== null) {
            this.replaceMetadata(this.rackMetadata);
            this.rackMetadata = null;
        }
    }
    replaceMetadata(metadata) {
        // Replace just the page-owned tags; scripts, fonts and other head state stay put.
        this.document.head.querySelectorAll(PAGE_METADATA).forEach(node => node.remove());
        this.document.head.append(...metadata.map(node => this.document.importNode(node, true)));
    }
    applyMetadata(metadata) {
        if (this.rackMetadata === null) this.rackMetadata = readMetadata(this.document);
        this.replaceMetadata(metadata);
    }
    async show(location) {
        if (!this.surface) return;
        // Fetch the heading face alongside the page, without charging rack-only visits.
        void this.document.fonts?.load('700 1em "Space Grotesk"').catch(() => {});
        const url = new URL(location.href);
        this.surface.hidden = false;
        if (this.path === url.pathname && this.surface.querySelector('[data-content-page]')) {
            this.applyMetadata(this.pages.get(url.pathname).metadata);
            this.document.title = this.title;
            if (!url.hash) this.surface.scrollTop = 0;
            this.scrollToSection(url.hash, true);
            return;
        }
        this.request?.abort();
        const request = new this.window.AbortController();
        this.request = request;
        this.path = null;
        this.title = `${contentView(url) === 'introduction' ? 'Introduction' : 'Docs'} · Eurorack`;
        this.document.title = this.title;
        this.surface.setAttribute('aria-busy', 'true');
        const loading = this.document.createElement('p');
        loading.className = 'content-status'; loading.textContent = 'Loading…';
        this.surface.replaceChildren(loading);
        try {
            let page = this.pages.get(url.pathname);
            if (!page) {
                const response = await this.window.fetch(url.pathname, { signal: request.signal });
                if (!response.ok) throw new Error('Page unavailable');
                const html = new this.window.DOMParser().parseFromString(await response.text(), 'text/html');
                const content = html.querySelector('main[data-content-page]');
                if (!content) throw new Error('Page unavailable');
                page = { content, title: html.title || content.dataset.pageTitle, metadata: readMetadata(html) };
                this.pages.set(url.pathname, page);
            }
            if (request.signal.aborted || this.request !== request) return;
            const content = this.document.importNode(page.content, true);
            this.surface.replaceChildren(content);
            this.applyMetadata(page.metadata);
            this.path = url.pathname;
            this.title = page.title;
            this.document.title = this.title;
            enhanceContentPage(content);
            this.surface.scrollTop = 0;
            this.scrollToSection(url.hash, true);
        } catch (error) {
            if (request.signal.aborted || this.request !== request) return;
            const message = this.document.createElement('div'); message.className = 'content-status';
            const title = this.document.createElement('h1'); title.textContent = 'Could not load this page.';
            const button = this.document.createElement('button'); button.type = 'button'; button.textContent = 'Try again';
            button.addEventListener('click', () => { void this.show(url); });
            message.append(title, button); this.surface.replaceChildren(message);
        } finally {
            if (this.request === request) this.surface.removeAttribute('aria-busy');
        }
    }
    scrollToSection(hash, focusPage = false) {
        let id;
        try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
        const section = id && this.document.getElementById(id);
        const target = section && this.surface.contains(section) ? section : focusPage ? this.surface.querySelector('h1') : null;
        if (!target) return;
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (id && section) target.scrollIntoView({ block: 'start' });
    }
}
