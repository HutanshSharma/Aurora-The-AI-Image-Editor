import { useState, useRef, useEffect } from 'react';
import { X, FlipHorizontal, FlipVertical, ZoomIn, Palette } from "lucide-react";
import {handleWheel, handleTouchMovePinch, handleTouchEndPinch, handlePanStart, handlePanMove, handlePanEnd} from "../CanvasUtils"
import SegmentHeader from './SegmentHeader';
import GalleryView from './GalleryView';
import QuickActions from './QuickActions';
import SegmentFooter from './SegmentFooter';
import EditingOptions from './EditingOptions';
import BackgroundPanel from './BackgroundPanel';
import EditSlider from './EditSlider';

export default function SegmentEditor({ setShowEditor, droppedObjects, onSave }) {
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(droppedObjects.length-1);
  const [viewMode, setViewMode] = useState('edit');
  const [editedObjects, setEditedObjects] = useState([...droppedObjects]);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  
  const [opacity, setOpacity] = useState(100);
  const [sharpen, setSharpen] = useState(0);
  const [hue, setHue] = useState(0);
  
  const [selectedEditOption, setSelectedEditOption] = useState(null);
  
  const [sidebarView, setSidebarView] = useState('editing');
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(false);
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const lastDistanceRef = useRef(null);
  
  const [backgroundColor, setBackgroundColor] = useState(null);
  const [customBackground, setCustomBackground] = useState(null);
  
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [backgroundPos, setBackgroundPos] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isRestoringRef = useRef(false);

  const currentObject = editedObjects[selectedObjectIndex];

  const saveToHistory = () => {
    if (isRestoringRef.current) return;
    
    const currentState = {
      brightness,
      contrast,
      saturation,
      blur,
      rotation,
      flipH,
      flipV,
      opacity,
      sharpen,
      hue,
      imageScale,
      imagePos,
      backgroundScale,
      backgroundPos,
      backgroundColor,
      customBackground,
      canvasSize,
      editedObjects: JSON.parse(JSON.stringify(editedObjects.map(obj => ({
        ...obj,
        image: obj.image.src 
      })))),
    };

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    
    setHistoryIndex(prev => {
      const newIndex = prev + 1;
      return newIndex >= 50 ? 49 : newIndex;
    });
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    
    isRestoringRef.current = true;
    const previousState = history[historyIndex - 1];
    
    setBrightness(previousState.brightness);
    setContrast(previousState.contrast);
    setSaturation(previousState.saturation);
    setBlur(previousState.blur);
    setRotation(previousState.rotation);
    setFlipH(previousState.flipH);
    setFlipV(previousState.flipV);
    setOpacity(previousState.opacity);
    setSharpen(previousState.sharpen);
    setHue(previousState.hue);
    setImageScale(previousState.imageScale);
    setImagePos(previousState.imagePos);
    setBackgroundScale(previousState.backgroundScale);
    setBackgroundPos(previousState.backgroundPos);
    setBackgroundColor(previousState.backgroundColor);
    setCustomBackground(previousState.customBackground);
    setCanvasSize(previousState.canvasSize);
    
    if (previousState.editedObjects) {
      const restoredObjects = previousState.editedObjects.map(obj => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = obj.image;
        return { ...obj, image: img };
      });
      setEditedObjects(restoredObjects);
    }
    
    setHistoryIndex(prev => prev - 1);
    
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    
    isRestoringRef.current = true;
    const nextState = history[historyIndex + 1];
    
    setBrightness(nextState.brightness);
    setContrast(nextState.contrast);
    setSaturation(nextState.saturation);
    setBlur(nextState.blur);
    setRotation(nextState.rotation);
    setFlipH(nextState.flipH);
    setFlipV(nextState.flipV);
    setOpacity(nextState.opacity);
    setSharpen(nextState.sharpen);
    setHue(nextState.hue);
    setImageScale(nextState.imageScale);
    setImagePos(nextState.imagePos);
    setBackgroundScale(nextState.backgroundScale);
    setBackgroundPos(nextState.backgroundPos);
    setBackgroundColor(nextState.backgroundColor);
    setCustomBackground(nextState.customBackground);
    setCanvasSize(nextState.canvasSize);
    
    if (nextState.editedObjects) {
      const restoredObjects = nextState.editedObjects.map(obj => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = obj.image;
        return { ...obj, image: img };
      });
      setEditedObjects(restoredObjects);
    }
    
    setHistoryIndex(prev => prev + 1);
    
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);
  };

  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, []);

  useEffect(() => {
    if (history.length > 0 && !isRestoringRef.current) {
      const timeoutId = setTimeout(() => {
        saveToHistory();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [brightness, contrast, saturation, blur, rotation, flipH, flipV, opacity, sharpen, hue, imageScale, imagePos, backgroundScale, backgroundPos, backgroundColor, customBackground, canvasSize, editedObjects]);

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
  }, [historyIndex, history]);

  const handleCustomBackgroundUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCustomBackground(img);
        setBackgroundColor(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveImageWithBackground = () => {
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d', { alpha: true });
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    if (customBackground) {
      const bgW = exportCanvas.width * backgroundScale;
      const bgH = exportCanvas.height * backgroundScale;
      const bgX = (exportCanvas.width - bgW) / 2 + backgroundPos.x;
      const bgY = (exportCanvas.height - bgH) / 2 + backgroundPos.y;
      ctx.drawImage(customBackground, bgX, bgY, bgW, bgH);
    } else if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      const bgW = exportCanvas.width * backgroundScale;
      const bgH = exportCanvas.height * backgroundScale;
      const bgX = (exportCanvas.width - bgW) / 2 + backgroundPos.x;
      const bgY = (exportCanvas.height - bgH) / 2 + backgroundPos.y;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }
    
    const imgW = currentObject.width * imageScale;
    const imgH = currentObject.height * imageScale;
    const imgX = (exportCanvas.width - imgW) / 2 + imagePos.x;
    const imgY = (exportCanvas.height - imgH) / 2 + imagePos.y;
    
    ctx.save();
    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    
    if (flipH) ctx.scale(-1, 1);
    if (flipV) ctx.scale(1, -1);
    
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(imgW / 2), -(imgH / 2));
    
    let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) hue-rotate(${hue}deg)`;
    if (sharpen > 0) {
      filterString += ` contrast(${100 + sharpen}%)`;
    }
    ctx.filter = filterString;
    ctx.globalAlpha = opacity / 100;
    
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

    if (customBackground && customBackground.complete) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const bgW = canvas.width * backgroundScale;
      const bgH = canvas.height * backgroundScale;
      const bgX = (canvas.width - bgW) / 2 + backgroundPos.x;
      const bgY = (canvas.height - bgH) / 2 + backgroundPos.y;
      ctx.drawImage(customBackground, bgX, bgY, bgW, bgH);
    } else if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      const bgW = canvas.width * backgroundScale;
      const bgH = canvas.height * backgroundScale;
      const bgX = (canvas.width - bgW) / 2 + backgroundPos.x;
      const bgY = (canvas.height - bgH) / 2 + backgroundPos.y;
      ctx.fillRect(bgX, bgY, bgW, bgH);
    }

    const imgW = currentObject.width * imageScale;
    const imgH = currentObject.height * imageScale;
    const imgX = (canvas.width - imgW) / 2 + imagePos.x;
    const imgY = (canvas.height - imgH) / 2 + imagePos.y;

    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    
    if (flipH) ctx.scale(-1, 1);
    if (flipV) ctx.scale(1, -1);
    
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-(imgW / 2), -(imgH / 2));

    let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) hue-rotate(${hue}deg)`;
    if (sharpen > 0) {
      filterString += ` contrast(${100 + sharpen}%)`;
    }
    ctx.filter = filterString;
    ctx.globalAlpha = opacity / 100;

    try {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(currentObject.image, 0, 0, imgW, imgH);
    } catch (e) {
      console.error('Error drawing image:', e);
    }

    ctx.restore();
  }, [currentObject, brightness, contrast, saturation, blur, rotation, flipH, flipV, zoom, offset, opacity, sharpen, hue, backgroundColor, customBackground, canvasSize, backgroundScale, backgroundPos, imageScale, imagePos, viewMode]);

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setOpacity(100);
    setSharpen(0);
    setHue(0);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImageScale(1);
    setImagePos({ x: 0, y: 0 });
    setBackgroundScale(1);
    setBackgroundPos({ x: 0, y: 0 });
    setTimeout(() => saveToHistory(), 100);
  };

  const saveEdits = () => {
    const canvas = canvasRef.current;
    const newImage = new Image();
    newImage.onload = () => {
      const updatedObjects = [...editedObjects];
      updatedObjects[selectedObjectIndex] = {
        ...currentObject,
        image: newImage
      };
      setEditedObjects(updatedObjects);
      resetFilters();
    };
    newImage.src = canvas.toDataURL('image/png', 1.0);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `${currentObject.name}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const deleteObject = () => {
    if (editedObjects.length === 1) {
      alert('Cannot delete the last object');
      return;
    }
    const newObjects = editedObjects.filter((_, i) => i !== selectedObjectIndex);
    setEditedObjects(newObjects);
    setSelectedObjectIndex(Math.max(0, selectedObjectIndex - 1));
  };

  const duplicateObject = () => {
    const duplicate = {
      ...currentObject,
      id: editedObjects.length + 1,
      name: `${currentObject.name} (Copy)`
    };
    setEditedObjects([...editedObjects, duplicate]);
  };

  const applyAllChanges = () => {
    saveEdits();
    setTimeout(() => {
      onSave?.(editedObjects);
      setShowEditor(false);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center md:p-4">
      <div className="bg-black w-full h-full md:max-w-6xl md:h-[90vh] shadow-2xl border-0 md:border md:border-white/10 flex flex-col">
        <SegmentHeader 
          setShowEditor={setShowEditor} 
          editedObjects={editedObjects} 
          setViewMode={setViewMode} 
          viewMode={viewMode}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
        />
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
          
          {viewMode === 'gallery' ? (
            <GalleryView editedObjects={editedObjects} setSelectedObjectIndex={setSelectedObjectIndex} setViewMode={setViewMode} selectedObjectIndex={selectedObjectIndex} duplicateObject={duplicateObject} deleteObject={deleteObject}/>
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
                    className="w-full h-full border border-white/20 shadow-2xl"
                    style={{ 
                      cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                      maxWidth: '100%',
                      maxHeight: '100%'
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
                className="md:hidden fixed top-43 right-4 z-30 bg-purple-500 hover:bg-purple-600 p-2 rounded-full shadow-lg transition-all"
                title="Background"
              >
                <Palette size={20} />
              </button>

              {/* Slider - positioned at bottom on mobile, below canvas on desktop */}
              {selectedEditOption && (
                <div className="absolute md:relative bottom-0 left-10 right-10 md:bottom-auto z-20 bg-black/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none p-3 md:p-0">
                  <EditSlider 
                    selectedEditOption={selectedEditOption}
                    brightness={brightness}
                    saturation={saturation}
                    blur={blur}
                    contrast={contrast}
                    rotation={rotation}
                    opacity={opacity}
                    sharpen={sharpen}
                    hue={hue}
                    setBrightness={setBrightness}
                    setContrast={setContrast}
                    setSaturation={setSaturation}
                    setBlur={setBlur}
                    setOpacity={setOpacity}
                    setRotation={setRotation}
                    setSharpen={setSharpen}
                    setHue={setHue}
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
                        brightness={brightness}
                        contrast={contrast}
                        saturation={saturation}
                        blur={blur}
                        rotation={rotation}
                        opacity={opacity}
                        sharpen={sharpen}
                        hue={hue}
                        onClose={undefined}
                        setSidebarView={setSidebarView}/>

                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Transform</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setFlipH(!flipH)}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              flipH ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <FlipHorizontal size={16} />
                            <span className="text-sm">Flip H</span>
                          </button>
                          <button
                            onClick={() => setFlipV(!flipV)}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              flipV ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
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
                            setBackgroundColor={setBackgroundColor}
                            setCustomBackground={setCustomBackground}
                            backgroundColor={backgroundColor}
                            backgroundInputRef={backgroundInputRef}
                            handleCustomBackgroundUpload={handleCustomBackgroundUpload}
                            customBackground={customBackground}
                            backgroundScale={backgroundScale}
                            setBackgroundScale={setBackgroundScale}
                            backgroundPos={backgroundPos}
                            setBackgroundPos={setBackgroundPos}
                            imageScale={imageScale}
                            setImagePos={setImagePos}
                            setImageScale={setImageScale}
                            imagePos={imagePos}
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
                        brightness={brightness}
                        contrast={contrast}
                        saturation={saturation}
                        blur={blur}
                        rotation={rotation}
                        opacity={opacity}
                        sharpen={sharpen}
                        hue={hue}
                        onClose={() => setIsMobileToolbarOpen(false)}/>

                      <div className="border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Transform</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setFlipH(!flipH);
                              setIsMobileToolbarOpen(false);
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              flipH ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <FlipHorizontal size={16} />
                            <span className="text-sm">Flip H</span>
                          </button>
                          <button
                            onClick={() => {
                              setFlipV(!flipV);
                              setIsMobileToolbarOpen(false);
                            }}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              flipV ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
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
                            setBackgroundColor={setBackgroundColor}
                            setCustomBackground={setCustomBackground}
                            backgroundColor={backgroundColor}
                            backgroundInputRef={backgroundInputRef}
                            handleCustomBackgroundUpload={handleCustomBackgroundUpload}
                            customBackground={customBackground}
                            backgroundScale={backgroundScale}
                            setBackgroundScale={setBackgroundScale}
                            backgroundPos={backgroundPos}
                            setBackgroundPos={setBackgroundPos}
                            imageScale={imageScale}
                            setImagePos={setImagePos}
                            setImageScale={setImageScale}
                            imagePos={imagePos}
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

        <SegmentFooter editedObjects={editedObjects} applyAllChanges={applyAllChanges}/>
      </div>
    </div>
  );
}