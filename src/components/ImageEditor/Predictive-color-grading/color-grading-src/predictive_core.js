import * as ort from 'onnxruntime-web';
import { applyHdrnetLikeTone } from "./hdrnetLite";
import { scoreTonedImage } from "./aestheticHeuristic";
import { applyLut } from "./lutUtils";


ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false;
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': '/wasm/ort-wasm.wasm',
  'ort-wasm-threaded.wasm': '/wasm/ort-wasm-threaded.wasm',
  'ort-wasm-simd.wasm': '/wasm/ort-wasm-simd.wasm'
};

class NeuropLiteAI {
  constructor() {
    this.session = null;
    this.isLoading = false;
    this.weights = {
      brightness: [0.299, 0.587, 0.114],
      contrast: [1.2, 1.1, 1.0], 
      saturation: [1.1, 1.05, 0.95],
      enhancement: [1.15, 1.08, 1.02] 
    };
  }

  async loadModel() {
    if (this.session) return this.session;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.session;
    }

    this.isLoading = true;
    try {
      const modelPaths = [
        '/models/neurop_lite.onnx',
        '/public/models/neurop_lite.onnx',
        './public/models/neurop_lite.onnx'
      ];
      
      let modelData = null;
      for (const path of modelPaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            modelData = await response.arrayBuffer();
            break;
          }
        } catch (error) {
          console.log(`Failed to load from ${path}:`, error.message);
        }
      }
      
      if (!modelData) {
        throw new Error('Could not load ONNX model from any path');
      }

      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'disabled',
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'sequential'
      });     
    } catch (error) {
      console.error('Failed to load ONNX model:', error);
      this.session = null;
    } finally {
      this.isLoading = false;
    }
    
    return this.session;
  }

  async processImage(imageData) {
    await this.loadModel();
    
    let data, width, height;
    if (Array.isArray(imageData)) {
      const validImages = imageData.filter(img => 
        img && img.data && img.width && img.height && img.width > 0 && img.height > 0
      );
      
      if (validImages.length === 0) {
        throw new Error('No valid image data found in array');
      }      
      const selectedImage = validImages.reduce((largest, current) => 
        (current.width * current.height) > (largest.width * largest.height) ? current : largest
      );
      
      data = selectedImage.data;
      width = selectedImage.width;
      height = selectedImage.height;
      
    } else if (imageData instanceof ImageData) {
      data = imageData.data;
      width = imageData.width;
      height = imageData.height;
      
    } else if (imageData && imageData.data && imageData.width && imageData.height) {
      data = imageData.data;
      width = imageData.width;
      height = imageData.height;
      
    } else {
      console.error('Invalid imageData format:', imageData);
      throw new Error('Invalid image data format - expected ImageData, array of ImageData, or object with data/width/height');
    }
    
    if (!data || !data.length || width <= 0 || height <= 0) {
      throw new Error(`Invalid image dimensions: ${width}x${height} or empty data`);
    }
        
    const totalPixels = width * height;    
    let avgR = 0, avgG = 0, avgB = 0;
    let minR = 255, minG = 255, minB = 255;
    let maxR = 0, maxG = 0, maxB = 0;    
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      avgR += r; avgG += g; avgB += b;
      
      minR = Math.min(minR, r); minG = Math.min(minG, g); minB = Math.min(minB, b);
      maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
    }
    
    avgR /= totalPixels; avgG /= totalPixels; avgB /= totalPixels;    
    const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114) / 255;
    const contrast = ((maxR - minR) + (maxG - minG) + (maxB - minB)) / (3 * 255);
    const saturation = this.calculateSaturation(avgR, avgG, avgB);
    
    if (this.session) {
      try {
        const inputName = this.session.inputNames[0];
        let tensor;
        let inputData;
        
        try {
          if (width >= 256 && height >= 256) {
            const resized = this.resizeImageData(data, width, height, 256, 256);
            inputData = new Float32Array(256 * 256 * 3);
            for (let i = 0; i < 256 * 256; i++) {
              const pixelIndex = i * 4;
              const outputIndex = i * 3;
              inputData[outputIndex] = resized[pixelIndex] / 255.0;   
              inputData[outputIndex + 1] = resized[pixelIndex + 1] / 255.0; 
              inputData[outputIndex + 2] = resized[pixelIndex + 2] / 255.0; 
            }

            const C = 3, H = 256, W = 256;
            const hw = H * W;
            const nchwData = new Float32Array(C * H * W);

            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                const hwcIndex = (y * W + x) * 3;
                const baseIndex = y * W + x;
                nchwData[0 * hw + baseIndex] = inputData[hwcIndex];
                nchwData[1 * hw + baseIndex] = inputData[hwcIndex + 1];
                nchwData[2 * hw + baseIndex] = inputData[hwcIndex + 2]; 
              }
            }
            
            tensor = new ort.Tensor('float32', nchwData, [1, 3, 256, 256]);
          } else {
            throw new Error('Image too small for CNN input (need at least 256x256)');
          }
        } catch (error) {
          inputData = new Float32Array([
            brightness,
            contrast, 
            saturation,
            avgR / 255,
            avgG / 255,
            avgB / 255
          ]);
          const shapes = [[1, 6], [1, 1, 6], [6], [1, 3, 2]];
          for (const shape of shapes) {
            try {
              tensor = new ort.Tensor('float32', inputData, shape);
              break;
            } catch (shapeError) {
              continue;
            }
          }
          
          if (!tensor) {
            throw new Error('Could not create valid input tensor');
          }
        }
        
        const feeds = { [inputName]: tensor };
        const results = await this.session.run(feeds);
        const primaryOutput = results[this.session.outputNames[0]];
        
        const outputData = primaryOutput.data;
        const outputSize = outputData.length;
        
        let brightnessDelta, contrastDelta, saturationDelta, lutStrength;
        
        if (outputSize >= 4) {
          brightnessDelta = Math.max(-50, Math.min(50, (outputData[0] - 0.5) * 100));
          contrastDelta = Math.max(-50, Math.min(50, (outputData[1] - 0.5) * 80));
          saturationDelta = Math.max(-30, Math.min(30, (outputData[2] - 0.5) * 60));
          lutStrength = outputSize >= 4 ? Math.round(outputData[3] * 100) : 80;
        } else if (outputSize === 3) {
          brightnessDelta = Math.max(-50, Math.min(50, (outputData[0] - 0.5) * 100));
          contrastDelta = Math.max(-50, Math.min(50, (outputData[1] - 0.5) * 80));
          saturationDelta = Math.max(-30, Math.min(30, (outputData[2] - 0.5) * 60));
          lutStrength = 80;
        } else {
          brightnessDelta = (outputData[0] - 0.5) * 100;
          contrastDelta = 0;
          saturationDelta = 0;
          lutStrength = 80;
        }
        
        
        return {
          brightness: Math.round(50 + brightnessDelta), 
          contrast: Math.round(contrastDelta),
          saturation: Math.round(saturationDelta),
          lutStrengthDelta: Math.round(lutStrength - 80), 
          lutId: this.selectOptimalLutFromAI(outputData.length >= 6 ? 
            Array.from(outputData.slice(0, 6)) : 
            [outputData[0] || 0.5, outputData[1] || 0.5, outputData[2] || 0.5, 0.5, 0.7, 0.6]
          ),
          confidence: 0.95, 
          model: 'ONNX Neural Network (Image Enhancement)',
          isAI: true,
          enhancedImageData: this.decodeNeurOPOutput(primaryOutput) 
        };
        
      } catch (error) {
        console.error('ONNX model inference failed:', error);
      }
    }
    const input = [brightness, contrast, saturation];
    const hidden = this.activateLayer(input, this.weights.enhancement);
    const output = this.activateLayer(hidden, [1.0, 0.8, 0.6]);
    
    const brightnessDelta = Math.max(-50, Math.min(50, (output[0] - 0.5) * 100));
    const contrastDelta = Math.max(-50, Math.min(50, (output[1] - 0.5) * 80));
    const saturationDelta = Math.max(-30, Math.min(30, (output[2] - 0.5) * 60));
        
    return {
      brightness: Math.round(50 + brightnessDelta), 
      contrast: Math.round(contrastDelta),
      saturation: Math.round(saturationDelta),
      lutStrengthDelta: Math.round((output[0] + output[1] + output[2]) * 10 - 15),
      lutId: this.selectOptimalLut(output),
      confidence: Math.min(0.95, Math.max(0.6, (output[0] + output[1] + output[2]) / 3)),
      model: 'Fallback Heuristic',
      isAI: false
    };
  }
  
  calculateSaturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  }
  
  activateLayer(input, weights) {
    return input.map((val, i) => {
      const weighted = val * (weights[i] || 1.0);
      return 1 / (1 + Math.exp(-weighted)); 
    });
  }
  
  selectOptimalLut(output) {
    const score = output[0] + output[1] * 0.8 + output[2] * 0.6;
    
    if (score > 0.7) return 'Paladin 1875.CUBE';
    if (score > 0.6) return 'Korben 214.CUBE';  
    if (score > 0.4) return 'Django 25.CUBE';  
    if (score > 0.3) return 'Bourbon 64.CUBE'; 
    return 'Ava 614.CUBE'; 
  }

  selectOptimalLutFromAI(output) {
    const lutIndex = Math.floor((output[5] || 0.5) * 34);
    
    const luts = [
      'Arabica 12.CUBE', 'Ava 614.CUBE', 'Azrael 93.CUBE', 'Bourbon 64.CUBE',
      'Byers 11.CUBE', 'Chemical 168.CUBE', 'Clayton 33.CUBE', 'Clouseau 54.CUBE',
      'Cobi 3.CUBE', 'Contrail 35.CUBE', 'Cubicle 99.CUBE', 'Django 25.CUBE',
      'Domingo 145.CUBE', 'Faded 47.CUBE', 'Folger 50.CUBE', 'Fusion 88.CUBE',
      'Hyla 68.CUBE', 'Korben 214.CUBE', 'Lenox 340.CUBE', 'Lucky 64.CUBE',
      'McKinnon 75.CUBE', 'Milo 5.CUBE', 'Neon 770.CUBE', 'Paladin 1875.CUBE',
      'Pasadena 21.CUBE', 'Pitaya 15.CUBE', 'Reeve 38.CUBE', 'Remy 24.CUBE',
      'Sprocket 231.CUBE', 'Teigen 28.CUBE', 'Trent 18.CUBE', 'Tweed 71.CUBE',
      'Vireo 37.CUBE', 'Zed 32.CUBE'
    ];
    
    return luts[Math.min(lutIndex, luts.length - 1)];
  }

  resizeImageData(sourceData, sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const resized = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const sourceX = Math.floor((x / targetWidth) * sourceWidth);
        const sourceY = Math.floor((y / targetHeight) * sourceHeight);
        
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
        const targetIndex = (y * targetWidth + x) * 4;
        
        resized[targetIndex] = sourceData[sourceIndex];
        resized[targetIndex + 1] = sourceData[sourceIndex + 1];
        resized[targetIndex + 2] = sourceData[sourceIndex + 2]; 
        resized[targetIndex + 3] = sourceData[sourceIndex + 3];
      }
    }
    
    return resized;
  }

  decodeNeurOPOutput(outputTensor) {
    const dims = outputTensor.dims; 
    const data = outputTensor.data;
    const [N, C, H, W] = dims;
    const hw = H * W;
    const out = new Uint8ClampedArray(H * W * 4);

    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = y * W + x;

        let r = data[0 * hw + base];
        let g = data[1 * hw + base];
        let b = data[2 * hw + base];
        if (r < minVal) minVal = r;
        if (g < minVal) minVal = g;
        if (b < minVal) minVal = b;
        if (r > maxVal) maxVal = r;
        if (g > maxVal) maxVal = g;
        if (b > maxVal) maxVal = b;
        r = r < 0 ? 0 : r > 1 ? 1 : r;
        g = g < 0 ? 0 : g > 1 ? 1 : g;
        b = b < 0 ? 0 : b > 1 ? 1 : b;

        const dstIdx = base * 4;
        out[dstIdx] = Math.round(r * 255);
        out[dstIdx + 1] = Math.round(g * 255);
        out[dstIdx + 2] = Math.round(b * 255);
        out[dstIdx + 3] = 255; 
      }
    }
    return new ImageData(out, W, H);
  }
}

