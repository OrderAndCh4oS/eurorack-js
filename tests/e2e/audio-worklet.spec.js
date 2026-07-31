import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('runs the custom-module patch and switches topology while audio is active', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);

    await page.locator('#patchSelect').selectOption('Test - Custom Modules');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('scope'));

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => {
        const scope = window.eurorackApp.state.getModule('scope')?.instance;
        return window.eurorackApp.host.engine && scope?.displayBuffer1?.some(sample => sample !== 0);
    });
    const scopeHistory = await page.evaluate(() => {
        const scope = window.eurorackApp.state.getModule('scope')?.instance;
        const samplesPerScreen = Math.floor(128 + (1 - scope.params.time) * 896);
        return {
            displaySize: scope.displaySize,
            channel1Length: scope.displayBuffer1.length,
            channel2Length: scope.displayBuffer2.length,
            samplesPerScreen
        };
    });
    expect(scopeHistory).toEqual({
        displaySize: 2048,
        channel1Length: 2048,
        channel2Length: 2048,
        samplesPerScreen: expect.any(Number)
    });
    expect(scopeHistory.displaySize).toBeGreaterThanOrEqual(scopeHistory.samplesPerScreen);

    const revision = await page.evaluate(() => window.eurorackApp.host.engine.revision);
    await page.locator('#patchSelect').selectOption('Test - Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(previousRevision => (
        window.eurorackApp.state.getModule('chorus') &&
        window.eurorackApp.host.engine?.revision > previousRevision
    ), revision);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).not.toHaveClass(/active/);
    expect(pageErrors).toEqual([]);
});

test('runs the Refrain composition patch and delivers every transient action to the worklet', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Refrain');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('scope'));

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => {
        const scope = window.eurorackApp.state.getModule('scope')?.instance;
        return window.eurorackApp.host.engine && scope?.displayBuffer1?.some(sample => sample !== 0);
    });

    const refrainPanel = page.locator('#module-refrain');
    await expect(refrainPanel).toHaveClass(/module-12hp/);
    await expect(refrainPanel.locator('[data-seed-field="active"]'))
        .toHaveText(/^\d{5}$/);
    await expect(refrainPanel.locator('[data-seed-field="next"]'))
        .toHaveText(/^(—|\d{5})$/);
    await expect(refrainPanel.locator('.jack[data-port="seedCV"][data-dir="input"]'))
        .toHaveCount(1);
    await page.waitForFunction(() => {
        const dsp = window.eurorackApp.state.getModule('refrain')?.instance;
        return Number.isInteger(dsp?.activeSeed) &&
            Number.isInteger(dsp?.nextSeed) &&
            [0, 1, 2].includes(dsp?.seedPendingState);
    });

    const keyLane = refrainPanel.locator('.refrain-lane-toggle[data-param="mutateKey"]');
    await keyLane.click();
    await page.waitForFunction(() =>
        window.eurorackApp.state.getModule('refrain')?.params?.mutateKey === 0
    );
    await keyLane.click();
    await page.waitForFunction(() =>
        window.eurorackApp.state.getModule('refrain')?.params?.mutateKey === 1
    );

    const mutate = page.locator('#module-refrain .action-btn[data-param="mutate"]');
    await mutate.click();
    await page.waitForFunction(() =>
        window.eurorackApp.state.getModule('refrain')?.instance?.pendingActionState === 1
    );
    await expect(mutate).toHaveClass(/active/);
    await expect(mutate).toHaveAttribute('data-state', 'queued');
    await expect(mutate).toHaveAttribute('title', /MUTATE · QUEUED/);
    await expect(mutate).not.toHaveClass(/active/, { timeout: 7000 });

    const recall = page.locator('#module-refrain .action-btn[data-param="recall"]');
    await expect(recall).toHaveAttribute('data-state', 'unavailable');
    await expect(recall).toHaveAttribute('title', /RECALL · NO ANCHOR/);
    await refrainPanel.locator('.switch[data-param="anchor"]').click();
    await page.waitForFunction(() =>
        window.eurorackApp.state.getModule('refrain')?.instance?.leds?.anchor === 1
    );
    await expect(recall).toHaveAttribute('data-state', 'ready');
    await expect(recall).toHaveAttribute('title', /RECALL · READY/);
    await recall.click();
    await page.waitForFunction(() =>
        window.eurorackApp.state.getModule('refrain')?.instance?.pendingActionState === 2
    );
    await expect(recall).toHaveClass(/active/);
    await expect(recall).toHaveAttribute('title', /RECALL · QUEUED/);
    await expect(recall).not.toHaveClass(/active/, { timeout: 7000 });

    for (const selector of [
        '#module-changes .action-btn[data-param="resetAction"]',
        '#module-cascade .action-btn[data-param="resetAction"]'
    ]) {
        await page.locator(selector).click();
        await expect(page.locator(selector)).not.toHaveClass(/active/, { timeout: 1000 });
    }

    await page.waitForFunction(() => {
        const state = window.eurorackApp.state;
        return state.getModule('refrain')?.params?.mutate === 0 &&
            state.getModule('refrain')?.params?.recall === 0 &&
            state.getModule('changes')?.params?.resetAction === 0 &&
            state.getModule('cascade')?.params?.resetAction === 0;
    });

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).not.toHaveClass(/active/);
    expect(pageErrors).toEqual([]);
});

