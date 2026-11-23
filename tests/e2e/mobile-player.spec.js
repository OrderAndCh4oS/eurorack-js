import { expect, test } from '@playwright/test';
import { openTestPatch } from './patch-library-helpers.js';

test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

test('tapping the Introduction artwork in the empty player opens the pictured patch', async ({ page }) => {
    await page.goto('/');
    const preview = page.getByRole('link', { name: 'Open the Introduction demo patch' });
    const image = preview.locator('img');
    await expect(image).toBeInViewport({ ratio: 1 });
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const frame = await preview.boundingBox(), art = await image.boundingBox();
    expect(art.width).toBeGreaterThan(frame.width * 0.95);
    const intro = await page.request.get('/introduction');
    const introSources = await page.evaluate(html => new DOMParser().parseFromString(html, 'text/html')
        .querySelector('.marketing-rack img').getAttribute('srcset'), await intro.text());
    await expect(image).toHaveAttribute('srcset', introSources);
    const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
    await toggle.tap();
    await expect(image).toHaveAttribute('srcset', await image.getAttribute('data-dark-srcset'));
    await toggle.tap();
    await expect(image).toHaveAttribute('srcset', introSources);
    await expect(page.getByRole('button', { name: 'Browse public patches' })).toBeInViewport({ ratio: 1 });

    const app = await page.evaluateHandle(() => window.eurorackApp);
    await preview.tap();
    await expect(page.locator('#playerPatchName')).toHaveText('Introduction');
    await expect(page.locator('.rack-row .module')).toHaveCount(18);
    await expect(preview).toBeHidden();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    expect(await app.evaluate(original => original === window.eurorackApp)).toBe(true);
});

