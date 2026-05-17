export function handleZoom(delta, focusX, focusY, setZoom, setOffset, canvasRef){
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
}

export function handleWheel(e, setZoom, setOffset, canvasRef){
    if (e.ctrlKey || e.metaKey) {
      handleZoom(e.deltaY > 0 ? -0.1 : 0.1, e.clientX, e.clientY, setZoom, setOffset, canvasRef);
    }
}

export function handleTouchMovePinch(e, lastDistanceRef, setZoom, setOffset, canvasRef){
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
            const zoomChange = delta * 0.005;
            requestAnimationFrame(() => {
              handleZoom(zoomChange, focusX, focusY, setZoom, setOffset, canvasRef);
            });
      }
      lastDistanceRef.current = distance;
    }
}

export function handleTouchEndPinch(lastDistanceRef){
    lastDistanceRef.current = null
}

export function handlePanStart(x,y,isDraggingRef,lastDragPosRef){
    isDraggingRef.current = true;
    lastDragPosRef.current = { x, y };
}

export function handlePanMove(x, y, isDraggingRef, lastDragPosRef, setOffset ){
    if (!isDraggingRef.current) return;
    const dx = x - lastDragPosRef.current.x;
    const dy = y - lastDragPosRef.current.y;
    requestAnimationFrame(() => {
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    });
    lastDragPosRef.current = { x, y };
}

export function handlePanEnd(isDraggingRef){
    isDraggingRef.current = false
}

export function getCanvasCoords(clientX, clientY, canvasRef, offset, zoom){
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / zoom;
    const y = (clientY - rect.top - offset.y) / zoom;
    return { x, y };
}

export function findObjectAt(x,y,objects){
    return (
        objects.find(
        (obj) =>
            x >= obj.x &&
            x <= obj.x + obj.width &&
            y >= obj.y &&
            y <= obj.y + obj.height
        ))
}

export function startLongPress(clientX, clientY, offset, zoom, canvasRef, objects, startPressPosRef,
        setPressPos, setPressProgress, progressIntervalRef, LONG_PRESS_DURATION, longPressTimerRef, setSelectedObject,
        setIsDraggingObject, setDraggingObjectId,setShowDropBox, setDragClientPos, segmentationImageId, onSegmentSelect, isLongPressActiveRef, isSelectMode){
    const { x, y } = getCanvasCoords(clientX, clientY, canvasRef, offset, zoom);
    const obj = findObjectAt(x, y, objects);
    if (!isSelectMode && !obj) {
        return;
    }
    
    startPressPosRef.current = { x: clientX, y: clientY };
    setPressPos({ x: clientX, y: clientY });
    setPressProgress(0);
    isLongPressActiveRef.current = true;

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setPressProgress(Math.min(100, (elapsed / LONG_PRESS_DURATION) * 100));
    }, 16);

    longPressTimerRef.current = setTimeout(async () => {
        if (obj) {
            setSelectedObject(obj);
            setIsDraggingObject(true);
            setDraggingObjectId(obj.id);
            setPressProgress(100);
            setShowDropBox(true);
            setDragClientPos({ x: clientX, y: clientY });
            isLongPressActiveRef.current = false;
        } else if (isSelectMode && segmentationImageId && onSegmentSelect) {
            try {
                await onSegmentSelect(x, y, clientX, clientY, false); 
            } catch (error) {
                console.error('Failed to select segment:', error);
                isLongPressActiveRef.current = false;
            }
        } else {
            isLongPressActiveRef.current = false;
        }
        setTimeout(() => {
            setPressPos(null);
            setPressProgress(0);
        }, 100);
    }, LONG_PRESS_DURATION);
}

export function startDragPress(clientX, clientY, offset, zoom, canvasRef, segmentationImageId, onSegmentSelect, isLongPressActiveRef) {
    if (!segmentationImageId || !onSegmentSelect) return;
    
    const { x, y } = getCanvasCoords(clientX, clientY, canvasRef, offset, zoom);
    
    setTimeout(async () => {
        try {
            await onSegmentSelect(x, y, clientX, clientY, true);
        } catch (error) {
            console.error('Failed to drag segments:', error);
        }
        isLongPressActiveRef.current = false;
    }, 100);
}

export function clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos, isLongPressActiveRef){
    clearTimeout(longPressTimerRef.current);
    clearInterval(progressIntervalRef.current);
    setPressProgress(0);
    setPressPos(null);
    if (isLongPressActiveRef) {
        isLongPressActiveRef.current = false;
    }
}

export function maybeCancelLongPressOnMove(clientX, clientY, startPressPosRef, MOVE_CANCEL_THRESHOLD, longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos){
    if (!startPressPosRef.current) return;
    const dx = clientX - startPressPosRef.current.x;
    const dy = clientY - startPressPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > MOVE_CANCEL_THRESHOLD) {
        clearLongPress(longPressTimerRef, progressIntervalRef, setPressProgress, setPressPos);
        startPressPosRef.current = null;
    }
}

export function handleObjectDrag(clientX, clientY, offset, zoom, isDraggingObject, draggingObjectId, setObjects, setDragClientPos, canvasRef){
    if (!isDraggingObject || !draggingObjectId) return;
    const { x, y } = getCanvasCoords(clientX, clientY, canvasRef, offset, zoom);
    setObjects((prev) =>
        prev.map((obj) =>
            obj.id === draggingObjectId
            ? { ...obj, x: x - obj.width / 2, y: y - obj.height / 2 }
            : obj
        )
    );
    setDragClientPos({ x: clientX, y: clientY });
}

export function handleObjectDrop(clientX, clientY, draggingObjectId, isDraggingObject, objects,
        setIsDraggingObject, setDraggingObjectId, setSelectedObject, setDragClientPos, setShowDropBox, onObjectDropped){
    if (isDraggingObject) {
        onObjectDropped(
          objects.find((o) => o.id === draggingObjectId),
          { x: clientX, y: clientY }
        );
        setIsDraggingObject(false);
        setDraggingObjectId(null);
        setSelectedObject(null);
        setDragClientPos(null);
        setShowDropBox(false);
    }
}