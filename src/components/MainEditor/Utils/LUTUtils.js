/**
 * @param {string} lutText 
 * @returns {Object}
 */
export function parseCubeLUT(lutText) {
  const lines = lutText.split('\n');
  let lutSize = 0;
  const lutData = [];
  
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#') || line.length === 0) continue;
    if (line.startsWith('LUT_3D_SIZE')) {
      lutSize = parseInt(line.split(/\s+/)[1]);
      continue;
    }
    if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      continue;
    }
    const values = line.split(/\s+/).filter(v => v.length > 0);
    if (values.length === 3) {
      const r = parseFloat(values[0]);
      const g = parseFloat(values[1]);
      const b = parseFloat(values[2]);
      
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        lutData.push([r, g, b]);
      }
    }
  }
  
  return { size: lutSize, data: lutData };
}

function getFlatLUT(lut) {
  if (lut._flat) return lut._flat;
  const d = lut.data;
  const flat = new Float32Array(d.length * 3);
  for (let i = 0; i < d.length; i++) {
    const t = d[i];
    flat[i * 3] = t[0];
    flat[i * 3 + 1] = t[1];
    flat[i * 3 + 2] = t[2];
  }
  lut._flat = flat;
  return flat;
}

/**
 * @param {ImageData} imageData
 * @param {Object} lut
 * @returns {ImageData}
 */
export function applyLUT(imageData, lut) {
  if (!lut || !lut.data || lut.data.length === 0) {
    return imageData;
  }

  const { data } = imageData;
  const N = lut.size;
  const maxIndex = N - 1;
  const N2 = N * N;
  const f = getFlatLUT(lut);

  for (let i = 0; i < data.length; i += 4) {
    const rs = (data[i] / 255) * maxIndex;
    const gs = (data[i + 1] / 255) * maxIndex;
    const bs = (data[i + 2] / 255) * maxIndex;

    const r0 = rs | 0, g0 = gs | 0, b0 = bs | 0;
    const r1 = r0 < maxIndex ? r0 + 1 : r0;
    const g1 = g0 < maxIndex ? g0 + 1 : g0;
    const b1 = b0 < maxIndex ? b0 + 1 : b0;
    const rf = rs - r0, gf = gs - g0, bf = bs - b0;

    const i000 = (r0 + g0 * N + b0 * N2) * 3;
    const i100 = (r1 + g0 * N + b0 * N2) * 3;
    const i010 = (r0 + g1 * N + b0 * N2) * 3;
    const i110 = (r1 + g1 * N + b0 * N2) * 3;
    const i001 = (r0 + g0 * N + b1 * N2) * 3;
    const i101 = (r1 + g0 * N + b1 * N2) * 3;
    const i011 = (r0 + g1 * N + b1 * N2) * 3;
    const i111 = (r1 + g1 * N + b1 * N2) * 3;

    for (let c = 0; c < 3; c++) {
      const c00 = f[i000 + c] * (1 - rf) + f[i100 + c] * rf;
      const c10 = f[i010 + c] * (1 - rf) + f[i110 + c] * rf;
      const c01 = f[i001 + c] * (1 - rf) + f[i101 + c] * rf;
      const c11 = f[i011 + c] * (1 - rf) + f[i111 + c] * rf;
      const c0 = c00 * (1 - gf) + c10 * gf;
      const c1 = c01 * (1 - gf) + c11 * gf;
      const v = (c0 * (1 - bf) + c1 * bf) * 255;
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return imageData;
}

/**
 * @param {string} lutPath
 * @returns {Promise<Object>} 
 */
export async function loadLUT(lutPath) {
  try {
    const response = await fetch(lutPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch LUT: ${response.status} ${response.statusText}`);
    }
    const lutText = await response.text();
    const parsedLUT = parseCubeLUT(lutText);
    return parsedLUT;
  } catch (error) {
    console.error('Error loading LUT:', error);
    return null;
  }
}

/**
 * @returns {Array}
 */
export function getAvailableLUTs() {
  return [
    { name: 'Warm Coffee', file: 'Arabica 12.CUBE' },
    { name: 'Clean Bright', file: 'Ava 614.CUBE' },
    { name: 'Moody Cyan', file: 'Azrael 93.CUBE' },
    { name: 'Amber Vintage', file: 'Bourbon 64.CUBE' },
    { name: 'Soft Pastel', file: 'Byers 11.CUBE' },
    { name: 'Grunge Cyan', file: 'Chemical 168.CUBE' },
    { name: 'Warm Cine', file: 'Clayton 33.CUBE' },
    { name: 'Pink Matte', file: 'Clouseau 54.CUBE' },
    { name: 'Teal Orange', file: 'Cobi 3.CUBE' },
    { name: 'Cool Sky', file: 'Contrail 35.CUBE' },
    { name: 'Fluorescent', file: 'Cubicle 99.CUBE' },
    { name: 'Western Warm', file: 'Django 25.CUBE' },
    { name: 'Tropical Warm', file: 'Domingo 145.CUBE' },
    { name: 'Soft Faded', file: 'Faded 47.CUBE' },
    { name: 'Brown Film', file: 'Folger 50.CUBE' },
    { name: 'Modern Cine', file: 'Fusion 88.CUBE' },
    { name: 'Green Film', file: 'Hyla 68.CUBE' },
    { name: 'Cyber Blue', file: 'Korben 214.CUBE' },
    { name: 'Clean Commercial', file: 'Lenox 340.CUBE' },
    { name: 'Warm Happy', file: 'Lucky 64.CUBE' },
    { name: 'Vlog Teal', file: 'McKinnon 75.CUBE' },
    { name: 'Muted Matte', file: 'Milo 5.CUBE' },
    { name: 'Neon Glow', file: 'Neon 770.CUBE' },
    { name: 'Heroic Cine', file: 'Paladin 1875.CUBE' },
    { name: 'Peach LA', file: 'Pasadena 21.CUBE' },
    { name: 'Pink Punch', file: 'Pitaya 15.CUBE' },
    { name: 'Neutral Film', file: 'Reeve 38.CUBE' },
    { name: 'Docu Green', file: 'Remy 24.CUBE' },
    { name: 'Analog Film', file: 'Sprocket 231.CUBE' },
    { name: 'Beauty Glow', file: 'Teigen 28.CUBE' },
    { name: 'Dark Matte', file: 'Trent 18.CUBE' },
    { name: 'Dusty Brown', file: 'Tweed 71.CUBE' },
    { name: 'Nature Green', file: 'Vireo 37.CUBE' },
    { name: 'Cool Blue', file: 'Zed 32.CUBE' },
    { name: 'Warm Punch', file: 'Zeke 39.CUBE' }
  ];
}

