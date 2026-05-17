import { API_CONFIG } from './config';

class InpaintingAPIService {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.endpoints = API_CONFIG.ENDPOINTS;
    this.requestTimeout = API_CONFIG.REQUEST_TIMEOUT;
    this.pollingInterval = API_CONFIG.POLLING_INTERVAL;
    this.taskTimeout = API_CONFIG.TASK_TIMEOUT;
  }

  async dataURLtoFile(dataURL, filename) {
    const response = await fetch(dataURL);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  canvasToBase64(canvas) {
    return canvas.toDataURL().split(',')[1];
  }

  async processTextEdit(imageCanvas, textInstruction, segments = null) {
    try {
      const imageBase64 = this.canvasToBase64(imageCanvas);
      
      const response = await fetch(`${this.baseURL}/inpainting/text-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          text_instruction: textInstruction,
          segments: segments,
          preserve_original: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Text edit processing failed:', error);
      throw error;
    }
  }

  async applyAIEdit(imageCanvas, instructions, segments = null) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'edit_image.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('instructions', JSON.stringify(instructions));
      formData.append('segments', JSON.stringify(segments || []));

      const response = await fetch(`${this.baseURL}/inpainting/apply-edits`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result; 
    } catch (error) {
      console.error('Apply edits failed:', error);
      throw error;
    }
  }

  async getTaskStatus(taskId) {
    try {
      const response = await fetch(`${this.baseURL}/inpainting/status/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Task status check failed:', error);
      throw error;
    }
  }

  async pollTaskCompletion(taskId, onProgress = null) {
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const status = await this.getTaskStatus(taskId);
          
          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            resolve(status);
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            reject(new Error(status.error || 'Task failed'));
          } else if (status.status === 'cancelled') {
            clearInterval(pollInterval);
            reject(new Error('Task was cancelled'));
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, this.pollingInterval);

      setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('Task timeout'));
      }, this.taskTimeout);
    });
  }

  async qwenSmartEdit(imageCanvas, prompt) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'smart_edit.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('prompt', prompt);

      const response = await fetch(`${this.baseURL}/inpainting/qwen/smart-edit`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Qwen smart edit failed:', error);
      throw error;
    }
  }

  async qwenWhiteToScene(imageCanvas, prompt) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'scene_edit.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('prompt', prompt);

      const response = await fetch(`${this.baseURL}/inpainting/qwen/white-to-scene`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Qwen white-to-scene failed:', error);
      throw error;
    }
  }

  async qwenFusion(imageCanvas, prompt) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'fusion_edit.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('prompt', prompt);

      const response = await fetch(`${this.baseURL}/inpainting/qwen/fusion`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Qwen fusion failed:', error);
      throw error;
    }
  }

  async qwenRelight(imageCanvas, prompt) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'relight_edit.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('prompt', prompt);

      const response = await fetch(`${this.baseURL}/inpainting/qwen/relight`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Qwen relight failed:', error);
      throw error;
    }
  }

  async getEditingPresets() {
    try {
      const response = await fetch(`${this.baseURL}/inpainting/presets`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get presets:', error);
      throw error;
    }
  }

  async segmentImage(imageCanvas, pointPrompts = null, boxPrompts = null) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'segment_image.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      
      if (pointPrompts) {
        formData.append('point_prompts', JSON.stringify(pointPrompts));
      }
      if (boxPrompts) {
        formData.append('box_prompts', JSON.stringify(boxPrompts));
      }

      const response = await fetch(`${this.baseURL}/inpainting/segment`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Image segmentation failed:', error);
      throw error;
    }
  }

  async analyzeScene(imageCanvas, segments) {
    try {
      const imageFile = await this.dataURLtoFile(imageCanvas.toDataURL(), 'analyze_scene.png');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('segments', JSON.stringify(segments));

      const response = await fetch(`${this.baseURL}/inpainting/analyze-scene`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Scene analysis failed:', error);
      throw error;
    }
  }
}

export const inpaintingAPI = new InpaintingAPIService();
export default InpaintingAPIService;