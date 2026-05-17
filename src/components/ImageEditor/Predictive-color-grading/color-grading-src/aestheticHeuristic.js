function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function scoreTonedImage(tonedImage, yCurved) {
  const data = tonedImage.data;
  const n = tonedImage.width * tonedImage.height;

  // luminance stats
  let meanC = 0;
  for (let i = 0; i < n; i++) meanC += yCurved[i];
  meanC /= n;

  let varC = 0;
  for (let i = 0; i < n; i++) {
    const diff = yCurved[i] - meanC;
    varC += diff * diff;
  }
  const stdC = Math.sqrt(varC / n);

  
  let meanSat = 0;
  let clipSh = 0;
  let clipHi = 0;

  let p = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]     / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const grey = (r + g + b) / 3;
    const sr = Math.abs(r - grey);
    const sg = Math.abs(g - grey);
    const sb = Math.abs(b - grey);
    const sat = (sr + sg + sb) / 3;
    meanSat += sat;

    const v = yCurved[p++];
    if (v < 0.02) clipSh++;
    if (v > 0.98) clipHi++;
  }

  meanSat /= n;
  clipSh /= n;
  clipHi /= n;

  const scoreMid       = 1 - clamp01(Math.abs(meanC - 0.5) * 2);
  const scoreContrast  = 1 - clamp01(Math.abs(stdC - 0.25) * 4);
  const scoreSatCenter = 1 - clamp01(Math.abs(meanSat - 0.25) * 4);
  const satPenalty     = Math.max(0, meanSat - 0.4) * 4;
  const clipPenalty    = (clipSh + clipHi) * 5;

  let score = 0;
  score += 2.0 * scoreMid;
  score += 1.5 * scoreContrast;
  score += 0.5 * scoreSatCenter;
  score -= satPenalty;
  score -= clipPenalty;

  return score;
}