test('records and replays the CV Recorder test patch through the production worklet', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - CV Recorder');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('recorder'));
    await page.locator('#startButton').click();

    const recorder = page.locator('#module-recorder');
    const record = recorder.locator('.action-btn[data-param="record"]');
    const play = recorder.locator('.action-btn[data-param="play"]');

    await expect(record).toHaveAttribute('data-state', 'ready');
    await expect(record).toHaveAttribute('title', /REC \/ STOP · READY/);
    await expect(play).toHaveAttribute('data-state', 'unavailable');
    await expect(play).toHaveAttribute('title', /PLAY \/ PAUSE · NO RECORDING/);

    await page.evaluate(() => window.eurorackApp.setParam('clock', 'pause', 1));
    await record.click();
    await expect.poll(() => page.evaluate(() => ({
        state: window.eurorackApp.state.getModule('recorder')?.instance?.transportState,
        arm: window.eurorackApp.state.getModule('recorder')?.instance?.recordArmState
    }))).toEqual({ state: 1, arm: 1 });
    await expect(record).toHaveClass(/active/);
    await expect(record).toHaveClass(/is-pending/);
    await expect(record).toHaveAttribute('data-state', 'armed-start');
    await expect(record).toHaveAttribute('title', /REC \/ CANCEL · ARMED START/);
    await expect(play).toHaveAttribute('data-state', 'locked');

    await page.evaluate(() => window.eurorackApp.setParam('clock', 'pause', 0));
    await expect.poll(() => page.evaluate(() => ({
        state: window.eurorackApp.state.getModule('recorder')?.instance?.transportState,
        length: window.eurorackApp.state.getModule('recorder')?.instance?.recordedLength
    })), { timeout: 5000 }).toEqual({ state: 2, length: expect.any(Number) });
    await expect(record).toHaveAttribute('data-state', 'recording');
    await expect(record).toHaveClass(/active/);
    await expect(record).not.toHaveClass(/is-pending/);
    await expect(record).toHaveAttribute('title', /REC \/ STOP · RECORDING/);

    await expect.poll(() => page.evaluate(() => (
        window.eurorackApp.state.getModule('recorder')?.instance?.recordedLength
    )), { timeout: 5000 }).toBeGreaterThanOrEqual(4);

    await page.evaluate(() => window.eurorackApp.setParam('clock', 'pause', 1));
    await record.click();
    await expect.poll(() => page.evaluate(() => ({
        state: window.eurorackApp.state.getModule('recorder')?.instance?.transportState,
        arm: window.eurorackApp.state.getModule('recorder')?.instance?.recordArmState
    }))).toEqual({ state: 1, arm: 2 });
    await expect(record).toHaveClass(/active/);
    await expect(record).toHaveClass(/is-pending/);
    await expect(record).toHaveAttribute('data-state', 'armed-stop');
    await expect(record).toHaveAttribute('title', /STOP \/ CANCEL · ARMED STOP/);

    await page.evaluate(() => window.eurorackApp.setParam('clock', 'pause', 0));
    await expect.poll(() => page.evaluate(() => ({
        state: window.eurorackApp.state.getModule('recorder')?.instance?.transportState,
        mode: window.eurorackApp.state.getModule('recorder')?.instance?.recordedMode,
        length: window.eurorackApp.state.getModule('recorder')?.instance?.recordedLength
    })), { timeout: 5000 }).toEqual({
        state: 3,
        mode: 1,
        length: expect.any(Number)
    });

    await expect(recorder.locator('.cv-rec-display')).toContainText('PLAY C');
    await expect(record).not.toHaveClass(/active/);
    await expect(record).toHaveAttribute('data-state', 'ready');
    await expect(play).toHaveClass(/active/);
    await expect(play).toHaveAttribute('data-state', 'playing');
    await expect(play).toHaveAttribute('title', /PLAY \/ PAUSE · PLAYING/);
    const recorded = await page.evaluate(async () => {
        const state = (await window.eurorackApp.host.engine.captureRuntimeStates()).recorder;
        return {
            gateValues: [...new Set(state.gate1)],
            cv2Values: new Set([...state.cv2].map(value => value.toFixed(4))).size
        };
    });
    expect(recorded.gateValues.sort()).toEqual([0, 1]);
    expect(recorded.cv2Values).toBeGreaterThan(1);

    await expect.poll(() => page.evaluate(() => (
        window.eurorackApp.state.getModule('recorder')?.instance?.playProgress
    )), { timeout: 5000 }).toBeGreaterThan(0);
    await play.click();
    await expect.poll(() => page.evaluate(() => (
        window.eurorackApp.state.getModule('recorder')?.instance?.transportState
    ))).toBe(4);
    await expect(play).not.toHaveClass(/active/);
    await expect(play).toHaveAttribute('data-state', 'paused');
    await expect(play).toHaveAttribute('title', /PLAY \/ PAUSE · PAUSED/);
    await play.click();
    await expect.poll(() => page.evaluate(() => (
        window.eurorackApp.state.getModule('recorder')?.instance?.transportState
    ))).toBe(3);
    await expect(play).toHaveClass(/active/);
    await expect(play).toHaveAttribute('data-state', 'playing');

    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('runs the Pitch Tracker audition and exposes valid pitch and gate activity', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Pitch Tracker');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('scope'));
    await page.locator('#startButton').click();

    await expect.poll(() => page.evaluate(() => (
        window.eurorackApp.state.getModule('tracker')?.instance?.leds?.lock
    )), { timeout: 10_000 }).toBe(1);
    await page.waitForFunction(() => {
        const scope = window.eurorackApp.state.getModule('scope')?.instance;
        return scope?.displayBuffer1?.some(sample => Math.abs(sample) > 0.02)
            && scope?.displayBuffer2?.some(sample => sample >= 9);
    }, null, { timeout: 10_000 });

    await page.evaluate(() => window.eurorackApp.setParam('tracker', 'level', 1));
    await expect.poll(() => (
        page.evaluate(() => window.eurorackApp.state.getModule('tracker')?.instance?.leds?.lock)
    ), { timeout: 10_000 }).toBe(0);

    await page.evaluate(() => window.eurorackApp.setParam('tracker', 'level', 0.5));
    await expect.poll(() => (
        page.evaluate(() => window.eurorackApp.state.getModule('tracker')?.instance?.leds?.lock)
    ), { timeout: 10_000 }).toBe(1);

    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('runs both Shimmer comparison routes with active wet and pitched tails', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Shimmer');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('regenSpectrum'));
    await page.locator('#startButton').click();

    await expect.poll(() => page.evaluate(() => {
        const state = window.eurorackApp.state;
        const input = state.getModule('inputShimmer')?.instance;
        const regen = state.getModule('regenShimmer')?.instance;
        const leftMix = state.getModule('leftMix')?.instance;
        const rightMix = state.getModule('rightMix')?.instance;
        return {
            inputTail: input?.leds?.tail > 0.0001,
            inputPitched: input?.leds?.pitched > 0.0001,
            regenTail: regen?.leds?.tail > 0.0001,
            regenPitched: regen?.leds?.pitched > 0.0001,
            leftMix: leftMix?.leds?.level > 0.0001,
            rightMix: rightMix?.leds?.level > 0.0001
        };
    }), { timeout: 10_000 }).toEqual({
        inputTail: true,
        inputPitched: true,
        regenTail: true,
        regenPitched: true,
        leftMix: true,
        rightMix: true
    });

    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('runs the Vocoder broadband patch and exposes its direct Sibilance path', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Vocoder');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('modMix'));
    await page.locator('#startButton').click();

    await expect.poll(() => page.evaluate(() => {
        const state = window.eurorackApp.state;
        return {
            noise: state.getModule('noise')?.instance?.leds?.active > 0.01,
            modulator: state.getModule('modMix')?.instance?.leds?.level > 0.01,
            analysis: state.getModule('vocoder')?.instance?.leds?.analysis > 0.01,
            carrier: state.getModule('vocoder')?.instance?.leds?.carrier > 0.01,
            output: state.getModule('vocoder')?.instance?.leds?.output > 0.01
        };
    }), { timeout: 10_000 }).toEqual({
        noise: true,
        modulator: true,
        analysis: true,
        carrier: true,
        output: true
    });

    await page.evaluate(() => {
        window.eurorackApp.setParam('vocoder', 'carrierGain', 0);
        window.eurorackApp.setParam('vocoder', 'sibilance', 0);
    });
    await expect.poll(() => (
        page.evaluate(() => window.eurorackApp.state.getModule('vocoder')?.instance?.leds?.output)
    ), { timeout: 10_000 }).toBeLessThan(0.001);

    await page.evaluate(() => window.eurorackApp.setParam('vocoder', 'sibilance', 1));
    await expect.poll(() => (
        page.evaluate(() => window.eurorackApp.state.getModule('vocoder')?.instance?.leds?.output)
    ), { timeout: 10_000 }).toBeGreaterThan(0.01);

    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('runs Probability Sequencer with a Pluck tail beyond its trigger', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Probability Sequencer');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('pluck'));
    await page.locator('#startButton').click();

    await expect.poll(() => page.evaluate(() => ({
        pluck: window.eurorackApp.state.getModule('pluck')?.instance?.leds?.active > 0.01,
        left: window.eurorackApp.state.getModule('out')?.instance?.leds?.L > 0.001,
        right: window.eurorackApp.state.getModule('out')?.instance?.leds?.R > 0.001
    })), { timeout: 10_000 }).toEqual({ pluck: true, left: true, right: true });

    await page.evaluate(() => window.eurorackApp.setParam('clk', 'pause', 1));
    await page.waitForTimeout(100);
    const tail = await page.evaluate(() => ({
        left: window.eurorackApp.state.getModule('out')?.instance?.leds?.L,
        right: window.eurorackApp.state.getModule('out')?.instance?.leds?.R
    }));
    expect(tail.left).toBeGreaterThan(0.0001);
    expect(tail.right).toBeGreaterThan(0.0001);

    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('themes Reset, Mutate, and Recall actions in every rack theme and mode', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Refrain');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => (
        window.eurorackApp.state.getModule('refrain') &&
        window.eurorackApp.state.getModule('changes') &&
        window.eurorackApp.state.getModule('cascade')
    ));

    const selectors = [
        '#module-changes .action-btn[data-param="resetAction"]',
        '#module-cascade .action-btn[data-param="resetAction"]',
        '#module-refrain .action-btn[data-param="mutate"]',
        '#module-refrain .action-btn[data-param="recall"]'
    ];
    const snapshots = {};

    for (const theme of ['industrial', 'classic']) {
        for (const mode of ['light', 'dark']) {
            await page.evaluate(({ theme, mode }) => {
                window.eurorackApp.setTheme(theme);
                window.eurorackApp.setThemeMode(mode);
            }, { theme, mode });
            await page.waitForTimeout(120);

            snapshots[`${theme}-${mode}`] = await page.evaluate(selectors => {
                const buttons = selectors.map(selector => document.querySelector(selector));
                const readStyle = button => {
                    const style = getComputedStyle(button);
                    return {
                        backgroundColor: style.backgroundColor,
                        backgroundImage: style.backgroundImage,
                        borderColor: style.borderTopColor,
                        borderRadius: style.borderTopLeftRadius,
                        boxShadow: style.boxShadow,
                        color: style.color,
                        fontFamily: style.fontFamily,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        height: style.height,
                        textTransform: style.textTransform,
                        transform: style.transform
                    };
                };
                const idle = buttons.map(readStyle);
                buttons.forEach(button => {
                    button.style.transition = 'none';
                    button.classList.add('active');
                });
                void document.body.offsetHeight;
                const active = buttons.map(readStyle);
                buttons.forEach(button => {
                    button.classList.remove('active');
                    button.style.removeProperty('transition');
                });
                return {
                    labels: buttons.map(button => button.textContent),
                    idle,
                    active
                };
            }, selectors);
        }
    }

    Object.values(snapshots).forEach(snapshot => {
        expect(snapshot.labels).toEqual(['Reset', 'Reset', 'Mutate', 'Recall']);
        expect(new Set(snapshot.idle.map(style => JSON.stringify(style))).size).toBe(1);
        snapshot.idle.forEach((style, index) => {
            expect(style.fontSize).toBe('7px');
            expect(style.textTransform).toBe('uppercase');
            expect(style.transform).toBe('none');
            expect(snapshot.active[index].transform).toBe('none');
            expect(snapshot.active[index].backgroundColor).not.toBe(style.backgroundColor);
        });
    });

    expect(snapshots['industrial-light'].idle[0].borderRadius).toBe('0px');
    expect(snapshots['industrial-dark'].idle[0].borderRadius).toBe('0px');
    expect(snapshots['classic-light'].idle[0].borderRadius).toBe('3px');
    expect(snapshots['classic-dark'].idle[0].borderRadius).toBe('3px');
    expect(snapshots['industrial-light'].idle[0].height).toBe('18px');
    expect(snapshots['classic-light'].idle[0].height).toBe('20px');

    for (const theme of ['industrial', 'classic']) {
        expect(
            JSON.stringify(snapshots[`${theme}-light`].idle[0])
        ).not.toBe(
            JSON.stringify(snapshots[`${theme}-dark`].idle[0])
        );
    }
    expect(pageErrors).toEqual([]);
});

test('collects opt-in AudioWorklet profiling without module failures', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Chorus');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('chorus'));
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);

    await page.evaluate(() => window.eurorackApp.host.engine.setProfiling(true, { reset: true }));
    await expect.poll(async () => page.evaluate(async () => {
        const report = await window.eurorackApp.host.engine.requestProfilingReport();
        return report.blocks.samples;
    })).toBeGreaterThan(0);
    await expect.poll(async () => page.evaluate(async () => {
        const report = await window.eurorackApp.host.engine.requestProfilingReport();
        return report.modules.chorus?.samples || 0;
    })).toBeGreaterThan(0);
    const report = await page.evaluate(async () => {
        const result = await window.eurorackApp.host.engine.requestProfilingReport();
        window.eurorackApp.host.engine.setProfiling(false);
        return result;
    });

    expect(report.deadlineMs).toBeGreaterThan(0);
    expect(report.blocks.samples).toBeGreaterThan(0);
    expect(report.blocks.p99).toBeGreaterThanOrEqual(0);
    expect(report.blocks.p99Utilization).toBeGreaterThanOrEqual(0);
    expect(report.modules.chorus.samples).toBeGreaterThan(0);
});

