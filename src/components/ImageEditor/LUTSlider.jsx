import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { getAvailableLUTs } from './LUTUtils';

export default function LUTSlider({ onSelect, currentLUT, onClose }) {
  const [luts, setLuts] = useState([]);
  const scrollContainerRef = useRef(null);
  
  useEffect(() => {
    setLuts(getAvailableLUTs());
  }, []);
  
  const handleLUTClick = (lut) => {
    onSelect(lut);
  };
  
  const handleRemoveLUT = () => {
    onSelect(null);
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-white/20 z-50 pb-4">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Apply Filters</h3>
            {currentLUT && (
              <span className="text-sm text-gray-400 bg-white/10 px-3 py-1 rounded-full">
                {currentLUT.name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
          }}
        >
          <button
            onClick={handleRemoveLUT}
            className={`shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${
              !currentLUT
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-white/20 hover:border-white/40'
            }`}
            style={{ width: '120px' }}
          >
            <div className="aspect-square bg-linear-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center p-3">
              {!currentLUT && (
                <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                  <Check size={16} />
                </div>
              )}
              <X size={32} className="text-gray-400 mb-2" />
              <p className="text-xs font-medium text-center text-white">
                None
              </p>
            </div>
          </button>
          
          {luts.map((lut) => {
            const isSelected = currentLUT?.file === lut.file;
            
            return (
              <button
                key={lut.file}
                onClick={() => handleLUTClick(lut)}
                className={`shrink-0 relative overflow-hidden rounded-xl transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-white/20 hover:border-white/40'
                }`}
                style={{ width: '120px' }}
                title={lut.name}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 z-10">
                    <Check size={16} />
                  </div>
                )}
                
                <div className="aspect-square bg-linear-to-br rounded-full from-purple-900/40 via-pink-900/40 to-orange-900/40 flex items-center justify-center p-2">
                  <div className="text-3xl font-bold text-white/30">
                    {lut.name.charAt(0)}
                  </div>
                </div>
                
                <div className=" px-2 py-2">
                  <p className="text-xs font-medium text-center truncate text-white">
                    {lut.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        
        <p className="text-xs text-gray-400 text-center mt-3">
          Scroll to browse • {luts.length} filters available
        </p>
      </div>
    </div>
  );
}
