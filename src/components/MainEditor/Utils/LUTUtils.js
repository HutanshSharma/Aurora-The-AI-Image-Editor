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

/**
 * @param {ImageData} imageData 
 * @param {Object} lut
 * @returns {ImageData}
 */
export function applyLUT(imageData, lut) {
  if (!lut || !lut.data || lut.data.length === 0) {
    return imageData;
  }
    
  const { data, width, height } = imageData;
  const lutSize = lut.size;
  const lutData = lut.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const newColor = trilinearInterpolation(r, g, b, lutSize, lutData);
    
    data[i] = Math.min(255, Math.max(0, newColor[0] * 255));
    data[i + 1] = Math.min(255, Math.max(0, newColor[1] * 255));
    data[i + 2] = Math.min(255, Math.max(0, newColor[2] * 255));
  }  
  return imageData;
}

/**
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @param {number} lutSize 
 * @param {Array} lutData
 * @returns {Array}
 */
function trilinearInterpolation(r, g, b, lutSize, lutData) {
  const maxIndex = lutSize - 1;  
  const rScaled = r * maxIndex;
  const gScaled = g * maxIndex;
  const bScaled = b * maxIndex;  
  const r0 = Math.floor(rScaled);
  const g0 = Math.floor(gScaled);
  const b0 = Math.floor(bScaled);
  
  const r1 = Math.min(r0 + 1, maxIndex);
  const g1 = Math.min(g0 + 1, maxIndex);
  const b1 = Math.min(b0 + 1, maxIndex);
  
  const rFrac = rScaled - r0;
  const gFrac = gScaled - g0;
  const bFrac = bScaled - b0;
  
  const c000 = getLUTValue(r0, g0, b0, lutSize, lutData);
  const c001 = getLUTValue(r0, g0, b1, lutSize, lutData);
  const c010 = getLUTValue(r0, g1, b0, lutSize, lutData);
  const c011 = getLUTValue(r0, g1, b1, lutSize, lutData);
  const c100 = getLUTValue(r1, g0, b0, lutSize, lutData);
  const c101 = getLUTValue(r1, g0, b1, lutSize, lutData);
  const c110 = getLUTValue(r1, g1, b0, lutSize, lutData);
  const c111 = getLUTValue(r1, g1, b1, lutSize, lutData);
  
  const c00 = lerp3D(c000, c001, bFrac);
  const c01 = lerp3D(c010, c011, bFrac);
  const c10 = lerp3D(c100, c101, bFrac);
  const c11 = lerp3D(c110, c111, bFrac);
  
  const c0 = lerp3D(c00, c01, gFrac);
  const c1 = lerp3D(c10, c11, gFrac);
  
  return lerp3D(c0, c1, rFrac);
}

function getLUTValue(r, g, b, lutSize, lutData) {
  const index = r + g * lutSize + b * lutSize * lutSize;
  if (index < 0 || index >= lutData.length) {
    return [r / (lutSize - 1), g / (lutSize - 1), b / (lutSize - 1)];
  }
  return lutData[index];
}

function lerp3D(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
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

