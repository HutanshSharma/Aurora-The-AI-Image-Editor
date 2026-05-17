import {Mic, Send, Volume2} from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { processCommand, processCommandWithAI} from "./CommandInputUtils"

export default function CommandInput({selectedObject, className, execute, editorState, Command}){
    const [isListening, setIsListening] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [useWebSpeech, setUseWebSpeech] = useState(false)
    const [inputText, setInputText] = useState("")
    const [audioLevel, setAudioLevel] = useState(0)
    const [commandFeedback, setCommandFeedback] = useState(null)
    const [aiModel, setAiModel] = useState(null)
    const [modelLoading, setModelLoading] = useState(false)
    const [modelStatus, setModelStatus] = useState('not-loaded')
    
    const recognitionRef = useRef(null)
    const streamRef = useRef(null)
    const analyserRef = useRef(null)
    const animationFrameRef = useRef(null)
    const audioCtxRef = useRef(null)
    
    useEffect(() => {
      const loadAIModel = async () => {
          if (modelStatus !== 'not-loaded') return

          setModelStatus('loading')
          try {
              const localIntentHelper = (text) => {
                  const t = text.toLowerCase()

                  const increaseHints = [
                      'increase', 'more', 'brighter', 'lighter', 'boost',
                      'raise', 'higher', 'up', 'add', 'stronger'
                  ]
                  const decreaseHints = [
                      'decrease', 'less', 'darker', 'dim', 'reduce',
                      'lower', 'down', 'weaker', 'cut'
                  ]

                  let inc = 0
                  let dec = 0

                  increaseHints.forEach(w => { if (t.includes(w)) inc++ })
                  decreaseHints.forEach(w => { if (t.includes(w)) dec++ })

                  if (inc > dec && inc > 0) {
                      return [{ label: 'INCREASE', score: 0.7 + 0.1 * inc }]
                  } else if (dec > inc && dec > 0) {
                      return [{ label: 'DECREASE', score: 0.7 + 0.1 * dec }]
                  } else {
                      return [{ label: 'NEUTRAL', score: 0.5 }]
                  }
              }

              setAiModel(() => localIntentHelper)
              setModelStatus('ready')
              setModelLoading(true)
              setTimeout(() => setModelLoading(false), 2000)

          } catch (error) {
              console.error('Local AI loading failed:', error)
              setModelStatus('failed')
          }
      }

      const timeoutId = setTimeout(() => {
          loadAIModel().catch(err => {
              console.warn('AI loading failed:', err)
              setModelStatus('failed')
          })
      }, 1000)

      return () => clearTimeout(timeoutId)
  }, [modelStatus])

    useEffect(() => {
        checkSpeechSupport()
        return () => {
            stopRecording()
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [])

    const checkSpeechSupport = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            setUseWebSpeech(true)
            initializeWebSpeech()
        } else {
            setUseWebSpeech(false)
        }
    }

    const initializeWebSpeech = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = 'en-US'

            recognitionRef.current.onresult = (event) => {
                let finalTranscript = ''
                let interimTranscript = ''

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript
                    } else {
                        interimTranscript += transcript
                    }
                }

                if (finalTranscript) {
                    setInputText(finalTranscript.trim())
                }
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
                setIsProcessing(false)
                setAudioLevel(0)
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current)
                }
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop())
                }
            }

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error)
                setIsListening(false)
                setIsProcessing(false)
                setAudioLevel(0)
                
                if (event.error === 'not-allowed') {
                    alert('Microphone access denied. Please enable microphone permissions.')
                } else if (event.error === 'no-speech') {
                    alert('No speech detected. Please try again.')
                } else {
                    alert('Speech recognition error. Please try again.')
                }
            }
        }
    }

    const analyzeAudioLevel = async () => {
        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
            }
            
            if (!audioCtxRef.current) {
                audioCtxRef.current = new AudioContext()
                const source = audioCtxRef.current.createMediaStreamSource(streamRef.current)
                analyserRef.current = audioCtxRef.current.createAnalyser()
                analyserRef.current.fftSize = 256
                source.connect(analyserRef.current)
            }

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
            analyserRef.current.getByteFrequencyData(dataArray)
            
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length
            const normalizedLevel = Math.min(average / 50, 1)
            setAudioLevel(normalizedLevel)
            
            if (isListening) {
                animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel)
            }
        } catch (error) {
            console.warn("Audio level analysis failed:", error)
        }
    }

    const startRecording = async () => {
        if (!useWebSpeech || !recognitionRef.current) {
            alert("Speech recognition is not available in this browser. Please type your command instead.")
            return
        }

        try {
            setIsListening(true)
            setIsProcessing(false)
            analyzeAudioLevel()
            recognitionRef.current.start()
            
        } catch (error) {
            console.error("Error starting recording:", error)
            setIsListening(false)
            
            if (error.name === 'NotAllowedError') {
                alert("Microphone access denied. Please enable microphone permissions and try again.")
            } else {
                alert("Could not start speech recognition. Please try again.")
            }
        }
    }

    const stopRecording = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop()
        }
        
        setIsListening(false)
        setAudioLevel(0)
        
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        
        if (audioCtxRef.current) {
            audioCtxRef.current.close()
            audioCtxRef.current = null
        }
    }

    const handleMicClick = () => {
        if (isListening) {
            stopRecording()
        } else {
            startRecording()
        }
    }

    const handleSendCommand = async () => {
        if (inputText.trim()) {
            const options={}
            
            const success = aiModel && modelStatus === 'ready' 
                ? await processCommandWithAI(inputText, execute, options, Command, editorState, aiModel)
                : processCommand(inputText,execute, Command, editorState)
            
            if (success) {
                setCommandFeedback('success')
                setTimeout(() => setCommandFeedback(null), 2000)
            } else {
                setCommandFeedback('error')
                setTimeout(() => setCommandFeedback(null), 3000)
            }            
            setInputText("")
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && inputText.trim()) {
            handleSendCommand()
        }
    }

    return (
        <>
        <div className={`mt-6 bg-black/30 backdrop-blur-md rounded-2xl p-4 ${className} w-full`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={modelStatus === 'ready' 
                    ? "AI-powered commands: 'make this brighter', 'apply cinematic filter', 'increase saturation by 30'..."
                    : "Smart commands: 'increase brightness', 'apply warm filter', 'flip horizontal', 'reset all'..."
                }
                disabled={isProcessing}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              />
              <div className="relative">
                <button
                  onClick={handleMicClick}
                  disabled={isProcessing || !useWebSpeech}
                  className={`p-3 rounded-lg transition-all duration-300 transform relative overflow-hidden ${
                    isProcessing 
                      ? 'bg-yellow-500 animate-pulse' 
                      : isListening 
                        ? 'bg-red-500 animate-pulse scale-110' 
                        : useWebSpeech
                          ? 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
                          : 'bg-gray-500 cursor-not-allowed'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={!useWebSpeech ? "Speech recognition unavailable in this browser" : isListening ? "Stop recording" : "Start voice recording"}
                >
                  {isListening && (
                    <div 
                      className="absolute inset-0 bg-white/20 rounded-lg transition-all duration-150"
                      style={{ 
                        transform: `scaleY(${0.3 + audioLevel * 0.7})`,
                        transformOrigin: 'center'
                      }}
                    />
                  )}
                  
                  <div className="relative z-10">
                    {isProcessing ? (
                      <div className="animate-spin">⏳</div>
                    ) : isListening ? (
                      <div className="flex items-center gap-1">
                        <Volume2 size={16} className="animate-pulse" />
                        <Mic size={16} />
                      </div>
                    ) : (
                      <Mic size={20} className={!useWebSpeech ? "opacity-50" : ""} />
                    )}
                  </div>
                </button>
                {isListening && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                )}
              </div>
              <div className={`transition-all duration-300 ${inputText.trim() ? 'w-10 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                <button
                  onClick={handleSendCommand}
                  disabled={!inputText.trim() || isListening}
                  className="p-3 bg-green-500 hover:bg-green-600 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              {selectedObject && (
                <p className="text-xs text-gray-400">
                  Selected: {selectedObject.name}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs h-10">
                {!useWebSpeech && (
                  <span className="text-gray-400">• Voice unavailable</span>
                )}
                {isListening ? (
                  <span className="text-red-400 animate-pulse flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
                    Listening...
                  </span>) :
                  <span></span>
                }
                {isProcessing && (
                  <span className="text-blue-400">Processing speech...</span>
                )}
                {commandFeedback === 'success' && (
                  <span className="text-green-400 animate-pulse">✓ Command executed</span>
                )}
                {commandFeedback === 'error' && (
                  <span className="text-red-400">Command not recognized</span>
                )}
              </div>
            </div>
          </div>
        </>
    )
}