import { Undo, Redo, Plus, LayoutList} from "lucide-react"

export default function Header({setObjects, setHistoryIndex, historyIndex, editHistory, handleLoadImages, openPopup}){
    const handleUndo = () => {
        if (historyIndex > 0) {
        const prevState = editHistory[historyIndex - 1];
        setObjects(prevState.objects);
        setHistoryIndex(historyIndex - 1);
        }
    };

    const handleRedo = () => {
        if (historyIndex < editHistory.length - 1) {
        const nextState = editHistory[historyIndex + 1];
        setObjects(nextState.objects);
        setHistoryIndex(historyIndex + 1);
        }
    };

    return (
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4 absolute inset-0 z-10 h-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex gap-2">
                <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Undo"
                >
                    <Undo size={20} />
                </button>
                <button
                    onClick={handleRedo}
                    disabled={historyIndex >= editHistory.length - 1}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Redo"
                >
                    <Redo size={20} />
                </button>
                <button
                    onClick={handleLoadImages}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg disabled:opacity-50 transition-all"
                    title="Redo"
                >
                    <LayoutList size={20} />
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