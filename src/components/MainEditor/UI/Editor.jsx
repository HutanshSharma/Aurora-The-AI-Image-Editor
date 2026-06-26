import { useState, useRef, useEffect } from 'react';
import ErrorBoundary from '../../ErrorBoundary.jsx';
import ImageUpload from './ImageUpload.jsx';
import Header from './Header.jsx';
import Canvas from './Canvas.jsx';
import CommandInput from './CommandInput.jsx';
import AnimatedList from './AnimatedList/AnimatedList.jsx';
import DropBox from './DropBox.jsx';
import SegmentEditor from '../../SegmentEditor/UI/SegmentEditor.jsx';
import useHistory from '../../../hooks/useHistory.jsx';
import { useUser } from '../../../store/UserContext.jsx';
import { useLoader } from '../../../store/LoaderContext.jsx';
import AdjustBar from './AdjustBar.jsx';
import LUTSlider from './LUTSlider.jsx';
import HistoryViewer from './HistoryViewer.jsx';
import { loadLUT } from '../Utils/LUTUtils.js';
import { uploadAndSegment, imageToBase64 } from '../Utils/SegmentationAPI.js';
import watermarkImg from '../../../assets/watermark.png';
import { ArrowLeft } from 'lucide-react';

export class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

const initialEditorState = {
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
  selectedLUT: null,
};

