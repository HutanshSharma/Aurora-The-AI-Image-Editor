import { Undo, Redo, Plus, LayoutList, Pencil} from "lucide-react"

export default function Header({handleLoadImages, openPopup, setShowEditor, droppedObjects}){
    const handleUndo = () => {
        return 
    };

    const handleRedo = () => {
        return 
    };

    return (
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4 fixed inset-0 z-10 h-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex gap-2">
                <button
                    onClick={handleUndo}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Undo"
                >
                    <Undo size={20} />
                </button>
                <button
                    onClick={handleRedo}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Redo"
                >
                    <Redo size={20} />
                </button>
                <button
                    onClick={handleLoadImages}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="LoadImages"
                >
                    <LayoutList size={20} />
                </button>
                <button
                    onClick={()=>setShowEditor(true)}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-all"
                    title="OpenEditor"
                    disabled={droppedObjects.length===0}
                >
                    <Pencil size={20} />
                </button>
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