test('the phone player and patch library use compact rack buttons', async ({ page }) => {
    const checkButton = async button => {
        await expect(button).toHaveCSS('height', '28px');
        await expect(button).toHaveCSS('font-family', /^["']?Courier New/);
        await expect(button).toHaveCSS('font-size', '10px');
        await expect(button).toHaveCSS('text-transform', 'uppercase');
    };
    await page.goto('/');
    await expect(page.locator('#playerPatchChoices')).toBeVisible();
    await expect(page.locator('#toolbar')).toHaveCSS('height', '38px');
    for (const id of ['playerLibrary', 'startButton', 'playerDemo', 'playerBrowse']) await checkButton(page.locator(`#${id}`));
    await page.locator('#playerBrowse').tap();
    const nav = page.getByRole('navigation', { name: 'Patch views' });
    await expect(nav).toHaveCSS('height', '38px');
    for (const button of await nav.locator('button:visible, a:visible').all()) await checkButton(button);
    await checkButton(page.getByRole('button', { name: 'Search', exact: true }));
    await expect(page.getByRole('searchbox')).toHaveCSS('height', '28px');
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveCSS('height', '28px');
    await nav.getByRole('button', { name: 'Module demos' }).tap();
    await checkButton(page.getByRole('button', { name: 'Open in rack' }).first());
    await checkButton(page.locator('.patch-pagination a[rel="next"]').first());
});

test('opening a MIDI patch from the phone library allows playback while hardware permission is pending', async ({ page }) => {
    await page.addInitScript(() => {
        window.midiRequests = 0;
        Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: () => {
            window.midiRequests++;
            return new Promise(() => {});
        } });
    });
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.patchLibrary);
    expect(await page.evaluate(() => window.midiRequests)).toBe(0);
    await page.getByRole('button', { name: 'Patches', exact: true }).tap();
    await openTestPatch(page, 'Test - MIDI-CV');
    await expect(page.locator('#playerPatchName')).toHaveText('Test - MIDI-CV');
    expect(await page.evaluate(() => window.midiRequests)).toBe(1);
    await page.getByRole('button', { name: 'Play', exact: true }).tap();
    await page.getByRole('button', { name: 'Stop', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
});

test('rapid Play taps start one audio context and Stop closes it', async ({ page }) => {
    await page.goto('/?demo=introduction');
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toBeEnabled();
    await page.evaluate(() => {
        const resume = AudioContext.prototype.resume;
        window.startedContexts = [];
        const ready = new Promise(resolve => { window.finishResume = resolve; });
        AudioContext.prototype.resume = async function () {
            window.startedContexts.push(this);
            await ready;
            return resume.call(this);
        };
    });
    const box = await play.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(play).toBeDisabled();
    await page.evaluate(() => window.finishResume());
    await page.getByRole('button', { name: 'Stop', exact: true }).tap();
    await expect(play).toBeEnabled();
    expect(await page.evaluate(() => window.startedContexts.map(context => context.state))).toEqual(['closed']);
});

async function expectWholePatch(page) {
    await expect.poll(() => page.evaluate(() => {
        const app = window.eurorackApp;
        const stage = document.querySelector('#rackStage').getBoundingClientRect();
        const within = box => box.left >= stage.left - 1 && box.top >= stage.top - 1 &&
            box.right <= stage.right + 1 && box.bottom <= stage.bottom + 1;
        const railsFit = Object.values(app.rows).filter(row => row.firstElementChild).every(row => {
            const rail = row.getBoundingClientRect(), first = row.firstElementChild.getBoundingClientRect();
            return Math.abs(rail.left) < 1 && Math.abs(rail.right - innerWidth) < 1 &&
                Math.abs(first.left - rail.left) < 1 && first.top > rail.top && first.bottom < rail.bottom;
        });
        const scale = new DOMMatrix(getComputedStyle(app.player.panels).transform).a;
        return railsFit && app.state.modules.size > 0 && [...app.state.modules.values()].every(({ element }) =>
            element.getBoundingClientRect().width > 0 && within(element.getBoundingClientRect())) &&
            app.visualCables.length === app.state.cables.length && app.visualCables.every(({ fromEl, toEl, pathEl }) => {
                // WebKit's getScreenCTM can omit the parent panel's CSS scale. Use the painted path bounds.
                const painted = pathEl.getBoundingClientRect(), local = pathEl.getBBox();
                const ends = [pathEl.getPointAtLength(0), pathEl.getPointAtLength(pathEl.getTotalLength())];
                return getComputedStyle(pathEl).opacity === '1' && within(painted) &&
                    [fromEl, toEl].every((jack, i) => {
                        const box = jack.getBoundingClientRect();
                        const x = painted.left + (ends[i].x - local.x) * scale;
                        const y = painted.top + (ends[i].y - local.y) * scale;
                        return Math.hypot(x - box.x - box.width / 2, y - box.y - box.height / 2) < 1;
                    });
            });
    })).toBe(true);
}

test('phones and tablets fit the whole wired patch and play it read-only', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        window.midiRequests = 0;
        Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async () => {
            window.midiRequests++;
            return { inputs: new Map() };
        } });
        localStorage.setItem('eurorack-cables-full-opacity', 'false');
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
    await expect(page.locator('#sidebar')).toBeHidden();
    await expect(page.locator('#newPatch')).toBeHidden();
    await page.getByRole('button', { name: 'Browse public patches' }).tap();
    await expect(page.locator('#patchLibrary')).toBeVisible();
    await page.locator('[data-patch-view="mine"]').tap();
    await expect(page.locator('[data-patch-view="mine"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('[data-patch-view="rack"]').tap();
    await page.getByRole('button', { name: 'Open demo patch' }).tap();
    await expect(page.locator('#playerPatchName')).toHaveText('Introduction');
    await expect(page.locator('.rack-row .module')).toHaveCount(18);
    await expect(page.locator('.cable-hints')).toBeHidden();
    const footer = page.locator('#playerFooter');
    await expect(footer).toHaveText('On mobile, you can browse and play your own patches or patches shared by others. To create a patch, use the desktop editor.');
    await expectWholePatch(page);
    const snapshot = () => page.evaluate(() => window.eurorackApp.host.serializePatch());
    const original = await snapshot();
    expect(original.cables.length).toBeGreaterThan(20);
    await expect(page.getByRole('img', { name: /Patch overview, 18 modules/ })).toBeVisible();
    await expect(page.getByRole('slider')).toHaveCount(0);
    const overview = await page.locator('#rackStage').screenshot();
    await page.locator('#cable-svg').evaluate(svg => { svg.style.visibility = 'hidden'; });
    expect((await page.locator('#rackStage').screenshot()).equals(overview)).toBe(false);
    await page.locator('#cable-svg').evaluate(svg => { svg.style.visibility = ''; });
    const panel = page.locator('#module-clock');
    const beforeTap = await panel.boundingBox();
    const title = await panel.locator('.module-label').boundingBox();
    await page.touchscreen.tap(title.x + title.width / 2, title.y + title.height / 2);
    expect(await panel.boundingBox()).toEqual(beforeTap);
    await expect(page.locator('.module-selected')).toHaveCount(0);

    await page.getByRole('button', { name: 'Play', exact: true }).tap();
    await expect.poll(() => page.evaluate(() => {
        const leds = window.eurorackApp.getDSP('main').leds;
        return leds.L > 0 && leds.R > 0;
    })).toBe(true);
    const knob = panel.locator('.knob').first();
    const before = await knob.getAttribute('aria-valuenow');
    const rect = await knob.boundingBox(), point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 24 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(knob).toHaveAttribute('aria-valuenow', before);
    const jack = await page.locator('.jack.connected').first().boundingBox();
    await page.touchscreen.tap(jack.x + jack.width / 2, jack.y + jack.height / 2);
    await page.keyboard.press('Control+Backquote');
    await expect(page.locator('#patch-workbench')).toBeHidden();
    expect(await snapshot()).toEqual(original);
    await page.screenshot({ path: testInfo.outputPath('phone-player.png') });
    for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
        await page.setViewportSize(viewport);
        await expectWholePatch(page);
        await expect(footer).toBeInViewport({ ratio: 1 });
        await expect(page.locator('#sidebar')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => window.midiRequests)).toBe(0);
    await page.getByRole('button', { name: 'Stop', exact: true }).tap();
    await page.getByRole('button', { name: 'Patches', exact: true }).tap();
    await openTestPatch(page, 'Test - VCO Only');
    await expect(page.locator('#playerPatchName')).toHaveText('Test - VCO Only');
    await expectWholePatch(page);
});

