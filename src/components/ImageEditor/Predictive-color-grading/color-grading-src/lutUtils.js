
const LUT_CACHE = {};


/**
 * Preload single LUT
 * @param {string} id 
 * @param {string} url 
 */
export async function preloadLut(id, url) {
  if (LUT_CACHE[id]) return LUT_CACHE[id];

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load LUT ${id} from ${url}`);
  }
  const text = await resp.text();
  const lut = parseCubeLut(text);
  LUT_CACHE[id] = lut;
  return lut;
}

/**
 * Preload multiple LUTs 
 * @param {{[id:string]: string}} lutMap 
 */
export async function preloadLuts(lutMap) {
  const entries = Object.entries(lutMap);
  for (const [id, url] of entries) {
    await preloadLut(id, url);
  }
}


export function hasLut(id) {
  return !!LUT_CACHE[id];
}

/**
 * @param {ImageData} imageData
 * @param {string} lutId
 * @param {number} strength 0..1
 * @returns {ImageData}
 */
export function applyLut(imageData, lutId, strength) {
  if (!lutId || strength <= 0) return imageData;
  const lut = LUT_CACHE[lutId];
  if (!lut) {
    return imageData;
  }

  const { size, data } = lut;
  const out = new ImageData(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;

  const N = size;


  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]     / 255;
    const g = src[i + 1] / 255;
    const b = src[i + 2] / 255;
    const a = src[i + 3];

    const lutColor = sampleLutRGB(data, N, r, g, b);

    const outR = (1 - strength) * r + strength * lutColor[0];
    const outG = (1 - strength) * g + strength * lutColor[1];
    const outB = (1 - strength) * b + strength * lutColor[2];

    dst[i]     = Math.round(outR * 255);
    dst[i + 1] = Math.round(outG * 255);
    dst[i + 2] = Math.round(outB * 255);
    dst[i + 3] = a;
  }

  return out;
}


function parseCubeLut(text) {
  const lines = text.split(/\r?\n/);
  let size = 0;
  const rgbLines = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);

    if (parts[0].toUpperCase() === "LUT_3D_SIZE") {
      size = parseInt(parts[1], 10);
      continue;
    }

  
    if (parts.length >= 3 && !isNaN(parseFloat(parts[0])) && !line.toUpperCase().startsWith("TITLE")) {
      rgbLines.push(parts);
    }
  }

  if (!size) {
    throw new Error("parseCubeLut: LUT_3D_SIZE not found");
  }

  const expected = size * size * size;
  if (rgbLines.length !== expected) {
    console.warn(
      `parseCubeLut: expected ${expected} entries for size=${size}, got=${rgbLines.length}`
    );
  }

  const data = new Float32Array(expected * 3);
  let idx = 0;
  for (const parts of rgbLines) {
    const r = parseFloat(parts[0]);
    const g = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    data[idx++] = r;
    data[idx++] = g;
    data[idx++] = b;
  }

  return { size, data };
}


function sampleLutRGB(data, size, r, g, b) {
  const N = size;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  r = clamp01(r);
  g = clamp01(g);
  b = clamp01(b);

  const x = r * (N - 1);
  const y = g * (N - 1);
  const z = b * (N - 1);

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);

  const x1 = Math.min(x0 + 1, N - 1);
  const y1 = Math.min(y0 + 1, N - 1);
  const z1 = Math.min(z0 + 1, N - 1);

  const dx = x - x0;
  const dy = y - y0;
  const dz = z - z0;

  const c000 = getLutColor(data, N, x0, y0, z0);
  const c100 = getLutColor(data, N, x1, y0, z0);
  const c010 = getLutColor(data, N, x0, y1, z0);
  const c110 = getLutColor(data, N, x1, y1, z0);
  const c001 = getLutColor(data, N, x0, y0, z1);
  const c101 = getLutColor(data, N, x1, y0, z1);
  const c011 = getLutColor(data, N, x0, y1, z1);
  const c111 = getLutColor(data, N, x1, y1, z1);

  const c00 = lerpColor(c000, c100, dx);
  const c10 = lerpColor(c010, c110, dx);
  const c01 = lerpColor(c001, c101, dx);
  const c11 = lerpColor(c011, c111, dx);

  const c0 = lerpColor(c00, c10, dy);
  const c1 = lerpColor(c01, c11, dy);

  const c = lerpColor(c0, c1, dz);
  return c;
}

function getLutColor(data, size, ix, iy, iz) {
  const idx = (iz * size * size + iy * size + ix) * 3;
  return [data[idx], data[idx + 1], data[idx + 2]];
}

function lerpColor(a, b, t) {
  const mt = 1 - t;
  return [
    mt * a[0] + t * b[0],
    mt * a[1] + t * b[1],
    mt * a[2] + t * b[2],
  ];
}
