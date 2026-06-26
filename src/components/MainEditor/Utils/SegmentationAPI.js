import { authFetch } from '../../../utils/authFetch';
import { API_BASE } from '../../../utils/config';

const API_BASE_URL = `${API_BASE}/editing`;

async function compressImage(imageBase64, maxDimension = 1500) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;      
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);      
      const format = (img.width > maxDimension || img.height > maxDimension) ? 'image/jpeg' : 'image/png';
      const quality = 0.9;
      const compressedBase64 = canvas.toDataURL(format, quality);
      
      resolve({
        dataUrl: compressedBase64,
        width: width,
        height: height
      });
    };
    img.src = imageBase64;
  });
}

export async function uploadAndSegment(imageBase64) {
  try {
    const compressed = await compressImage(imageBase64, 1500);
    
    const response = await fetch(compressed.dataUrl);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('file', blob, 'image.png');
    
    const uploadResponse = await authFetch(`${API_BASE_URL}/upload_and_segment`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Server response:', errorText);
      throw new Error(`HTTP error! status: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();    
    return {
      ...result,
      compressedImage: compressed.dataUrl,
      compressedWidth: compressed.width,
      compressedHeight: compressed.height
    };
  } catch (error) {
    console.error('Error uploading and segmenting:', error);
    throw error;
  }
}

export async function getSegmentAtPoint(imageId, x, y) {
  try {
    const response = await authFetch(`${API_BASE_URL}/get_segment_at_point`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_id: imageId,
        x: Math.round(x),
        y: Math.round(y)
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting segment at point:', error);
    throw error;
  }
}

export async function extractSegment(imageId, segmentIndex) {
  try {
    const response = await authFetch(`${API_BASE_URL}/extract_segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_id: imageId,
        segment_index: segmentIndex
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error extracting segment:', error);
    throw error;
  }
}

export function imageToBase64(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}
