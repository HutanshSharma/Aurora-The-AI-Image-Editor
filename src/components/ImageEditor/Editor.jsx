import { useState, useRef } from 'react';
import ImageUpload from './ImageUpload';
import Header from './Header';
import Canvas from './Canvas';
import CommandInput from './CommandInput';
import AnimatedList from './AnimatedList';
import DropBox from './DropBox';
import SegmentEditor from './SegmentEditor/SegmentEditor';

const Editor = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [allImages, setallImages] = useState([]);
  const [showImages, setShowImages] = useState(false);
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [popupState, setPopupState] = useState('');
  const [showDropBox, setShowDropBox] = useState(false);
  const [droppedObjects, setDroppedObjects] = useState([]);
  const [showEditor, setShowEditor] = useState(false)

  const dropBoxRef = useRef(null);

  const openPopup = () => setPopupState('open-popup');
  const closePopup = () => {
    setPopupState('close-popup');
    setTimeout(() => setPopupState('hide'), 350);
  };

  const simulateAISegmentation = () => {
    const imageUrls = [
      "https://images.unsplash.com/photo-1761839257658-23502c67f6d5?q=80&w=1170&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1761839257469-96c78a7c2dd3?q=80&w=1169&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1762705402471-8f0cf07d694f?q=80&w=1974&auto=format&fit=crop"
    ];

    const mockObjects = imageUrls.map((url, index) => ({
      id: index + 1,
      x: 100 + index * 150,
      y: 100,
      width: 120,
      height: 120,
      name: `Object ${index + 1}`,
      image: new Image(),
    }));

    mockObjects.forEach((obj, i) => {
      obj.image.crossOrigin = "anonymous";
      obj.image.src = imageUrls[i];
    });

    setObjects(mockObjects);
  };

  const handleLoadImages = () => setShowImages(prev => !prev);

  const handleImageClick = (img) => {
    setUploadedImage(img);
    setShowImages(prev => !prev);
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
      setDroppedObjects(prev=>[...prev,obj]);
      setShowEditor(true)
    }
  };

  return (
    <div className="h-screen w-screen text-white relative bg-black">
      <Header
        openPopup={openPopup}
        handleLoadImages={handleLoadImages}
        setShowEditor={setShowEditor}
        droppedObjects={droppedObjects}
      />

      <div>
        <ImageUpload
          setAllImages={setallImages}
          setUploadedImage={setUploadedImage}
          simulateAISegmentation={simulateAISegmentation}
          closePopup={closePopup}
          popupState={popupState}
        />

        {showImages && !showEditor ? (
          <div className="absolute top-35 md:top-20 w-full bg-black">
            <div className="flex justify-center">
              <AnimatedList
                items={allImages}
                onItemSelect={handleImageClick}
                showGradients={true}
                enableArrowNavigation={true}
                displayScrollbar={true}
              />
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
            />
          </div>
        )}

        {uploadedImage && !showImages && !showEditor && (
          <CommandInput selectedObject={selectedObject} className={'absolute bottom-0'}/>
        )}

        {showDropBox && (
          <DropBox ref={dropBoxRef}/>
        )}

        {showEditor && 
        <SegmentEditor
          setShowEditor={setShowEditor}
          droppedObjects={droppedObjects}
          onSave={(editedObjects) => {
          setDroppedObjects(editedObjects);
  }}
/>
          }
      </div>
    </div>
  );
};

export default Editor;