test.describe('desktop editor', () => {
    test.use({ viewport: { width: 900, height: 700 }, isMobile: false, hasTouch: false });

    test('panning a wired rack clips cable paint at the sidebar and keeps endpoints on the jacks', async ({ page }, testInfo) => {
        await page.goto('/?demo=introduction');
        await expect(page.locator('#module-clock')).toBeVisible();
        await expect(page.locator('#playerFooter')).toBeHidden();
        await page.locator('#rack-container').evaluate(el => el.scrollTo(240, 65));
        await expect.poll(() => page.evaluate(() => {
            const sidebar = document.querySelector('#sidebar').getBoundingClientRect();
            return window.eurorackApp.visualCables.some(({ pathEl }) => {
                const length = pathEl.getTotalLength();
                for (let i = 0; i <= 20; i++) {
                    const point = pathEl.getPointAtLength(length * i / 20).matrixTransform(pathEl.getScreenCTM());
                    if (point.x > sidebar.left && point.x < sidebar.right && point.y > sidebar.top && point.y < sidebar.bottom) return true;
                }
                return false;
            });
        })).toBe(true);
        const error = await page.evaluate(() => Math.max(...window.eurorackApp.visualCables.map(({ fromEl, pathEl }) => {
            const jack = fromEl.getBoundingClientRect();
            const start = pathEl.getPointAtLength(0).matrixTransform(pathEl.getScreenCTM());
            return Math.hypot(start.x - jack.x - jack.width / 2, start.y - jack.y - jack.height / 2);
        })));
        expect(error).toBeLessThan(1);
        const sidebar = page.locator('#sidebar');
        const withCables = await sidebar.screenshot({ path: testInfo.outputPath('sidebar-visible-cables.png') });
        await page.locator('#cable-svg').evaluate(svg => { svg.style.visibility = 'hidden'; });
        const withoutCables = await sidebar.screenshot({ path: testInfo.outputPath('sidebar-hidden-cables.png') });
        expect(withoutCables.equals(withCables)).toBe(true);
    });

    test('entering the player protects unsaved desktop changes and restores desktop editing on resize', async ({ page }) => {
        await page.goto('/?demo=introduction');
        await page.locator('[data-module-type="lfo"]').click();
        await page.locator('#patchName').fill('Live take');
        await page.locator('#startButton').click();
        await expect(page.locator('#startButton')).toHaveText('Stop');
        await page.evaluate(() => { window.playingContext = window.eurorackApp.host.audioCtx; });
        const before = await page.evaluate(() => window.eurorackApp.host.serializePatch());
        await page.locator('#rack-container').evaluate(el => el.scrollTo(250, 160));
        expect(await page.locator('#rack-container').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
        await page.setViewportSize({ width: 390, height: 844 });
        await expectWholePatch(page);
        await expect(page.locator('#playerPatchName')).toHaveText('Live take');
        await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: 'Patches', exact: true }).click();
        await page.locator('[data-patch-view="tests"]').click();
        await page.locator('.patch-entry').first().getByRole('button', { name: 'Open in rack' }).click();
        await page.getByRole('dialog', { name: 'Unsaved rack changes' }).getByRole('button', { name: 'Cancel' }).click();
        await page.locator('[data-patch-view="rack"]').click();
        await page.setViewportSize({ width: 1100, height: 820 });
        await expect(page.locator('#sidebar')).toBeVisible();
        expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(before);
        expect(await page.evaluate(() => window.eurorackApp.host.audioCtx === window.playingContext && window.playingContext.state === 'running')).toBe(true);
        await page.locator('#startButton').click();
    });

    test('a desktop knob drag and its value tooltip end when the rack becomes read-only', async ({ page }) => {
        await page.goto('/?demo=introduction');
        const knob = page.locator('#module-clock .knob').first();
        await knob.hover();
        await page.mouse.down();
        await expect(page.getByRole('tooltip')).toBeVisible();
        const before = await page.evaluate(() => window.eurorackApp.host.serializePatch());
        const value = await knob.getAttribute('aria-valuenow');
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('#playerFooter')).toBeVisible();
        await expect(page.getByRole('tooltip')).toBeHidden();
        await page.mouse.move(90, 50);
        await page.mouse.up();
        await expect(knob).toHaveAttribute('aria-valuenow', value);
        expect(await page.evaluate(() => window.eurorackApp.host.serializePatch())).toEqual(before);
    });

    test('a held joystick stops moving in the player and works again on desktop', async ({ page }) => {
        await page.goto('/');
        await page.locator('[data-module-type="joystick"]').click();
        const pad = page.locator('.rack-row .joystick-pad');
        await pad.hover();
        await page.mouse.down();
        const snapshot = () => page.evaluate(() => window.eurorackApp.host.serializePatch());
        const before = await snapshot();
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('#playerFooter')).toBeVisible();
        await page.mouse.move(30, 70);
        await page.mouse.up();
        expect(await snapshot()).toEqual(before);
        await page.setViewportSize({ width: 900, height: 700 });
        await expect(page.locator('#sidebar')).toBeVisible();
        await pad.click({ position: { x: 4, y: 4 } });
        expect(await snapshot()).not.toEqual(before);
    });

    test('the active navigation tab stays visible when a desktop reading view narrows', async ({ page }) => {
        await page.goto('/');
        const docs = page.locator('.patch-site-links [data-content-view="docs"]');
        await docs.click();
        await expect(docs).toHaveAttribute('aria-current', 'page');
        await page.setViewportSize({ width: 320, height: 740 });
        await expect.poll(() => docs.evaluate(el => {
            const tab = el.getBoundingClientRect(), strip = el.closest('.patch-nav-strip').getBoundingClientRect();
            return tab.left >= strip.left - 1 && tab.right <= strip.right + 1;
        })).toBe(true);
    });
});
