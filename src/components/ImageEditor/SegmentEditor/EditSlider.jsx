import { Sun, Contrast, Droplet, Sparkles, RotateCw, ImageIcon, Palette, X} from "lucide-react";

export default function EditSlider({selectedEditOption, brightness, contrast, saturation, blur, rotation, opacity, sharpen, hue, setBrightness, setContrast, setSaturation, setBlur, setRotation, setOpacity, setSharpen, setHue, setSelectedEditOption}){
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
                    {selectedEditOption === 'brightness' && `${brightness}%`}
                    {selectedEditOption === 'contrast' && `${contrast}%`}
                    {selectedEditOption === 'saturation' && `${saturation}%`}
                    {selectedEditOption === 'blur' && `${blur}px`}
                    {selectedEditOption === 'rotation' && `${rotation}°`}
                    {selectedEditOption === 'opacity' && `${opacity}%`}
                    {selectedEditOption === 'sharpen' && sharpen}
                    {selectedEditOption === 'hue' && `${hue}°`}
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
                value={
                selectedEditOption === 'brightness' ? brightness :
                selectedEditOption === 'contrast' ? contrast :
                selectedEditOption === 'saturation' ? saturation :
                selectedEditOption === 'blur' ? blur :
                selectedEditOption === 'rotation' ? rotation :
                selectedEditOption === 'opacity' ? opacity :
                selectedEditOption === 'sharpen' ? sharpen :
                selectedEditOption === 'hue' ? hue : 0
                }
                onChange={(e) => {
                const value = parseInt(e.target.value);
                if (selectedEditOption === 'brightness') setBrightness(value);
                else if (selectedEditOption === 'contrast') setContrast(value);
                else if (selectedEditOption === 'saturation') setSaturation(value);
                else if (selectedEditOption === 'blur') setBlur(value);
                else if (selectedEditOption === 'rotation') setRotation(value);
                else if (selectedEditOption === 'opacity') setOpacity(value);
                else if (selectedEditOption === 'sharpen') setSharpen(value);
                else if (selectedEditOption === 'hue') setHue(value);
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