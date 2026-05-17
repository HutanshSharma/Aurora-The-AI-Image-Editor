import {FlipHorizontal, FlipVertical, Palette} from "lucide-react"
import EditingOptions from "../../SegmentEditor/UI/EditingOptions";

export default function EditingSidebar({setSelectedEditOption, selectedEditOption, editorState, setShowEditingSidebar, downloadImage, resetFilters, execute, Command, setShowLUTSelector}){
    return (
        <div className="block fixed right-0 top-20 bottom-0 w-80 bg-black/95 border-l border-white/10 overflow-y-auto z-25">
            <div className="p-4 space-y-4">

                <div className="space-y-2">
                <button
                    onClick={downloadImage}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-all"
                >
                    Download
                </button>
                <button
                    onClick={resetFilters}
                    className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                >
                    Reset
                </button>
                </div>

                <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Color Grading</p>
                <button
                    onClick={() => {
                        setShowLUTSelector(true)
                        setShowEditingSidebar(false)
                    }}
                    className="w-full px-4 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                    <Palette size={18} />
                    <span className="font-medium">
                    {editorState.selectedLUT ? editorState.selectedLUT.name : 'Select Filter'}
                    </span>
                </button>
                {editorState.selectedLUT && (
                    <p className="text-xs text-gray-400 text-center mt-2">
                    ✓ Active filter
                    </p>
                )}
                </div>

                <EditingOptions
                setSelectedEditOption={setSelectedEditOption}
                selectedEditOption={selectedEditOption}
                editorState={editorState}
                execute={execute}
                onClose={()=>setShowEditingSidebar(false)}
                setSidebarView={undefined}
                />

                <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Transform</p>
                <div className="grid grid-cols-2 gap-2">
                    <button
                    onClick={() => {
                        execute(new Command(
                        (s) => ({ ...s, flipH: !s.flipH }),
                        (s) => ({ ...s, flipH: !s.flipH })
                        ));
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                        editorState.flipH ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                    }`}
                    >
                    <FlipHorizontal size={16} />
                    <span className="text-sm">Flip H</span>
                    </button>
                    <button
                    onClick={() => {
                        execute(new Command(
                        (s) => ({ ...s, flipV: !s.flipV }),
                        (s) => ({ ...s, flipV: !s.flipV })
                        ));
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                        editorState.flipV ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10'
                    }`}
                    >
                    <FlipVertical size={16} />
                    <span className="text-sm">Flip V</span>
                    </button>
                </div>
                </div>
            </div>
            </div>
    )
}