test('loads compact and generative synth voice demos while audio is active', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await expect(page.locator('#patchSelect option', { hasText: 'Demo - Synth Voice' })).toHaveCount(12);

    await page.locator('#patchSelect').selectOption('Demo - Synth Voice 01 - Subtractive');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('seq'));
    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);

    const revision = await page.evaluate(() => window.eurorackApp.host.engine.revision);
    await page.locator('#patchSelect').selectOption('Demo - Synth Voice 12 - Dynamic Generative');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(previousRevision => (
        window.eurorackApp.state.getModule('cycle') &&
        window.eurorackApp.state.getModule('waveVca') &&
        window.eurorackApp.host.engine?.revision > previousRevision
    ), revision);

    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('runs the round-robin demo with audible alternating voice output', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Demo - Round Robin - Alternating Voices');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => (
        window.eurorackApp.state.getModule('pitchRoute') &&
        window.eurorackApp.state.getModule('pitchHold') &&
        window.eurorackApp.state.getModule('lpgA') &&
        window.eurorackApp.state.getModule('lpgB')
    ));

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.evaluate(() => {
        const { audioCtx, engine } = window.eurorackApp.host;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        engine.node.connect(analyser);
        window.roundRobinAnalyser = analyser;
    });
    await expect.poll(async () => page.evaluate(() => {
        const samples = new Float32Array(window.roundRobinAnalyser.fftSize);
        window.roundRobinAnalyser.getFloatTimeDomainData(samples);
        return Math.max(...samples.map(Math.abs));
    }), { timeout: 8000 }).toBeGreaterThan(0.001);

    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('fits the ensemble oscillator inside one module and runs its worklet DSP', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Ensemble VCO');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('ensemble'));

    const bounds = await page.locator('#module-ensemble').evaluate(panel => {
        const content = panel.querySelector('.module-content');
        const panelRect = panel.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        return {
            panelBottom: panelRect.bottom,
            contentBottom: contentRect.bottom,
            scrollHeight: content.scrollHeight,
            clientHeight: content.clientHeight
        };
    });
    expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.panelBottom + 1);
    expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => window.eurorackApp.host.engine?.revision > 0);
    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});

