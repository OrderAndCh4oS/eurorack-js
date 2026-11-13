import { openTestPatch } from './patch-library-helpers.js';
import { expect, test } from '@playwright/test';

const loadFactoryPatch = async (page, name, moduleId) => {
    await openTestPatch(page, name);
    await page.waitForFunction(id => window.eurorackApp.state.getModule(id), moduleId);
};

test('keeps recent-module hardware controls consistent in Industrial Light', async ({ page }) => {
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

    const styles = await panel.evaluate(element => {
        const readStyle = selector => {
            const style = getComputedStyle(element.querySelector(selector));
            return {
                backgroundImage: style.backgroundImage,
                borderRadius: style.borderTopLeftRadius,
                boxShadow: style.boxShadow,
                transform: style.transform
            };
        };
        const button = element.querySelector('.prob-seq-step:not(.selected)');
        const idleButton = readStyle('.prob-seq-step:not(.selected)');
        button.classList.add('active');
        const activeButton = readStyle('.prob-seq-step.active');
        button.classList.remove('active');
        return {
            button: idleButton,
            activeButton,
            select: readStyle('.hardware-select')
        };
    });

    expect(styles.button.borderRadius).toBe('0px');
    expect(styles.button.transform).toBe('none');
    expect(styles.activeButton.transform).toBe('none');
    expect(styles.button.backgroundImage).toBe('none');
    expect(styles.button.boxShadow).toBe('none');
    expect(styles.select.boxShadow).toBe('none');

    await loadFactoryPatch(page, 'Test - CV Recorder', 'recorder');
    await expect(page.locator('#module-recorder .action-btn')).toHaveCount(4);
    await expect(page.locator('#module-recorder .switch')).toHaveCount(3);
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
