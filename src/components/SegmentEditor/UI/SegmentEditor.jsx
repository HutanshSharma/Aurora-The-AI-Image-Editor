import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Palette, Image as ImageIcon, Download, ZoomIn, Sparkles, X, Save, Eraser, MoreHorizontal } from "lucide-react";
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
import { blendSegment } from '../../MainEditor/Utils/segmentBlend';
import { cn } from '../../ui/cn';

export class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

function ToolButton({ icon: Icon, label, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-1.5 py-1 transition-colors active:scale-95 sm:w-[76px] sm:flex-none',
        active ? 'text-accent' : 'text-muted hover:text-ink',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full border transition-colors',
          active ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface-2 text-ink',
        )}
      >
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
  const [eraseMode, setEraseMode] = useState(false); // lasso eraser active
  const [showMore, setShowMore] = useState(false);   // mobile overflow menu
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
  const overlayRef = useRef(null);       // lasso preview overlay
  const erasePtsRef = useRef([]);        // in-progress loop points (screen coords)
  const isErasingRef = useRef(false);

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

  const flattenSegmentComposite = (blend = false) => {
    const obj = currentObject;
    if (!obj?.image?.complete) return null;

    const cw = canvasSize.width;
    const ch = canvasSize.height;
    const bgImg = editorState.customBackground?.complete ? editorState.customBackground : null;

    const fit = Math.min(cw / obj.width, ch / obj.height) * 0.7;
    const imgWvp = obj.width * fit * editorState.imageScale;
    const imgHvp = obj.height * fit * editorState.imageScale;
    const imgXvp = (cw - imgWvp) / 2 + editorState.imagePos.x;
    const imgYvp = (ch - imgHvp) / 2 + editorState.imagePos.y;

    let outW = cw;
    let outH = ch;
    let mapScale = 1;
    let mapOffX = 0;
    let mapOffY = 0;
    if (bgImg) {
      const bw = bgImg.naturalWidth || bgImg.width;
      const bh = bgImg.naturalHeight || bgImg.height;
      outW = bw;
      outH = bh;
      const coverV = Math.max(cw / bw, ch / bh) * editorState.backgroundScale;
      const bgXvp = (cw - bw * coverV) / 2 + editorState.backgroundPos.x;
      const bgYvp = (ch - bh * coverV) / 2 + editorState.backgroundPos.y;
      mapScale = 1 / coverV;          
      mapOffX = -bgXvp / coverV;     
      mapOffY = -bgYvp / coverV;
    } else {
      const nativeW = obj.image.naturalWidth || obj.image.width;
      const ideal = imgWvp > 0 ? nativeW / imgWvp : 1;
      const maxByDim = Math.max(1, 6000 / Math.max(cw, ch)); 
      mapScale = Math.max(1, Math.min(ideal, maxByDim));
      outW = cw * mapScale;
      outH = ch * mapScale;
    }

    const out = document.createElement('canvas');
    out.width = Math.round(outW);
    out.height = Math.round(outH);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, out.width, out.height);
    } else if (editorState.backgroundColor) {
      ctx.fillStyle = editorState.backgroundColor;
      const bgW = out.width * editorState.backgroundScale;
      const bgH = out.height * editorState.backgroundScale;
      const bgX = (out.width - bgW) / 2 + editorState.backgroundPos.x * mapScale;
      const bgY = (out.height - bgH) / 2 + editorState.backgroundPos.y * mapScale;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    let source = segProcessedRef.current?.canvas || obj.image;
    if (blend) {
      source = blendSegment(source, { bgImage: bgImg, harmonizeStrength: bgImg ? 0.4 : 0 });
    }

    const sw = imgWvp * mapScale;
    const sh = imgHvp * mapScale;
    const sx = imgXvp * mapScale + mapOffX;
    const sy = imgYvp * mapScale + mapOffY;

    ctx.save();
    ctx.translate(sx + sw / 2, sy + sh / 2);
    if (editorState.flipH) ctx.scale(-1, 1);
    if (editorState.flipV) ctx.scale(1, -1);
    ctx.rotate((editorState.rotation * Math.PI) / 180);
    ctx.translate(-(sw / 2), -(sh / 2));
    const blurValue = Math.max(0, Math.min(20, editorState.blur || 0)) * mapScale;
    ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : 'none';
    ctx.globalAlpha = editorState.opacity / 100;
    ctx.drawImage(source, 0, 0, sw, sh);
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
    const out = flattenSegmentComposite(true);
    if (!out) return;
    const link = document.createElement('a');
    link.download = `${currentObject?.name || 'aurora'}.png`;
    link.href = out.toDataURL('image/png', 1.0);
    link.click();
  };

  const saveToLibrary = async () => {
    if (isSaving) return;
    const out = flattenSegmentComposite(true);
    if (!out) return;
    setIsSaving(true);
    showLoader('Saving to library…');
    try {
      const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
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
      const hasBg = !!(editorState.backgroundColor || editorState.customBackground);
      const compositeCanvas = hasBg ? flattenSegmentComposite(true) : null;
      const compositeDataUrl = compositeCanvas ? compositeCanvas.toDataURL('image/png', 1.0) : null;

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

        await onSave?.(finalEditedObjects, { hasBackground: hasBg, compositeDataUrl });
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

  const screenToNative = (clientX, clientY) => {
    const m = canvasMetrics();
    const canvas = canvasRef.current;
    const img = currentObject?.image;
    if (!m || !canvas || !img) return null;

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

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    return {
      x: (dispX / imgW) * natW,
      y: (dispY / imgH) * natH,
      inside: dispX >= 0 && dispY >= 0 && dispX <= imgW && dispY <= imgH,
    };
  };

  const screenToCanvasInternal = (clientX, clientY) => {
    const m = canvasMetrics();
    if (!m) return null;
    return { x: (clientX - m.rect.left - m.padX) / m.scale, y: (clientY - m.rect.top - m.padY) / m.scale };
  };

  const pointerOnSegment = (clientX, clientY) => {
    const p = screenToNative(clientX, clientY);
    if (!p || !p.inside) return false;
    return sampleSegmentAlpha(Math.floor(p.x), Math.floor(p.y)) > 16;
  };

  const traceSmoothPath = (ctx, pts) => {
    if (pts.length < 2) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };

  const drawErasePreview = () => {
    const o = overlayRef.current;
    if (!o) return;
    const ctx = o.getContext('2d');
    ctx.clearRect(0, 0, o.width, o.height);
    const pts = erasePtsRef.current.map((p) => screenToCanvasInternal(p.clientX, p.clientY)).filter(Boolean);
    if (pts.length < 2) return;
    ctx.beginPath();
    traceSmoothPath(ctx, pts);
    ctx.fillStyle = 'rgba(244,63,94,0.18)';
    ctx.fill();
    ctx.closePath();
    ctx.strokeStyle = 'rgba(244,63,94,0.95)';
    ctx.lineWidth = 2 * (window.devicePixelRatio > 1 ? 2 : 1);
    ctx.setLineDash([8, 5]);
    ctx.stroke();
  };

  const cancelErase = () => {
    isErasingRef.current = false;
    erasePtsRef.current = [];
    const o = overlayRef.current;
    if (o) o.getContext('2d').clearRect(0, 0, o.width, o.height);
  };

  const commitErase = () => {
    const screenPts = erasePtsRef.current;
    cancelErase();
    if (screenPts.length < 3) return;
    const obj = currentObject;
    const img = obj?.image;
    if (!img) return;
    const natPts = screenPts.map((p) => screenToNative(p.clientX, p.clientY)).filter(Boolean);
    if (natPts.length < 3) return;

    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;

    const seg = document.createElement('canvas');
    seg.width = W; seg.height = H;
    const sctx = seg.getContext('2d');
    sctx.drawImage(img, 0, 0);

    const mask = document.createElement('canvas');
    mask.width = W; mask.height = H;
    const mctx = mask.getContext('2d');
    const feather = Math.min(2, Math.max(0.6, Math.min(W, H) * 0.0015));
    mctx.filter = `blur(${feather}px)`;
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    traceSmoothPath(mctx, natPts);
    mctx.closePath();
    mctx.fill();

    sctx.globalCompositeOperation = 'destination-out';
    sctx.drawImage(mask, 0, 0);

    const idx = selectedObjectIndex;
    const newImg = new Image();
    newImg.onload = () => {
      execute(new Command(
        (s) => ({ ...s, editedObjects: s.editedObjects.map((o2, i) => (i === idx ? { ...o2, image: newImg } : o2)) }),
        (s) => ({ ...s }),
      ));
    };
    newImg.src = seg.toDataURL('image/png', 1.0);
  };

  const handleCanvasDown = (clientX, clientY) => {
    if (eraseMode) {
      isErasingRef.current = true;
      erasePtsRef.current = [{ clientX, clientY }];
      drawErasePreview();
      return;
    }
    dragModeRef.current = pointerOnSegment(clientX, clientY) ? 'segment' : 'background';
    handlePanStart(clientX, clientY, isDraggingRef, lastDragPosRef);
  };

  const handleCanvasMove = (clientX, clientY) => {
    if (eraseMode) {
      if (!isErasingRef.current) return;
      erasePtsRef.current.push({ clientX, clientY });
      drawErasePreview();
      return;
    }
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

  const handleCanvasUp = () => {
    if (eraseMode) { commitErase(); return; }
    handlePanEnd(isDraggingRef);
  };

  useEffect(() => {
    const o = overlayRef.current;
    if (o) { o.width = canvasSize.width; o.height = canvasSize.height; }
  }, [canvasSize, eraseMode]);

  useEffect(() => { if (!eraseMode) cancelErase(); }, [eraseMode]);

  const openPanel = (p) => { setEraseMode(false); setShowMore(false); setActivePanel(p); };

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

          {eraseMode && (
            <div className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink shadow-pop">
              <Eraser size={13} className="text-accent" />
              <span className="hidden sm:inline">Draw a loop around the part to remove</span>
              <span className="sm:hidden">Loop to remove</span>
              <button
                onClick={() => setEraseMode(false)}
                className="ml-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          )}

          <div
            className="h-full w-full p-3 pb-28"
            onWheel={(e) => handleWheel(e, setZoom, setOffset, canvasRef)}
            style={{ touchAction: 'none' }}
          >
            <div
              className="relative h-full w-full"
              style={{ cursor: eraseMode ? 'crosshair' : isDraggingRef.current ? 'grabbing' : 'grab' }}
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
                  if (eraseMode) cancelErase();
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
            >
              <canvas ref={canvasRef} className="pointer-events-none h-full w-full object-contain" />
              {eraseMode && (
                <canvas
                  ref={overlayRef}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
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
              {/* Mobile: core tools + a "More" overflow menu for export actions */}
              <div className="pointer-events-auto relative mx-auto flex max-w-3xl items-center justify-around gap-1 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:hidden">
                <ToolButton icon={SlidersHorizontal} label="Adjust" onClick={() => openPanel('adjust')} />
                <ToolButton icon={Palette} label="Filters" onClick={() => openPanel('filters')} />
                <ToolButton icon={ImageIcon} label="Background" onClick={() => openPanel('background')} />
                <ToolButton icon={Eraser} label="Erase" active={eraseMode} onClick={() => { setActivePanel(null); setShowMore(false); setEraseMode((v) => !v); }} />
                <ToolButton icon={Sparkles} label="AI" onClick={() => openPanel('command')} />
                <ToolButton icon={MoreHorizontal} label="More" onClick={() => setShowMore((v) => !v)} />
                {showMore && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />
                    <div className="absolute bottom-full right-2 z-20 mb-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-pop">
                      <button
                        onClick={() => { setShowMore(false); saveToLibrary(); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-ink transition-colors hover:bg-surface-3"
                      >
                        <Save size={16} className="text-muted" /> Save to library
                      </button>
                      <button
                        onClick={() => { setShowMore(false); downloadImage(); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-ink transition-colors hover:bg-surface-3"
                      >
                        <Download size={16} className="text-muted" /> Download
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="pointer-events-auto mx-auto mb-6 hidden w-fit items-center justify-center gap-2 rounded-3xl border border-line bg-surface/95 px-4 py-2.5 shadow-pop backdrop-blur sm:flex">
                <ToolButton icon={SlidersHorizontal} label="Adjust" onClick={() => openPanel('adjust')} />
                <ToolButton icon={Palette} label="Filters" onClick={() => openPanel('filters')} />
                <ToolButton icon={ImageIcon} label="Background" onClick={() => openPanel('background')} />
                <ToolButton icon={Eraser} label="Erase" active={eraseMode} onClick={() => { setActivePanel(null); setEraseMode((v) => !v); }} />
                <ToolButton icon={Sparkles} label="AI" onClick={() => openPanel('command')} />
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