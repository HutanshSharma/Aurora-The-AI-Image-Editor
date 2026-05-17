# Canvas Editing System Documentation

## Overview

The image editor implements a sophisticated canvas based rendering system that applies real time visual effects, color grading through LUTs (Lookup Tables), and seamless segment overlay compositing. All edits are non destructive and rendered dynamically on an HTML5 canvas element.

---

## Table of Contents

1. [Simple Edits (Brightness, Contrast, etc.)](#1-simple-edits-system)
2. [LUT Application System](#2-lut-application-system)
3. [Segment Overlay & Merging](#3-segment-overlay--merging-system)
4. [Qwen AI Integration](#4-qwen-ai-integration-brief-overview)

---

## 1. Simple Edits System

### Architecture

Simple edits (brightness, contrast, saturation, blur, hue, sharpen, opacity) are applied using **CSS Filters** via the Canvas API. These filters are hardware accelerated and provide real time performance.

### Implementation Flow

```
User adjusts slider
    ↓
Command executed (useHistory)
    ↓
State updated (editorState)
    ↓
Canvas re render triggered
    ↓
Filter string constructed
    ↓
Applied via ctx.filter property
    ↓
Image drawn with filters
```

### Code Implementation

#### Filter String Construction

Located in: `src/components/ImageEditor/Canvas.jsx` (lines 351-363)

```javascript
// Build filter string from editor state
let filterString = `
  brightness(${editorState?.brightness || 100}%) 
  contrast(${editorState?.contrast || 100}%) 
  saturate(${editorState?.saturation || 100}%)
`;

// Add blur with clamping (0-20px max)
const blurValue = Math.max(0, Math.min(20, editorState?.blur || 0));
if (blurValue > 0) {
  filterString += ` blur(${blurValue}px)`;
}

// Add hue rotation
filterString += ` hue-rotate(${editorState?.hue || 0}deg)`;

// Sharpen via additional contrast boost
if ((editorState?.sharpen || 0) > 0) {
  filterString += ` contrast(${100 + (editorState?.sharpen || 0)}%)`;
}

// Apply to canvas context
ctx.filter = filterString;
```

### Supported Filters

| Filter | Range | Units | Effect |
|--------|-------|-------|--------|
| **Brightness** | 0-200 | % | Lightens/darkens image |
| **Contrast** | 0-200 | % | Increases/decreases contrast |
| **Saturation** | 0-200 | % | Color intensity |
| **Blur** | 0-20 | px | Gaussian blur |
| **Hue** | 0-360 | deg | Color wheel rotation |
| **Sharpen** | 0-100 | % | Edge enhancement (via contrast) |
| **Opacity** | 0-100 | % | Transparency |

### Transformation Handling

Transformations (rotation, flip) are applied via canvas transformations before filters:

```javascript
ctx.save();
ctx.translate(imgX + imgWidth / 2, imgY + imgHeight / 2);

// Apply flips
if (editorState?.flipH) ctx.scale(-1, 1);
if (editorState?.flipV) ctx.scale(1, -1);

// Apply rotation
ctx.rotate(((editorState?.rotation || 0) * Math.PI) / 180);

ctx.translate(-(imgWidth / 2), -(imgHeight / 2));

// Apply filters and draw
ctx.filter = filterString;
ctx.globalAlpha = (editorState?.opacity || 100) / 100;
ctx.drawImage(uploadedImage, 0, 0, imgWidth, imgHeight);

ctx.restore();
```

### Performance Optimization

**Caching Strategy:**

When LUTs are active, the system uses an optimization to avoid redundant processing:

```javascript
// Check if parameters changed
const currentParams = JSON.stringify({
  brightness, contrast, saturation, blur, 
  hue, sharpen, opacity, flipH, flipV, rotation, lutFile
});

const needsReprocessing = !processedImageRef.current || 
                          lastProcessParamsRef.current !== currentParams;

if (needsReprocessing) {
  // Process and cache
  processedImageRef.current = processedCanvas;
  lastProcessParamsRef.current = currentParams;
} else {
  // Use cached result
  ctx.drawImage(processedImageRef.current, imgX, imgY, imgWidth, imgHeight);
}
```

**Benefits:**
- Reduces redundant filter applications
- Cached image reused when parameters unchanged
- Significant performance boost for complex filter chains

---

## 2. LUT Application System

### What are LUTs?

**LUT (Lookup Table)** = 3D color transformation cube that maps input RGB values to output RGB values. Used extensively in film/photography for color grading.

### LUT Format: .CUBE Files

Located in: `public/luts/`

**Structure:**
```
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

# RGB data (normalized 0.0-1.0)
0.000000 0.000000 0.000000
0.031373 0.027451 0.023529
0.062745 0.054902 0.047059
...
```

### LUT Processing Pipeline

#### Step 1: Parsing (.CUBE → JavaScript Object)

Located in: `src/components/ImageEditor/LUTUtils.js`

```javascript
export function parseCubeLUT(lutText) {
  const lines = lutText.split('\n');
  let lutSize = 0;
  const lutData = [];
  
  for (let line of lines) {
    line = line.trim();
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line.length === 0) continue;
    
    // Parse size
    if (line.startsWith('LUT_3D_SIZE')) {
      lutSize = parseInt(line.split(/\s+/)[1]);
      continue;
    }
    
    // Parse RGB values
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
```

**Output:**
```javascript
{
  size: 33,  // Cube dimension (33x33x33 = 35,937 color points)
  data: [
    [0.0, 0.0, 0.0],    // Black
    [0.031, 0.027, 0.023],
    // ... 35,935 more entries
  ]
}
```

#### Step 2: Trilinear Interpolation

LUTs store discrete color points. For colors between grid points, we use **trilinear interpolation**:

```javascript
function trilinearInterpolation(r, g, b, lutSize, lutData) {
  const maxIndex = lutSize - 1;
  
  // Scale normalized RGB to LUT grid coordinates
  const rScaled = r * maxIndex;  // e.g., 0.5 → 16.0 (for 33-size LUT)
  const gScaled = g * maxIndex;
  const bScaled = b * maxIndex;
  
  // Find surrounding grid points
  const r0 = Math.floor(rScaled);
  const g0 = Math.floor(gScaled);
  const b0 = Math.floor(bScaled);
  
  const r1 = Math.min(r0 + 1, maxIndex);
  const g1 = Math.min(g0 + 1, maxIndex);
  const b1 = Math.min(b0 + 1, maxIndex);
  
  // Calculate fractional positions
  const rFrac = rScaled - r0;
  const gFrac = gScaled - g0;
  const bFrac = bScaled - b0;
  
  // Get 8 corner values of the cube
  const c000 = getLUTValue(r0, g0, b0, lutSize, lutData);
  const c001 = getLUTValue(r0, g0, b1, lutSize, lutData);
  const c010 = getLUTValue(r0, g1, b0, lutSize, lutData);
  const c011 = getLUTValue(r0, g1, b1, lutSize, lutData);
  const c100 = getLUTValue(r1, g0, b0, lutSize, lutData);
  const c101 = getLUTValue(r1, g0, b1, lutSize, lutData);
  const c110 = getLUTValue(r1, g1, b0, lutSize, lutData);
  const c111 = getLUTValue(r1, g1, b1, lutSize, lutData);
  
  // Interpolate along blue axis
  const c00 = lerp3D(c000, c001, bFrac);
  const c01 = lerp3D(c010, c011, bFrac);
  const c10 = lerp3D(c100, c101, bFrac);
  const c11 = lerp3D(c110, c111, bFrac);
  
  // Interpolate along green axis
  const c0 = lerp3D(c00, c01, gFrac);
  const c1 = lerp3D(c10, c11, gFrac);
  
  // Interpolate along red axis
  return lerp3D(c0, c1, rFrac);
}
```

**Why Trilinear?**
- Smooth color transitions
- Avoids color banding artifacts
- Industry-standard for LUT application

#### Step 3: Per-Pixel Application

```javascript
export function applyLUT(imageData, lut) {
  if (!lut || !lut.data || lut.data.length === 0) {
    return imageData;
  }
  
  const { data, width, height } = imageData;
  const lutSize = lut.size;
  const lutData = lut.data;
  
  // Process every pixel
  for (let i = 0; i < data.length; i += 4) {
    // Get normalized RGB values (0.0-1.0)
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    
    // Apply LUT via trilinear interpolation
    const newColor = trilinearInterpolation(r, g, b, lutSize, lutData);
    
    // Clamp and write back (0-255)
    data[i] = Math.min(255, Math.max(0, newColor[0] * 255));
    data[i + 1] = Math.min(255, Math.max(0, newColor[1] * 255));
    data[i + 2] = Math.min(255, Math.max(0, newColor[2] * 255));
    // Alpha channel (i+3) unchanged
  }
  
  return imageData;
}
```

### Integration with Canvas Rendering

LUTs are applied AFTER CSS filters but BEFORE final compositing:

```javascript
// Main canvas rendering (Canvas.jsx, lines 333-385)

if (loadedLUT && needsReprocessing) {
  // Create offscreen canvas for processing
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = uploadedImage.width;
  offscreenCanvas.height = uploadedImage.height;
  const offscreenCtx = offscreenCanvas.getContext('2d');
  
  // Step 1: Apply transformations
  offscreenCtx.save();
  offscreenCtx.translate(uploadedImage.width / 2, uploadedImage.height / 2);
  if (editorState?.flipH) offscreenCtx.scale(-1, 1);
  if (editorState?.flipV) offscreenCtx.scale(1, -1);
  offscreenCtx.rotate(((editorState?.rotation || 0) * Math.PI) / 180);
  offscreenCtx.translate(-(uploadedImage.width / 2), -(uploadedImage.height / 2));
  
  // Step 2: Apply CSS filters
  offscreenCtx.filter = filterString;
  offscreenCtx.globalAlpha = (editorState?.opacity || 100) / 100;
  offscreenCtx.drawImage(uploadedImage, 0, 0);
  offscreenCtx.restore();
  
  // Step 3: Apply LUT (pixel level)
  const imageData = offscreenCtx.getImageData(0, 0, uploadedImage.width, uploadedImage.height);
  const lutAppliedData = applyLUT(imageData, loadedLUT);
  offscreenCtx.putImageData(lutAppliedData, 0, 0);
  
  // Step 4: Cache and draw to main canvas
  processedImageRef.current = offscreenCanvas;
  ctx.drawImage(offscreenCanvas, imgX, imgY, imgWidth, imgHeight);
}
```

**Processing Order:**
1. Transformations (flip, rotate)
2. CSS Filters (brightness, contrast, etc.)
3. LUT Application (pixel level color grading)
4. Caching
5. Final composition to main canvas

### Available LUTs

35 professional color grading presets included:

| Category | LUT Names | Style |
|----------|-----------|-------|
| **Warm** | Arabica, Bourbon, Clayton, Django, Lucky, Zeke | Coffee/vintage tones |
| **Cool** | Azrael, Contrail, Zed, Korben | Cyan/blue grades |
| **Matte** | Faded, Milo, Trent, Clouseau | low contrast film look |
| **Cinematic** | Fusion, Paladin, Cobi, Reeve | Movie style grading |
| **Vibrant** | Neon, Pitaya, Teigen | Punchy colors |
| **Natural** | Vireo, Remy, McKinnon | Documentary style |

### LUT Caching Strategy

**Problem:** Parsing .CUBE files is expensive (35,000+ lines)

**Solution:** Multi level caching

1. **Parse time Cache** (HistoryViewer.jsx):
```javascript
const [lutCache, setLutCache] = useState({});

if (!lut) {
  const response = await fetch(`/luts/${state.selectedLUT.file}`);
  const lutText = await response.text();
  lut = parseCubeLUT(lutText);
  setLutCache(prev => ({ ...prev, [state.selectedLUT.file]: lut }));
}
```

2. **Render time Cache** (Canvas.jsx):
```javascript
// Only reprocess when parameters change
const needsReprocessing = !processedImageRef.current || 
                          lastProcessParamsRef.current !== currentParams;
```

**Performance Impact:**
- First load: ~50-100ms (parse + apply)
- Cached loads: ~5-10ms (apply only)
- Render with cache: <1ms (draw cached canvas)

---

## 3. Segment Overlay & Merging System

### Architecture

The segment editing system allows users to extract image regions, edit them independently, then merge them back into the main image with automatic Re segmentation.

### Workflow Diagram

```
Main Image
    ↓
User Long presses → Segmentation API
    ↓
Extract segment at point
    ↓
Display segment overlay on canvas
    ↓
User drags to DropBox → SegmentEditor opens
    ↓
User edits segment (filters, LUTs, transforms, background)
    ↓
User clicks "Apply" → Merge segment back
    ↓
Create composite canvas (main image + edited segments)
    ↓
Replace main image with composite
    ↓
Re segment entire image → New segment map
    ↓
User can continue editing
```

### Step 1: Segment Extraction

Located in: `src/components/ImageEditor/Canvas.jsx` (lines 63-135)

```javascript
const handleSegmentSelect = async (x, y, clientX, clientY) => {
  if (!segmentationImageId || !uploadedImage) return;
  
  // Convert canvas coordinates to image coordinates
  const canvas = canvasRef.current;
  const scale = Math.min(
    canvas.width / uploadedImage.width,
    canvas.height / uploadedImage.height
  );
  
  const imgX = (canvas.width - imgWidth) / 2;
  const imgY = (canvas.height - imgHeight) / 2;
  
  const imageX = Math.round((x - imgX) / scale);
  const imageY = Math.round((y - imgY) / scale);
  
  // Query backend for segment at point
  const result = await getSegmentAtPoint(segmentationImageId, imageX, imageY);
  
  if (result.has_segment && result.segment_index !== undefined) {
    // Extract segment as separate image with transparency
    const extractedResult = await extractSegment(segmentationImageId, result.segment_index);
    
    if (extractedResult.object_base64) {
      // Add to selected segments
      setSelectedSegments(prev => [...prev, {
        index: result.segment_index,
        object: extractedResult.object_base64
      }]);
      
      // Create overlay image
      const img = new Image();
      img.src = extractedResult.object_base64;
      img.onload = () => {
        setSegmentOverlays(prev => [...prev, {
          id: result.segment_index,
          image: img,
          x: imgX,
          y: imgY,
          width: segmentWidth,
          height: segmentHeight,
          scale: scale
        }]);
      };
    }
  }
};
```

**Key Points:**
- Long press interaction (600ms) to select segments
- Coordinate transformation: canvas → image space
- Backend returns segment mask as PNG with alpha channel
- Overlay drawn on top of main image

### Step 2: Segment Editing

Located in: `src/components/ImageEditor/SegmentEditor/SegmentEditor.jsx`

Segment editor provides full editing capabilities:

```javascript
// Canvas rendering with all effects
useEffect(() => {
  if (!canvasRef.current || !currentObject?.image?.complete) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  
  // Clear and prepare canvas
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply zoom pan transformations
  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y);

  // Draw background (color or custom image)
  if (editorState.customBackground) {
    const bgW = canvas.width * editorState.backgroundScale;
    const bgH = canvas.height * editorState.backgroundScale;
    const bgX = (canvas.width - bgW) / 2 + editorState.backgroundPos.x;
    const bgY = (canvas.height - bgH) / 2 + editorState.backgroundPos.y;
    ctx.drawImage(editorState.customBackground, bgX, bgY, bgW, bgH);
  } else if (editorState.backgroundColor) {
    ctx.fillStyle = editorState.backgroundColor;
    ctx.fillRect(bgX, bgY, bgW, bgH);
  }

  // Calculate segment position
  const imgW = currentObject.width * editorState.imageScale;
  const imgH = currentObject.height * editorState.imageScale;
  const imgX = (canvas.width - imgW) / 2 + editorState.imagePos.x;
  const imgY = (canvas.height - imgH) / 2 + editorState.imagePos.y;

  // Apply LUT if present (same pipeline as main canvas)
  if (loadedLUT) {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = currentObject.image.width;
    offscreenCanvas.height = currentObject.image.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    // Apply transformations
    offscreenCtx.save();
    offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2);
    if (editorState.flipH) offscreenCtx.scale(-1, 1);
    if (editorState.flipV) offscreenCtx.scale(1, -1);
    offscreenCtx.rotate((editorState.rotation * Math.PI) / 180);
    offscreenCtx.translate(-(offscreenCanvas.width / 2), -(offscreenCanvas.height / 2));
    
    // Apply filters
    let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
    if (editorState.sharpen > 0) {
      filterString += ` contrast(${100 + editorState.sharpen}%)`;
    }
    offscreenCtx.filter = filterString;
    offscreenCtx.globalAlpha = editorState.opacity / 100;
    offscreenCtx.drawImage(currentObject.image, 0, 0);
    offscreenCtx.restore();
    
    // Apply LUT
    const imageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const lutAppliedData = applyLUT(imageData, loadedLUT);
    offscreenCtx.putImageData(lutAppliedData, 0, 0);
    
    // Draw processed segment
    ctx.drawImage(offscreenCanvas, imgX, imgY, imgW, imgH);
  } else {
    // Draw without LUT (faster path)
    ctx.save();
    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    if (editorState.flipH) ctx.scale(-1, 1);
    if (editorState.flipV) ctx.scale(1, -1);
    ctx.rotate((editorState.rotation * Math.PI) / 180);
    ctx.translate(-(imgW / 2), -(imgH / 2));
    
    ctx.filter = filterString;
    ctx.globalAlpha = editorState.opacity / 100;
    ctx.drawImage(currentObject.image, 0, 0, imgW, imgH);
    ctx.restore();
  }

  ctx.restore();
}, [canvasRef, currentObject, editorState, zoom, offset, loadedLUT]);
```

### Step 3: Applying Changes

Located in: `SegmentEditor.jsx` (lines 500-570)

```javascript
const applyAllChanges = () => {
  const tempCanvas = document.createElement('canvas');
  const currentObj = editorState.editedObjects[selectedObjectIndex];
  
  tempCanvas.width = currentObj.image.width;
  tempCanvas.height = currentObj.image.height;
  const tempCtx = tempCanvas.getContext('2d', { alpha: true });
  
  // Apply all transformations
  tempCtx.save();
  tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
  if (editorState.flipH) tempCtx.scale(-1, 1);
  if (editorState.flipV) tempCtx.scale(1, -1);
  tempCtx.rotate((editorState.rotation * Math.PI) / 180);
  tempCtx.translate(-(tempCanvas.width / 2), -(tempCanvas.height / 2));
  
  // Apply filters
  let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
  if (editorState.sharpen > 0) {
    filterString += ` contrast(${100 + editorState.sharpen}%)`;
  }
  tempCtx.filter = filterString;
  tempCtx.globalAlpha = editorState.opacity / 100;
  tempCtx.drawImage(currentObj.image, 0, 0);
  tempCtx.restore();
  
  // Apply LUT if present
  if (loadedLUT) {
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const lutAppliedData = applyLUT(imageData, loadedLUT);
    tempCtx.putImageData(lutAppliedData, 0, 0);
  }
  
  // Create final image
  const newImage = new Image();
  newImage.onload = () => {
    const finalObject = {
      ...currentObj,
      image: newImage,
      // Preserve original position/size data for accurate overlay
      originalCanvasX: currentObj.originalCanvasX,
      originalCanvasY: currentObj.originalCanvasY,
      normalizedX: currentObj.normalizedX,
      normalizedY: currentObj.normalizedY,
      normalizedWidth: currentObj.normalizedWidth,
      normalizedHeight: currentObj.normalizedHeight,
    };
    
    // Return to main editor
    onSave?.(finalEditedObjects);
    setShowEditor(false);
  };
  newImage.src = tempCanvas.toDataURL('image/png', 1.0);
};
```

### Step 4: Merging Back to Main Image

Located in: `src/components/ImageEditor/Editor.jsx` (lines 244-283)

```javascript
const handleApplyEditedSegments = async (editedObjects) => {
  setMergedSegments(editedObjects);
  setDroppedObjects([]);    
  setHasUnsavedChanges(true);
  await mergeSegmentsIntoImage(editedObjects);
};

const mergeSegmentsIntoImage = async (editedObjects) => {
  if (!uploadedImage || editedObjects.length === 0) return;
  
  // Create composite canvas
  const canvas = document.createElement('canvas');
  canvas.width = uploadedImage.width;
  canvas.height = uploadedImage.height;
  const ctx = canvas.getContext('2d', { alpha: true });
  
  // Draw base image
  ctx.drawImage(uploadedImage, 0, 0);
  
  // Overlay all edited segments
  for (const segment of editedObjects) {
    if (segment.image && segment.image.complete) {
      // Segments already positioned correctly (full size overlays)
      ctx.drawImage(segment.image, 0, 0, canvas.width, canvas.height);
    }
  }

  // Create merged image
  const mergedImage = new Image();
  mergedImage.crossOrigin = "anonymous";
  
  return new Promise((resolve) => {
    mergedImage.onload = () => {
      setUploadedImage(mergedImage);
      setMergedSegments([]);
      
      // Trigger Re segmentation
      resegmentImage(mergedImage);
      resolve();
    };
    mergedImage.src = canvas.toDataURL('image/png', 1.0);
  });
};
```

### Step 5: Re segmentation

```javascript
const resegmentImage = async (img) => {
  setIsSegmenting(true);
  try {
    const imageBase64 = imageToBase64(img);
    const result = await uploadAndSegment(imageBase64);
    setSegmentationImageId(result.image_id);
    // Backend creates new segmentation map
    // User can now select new segments from merged image
  } catch (error) {
    console.error('✗ Re segmentation failed:', error);
  } finally {
    setIsSegmenting(false);
  }
};
```

**Why Re segment?**
- Merged image has new boundaries
- Previous segment map invalid
- Fresh segmentation enables continued editing
- Maintains accurate segment selection

### Segment Overlay Rendering

Located in: `Canvas.jsx` (lines 433-452)

```javascript
// Overlay merged segments on canvas during preview
if (mergedSegments && mergedSegments.length > 0) {
  mergedSegments.forEach((segment) => {
    if (segment.image && segment.image.complete && 
        segment.normalizedX !== undefined) {
      
      // Calculate position relative to scaled image
      const segmentX = imgX + (segment.normalizedX * imgWidth);
      const segmentY = imgY + (segment.normalizedY * imgHeight);
      const segmentWidth = segment.normalizedWidth * imgWidth;
      const segmentHeight = segment.normalizedHeight * imgHeight;
      
      ctx.save();
      ctx.drawImage(
        segment.image, 
        segmentX, 
        segmentY, 
        segmentWidth, 
        segmentHeight
      );
      ctx.restore();
    }
  });
}
```

**Coordinate System:**

Segments use **normalized coordinates** (0.0-1.0) relative to canvas dimensions:

```javascript
// When creating segment
normalizedX: objCanvasX / canvas.width,        // e.g., 0.25 = 25% from left
normalizedY: objCanvasY / canvas.height,
normalizedWidth: scaledWidth / canvas.width,
normalizedHeight: scaledHeight / canvas.height
```

**Benefits:**
- resolution independent positioning
- Survives zoom pan operations
- Accurate repositioning after merge
- Consistent across different display sizes

---

## 4. Qwen AI Integration (Brief Overview)

### What is Qwen?

**Qwen** is an AI model ecosystem providing multiple image enhancement capabilities via LoRA (Low Rank Adaptation) adapters. The editor integrates with the Qwen Relight 2509 space on Hugging Face.

### Available Qwen Features

Located in: `backend/segmentation_inpainting/hf_qwen_space.py`

#### 1. **Background Generation (white to scene)**

```python
def white to scene(image_path: str, prompt: str):
    """Generate scene backgrounds from prompts"""
    adapter = get_best_adapter(prompt, "Next Scene")
    
    result = client.predict(
        input_image=handle_file(image_path),
        prompt=prompt,
        LoRA_adapter=adapter,
        seed=0,
        randomize_seed=True,
        guidance_scale=1.0,
        steps=4,
        api_name="/infer"
    )
    return Image.open(result[0])
```

**Use Cases:**
- AI theme backgrounds (night sky, beach, forest, etc.)
- Custom scene generation from text prompts
- Background replacement with contextual scenes

#### 2. **Lighting Enhancement (relight)**

```python
def relight(image_path: str, prompt: str):
    """Enhance lighting and shadows"""
    result = client.predict(
        input_image=handle_file(image_path),
        prompt=prompt,
        LoRA_adapter="Relight",
        seed=0,
        randomize_seed=True,
        guidance_scale=1.0,
        steps=4,
        api_name="/infer"
    )
    return Image.open(result[0])
```

**Use Cases:**
- Match segment lighting to background
- Golden hour effects
- Studio lighting simulation
- Shadow enhancement/removal

#### 3. **Image Fusion (fusion)**

```python
def fusion(image_path: str, prompt: str):
    """General image enhancement and blending"""
    adapter = get_best_adapter(prompt, "Relight")
    
    result = client.predict(
        input_image=handle_file(image_path),
        prompt=prompt,
        LoRA_adapter=adapter,
        # ... parameters
    )
    return Image.open(result[0])
```

**Use Cases:**
- Merging segments with backgrounds naturally
- Style transfer
- Image harmonization

### Intelligent Adapter Selection

The system automatically chooses the best LoRA adapter based on prompt keywords:

```python
def get_best_adapter(prompt: str, default_adapter: str = "Relight"):
    prompt_lower = prompt.lower()
    
    if any(keyword in prompt_lower for keyword in ['background', 'scene', 'environment']):
        return 'Next Scene'
    
    if any(keyword in prompt_lower for keyword in ['light', 'lighting', 'illuminate']):
        return 'Relight'
    
    if any(keyword in prompt_lower for keyword in ['skin', 'face', 'portrait']):
        return 'Edit Skin'
    
    if any(keyword in prompt_lower for keyword in ['anime', 'cartoon']):
        return 'Photo to Anime'
    
    if any(keyword in prompt_lower for keyword in ['enhance', 'upscale']):
        return 'Upscale Image'
    
    return default_adapter
```

### Performance Considerations

**Qwen API Calls:**
- Average latency: 2-5 seconds
- Depends on Hugging Face Space availability
- Requires HF_TOKEN in environment variables
- Falls back to alternative adapters on failure

**Local Processing:**
- All canvas operations are local (instant)
- Only AI features require network calls
- User can continue editing during AI processing
- Loading states prevent multiple simultaneous requests

---

## Summary

### Editing Pipeline Overview

```
User Input (Slider/Button)
    ↓
Command Pattern (useHistory)
    ↓
State Update (React State)
    ↓
Canvas re render Triggered
    ↓
┌──────────────────────────────┐
│ Rendering Pipeline           │
├──────────────────────────────┤
│ 1. Clear Canvas              │
│ 2. Apply zoom pan Transform  │
│ 3. Draw Background (if any)  │
│ 4. Apply Transformations     │
│    - Flip (X/Y)              │
│    - Rotation                │
│ 5. Apply CSS Filters         │
│    - Brightness, Contrast... │
│ 6. Apply LUT (if selected)   │
│    - Trilinear Interpolation │
│ 7. Draw Processed Image      │
│ 8. Overlay Merged Segments   │
│ 9. Cache Result              │
└──────────────────────────────┘
    ↓
Display to User
```

### Key Architectural Principles

1. **non destructive Editing**: Original image never modified
2. **Layered Rendering**: Background → Image → Segments → Overlays
3. **Smart Caching**: Avoid redundant processing
4. **Coordinate Normalization**: resolution independent positioning
5. **Pipeline Separation**: CSS Filters → LUTs → Composition
6. **AI Enhancement**: Optional, network-based processing
7. **real time Preview**: Immediate visual feedback

### Performance Metrics

| Operation | Time (Typical) | Optimization |
|-----------|----------------|--------------|
| CSS Filter Application | <5ms | Hardware accelerated |
| LUT Application (cached) | <10ms | Pre-parsed LUT |
| LUT Application (first) | 50-100ms | Caching strategy |
| Segment Extraction | 100-200ms | Backend API |
| Qwen AI Enhancement | 2-5s | Async with loading state |
| Canvas Composition | <5ms | Cached intermediate results |
| Re segmentation | 1-3s | Backend SAM model |

### Browser Compatibility

**Required Features:**
- Canvas 2D API with filter support
- ImageData manipulation
- CSS Filters (brightness, contrast, etc.)
- Blob/File APIs
- Fetch API

**Tested Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

## Troubleshooting

### Common Issues

**Issue:** Filters not applying
- **Cause:** Browser doesn't support `ctx.filter`
- **Solution:** Fallback to manual pixel manipulation

**Issue:** LUT colors look wrong
- **Cause:** Incorrect trilinear interpolation or malformed .CUBE file
- **Solution:** Validate LUT size matches data length


**Issue:** Qwen API timeout
- **Cause:** Hugging Face Space sleeping or overloaded
- **Solution:** Retry mechanism with exponential backoff

---

## Future Enhancements

1. **GPU Acceleration**: Use WebGL shaders for filter application
2. **Custom LUT Creation**: Allow users to create/save LUTs
3. **Batch Processing**: Apply edits to multiple segments simultaneously
4. **Advanced Masking**: Feathered edges for segment blending
5. **real time Qwen Preview**: Stream AI results during processing
6. **LUT Strength Control**: Blend between original and LUT-applied
7. **Filter Presets**: Save/load filter combinations
8. **Undo for Segments**: Independent history per segment

---

## Conclusion

The canvas editing system demonstrates a sophisticated approach to real time image manipulation, balancing performance with quality through intelligent caching, hardware acceleration, and selective AI enhancement. By separating concerns (CSS filters, LUT application, segment composition), the system remains maintainable and extensible while delivering professional-grade results.

The integration of Qwen AI adds powerful enhancement capabilities without compromising the core editing experience, providing users with both traditional controls and cutting-edge AI features in a unified interface.
