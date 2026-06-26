import { authFetch } from '../../../utils/authFetch';
import { API_BASE } from '../../../utils/config';

const AI_MAX_DIM = 1024;

function imageToBlob(img, maxDimension = AI_MAX_DIM) {
  return new Promise((resolve, reject) => {
    let width = img.width;
    let height = img.height;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/png',
    );
  });
}

export async function qwenSmartEdit(image, prompt) {
  const blob = await imageToBlob(image);
  const formData = new FormData();
  formData.append('file', blob, 'image.png');
  formData.append('prompt', prompt);

  const res = await authFetch(`${API_BASE}/inpainting/qwen/smart-edit`, {
    method: 'POST',
    body: formData,
  });

  if (res.status === 503) {
    return { success: false, available: false };
  }
  if (!res.ok) {
    throw new Error(`AI edit request failed: ${res.status}`);
  }
  return res.json();
}
