import { useRef, useEffect, useState } from "react";
import { ZoomIn } from "lucide-react"

export default function Canvas({
  handleDoubleTap,
  uploadedImage,
  objects,
  selectedObject,
}) {
  const canvasRef = useRef(null);
  const lastDistanceRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

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

  const handleZoom = (delta, focusX, focusY) => {
    setZoom((prevZoom) => {
      let newZoom = prevZoom + delta;
      newZoom = Math.min(6, Math.max(0.5, newZoom));

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const focusCanvasX = (focusX - rect.left) * scaleX;
      const focusCanvasY = (focusY - rect.top) * scaleY;

      if (newZoom === prevZoom) return prevZoom;

      setOffset((prevOffset) => {
        const scale = newZoom / prevZoom;
        let newX = focusCanvasX - scale * (focusCanvasX - prevOffset.x);
        let newY = focusCanvasY - scale * (focusCanvasY - prevOffset.y);
        if (newZoom === 1) {
          newX = 0;
          newY = 0;
        }
        return { x: newX, y: newY };
      });

      return newZoom;
    });
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      handleZoom(e.deltaY > 0 ? -0.1 : 0.1, e.clientX, e.clientY);
    }
  };

  const handleTouchMovePinch = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const focusX = (t1.clientX + t2.clientX) / 2;
      const focusY = (t1.clientY + t2.clientY) / 2;

      if (lastDistanceRef.current) {
        const delta = distance - lastDistanceRef.current;
        const zoomChange = delta * 0.002;
        handleZoom(zoomChange, focusX, focusY);
      }
      lastDistanceRef.current = distance;
    }
  };

  const handleTouchEndPinch = () => (lastDistanceRef.current = null);

  const handlePanStart = (x, y) => {
    isDraggingRef.current = true;
    lastDragPosRef.current = { x, y };
  };

  const handlePanMove = (x, y) => {
    if (!isDraggingRef.current) return;
    const dx = x - lastDragPosRef.current.x;
    const dy = y - lastDragPosRef.current.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    lastDragPosRef.current = { x, y };
  };

  const handlePanEnd = () => {
    isDraggingRef.current = false;
  };

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
      ctx.strokeStyle = selectedObject?.id === obj.id ? "#3b82f6" : "#10b981";
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(59,130,246,0.9)";
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
      onWheel={handleWheel}
      onClick={handleDoubleTap}
      style={{
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
      <div className="absolute flex gap-3 top-4 right-4 z-20 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2">
        <span><ZoomIn/></span>
        <p className="text-sm">{Math.round(zoom * 100)}%</p>
      </div>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-grab"
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            const t = e.touches[0];
            handlePanStart(t.clientX, t.clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) handleTouchMovePinch(e);
          else if (e.touches.length === 1) {
            const t = e.touches[0];
            handlePanMove(t.clientX, t.clientY);
          }
        }}
        onTouchEnd={(e) => {
          handleTouchEndPinch();
          handlePanEnd();
        }}
        onMouseDown={(e) => handlePanStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handlePanMove(e.clientX, e.clientY)}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      />
    </div>
  );
}