let neuropLiteAI = null;

async function getNeuropSession() {
  if (!neuropLiteAI) {
    neuropLiteAI = new NeuropLiteAI();
  }
  return neuropLiteAI;
}

async function runNeuropOnnx(fullResImageData) {
  try {
    const neuralNet = await getNeuropSession();
    const result = await neuralNet.processImage(fullResImageData);
    
    if (!result) {
      throw new Error('Neural network returned null result');
    }
    
    return {
      brightness: result.brightness,
      contrast: result.contrast,
      saturation: result.saturation,
      lutStrengthDelta: result.lutStrengthDelta,
      lutId: result.lutId,
      modelUsed: result.model || 'NeuropLiteAI',
      confidence: result.confidence,
      isAI: result.isAI
    };
    
  } catch (error) {
    console.error("NeurOP ONNX processing failed:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return {
      brightness: 50,
      contrast: 5,
      saturation: 10,
      lutStrengthDelta: 0,
      lutId: 'Paladin 1875.CUBE',
      modelUsed: 'Fallback (Error Recovery)',
      confidence: 0.3,
      isAI: false
    };
  }
}

export function makeEdit(type, params, ai_improvable = true) {
  return { type, params, ai_improvable };
}

async function infer(fullResImageData, targetBrightnessPercent = 0.8, targetContrastPercent = 1.0) {
  try {
    let validImageData;
    if (Array.isArray(fullResImageData)) {
      const validImage = fullResImageData.find(img => 
        img && img.data && img.width > 0 && img.height > 0
      );
      if (!validImage) {
        throw new Error('No valid ImageData found in input array');
      }
      validImageData = validImage;
    } else if (fullResImageData instanceof ImageData) {
      validImageData = fullResImageData;
    } else if (fullResImageData && fullResImageData.data && fullResImageData.width && fullResImageData.height) {
      validImageData = fullResImageData;
    } else {
      throw new Error('Invalid image data format for inference');
    }
        
    const neuralNetResult = await runNeuropOnnx(validImageData);
    if (!neuralNetResult) {
      throw new Error("Neural network failed completely");
    }

    const brightness = neuralNetResult.brightness;
    const contrast = neuralNetResult.contrast; 
    const saturation = neuralNetResult.saturation;
    const lutId = neuralNetResult.lutId;
    
    const targetLightness = targetBrightnessPercent;
    const targetContrast = targetContrastPercent;
    const hdrnetResult = await applyHdrnetLikeTone(validImageData, targetLightness, targetContrast);
    
    if (!hdrnetResult || !hdrnetResult.tonedImage) {
      throw new Error('HDRNet processing failed - no toned image data');
    }
    const score = await scoreTonedImage(hdrnetResult.tonedImage, hdrnetResult.yCurved || []);
    const lutAppliedResult = await applyLut(hdrnetResult.tonedImage, lutId, 0.8);
    
    return {
      type: "ai_enhance",
      
      aiParams: {
        brightness: brightness,
        contrast: contrast,
        saturation: saturation,
        lutId: lutId,
        lutStrength: 80,
        confidence: neuralNetResult.confidence,
        modelUsed: neuralNetResult.modelUsed,
        isAI: neuralNetResult.isAI
      },
      
      outputImageData: lutAppliedResult.outputImageData,
      hdrnetToneMapParams: hdrnetResult.params || {},
      hdrnetScore: score,
      appliedLutId: lutId
    };

  } catch (error) {
    console.error("Predictive core inference failed:", error);
    return null;
  }
}

export { infer, runPredictiveBranch };

async function runPredictiveBranch(allBranchesHistory, slideIndex, baseImageData) {
  try {
    let fullResImageData = baseImageData;
    if (allBranchesHistory && slideIndex >= 0 && allBranchesHistory[slideIndex]) {
      const currentState = allBranchesHistory[slideIndex];
      if (currentState.state && currentState.state.baseImage) {
        fullResImageData = currentState.state.baseImage;
      }
    }
    
    if (!fullResImageData) {
      throw new Error('No image data available for AI analysis');
    }
    return await infer(fullResImageData, 0.8, 1.0);
    
  } catch (error) {
    console.error('runPredictiveBranch failed:', error);
    throw error;
  }
}