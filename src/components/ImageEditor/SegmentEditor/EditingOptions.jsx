import {Sun , Contrast, Droplet, Sparkles, RotateCw, ImageIcon, X, Palette} from "lucide-react"

export default function EditingOptions({setSelectedEditOption, selectedEditOption, brightness, contrast, saturation, blur, rotation, opacity, sharpen, hue, onClose, setSidebarView}){
    const handleOptionClick = (option) => {
        const isSelecting = selectedEditOption !== option;
        setSelectedEditOption(selectedEditOption === option ? null : option);

        if (isSelecting && onClose) {
            onClose();
        }
    };

    return (
        <div className="border-t border-white/10 pt-4">
            {onClose && (
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                    <h3 className="text-lg font-bold">Editing Options</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
            {setSidebarView && (
                <button
                    onClick={() => setSidebarView('background')}
                    className="w-full mb-4 px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600"
                >
                    <Palette size={18} />
                    <span className="font-medium">Background</span>
                </button>
            )}
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Image Adjustments</p>
            <div className="grid grid-cols-2 gap-2">
                <button
                onClick={() => handleOptionClick('brightness')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'brightness' ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <Sun size={16} className="text-yellow-400" />
                </div>
                <span className="text-xs text-gray-400">{brightness}%</span>
                </button>

                <button
                onClick={() => handleOptionClick('contrast')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'contrast' ? 'bg-blue-500/20 border-2 border-blue-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <Contrast size={16} className="text-blue-400" />
                </div>
                <span className="text-xs text-gray-400">{contrast}%</span>
                </button>

                <button
                onClick={() => handleOptionClick('saturation')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'saturation' ? 'bg-purple-500/20 border-2 border-purple-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <Droplet size={16} className="text-purple-400" />
                </div>
                <span className="text-xs text-gray-400">{saturation}%</span>
                </button>

                <button
                onClick={() => handleOptionClick('blur')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'blur' ? 'bg-pink-500/20 border-2 border-pink-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-pink-400" />
                </div>
                <span className="text-xs text-gray-400">{blur}px</span>
                </button>

                <button
                onClick={() => handleOptionClick('rotation')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'rotation' ? 'bg-green-500/20 border-2 border-green-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <RotateCw size={16} className="text-green-400" />
                </div>
                <span className="text-xs text-gray-400">{rotation}°</span>
                </button>

                <button
                onClick={() => handleOptionClick('opacity')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'opacity' ? 'bg-indigo-500/20 border-2 border-indigo-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <ImageIcon size={16} className="text-indigo-400" />
                </div>
                <span className="text-xs text-gray-400">{opacity}%</span>
                </button>

                <button
                onClick={() => handleOptionClick('sharpen')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'sharpen' ? 'bg-cyan-500/20 border-2 border-cyan-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-cyan-400" />
                </div>
                <span className="text-xs text-gray-400">{sharpen}</span>
                </button>

                <button
                onClick={() => handleOptionClick('hue')}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all ${
                    selectedEditOption === 'hue' ? 'bg-orange-500/20 border-2 border-orange-500' : 'bg-white/5 hover:bg-white/10 border-2 border-transparent'
                }`}
                >
                <div className="flex items-center gap-2">
                    <Palette size={16} className="text-orange-400" />
                </div>
                <span className="text-xs text-gray-400">{hue}°</span>
                </button>
            </div>
            </div>
    )
}