import { Sun, Contrast, Droplet, Sparkles, RotateCw, ImageIcon, Palette, X} from "lucide-react";
import { useRef, useState } from "react";

// Command class for EditSlider
class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

export default function EditSlider({selectedEditOption, editorState, execute, setSelectedEditOption}){
    const [isDragging, setIsDragging] = useState(false);
    const startValueRef = useRef(null);

    const getValue = () => {
        if (selectedEditOption === 'brightness') return editorState.brightness;
        if (selectedEditOption === 'contrast') return editorState.contrast;
        if (selectedEditOption === 'saturation') return editorState.saturation;
        if (selectedEditOption === 'blur') return editorState.blur;
        if (selectedEditOption === 'rotation') return editorState.rotation;
        if (selectedEditOption === 'opacity') return editorState.opacity;
        if (selectedEditOption === 'sharpen') return editorState.sharpen;
        if (selectedEditOption === 'hue') return editorState.hue;
        return 0;
    };

    const handleSliderStart = () => {
        setIsDragging(true);
        startValueRef.current = getValue();
    };

    const handleSliderEnd = () => {
        if (isDragging && startValueRef.current !== null) {
            const currentValue = getValue();
            const startValue = startValueRef.current;
            
            // Only create command if value actually changed
            if (startValue !== currentValue) {
                execute(new Command(
                    (s) => ({ ...s, [selectedEditOption]: currentValue }),
                    (s) => ({ ...s, [selectedEditOption]: startValue })
                ), false); // false - add to history immediately, not debounced
            }
        }
        setIsDragging(false);
        startValueRef.current = null;
    };

    const handleChange = (value) => {
        if (isDragging) {
            // During dragging, update state immediately for visual feedback
            // but don't add to history (that happens in handleSliderEnd)
            execute(new Command(
                (s) => ({ ...s, [selectedEditOption]: value }),
                (s) => ({ ...s, [selectedEditOption]: s[selectedEditOption] })
            ), true); // true indicates this is a temporary slider command (debounced/ignored for history)
        } else {
            // Direct click/keyboard input - create command immediately
            const oldValue = getValue();
            execute(new Command(
                (s) => ({ ...s, [selectedEditOption]: value }),
                (s) => ({ ...s, [selectedEditOption]: oldValue })
            ), false); // false - add to history immediately
        }
    };

    return (
        <div className="absolute bottom-7 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl px-6 py-4 z-20 w-80 md:w-96">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                {selectedEditOption === 'brightness' && <Sun size={18} className="text-yellow-400" />}
                {selectedEditOption === 'contrast' && <Contrast size={18} className="text-blue-400" />}
                {selectedEditOption === 'saturation' && <Droplet size={18} className="text-purple-400" />}
                {selectedEditOption === 'blur' && <Sparkles size={18} className="text-pink-400" />}
                {selectedEditOption === 'rotation' && <RotateCw size={18} className="text-green-400" />}
                {selectedEditOption === 'opacity' && <ImageIcon size={18} className="text-indigo-400" />}
                {selectedEditOption === 'sharpen' && <Sparkles size={18} className="text-cyan-400" />}
                {selectedEditOption === 'hue' && <Palette size={18} className="text-orange-400" />}
                <span className="font-semibold capitalize">{selectedEditOption}</span>
                </div>
                <div className="flex items-center gap-3">
                <span className="text-sm font-mono">
                    {selectedEditOption === 'brightness' && `${editorState.brightness}%`}
                    {selectedEditOption === 'contrast' && `${editorState.contrast}%`}
                    {selectedEditOption === 'saturation' && `${editorState.saturation}%`}
                    {selectedEditOption === 'blur' && `${editorState.blur}px`}
                    {selectedEditOption === 'rotation' && `${editorState.rotation}°`}
                    {selectedEditOption === 'opacity' && `${editorState.opacity}%`}
                    {selectedEditOption === 'sharpen' && editorState.sharpen}
                    {selectedEditOption === 'hue' && `${editorState.hue}°`}
                </span>
                <button
                    onClick={() => setSelectedEditOption(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Close"
                >
                    <X size={16} />
                </button>
                </div>
            </div>
            <input
                type="range"
                min={selectedEditOption === 'blur' ? 0 : selectedEditOption === 'opacity' ? 0 : selectedEditOption === 'sharpen' ? 0 : selectedEditOption === 'rotation' || selectedEditOption === 'hue' ? 0 : 0}
                max={selectedEditOption === 'blur' ? 20 : selectedEditOption === 'opacity' ? 100 : selectedEditOption === 'sharpen' ? 100 : selectedEditOption === 'rotation' || selectedEditOption === 'hue' ? 360 : 200}
                value={getValue()}
                onMouseDown={handleSliderStart}
                onTouchStart={handleSliderStart}
                onMouseUp={handleSliderEnd}
                onTouchEnd={handleSliderEnd}
                onChange={(e) => {
                    const value = parseInt(e.target.value);
                    handleChange(value);
                }}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                accentColor: selectedEditOption === 'brightness' ? '#facc15' :
                                selectedEditOption === 'contrast' ? '#3b82f6' :
                                selectedEditOption === 'saturation' ? '#a855f7' :
                                selectedEditOption === 'blur' ? '#ec4899' :
                                selectedEditOption === 'rotation' ? '#10b981' :
                                selectedEditOption === 'opacity' ? '#6366f1' :
                                selectedEditOption === 'sharpen' ? '#06b6d4' :
                                selectedEditOption === 'hue' ? '#f97316' : '#fff'
                }}
            />
            </div>
    )
}