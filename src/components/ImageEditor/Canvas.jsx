import { useRef, useEffect, useState } from "react";
import { ZoomIn } from "lucide-react";
import { handleWheel, handleTouchMovePinch, handleTouchEndPinch, handlePanStart, handlePanMove, handlePanEnd, startLongPress , clearLongPress, maybeCancelLongPressOnMove, handleObjectDrop, handleObjectDrag} from "./CanvasUtils";

export default function Canvas({
  setShowDropBox,
  uploadedImage,
  objects,
  selectedObject,
  setObjects,
  setSelectedObject,
  onObjectDropped,
}) {
  const canvasRef = useRef(null);
  const lastDistanceRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startPressPosRef = useRef(null);

  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [draggingObjectId, setDraggingObjectId] = useState(null);
  const [pressProgress, setPressProgress] = useState(0);
  const [pressPos, setPressPos] = useState(null);

  const [dragClientPos, setDragClientPos] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const LONG_PRESS_DURATION = 700;
  const MOVE_CANCEL_THRESHOLD = 5;

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
    const ctx = canvas.getContext("2d");

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

    ctx.drawImage(uploadedImage, imgX, imgY, imgWidth, imgHeight);

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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [uploadedImage, objects, selectedObject, zoom, offset]);

  return (
    <div
      className="relative w-screen h-screen flex items-center justify-center bg-black overflow-hidden touch-none select-none"
      onWheel={(e)=>handleWheel(e,setZoom, setOffset, canvasRef)}
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      <div className="absolute flex gap-3 top-4 right-4 z-20 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2">
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

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-grab"
        onTouchStart={(e) => {
          const t = e.touches[0];
          startLongPress(t.clientX, t.clientY, offset, zoom, canvasRef, objects, startPressPosRef,
            setPressPos, setPressProgress, progressIntervalRef, LONG_PRESS_DURATION, longPressTimerRef, setSelectedObject,
            setIsDraggingObject, setDraggingObjectId,setShowDropBox, setDragClientPos);
          handlePanStart(t.clientX, t.clientY, isDraggingRef, lastDragPosRef);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          maybeCancelLongPressOnMove(t.clientX, t.clientY, startPressPosRef, MOVE_CANCEL_THRESHOLD, longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          if (isDraggingObject) {
            handleObjectDrag(t.clientX, t.clientY, offset, zoom, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef);
          } else if (e.touches.length === 2) {
            handleTouchMovePinch(e, lastDistanceRef, setZoom, setOffset, canvasRef);
          } else if (e.touches.length === 1) {
            handlePanMove(t.clientX, t.clientY, isDraggingRef, lastDragPosRef, setOffset);
          }
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
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
            setIsDraggingObject, setDraggingObjectId,setShowDropBox, setDragClientPos);
          handlePanStart(e.clientX, e.clientY, isDraggingRef, lastDragPosRef);
        }}
        onMouseMove={(e) => {
          maybeCancelLongPressOnMove(e.clientX, e.clientY, startPressPosRef, MOVE_CANCEL_THRESHOLD, longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          if (!isDraggingObject && isDraggingRef.current) {
            handlePanMove(e.clientX, e.clientY, isDraggingRef, lastDragPosRef, setOffset);
          }
        }}
        onMouseUp={() => {
          clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          handlePanEnd(isDraggingRef);
        }}
        onMouseLeave={() => {
          clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
          handlePanEnd(isDraggingRef);
        }}
      />
    </div>
  );
}
