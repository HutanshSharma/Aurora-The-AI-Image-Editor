import {X, Upload, Sparkles, Download } from "lucide-react"

export default function BackgroundPanel({setSidebarView, canvasSize, setCanvasSize, setBackgroundColor, setCustomBackground,backgroundColor,
    backgroundInputRef, handleCustomBackgroundUpload, customBackground, backgroundScale, setBackgroundScale, backgroundPos,
    setBackgroundPos, imageScale, setImagePos, setImageScale, imagePos, saveImageWithBackground, onClose
}){
    const mockBackgrounds = [
        { id: 'bg-white', name: 'White', color: '#ffffff' },
        { id: 'bg-black', name: 'Black', color: '#000000' },
        { id: 'bg-light-gray', name: 'Light Gray', color: '#e5e7eb' },
        { id: 'bg-dark-gray', name: 'Dark Gray', color: '#1f2937' },
        { id: 'bg-blue', name: 'Blue', color: '#3b82f6' },
        { id: 'bg-red', name: 'Red', color: '#ef4444' },
        { id: 'bg-green', name: 'Green', color: '#10b981' },
        { id: 'bg-purple', name: 'Purple', color: '#8b5cf6' },
        { id: 'bg-yellow', name: 'Yellow', color: '#fbbf24' },
        { id: 'bg-pink', name: 'Pink', color: '#ec4899' },
        { id: 'bg-cyan', name: 'Cyan', color: '#06b6d4' },
        { id: 'bg-orange', name: 'Orange', color: '#f97316' },
    ];

    return (
        <>
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="text-lg font-bold">Background Settings</h3>
            <button
                onClick={onClose ? onClose : () => setSidebarView('editing')}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
                title={onClose ? "Close" : "Back to Editing"}
            >
                <X size={20} />
            </button>
            </div>

        <div className="space-y-3">
            <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Canvas Size</p>
            <div className="grid grid-cols-2 gap-2">
                <div>
                <label className="text-xs text-gray-500">Width</label>
                <input
                    type="number"
                    value={canvasSize.width}
                    onChange={(e) => setCanvasSize(prev => ({ ...prev, width: parseInt(e.target.value) || 800 }))}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
                    min="100"
                    max="4000"
                />
                </div>
                <div>
                <label className="text-xs text-gray-500">Height</label>
                <input
                    type="number"
                    value={canvasSize.height}
                    onChange={(e) => setCanvasSize(prev => ({ ...prev, height: parseInt(e.target.value) || 600 }))}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
                    min="100"
                    max="4000"
                />
                </div>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
                <button onClick={() => setCanvasSize({ width: 1920, height: 1080 })} className="flex-1 text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded">1920×1080</button>
                <button onClick={() => setCanvasSize({ width: 1080, height: 1080 })} className="flex-1 text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded">1080×1080</button>
                <button onClick={() => setCanvasSize({ width: 1080, height: 1920 })} className="flex-1 text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded">1080×1920</button>
            </div>
            </div>

            <div className="border-t border-white/10 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase">Color Backgrounds</p>
            <div className="grid grid-cols-4 gap-2 mt-2">
                {mockBackgrounds.map((bg) => (
                <button
                    key={bg.id}
                    onClick={() => {
                    setBackgroundColor(bg.color);
                    setCustomBackground(null);
                    }}
                    className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    backgroundColor === bg.color ? 'border-blue-400 ring-2 ring-blue-400/50' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: bg.color }}
                    title={bg.name}
                />
                ))}
            </div>
            </div>
            
            <div className="border-t border-white/10 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Custom Background</p>
            <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomBackgroundUpload}
                className="hidden"
            />
            <button
                onClick={() => backgroundInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
            >
                <Upload size={16} />
                <span className="text-sm">Upload Background</span>
            </button>
            {customBackground && (
                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                <Sparkles size={12} />
                Custom background loaded
                </div>
            )}
            </div>

            {/* Background Controls */}
            {(backgroundColor || customBackground) && (
            <div className="border-t border-white/10 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Background Controls</p>
                
                <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Scale</label>
                    <span className="text-xs text-gray-400">{Math.round(backgroundScale * 100)}%</span>
                </div>
                <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={backgroundScale}
                    onChange={(e) => setBackgroundScale(parseFloat(e.target.value))}
                    className="w-full"
                />
                </div>

                <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Position X</label>
                    <span className="text-xs text-gray-400">{backgroundPos.x}px</span>
                </div>
                <input
                    type="range"
                    min="-500"
                    max="500"
                    value={backgroundPos.x}
                    onChange={(e) => setBackgroundPos(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                    className="w-full"
                />
                </div>

                <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Position Y</label>
                    <span className="text-xs text-gray-400">{backgroundPos.y}px</span>
                </div>
                <input
                    type="range"
                    min="-500"
                    max="500"
                    value={backgroundPos.y}
                    onChange={(e) => setBackgroundPos(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                    className="w-full"
                />
                </div>
            </div>
            )}
            <div className="border-t border-white/10 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Image Controls</p>
            
            <div>
                <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Scale</label>
                <span className="text-xs text-gray-400">{Math.round(imageScale * 100)}%</span>
                </div>
                <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={imageScale}
                onChange={(e) => setImageScale(parseFloat(e.target.value))}
                className="w-full"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Position X</label>
                <span className="text-xs text-gray-400">{imagePos.x}px</span>
                </div>
                <input
                type="range"
                min="-500"
                max="500"
                value={imagePos.x}
                onChange={(e) => setImagePos(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                className="w-full"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Position Y</label>
                <span className="text-xs text-gray-400">{imagePos.y}px</span>
                </div>
                <input
                type="range"
                min="-500"
                max="500"
                value={imagePos.y}
                onChange={(e) => setImagePos(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                className="w-full"
                />
            </div>
            </div>

            <div className="border-t border-white/10 pt-3">
            <button
                onClick={saveImageWithBackground}
                disabled={!backgroundColor && !customBackground}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg transition-all"
            >
                <Download size={16} />
                <span className="text-sm">Save with Background</span>
            </button>
            </div>

            {(backgroundColor || customBackground) && (
            <button
                onClick={() => {
                setBackgroundColor(null);
                setCustomBackground(null);
                }}
                className="w-full text-xs text-red-400 hover:text-red-300 transition-colors"
            >
                Clear Background
            </button>
            )}
        </div>
        </>
    )
}