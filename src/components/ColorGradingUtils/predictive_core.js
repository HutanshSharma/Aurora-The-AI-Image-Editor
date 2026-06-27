import { runModel as runModelWorker } from './onnxClient.js';
import { getWhiteBalance } from './deepwb.js';

const MODEL_URL = '/models/neurop_lite.onnx';
const SAMPLE_DIM = 256; 

const DEBUG = false;
const dbg = (...a) => { if (DEBUG) console.log(...a); };
const GRADE_STRENGTH = 1;
const amplify = (v) => 100 + (v - 100) * GRADE_STRENGTH;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function pickImageData(input) {
  if (Array.isArray(input)) {
    return input.find((im) => im && im.data && im.width > 0 && im.height > 0) || null;
  }
  if (input instanceof ImageData) return input;
  if (input && input.data && input.width > 0 && input.height > 0) return input;
  return null;
}

function resizeRGBA(src, sw, sh, dim) {
  const out = new Uint8ClampedArray(dim * dim * 4);
  for (let y = 0; y < dim; y++) {
    const sy = Math.min(sh - 1, (y / dim * sh) | 0);
    for (let x = 0; x < dim; x++) {
      const sx = Math.min(sw - 1, (x / dim * sw) | 0);
      const s = (sy * sw + sx) * 4;
      const d = (y * dim + x) * 4;
      out[d] = src[s];
      out[d + 1] = src[s + 1];
      out[d + 2] = src[s + 2];
      out[d + 3] = 255;
    }
  }
  return out;
}

function computeStats(rgba) {
  const px = rgba.length / 4;
  const hist = new Float64Array(256);
  let sumLuma = 0;
  let sumSat = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    sumLuma += luma;
    hist[Math.round(luma)]++;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sumSat += mx === 0 ? 0 : (mx - mn) / mx;
  }
  const pct = (frac) => {
    const target = px * frac;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v / 255;
    }
    return 1;
  };
  return {
    meanLuma: sumLuma / px / 255,
    meanSat: sumSat / px,
    p5: pct(0.05),
    p95: pct(0.95),
  };
}

async function runNeurOp(rgba, dim) {
  const hw = dim * dim;
  const input = new Float32Array(3 * hw); // NCHW, 0..1
  for (let i = 0; i < hw; i++) {
    const p = i * 4;
    input[i] = rgba[p] / 255;
    input[hw + i] = rgba[p + 1] / 255;
    input[2 * hw + i] = rgba[p + 2] / 255;
  }
  dbg('[predictive] 3) running NeurOp', { shape: [1, 3, dim, dim] });
  const out = await runModelWorker(MODEL_URL, input, [1, 3, dim, dim]);
  const names = Object.keys(out);
  dbg('[predictive] 4) model outputs', Object.fromEntries(names.map((n) => [n, out[n].dims])));
  const imgOutputs = names.filter((n) => {
    const d = out[n].dims;
    return d.length === 4 && d[1] === 3;
  });

  const name =
    imgOutputs.find((n) => !n.startsWith('onnx::')) ||
    imgOutputs[imgOutputs.length - 1] ||
    names[0];
  dbg('[predictive] 5) chose enhanced-image output', { used: name, candidates: imgOutputs });
  const o = out[name];
  const [, , H, W] = o.dims;
  const ohw = H * W;
  const d = o.data;
  const res = new Uint8ClampedArray(ohw * 4);
  for (let i = 0; i < ohw; i++) {
    res[i * 4] = clamp01(d[i]) * 255;
    res[i * 4 + 1] = clamp01(d[ohw + i]) * 255;
    res[i * 4 + 2] = clamp01(d[2 * ohw + i]) * 255;
    res[i * 4 + 3] = 255;
  }
  return { rgba: res, dims: o.dims, name };
}

