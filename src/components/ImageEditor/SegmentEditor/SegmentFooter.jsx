import CommandInput from "../CommandInput"

export default function SegmentFooter({applyAllChanges}){
    return (
        <div className="border-t border-white/10 flex w-full px-2 pr-6 justify-center items-center">
          <div className="text-sm flex-1 text-gray-400 ">
            <CommandInput selectedObject={null} className={'w-full mb-5'}/>
          </div>
          <button
            onClick={applyAllChanges}
            className="px-2 py-2 text-sm md:text-md bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all"
          >
            Apply
          </button>
        </div>
    )
}