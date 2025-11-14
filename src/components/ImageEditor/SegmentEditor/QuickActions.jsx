import { Download, Sparkles } from "lucide-react"

export default function QuickActions({downloadImage, resetFilters}){
    return (
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 p-4  h-20">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex gap-2">
                <button
                onClick={downloadImage}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-all"
                title="Download Image"
                >
                    <Download size={16} />
                </button>
                <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                title="Reset All Filters"
                >
                    <Sparkles size={16} />
                </button>
                </div>
            </div>
        </div>
    )
}