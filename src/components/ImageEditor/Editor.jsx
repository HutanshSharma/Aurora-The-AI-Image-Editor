import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import ImageUpload from './ImageUpload';
import Header from './Header';
import Canvas from './Canvas';
import CommandInput from './CommandInput';
import AnimatedList from './AnimatedList';

const Editor = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [allImages, setallImages] = useState([]);
  const [showImages, setShowImages] = useState(false)
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [lastTap, setLastTap] = useState(0);
  const [popupState, setPopupState] = useState('');

    const openPopup = () => {
        setPopupState('open-popup');
    };

    const closePopup = () => {
        setPopupState('close-popup');
        setTimeout(() => {
        setPopupState('hide');
        }, 350);
    };
  const dropZoneRef = useRef(null);

  const simulateAISegmentation = (img) => {
    const mockObjects = [
      { id: 1, x: 50, y: 50, width: 100, height: 100, name: 'Object 1' },
      { id: 2, x: 200, y: 150, width: 120, height: 80, name: 'Object 2' },
      { id: 3, x: 350, y: 80, width: 90, height: 120, name: 'Object 3' }
    ];
    setObjects(mockObjects);
  };

  const handleLoadImages = () =>{
    setShowImages(prev=>!prev)
  }

  const saveToHistory = (img, objs) => {
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push({ image: img, objects: [...objs], timestamp: Date.now() });
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (zoom > 1) {
        setZoom(1);
      } else {
        setShowHistory(!showHistory);
      }
    }
    setLastTap(now);
  };


  const handleImageClick = (img) => {
    setUploadedImage(img)
    setShowImages(prev=>!prev)
  };

  return (
    <div className="h-screen w-screen text-white relative bg-black">
        <Header setObjects={setObjects} setHistoryIndex={setHistoryIndex} historyIndex={historyIndex} editHistory={editHistory} setUploadedImage={setUploadedImage} openPopup={openPopup} handleLoadImages={handleLoadImages} />
      <div>
          <ImageUpload setAllImages={setallImages} setUploadedImage={setUploadedImage} simulateAISegmentation={simulateAISegmentation} closePopup={closePopup} popupState={popupState} saveToHistory={saveToHistory}/>
          {showImages ? 
          <div className='absolute top-35 md:top-20 w-full bg-black'>
            <div className='flex justify-center '>
            <AnimatedList
              items={allImages} 
              onItemSelect={handleImageClick}
              showGradients={true}
              enableArrowNavigation={true}
              displayScrollbar={true}
            />
            </div>
          </div> :
          (<div className="relative">
            {/* <div
              ref={dropZoneRef}
              className="absolute top-4 right-4 z-20 bg-blue-500/20 border-2 border-dashed border-blue-400 rounded-xl p-4 transition-all"
            >
              <Sliders size={32} className="text-blue-400" />
              <p className="text-xs mt-2">Drop here to edit</p>
            </div> */}

            <Canvas handleDoubleTap={handleDoubleTap}
            uploadedImage={uploadedImage}
            objects={objects}
            selectedObject={selectedObject}/>
          </div>)}
       

        {/* History View */}
        {showHistory && editHistory.length > 0 && (
          <div className="mt-6 bg-black/30 backdrop-blur-md rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {editHistory.map((state, index) => (
                <button
                  key={state.timestamp}
                  onClick={() => {
                    setObjects(state.objects);
                    setHistoryIndex(index);
                    setShowHistory(false);
                  }}
                  className={`shrink-0 ${
                    index === historyIndex ? 'ring-2 ring-blue-400' : ''
                  }`}
                >
                  <div className="w-32 h-32 bg-white/5 rounded-lg overflow-hidden relative group">
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                    <p className="absolute bottom-2 left-2 text-xs">
                      Step {index + 1}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {uploadedImage && !showImages && (
          <CommandInput selectedObject={selectedObject} />
        )}
      </div>

      {/* Object Editor Modal */}
      {showEditor && selectedObject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Edit Object</h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm mb-2">Position</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">X</p>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      value={selectedObject.x}
                      onChange={(e) => {
                        setObjects(objects.map(obj =>
                          obj.id === selectedObject.id ? { ...obj, x: parseInt(e.target.value) } : obj
                        ));
                        setSelectedObject({ ...selectedObject, x: parseInt(e.target.value) });
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Y</p>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      value={selectedObject.y}
                      onChange={(e) => {
                        setObjects(objects.map(obj =>
                          obj.id === selectedObject.id ? { ...obj, y: parseInt(e.target.value) } : obj
                        ));
                        setSelectedObject({ ...selectedObject, y: parseInt(e.target.value) });
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Size</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Width</p>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      value={selectedObject.width}
                      onChange={(e) => {
                        setObjects(objects.map(obj =>
                          obj.id === selectedObject.id ? { ...obj, width: parseInt(e.target.value) } : obj
                        ));
                        setSelectedObject({ ...selectedObject, width: parseInt(e.target.value) });
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Height</p>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      value={selectedObject.height}
                      onChange={(e) => {
                        setObjects(objects.map(obj =>
                          obj.id === selectedObject.id ? { ...obj, height: parseInt(e.target.value) } : obj
                        ));
                        setSelectedObject({ ...selectedObject, height: parseInt(e.target.value) });
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Background Options</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Sky', 'Forest', 'Ocean'].map(bg => (
                    <button
                      key={bg}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  saveToHistory(uploadedImage, objects);
                  setShowEditor(false);
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 py-3 rounded-lg font-semibold transition-all"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;