import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { useUser } from '../../store/UserContext';

const AnimatedItem = ({ item, delay = 0, index, onMouseEnter, onClick, onDelete, selected, loaded }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5, triggerOnce: false });
  const { fetchImage } = useUser();
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const imageName = loaded && item.original_name ? item.original_name : `Item ${index + 1}`;
  
  useEffect(() => {
    if (inView && loaded && item.stored_name && !imageData && !isLoading && !error) {
      setIsLoading(true);
      
      const fetchThumbnail = async () => {
        try {
          const accessToken = sessionStorage.getItem("access_token");
          if (!accessToken) {
            throw new Error("No access token available");
          }
          
          const response = await fetch(`http://localhost:8000/user/image/${item.stored_name}/thumbnail?size=300`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.base64) {
              setImageData(data);
              return;
            }
          }
          
          const fullImageData = await fetchImage(item.stored_name);
          if (fullImageData && fullImageData.base64) {
            setImageData(fullImageData);
          } else {
            setError(true);
          }
        } catch (err) {
          console.error('Failed to load image:', err);
          setError(true);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchThumbnail();
    }
  }, [inView, loaded, item.stored_name, imageData, isLoading, error, fetchImage]);

const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (e) => {
    e.stopPropagation();
    if (!onDelete || !item.stored_name) return;
    
    setIsDeleting(true);
    try {
      await onDelete(item.stored_name, item.original_name);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  let imageSrc;
  if (loaded && imageData?.base64) {
    imageSrc = `data:image/jpeg;base64,${imageData.base64}`;
  } else if (!loaded && item.src) {
    imageSrc = item.src;
  } else {
    imageSrc = null;
  }

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
      className={`group relative cursor-pointer rounded-lg overflow-hidden shadow-md transition-transform duration-200 ${
        selected ? "ring-2 ring-red-500 scale-105" : "hover:scale-[1.02]"
      }`}
    >
      {isLoading && (
        <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      
      {error && (
        <div className="w-full h-48 bg-gray-900 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <p className="text-xs">Failed to load</p>
          </div>
        </div>
      )}
      
      {imageSrc && !isLoading && !error && (
        <img
          src={imageSrc}
          alt={imageName}
          className="w-full h-48 object-cover select-none pointer-events-none"
          onError={() => setError(true)}
        />
      )}
      
      {!imageSrc && !isLoading && !error && (
        <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <p className="text-xs">No image</p>
          </div>
        </div>
      )}
      
      {loaded && item.stored_name && (
        <button
          onClick={handleDeleteClick}
          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 transition-colors duration-200 z-10 shadow-lg"
          title="Delete image"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 112 0v4a1 1 0 11-2 0V9zm4 0a1 1 0 112 0v4a1 1 0 11-2 0V9z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20 rounded-lg">
          <div className="bg-gray-800 p-4 rounded-lg text-center max-w-xs">
            <p className="text-white text-sm mb-3">Delete "{imageName}"?</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs flex items-center gap-1"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-3">
        <p className="text-white text-sm font-medium truncate">{imageName}</p>
      </div>
    </motion.div>
  );
};

const AnimatedList = ({
  items,
  onItemSelect,
  onItemDelete,
  showGradients = true,
  enableArrowNavigation = true,
  loaded,
  className = '',
  displayScrollbar = true,
  initialSelectedIndex = -1
}) => {
  const listRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const handleScroll = e => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1));
  };

  useEffect(() => {
    if (!enableArrowNavigation) return;
    const handleKeyDown = e => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          if (onItemSelect) {
            onItemSelect(items[selectedIndex], selectedIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const container = listRef.current;
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;
      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({
          top: itemBottom - containerHeight + extraMargin,
          behavior: 'smooth'
        });
      }
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  return (
    <div className={`relative w-[500px] ${className}`}>
      <div
        ref={listRef}
        className={`max-h-[650px] md:max-h-[600px] overflow-y-auto p-4 space-y-10 ${
          displayScrollbar
            ? '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#060010] [&::-webkit-scrollbar-thumb]:bg-[#222] [&::-webkit-scrollbar-thumb]:rounded-sm'
            : 'scrollbar-hide'
        }`}
        onScroll={handleScroll}
        style={{
          scrollbarWidth: displayScrollbar ? 'thin' : 'none',
          scrollbarColor: '#222 #060010'
        }}
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={loaded ? item.stored_name || index : index}
            item={item}
            delay={0.05 * index}
            index={index}
            selected={selectedIndex === index}
            loaded={loaded}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => {
              setSelectedIndex(index);
              if (onItemSelect) onItemSelect(item);
            }}
            onDelete={onItemDelete}
          />
        ))}
      </div>
      {showGradients && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-[50px] bg-linear-to-b from-[#060010] to-transparent pointer-events-none transition-opacity duration-300 ease"
            style={{ opacity: topGradientOpacity }}
          ></div>
          <div
            className="absolute bottom-0 left-0 right-0 h-[100px] bg-linear-to-t from-[#060010] to-transparent pointer-events-none transition-opacity duration-300 ease"
            style={{ opacity: bottomGradientOpacity }}
          ></div>
        </>
      )}
    </div>
  );
};

export default AnimatedList;
