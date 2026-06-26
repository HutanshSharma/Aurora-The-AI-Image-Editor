import { Mic, Send, Square } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { processCommand, processCommandWithAI} from "../Utils/CommandInputUtils"
import { cn } from "../../ui/cn"

export default function CommandInput({selectedObject, className, execute, editorState, Command, addToast, onAICommand}){
    const [isListening, setIsListening] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [useWebSpeech, setUseWebSpeech] = useState(false)
    const [inputText, setInputText] = useState("")
    const [audioLevel, setAudioLevel] = useState(0)
    const [commandFeedback, setCommandFeedback] = useState(null)
    const [aiModel, setAiModel] = useState(null)
    const [, setModelLoading] = useState(false)
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
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript
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
                    addToast?.('Microphone access denied. Enable microphone permissions.', 'error')
                } else if (event.error === 'no-speech') {
                    addToast?.('No speech detected. Please try again.', 'info')
                } else {
                    addToast?.('Speech recognition error. Please try again.', 'error')
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
            addToast?.('Speech recognition is not available in this browser — type your command instead.', 'info')
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
                addToast?.('Microphone access denied. Enable microphone permissions and try again.', 'error')
            } else {
                addToast?.('Could not start speech recognition. Please try again.', 'error')
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
        const prompt = inputText.trim()
        if (!prompt) return

        const options = {}
        const localSuccess = aiModel && modelStatus === 'ready'
            ? await processCommandWithAI(inputText, execute, options, Command, editorState, aiModel)
            : processCommand(inputText, execute, Command, editorState)

        let success = localSuccess
        if (!localSuccess && onAICommand) {
            success = await onAICommand(prompt)
        } else if (!localSuccess && addToast) {
            addToast('This feature is currently unavailable.', 'error')
        }

        setCommandFeedback(success ? 'success' : 'error')
        setTimeout(() => setCommandFeedback(null), success ? 2000 : 3000)
        setInputText("")
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && inputText.trim()) {
            handleSendCommand()
        }
    }

    const hasText = inputText.trim().length > 0;
    const micUnavailable = !hasText && !useWebSpeech;

    return (
        <div className={cn('mx-auto w-full max-w-2xl', className)}>
            {/* Unified pill: text + one morphing action button (mic ↔ send ↔ stop) */}
            <div className="flex h-12 items-center rounded-full border border-line bg-surface-2 pl-4 pr-1.5 shadow-soft transition-colors focus-within:border-accent/60">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isListening
                    ? 'Listening…'
                    : modelStatus === 'ready'
                      ? 'Describe an edit, or tap the mic…'
                      : 'Type a command, or tap the mic…'
                }
                disabled={isProcessing}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint outline-none disabled:opacity-50"
              />
              <button
                onClick={hasText ? handleSendCommand : handleMicClick}
                disabled={isProcessing || micUnavailable}
                aria-label={hasText ? 'Send command' : isListening ? 'Stop recording' : 'Start voice input'}
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 active:scale-90',
                  isListening
                    ? 'bg-danger text-white'
                    : micUnavailable
                      ? 'cursor-not-allowed bg-surface-3 text-faint'
                      : 'bg-accent text-white hover:bg-accent-hover',
                )}
              >
                {isListening && (
                  <span
                    className="absolute inset-0 bg-white/25 transition-transform duration-150"
                    style={{ transform: `scaleY(${0.3 + audioLevel * 0.7})`, transformOrigin: 'center' }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center">
                  {isProcessing ? (
                    <span className="animate-spin text-sm">⏳</span>
                  ) : isListening ? (
                    <Square size={14} className="fill-current" />
                  ) : hasText ? (
                    <Send size={17} />
                  ) : (
                    <Mic size={18} />
                  )}
                </span>
              </button>
            </div>

            <div className="mt-1.5 flex min-h-4 items-center justify-center gap-2 text-[12px]">
              {isListening ? (
                <span className="flex items-center gap-1.5 text-danger">
                  <span className="h-2 w-2 animate-ping rounded-full bg-danger" />
                  Listening…
                </span>
              ) : isProcessing ? (
                <span className="text-info">Processing speech…</span>
              ) : commandFeedback === 'success' ? (
                <span className="text-success">✓ Command executed</span>
              ) : commandFeedback === 'error' ? (
                <span className="text-danger">Command not recognized</span>
              ) : micUnavailable ? (
                <span className="text-faint">Voice unavailable — type instead</span>
              ) : selectedObject ? (
                <span className="text-muted">Selected: {selectedObject.name}</span>
              ) : null}
            </div>
        </div>
    )
}