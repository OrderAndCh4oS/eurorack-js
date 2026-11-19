const HISTORY_LIMIT = 16;
const HISTORY_CHARACTERS = 4 * 1024 * 1024;

function snapshot(value) {
    try { return JSON.stringify(value, null, 2) ?? ''; }
    catch { return 'This value cannot be displayed as JSON.'; }
}

function resultSummary(tool, result) {
    const count = (value, label) => `${value} ${label}${value === 1 ? '' : 's'}`;
    if (!result.ok) return result.error.message;
    if (tool === 'present_step') return result.caption;
    if (tool === 'apply_draft') return result.applied ? 'Draft applied to the rack.' : 'Draft application cancelled.';
    if (tool === 'describe_modules') return count(result.modules.length, 'module definition');
    if (tool === 'measure_audio' && result.capture) return `${result.capture.durationSeconds} s of stereo output · revision ${result.revision}`;
    const wiring = result.diagnostics ?? result;
    if (Array.isArray(wiring.issues)) return [count(wiring.moduleCount, 'module'), count(wiring.cableCount, 'cable'), count(wiring.issues.length, 'wiring issue')].join(' · ');
    return '';
}

/** Tab-local requests and responses. Only the latest successful capture supplies the meters. */
export class RackActivity extends EventTarget {
    entries = [];
    lastMeasurement = null;
    #completed = [];
    #characters = 0;

    notify(entry) {
        this.dispatchEvent(new CustomEvent('change', {detail: entry}));
    }

    async run(source, tool, input, operation) {
        const entry = {source, tool, startedAt: Date.now(), request: snapshot(input), status: 'running', phase: null};
        if (tool === 'measure_audio') entry.durationSeconds = input?.durationSeconds ?? 5;
        this.entries.unshift(entry);
        this.notify(entry);
        let result;
        try {
            const data = await operation((phase, step) => {
                entry.phase = phase;
                if (step) entry.step = step;
                this.notify(entry);
            });
            result = {ok: true, ...data};
        } catch (error) {
            const cancelled = error?.name === 'AbortError';
            result = {ok: false, error: {
                code: cancelled ? 'cancelled' : error?.code || 'operation-failed',
                message: cancelled ? 'Operation cancelled.' : error?.message || 'Operation failed.'
            }};
        }

        const measured = tool === 'measure_audio' && result.ok;
        entry.response = snapshot(result);
        entry.summary = resultSummary(tool, result);
        entry.finishedAt = Date.now();
        if (result.ok) entry.status = result.applied === false ? 'cancelled' : 'complete';
        else {
            entry.status = result.error.code === 'cancelled' ? 'cancelled' : 'failed';
            entry.error = result.error;
        }
        if (measured) this.lastMeasurement = entry;
        this.#completed.push(entry);
        this.#characters += entry.request.length + entry.response.length;
        // Keep each payload inspectable in full, including the newest large patch.
        while (this.#completed.length > 1 && (this.#completed.length > HISTORY_LIMIT || this.#characters > HISTORY_CHARACTERS)) {
            const oldest = this.#completed.shift();
            this.#characters -= oldest.request.length + oldest.response.length;
            this.entries.splice(this.entries.indexOf(oldest), 1);
        }
        this.notify(entry);
        return result;
    }
}
