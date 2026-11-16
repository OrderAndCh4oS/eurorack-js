import {AUDIO_ANALYSIS} from '../../wasm/audio-analysis/manifest.js';

// Only the versioned same-origin program is fetched. Captured PCM is transferred
// in memory, never encoded, stored, or sent to a server.
let analyze;
try {
    const kernel = await import(AUDIO_ANALYSIS.moduleUrl);
    await kernel.default();
    analyze = kernel.analyze;
    self.postMessage({type: 'ready', version: AUDIO_ANALYSIS.version});
} catch {
    self.postMessage({type: 'error', message: 'Could not load audio analysis. Please try again.'});
}
self.onmessage = ({data}) => {
    if (data?.type !== 'analyze' || !analyze) return;
    try {
        const report = JSON.parse(analyze(data.left, data.right, data.sampleRate));
        self.postMessage({type: 'result', report});
    } catch (error) {
        self.postMessage({type: 'error', message: typeof error === 'string' ? error : error.message || 'Audio analysis failed.'});
    } finally {
        // The controller terminates this worker once the bounded report arrives.
        data.left = null; data.right = null;
    }
};
