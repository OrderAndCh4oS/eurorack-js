/**
 * WAV file encoder for stereo audio
 * Encodes Float32 audio buffers to 16-bit PCM WAV format
 *
 * Note: Eurorack uses ±5V for audio signals. WAV files use ±1.0 normalized.
 * This encoder normalizes by dividing by 5 so 5V eurorack = 0dBFS in WAV.
 */

// Eurorack audio standard: ±5V peak
const EURORACK_AUDIO_VOLTAGE = 5;

/**
 * Encode arrays of audio buffers to a WAV blob
 * @param {Float32Array[]} buffersL - Array of left channel buffers (eurorack ±5V)
 * @param {Float32Array[]} buffersR - Array of right channel buffers (eurorack ±5V)
 * @param {number} sampleRate - Sample rate (default 44100)
 * @returns {Blob} WAV file as Blob
 */
export function encodeWav(buffersL, buffersR, sampleRate = 44100) {
    // Calculate total samples
    const totalSamples = buffersL.reduce((sum, buf) => sum + buf.length, 0);
    const numChannels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalSamples * blockAlign;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    // Create buffer for entire file
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // Write RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);  // File size minus RIFF header
    writeString(view, 8, 'WAVE');

    // Write fmt subchunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);           // Subchunk size (16 for PCM)
    view.setUint16(20, 1, true);            // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);  // Number of channels
    view.setUint32(24, sampleRate, true);   // Sample rate
    view.setUint32(28, byteRate, true);     // Byte rate
    view.setUint16(32, blockAlign, true);   // Block align
    view.setUint16(34, bitsPerSample, true); // Bits per sample

    // Write data subchunk header
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);     // Data size

    // Write interleaved audio data
    // Normalize from eurorack ±5V to WAV ±1.0
    let offset = headerSize;
    for (let i = 0; i < buffersL.length; i++) {
        const bufL = buffersL[i];
        const bufR = buffersR[i];
        for (let j = 0; j < bufL.length; j++) {
            // Normalize eurorack voltage to -1..1 range, then convert to 16-bit int
            const normalizedL = bufL[j] / EURORACK_AUDIO_VOLTAGE;
            const normalizedR = bufR[j] / EURORACK_AUDIO_VOLTAGE;
            const sampleL = Math.max(-1, Math.min(1, normalizedL));
            const sampleR = Math.max(-1, Math.min(1, normalizedR));
            view.setInt16(offset, sampleL * 0x7FFF, true);
            offset += 2;
            view.setInt16(offset, sampleR * 0x7FFF, true);
            offset += 2;
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Write a string to DataView at specified offset
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Trigger download of a WAV blob
 * @param {Blob} blob - WAV file blob
 * @param {string} filename - Download filename
 */
export function downloadWav(blob, filename = 'recording.wav') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
