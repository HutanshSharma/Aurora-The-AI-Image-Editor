import AITextInput from "./AITextInput"

export default function SegmentFooter({execute, editorState, Command, onAIEdit, isAIProcessing}){
    return (
        <div className="border-t border-white/10 w-full px-4 py-2">
          <AITextInput 
            selectedObject={null} 
            className={'w-full'}
            execute={execute}
            editorState={editorState}
            Command={Command}
            onAIEdit={onAIEdit}
            isProcessing={isAIProcessing}
            asFooterInput={true}
          />
        </div>
    )
}