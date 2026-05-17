import { useRef, useEffect, useState } from "react";
import { ZoomIn, Hand, MousePointerClick } from "lucide-react";
import { handleWheel, handleTouchMovePinch, handleTouchEndPinch, handlePanStart, handlePanMove, handlePanEnd, startLongPress , clearLongPress, maybeCancelLongPressOnMove, handleObjectDrop, handleObjectDrag} from "../Utils/CanvasUtils";
import { applyLUT } from "../Utils/LUTUtils";
import PixelCard from "./PixelCard";
import { getSegmentAtPoint, extractSegment } from "../Utils/SegmentationAPI";

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
}) {
  const canvasRef = useRef(null);
  const lastDistanceRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startPressPosRef = useRef(null);
  const isLongPressActiveRef = useRef(false);
  
  const processedImageRef = useRef(null);
  const lastProcessParamsRef = useRef(null);

  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [draggingObjectId, setDraggingObjectId] = useState(null);
  const [pressProgress, setPressProgress] = useState(0);
  const [pressPos, setPressPos] = useState(null);

  const [dragClientPos, setDragClientPos] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageBounds, setImageBounds] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState([]); 
  const [segmentOverlays, setSegmentOverlays] = useState([]); 
  const [showGallery, setShowGallery] = useState(false);
  const [segmentingDots, setSegmentingDots] = useState('');

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
      
      const result = await getSegmentAtPoint(segmentationImageId, imageX, imageY);
      
      if (result.has_segment && result.segment_index !== undefined) {
        const alreadySelected = selectedSegments.some(s => s.index === result.segment_index);
        
        if (alreadySelected) {
          await combineAndDragSegments(scale, clientX, clientY, imgX, imgY, imgWidth, imgHeight);
        } else {
          const extractedResult = await extractSegment(segmentationImageId, result.segment_index);
          
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
    } finally {
      isLongPressActiveRef.current = false;
    }
  };

  const combineAndDragSegments = async (scale, clientX, clientY, imgX, imgY, imgWidth, imgHeight) => {
    try {
      if (selectedSegments.length === 0) return;
      const canvas = document.createElement('canvas');
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      const ctx = canvas.getContext('2d');
      for (const segment of selectedSegments) {
        const img = new Image();
        img.src = segment.object;
        await new Promise(resolve => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            resolve();
          };
        });
      }
      
      const combinedBase64 = canvas.toDataURL('image/png');
      
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
        setSelectedSegments([]);
        setSegmentOverlays([]);
      };
    } catch (error) {
      console.error('Failed to combine segments:', error);
    }
  };

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
      if (isDraggingObject) {
        e.preventDefault();
        handleObjectDrag(e.clientX, e.clientY, offset, zoom, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
      } else if (isDraggingRef.current) {
        handlePanMove(e.clientX, e.clientY, isDraggingRef, lastDragPosRef, setOffset);
      }
    };
    const handleWindowMouseUp = (e) => {
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
  }, [isDraggingObject]);

  useEffect(() => {
    const handleWindowTouchMove = (e) => {
      if (isDraggingObject && e.touches && e.touches[0]) {
        const t = e.touches[0];
        handleObjectDrag(t.clientX, t.clientY, offset, zoom, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
      }
    };
    const handleWindowTouchEnd = (e) => {
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
  }, [isDraggingObject, dragClientPos]);

  useEffect(() => {
    if (!canvasRef.current || !uploadedImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y);

    const scale = Math.min(
      canvas.width / uploadedImage.width,
      canvas.height / uploadedImage.height
    );
    const imgWidth = uploadedImage.width * scale;
    const imgHeight = uploadedImage.height * scale;
    const imgX = (canvas.width - imgWidth) / 2;
    const imgY = (canvas.height - imgHeight) / 2;
    setImageBounds({
      x: imgX,
      y: imgY,
      width: imgWidth,
      height: imgHeight
    });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const currentParams = JSON.stringify({
      brightness: editorState?.brightness,
      contrast: editorState?.contrast,
      saturation: editorState?.saturation,
      blur: editorState?.blur,
      hue: editorState?.hue,
      sharpen: editorState?.sharpen,
      opacity: editorState?.opacity,
      flipH: editorState?.flipH,
      flipV: editorState?.flipV,
      rotation: editorState?.rotation,
      lutFile: editorState?.selectedLUT?.file,
      imageWidth: uploadedImage.width,
      imageHeight: uploadedImage.height,
    });

    const needsReprocessing = !processedImageRef.current || 
                              lastProcessParamsRef.current !== currentParams;

    if (loadedLUT && needsReprocessing) {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = uploadedImage.width;
      offscreenCanvas.height = uploadedImage.height;
      const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      
      offscreenCtx.imageSmoothingEnabled = true;
      offscreenCtx.imageSmoothingQuality = 'high';
      
      offscreenCtx.save();
      offscreenCtx.translate(uploadedImage.width / 2, uploadedImage.height / 2);
      if (editorState?.flipH) offscreenCtx.scale(-1, 1);
      if (editorState?.flipV) offscreenCtx.scale(1, -1);
      offscreenCtx.rotate(((editorState?.rotation || 0) * Math.PI) / 180);
      offscreenCtx.translate(-(uploadedImage.width / 2), -(uploadedImage.height / 2));
      
      const blurValue = Math.max(0, Math.min(20, editorState?.blur || 0));
      
      let filterString = `brightness(${editorState?.brightness || 100}%) contrast(${editorState?.contrast || 100}%) saturate(${editorState?.saturation || 100}%)`;
      
      if (blurValue > 0) {
        filterString += ` blur(${blurValue}px)`;
      }
      
      filterString += ` hue-rotate(${editorState?.hue || 0}deg)`;
      
      if ((editorState?.sharpen || 0) > 0) {
        filterString += ` contrast(${100 + (editorState?.sharpen || 0)}%)`;
      }
      if ('filter' in offscreenCtx) {
        offscreenCtx.filter = filterString;
      } else {
        console.warn('Canvas filter not supported in this browser');
      }
      
      offscreenCtx.globalAlpha = (editorState?.opacity || 100) / 100;
      
      offscreenCtx.drawImage(uploadedImage, 0, 0);
      offscreenCtx.restore();
      
      const imageData = offscreenCtx.getImageData(0, 0, uploadedImage.width, uploadedImage.height);
      const lutAppliedData = applyLUT(imageData, loadedLUT);
      offscreenCtx.putImageData(lutAppliedData, 0, 0);
      
      processedImageRef.current = offscreenCanvas;
      lastProcessParamsRef.current = currentParams;
      
      ctx.save();
      ctx.drawImage(offscreenCanvas, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();
    } else if (loadedLUT && !needsReprocessing) {
      ctx.save();
      ctx.drawImage(processedImageRef.current, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();
    } else {
      if (needsReprocessing) {
        lastProcessParamsRef.current = currentParams;
        processedImageRef.current = null;
      }
      
      ctx.save();
      ctx.translate(imgX + imgWidth / 2, imgY + imgHeight / 2);
      
      if (editorState?.flipH) ctx.scale(-1, 1);
      if (editorState?.flipV) ctx.scale(1, -1);
      
      ctx.rotate(((editorState?.rotation || 0) * Math.PI) / 180);
      ctx.translate(-(imgWidth / 2), -(imgHeight / 2));
      
      const blurValue = Math.max(0, Math.min(20, editorState?.blur || 0));
      
      let filterString = `brightness(${editorState?.brightness || 100}%) contrast(${editorState?.contrast || 100}%) saturate(${editorState?.saturation || 100}%)`;
      
      if (blurValue > 0) {
        filterString += ` blur(${blurValue}px)`;
      }
      
      filterString += ` hue-rotate(${editorState?.hue || 0}deg)`;
      
      if ((editorState?.sharpen || 0) > 0) {
        filterString += ` contrast(${100 + (editorState?.sharpen || 0)}%)`;
      }
      
      if ('filter' in ctx) {
        ctx.filter = filterString;
      } else {
        console.warn('Canvas filter not supported in this browser');
      }
      
      ctx.globalAlpha = (editorState?.opacity || 100) / 100;
      
      ctx.drawImage(uploadedImage, 0, 0, imgWidth, imgHeight);
      ctx.restore();
    }
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
      if (obj.image && obj.image.complete) {
        ctx.drawImage(obj.image, obj.x, obj.y, obj.width, obj.height);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      }

      ctx.strokeStyle = selectedObject?.id === obj.id ? "#3b82f6" : "#10b981";
      ctx.lineWidth = 3 / zoom;
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
      if (overlay.image && overlay.image.complete) {
        ctx.save();        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = overlay.width;
        tempCanvas.height = overlay.height;
        const tempCtx = tempCanvas.getContext('2d');        
        tempCtx.drawImage(overlay.image, 0, 0, overlay.width, overlay.height);        
        tempCtx.globalCompositeOperation = 'multiply';
        tempCtx.fillStyle = '#3b82f6';
        tempCtx.fillRect(0, 0, overlay.width, overlay.height);        
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(overlay.image, 0, 0, overlay.width, overlay.height);
        
        ctx.globalAlpha = 0.6;
        ctx.drawImage(tempCanvas, overlay.x, overlay.y);
        
        ctx.restore();
      }
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [uploadedImage, objects, selectedObject, zoom, offset, editorState, loadedLUT, segmentOverlays, mergedSegments]);

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center bg-black overflow-hidden touch-none select-none"
      onWheel={(e)=>handleWheel(e,setZoom, setOffset, canvasRef)}
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      <div className="absolute flex gap-3 top-4 right-4 z-50 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2">
        <ZoomIn />
        <p className="text-sm">{Math.round(zoom * 100)}%</p>
      </div>

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

      {isDraggingObject && draggingObjectId && dragClientPos && (
        <div
          className="pointer-events-none"
          style={{
            position: "fixed",
            top: dragClientPos.y - 40,
            left: dragClientPos.x - 40,
            width: 80,
            height: 80,
            zIndex: 9999,
            transform: "translate3d(0,0,0)",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {(() => {
            const obj = objects.find((o) => o.id === draggingObjectId);
            if (!obj) return null;
            return (
              <img
                src={obj.image?.src}
                alt={obj.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                draggable={false}
              />
            );
          })()}
        </div>
      )}

      {isSegmenting && uploadedImage && imageBounds && (
        <>
          <div className="absolute w-42 bottom-40 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="px-6 py-3 rounded-full bg-linear-to-r from-blue-500/20 to-blue-600/20 backdrop-blur-sm border border-blue-400/30">
              <p className="text-white font-bold text-lg tracking-wide" 
                 style={{
                   textShadow: '0 0 20px rgba(59, 130, 246, 0.8), 0 0 10px rgba(96, 165, 250, 1), 0 2px 4px rgba(0,0,0,0.5)'
                 }}>
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

      {/* Mode Toggle Button */}
      {segmentationImageId && (
        <>
          <button
            onClick={() => setIsSelectMode(!isSelectMode)}
            className="absolute top-24 right-4 z-20 px-4 py-2 rounded-lg backdrop-blur-sm border transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: isSelectMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(107, 114, 128, 0.3)',
              borderColor: isSelectMode ? 'rgba(59, 130, 246, 0.6)' : 'rgba(107, 114, 128, 0.6)',
              boxShadow: isSelectMode ? '0 0 20px rgba(59, 130, 246, 0.3)' : '0 0 10px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="flex items-center gap-2">
              {isSelectMode ? (
                <>
                  <MousePointerClick className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold text-sm">
                    Select Mode {selectedSegments.length > 0 && `(${selectedSegments.length})`}
                  </span>
                </>
              ) : (
                <>
                  <Hand className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold text-sm">Pan Mode</span>
                </>
              )}
            </div>
          </button>
          
          {/* Gallery Button */}
          {selectedSegments.length > 0 && (
            <button
              onClick={() => setShowGallery(!showGallery)}
              className="absolute top-24 right-72 z-20 px-3 py-2 rounded-lg backdrop-blur-sm border border-purple-400/60 bg-purple-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                boxShadow: '0 0 15px rgba(147, 51, 234, 0.3)'
              }}
            >
              <span className="text-white font-semibold text-sm">Gallery</span>
            </button>
          )}
          
          {/* Clear Selection Button */}
          {selectedSegments.length > 0 && (
            <button
              onClick={() => {
                setSelectedSegments([]);
                setSegmentOverlays([]);
              }}
              className="absolute top-24 right-48 z-20 px-3 py-2 rounded-lg backdrop-blur-sm border border-red-400/60 bg-red-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)'
              }}
            >
              <span className="text-white font-semibold text-sm">Clear ({selectedSegments.length})</span>
            </button>
          )}
        </>
      )}

      {/* Segment Gallery Sidebar */}
      {showGallery && selectedSegments.length > 0 && (
        <div className="absolute top-4 left-4 z-20 w-64 max-h-96 bg-black/80 backdrop-blur-sm rounded-lg border border-gray-600/50 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Selected Segments</h3>
              <button
                onClick={() => setShowGallery(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedSegments.map((segment, index) => (
                <div key={segment.index} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors">
                  <div className="w-12 h-12 bg-gray-600 rounded overflow-hidden shrink-0">
                    <img 
                      src={segment.object} 
                      alt={`Segment ${segment.index}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      Segment {segment.index}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Selected {index + 1}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => removeSegment(segment.index)}
                    className="text-red-400 hover:text-red-300 transition-colors p-1"
                    title="Remove from selection"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-600/50">
              <button
                onClick={() => {
                  const canvas = canvasRef.current;
                  const scale = Math.min(
                    canvas.width / uploadedImage.width,
                    canvas.height / uploadedImage.height
                  );
                  const imgWidth = uploadedImage.width * scale;
                  const imgHeight = uploadedImage.height * scale;
                  const imgX = (canvas.width - imgWidth) / 2;
                  const imgY = (canvas.height - imgHeight) / 2;
                  
                  combineAndDragSegments(scale, window.innerWidth / 2, window.innerHeight / 2, imgX, imgY, imgWidth, imgHeight);
                  setShowGallery(false);
                }}
                className="w-full px-3 py-2 bg-blue-500/30 border border-blue-400/60 rounded-lg text-white font-medium hover:bg-blue-500/40 transition-colors"
              >
                Combine All ({selectedSegments.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-grab"
        onTouchStart={(e) => {
          const t = e.touches[0];
          startLongPress(t.clientX, t.clientY, offset, zoom, canvasRef, objects, startPressPosRef,
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
            handleObjectDrag(t.clientX, t.clientY, offset, zoom, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
          } else if (e.touches.length === 2) {
            handleTouchMovePinch(e, lastDistanceRef, setZoom, setOffset, canvasRef);
          } else if (e.touches.length === 1 && !isLongPressActiveRef.current) {
            handlePanMove(t.clientX, t.clientY, isDraggingRef, lastDragPosRef, setOffset);
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
          startLongPress(e.clientX, e.clientY, offset, zoom, canvasRef, objects, startPressPosRef,
            setPressPos, setPressProgress, progressIntervalRef, LONG_PRESS_DURATION, longPressTimerRef, setSelectedObject,
            setIsDraggingObject, setDraggingObjectId,setShowDropBox, setDragClientPos, segmentationImageId, handleSegmentSelect, isLongPressActiveRef, isSelectMode);
          if (!isLongPressActiveRef.current) {
            handlePanStart(e.clientX, e.clientY, isDraggingRef, lastDragPosRef);
          }
        }}
        onDoubleClick={(e) => {
          if (isSelectMode && selectedSegments.length > 0) {
            startDragPress(e.clientX, e.clientY, offset, zoom, canvasRef, segmentationImageId, handleSegmentSelect, isLongPressActiveRef);
          }
        }}
        onMouseMove={(e) => {
          maybeCancelLongPressOnMove(e.clientX, e.clientY, startPressPosRef, MOVE_CANCEL_THRESHOLD, longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          if (isDraggingObject) {
            handleObjectDrag(e.clientX, e.clientY, offset, zoom, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
          } else if (isDraggingRef.current && !isLongPressActiveRef.current) {
            handlePanMove(e.clientX, e.clientY, isDraggingRef, lastDragPosRef, setOffset);
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
