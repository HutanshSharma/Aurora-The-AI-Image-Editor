import { runModel } from './onnxClient.js';

const MODEL_URL = '/models/deepwb_awb.onnx';
const DIM = 256;
const N = 33;    

const DEBUG = false;
const meanRGB = (rgba) => {
  let r = 0, g = 0, b = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) { r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; }
  return [+(r / n / 255).toFixed(3), +(g / n / 255).toFixed(3), +(b / n / 255).toFixed(3)];
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function toRGBA(image, dim) {
  const c = document.createElement('canvas');
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (image instanceof ImageData) {
    const t = document.createElement('canvas');
    t.width = image.width;
    t.height = image.height;
    t.getContext('2d').putImageData(image, 0, 0);
    ctx.drawImage(t, 0, 0, dim, dim);
  } else {
    ctx.drawImage(image, 0, 0, dim, dim);
  }
  return ctx.getImageData(0, 0, dim, dim).data;
}

function kernel(r, g, b, out) {
  out[0] = r; out[1] = g; out[2] = b;
  out[3] = r * g; out[4] = r * b; out[5] = g * b;
  out[6] = r * r; out[7] = g * g; out[8] = b * b;
  out[9] = r * g * b; out[10] = 1;
}

function solve(A, B) {
  const n = 11;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (piv !== col) { const ta = A[col]; A[col] = A[piv]; A[piv] = ta; const tb = B[col]; B[col] = B[piv]; B[piv] = tb; }
    const d = A[col][col] || 1e-9;
    for (let j = col; j < n; j++) A[col][j] /= d;
    for (let j = 0; j < 3; j++) B[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (!f) continue;
      for (let j = col; j < n; j++) A[r][j] -= f * A[col][j];
      for (let j = 0; j < 3; j++) B[r][j] -= f * B[col][j];
    }
  }
  return B;
}

function fitPolynomial(inRGBA, outRGBA) {
  const A = Array.from({ length: 11 }, () => new Float64Array(11));
  const B = Array.from({ length: 11 }, () => new Float64Array(3));
  const f = new Float64Array(11);
  for (let i = 0; i < inRGBA.length; i += 4) {
    kernel(inRGBA[i] / 255, inRGBA[i + 1] / 255, inRGBA[i + 2] / 255, f);
    const yr = outRGBA[i] / 255, yg = outRGBA[i + 1] / 255, yb = outRGBA[i + 2] / 255;
    for (let a = 0; a < 11; a++) {
      const fa = f[a];
      for (let b = a; b < 11; b++) A[a][b] += fa * f[b];
      B[a][0] += fa * yr; B[a][1] += fa * yg; B[a][2] += fa * yb;
    }
  }
  for (let a = 0; a < 11; a++) { for (let b = 0; b < a; b++) A[a][b] = A[b][a]; A[a][a] += 1e-4; }
  return solve(A, B);
}

function bakeLUT(M) {
  const data = new Array(N * N * N);
  const f = new Float64Array(11);
  for (let b = 0; b < N; b++) {
    const B = b / (N - 1);
    for (let g = 0; g < N; g++) {
      const G = g / (N - 1);
      for (let r = 0; r < N; r++) {
        kernel(r / (N - 1), G, B, f);
        let or = 0, og = 0, ob = 0;
        for (let a = 0; a < 11; a++) { or += f[a] * M[a][0]; og += f[a] * M[a][1]; ob += f[a] * M[a][2]; }
        data[r + g * N + b * N * N] = [clamp01(or), clamp01(og), clamp01(ob)];
      }
    }
  }
  return { size: N, data };
}

export async function getWhiteBalance(image) {
  const inRGBA = toRGBA(image, DIM);
  const hw = DIM * DIM;
  const input = new Float32Array(3 * hw);
  for (let i = 0; i < hw; i++) {
    const p = i * 4;
    input[i] = inRGBA[p] / 255;
    input[hw + i] = inRGBA[p + 1] / 255;
    input[2 * hw + i] = inRGBA[p + 2] / 255;
  }
  let outputs;
  try {
    outputs = await runModel(MODEL_URL, input, [1, 3, DIM, DIM]);
  } catch (e) {
    console.warn('Deep-WB model unavailable — skipping white balance:', e.message);
    return null;
  }
  const o = outputs[Object.keys(outputs)[0]].data; // single output [1,3,DIM,DIM]
  const outRGBA = new Uint8ClampedArray(hw * 4);
  for (let i = 0; i < hw; i++) {
    outRGBA[i * 4] = clamp01(o[i]) * 255;
    outRGBA[i * 4 + 1] = clamp01(o[hw + i]) * 255;
    outRGBA[i * 4 + 2] = clamp01(o[2 * hw + i]) * 255;
    outRGBA[i * 4 + 3] = 255;
  }
  const lut = bakeLUT(fitPolynomial(inRGBA, outRGBA));

  if (DEBUG) {
    let err = 0;
    const ND = N - 1, N2 = N * N;
    for (let i = 0; i < inRGBA.length; i += 4) {
      const r = Math.round((inRGBA[i] / 255) * ND);
      const g = Math.round((inRGBA[i + 1] / 255) * ND);
      const b = Math.round((inRGBA[i + 2] / 255) * ND);
      const c = lut.data[r + g * N + b * N2];
      err += Math.abs(c[0] * 255 - outRGBA[i]) + Math.abs(c[1] * 255 - outRGBA[i + 1]) + Math.abs(c[2] * 255 - outRGBA[i + 2]);
    }
    err = err / (inRGBA.length / 4) / 3;
    const inM = meanRGB(inRGBA);
    const outM = meanRGB(outRGBA);
    const spread = (m) => +(Math.max(...m) - Math.min(...m)).toFixed(3);
    console.log(
      '%c[deepwb] white balance',
      'color:#06b6d4;font-weight:bold',
      {
        inputMeanRGB: inM, inputCastSpread: spread(inM),
        correctedMeanRGB: outM, correctedSpread: spread(outM),
        lutFitErr255: +err.toFixed(2),
      },
    );
  }
  return { lut, correctedRGBA: outRGBA, dim: DIM };
}
