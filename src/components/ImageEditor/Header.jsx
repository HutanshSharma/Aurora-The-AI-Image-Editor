import { Undo, Redo, Plus, LayoutList, Pencil, Sliders} from "lucide-react"

export default function Header({handleLoadImages, openPopup, setShowEditor, droppedObjects, handleUndo, handleRedo, canUndo, canRedo, uploadedImage, setShowEditingSidebar, showEditingSidebar}){

    return (
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4 fixed inset-0 z-50 h-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex gap-2">
                <button
                    onClick={() => {
                      handleUndo();
                      setShowEditingSidebar(false);
                    }}
                    disabled={!canUndo}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo size={20} />
                </button>
                <button
                    onClick={() => {
                      handleRedo();
                      setShowEditingSidebar(false);
                    }}
                    disabled={!canRedo}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo size={20} />
                </button>
                <button
                    onClick={() => {
                      handleLoadImages();
                      setShowEditingSidebar(false);
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="LoadImages"
                >
                    <LayoutList size={20} />
                </button>
                <button
                    onClick={() => {
                      setShowEditor(true);
                      setShowEditingSidebar(false);
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-all"
                    title="OpenEditor"
                    disabled={droppedObjects.length===0}
                >
                    <Pencil size={20} />
                </button>
                {uploadedImage && (
                  <>
                    <button
                      onClick={() => setShowEditingSidebar(!showEditingSidebar)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                      title="Edit Image"
                    >
                      <Sliders size={20} />
                    </button>
                  </>
                )}
                <button
                    onClick={openPopup}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                    title="Add Image"
                >
                    <Plus size={20} />
                </button>
                </div>
            </div>
        </div>
    )
}