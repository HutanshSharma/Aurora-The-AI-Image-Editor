import {X, Upload, Sparkles, Download } from "lucide-react"

// Command class for BackgroundPanel
class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

export default function BackgroundPanel({setSidebarView, canvasSize, setCanvasSize, editorState, execute,
    backgroundInputRef, handleCustomBackgroundUpload, saveImageWithBackground, onClose
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
                        execute(new Command(
                            (s) => ({ ...s, backgroundColor: bg.color, customBackground: null }),
                            (s) => ({ ...s, backgroundColor: s.backgroundColor, customBackground: s.customBackground })
                        ));
                    }}
                    className={`aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    editorState.backgroundColor === bg.color ? 'border-blue-400 ring-2 ring-blue-400/50' : 'border-white/20'
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
            {editorState.customBackground && (
                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                <Sparkles size={12} />
                Custom background loaded
                </div>
            )}
            </div>

            {/* Background Controls */}
            {(editorState.backgroundColor || editorState.customBackground) && (
            <div className="border-t border-white/10 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Background Controls</p>
                
                <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Scale</label>
                    <span className="text-xs text-gray-400">{Math.round(editorState.backgroundScale * 100)}%</span>
                </div>
                <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={editorState.backgroundScale}
                    onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        execute(new Command(
                            (s) => ({ ...s, backgroundScale: value }),
                            (s) => ({ ...s, backgroundScale: s.backgroundScale })
                        ), true); // true for slider debouncing
                    }}
                    className="w-full"
                />
                </div>

                <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Position X</label>
                    <span className="text-xs text-gray-400">{editorState.backgroundPos.x}px</span>
                </div>
                <input
                    type="range"
                    min="-500"
                    max="500"
                    value={editorState.backgroundPos.x}
                    onChange={(e) => {
                        const value = parseInt(e.target.value);
                        execute(new Command(
                            (s) => ({ ...s, backgroundPos: { ...s.backgroundPos, x: value } }),
                            (s) => ({ ...s, backgroundPos: { ...s.backgroundPos, x: s.backgroundPos.x } })
                        ), true); // true for slider debouncing
                    }}
                    className="w-full"
                />
                </div>

                <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Position Y</label>
                    <span className="text-xs text-gray-400">{editorState.backgroundPos.y}px</span>
                </div>
                <input
                    type="range"
                    min="-500"
                    max="500"
                    value={editorState.backgroundPos.y}
                    onChange={(e) => {
                        const value = parseInt(e.target.value);
                        execute(new Command(
                            (s) => ({ ...s, backgroundPos: { ...s.backgroundPos, y: value } }),
                            (s) => ({ ...s, backgroundPos: { ...s.backgroundPos, y: s.backgroundPos.y } })
                        ), true); // true for slider debouncing
                    }}
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
                <span className="text-xs text-gray-400">{Math.round(editorState.imageScale * 100)}%</span>
                </div>
                <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={editorState.imageScale}
                onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    execute(new Command(
                        (s) => ({ ...s, imageScale: value }),
                        (s) => ({ ...s, imageScale: s.imageScale })
                    ), true); // true for slider debouncing
                }}
                className="w-full"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Position X</label>
                <span className="text-xs text-gray-400">{editorState.imagePos.x}px</span>
                </div>
                <input
                type="range"
                min="-500"
                max="500"
                value={editorState.imagePos.x}
                onChange={(e) => {
                    const value = parseInt(e.target.value);
                    execute(new Command(
                        (s) => ({ ...s, imagePos: { ...s.imagePos, x: value } }),
                        (s) => ({ ...s, imagePos: { ...s.imagePos, x: s.imagePos.x } })
                    ), true); // true for slider debouncing
                }}
                className="w-full"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Position Y</label>
                <span className="text-xs text-gray-400">{editorState.imagePos.y}px</span>
                </div>
                <input
                type="range"
                min="-500"
                max="500"
                value={editorState.imagePos.y}
                onChange={(e) => {
                    const value = parseInt(e.target.value);
                    execute(new Command(
                        (s) => ({ ...s, imagePos: { ...s.imagePos, y: value } }),
                        (s) => ({ ...s, imagePos: { ...s.imagePos, y: s.imagePos.y } })
                    ), true); // true for slider debouncing
                }}
                className="w-full"
                />
            </div>
            </div>

            <div className="border-t border-white/10 pt-3">
            <button
                onClick={saveImageWithBackground}
                disabled={!editorState.backgroundColor && !editorState.customBackground}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg transition-all"
            >
                <Download size={16} />
                <span className="text-sm">Save with Background</span>
            </button>
            </div>

            {(editorState.backgroundColor || editorState.customBackground) && (
            <button
                onClick={() => {
                    execute(new Command(
                        (s) => ({ ...s, backgroundColor: null, customBackground: null }),
                        (s) => ({ ...s, backgroundColor: s.backgroundColor, customBackground: s.customBackground })
                    ));
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