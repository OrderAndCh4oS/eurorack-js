export const MEASUREMENT_CHANGES = new Set(['param-changed', 'module-added', 'module-removed', 'cables-changed', 'patch-loaded', 'registry']);
const error = (code, message) => Object.assign(new Error(message), {code});

/** Opt-in analysis of the live final output. PCM stays in memory in this tab. */
export function createAudioAnalysis({host, getRevision, Worker = globalThis.Worker, timeoutMs = 20000}) {
    let active = null;
    let disposed = false;
    return {
        async measure({durationSeconds = 5, expectedRevision, signal, onPhase} = {}) {
            signal?.throwIfAborted();
            if (!Number.isFinite(durationSeconds) || durationSeconds < 0.5 || durationSeconds > 10
                || (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision < 1))) {
                throw error('invalid-input', 'Choose a duration from 0.5 to 10 seconds and a valid rack revision.');
            }
            if (disposed) throw error('analysis-unavailable', 'Audio analysis is unavailable in this tab.');
            if (active) throw error('busy', 'An audio measurement is already running.');
            const revision = getRevision();
            if (expectedRevision !== undefined && expectedRevision !== revision) throw error('rack-changed', 'The rack changed. Read it again before measuring.');
            const context = host.audioCtx;
            const engine = host.engine;
            if (!engine || context?.state !== 'running') throw error('audio-not-running', 'Press Start in the rack before measuring audio.');
            if (!Worker) throw error('analysis-unavailable', 'This browser cannot run audio analysis.');
            const controller = new AbortController();
            active = controller;
            let worker;
            let unsubscribe;
            let timer;
            const abort = () => controller.abort(signal.reason);
            const onState = () => {
                if (context.state !== 'running') controller.abort(error('audio-not-running', 'Audio stopped during the measurement.'));
            };
            const onChange = event => {
                if (MEASUREMENT_CHANGES.has(event.type)) controller.abort(error('rack-changed', 'The rack changed during the measurement. Measure again.'));
                else if (['audio-stopped', 'audio-error', 'module-error'].includes(event.type)) {
                    controller.abort(error('audio-not-running', 'Audio stopped or failed during the measurement.'));
                }
            };
            try {
                signal?.addEventListener('abort', abort, {once: true});
                context.addEventListener?.('statechange', onState);
                unsubscribe = host.subscribe(onChange);
                const cancelled = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {once: true}));
                let loaded, analysed;
                const ready = new Promise(resolve => {loaded = resolve;});
                const report = new Promise(resolve => {analysed = resolve;});
                onPhase?.('loading');
                worker = new Worker(new URL('./analysis-worker.js', import.meta.url), {type: 'module'});
                worker.onmessage = ({data}) => {
                    if (data?.type === 'ready') loaded(data.version);
                    else if (data?.type === 'result') analysed(data.report);
                    else if (data?.type === 'error') controller.abort(error('analysis-failed', data.message || 'Audio analysis failed.'));
                };
                worker.onerror = event => {event.preventDefault?.(); controller.abort(error('analysis-failed', 'Could not load or run audio analysis.'));};
                worker.onmessageerror = () => controller.abort(error('analysis-failed', 'Could not read the audio analysis result.'));
                timer = setTimeout(() => controller.abort(error('analysis-timeout', 'Audio analysis timed out. Try a shorter measurement.')), durationSeconds * 1000 + timeoutMs);
                const operation = async () => {
                    const implementationVersion = await ready;
                    controller.signal.throwIfAborted();
                    const requestedAtContextTime = context.currentTime;
                    onPhase?.('capturing');
                    const pcm = await engine.captureOutput({durationSeconds, signal: controller.signal});
                    controller.signal.throwIfAborted();
                    if (getRevision() !== revision || host.engine !== engine) throw error('rack-changed', 'The rack changed during the measurement. Measure again.');
                    const capture = {frames: pcm.frames, sampleRate: pcm.sampleRate, durationSeconds: pcm.frames / pcm.sampleRate,
                        engineRevision: pcm.revision, requestedAtContextTime, startTimeSeconds: pcm.startTimeSeconds ?? null,
                        signal: 'final-stereo-output-after-volume-and-limiter'};
                    onPhase?.('analysing');
                    worker.postMessage({type: 'analyze', left: pcm.left, right: pcm.right, sampleRate: pcm.sampleRate}, [pcm.left.buffer, pcm.right.buffer]);
                    const result = await report;
                    controller.signal.throwIfAborted();
                    if (getRevision() !== revision || host.engine !== engine) throw error('rack-changed', 'The rack changed during the measurement. Measure again.');
                    if (result?.schemaVersion !== 1 || JSON.stringify(result).length > 65536) throw error('analysis-failed', 'Audio analysis returned an invalid report.');
                    return {revision, implementationVersion, capture, report: result};
                };
                return await Promise.race([operation(), cancelled]);
            } finally {
                clearTimeout(timer);
                signal?.removeEventListener('abort', abort);
                context.removeEventListener?.('statechange', onState);
                unsubscribe?.();
                if (worker) {worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();}
                if (active === controller) active = null;
            }
        },
        cancel() {active?.abort(new DOMException('Measurement cancelled.', 'AbortError'));},
        dispose() {disposed = true; active?.abort(new DOMException('Audio analysis closed.', 'AbortError'));}
    };
}
