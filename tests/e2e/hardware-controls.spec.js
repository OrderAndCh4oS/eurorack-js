import { expect, test } from '@playwright/test';

const loadFactoryPatch = async (page, name, moduleId) => {
    await page.locator('#patchSelect').selectOption(name);
    await page.locator('#loadPatch').click();
    await page.waitForFunction(id => window.eurorackApp.state.getModule(id), moduleId);
};

test('themes recent-module hardware controls and keeps Probability Sequencer tactile', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await loadFactoryPatch(page, 'Test - Probability Sequencer', 'probSeq');

    const panel = page.locator('#module-probSeq');
    await expect(panel.locator('input[type="range"]')).toHaveCount(0);
    await expect(panel.locator('.prob-seq-editor-knob .knob')).toHaveCount(2);
    await expect(panel.locator('.hardware-button')).toHaveCount(9);
    await expect(panel.locator('.hardware-select')).toHaveCount(1);

    const statusCenters = await panel.locator('.prob-seq-status-row > span').evaluateAll(items => (
        items.map(item => {
            const box = item.getBoundingClientRect();
            return box.x + box.width / 2;
        })
    ));
    expect(statusCenters).toHaveLength(4);
    expect(statusCenters[3] - statusCenters[0]).toBeGreaterThan(100);
    expect(statusCenters).toEqual([...statusCenters].sort((a, b) => a - b));

    const snapshots = {};
    for (const theme of ['industrial', 'classic']) {
        for (const mode of ['light', 'dark']) {
            await page.evaluate(({ theme, mode }) => {
                window.eurorackApp.setTheme(theme);
                window.eurorackApp.setThemeMode(mode);
            }, { theme, mode });

            snapshots[`${theme}-${mode}`] = await panel.evaluate(element => {
                const readStyle = selector => {
                    const style = getComputedStyle(element.querySelector(selector));
                    return {
                        backgroundColor: style.backgroundColor,
                        backgroundImage: style.backgroundImage,
                        borderColor: style.borderTopColor,
                        borderRadius: style.borderTopLeftRadius,
                        boxShadow: style.boxShadow,
                        color: style.color
                    };
                };
                return {
                    button: readStyle('.prob-seq-step:not(.selected)'),
                    select: readStyle('.hardware-select')
                };
            });
        }
    }

    expect(new Set(Object.values(snapshots).map(value => JSON.stringify(value.button))).size)
        .toBeGreaterThanOrEqual(3);
    expect(snapshots['industrial-light'].button.borderRadius).toBe('0px');
    expect(snapshots['industrial-dark'].button.borderRadius).toBe('0px');
    expect(snapshots['classic-light'].button.borderRadius).toBe('3px');
    expect(snapshots['classic-dark'].button.borderRadius).toBe('3px');
    for (const mode of ['light', 'dark']) {
        const industrial = snapshots[`industrial-${mode}`];
        expect(industrial.button.backgroundImage).toBe('none');
        expect(industrial.button.boxShadow).toBe('none');
        expect(industrial.select.boxShadow).toBe('none');

        const classic = snapshots[`classic-${mode}`];
        expect(classic.button.backgroundImage).toContain('linear-gradient');
        expect(classic.button.boxShadow).not.toBe('none');
        expect(classic.select.backgroundImage).toContain('linear-gradient');
        expect(classic.select.boxShadow).not.toBe('none');
    }

    await loadFactoryPatch(page, 'Test - CV Recorder', 'recorder');
    await expect(page.locator('#module-recorder .action-btn')).toHaveCount(4);
    await expect(page.locator('#module-recorder .switch')).toHaveCount(3);
    await page.evaluate(() => {
        window.eurorackApp.setTheme('industrial');
        window.eurorackApp.setThemeMode('dark');
    });
    await page.waitForTimeout(120);
    const establishedIndustrialStyles = await page.locator('#module-recorder').evaluate(element => {
        const action = getComputedStyle(element.querySelector('.action-btn'));
        const toggle = element.querySelector('.switch');
        const toggleStyle = getComputedStyle(toggle);
        const toggleCap = getComputedStyle(toggle, '::after');
        return {
            action: {
                backgroundImage: action.backgroundImage,
                borderRadius: action.borderTopLeftRadius
            },
            toggle: {
                height: toggleStyle.height,
                width: toggleStyle.width,
                capBackgroundImage: toggleCap.backgroundImage,
                capBorderRadius: toggleCap.borderTopLeftRadius,
                capBoxShadow: toggleCap.boxShadow
            }
        };
    });
    expect(establishedIndustrialStyles.action).toEqual({
        backgroundImage: 'none',
        borderRadius: '0px'
    });
    expect(establishedIndustrialStyles.toggle).toEqual({
        height: '22px',
        width: '14px',
        capBackgroundImage: 'none',
        capBorderRadius: '0px',
        capBoxShadow: 'none'
    });

    await loadFactoryPatch(page, 'Test - Pitch Tracker', 'tracker');
    await expect(page.locator('#module-tracker .switch')).toHaveCount(1);

    await loadFactoryPatch(page, 'Test - Shimmer', 'inputShimmer');
    await expect(page.locator('#module-inputShimmer .action-btn')).toHaveCount(2);
    await expect(page.locator('#module-inputShimmer .switch')).toHaveCount(1);

    expect(pageErrors).toEqual([]);
});
