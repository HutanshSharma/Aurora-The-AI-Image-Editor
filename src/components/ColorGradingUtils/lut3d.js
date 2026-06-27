import { runModel } from './onnxClient.js';

const CLASSIFIER_URL = '/models/lut3d_classifier.onnx';
const BASIS_URL = '/models/lut3d_basis.bin';
const N = 33;           
const N3 = N * N * N;   
const SAMPLE_DIM = 256; 
let basisPromise = null;

function getBasis() {
  if (!basisPromise) {
    basisPromise = (async () => {
      const res = await fetch(BASIS_URL);
      if (!res.ok) throw new Error(`basis ${res.status}`);
      const buf = await res.arrayBuffer();
      const f = new Float32Array(buf); // [3 basis][3 ch][33][33][33], layout c,B,G,R
      if (f.length !== 3 * 3 * N3) throw new Error(`basis size ${f.length}`);
      return f;
    })();
  }
  return basisPromise;
}

function toInputData(imageData) {
  const c = document.createElement('canvas');
  c.width = SAMPLE_DIM;
  c.height = SAMPLE_DIM;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (imageData instanceof ImageData) {
    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d').putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, SAMPLE_DIM, SAMPLE_DIM);
  } else {
    ctx.drawImage(imageData, 0, 0, SAMPLE_DIM, SAMPLE_DIM);
  }
  const { data } = ctx.getImageData(0, 0, SAMPLE_DIM, SAMPLE_DIM);
  const hw = SAMPLE_DIM * SAMPLE_DIM;
  const arr = new Float32Array(3 * hw);
  for (let i = 0; i < hw; i++) {
    const p = i * 4;
    arr[i] = data[p] / 255;
    arr[hw + i] = data[p + 1] / 255;
    arr[2 * hw + i] = data[p + 2] / 255;
  }
  return arr;
}

export async function getAdaptiveLUT(image) {
  const input = toInputData(image);
  const [outputs, basis] = await Promise.all([
    runModel(CLASSIFIER_URL, input, [1, 3, SAMPLE_DIM, SAMPLE_DIM]),
    getBasis(),
  ]);
  const w = outputs[Object.keys(outputs)[0]].data; 
  const w0 = w[0], w1 = w[1], w2 = w[2];

  const basisStride = 3 * N3;
  const data = new Array(N3);
  for (let idx = 0; idx < N3; idx++) {
    const r = w0 * basis[idx] + w1 * basis[basisStride + idx] + w2 * basis[2 * basisStride + idx];
    const g = w0 * basis[N3 + idx] + w1 * basis[basisStride + N3 + idx] + w2 * basis[2 * basisStride + N3 + idx];
    const b = w0 * basis[2 * N3 + idx] + w1 * basis[basisStride + 2 * N3 + idx] + w2 * basis[2 * basisStride + 2 * N3 + idx];
    data[idx] = [r, g, b];
  }
  return { size: N, data, weights: [w0, w1, w2] };
}