test('fits every resonator bank socket inside its module and runs its worklet DSP', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => window.eurorackApp?.host);
    await page.locator('#patchSelect').selectOption('Test - Resonator Bank');
    await page.locator('#loadPatch').click();
    await page.waitForFunction(() => window.eurorackApp.state.getModule('resbank'));

    const bounds = await page.locator('#module-resbank').evaluate(panel => {
        const content = panel.querySelector('.module-content');
        const audioInput = panel.querySelector('#jack-resbank-audio');
        const cvJacks = [...panel.querySelectorAll(
            '#jack-resbank-vOct, #jack-resbank-frequencyCv, #jack-resbank-structureCv, ' +
            '#jack-resbank-brightnessCv, #jack-resbank-dampingCv, #jack-resbank-positionCv'
        )];
        const panelRect = panel.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const audioInputRect = audioInput.getBoundingClientRect();
        const cvRects = cvJacks.map(jack => {
            const rect = jack.closest('.jack-container').getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        const cvOverlaps = cvRects.some((rect, index) => (
            cvRects.slice(index + 1).some(other => (
                rect.left < other.right &&
                rect.right > other.left &&
                rect.top < other.bottom &&
                rect.bottom > other.top
            ))
        ));
        return {
            panelBottom: panelRect.bottom,
            contentBottom: contentRect.bottom,
            audioInputBottom: audioInputRect.bottom,
            scrollHeight: content.scrollHeight,
            clientHeight: content.clientHeight,
            cvColumns: getComputedStyle(
                panel.querySelector('.resbank-sockets .socket-column:nth-child(2) .socket-grid')
            ).gridTemplateColumns.split(' ').length,
            cvRows: new Set(cvRects.map(rect => Math.round(rect.top))).size,
            cvOverlaps
        };
    });
    expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.panelBottom + 1);
    expect(bounds.audioInputBottom).toBeLessThanOrEqual(bounds.panelBottom + 1);
    expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);
    expect(bounds.cvColumns).toBe(3);
    expect(bounds.cvRows).toBe(2);
    expect(bounds.cvOverlaps).toBe(false);

    await page.locator('#startButton').click();
    await expect(page.locator('#startButton')).toHaveClass(/active/);
    await page.waitForFunction(() => window.eurorackApp.host.engine?.revision > 0);
    await page.locator('#startButton').click();
    expect(pageErrors).toEqual([]);
});
