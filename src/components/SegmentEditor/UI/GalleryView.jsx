import { Trash2, Copy } from "lucide-react";

export default function GalleryView({editedObjects, setSelectedObjectIndex, setViewMode, selectedObjectIndex, duplicateObject, deleteObject}){
    return (
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {editedObjects.map((obj, index) => (
                <div
                key={obj.id}
                onClick={() => {
                    setSelectedObjectIndex(index);
                    setViewMode('edit');
                }}
                className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                    index === selectedObjectIndex
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : 'border-white/10 hover:border-blue-400'
                }`}
                >
                <div className="aspect-square bg-white/5 flex items-center justify-center p-4">
                    {obj.image?.complete ? (
                    <img
                        src={obj.image.src}
                        alt={obj.name}
                        className="max-w-full max-h-full object-contain"
                    />
                    ) : (
                    <div className="w-full h-full bg-linear-to-br from-blue-500/20 to-purple-500/20 rounded-lg" />
                    )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-3">
                    <p className="text-sm font-semibold truncate">{obj.name}</p>
                    <p className="text-xs text-gray-400">{obj.width} X {obj.height}</p>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedObjectIndex(index);
                        duplicateObject();
                    }}
                    className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg"
                    title="Duplicate"
                    >
                    <Copy size={14} />
                    </button>
                    <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedObjectIndex(index);
                        deleteObject();
                    }}
                    className="p-1.5 bg-red-500 hover:bg-red-600 rounded-lg"
                    title="Delete"
                    >
                    <Trash2 size={14} />
                    </button>
                </div>
                </div>
            ))}
            </div>
        </div>
    )
}