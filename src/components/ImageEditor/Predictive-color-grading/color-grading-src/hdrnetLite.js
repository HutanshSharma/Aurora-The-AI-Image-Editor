
function clampByte(x) {
  return x < 0 ? 0 : x > 255 ? 255 : x;
}

function applyBrightness(imageData, value) {
  
  if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
    console.error('Invalid ImageData for brightness adjustment:', {
      hasData: !!imageData?.data,
      width: imageData?.width,
      height: imageData?.height
    });
    throw new Error(`Invalid ImageData: width=${imageData?.width}, height=${imageData?.height}`);
  }
  
  const out = new ImageData(imageData.width, imageData.height);
  const data = imageData.data;
  const outData = out.data;

  const delta = value * 255;

  for (let i = 0; i < data.length; i += 4) {
    outData[i]     = clampByte(data[i]     + delta);
    outData[i + 1] = clampByte(data[i + 1] + delta);
    outData[i + 2] = clampByte(data[i + 2] + delta);
    outData[i + 3] = data[i + 3];
  }
  return out;
}

function applyContrast(imageData, value) {
  
  if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
    console.error('Invalid ImageData for contrast adjustment:', {
      hasData: !!imageData?.data,
      width: imageData?.width,
      height: imageData?.height
    });
    throw new Error(`Invalid ImageData: width=${imageData?.width}, height=${imageData?.height}`);
  }
  
  const out = new ImageData(imageData.width, imageData.height);
  const data = imageData.data;
  const outData = out.data;

  const factor = 1 + value;

  for (let i = 0; i < data.length; i += 4) {
    outData[i]     = clampByte((data[i]     - 128) * factor + 128);
    outData[i + 1] = clampByte((data[i + 1] - 128) * factor + 128);
    outData[i + 2] = clampByte((data[i + 2] - 128) * factor + 128);
    outData[i + 3] = data[i + 3];
  }
  return out;
}


function applySCurveFloatArray(yArr, strength = 0.4) {
  const out = new Float32Array(yArr.length);
  const mid = 0.5;
  for (let i = 0; i < yArr.length; i++) {
    const v = Math.min(1, Math.max(0, yArr[i]));
    const x = v - mid;
    const xPrime = x + strength * x * x * x;
    let yPrime = mid + xPrime;
    if (yPrime < 0) yPrime = 0;
    if (yPrime > 1) yPrime = 1;
    out[i] = yPrime;
  }
  return out;
}


export function applyHdrnetLikeTone(lowresImageData, brightnessDelta, contrastDelta) {
  
  let img = applyBrightness(lowresImageData, brightnessDelta);
  img = applyContrast(img, contrastDelta);

  const data = img.data;
  const n = img.width * img.height;
  const yLin = new Float32Array(n);

  let p = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]     / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    yLin[p++] = y;
  }

  const yCurved = applySCurveFloatArray(yLin, 0.4);

  return { tonedImage: img, yCurved };
}