const Editor = ({ addToast }) => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [allImages, setallImages] = useState([]);
  const [showImages, setShowImages] = useState(false);
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [popupState, setPopupState] = useState('');
  const [showDropBox, setShowDropBox] = useState(false);
  const [droppedObjects, setDroppedObjects] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedEditOption, setSelectedEditOption] = useState(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [loadedLUT, setLoadedLUT] = useState(null);
  const [showLUTSelector, setShowLUTSelector] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segmentationImageId, setSegmentationImageId] = useState(null);
  const [mergedSegments, setMergedSegments] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingLUT, setIsApplyingLUT] = useState(false);

  const {user, fetchImage, uploadImage, deleteImage} = useUser();
  const { showLoader, hideLoader } = useLoader();
  const dropBoxRef = useRef(null);
  const pendingApplyRef = useRef(false);
  const applyTimeoutRef = useRef(null);

  const {
    state: editorState,
    execute,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
    historyTree,
    currentNodeId,
    jumpToNode,
    addBranch
  } = useHistory(initialEditorState);
  const jumpToNodeWithLoader = (nodeId) => {
    pendingApplyRef.current = true;
    showLoader('Applying changes…');
    jumpToNode(nodeId);
    clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = setTimeout(() => {
      if (pendingApplyRef.current) {
        pendingApplyRef.current = false;
        hideLoader();
      }
    }, 4000);
  };
  const handleCanvasDrawn = () => {
    if (pendingApplyRef.current) {
      pendingApplyRef.current = false;
      clearTimeout(applyTimeoutRef.current);
      hideLoader();
    }
  };

  useEffect(() => {
    if (user && user.images && user.images.length > 0) {
      setallImages(user.images);
    } else if (user && (!user.images || user.images.length === 0)) {
      setallImages([]);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const loadSelectedLUT = async () => {
      if (editorState.selectedLUT) {
        const lut = await loadLUT(`/luts/${editorState.selectedLUT.file}`);
        if (!cancelled) {
          setLoadedLUT(lut);
          requestAnimationFrame(() => {
            if (!cancelled) setIsApplyingLUT(false);
          });
        }
      } else {
        setLoadedLUT(null);
        setIsApplyingLUT(false);
      }
    };
    loadSelectedLUT();
    return () => {
      cancelled = true;
    };
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

  const handleImageDelete = async (stored_name) => {
    try {
      await deleteImage(stored_name);
      setallImages(prev => prev.filter(img => img.stored_name !== stored_name));
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const handleImageUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadImage(formData);
    } catch (error) {
      console.error('Failed to upload image:', error);
    }
  };

  const handleImageClick = async (imageItem) => {
    try {
      let imageData;
      
      if (imageItem.stored_name) {
        imageData = await fetchImage(imageItem.stored_name);
        if (!imageData) {
          console.error("Failed to fetch image data");
          return;
        }
      } else {
        imageData = imageItem;
      }
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      if (imageData.base64) {
        img.src = `data:image/jpeg;base64,${imageData.base64}`;
      } else if (imageData.src) {
        img.src = imageData.src;
      } else {
        console.error("No image source available");
        return;
      }
      
      img.onload = () => {
        setUploadedImage(img);
        setShowImages(false);
      };
      
      img.onerror = () => {
        console.error("Failed to load image");
      };
    } catch (error) {
      console.error("Error in handleImageClick:", error);
    }
  };

  const uploadInputRef = useRef(null);
  const openPopup = () => {
    setShowAdjust(false);
    // On phones the drag-and-drop sheet feels unnatural — open the native picker directly.
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      uploadInputRef.current?.click();
      return;
    }
    setPopupState('open-popup');
  };
  const closePopup = () => {
    setPopupState('close-popup');
    setTimeout(() => setPopupState('hide'), 350);
  };

  const handleLoadImages = () => {
    setShowImages(prev => !prev);
    setShowAdjust(false);
  };

  const downloadImage = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');

    ctx.drawImage(canvas, 0, 0);

    const watermark = new Image();
    watermark.src = watermarkImg;
    
    await new Promise((resolve) => {
      watermark.onload = () => {
        const circleSize = 70; 
        const watermarkSize = 50; 
        const padding = 15; 
        
        const centerX = tempCanvas.width - circleSize / 2 - padding;
        const centerY = tempCanvas.height - circleSize / 2 - padding;
        const radius = circleSize / 2;
        ctx.save();        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.fill();        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();        
        ctx.globalAlpha = 0.9;
        ctx.drawImage(
          watermark, 
          centerX - watermarkSize / 2, 
          centerY - watermarkSize / 2, 
          watermarkSize, 
          watermarkSize
        );        
        ctx.restore();
        
        resolve();
      };
    });
    const link = document.createElement('a');
    link.download = `edited_image_${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png', 1.0);
    link.click();
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
        selectedLUT: null,
      }),
      (s) => ({ ...s })
    ));
  };

  const handleLUTSelect = (lut) => {
    setIsApplyingLUT(!!lut);
    execute(new Command(
      (s) => ({ ...s, selectedLUT: lut }),
      (s) => ({ ...s, selectedLUT: editorState.selectedLUT })
    ));
    setSelectedEditOption(null);
  };

  const handleApplyEditedSegments = async (editedObjects) => {
    setMergedSegments(editedObjects);
    setDroppedObjects([]);    
    setHasUnsavedChanges(true);
    await mergeSegmentsIntoImage(editedObjects);
  };

  const mergeSegmentsIntoImage = async (editedObjects) => {
    if (!uploadedImage || editedObjects.length === 0) return;    
    const canvas = document.createElement('canvas');
    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;
    const ctx = canvas.getContext('2d', { alpha: true });    
    ctx.drawImage(uploadedImage, 0, 0);
    
    for (const segment of editedObjects) {
      if (segment.image && segment.image.complete) {
        ctx.drawImage(segment.image, 0, 0, canvas.width, canvas.height);
      }
    }

    const mergedImage = new Image();
    mergedImage.crossOrigin = "anonymous";
    
    return new Promise((resolve) => {
      mergedImage.onload = () => {
        setUploadedImage(mergedImage);
        setMergedSegments([]);
        setSegmentationImageId(null);
        resolve();
      };
      mergedImage.src = canvas.toDataURL('image/png', 1.0);
    });
  };

  const handleSegment = async () => {
    if (!uploadedImage || isSegmenting) return;
    if (segmentationImageId) {
      addToast?.('This image is already segmented — long-press to select an object.', 'info');
      return;
    }
    setIsSegmenting(true);
    try {
      const imageBase64 = imageToBase64(uploadedImage);
      const result = await Promise.race([
        uploadAndSegment(imageBase64),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Segmentation timed out')), 45000)),
      ]);
      setSegmentationImageId(result.image_id);
      if (result.compressedImage && (result.compressedWidth !== uploadedImage.width || result.compressedHeight !== uploadedImage.height)) {
        const compressedImg = new Image();
        compressedImg.src = result.compressedImage;
        compressedImg.onload = () => setUploadedImage(compressedImg);
      }
      addToast?.('Objects detected — long-press the image to select one.', 'success');
    } catch (error) {
      console.error('Segmentation failed:', error);
      addToast?.('Segmentation failed — is the backend server running?', 'error');
    } finally {
      setIsSegmenting(false);
    }
  };

  const saveImage = async () => {
    if (!uploadedImage) return;
    
    setIsSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(uploadedImage, 0, 0);
      
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('file', blob, `edited_${Date.now()}.png`);
          
          await uploadImage(formData);
          setHasUnsavedChanges(false);
          resolve();
        }, 'image/png');
      });
    } catch (error) {
      console.error('Failed to save image:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleObjectDropped = (obj, dropPos) => {
    if (!dropBoxRef.current) return;
    const dropRect = dropBoxRef.current.getBoundingClientRect();
    const { x, y } = dropPos;
    if (
      x >= dropRect.left &&
      x <= dropRect.right &&
      y >= dropRect.top &&
      y <= dropRect.bottom
    ) {
      const objectWithPosition = {
        ...obj,
        originalCanvasX: obj.x,
        originalCanvasY: obj.y,
        originalCanvasWidth: obj.width,
        originalCanvasHeight: obj.height,
        normalizedX: obj.normalizedX,
        normalizedY: obj.normalizedY,
        normalizedWidth: obj.normalizedWidth,
        normalizedHeight: obj.normalizedHeight,
        displayScaleFactor: obj.displayScaleFactor,
      };
      setDroppedObjects(prev=>[...prev, objectWithPosition]);
      setShowEditor(true);
      setShowAdjust(false);      
      if (obj.isSegmentedObject) {
        setObjects(prev => prev.filter(o => o.id !== obj.id));
      }
    } else {
      if (obj.isSegmentedObject) {
        setObjects(prev => prev.filter(o => o.id !== obj.id));
      }
    }
  };

  return (
    <ErrorBoundary>
    <div className="h-screen w-screen text-white relative bg-black">
      <Header
        openPopup={openPopup}
        handleLoadImages={handleLoadImages}
        setShowEditor={setShowEditor}
        droppedObjects={droppedObjects}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        uploadedImage={uploadedImage}
        zoom={displayZoom}
        hasUnsavedChanges={hasUnsavedChanges}
        onAdjust={() => {
          setShowAdjust(true);
          setShowLUTSelector(false);
          setShowHistory(false);
        }}
        onFilters={() => {
          setShowLUTSelector(true);
          setShowAdjust(false);
          setSelectedEditOption(null);
          setShowHistory(false);
        }}
        onHistory={() => {
          setShowHistory(true);
          setShowAdjust(false);
          setShowLUTSelector(false);
        }}
        onSave={saveImage}
        onDownload={downloadImage}
        onReset={resetFilters}
        onSegment={handleSegment}
        isSegmented={!!segmentationImageId}
      />

      <div>
        <ImageUpload
          setUploadedImage={setUploadedImage}
          handleImageUpload={handleImageUpload}
          closePopup={closePopup}
          popupState={popupState}
          inputRef={uploadInputRef}
        />

        {showImages && !showEditor ? (
          <div className="absolute inset-x-0 top-20 bottom-0 z-20 bg-background">
            <div className="mx-auto w-full max-w-xl px-4 pt-4">
              <div className="mb-2 flex items-center gap-3">
                <button
                  onClick={() => setShowImages(false)}
                  aria-label="Back"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-ink transition-colors hover:bg-surface-3 active:scale-95"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-semibold text-ink">Your library</h2>
              </div>
              <div className="flex justify-center">
                <AnimatedList
                  items={allImages}
                  onItemSelect={handleImageClick}
                  onItemDelete={handleImageDelete}
                  showGradients={true}
                  enableArrowNavigation={true}
                  displayScrollbar={true}
                  loaded={!!user}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Canvas
              setShowDropBox={setShowDropBox}
              uploadedImage={uploadedImage}
              objects={objects}
              selectedObject={selectedObject}
              setObjects={setObjects}
              setSelectedObject={setSelectedObject}
              onObjectDropped={handleObjectDropped}
              editorState={editorState}
              loadedLUT={loadedLUT}
              isSegmenting={isSegmenting}
              segmentationImageId={segmentationImageId}
              mergedSegments={mergedSegments}
              onZoomChange={setDisplayZoom}
              onDrawn={handleCanvasDrawn}
              addToast={addToast}
              onSegment={handleSegment}
            />

            {showAdjust && uploadedImage && (
              <AdjustBar
                editorState={editorState}
                selectedEditOption={selectedEditOption}
                setSelectedEditOption={setSelectedEditOption}
                execute={execute}
                Command={Command}
                resetFilters={resetFilters}
                onClose={() => {
                  setShowAdjust(false);
                  setSelectedEditOption(null);
                }}
              />
            )}
          </div>
        )}

        {uploadedImage && !showImages && !showEditor && !showAdjust && !showLUTSelector && (
          <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <CommandInput
              selectedObject={selectedObject}
              execute={execute}
              editorState={editorState}
              Command={Command}
              addToast={addToast}
            />
          </div>
        )}

        {showDropBox && (
          <DropBox ref={dropBoxRef}/>
        )}

        {showEditor &&
        <SegmentEditor
          setShowEditor={setShowEditor}
          droppedObjects={droppedObjects}
          onSave={handleApplyEditedSegments}
          addToast={addToast}
/>
          }
        
        {isApplyingLUT && uploadedImage && (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-black/75 px-5 py-3 backdrop-blur-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-accent" />
              <span className="text-sm font-medium text-ink">Applying filter…</span>
            </div>
          </div>
        )}

        {showLUTSelector && uploadedImage && (
          <LUTSlider
            onSelect={handleLUTSelect}
            currentLUT={editorState.selectedLUT}
            onClose={() => setShowLUTSelector(false)}
            uploadedImage={uploadedImage}
          />
        )}

        {uploadedImage && !showEditor &&!showImages && (
          <HistoryViewer
            uploadedImage={uploadedImage}
            initialState={initialEditorState}
            historyTree={historyTree}
            currentNodeId={currentNodeId}
            loadedLUT={loadedLUT}
            onJumpToNode={jumpToNodeWithLoader}
            isSaving={isSaving}
            addBranch={addBranch}
            editorState={editorState}
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            addToast={addToast}
          />
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default Editor;
