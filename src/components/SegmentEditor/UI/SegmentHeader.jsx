import { X, Grid3x3, Undo, Redo } from "lucide-react"

export default function SegmentHeader({setShowEditor, editedObjects, setViewMode, viewMode, handleUndo, handleRedo, canUndo, canRedo}){
    return (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-4 text-sm md:text-md">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('edit')}
                className={`px-2 py-2 md:px-4 md:py-2 rounded-lg transition-all ${
                  viewMode === 'edit' ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`px-2 py-2 md:px-4 md:py-2 rounded-lg transition-all flex items-center gap-2 ${
                  viewMode === 'gallery' ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <Grid3x3 size={16} />
                Gallery ({editedObjects.length})
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={20} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Redo (Ctrl+Y)"
            >
              <Redo size={20} />
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-all bg-[rgba(255,2,2,0.9)]"
            >
              <X size={24} />
            </button>
          </div>
        </div>
    )
}