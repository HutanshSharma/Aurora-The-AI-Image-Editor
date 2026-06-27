function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function channelStats(data, onlyOpaque) {
  let n = 0;
  const sum = [0, 0, 0];
  const sumSq = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    if (onlyOpaque && data[i + 3] < 8) continue;
    n++;
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      sum[c] += v;
      sumSq[c] += v * v;
    }
  }
  if (n === 0) return null;
  const mean = sum.map((s) => s / n);
  const std = sumSq.map((sq, c) => Math.sqrt(Math.max(1, sq / n - mean[c] * mean[c])));
  return { mean, std, n };
}

function applyTransfer(segData, refStats, strength) {
  const seg = channelStats(segData.data, true);
  if (!seg) return;
  const d = segData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    for (let c = 0; c < 3; c++) {
      const inV = d[i + c];
      const ratio = clamp(refStats.std[c] / seg.std[c], 0.6, 1.6);
      const transferred = (inV - seg.mean[c]) * ratio + refStats.mean[c];
      const out = inV * (1 - strength) + transferred * strength;
      d[i + c] = out < 0 ? 0 : out > 255 ? 255 : out;
    }
  }
}

function erodeMask(mask, px) {
  const ctx = mask.getContext('2d');
  const orig = mk(mask.width, mask.height);
  orig.getContext('2d').drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  for (const [dx, dy] of [[px, 0], [-px, 0], [0, px], [0, -px]]) ctx.drawImage(orig, dx, dy);
  ctx.globalCompositeOperation = 'source-over';
}

function colorBleed(seg, r) {
  const ctx = seg.getContext('2d');
  for (let i = 0; i < r; i++) {
    const tmp = mk(seg.width, seg.height);
    tmp.getContext('2d').drawImage(seg, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(tmp, dx, dy);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function cleanEdge(seg, feather, shrink, bleed) {
  const W = seg.width;
  const H = seg.height;
  const sctx = seg.getContext('2d');

  const mask = mk(W, H);
  const mctx = mask.getContext('2d');
  mctx.drawImage(seg, 0, 0);
  mctx.globalCompositeOperation = 'source-in';
  mctx.fillStyle = '#fff';
  mctx.fillRect(0, 0, W, H);
  mctx.globalCompositeOperation = 'source-over';

  if (shrink > 0) erodeMask(mask, shrink);
  if (feather > 0) {
    const fb = mk(W, H);
    const fctx = fb.getContext('2d');
    fctx.filter = `blur(${feather}px)`;
    fctx.drawImage(mask, 0, 0);
    mctx.clearRect(0, 0, W, H);
    mctx.filter = 'none';
    mctx.drawImage(fb, 0, 0);
  }

  if (bleed > 0) colorBleed(seg, bleed);

  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(mask, 0, 0);
  sctx.globalCompositeOperation = 'source-over';
}

function autoEdge(minDim) {
  return {
    feather: clamp(minDim * 0.0012, 0.75, 1.5),
    shrink: clamp(Math.round(minDim * 0.0015), 1, 2),
    bleed: clamp(Math.round(minDim * 0.004), 2, 6),
  };
}

function alphaBBox(data, W, H) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

export function blendSegment(image, opts = {}) {
  const W = image.naturalWidth || image.width;
  const H = image.naturalHeight || image.height;
  const { feather, shrink, bleed } = { ...autoEdge(Math.min(W, H)), ...opts };
  const { bgImage = null, harmonizeStrength = 0 } = opts;

  const seg = mk(W, H);
  const sctx = seg.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(image, 0, 0);

  if (bgImage && harmonizeStrength > 0) {
    const bgC = mk(64, 64);
    const bctx = bgC.getContext('2d', { willReadFrequently: true });
    bctx.drawImage(bgImage, 0, 0, 64, 64);
    const ref = channelStats(bctx.getImageData(0, 0, 64, 64).data, false);
    if (ref) {
      const segData = sctx.getImageData(0, 0, W, H);
      applyTransfer(segData, ref, harmonizeStrength);
      sctx.putImageData(segData, 0, 0);
    }
  }

  cleanEdge(seg, feather, shrink, bleed);
  return seg;
}

export function blendSegmentIntoImage(segImage, mainImage, outW, outH, opts = {}) {
  const W = outW;
  const H = outH;
  const { feather, shrink, bleed } = autoEdge(Math.min(W, H));
  const strength = opts.strength ?? 0.3;

  const seg = mk(W, H);
  const sctx = seg.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(segImage, 0, 0, W, H);

  if (strength > 0) {
    const main = mk(W, H);
    const mc = main.getContext('2d', { willReadFrequently: true });
    mc.drawImage(mainImage, 0, 0, W, H);
    const mainData = mc.getImageData(0, 0, W, H).data;
    const segData = sctx.getImageData(0, 0, W, H);
    const box = alphaBBox(segData.data, W, H);

    if (box) {
      const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
      const pad = Math.round(span * 0.5) + 8;
      const x0 = Math.max(0, box.minX - pad);
      const x1 = Math.min(W - 1, box.maxX + pad);
      const y0 = Math.max(0, box.minY - pad);
      const y1 = Math.min(H - 1, box.maxY + pad);
      let n = 0;
      const sum = [0, 0, 0];
      const sumSq = [0, 0, 0];
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * W + x) * 4;
          if (segData.data[i + 3] > 16) continue;
          n++;
          for (let c = 0; c < 3; c++) {
            const v = mainData[i + c];
            sum[c] += v;
            sumSq[c] += v * v;
          }
        }
      }
      if (n >= 50) {
        const mean = sum.map((s) => s / n);
        const std = sumSq.map((sq, c) => Math.sqrt(Math.max(1, sq / n - mean[c] * mean[c])));
        applyTransfer(segData, { mean, std }, strength);
        sctx.putImageData(segData, 0, 0);
      }
    }
  }

  cleanEdge(seg, feather, shrink, bleed);
  return seg;
}
