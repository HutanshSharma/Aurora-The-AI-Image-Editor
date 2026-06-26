import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Palette, Image as ImageIcon, Download, ZoomIn, Sparkles, X, Save } from "lucide-react";
import { useUser } from '../../../store/UserContext';
import { useLoader } from '../../../store/LoaderContext';
import {handleWheel, handleTouchMovePinch, handleTouchEndPinch, handlePanStart, handlePanMove, handlePanEnd} from "../../MainEditor/Utils/CanvasUtils"
import SegmentHeader from './SegmentHeader';
import GalleryView from './GalleryView';
import BackgroundPanel from './BackgroundPanel';
import AdjustBar from '../../MainEditor/UI/AdjustBar';
import LUTSlider from '../../MainEditor/UI/LUTSlider';
import CommandInput from '../../MainEditor/UI/CommandInput';
import useHistory from '../../../hooks/useHistory';
import { loadLUT, applyLUT } from '../../MainEditor/Utils/LUTUtils';
import { qwenSmartEdit } from '../../MainEditor/Utils/AIEditAPI';

export class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1.5 py-1 text-muted transition-colors hover:text-ink active:scale-95 sm:w-[76px] sm:flex-none"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-ink">
        <Icon size={20} />
      </span>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

export default function SegmentEditor({ setShowEditor, droppedObjects, onSave, addToast }) {
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(droppedObjects.length-1);
  const [viewMode, setViewMode] = useState('edit');
  const [selectedEditOption, setSelectedEditOption] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [loadedLUT, setLoadedLUT] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const lastDistanceRef = useRef(null);
  const dragModeRef = useRef('background');
  const hitCanvasRef = useRef({ img: null });
  const segLutBaseRef = useRef(null); 
  const segProcessedRef = useRef(null); 
  
  const canvasRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const { uploadImage } = useUser();
  const { showLoader, hideLoader } = useLoader();

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
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        setCanvasSize({ width: Math.round(w * dpr), height: Math.round(h * dpr) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const img = currentObject?.image;
    if (!img || img.complete) return;
    const bump = () => setCanvasSize((s) => ({ ...s }));
    img.addEventListener('load', bump, { once: true });
    return () => img.removeEventListener('load', bump);
  }, [currentObject]);

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
      const bg = editorState.customBackground;
      const bw = bg.naturalWidth || bg.width;
      const bh = bg.naturalHeight || bg.height;
      const cover = Math.max(canvas.width / bw, canvas.height / bh);
      const bgW = bw * cover * editorState.backgroundScale;
      const bgH = bh * cover * editorState.backgroundScale;
      const bgX = (canvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (canvas.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.drawImage(bg, bgX, bgY, bgW, bgH);
    } else if (editorState.backgroundColor) {
      ctx.fillStyle = editorState.backgroundColor;
      const bgW = canvas.width * editorState.backgroundScale;
      const bgH = canvas.height * editorState.backgroundScale;
      const bgX = (canvas.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (canvas.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    const fit = Math.min(canvas.width / currentObject.width, canvas.height / currentObject.height) * 0.7;
    const imgW = currentObject.width * fit * editorState.imageScale;
    const imgH = currentObject.height * fit * editorState.imageScale;
    const imgX = (canvas.width - imgW) / 2 + editorState.imagePos.x;
    const imgY = (canvas.height - imgH) / 2 + editorState.imagePos.y;

    let segBase = currentObject.image;
    if (loadedLUT) {
      const c = segLutBaseRef.current;
      if (!c || c.lut !== loadedLUT || c.img !== currentObject.image) {
        const off = document.createElement('canvas');
        off.width = currentObject.image.width;
        off.height = currentObject.image.height;
        const offCtx = off.getContext('2d', { willReadFrequently: true });
        offCtx.drawImage(currentObject.image, 0, 0);
        const data = offCtx.getImageData(0, 0, off.width, off.height);
        offCtx.putImageData(applyLUT(data, loadedLUT), 0, 0);
        segLutBaseRef.current = { canvas: off, lut: loadedLUT, img: currentObject.image };
      }
      segBase = segLutBaseRef.current.canvas;
    } else {
      segLutBaseRef.current = null;
    }

    const baseToken = loadedLUT ? segLutBaseRef.current : currentObject.image;
    const colourKey = `${editorState.brightness}|${editorState.contrast}|${editorState.saturation}|${editorState.hue}|${editorState.sharpen}`;
    const hasColour = colourKey !== '100|100|100|0|0';
    const pc = segProcessedRef.current;
    if (!pc || pc.base !== baseToken || pc.key !== colourKey) {
      let processed = segBase;
      if (hasColour) {
        const pcv = document.createElement('canvas');
        pcv.width = currentObject.image.width;
        pcv.height = currentObject.image.height;
        const pctx = pcv.getContext('2d');
        pctx.imageSmoothingEnabled = true;
        pctx.imageSmoothingQuality = 'high';
        let f = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) hue-rotate(${editorState.hue}deg)`;
        if (editorState.sharpen > 0) f += ` contrast(${100 + editorState.sharpen}%)`;
        pctx.filter = f;
        pctx.drawImage(segBase, 0, 0);
        processed = pcv;
      }
      segProcessedRef.current = { canvas: processed, base: baseToken, key: colourKey };
    }
    const source = segProcessedRef.current.canvas;

    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    if (editorState.flipH) ctx.scale(-1, 1);
    if (editorState.flipV) ctx.scale(1, -1);
    ctx.rotate((editorState.rotation * Math.PI) / 180);
    ctx.translate(-(imgW / 2), -(imgH / 2));
    const blurValue = Math.max(0, Math.min(20, editorState.blur || 0));
    ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : 'none';
    ctx.globalAlpha = editorState.opacity / 100;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
      ctx.drawImage(source, 0, 0, imgW, imgH);
    } catch (e) {
      console.error('Error drawing segment:', e);
    }

    ctx.restore();
  }, [currentObject, editorState, zoom, offset, canvasSize, viewMode, loadedLUT]);

  const flattenSegmentComposite = () => {
    const obj = currentObject;
    if (!obj?.image?.complete) return null;
    const out = document.createElement('canvas');
    out.width = canvasSize.width;
    out.height = canvasSize.height;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (editorState.customBackground && editorState.customBackground.complete) {
      const bg = editorState.customBackground;
      const bw = bg.naturalWidth || bg.width;
      const bh = bg.naturalHeight || bg.height;
      const cover = Math.max(out.width / bw, out.height / bh);
      const bgW = bw * cover * editorState.backgroundScale;
      const bgH = bh * cover * editorState.backgroundScale;
      const bgX = (out.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (out.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.drawImage(bg, bgX, bgY, bgW, bgH);
    } else if (editorState.backgroundColor) {
      ctx.fillStyle = editorState.backgroundColor;
      const bgW = out.width * editorState.backgroundScale;
      const bgH = out.height * editorState.backgroundScale;
      const bgX = (out.width - bgW) / 2 + editorState.backgroundPos.x;
      const bgY = (out.height - bgH) / 2 + editorState.backgroundPos.y;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    const source = segProcessedRef.current?.canvas || obj.image;
    const fit = Math.min(out.width / obj.width, out.height / obj.height) * 0.7;
    const imgW = obj.width * fit * editorState.imageScale;
    const imgH = obj.height * fit * editorState.imageScale;
    const imgX = (out.width - imgW) / 2 + editorState.imagePos.x;
    const imgY = (out.height - imgH) / 2 + editorState.imagePos.y;
    ctx.save();
    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    if (editorState.flipH) ctx.scale(-1, 1);
    if (editorState.flipV) ctx.scale(1, -1);
    ctx.rotate((editorState.rotation * Math.PI) / 180);
    ctx.translate(-(imgW / 2), -(imgH / 2));
    const blurValue = Math.max(0, Math.min(20, editorState.blur || 0));
    ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : 'none';
    ctx.globalAlpha = editorState.opacity / 100;
    ctx.drawImage(source, 0, 0, imgW, imgH);
    ctx.restore();
    return out;
  };

  const handleAICommand = async (prompt) => {
    if (!currentObject?.image) return false;
    showLoader('Applying AI edit…');
    try {
      const composite = flattenSegmentComposite();
      if (!composite) return false;
      const result = await qwenSmartEdit(composite, prompt);
      if (result.available === false) {
        addToast?.('AI editing isn’t available right now.', 'info');
        return false;
      }
      if (result.success && result.image_base64) {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error('Failed to load AI result'));
          im.src = result.image_base64;
        });
        const idx = selectedObjectIndex;
        const prevImg = currentObject.image;
        const prevBgColor = editorState.backgroundColor;
        const prevCustomBg = editorState.customBackground;
        execute(new Command(
          (s) => {
            const objs = [...s.editedObjects];
            objs[idx] = { ...objs[idx], image: img };
            return { ...s, editedObjects: objs, backgroundColor: null, customBackground: null };
          },
          (s) => {
            const objs = [...s.editedObjects];
            objs[idx] = { ...objs[idx], image: prevImg };
            return { ...s, editedObjects: objs, backgroundColor: prevBgColor, customBackground: prevCustomBg };
          },
        ));
        addToast?.('AI edit applied.', 'success');
        return true;
      }
      addToast?.('AI edit failed — please try again.', 'error');
      return false;
    } catch (error) {
      console.error('AI edit failed:', error);
      addToast?.('AI edit failed — is the backend running?', 'error');
      return false;
    } finally {
      hideLoader();
    }
  };

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

  const saveToLibrary = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isSaving) return;
    setIsSaving(true);
    showLoader('Saving to library…');
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Could not render the image');
      const formData = new FormData();
      formData.append('file', blob, `aurora_${Date.now()}.png`);
      await uploadImage(formData);
      addToast?.('Saved to your library.', 'success');
    } catch (error) {
      console.error('Save to library failed:', error);
    } finally {
      hideLoader();
      setIsSaving(false);
    }
  };

  const deleteObject = () => {
    if (editorState.editedObjects.length === 1) {
      addToast?.('Cannot delete the last object', 'info');
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

  const duplicateObject = () => {
    const nextId = editorState.editedObjects.reduce((m, o) => Math.max(m, o.id || 0), 0) + 1;
    const duplicate = {
      ...currentObject,
      id: nextId,
      name: `${currentObject.name} (Copy)`
    };
    execute(new Command(
      (s) => ({ ...s, editedObjects: [...s.editedObjects, duplicate] }),
      (s) => ({ ...s })
    ));
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
      let segSource = currentObj.image;
      if (loadedLUT) {
        const lc = document.createElement('canvas');
        lc.width = currentObj.image.width;
        lc.height = currentObj.image.height;
        const lctx = lc.getContext('2d', { willReadFrequently: true });
        lctx.drawImage(currentObj.image, 0, 0);
        const data = lctx.getImageData(0, 0, lc.width, lc.height);
        lctx.putImageData(applyLUT(data, loadedLUT), 0, 0);
        segSource = lc;
      }

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
      tempCtx.drawImage(segSource, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.restore();

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

  const hasBackground = !!(editorState.backgroundColor || editorState.customBackground);

  const canvasMetrics = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    return {
      rect,
      scale,
      padX: (rect.width - canvas.width * scale) / 2,
      padY: (rect.height - canvas.height * scale) / 2,
    };
  };
  const sampleSegmentAlpha = (natX, natY) => {
    const img = currentObject?.image;
    if (!img) return 0;
    let cache = hitCanvasRef.current;
    if (cache.img !== img) {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const cx = c.getContext('2d', { willReadFrequently: true });
      try {
        cx.drawImage(img, 0, 0);
      } catch {
        return 0;
      }
      cache = { img, ctx: cx, w: c.width, h: c.height };
      hitCanvasRef.current = cache;
    }
    if (natX < 0 || natY < 0 || natX >= cache.w || natY >= cache.h) return 0;
    try {
      return cache.ctx.getImageData(natX, natY, 1, 1).data[3];
    } catch {
      return 0;
    }
  };

  const pointerOnSegment = (clientX, clientY) => {
    const m = canvasMetrics();
    const canvas = canvasRef.current;
    const img = currentObject?.image;
    if (!m || !canvas || !img) return false;

    const bx = (clientX - m.rect.left - m.padX) / m.scale;
    const by = (clientY - m.rect.top - m.padY) / m.scale;
    const wx = (bx - offset.x) / zoom;
    const wy = (by - offset.y) / zoom;

    const fit = Math.min(canvas.width / currentObject.width, canvas.height / currentObject.height) * 0.7;
    const imgW = currentObject.width * fit * editorState.imageScale;
    const imgH = currentObject.height * fit * editorState.imageScale;
    const imgX = (canvas.width - imgW) / 2 + editorState.imagePos.x;
    const imgY = (canvas.height - imgH) / 2 + editorState.imagePos.y;

    let lx = wx - (imgX + imgW / 2);
    let ly = wy - (imgY + imgH / 2);
    if (editorState.flipH) lx = -lx;
    if (editorState.flipV) ly = -ly;
    const rad = (-editorState.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dispX = lx * cos - ly * sin + imgW / 2;
    const dispY = lx * sin + ly * cos + imgH / 2;
    if (dispX < 0 || dispY < 0 || dispX > imgW || dispY > imgH) return false;

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const natX = Math.floor((dispX / imgW) * natW);
    const natY = Math.floor((dispY / imgH) * natH);
    return sampleSegmentAlpha(natX, natY) > 16;
  };

  const handleCanvasDown = (clientX, clientY) => {
    dragModeRef.current = pointerOnSegment(clientX, clientY) ? 'segment' : 'background';
    handlePanStart(clientX, clientY, isDraggingRef, lastDragPosRef);
  };

  const handleCanvasMove = (clientX, clientY) => {
    if (!isDraggingRef.current) return;
    const mode = dragModeRef.current;

    if (mode === 'background' && !hasBackground) {
      handlePanMove(clientX, clientY, isDraggingRef, lastDragPosRef, setOffset);
      return;
    }

    const m = canvasMetrics();
    const bmpPerScreen = m ? 1 / m.scale : 1;
    const dx = ((clientX - lastDragPosRef.current.x) * bmpPerScreen) / zoom;
    const dy = ((clientY - lastDragPosRef.current.y) * bmpPerScreen) / zoom;
    lastDragPosRef.current = { x: clientX, y: clientY };

    const key = mode === 'segment' ? 'imagePos' : 'backgroundPos';
    execute(
      new Command(
        (s) => ({ ...s, [key]: { x: Math.round(s[key].x + dx), y: Math.round(s[key].y + dy) } }),
        (s) => ({ ...s }),
      ),
      true,
    );
  };

  const handleCanvasUp = () => handlePanEnd(isDraggingRef);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <SegmentHeader
        setShowEditor={setShowEditor}
        editedObjects={editorState.editedObjects}
        setViewMode={setViewMode}
        viewMode={viewMode}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onDone={saveAndExit}
        isSaving={isSaving}
      />

      {viewMode === 'gallery' ? (
        <GalleryView
          editedObjects={editorState.editedObjects}
          setSelectedObjectIndex={setSelectedObjectIndex}
          setViewMode={setViewMode}
          selectedObjectIndex={selectedObjectIndex}
          duplicateObject={duplicateObject}
          deleteObject={deleteObject}
        />
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink">
            <ZoomIn size={13} className="text-muted" />
            <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>

          <div
            className="h-full w-full p-3 pb-28"
            onWheel={(e) => handleWheel(e, setZoom, setOffset, canvasRef)}
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full object-contain"
              style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => handleCanvasDown(e.clientX, e.clientY)}
              onMouseMove={(e) => handleCanvasMove(e.clientX, e.clientY)}
              onMouseUp={handleCanvasUp}
              onMouseLeave={handleCanvasUp}
              onTouchStart={(e) => {
                const t = e.touches[0];
                handleCanvasDown(t.clientX, t.clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2) {
                  handleTouchMovePinch(e, lastDistanceRef, setZoom, setOffset, canvasRef);
                } else if (e.touches.length === 1) {
                  const t = e.touches[0];
                  handleCanvasMove(t.clientX, t.clientY);
                }
              }}
              onTouchEnd={() => {
                handleTouchEndPinch(lastDistanceRef);
                handleCanvasUp();
              }}
            />
          </div>

          {activePanel === 'adjust' && (
            <AdjustBar
              editorState={editorState}
              selectedEditOption={selectedEditOption}
              setSelectedEditOption={setSelectedEditOption}
              execute={execute}
              Command={Command}
              resetFilters={resetFilters}
              onClose={() => {
                setActivePanel(null);
                setSelectedEditOption(null);
              }}
            />
          )}

          {activePanel === 'filters' && (
            <LUTSlider
              uploadedImage={currentObject?.image}
              currentLUT={editorState.selectedLUT}
              onSelect={(lut) =>
                execute(
                  new Command(
                    (s) => ({ ...s, selectedLUT: lut }),
                    (s) => ({ ...s, selectedLUT: editorState.selectedLUT }),
                  ),
                )
              }
              onClose={() => setActivePanel(null)}
            />
          )}

          {activePanel === 'background' && (
            <BackgroundPanel
              editorState={editorState}
              execute={execute}
              backgroundInputRef={backgroundInputRef}
              handleCustomBackgroundUpload={handleCustomBackgroundUpload}
              onClose={() => setActivePanel(null)}
            />
          )}

          {activePanel === 'command' && (
            <div className="fixed inset-x-0 bottom-0 z-40 bg-black">
              <div className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-ink">AI &amp; commands</h3>
                  <button
                    onClick={() => setActivePanel(null)}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </div>
                <CommandInput
                  selectedObject={currentObject}
                  execute={execute}
                  editorState={editorState}
                  Command={Command}
                  addToast={addToast}
                  onAICommand={handleAICommand}
                />
              </div>
            </div>
          )}

          {!activePanel && (
            <div className="fixed inset-x-0 bottom-0 z-30 bg-black sm:pointer-events-none sm:bg-transparent">
              <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-around gap-1 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:mb-6 sm:w-fit sm:max-w-none sm:justify-center sm:gap-2 sm:rounded-3xl sm:border sm:border-line sm:bg-surface/95 sm:px-4 sm:py-2.5 sm:shadow-pop sm:backdrop-blur">
                <ToolButton icon={SlidersHorizontal} label="Adjust" onClick={() => setActivePanel('adjust')} />
                <ToolButton icon={Palette} label="Filters" onClick={() => setActivePanel('filters')} />
                <ToolButton icon={ImageIcon} label="Background" onClick={() => setActivePanel('background')} />
                <ToolButton icon={Sparkles} label="AI" onClick={() => setActivePanel('command')} />
                <ToolButton icon={Save} label="Save" onClick={saveToLibrary} />
                <ToolButton icon={Download} label="Download" onClick={downloadImage} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}