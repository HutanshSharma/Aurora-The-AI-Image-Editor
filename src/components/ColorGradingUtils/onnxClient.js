let worker = null;
let seq = 0;
const pending = new Map();

let onWorkerError = null;
export function setWorkerErrorHandler(fn) {
  onWorkerError = fn;
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./onnxWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, ok, outputs, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(outputs);
      else p.reject(new Error(error));
    };
    worker.onerror = (e) => {
      if (onWorkerError) {
        onWorkerError('AI enhancement tools couldn’t start in the background — results may be slower or use a simpler fallback.');
      }
      const err = new Error(e.message || 'ONNX worker error');
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    };
  }
  return worker;
}

/**
 * @param {string} modelUrl 
 * @param {Float32Array} inputData 
 * @param {number[]} inputDims 
 * @returns {Promise<Object>} 
 */
export function runModel(modelUrl, inputData, inputDims) {
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error('ONNX worker timed out'));
    }, 60000);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    try {
      w.postMessage({ id, modelUrl, inputData, inputDims }, [inputData.buffer]);
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e);
    }
  });
}
