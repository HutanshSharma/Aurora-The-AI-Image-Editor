import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Hand, MousePointerClick, X, Trash2, LayoutGrid, Check } from "lucide-react";
import { handleTouchEndPinch, handlePanStart, handlePanEnd, startLongPress , clearLongPress, maybeCancelLongPressOnMove, handleObjectDrop, handleObjectDrag, startDragPress} from "../Utils/CanvasUtils";
import { applyLUT } from "../Utils/LUTUtils";
import PixelCard from "./PixelCard";
import { getSegmentAtPoint, extractSegment } from "../Utils/SegmentationAPI";
import { cn } from "../../ui/cn";
import { useLoader } from "../../../store/LoaderContext";

const withTimeout = (promise, ms = 30000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
  ]);

export default function Canvas({
  setShowDropBox,
  uploadedImage,
  objects,
  selectedObject,
  setObjects,
  setSelectedObject,
  onObjectDropped,
  editorState,
  loadedLUT,
  isSegmenting,
  segmentationImageId,
  mergedSegments = [],
  onZoomChange,
  onDrawn,
  addToast,
  onSegment,
  registerFlatten,
}) {
  const { showLoader, hideLoader } = useLoader();
  const canvasRef = useRef(null);
  const lastDistanceRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startPressPosRef = useRef(null);
  const isLongPressActiveRef = useRef(false);
  
  const lutBaseRef = useRef(null); 
  const processedRef = useRef(null); 
  const imageBoundsRef = useRef(null);
  const tintedOverlayCacheRef = useRef(new WeakMap());
  const onDrawnRef = useRef(onDrawn);
  onDrawnRef.current = onDrawn;
  const segPreviewCacheRef = useRef({ lut: undefined, map: new Map() });

  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [draggingObjectId, setDraggingObjectId] = useState(null);
  const [pressProgress, setPressProgress] = useState(0);
  const [pressPos, setPressPos] = useState(null);

  const [dragClientPos, setDragClientPos] = useState(null);

  const [imageBounds, setImageBounds] = useState(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drawRef = useRef(null);
  const drawScheduledRef = useRef(false);
  const commitTimerRef = useRef(null);

  const scheduleDraw = useCallback(() => {
    if (drawScheduledRef.current) return;
    drawScheduledRef.current = true;
    requestAnimationFrame(() => {
      drawScheduledRef.current = false;
      drawRef.current?.();
    });
  }, []);

  const commitView = useCallback(() => {
    clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      setZoom(zoomRef.current);
      setOffset(offsetRef.current);
    }, 120);
  }, []);

  const applyZoom = useCallback((delta, focusX, focusY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prev = zoomRef.current;
    const next = Math.min(6, Math.max(0.5, prev + delta));
    if (next === prev) return;
    const rect = canvas.getBoundingClientRect();
    const fcx = (focusX - rect.left) * (canvas.width / rect.width);
    const fcy = (focusY - rect.top) * (canvas.height / rect.height);
    const k = next / prev;
    let nx = fcx - k * (fcx - offsetRef.current.x);
    let ny = fcy - k * (fcy - offsetRef.current.y);
    if (next === 1) { nx = 0; ny = 0; }
    zoomRef.current = next;
    offsetRef.current = { x: nx, y: ny };
    scheduleDraw();
    commitView();
  }, [scheduleDraw, commitView]);

  const panBy = useCallback((dx, dy) => {
    offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
    scheduleDraw();
    commitView();
  }, [scheduleDraw, commitView]);

  const panMove = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - lastDragPosRef.current.x;
    const dy = clientY - lastDragPosRef.current.y;
    lastDragPosRef.current = { x: clientX, y: clientY };
    panBy(dx, dy);
  }, [panBy]);

  useEffect(() => {
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [segmentOverlays, setSegmentOverlays] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [segmentPreviews, setSegmentPreviews] = useState({});  
  const [pickedSegments, setPickedSegments] = useState(() => new Set()); 
  const [segmentingDots, setSegmentingDots] = useState('');

  const dragLatestRef = useRef({});
  dragLatestRef.current = {
    objects, isDraggingObject, draggingObjectId, dragClientPos, onObjectDropped,
  };

  const LONG_PRESS_DURATION = 600;
  const MOVE_CANCEL_THRESHOLD = 10; 

  const handleSegmentSelect = async (x, y, clientX, clientY) => {
    if (!segmentationImageId || !uploadedImage || !imageBounds) return;
    
    try {
      const canvas = canvasRef.current;
      const scale = Math.min(
        canvas.width / uploadedImage.width,
        canvas.height / uploadedImage.height
      );
      
      const imgWidth = uploadedImage.width * scale;
      const imgHeight = uploadedImage.height * scale;
      const imgX = (canvas.width - imgWidth) / 2;
      const imgY = (canvas.height - imgHeight) / 2;
      
      if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
        isLongPressActiveRef.current = false;
        return;
      }
      
      const imageX = Math.round((x - imgX) / scale);
      const imageY = Math.round((y - imgY) / scale);

      showLoader('Extracting object…');
      const result = await withTimeout(getSegmentAtPoint(segmentationImageId, imageX, imageY));

      if (result.has_segment && result.segment_index !== undefined) {
        const alreadySelected = selectedSegments.some(s => s.index === result.segment_index);

        if (alreadySelected) {
          await dragSegments(selectedSegments, scale, clientX, clientY, imgX, imgY, imgWidth, imgHeight);
        } else {
          const extractedResult = await withTimeout(extractSegment(segmentationImageId, result.segment_index));

          if (extractedResult.object_base64) {
            setSelectedSegments(prev => [...prev, {
              index: result.segment_index,
              object: extractedResult.object_base64
            }]);
            
            const img = new Image();
            img.src = extractedResult.object_base64;
            img.onload = () => {
              const segmentWidth = uploadedImage.width * scale;
              const segmentHeight = uploadedImage.height * scale;
              
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
      }
    } catch (error) {
      console.error('Failed to select and extract segment:', error);
      addToast?.('Could not extract that object — please try again.', 'error');
    } finally {
      hideLoader();
      isLongPressActiveRef.current = false;
    }
  };

  const dragSegments = async (segments, scale, clientX, clientY, imgX, imgY, imgWidth, imgHeight) => {
    try {
      if (!segments || segments.length === 0) return;
      const canvas = document.createElement('canvas');
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      for (const segment of segments) {
        const segImg = new Image();
        segImg.src = segment.object;
        await new Promise(resolve => {
          segImg.onload = () => {
            ctx.drawImage(segImg, 0, 0);
            resolve();
          };
        });
      }
      if (loadedLUT) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.putImageData(applyLUT(data, loadedLUT), 0, 0);
      }
      let outCanvas = canvas;
      const es = editorState || {};
      const hasAdjust =
        (es.brightness ?? 100) !== 100 || (es.contrast ?? 100) !== 100 ||
        (es.saturation ?? 100) !== 100 || (es.blur || 0) > 0 ||
        (es.hue || 0) !== 0 || (es.sharpen || 0) > 0;
      if (hasAdjust) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = canvas.width;
        outCanvas.height = canvas.height;
        const octx = outCanvas.getContext('2d');
        const blurValue = Math.max(0, Math.min(20, es.blur || 0));
        let f = `brightness(${es.brightness || 100}%) contrast(${es.contrast || 100}%) saturate(${es.saturation || 100}%)`;
        if (blurValue > 0) f += ` blur(${blurValue}px)`;
        f += ` hue-rotate(${es.hue || 0}deg)`;
        if ((es.sharpen || 0) > 0) f += ` contrast(${100 + (es.sharpen || 0)}%)`;
        if ('filter' in octx) octx.filter = f;
        octx.drawImage(canvas, 0, 0);
      }

      const combinedBase64 = outCanvas.toDataURL('image/png');
      
      const img = new Image();
      img.src = combinedBase64;
      
      img.onload = () => {
        const scaleFactor = scale * 0.6;
        const scaledWidth = img.width * scaleFactor;
        const scaledHeight = img.height * scaleFactor;
        const centerX = imgX + imgWidth / 2;
        const centerY = imgY + imgHeight / 2;
        
        const objCanvasX = centerX - scaledWidth / 2;
        const objCanvasY = centerY - scaledHeight / 2;
        const normalizedX = 0;
        const normalizedY = 0;
        const normalizedWidth = 1.0;
        const normalizedHeight = 1.0;
        
        const newObject = {
          id: Date.now(),
          image: img,
          x: objCanvasX,
          y: objCanvasY,
          width: scaledWidth,
          height: scaledHeight,
          isSegmentedObject: true,
          normalizedX,
          normalizedY,
          normalizedWidth,
          normalizedHeight,
          displayScaleFactor: scaleFactor,
        };
        
        setObjects(prev => [...prev, newObject]);
        setSelectedObject(newObject);
        setIsDraggingObject(true);
        setDraggingObjectId(newObject.id);
        setShowDropBox(true);
        setDragClientPos({ x: clientX, y: clientY });
        const usedIdx = new Set(segments.map((s) => s.index));
        setSelectedSegments((prev) => prev.filter((s) => !usedIdx.has(s.index)));
        setSegmentOverlays((prev) => prev.filter((o) => !usedIdx.has(o.id)));
        setShowGallery(false);
      };
    } catch (error) {
      console.error('Failed to drag segments:', error);
    }
  };

  const getDropMetrics = () => {
    const canvas = canvasRef.current;
    const scale = Math.min(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height);
    const imgWidth = uploadedImage.width * scale;
    const imgHeight = uploadedImage.height * scale;
    const imgX = (canvas.width - imgWidth) / 2;
    const imgY = (canvas.height - imgHeight) / 2;
    return { scale, imgX, imgY, imgWidth, imgHeight };
  };

  const flattenComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedImage) return null;
    const W = canvas.width;
    const H = canvas.height;
    const scale = Math.min(W / uploadedImage.width, H / uploadedImage.height);
    const imgWidth = uploadedImage.width * scale;
    const imgHeight = uploadedImage.height * scale;
    const imgX = (W - imgWidth) / 2;
    const imgY = (H - imgHeight) / 2;

    const temp = document.createElement('canvas');
    temp.width = W;
    temp.height = H;
    const ctx = temp.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const source = processedRef.current?.canvas || uploadedImage;
    const blurValue = Math.max(0, Math.min(20, editorState?.blur || 0));
    ctx.save();
    ctx.translate(imgX + imgWidth / 2, imgY + imgHeight / 2);
    if (editorState?.flipH) ctx.scale(-1, 1);
    if (editorState?.flipV) ctx.scale(1, -1);
    ctx.rotate(((editorState?.rotation || 0) * Math.PI) / 180);
    ctx.translate(-(imgWidth / 2), -(imgHeight / 2));
    if ('filter' in ctx) ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : 'none';
    ctx.globalAlpha = (editorState?.opacity || 100) / 100;
    ctx.drawImage(source, 0, 0, imgWidth, imgHeight);
    ctx.restore();

    if (mergedSegments && mergedSegments.length > 0) {
      mergedSegments.forEach((segment) => {
        if (segment.image && segment.image.complete &&
            segment.normalizedX !== undefined && segment.normalizedY !== undefined) {
          ctx.drawImage(
            segment.image,
            imgX + segment.normalizedX * imgWidth,
            imgY + segment.normalizedY * imgHeight,
            segment.normalizedWidth * imgWidth,
            segment.normalizedHeight * imgHeight,
          );
        }
      });
    }

    objects.forEach((obj) => {
      if (obj.image && obj.image.complete) {
        ctx.drawImage(obj.image, obj.x, obj.y, obj.width, obj.height);
      }
    });

    const out = document.createElement('canvas');
    out.width = uploadedImage.width;
    out.height = uploadedImage.height;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(temp, imgX, imgY, imgWidth, imgHeight, 0, 0, out.width, out.height);
    return out;
  }, [uploadedImage, editorState, mergedSegments, objects]);

  useEffect(() => {
    registerFlatten?.(flattenComposite);
  }, [registerFlatten, flattenComposite]);

  useEffect(() => {
    let cancelled = false;
    if (selectedSegments.length === 0) {
      setSegmentPreviews({});
      return;
    }
    if (segPreviewCacheRef.current.lut !== loadedLUT) {
      segPreviewCacheRef.current = { lut: loadedLUT, map: new Map() };
    }
    const cache = segPreviewCacheRef.current.map;
    (async () => {
      const out = {};
      for (const seg of selectedSegments) {
        if (cancelled) return;
        if (cache.has(seg.index)) {
          out[seg.index] = cache.get(seg.index);
          continue;
        }
        if (!loadedLUT) {
          cache.set(seg.index, seg.object);
          out[seg.index] = seg.object;
          continue;
        }
        const im = await new Promise((res) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => res(null);
          i.src = seg.object;
        });
        if (!im) {
          out[seg.index] = seg.object;
          continue;
        }
        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(im, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height);
        cx.putImageData(applyLUT(data, loadedLUT), 0, 0);
        const url = c.toDataURL('image/png');
        cache.set(seg.index, url);
        out[seg.index] = url;
      }
      if (!cancelled) setSegmentPreviews(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSegments, loadedLUT]);

  const removeSegment = (segmentIndex) => {
    setSelectedSegments(prev => prev.filter(s => s.index !== segmentIndex));
    setSegmentOverlays(prev => prev.filter(o => o.id !== segmentIndex));
  };

  useEffect(() => {
    let interval;
    
    if (isSegmenting) {
      setSegmentingDots('');
      interval = setInterval(() => {
        setSegmentingDots(prev => {
          if (prev.length >= 3) {
            return '';
          }
          return prev + '.';
        });
      }, 500);
    } else {
      setSegmentingDots('');
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSegmenting]);

  useEffect(() => {
    if (!segmentationImageId) {
      setSelectedSegments([]);
      setSegmentOverlays([]);
      setPickedSegments(new Set());
      setShowGallery(false);
      setIsSelectMode(false);
    }
  }, [segmentationImageId]);

  useEffect(() => {
    const preventBrowserZoom = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const preventGestures = (e) => e.preventDefault();

    window.addEventListener("wheel", preventBrowserZoom, { passive: false });
    window.addEventListener("gesturestart", preventGestures);
    window.addEventListener("gesturechange", preventGestures);
    window.addEventListener("gestureend", preventGestures);

    return () => {
      window.removeEventListener("wheel", preventBrowserZoom);
      window.removeEventListener("gesturestart", preventGestures);
      window.removeEventListener("gesturechange", preventGestures);
      window.removeEventListener("gestureend", preventGestures);
    };
  }, []);

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      const { isDraggingObject, draggingObjectId } = dragLatestRef.current;
      if (isDraggingObject) {
        e.preventDefault();
        handleObjectDrag(e.clientX, e.clientY, offsetRef.current, zoomRef.current, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
      } else if (isDraggingRef.current) {
        panMove(e.clientX, e.clientY);
      }
    };
    const handleWindowMouseUp = (e) => {
      const { isDraggingObject, draggingObjectId, objects, onObjectDropped } = dragLatestRef.current;
      if (isDraggingObject) {
        handleObjectDrop(e.clientX, e.clientY, draggingObjectId, isDraggingObject, objects,
        setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped);
      }
      if (isDraggingRef.current) {
        handlePanEnd(isDraggingRef);
      }
      clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [setObjects, setSelectedObject, setShowDropBox, panMove]);

  useEffect(() => {
    const handleWindowTouchMove = (e) => {
      const { isDraggingObject, draggingObjectId } = dragLatestRef.current;
      if (isDraggingObject && e.touches && e.touches[0]) {
        const t = e.touches[0];
        handleObjectDrag(t.clientX, t.clientY, offsetRef.current, zoomRef.current, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
      }
    };
    const handleWindowTouchEnd = (e) => {
      const { isDraggingObject, draggingObjectId, objects, dragClientPos, onObjectDropped } = dragLatestRef.current;
      if (isDraggingObject) {
        const last = e.changedTouches && e.changedTouches[0];
        if (last) handleObjectDrop(last.clientX, last.clientY, draggingObjectId, isDraggingObject, objects,
          setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped);
        else if (dragClientPos) handleObjectDrop(dragClientPos.x, dragClientPos.y, draggingObjectId, isDraggingObject, objects,
                                                    setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped);
      }
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);
    window.addEventListener("touchcancel", handleWindowTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
      window.removeEventListener("touchcancel", handleWindowTouchEnd);
    };
  }, [setObjects, setSelectedObject, setShowDropBox]);

  const draw = () => {
    if (!canvasRef.current || !uploadedImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(zoomRef.current, 0, 0, zoomRef.current, offsetRef.current.x, offsetRef.current.y);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const scale = Math.min(W / uploadedImage.width, H / uploadedImage.height);
    const imgWidth = uploadedImage.width * scale;
    const imgHeight = uploadedImage.height * scale;
    const imgX = (W - imgWidth) / 2;
    const imgY = (H - imgHeight) / 2;
    const pb = imageBoundsRef.current;
    if (!pb || pb.x !== imgX || pb.y !== imgY || pb.width !== imgWidth || pb.height !== imgHeight) {
      const b = { x: imgX, y: imgY, width: imgWidth, height: imgHeight };
      imageBoundsRef.current = b;
      setImageBounds(b);
    }

    let lutBase = uploadedImage;
    if (loadedLUT) {
      const c = lutBaseRef.current;
      if (!c || c.lut !== loadedLUT || c.img !== uploadedImage) {
        const off = document.createElement('canvas');
        off.width = uploadedImage.width;
        off.height = uploadedImage.height;
        const offCtx = off.getContext('2d', { willReadFrequently: true });
        offCtx.drawImage(uploadedImage, 0, 0);
        const data = offCtx.getImageData(0, 0, off.width, off.height);
        offCtx.putImageData(applyLUT(data, loadedLUT), 0, 0);
        lutBaseRef.current = { canvas: off, lut: loadedLUT, img: uploadedImage };
      }
      lutBase = lutBaseRef.current.canvas;
    } else {
      lutBaseRef.current = null;
    }

    const baseToken = loadedLUT ? lutBaseRef.current : uploadedImage;
    const bright = editorState?.brightness || 100;
    const contr = editorState?.contrast || 100;
    const sat = editorState?.saturation || 100;
    const hue = editorState?.hue || 0;
    const sharpen = editorState?.sharpen || 0;
    const filterKey = `${bright}|${contr}|${sat}|${hue}|${sharpen}`;
    const hasColour = filterKey !== '100|100|100|0|0';

    const pcache = processedRef.current;
    if (!pcache || pcache.base !== baseToken || pcache.key !== filterKey) {
      let processed = lutBase;
      if (hasColour) {
        const pc = document.createElement('canvas');
        pc.width = uploadedImage.width;
        pc.height = uploadedImage.height;
        const pctx = pc.getContext('2d');
        pctx.imageSmoothingEnabled = true;
        pctx.imageSmoothingQuality = 'high';
        let f = `brightness(${bright}%) contrast(${contr}%) saturate(${sat}%) hue-rotate(${hue}deg)`;
        if (sharpen > 0) f += ` contrast(${100 + sharpen}%)`;
        if ('filter' in pctx) pctx.filter = f;
        pctx.drawImage(lutBase, 0, 0);
        processed = pc;
      }
      processedRef.current = { canvas: processed, base: baseToken, key: filterKey };
    }
    const source = processedRef.current.canvas;

    const blurValue = Math.max(0, Math.min(20, editorState?.blur || 0));
    ctx.save();
    ctx.translate(imgX + imgWidth / 2, imgY + imgHeight / 2);
    if (editorState?.flipH) ctx.scale(-1, 1);
    if (editorState?.flipV) ctx.scale(1, -1);
    ctx.rotate(((editorState?.rotation || 0) * Math.PI) / 180);
    ctx.translate(-(imgWidth / 2), -(imgHeight / 2));
    if ('filter' in ctx) ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : 'none';
    ctx.globalAlpha = (editorState?.opacity || 100) / 100;
    ctx.drawImage(source, 0, 0, imgWidth, imgHeight);
    ctx.restore();
    if (mergedSegments && mergedSegments.length > 0) {
      mergedSegments.forEach((segment) => {
        if (segment.image && segment.image.complete && 
            segment.normalizedX !== undefined && 
            segment.normalizedY !== undefined) {
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

    objects.forEach((obj) => {
      if (isDraggingObject && obj.id === draggingObjectId) return;
      if (obj.image && obj.image.complete) {
        ctx.drawImage(obj.image, obj.x, obj.y, obj.width, obj.height);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      }

      ctx.strokeStyle = selectedObject?.id === obj.id ? "#3b82f6" : "#10b981";
      ctx.lineWidth = 3 / zoomRef.current;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      ctx.setLineDash([]);

      ctx.fillStyle =
        selectedObject?.id === obj.id
          ? "rgba(59,130,246,0.8)"
          : "rgba(16,185,129,0.6)";
      ctx.fillRect(obj.x, obj.y - 25, 80, 20);

      ctx.fillStyle = "white";
      ctx.font = "12px sans-serif";
      ctx.fillText(obj.name, obj.x + 5, obj.y - 10);
    });

    segmentOverlays.forEach((overlay) => {
      if (!overlay.image || !overlay.image.complete) return;
      const cache = tintedOverlayCacheRef.current;
      let tinted = cache.get(overlay.image);
      if (!tinted || tinted.width !== overlay.width || tinted.height !== overlay.height) {
        tinted = document.createElement('canvas');
        tinted.width = overlay.width;
        tinted.height = overlay.height;
        const tctx = tinted.getContext('2d');
        tctx.drawImage(overlay.image, 0, 0, overlay.width, overlay.height);
        tctx.globalCompositeOperation = 'multiply';
        tctx.fillStyle = '#3b82f6';
        tctx.fillRect(0, 0, overlay.width, overlay.height);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(overlay.image, 0, 0, overlay.width, overlay.height);
        cache.set(overlay.image, tinted);
      }
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(tinted, overlay.x, overlay.y);
      ctx.restore();
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    onDrawnRef.current?.();
  };
  drawRef.current = draw;

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImage, objects, selectedObject, editorState, loadedLUT, segmentOverlays, mergedSegments, isDraggingObject, draggingObjectId]);
  const previewFilter = useMemo(() => {
    const e = editorState || {};
    let f = `brightness(${e.brightness || 100}%) contrast(${e.contrast || 100}%) saturate(${e.saturation || 100}%) hue-rotate(${e.hue || 0}deg)`;
    if ((e.sharpen || 0) > 0) f += ` contrast(${100 + e.sharpen}%)`;
    if ((e.blur || 0) > 0) f += ` blur(${Math.min(e.blur, 20) / 5}px)`;
    return f;
  }, [editorState]);

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center bg-black overflow-hidden touch-none select-none"
      onWheel={(e) => { if (e.ctrlKey || e.metaKey) applyZoom(e.deltaY > 0 ? -0.1 : 0.1, e.clientX, e.clientY); }}
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      {pressPos && (
        <div
          className="absolute z-30 pointer-events-none transition-opacity duration-150"
          style={{
            top: pressPos.y - 25,
            left: pressPos.x - 25,
            width: 50,
            height: 50,
          }}
        >
          <svg className="w-full h-full">
            <circle
              cx="25"
              cy="25"
              r="20"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="25"
              cy="25"
              r="20"
              stroke="#3b82f6"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${(2 * Math.PI * 20 * pressProgress) / 100}, ${
                2 * Math.PI * 20
              }`}
              transform="rotate(-90 25 25)"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {isDraggingObject && draggingObjectId && dragClientPos && (() => {
        const obj = objects.find((o) => o.id === draggingObjectId);
        if (!obj) return null;
        const SIZE = 104;
        return (
          <div
            className="pointer-events-none fixed animate-[dragPop_0.16s_ease-out]"
            style={{ top: dragClientPos.y - SIZE / 2, left: dragClientPos.x - SIZE / 2, width: SIZE, height: SIZE, zIndex: 9999 }}
          >
            <div className="flex h-full w-full -rotate-3 items-center justify-center rounded-2xl border border-accent/60 bg-surface-2/70 p-2 shadow-pop backdrop-blur-md">
              <img
                src={obj.image?.src}
                alt={obj.name}
                className="max-h-full max-w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                draggable={false}
              />
            </div>
          </div>
        );
      })()}

      {isSegmenting && uploadedImage && imageBounds && (
        <>
          <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 rounded-full border border-line glass px-5 py-2.5 shadow-pop">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <p className="text-[15px] font-semibold tracking-wide text-ink">
                Segmenting{segmentingDots}
              </p>
            </div>
          </div>
          <PixelCard 
            variant="blue"
            imageBounds={imageBounds}
            canvasRef={canvasRef}
            zoom={zoom}
            offset={offset}
          />
        </>
      )}
      {uploadedImage && (
        <div className="absolute top-24 right-4 z-20 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => {
              const next = !isSelectMode;
              setIsSelectMode(next);
              if (next && !segmentationImageId && !isSegmenting) onSegment?.();
            }}
            className={cn(
              'flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95',
              isSelectMode
                ? 'border-accent/50 bg-accent-soft text-ink shadow-glow'
                : 'border-line glass text-ink hover:bg-white/5',
            )}
          >
            {isSelectMode ? (
              <>
                <MousePointerClick size={18} className="text-accent" />
                Select{selectedSegments.length > 0 && ` (${selectedSegments.length})`}
              </>
            ) : (
              <>
                <Hand size={18} className="text-muted" />
                Pan
              </>
            )}
          </button>

          {selectedSegments.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowGallery((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95',
                  showGallery ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line glass text-ink hover:bg-white/5',
                )}
              >
                <LayoutGrid size={16} />
                Gallery ({selectedSegments.length})
              </button>

              {showGallery && (
                <div className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top-right animate-[dragPop_0.14s_ease-out] overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-pop">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-ink">Tap to choose</p>
                    <button
                      onClick={() => {
                        setShowGallery(false);
                        setPickedSegments(new Set());
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="max-h-72 space-y-1.5 overflow-y-auto scrollbar-slim p-2">
                    {selectedSegments.map((segment, index) => {
                      const isPicked = pickedSegments.has(segment.index);
                      return (
                        <div
                          key={segment.index}
                          onClick={() =>
                            setPickedSegments((s) => {
                              const n = new Set(s);
                              if (n.has(segment.index)) n.delete(segment.index);
                              else n.add(segment.index);
                              return n;
                            })
                          }
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border p-2 transition-all',
                            isPicked ? 'border-accent bg-accent-soft ring-1 ring-accent/40' : 'border-line bg-surface hover:bg-surface-3',
                          )}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-3">
                            <img
                              src={segmentPreviews[segment.index] || segment.object}
                              alt={`Segment ${index + 1}`}
                              className="max-h-full max-w-full object-contain"
                              style={{ filter: previewFilter }}
                              draggable={false}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-ink">Segment {index + 1}</p>
                            <p className={cn('text-[12px]', isPicked ? 'text-accent' : 'text-muted')}>
                              {isPicked ? 'Selected' : 'Tap to select'}
                            </p>
                          </div>
                          {isPicked && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSegment(segment.index);
                              setPickedSegments((s) => {
                                const n = new Set(s);
                                n.delete(segment.index);
                                return n;
                              });
                            }}
                            title="Remove from selection"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/15 hover:text-danger"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {pickedSegments.size > 0 && (
                    <div className="border-t border-line p-2">
                      <button
                        onClick={(e) => {
                          const picked = selectedSegments.filter((s) => pickedSegments.has(s.index));
                          const m = getDropMetrics();
                          dragSegments(picked, m.scale, e.clientX, e.clientY, m.imgX, m.imgY, m.imgWidth, m.imgHeight);
                          setPickedSegments(new Set());
                        }}
                        className="w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-95"
                      >
                        {pickedSegments.size === 1 ? 'Select' : `Combine (${pickedSegments.size})`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedSegments.length > 0 && (
            <button
              onClick={() => {
                setSelectedSegments([]);
                setSegmentOverlays([]);
                setPickedSegments(new Set());
              }}
              className="rounded-2xl border border-danger/40 bg-danger/15 px-4 py-2.5 text-sm font-semibold text-danger transition-all duration-200 hover:bg-danger/25 active:scale-95"
            >
              Clear ({selectedSegments.length})
            </button>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-grab"
        onTouchStart={(e) => {
          const t = e.touches[0];
          startLongPress(t.clientX, t.clientY, offsetRef.current, zoomRef.current, canvasRef, objects, startPressPosRef,
            setPressPos, setPressProgress, progressIntervalRef, LONG_PRESS_DURATION, longPressTimerRef, setSelectedObject,
            setIsDraggingObject, setDraggingObjectId,setShowDropBox, setDragClientPos, segmentationImageId, handleSegmentSelect, isLongPressActiveRef, isSelectMode);
          if (!isLongPressActiveRef.current) {
            handlePanStart(t.clientX, t.clientY, isDraggingRef, lastDragPosRef);
          }
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          maybeCancelLongPressOnMove(t.clientX, t.clientY, startPressPosRef, MOVE_CANCEL_THRESHOLD, longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          if (isDraggingObject) {
            handleObjectDrag(t.clientX, t.clientY, offsetRef.current, zoomRef.current, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
          } else if (e.touches.length === 2) {
            e.preventDefault();
            const [t1, t2] = e.touches;
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            if (lastDistanceRef.current) {
              applyZoom((distance - lastDistanceRef.current) * 0.005, (t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
            }
            lastDistanceRef.current = distance;
          } else if (e.touches.length === 1 && !isLongPressActiveRef.current) {
            panMove(t.clientX, t.clientY);
          }
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos, isLongPressActiveRef);
          handleTouchEndPinch(lastDistanceRef);
          if (t) handleObjectDrop(t.clientX, t.clientY, draggingObjectId,  isDraggingObject, objects,
        setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped);
          else handleObjectDrop(dragClientPos?.x, dragClientPos?.y, draggingObjectId,  isDraggingObject, objects,
        setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped);
          handlePanEnd(isDraggingRef);
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          startLongPress(e.clientX, e.clientY, offsetRef.current, zoomRef.current, canvasRef, objects, startPressPosRef,
            setPressPos, setPressProgress, progressIntervalRef, LONG_PRESS_DURATION, longPressTimerRef, setSelectedObject,
            setIsDraggingObject, setDraggingObjectId,setShowDropBox, setDragClientPos, segmentationImageId, handleSegmentSelect, isLongPressActiveRef, isSelectMode);
          if (!isLongPressActiveRef.current) {
            handlePanStart(e.clientX, e.clientY, isDraggingRef, lastDragPosRef);
          }
        }}
        onDoubleClick={(e) => {
          if (isSelectMode && selectedSegments.length > 0) {
            startDragPress(e.clientX, e.clientY, offsetRef.current, zoomRef.current, canvasRef, segmentationImageId, handleSegmentSelect, isLongPressActiveRef);
          }
        }}
        onMouseMove={(e) => {
          maybeCancelLongPressOnMove(e.clientX, e.clientY, startPressPosRef, MOVE_CANCEL_THRESHOLD, longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          if (isDraggingObject) {
            handleObjectDrag(e.clientX, e.clientY, offsetRef.current, zoomRef.current, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
          } else if (isDraggingRef.current && !isLongPressActiveRef.current) {
            panMove(e.clientX, e.clientY);
          }
        }}
        onMouseUp={(e) => {
          clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos, isLongPressActiveRef);
          handleObjectDrop(e.clientX, e.clientY, draggingObjectId, isDraggingObject, objects,
            setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped);
          handlePanEnd(isDraggingRef);
        }}
        onMouseLeave={() => {
          clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos, isLongPressActiveRef);
          handlePanEnd(isDraggingRef);
        }}
      />
    </div>
  );
}
