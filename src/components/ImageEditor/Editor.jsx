import { useState, useRef, useEffect } from 'react';
import ErrorBoundary from '../ErrorBoundary';
import ImageUpload from './ImageUpload';
import Header from './Header';
import Canvas from './Canvas';
import CommandInput from './CommandInput';
import AnimatedList from './AnimatedList';
import DropBox from './DropBox';
import SegmentEditor from './SegmentEditor/SegmentEditor';
import EditSlider from './SegmentEditor/EditSlider';
import useHistory from '../../hooks/useHistory';
import { useUser } from '../../store/UserContext';
import EditingSidebar from './EditingSidebar';
import LUTSlider from './LUTSlider';
import HistoryViewer from './HistoryViewer';
import { loadLUT } from './LUTUtils.js';
import { uploadAndSegment, imageToBase64 } from './SegmentationAPI.js';
import watermarkImg from '../../assets/watermark.png';

export class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

const Editor = () => {
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
  const [showEditingSidebar, setShowEditingSidebar] = useState(false);
  const [loadedLUT, setLoadedLUT] = useState(null);
  const [showLUTSelector, setShowLUTSelector] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [segmentationImageId, setSegmentationImageId] = useState(null);
  const [mergedSegments, setMergedSegments] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {user, fetchImage, uploadImage, deleteImage} = useUser();
  const dropBoxRef = useRef(null);

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
    addBranch,
    initialState: historyInitialState
  } = useHistory(initialEditorState);

  useEffect(() => {
    if (user && user.images && user.images.length > 0) {
      setallImages(user.images);
    } else if (user && (!user.images || user.images.length === 0)) {
      setallImages([]);
    }
  }, [user]);

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

  const handleImageDelete = async (stored_name, original_name) => {
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
      
      img.onload = async () => {        
        setUploadedImage(img);
        setShowImages(false);        
        setIsSegmenting(true);
        try {
          const imageBase64 = imageToBase64(img);
          const result = await uploadAndSegment(imageBase64);
          setSegmentationImageId(result.image_id);          
          if (result.compressedImage && (result.compressedWidth !== img.width || result.compressedHeight !== img.height)) {
            const compressedImg = new Image();
            compressedImg.src = result.compressedImage;
            compressedImg.onload = () => {
              setUploadedImage(compressedImg);
            };
          }
        } catch (error) {
          alert('Segmentation failed. Make sure the backend server is running on http://localhost:8000');
          setShowImages(false);
        } finally {
          setIsSegmenting(false);
        }
      };
      
      img.onerror = () => {
        console.error("Failed to load image");
      };
    } catch (error) {
      console.error("Error in handleImageClick:", error);
    }
  };

  const openPopup = () => {
    setPopupState('open-popup');
    setShowEditingSidebar(false);
  };
  const closePopup = () => {
    setPopupState('close-popup');
    setTimeout(() => setPopupState('hide'), 350);
  };

  const handleLoadImages = () => {
    setShowImages(prev => !prev);
    setShowEditingSidebar(false);
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
        resegmentImage(mergedImage);
        resolve();
      };
      mergedImage.src = canvas.toDataURL('image/png', 1.0);
    });
  };

  const resegmentImage = async (img) => {
    setIsSegmenting(true);
    try {
      const imageBase64 = imageToBase64(img);
      const result = await uploadAndSegment(imageBase64);
      setSegmentationImageId(result.image_id);
    } catch (error) {
      console.error('✗ Re-segmentation failed:', error);
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
      setShowEditingSidebar(false);      
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
        setShowEditingSidebar={setShowEditingSidebar}
        showEditingSidebar={showEditingSidebar}
      />

      <div>
        <ImageUpload
          setUploadedImage={setUploadedImage}
          handleImageUpload={handleImageUpload}
          closePopup={closePopup}
          popupState={popupState}
          setIsSegmenting={setIsSegmenting}
          setSegmentationImageId={setSegmentationImageId}
        />

        {showImages && !showEditor ? (
          <div className="absolute top-35 md:top-20 w-full bg-black">
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
        ) : (
          <div className="relative">
            {showEditingSidebar && uploadedImage && (
              <div 
                className="fixed inset-0 bg-black/50 z-30 md:hidden"
                style={{ top: '80px' }}
                onClick={() => setShowEditingSidebar(false)}
              />
            )}
            
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
            />
            
            <div className={`md:hidden fixed inset-y-0 right-0 w-80 bg-[rgba(0,0,0,0.1)] border-l border-white/10 overflow-y-auto transform transition-transform duration-300 ease-in-out z-40 ${
                (showEditingSidebar && uploadedImage) ? 'translate-x-0' : 'translate-x-full'
              }`}>
                <EditingSidebar 
                setSelectedEditOption={setSelectedEditOption}
                selectedEditOption={selectedEditOption}
                editorState={editorState}
                setShowEditingSidebar={setShowEditingSidebar}
                downloadImage={downloadImage}
                resetFilters={resetFilters}
                execute={execute}
                Command={Command}
                setShowLUTSelector={setShowLUTSelector}
                />
            </div>

            {uploadedImage && selectedEditOption && (
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
                <EditSlider
                  selectedEditOption={selectedEditOption}
                  editorState={editorState}
                  execute={execute}
                  setSelectedEditOption={setSelectedEditOption}
                />
              </div>
            )}
          </div>
        )}

        {uploadedImage && !showImages && !showEditor && (
          <CommandInput 
            selectedObject={selectedObject} 
            className={'absolute bottom-0'}
            execute={execute}
            editorState={editorState}
            Command={Command}
          />
        )}

        {showDropBox && (
          <DropBox ref={dropBoxRef}/>
        )}

        {showEditor && 
        <SegmentEditor
          setShowEditor={setShowEditor}
          droppedObjects={droppedObjects}
          onSave={handleApplyEditedSegments}
/>
          }
        
        {showLUTSelector && uploadedImage && (
          <LUTSlider
            onSelect={handleLUTSelect}
            currentLUT={editorState.selectedLUT}
            onClose={() => setShowLUTSelector(false)}
          />
        )}

        {uploadedImage && !showEditor &&!showImages && (
          <HistoryViewer
            uploadedImage={uploadedImage}
            initialState={initialEditorState}
            historyTree={historyTree}
            currentNodeId={currentNodeId}
            loadedLUT={loadedLUT}
            onJumpToNode={jumpToNode}
            saveImage={saveImage}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            addBranch={addBranch}
            editorState={editorState}
          />
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default Editor;
