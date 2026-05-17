import { useState, useRef, useEffect } from 'react';
import { FlipHorizontal, FlipVertical, ZoomIn, Palette, Save } from "lucide-react";
import {handleWheel, handleTouchMovePinch, handleTouchEndPinch, handlePanStart, handlePanMove, handlePanEnd} from "../CanvasUtils"
import SegmentHeader from './SegmentHeader';
import GalleryView from './GalleryView';
import QuickActions from './QuickActions';
import SegmentFooter from './SegmentFooter';
import EditingOptions from './EditingOptions';
import BackgroundPanel from './BackgroundPanel';
import EditSlider from './EditSlider';
import useHistory from '../../../hooks/useHistory';
import LUTSlider from '../LUTSlider';
import { loadLUT, applyLUT } from '../LUTUtils';
import { inpaintingAPI } from '../../../utils/inpaintingAPI';
import ClipLoader from "react-spinners/HashLoader";

export class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

export default function SegmentEditor({ setShowEditor, droppedObjects, onSave }) {
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(droppedObjects.length-1);
  const [viewMode, setViewMode] = useState('edit');
  const [selectedEditOption, setSelectedEditOption] = useState(null);
  const [sidebarView, setSidebarView] = useState('editing');
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);
  const [showLUTSelector, setShowLUTSelector] = useState(false);
  const [loadedLUT, setLoadedLUT] = useState(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiTask, setAiTask] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const lastDistanceRef = useRef(null);
  
  const canvasRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const {
    state: editorState,
    execute,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
  } = useHistory({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
    opacity: 100,
    sharpen: 0,
    hue: 0,
    imageScale: 1,
    imagePos: {x:0,y:0},
    backgroundScale: 1,
    backgroundPos: {x:0,y:0},
    backgroundColor: null,
    customBackground: null,
    editedObjects: [...droppedObjects],
    selectedLUT: null,
  });

  const currentObject = editorState.editedObjects[selectedObjectIndex];
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const loadSelectedLUT = async () => {
      if (editorState.selectedLUT) {
        const lut = await loadLUT(`/luts/${editorState.selectedLUT.file}`);
        setLoadedLUT(lut);
      } else {
        setLoadedLUT(null);
      }
    };
    loadSelectedLUT();
  }, [editorState.selectedLUT]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleCustomBackgroundUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        execute(new Command(
          (s) => ({ ...s, customBackground: img, backgroundColor: null }),
          (s) => ({ ...s, customBackground: s.customBackground, backgroundColor: s.backgroundColor })
        ));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const enhanceWithBackground = async (backgroundImg) => {
    if (!currentObject?.image || !backgroundImg) return;
    
    setIsAIProcessing(true);
    try {
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = canvasSize.width;
      compositeCanvas.height = canvasSize.height;
      const compositeCtx = compositeCanvas.getContext('2d');
      
      const bgW = compositeCanvas.width * editorState.backgroundScale;
      const bgH = compositeCanvas.height * editorState.backgroundScale;
      const bgX = (compositeCanvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (compositeCanvas.height - bgH) / 2 + editorState.backgroundPos.y;
      compositeCtx.drawImage(backgroundImg, bgX, bgY, bgW, bgH);
      
      const imgW = currentObject.width * editorState.imageScale;
      const imgH = currentObject.height * editorState.imageScale;
      const imgX = (compositeCanvas.width - imgW) / 2 + editorState.imagePos.x;
      const imgY = (compositeCanvas.height - imgH) / 2 + editorState.imagePos.y;
      compositeCtx.drawImage(currentObject.image, imgX, imgY, imgW, imgH);
      
      const mergedBlob = await new Promise(resolve => compositeCanvas.toBlob(resolve, 'image/png'));
      
      const formData = new FormData();
      formData.append('merged_file', mergedBlob, 'merged.png');
      
      const response = await fetch('http://localhost:8000/inpainting/enhance-merged-lighting', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Enhancement failed');
      
      const result = await response.json();
      
      if (result.success && result.enhanced_image) {
        const enhancedImg = new Image();
        enhancedImg.onload = () => {
          const newObject = {
            ...currentObject,
            image: enhancedImg,
            width: enhancedImg.width,
            height: enhancedImg.height
          };
          
          execute(new Command(
            (s) => {
              const newObjects = [...s.editedObjects];
              newObjects[selectedObjectIndex] = newObject;
              return { ...s, editedObjects: newObjects };
            },
            (s) => ({ ...s })
          ));
        };
        enhancedImg.src = result.enhanced_image;
      }
    } catch (error) {
      console.error('Background enhancement failed:', error);
      alert('Failed to enhance lighting. Please try again.');
    } finally {
      setIsAIProcessing(false);
    }
  };

  const saveImageWithBackground = () => {
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d', { alpha: true });
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    if (editorState.customBackground) {
      const bgW = exportCanvas.width * editorState.backgroundScale;
      const bgH = exportCanvas.height * editorState.backgroundScale;
      const bgX = (exportCanvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (exportCanvas.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.drawImage(editorState.customBackground, bgX, bgY, bgW, bgH);
    } else if (editorState.backgroundColor) {
      ctx.fillStyle = editorState.backgroundColor;
      const bgW = exportCanvas.width * editorState.backgroundScale;
      const bgH = exportCanvas.height * editorState.backgroundScale;
      const bgX = (exportCanvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (exportCanvas.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }
    
    const imgW = currentObject.width * editorState.imageScale;
    const imgH = currentObject.height * editorState.imageScale;
    const imgX = (exportCanvas.width - imgW) / 2 + editorState.imagePos.x;
    const imgY = (exportCanvas.height - imgH) / 2 + editorState.imagePos.y;
    
    ctx.save();
    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    
    if (editorState.flipH) ctx.scale(-1, 1);
    if (editorState.flipV) ctx.scale(1, -1);
    
    ctx.rotate((editorState.rotation * Math.PI) / 180);
    ctx.translate(-(imgW / 2), -(imgH / 2));
    
    let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
    if (editorState.sharpen > 0) {
      filterString += ` contrast(${100 + editorState.sharpen}%)`;
    }
    ctx.filter = filterString;
    ctx.globalAlpha = editorState.opacity / 100;
    
    ctx.drawImage(currentObject.image, 0, 0, imgW, imgH);
    ctx.restore();
    
    const link = document.createElement('a');
    link.download = `${currentObject.name}_with_background.png`;
    link.href = exportCanvas.toDataURL('image/png', 1.0);
    link.click();
  };

  useEffect(() => {
    if (!canvasRef.current || !currentObject?.image?.complete) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y);

    if (editorState.customBackground && editorState.customBackground.complete) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const bgW = canvas.width * editorState.backgroundScale;
      const bgH = canvas.height * editorState.backgroundScale;
      const bgX = (canvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (canvas.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.drawImage(editorState.customBackground, bgX, bgY, bgW, bgH);
    } else if (editorState.backgroundColor) {
      ctx.fillStyle = editorState.backgroundColor;
      const bgW = canvas.width * editorState.backgroundScale;
      const bgH = canvas.height * editorState.backgroundScale;
      const bgX = (canvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (canvas.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    const imgW = currentObject.width * editorState.imageScale;
    const imgH = currentObject.height * editorState.imageScale;
    const imgX = (canvas.width - imgW) / 2 + editorState.imagePos.x;
    const imgY = (canvas.height - imgH) / 2 + editorState.imagePos.y;

    if (loadedLUT) {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = currentObject.image.width;
      offscreenCanvas.height = currentObject.image.height;
      const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      
      offscreenCtx.imageSmoothingEnabled = true;
      offscreenCtx.imageSmoothingQuality = 'high';
      
      offscreenCtx.save();
      offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height / 2);
      
      if (editorState.flipH) offscreenCtx.scale(-1, 1);
      if (editorState.flipV) offscreenCtx.scale(1, -1);
      
      offscreenCtx.rotate((editorState.rotation * Math.PI) / 180);
      offscreenCtx.translate(-(offscreenCanvas.width / 2), -(offscreenCanvas.height / 2));
      
      let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
      if (editorState.sharpen > 0) {
        filterString += ` contrast(${100 + editorState.sharpen}%)`;
      }
      offscreenCtx.filter = filterString;
      offscreenCtx.globalAlpha = editorState.opacity / 100;
      
      offscreenCtx.drawImage(currentObject.image, 0, 0);
      offscreenCtx.restore();
      
      const imageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      const lutAppliedData = applyLUT(imageData, loadedLUT);
      offscreenCtx.putImageData(lutAppliedData, 0, 0);
      
      ctx.drawImage(offscreenCanvas, imgX, imgY, imgW, imgH);
    } else {
      ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
      
      if (editorState.flipH) ctx.scale(-1, 1);
      if (editorState.flipV) ctx.scale(1, -1);
      
      ctx.rotate((editorState.rotation * Math.PI) / 180);
      ctx.translate(-(imgW / 2), -(imgH / 2));

      let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
      if (editorState.sharpen > 0) {
        filterString += ` contrast(${100 + editorState.sharpen}%)`;
      }
      ctx.filter = filterString;
      ctx.globalAlpha = editorState.opacity / 100;

      try {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(currentObject.image, 0, 0, imgW, imgH);
      } catch (e) {
        console.error('Error drawing image:', e);
      }
    }

    ctx.restore();
  }, [currentObject, editorState, zoom, offset, canvasSize, viewMode, loadedLUT]);

  const resetFilters = () => {
    execute(new Command(
      (s) => ({
        ...s,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
        opacity: 100,
        sharpen: 0,
        hue: 0,
        imageScale: 1,
        imagePos: { x: 0, y: 0 },
        backgroundScale: 1,
        backgroundPos: { x: 0, y: 0 },
        selectedLUT: null,
      }),
      (s) => ({ ...s })
    ));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `${currentObject.name}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const deleteObject = () => {
    if (editorState.editedObjects.length === 1) {
      alert('Cannot delete the last object');
      return;
    }
    execute(new Command(
      (s) => {
        const newObjects = s.editedObjects.filter((_, i) => i !== selectedObjectIndex);
        return { ...s, editedObjects: newObjects };
      },
      (s) => ({ ...s })
    ));
    setSelectedObjectIndex(Math.max(0, selectedObjectIndex - 1));
  };

  const handleAIEdit = async (textPrompt) => {
    if (!canvasRef.current || !textPrompt.trim()) return;

    setIsAIProcessing(true);
    
    try {
      const prompt_lower = textPrompt.toLowerCase();
      if ((prompt_lower.includes('match') || prompt_lower.includes('blend') || prompt_lower.includes('enhance') || prompt_lower.includes('improve')) && 
          (prompt_lower.includes('background') || prompt_lower.includes('lighting'))) {
        if (editorState.customBackground) {
          await enhanceWithBackground(editorState.customBackground);
          return;
        } else {
          alert('Please add a custom background first to use lighting enhancement.');
          setIsAIProcessing(false);
          return;
        }
      }      
      try {
        const smartResult = await inpaintingAPI.qwenSmartEdit(canvasRef.current, textPrompt);
        
        if (smartResult?.success && smartResult?.result_image) {
          await applyAIResult(smartResult.result_image);
          return;
        }
      } catch (smartError) {
        console.log('Smart edit failed, trying individual functions:', smartError);
      }

      let result = null;
      
      try {
        if (prompt_lower.includes('background') || prompt_lower.includes('scene') || prompt_lower.includes('environment')) {
          result = await inpaintingAPI.qwenWhiteToScene(canvasRef.current, textPrompt);
        } else if (prompt_lower.includes('light') || prompt_lower.includes('lighting') || prompt_lower.includes('shadow')) {
          result = await inpaintingAPI.qwenRelight(canvasRef.current, textPrompt);
        } else {
          result = await inpaintingAPI.qwenFusion(canvasRef.current, textPrompt);
        }
        
        if (result?.success && result?.result_image) {
          await applyAIResult(result.result_image);
          return;
        }
      } catch (directError) {
        console.log('Direct approach failed, trying comprehensive processing:', directError);
      }

      try {
        let fallbackResult = null;        
        try {
          fallbackResult = await inpaintingAPI.qwenRelight(canvasRef.current, textPrompt);
        } catch (e) {
          console.log('Relight failed, trying fusion:', e);
          try {
            fallbackResult = await inpaintingAPI.qwenFusion(canvasRef.current, textPrompt);
          } catch (e2) {
            console.log('Fusion failed, trying scene:', e2);
            fallbackResult = await inpaintingAPI.qwenWhiteToScene(canvasRef.current, textPrompt);
          }
        }
        
        if (fallbackResult?.success && fallbackResult?.result_image) {
          await applyAIResult(fallbackResult.result_image);
          return;
        }
      } catch (fallbackError) {
        console.error('All AI editing strategies failed:', fallbackError);
      }
      
      alert(`AI editing failed. Please try:\n• A more specific prompt\n• Different wording\n• Check internet connection\n\nExample: "Add golden hour lighting" or "Change background to forest"`);
      setAiTask(null);
    } catch (error) {
      console.error('AI editing failed:', error);
      alert(`AI editing failed: ${error.message}`);
      setAiTask(null);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const applyAIResult = async (resultImageUrl) => {
    const resultImg = new Image();
    resultImg.crossOrigin = 'anonymous';
    
    resultImg.onload = () => {
      const newObject = {
        ...currentObject,
        image: resultImg,
        name: `${currentObject.name}_ai_edited`,
        width: resultImg.width,
        height: resultImg.height
      };

      execute(new Command(
        (s) => {
          const newObjects = [...s.editedObjects];
          newObjects[selectedObjectIndex] = newObject;
          return { ...s, editedObjects: newObjects };
        },
        (s) => ({ ...s })
      ));
    };

    resultImg.onerror = () => {
      throw new Error('Failed to load AI result image');
    };

    resultImg.src = resultImageUrl;
  };

  const duplicateObject = () => {
    const duplicate = {
      ...currentObject,
      id: editorState.editedObjects.length + 1,
      name: `${currentObject.name} (Copy)`
    };
    execute(new Command(
      (s) => ({ ...s, editedObjects: [...s.editedObjects, duplicate] }),
      (s) => ({ ...s })
    ));
  };

  const applyAllChanges = () => {
    const tempCanvas = document.createElement('canvas');
    const currentObj = editorState.editedObjects[selectedObjectIndex];
    
    tempCanvas.width = currentObj.image.width;
    tempCanvas.height = currentObj.image.height;
    const tempCtx = tempCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
    
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    
    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    
    if (editorState.flipH) tempCtx.scale(-1, 1);
    if (editorState.flipV) tempCtx.scale(1, -1);
    
    tempCtx.rotate((editorState.rotation * Math.PI) / 180);
    tempCtx.translate(-(tempCanvas.width / 2), -(tempCanvas.height / 2));
    
    let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
    if (editorState.sharpen > 0) {
      filterString += ` contrast(${100 + editorState.sharpen}%)`;
    }
    tempCtx.filter = filterString;
    tempCtx.globalAlpha = editorState.opacity / 100;
    
    tempCtx.drawImage(currentObj.image, 0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.restore();
    
    if (loadedLUT) {
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const lutAppliedData = applyLUT(imageData, loadedLUT);
      tempCtx.putImageData(lutAppliedData, 0, 0);
    }    
    const newImage = new Image();
    newImage.onload = () => {
      const finalObject = {
        ...currentObj,
        image: newImage,
        originalCanvasX: currentObj.originalCanvasX,
        originalCanvasY: currentObj.originalCanvasY,
        originalCanvasWidth: currentObj.originalCanvasWidth,
        originalCanvasHeight: currentObj.originalCanvasHeight,
        normalizedX: currentObj.normalizedX,
        normalizedY: currentObj.normalizedY,
        normalizedWidth: currentObj.normalizedWidth,
        normalizedHeight: currentObj.normalizedHeight,
        displayScaleFactor: currentObj.displayScaleFactor,
      };      
      const finalEditedObjects = [...editorState.editedObjects];
      finalEditedObjects[selectedObjectIndex] = finalObject;            
      onSave?.(finalEditedObjects);
      setShowEditor(false);
    };
    newImage.src = tempCanvas.toDataURL('image/png', 1.0);
  };

  const saveAndExit = async () => {
    setIsSaving(true);
    try {
      const tempCanvas = document.createElement('canvas');
      const currentObj = editorState.editedObjects[selectedObjectIndex];
      
      tempCanvas.width = currentObj.image.width;
      tempCanvas.height = currentObj.image.height;
      const tempCtx = tempCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
      
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      
      tempCtx.save();
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      
      if (editorState.flipH) tempCtx.scale(-1, 1);
      if (editorState.flipV) tempCtx.scale(1, -1);
      
      tempCtx.rotate((editorState.rotation * Math.PI) / 180);
      tempCtx.translate(-(tempCanvas.width / 2), -(tempCanvas.height / 2));
      
      let filterString = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px) hue-rotate(${editorState.hue}deg)`;
      if (editorState.sharpen > 0) {
        filterString += ` contrast(${100 + editorState.sharpen}%)`;
      }
      tempCtx.filter = filterString;
      tempCtx.globalAlpha = editorState.opacity / 100;
      
      tempCtx.drawImage(currentObj.image, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.restore();
      
      if (loadedLUT) {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const lutAppliedData = applyLUT(imageData, loadedLUT);
        tempCtx.putImageData(lutAppliedData, 0, 0);
      }
      
      const imageBase64 = tempCanvas.toDataURL('image/png', 1.0);
      
      const finalEditedObjects = [...editorState.editedObjects];
      const newImage = new Image();
      newImage.onload = async () => {
        const finalObject = {
          ...currentObj,
          image: newImage,
          originalCanvasX: currentObj.originalCanvasX,
          originalCanvasY: currentObj.originalCanvasY,
          originalCanvasWidth: currentObj.originalCanvasWidth,
          originalCanvasHeight: currentObj.originalCanvasHeight,
          normalizedX: currentObj.normalizedX,
          normalizedY: currentObj.normalizedY,
          normalizedWidth: currentObj.normalizedWidth,
          normalizedHeight: currentObj.normalizedHeight,
          displayScaleFactor: currentObj.displayScaleFactor,
        };
        finalEditedObjects[selectedObjectIndex] = finalObject;
        
        await onSave?.(finalEditedObjects);
        setShowEditor(false);
        setIsSaving(false);
      };
      newImage.src = imageBase64;
    } catch (error) {
      console.error('Failed to save image:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center md:p-4">
      {/* AI Processing Loader */}
      {isAIProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900/90 rounded-lg p-8 flex flex-col items-center gap-4">
            <ClipLoader color="rgba(168,85,247,0.9)" size={50} />
            <p className="text-white text-sm">Generating...</p>
          </div>
        </div>
      )}
      <div className="bg-black w-full h-full md:max-w-6xl md:h-[90vh] shadow-2xl border-0 md:border md:border-white/10 flex flex-col">
        <SegmentHeader 
          setShowEditor={setShowEditor} 
          editedObjects={editorState.editedObjects} 
          setViewMode={setViewMode} 
          viewMode={viewMode}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
          
          {viewMode === 'gallery' ? (
            <GalleryView editedObjects={editorState.editedObjects} setSelectedObjectIndex={setSelectedObjectIndex} setViewMode={setViewMode} selectedObjectIndex={selectedObjectIndex} duplicateObject={duplicateObject} deleteObject={deleteObject}/>
          ) : (
            <>
              <div 
                className="flex-1 p-2 md:p-6 flex items-center justify-center bg-black/20 relative overflow-hidden"
                onWheel={(e)=>handleWheel(e,setZoom, setOffset, canvasRef)}
                style={{ touchAction: 'none' }}
              >
                <div className="absolute flex gap-2 md:gap-3 top-2 md:top-4 right-2 md:right-4 z-20 bg-black/50 backdrop-blur-md rounded-lg px-2 md:px-3 py-1 md:py-2">
                  <ZoomIn size={16} className="md:w-5 md:h-5" />
                  <p className="text-xs md:text-sm">{Math.round(zoom * 100)}%</p>
                </div>
                
                <div className="relative w-full h-full flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="border border-white/20 shadow-2xl"
                    style={{ 
                      cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                    onMouseDown={(e) => {
                      handlePanStart(e.clientX, e.clientY, isDraggingRef, lastDragPosRef);
                    }}
                    onMouseMove={(e) => {
                      if (isDraggingRef.current) {
                        handlePanMove(e.clientX, e.clientY, isDraggingRef, lastDragPosRef, setOffset);
                      }
                    }}
                    onMouseUp={(e) => {
                      handlePanEnd(isDraggingRef);
                    }}
                    onMouseLeave={()=>handlePanEnd(isDraggingRef)}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      handlePanStart(t.clientX, t.clientY, isDraggingRef,lastDragPosRef);
                    }}
                    onTouchMove={(e) => {
                      if (e.touches.length === 2) {
                        handleTouchMovePinch(e, lastDistanceRef, setZoom, setOffset, canvasRef);
                      } else if (e.touches.length === 1) {
                        const t = e.touches[0];
                        handlePanMove(t.clientX, t.clientY, isDraggingRef, lastDragPosRef, setOffset);
                      }
                    }}
                    onTouchEnd={(e) => {
                      handleTouchEndPinch(lastDistanceRef);
                      handlePanEnd(isDraggingRef);
                    }}
                  />
                </div>
              </div>

              {/* Mobile Toolbar Toggle Button - Only visible on mobile */}
              <button
                onClick={() => {
                  setSidebarView('editing');
                  setIsMobileToolbarOpen(!isMobileToolbarOpen);
                }}
                className="md:hidden fixed top-30 right-4 z-30 bg-blue-500 hover:bg-blue-600 p-2 rounded-full shadow-lg transition-all"
                title="Edit Tools"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileToolbarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Mobile Background Button - Only visible on mobile */}
              <button
                onClick={() => {
                  setSidebarView('background');
                  setIsMobileToolbarOpen(true);
                }}
                className="md:hidden fixed top-43 right-4 z-30 bg-blue-500 hover:bg-blue-600 p-2 rounded-full shadow-lg transition-all"
                title="Background"
              >
                <Palette size={20} />
              </button>

              {/* Slider - positioned at bottom on mobile, below canvas on desktop */}
              {selectedEditOption && (
                <div className="absolute md:relative bottom-0 left-10 right-10 md:bottom-auto z-20 bg-black/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none p-3 md:p-0">
                  <EditSlider 
                    selectedEditOption={selectedEditOption}
                    editorState={editorState}
                    execute={execute}
                    setSelectedEditOption={setSelectedEditOption}/>
                </div>
              )}

              {/* Desktop Sidebar - hidden on mobile */}
              <div className="hidden md:block w-80 border-l border-white/10 overflow-y-auto bg-black/20">
                <div className="p-4 space-y-4">
                  
                  {sidebarView === 'editing' ? (
                    <>
                      <QuickActions 
                        downloadImage={downloadImage} 
                        resetFilters={resetFilters}
                      />

                      <EditingOptions setSelectedEditOption={setSelectedEditOption}
                        selectedEditOption={selectedEditOption}
                        editorState={editorState}
                        execute={execute}
                        onClose={undefined}
                        setSidebarView={setSidebarView}/>

                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Color Grading</p>
                        <button
                          onClick={() => {
                            setShowLUTSelector(true)
                          }}
                          className="w-full px-4 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Palette size={18} />
                          <span className="font-medium">
                            {editorState.selectedLUT ? editorState.selectedLUT.name : 'Select Filter'}
                          </span>
                        </button>
                        {editorState.selectedLUT && (
                          <p className="text-xs text-gray-400 text-center mt-2">
                            ✓ Active filter
                          </p>
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Transform</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              execute(new Command(
                                (s) => ({ ...s, flipH: !s.flipH }),
                                (s) => ({ ...s, flipH: !s.flipH })
                              ));
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              editorState.flipH ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <FlipHorizontal size={16} />
                            <span className="text-sm">Flip H</span>
                          </button>
                          <button
                            onClick={() => {
                              execute(new Command(
                                (s) => ({ ...s, flipV: !s.flipV }),
                                (s) => ({ ...s, flipV: !s.flipV })
                              ));
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              editorState.flipV ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <FlipVertical size={16} />
                            <span className="text-sm">Flip V</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                      <BackgroundPanel 
                            setSidebarView={setSidebarView}
                            canvasSize={canvasSize}
                            setCanvasSize={setCanvasSize}
                            editorState={editorState}
                            execute={execute}
                            backgroundInputRef={backgroundInputRef}
                            handleCustomBackgroundUpload={handleCustomBackgroundUpload}
                            saveImageWithBackground={saveImageWithBackground}
                      />
                  )}
                </div>
              </div>

              {/* Mobile Sliding Sidebar - only visible on mobile */}
              <div className={`md:hidden fixed inset-y-0 right-0 w-48 max-w-[85vw] bg-black border-l border-white/10 overflow-y-auto transform transition-transform duration-300 ease-in-out z-40 ${
                isMobileToolbarOpen ? 'translate-x-0' : 'translate-x-full'
              }`}>
                <div className="p-4 space-y-4">
                  
                  {sidebarView === 'editing' ? (
                    <>
                      <QuickActions 
                        downloadImage={downloadImage} 
                        resetFilters={resetFilters}
                      />

                      <EditingOptions setSelectedEditOption={setSelectedEditOption}
                        selectedEditOption={selectedEditOption}
                        editorState={editorState}
                        execute={execute}
                        onClose={() => setIsMobileToolbarOpen(false)}
                        setSidebarView={setSidebarView}/>

                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Color Grading</p>
                        <button
                          onClick={() => {
                            setShowLUTSelector(true)
                            setIsMobileToolbarOpen(false)
                          }}
                          className="w-full px-4 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Palette size={18} />
                          <span className="font-medium text-xs">
                            {editorState.selectedLUT ? editorState.selectedLUT.name : 'Select Filter'}
                          </span>
                        </button>
                        {editorState.selectedLUT && (
                          <p className="text-xs text-gray-400 text-center mt-2">
                            ✓ Active filter
                          </p>
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Transform</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              execute(new Command(
                                (s) => ({ ...s, flipH: !s.flipH }),
                                (s) => ({ ...s, flipH: !s.flipH })
                              ));
                              setIsMobileToolbarOpen(false);
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              editorState.flipH ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <FlipHorizontal size={16} />
                            <span className="text-sm">Flip H</span>
                          </button>
                          <button
                            onClick={() => {
                              execute(new Command(
                                (s) => ({ ...s, flipV: !s.flipV }),
                                (s) => ({ ...s, flipV: !s.flipV })
                              ));
                              setIsMobileToolbarOpen(false);
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              editorState.flipV ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <FlipVertical size={16} />
                            <span className="text-sm">Flip V</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                      <BackgroundPanel 
                            setSidebarView={setSidebarView}
                            canvasSize={canvasSize}
                            setCanvasSize={setCanvasSize}
                            editorState={editorState}
                            execute={execute}
                            backgroundInputRef={backgroundInputRef}
                            handleCustomBackgroundUpload={handleCustomBackgroundUpload}
                            saveImageWithBackground={saveImageWithBackground}
                            onClose={() => setIsMobileToolbarOpen(false)}
                      />
                  )}
                </div>
              </div>

              {/* Mobile Sidebar Backdrop */}
              {isMobileToolbarOpen && (
                <div 
                  className="md:hidden fixed inset-0 bg-black/50 z-30"
                  onClick={() => setIsMobileToolbarOpen(false)}
                />
              )}
            </>
          )}
        </div>

        {/* Apply and Save Buttons - Bottom Right */}
        <div className="absolute bottom-70 right-4 z-10 flex gap-2">
          <button
            onClick={saveAndExit}
            disabled={isSaving}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-lg"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save & Exit
              </>
            )}
          </button>
          <button
            onClick={applyAllChanges}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            Apply
          </button>
        </div>
        
        <SegmentFooter 
          execute={execute}
          editorState={editorState}
          Command={Command}
          onAIEdit={handleAIEdit}
          isAIProcessing={isAIProcessing}
        />
      </div>
      
      {/* LUT Filter Selector */}
      {showLUTSelector && (
        <LUTSlider 
          onSelect={(lut) => {
            execute(new Command(
              (s) => ({ ...s, selectedLUT: lut }),
              (s) => ({ ...s, selectedLUT: editorState.selectedLUT })
            ));
          }}
          currentLUT={editorState.selectedLUT}
          onClose={() => setShowLUTSelector(false)}
        />
      )}
    </div>
  );
}