function gradeFromStats(s) {
  let brightness = 100 * (0.5 / Math.max(0.04, s.meanLuma));
  brightness = 100 + (brightness - 100) * 0.6; // soften the correction
  brightness = clamp(amplify(brightness), 75, 140);

  const range = Math.max(0, s.p95 - s.p5);
  const contrast = clamp(amplify(100 + (0.75 - range) * 70), 92, 128); // widen a narrow tonal range

  const saturation = clamp(amplify(100 + (0.32 - s.meanSat) * 80), 92, 122); // lift flat colour, tame punchy

  return {
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    saturation: Math.round(saturation),
  };
}

function gradeFromReference(inS, outS) {
  const brightness = clamp(amplify(100 * (outS.meanLuma / Math.max(0.04, inS.meanLuma))), 70, 150);
  const inRange = Math.max(0.04, inS.p95 - inS.p5);
  const outRange = Math.max(0, outS.p95 - outS.p5);
  const contrast = clamp(amplify(100 * (outRange / inRange)), 80, 145);
  const saturation = clamp(amplify(100 * (outS.meanSat / Math.max(0.04, inS.meanSat))), 80, 145);
  return {
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    saturation: Math.round(saturation),
  };
}

async function predictGrade(imageData, smallOverride) {
  dbg('[predictive] 2) input image', { width: imageData.width, height: imageData.height, analyzedAt: `${SAMPLE_DIM}x${SAMPLE_DIM}`, wbCorrected: !!smallOverride });
  const small = smallOverride || resizeRGBA(imageData.data, imageData.width, imageData.height, SAMPLE_DIM);
  const inStats = computeStats(small);

  try {
    const { rgba: outRgba, dims, name } = await runNeurOp(small, SAMPLE_DIM);
    const outStats = computeStats(outRgba);
    const grade = gradeFromReference(inStats, outStats);
    dbg(
      '%c[predictive] ✓ NeurOp model ran — grade fit from model output',
      'color:#22c55e;font-weight:bold',
      { outputUsed: name, dims, inputStats: inStats, modelOutputStats: outStats, grade },
    );
    return { ...grade, isAI: true, modelUsed: 'NeurOp (ONNX)', confidence: 0.9 };
  } catch (e) {
    console.warn('NeurOp inference failed — falling back to auto-grade:', e);
  }
  const grade = gradeFromStats(inStats);
  dbg(
    '%c[predictive] ⚠ heuristic auto-grade (model not used)',
    'color:#f59e0b;font-weight:bold',
    { input: inStats, grade },
  );
  return { ...grade, isAI: false, modelUsed: 'Auto-grade', confidence: 0.6 };
}

export async function infer(fullResImageData) {
  const img = pickImageData(fullResImageData);
  if (!img) return null;

  let wbLUT = null;
  let corrected = null;
  try {
    const wb = await getWhiteBalance(img);
    if (wb) { wbLUT = wb.lut; corrected = wb.correctedRGBA; }
  } catch (e) {
    console.warn('White balance failed — continuing with tone only:', e);
  }

  const g = await predictGrade(img, corrected);

  return {
    aiParams: {
      brightness: g.brightness,
      contrast: g.contrast,
      saturation: g.saturation,
      lutId: null,
      lutStrengthDelta: 0,
    },
    wbLUT,
    isAI: g.isAI,
    modelUsed: wbLUT ? `${g.modelUsed} + Deep-WB` : g.modelUsed,
    confidence: g.confidence,
  };
}

export async function runPredictiveBranch(allBranchesHistory, slideIndex, baseImageData) {
  let img = baseImageData;
  const node = allBranchesHistory && slideIndex >= 0 ? allBranchesHistory[slideIndex] : null;
  if (node?.state?.baseImage) img = node.state.baseImage;
  if (!img) throw new Error('No image data available for AI analysis');
  dbg('[predictive] 1) runPredictiveBranch — source resolved', {
    fromHistoryNode: !!node?.state?.baseImage,
    slideIndex,
    branches: allBranchesHistory?.length,
  });
  const result = await infer(img);
  if (!result) throw new Error('Predictive grading produced no result');
  return result;
}
