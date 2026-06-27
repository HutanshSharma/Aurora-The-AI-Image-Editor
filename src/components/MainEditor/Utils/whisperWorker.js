const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

let transcriberPromise = null;
function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import(TRANSFORMERS_URL);
      env.allowLocalModels = false; 
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        progress_callback: (p) => self.postMessage({ type: 'progress', data: p }),
        session_options: { logSeverityLevel: 3 },
      });
    })().catch((e) => {
      transcriberPromise = null;
      throw e;
    });
  }
  return transcriberPromise;
}

self.onmessage = async (e) => {
  const { type, id, audio } = e.data;
  if (type === 'preload') {
    getTranscriber()
      .then(() => self.postMessage({ type: 'ready' }))
      .catch((err) => self.postMessage({ type: 'load-error', error: String((err && err.message) || err) }));
    return;
  }

  if (type !== 'transcribe') return;
  try {
    const transcriber = await getTranscriber();
    const output = await transcriber(audio);
    self.postMessage({ type: 'result', id, text: (output && output.text ? output.text : '').trim() });
  } catch (err) {
    self.postMessage({ type: 'error', id, error: String((err && err.message) || err) });
  }
};
