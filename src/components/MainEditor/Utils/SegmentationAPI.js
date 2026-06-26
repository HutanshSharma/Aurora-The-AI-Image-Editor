import { authFetch } from '../../../utils/authFetch';
import { API_BASE } from '../../../utils/config';

const API_BASE_URL = `${API_BASE}/editing`;

const SEGMENT_MAX_DIM = 1500;

function imageToBlob(img, maxDimension = SEGMENT_MAX_DIM) {
  return new Promise((resolve, reject) => {
    let width = img.width;
    let height = img.height;
    const resized = width > maxDimension || height > maxDimension;
    if (resized) {
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

    const mime = resized ? 'image/jpeg' : 'image/png';
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve({ blob, width, height, resized, mime })
          : reject(new Error('Failed to encode image for segmentation')),
      mime,
      0.92,
    );
  });
}

export async function uploadAndSegment(image) {
  try {
    const { blob, width, height, resized, mime } = await imageToBlob(image);
    const formData = new FormData();
    formData.append('file', blob, mime === 'image/png' ? 'image.png' : 'image.jpg');

    const uploadResponse = await authFetch(`${API_BASE_URL}/upload_and_segment`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Server response:', errorText);
      throw new Error(`HTTP error! status: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();
    // Return the same blob we uploaded so the caller can keep the on-screen
    // image pixel-identical to what the backend segmented (coordinate sync).
    return { ...result, blob, compressedWidth: width, compressedHeight: height, resized };
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
