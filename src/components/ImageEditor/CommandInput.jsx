import {MicOff, Mic} from "lucide-react"
import { useState } from "react"

export default function CommandInput({selectedObject, className}){
    const [isListening, setisListening] = useState(false)

    return (
        <>
        <div className={`mt-6 bg-black/30 backdrop-blur-md rounded-2xl p-4 ${className} w-full`}>
            <div className="flex gap-2">
              <input
                type="text"
                onChange={(e) => console.log(e.target.value)}
                placeholder="Enter command (e.g., 'move left', 'move right')..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                className={`p-2 rounded-lg transition-all ${
                  isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </div>
            {selectedObject && <p className="text-xs text-gray-400 mt-2">
              {selectedObject ? `Selected: ${selectedObject.name}` : 'Select an object first'}
            </p>}
          </div>
        </>
    )
}