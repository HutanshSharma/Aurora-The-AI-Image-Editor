import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = 1;

const sessions = {};
function getSession(url) {
  if (!sessions[url]) {
    sessions[url] = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`model ${res.status}`);
      return ort.InferenceSession.create(await res.arrayBuffer(), { executionProviders: ['wasm'] });
    })().catch((e) => {
      delete sessions[url]; 
      throw e;
    });
  }
  return sessions[url];
}

self.onmessage = async (e) => {
  const { id, modelUrl, inputData, inputDims } = e.data;
  try {
    const session = await getSession(modelUrl);
    const tensor = new ort.Tensor('float32', inputData, inputDims);
    const out = await session.run({ [session.inputNames[0]]: tensor });

    const outputs = {};
    const transfers = [];
    for (const name of session.outputNames) {
      const t = out[name];
      const data = new Float32Array(t.data); // copy out of wasm memory before transfer
      outputs[name] = { data, dims: Array.from(t.dims) };
      transfers.push(data.buffer);
    }
    self.postMessage({ id, ok: true, outputs }, transfers);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
