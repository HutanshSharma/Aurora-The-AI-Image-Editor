let worker = null;
let seq = 0;
const pending = new Map();
let progressHandler = null;

export function setWhisperProgressHandler(fn) {
  progressHandler = fn;
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./whisperWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { type, id, text, error, data } = e.data;
      if (type === 'progress') {
        progressHandler?.(data);
        return;
      }
      if (type === 'ready') {
        progressHandler?.({ status: 'ready' });
        return;
      }
      if (type === 'load-error') {
        progressHandler?.({ status: 'load-error', error });
        return;
      }
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (type === 'result') p.resolve(text);
      else p.reject(new Error(error || 'Transcription failed'));
    };
    worker.onerror = (e) => {
      const err = new Error(e.message || 'Whisper worker error');
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    };
  }
  return worker;
}

export function preloadWhisper() {
  getWorker().postMessage({ type: 'preload' });
}

/**
 * Transcribe 16kHz mono audio.
 * @param {Float32Array} audio 
 * @returns {Promise<string>}
 */
export function transcribe(audio) {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: 'transcribe', id, audio }, [audio.buffer]);
  });
}
