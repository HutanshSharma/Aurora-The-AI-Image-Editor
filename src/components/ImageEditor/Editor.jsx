import { useState, useRef, useEffect } from 'react';
import ImageUpload from './ImageUpload';
import Header from './Header';
import Canvas from './Canvas';
import CommandInput from './CommandInput';
import AnimatedList from './AnimatedList';
import DropBox from './DropBox';
import SegmentEditor from './SegmentEditor/SegmentEditor';
import { useUser } from '../../store/UserContext';

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

  const {user, fetchImage, uploadImage, deleteImage} = useUser()
  const dropBoxRef = useRef(null);

  useEffect(() => {
    if (user && user.images && user.images.length > 0) {
      setallImages(user.images);
    } else if (user && (!user.images || user.images.length === 0)) {
      setallImages([]);
    }
  }, [user]);

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
          setUploadedImage={setUploadedImage}
          handleImageUpload={handleImageUpload}
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
