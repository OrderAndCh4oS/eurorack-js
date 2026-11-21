// Fit the live panels and their cables together without changing the patch layout.
export class RackPlayer {
    constructor(app) {
        this.app = app;
        this.stage = app.document.getElementById('rackStage');
        this.panels = app.document.getElementById('rackPanels');
        this.scale = 1;
    }

    bind() {
        const doc = this.app.document;
        const media = doc.defaultView?.matchMedia?.('(max-width: 760px), (pointer: coarse)');
        if (!this.stage || !media) return;

        // A pad can still own pointer capture when the editor switches to playback.
        // Let the release reach the pad so held gates and buttons can reset.
        this.panels.addEventListener('pointermove', event => {
            if (this.panels.inert) event.stopPropagation();
        }, true);
        doc.getElementById('playerDemo').addEventListener('click', () => {
            void this.app.patchLibrary.run(() => this.app.patchLibrary.openIntroductionDemo());
        });
        doc.getElementById('playerBrowse').addEventListener('click', () => this.app.patchLibrary.navigate('public'));
        doc.getElementById('playerLibrary').addEventListener('click', () => {
            const library = this.app.patchLibrary;
            library.navigate(library.lastCatalogueView || 'public');
        });

        const setMode = () => {
            this.app.setPlayerMode(media.matches);
            if (media.matches) this.fit();
            else this.app.renderAllCables();
        };
        setMode();
        media.addEventListener('change', setMode);
        new ResizeObserver(() => this.fit()).observe(this.stage);
    }

    fit() {
        if (!this.app.inPlayerView || !this.stage?.clientWidth || !this.stage.clientHeight) return;
        const { modules, cables } = this.app.state;
        this.stage.setAttribute('aria-label', `Patch overview, ${modules.size} module${modules.size === 1 ? '' : 's'}, ${cables.length} cable${cables.length === 1 ? '' : 's'}`);
        this.app.renderAllCables();
        // A cable can hang below the final rail. Include the actual curve and half its stroke.
        const wires = this.app.cableSvg.getBBox();
        // Fit the occupied part of each row independently of the full-width mounting rails.
        let width = wires.x + wires.width + 4;
        for (const { element } of modules.values()) {
            if (element) width = Math.max(width, element.offsetLeft + element.offsetWidth);
        }
        const height = Math.max(this.panels.offsetHeight, wires.y + wires.height + 4);
        this.scale = Math.min(1, this.stage.clientWidth / width, this.stage.clientHeight / height);
        this.stage.style.setProperty('--player-scale', this.scale);
    }
}
