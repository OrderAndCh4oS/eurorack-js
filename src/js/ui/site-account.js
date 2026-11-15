import { CloudClient } from '../patches/cloud-client.js';
import { openProfileDialog } from './profile-dialog.js';

// Account controls for static docs and introduction pages. Keep this independent
// of rack state, audio modules, patch catalogues, and image preview generation.
export class SiteAccount {
    constructor({ document: documentRef = globalThis.document, cloud = new CloudClient() } = {}) {
        this.document = documentRef; this.window = documentRef.defaultView; this.cloud = cloud;
        this.config = { enabled: false }; this.user = null;
        this.accountGeneration = 0; this.sessionRequest = 0;
        this.initialized = false; this.authPending = false; this.disposed = false;
    }

    init() {
        if (this.ready || !this.document.getElementById('patchAccount')) return this;
        this.onAccount = () => { void this.run(async () => {
            await this.ready;
            return this.user ? this.signOut() : this.signIn();
        }); };
        this.onProfile = () => { void this.run(() => this.openProfile()); };
        this.onFocus = () => { if (this.initialized && !this.disposed && this.config.enabled && !this.authPending) void this.refreshSession(); };
        this.onPageShow = event => { if (event.persisted) void this.ready.then(this.onFocus); };
        this.document.getElementById('patchAccount').addEventListener('click', this.onAccount);
        this.document.getElementById('patchProfile')?.addEventListener('click', this.onProfile);
        this.window.addEventListener('focus', this.onFocus);
        this.window.addEventListener('pageshow', this.onPageShow);
        this.updateAccount();
        this.ready = this.initializeCloud();
        return this;
    }

    async initializeCloud() {
        try {
            const config = await this.cloud.configuration();
            if (this.disposed) return;
            this.config = config;
            if (config.enabled) await this.refreshSession();
        } catch (error) {
            if (!this.disposed && error.name !== 'AbortError') this.notice(error.message);
        } finally {
            if (!this.disposed) { this.initialized = true; this.updateAccount(); }
        }
    }

    async refreshSession() {
        const request = ++this.sessionRequest, account = this.accountGeneration;
        try {
            const { user } = await this.cloud.me();
            if (this.disposed || request !== this.sessionRequest || account !== this.accountGeneration) return;
            if ((this.user?.id || null) !== (user?.id || null)) {
                this.closeProfile?.(); this.accountGeneration++; this.cloud.cancel();
            }
            this.user = user; this.updateAccount();
        } catch (error) {
            if (!this.disposed && request === this.sessionRequest && account === this.accountGeneration && error.name !== 'AbortError') this.notice(error.message);
        }
    }

    updateAccount() {
        const button = this.document.getElementById('patchAccount');
        if (button) {
            button.textContent = this.user ? 'Sign out' : 'Sign in';
            button.title = this.user ? `Signed in as ${this.user.name}` : 'Sign in with Google';
            button.disabled = !this.initialized || this.authPending;
            button.setAttribute('aria-busy', String(!this.initialized || this.authPending));
        }
        const profile = this.document.getElementById('patchProfile');
        if (profile) { profile.hidden = !this.user; profile.disabled = this.authPending; }
        const tab = this.document.querySelector('.patch-site-links [aria-current="page"]');
        if (tab) {
            const strip = tab.parentElement, bounds = strip.getBoundingClientRect(), item = tab.getBoundingClientRect();
            if (item.left < bounds.left) strip.scrollLeft -= bounds.left - item.left;
            else if (item.right > bounds.right) strip.scrollLeft += item.right - bounds.right;
        }
    }

    openProfile() { return openProfileDialog(this); }

    async signIn() {
        await this.ready;
        if (this.disposed || this.authPending) return false;
        if (!this.config.enabled) { this.notice('Sign-in is unavailable. Try again later.'); return false; }
        this.authPending = true; this.updateAccount();
        try { await this.cloud.signIn(this.window.location.href); return true; }
        finally { this.authPending = false; if (!this.disposed) this.updateAccount(); }
    }

    async signOut() {
        if (this.disposed || this.authPending) return false;
        const account = this.accountGeneration, accountId = this.user?.id;
        this.sessionRequest++; this.authPending = true; this.updateAccount();
        try {
            await this.cloud.signOut();
            if (this.disposed || account !== this.accountGeneration || accountId !== this.user?.id) return false;
            this.closeProfile?.(); this.accountGeneration++; this.user = null;
            this.updateAccount(); this.notice('Signed out.'); return true;
        } finally { this.authPending = false; if (!this.disposed) this.updateAccount(); }
    }

    button(label, handler, className) {
        const button = this.document.createElement('button'); button.type = 'button'; button.textContent = label;
        if (className) button.className = className;
        button.addEventListener('click', handler); return button;
    }

    notice(message) {
        const node = this.document.getElementById('patchNotice'); if (!node) return;
        const text = this.document.createElement('p'); text.textContent = message;
        node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
        node.replaceChildren(text, this.button('Dismiss', () => {
            node.hidden = true; this.document.getElementById('patchAccount')?.focus();
        }));
        node.hidden = false;
    }

    async run(action) {
        try { return await action(); }
        catch (error) { if (!this.disposed && error.name !== 'AbortError') this.notice(error.message); return false; }
    }

    dispose() {
        this.disposed = true; this.sessionRequest++; this.accountGeneration++;
        this.closeProfile?.(); this.cloud.cancel();
        this.document.getElementById('patchAccount')?.removeEventListener('click', this.onAccount);
        this.document.getElementById('patchProfile')?.removeEventListener('click', this.onProfile);
        this.window.removeEventListener('focus', this.onFocus);
        this.window.removeEventListener('pageshow', this.onPageShow);
    }
}

export function initSiteAccount(options) { return new SiteAccount(options).init(); }
