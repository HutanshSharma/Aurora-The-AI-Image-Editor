import { Mic, Send, Square } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { processCommand, processCommandWithAI} from "../Utils/CommandInputUtils"
import { transcribe, setWhisperProgressHandler, preloadWhisper } from "../Utils/whisperClient"
import { cn } from "../../ui/cn"

const webSpeechSupported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const useWhisper = !webSpeechSupported && micSupported
const voiceSupported = webSpeechSupported || micSupported
function resampleTo16k(input, inputRate) {
  if (inputRate === 16000) return input
  const ratio = inputRate / 16000
  const outLen = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio
    const i0 = idx | 0
    const i1 = i0 + 1 < input.length ? i0 + 1 : i0
    const frac = idx - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

export default function CommandInput({selectedObject, className, execute, editorState, Command, addToast, onAICommand}){
    const [isListening, setIsListening] = useState(false)
    const [isStarting, setIsStarting] = useState(false) 
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [downloadPct, setDownloadPct] = useState(null)
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
    const processorRef = useRef(null)
    const pcmChunksRef = useRef([])
    const inputRateRef = useRef(16000)

    useEffect(() => {
      const loadAIModel = async () => {
          if (modelStatus !== 'not-loaded') return
          setModelStatus('loading')
          try {
              const localIntentHelper = (text) => {
                  const t = text.toLowerCase()
                  const inc = ['increase','more','brighter','lighter','boost','raise','higher','up','add','stronger']
                  const dec = ['decrease','less','darker','dim','reduce','lower','down','weaker','cut']
                  let i = 0, d = 0
                  inc.forEach(w => { if (t.includes(w)) i++ })
                  dec.forEach(w => { if (t.includes(w)) d++ })
                  if (i > d && i > 0) return [{ label: 'INCREASE', score: 0.7 + 0.1 * i }]
                  if (d > i && d > 0) return [{ label: 'DECREASE', score: 0.7 + 0.1 * d }]
                  return [{ label: 'NEUTRAL', score: 0.5 }]
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
          loadAIModel().catch(err => { console.warn('AI loading failed:', err); setModelStatus('failed') })
      }, 1000)
      return () => clearTimeout(timeoutId)
  }, [modelStatus])

    useEffect(() => {
        if (!webSpeechSupported) return
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (event) => {
            let finalTranscript = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
            }
            if (finalTranscript) setInputText(finalTranscript.trim())
        }
        recognition.onend = () => { setIsListening(false); setAudioLevel(0); stopStream() }
        recognition.onerror = (event) => {
            setIsListening(false); setAudioLevel(0)
            if (event.error === 'not-allowed') addToast?.('Microphone access denied. Enable mic permissions.', 'error')
            else if (event.error === 'no-speech') addToast?.('No speech detected. Please try again.', 'info')
            else if (event.error !== 'aborted') addToast?.('Speech recognition error. Please try again.', 'error')
        }
        recognitionRef.current = recognition
        return () => { try { recognition.abort() } catch { /* already stopped */ } }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!useWhisper) return
        const t = setTimeout(() => preloadWhisper(), 2500)
        return () => clearTimeout(t)
    }, [])

    useEffect(() => {
        if (!useWhisper) return
        setWhisperProgressHandler((p) => {
            if (p?.status === 'progress' && typeof p.progress === 'number') setDownloadPct(Math.round(p.progress))
            else if (p?.status === 'ready' || p?.status === 'done') setDownloadPct(null)
            else if (p?.status === 'load-error') {
                setDownloadPct(null)
                addToast?.('Voice model failed to load. Check your connection and try again.', 'error')
            }
        })
        return () => setWhisperProgressHandler(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => () => {
        stopStream()
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }, [])

    const stopStream = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
        if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; analyserRef.current = null }
    }

    const analyzeAudioLevel = () => {
        try {
            if (!streamRef.current) return
            if (!audioCtxRef.current) {
                audioCtxRef.current = new AudioContext()
                const source = audioCtxRef.current.createMediaStreamSource(streamRef.current)
                analyserRef.current = audioCtxRef.current.createAnalyser()
                analyserRef.current.fftSize = 256
                source.connect(analyserRef.current)
            }
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
            analyserRef.current.getByteFrequencyData(dataArray)
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
            setAudioLevel(Math.min(avg / 50, 1))
            animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel)
        } catch { /* visualizer is best-effort */ }
    }

    const startRecording = async () => {
        if (!voiceSupported) {
            addToast?.('Voice input isn’t supported in this browser — type your command instead.', 'info')
            return
        }
        setIsStarting(true) 

        if (!useWhisper) {
            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
                setIsStarting(false); setIsListening(true)
                analyzeAudioLevel()
                recognitionRef.current?.start()
            } catch (error) {
                setIsStarting(false); setIsListening(false); stopStream()
                if (error?.name === 'NotAllowedError') addToast?.('Microphone access denied. Enable mic permissions and try again.', 'error')
                else addToast?.('Could not access the microphone.', 'error')
            }
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
            })
            streamRef.current = stream
            pcmChunksRef.current = []
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            if (audioCtx.state === 'suspended') await audioCtx.resume()
            audioCtxRef.current = audioCtx
            inputRateRef.current = audioCtx.sampleRate
            const source = audioCtx.createMediaStreamSource(stream)
            const processor = audioCtx.createScriptProcessor(4096, 1, 1)
            processorRef.current = processor
            const mute = audioCtx.createGain()
            mute.gain.value = 0 // no audible feedback, but keeps the node graph live
            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0)
                pcmChunksRef.current.push(new Float32Array(input))
                let peak = 0
                for (let i = 0; i < input.length; i += 64) { const a = Math.abs(input[i]); if (a > peak) peak = a }
                setAudioLevel(Math.min(peak * 4, 1))
            }
            source.connect(processor)
            processor.connect(mute)
            mute.connect(audioCtx.destination)
            setIsStarting(false); setIsListening(true) // capture is live — only NOW is it truly listening
        } catch (error) {
            setIsStarting(false); setIsListening(false); stopStream()
            if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') addToast?.('Microphone access denied. Enable mic permissions and try again.', 'error')
            else addToast?.('Could not access the microphone. Please try again.', 'error')
        }
    }

    const stopRecording = () => {
        setIsListening(false)
        setAudioLevel(0)
        if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null }
        if (!useWhisper) {
            try { recognitionRef.current?.stop() } catch { /* not started */ }
            stopStream()
            return
        }
        if (processorRef.current) { try { processorRef.current.disconnect() } catch { /* already gone */ } processorRef.current = null }
        const inputRate = inputRateRef.current
        const chunks = pcmChunksRef.current
        pcmChunksRef.current = []
        stopStream()
        let total = 0
        for (const c of chunks) total += c.length
        if (total === 0) { addToast?.('Didn’t catch any audio — please try again.', 'info'); return }
        const merged = new Float32Array(total)
        let off = 0
        for (const c of chunks) { merged.set(c, off); off += c.length }
        transcribePcm(resampleTo16k(merged, inputRate))
    }

    const transcribePcm = async (audio) => {
        setIsTranscribing(true)
        try {
            const text = (await transcribe(audio) || '').trim()
            if (text) setInputText(text)
            else addToast?.('Didn’t catch that — please try again.', 'info')
        } catch {
            addToast?.('Could not transcribe the audio. Please try again.', 'error')
        } finally {
            setIsTranscribing(false)
            setDownloadPct(null)
        }
    }

    const handleMicClick = () => {
        if (isListening) stopRecording()
        else if (!isTranscribing && !isStarting) startRecording()
    }

    const handleSendCommand = async () => {
        const prompt = inputText.trim()
        if (!prompt) return
        const options = {}
        const localSuccess = aiModel && modelStatus === 'ready'
            ? await processCommandWithAI(inputText, execute, options, Command, editorState, aiModel)
            : processCommand(inputText, execute, Command, editorState)
        let success = localSuccess
        if (!localSuccess && onAICommand) success = await onAICommand(prompt)
        else if (!localSuccess && addToast) addToast('This feature is currently unavailable.', 'error')
        setCommandFeedback(success ? 'success' : 'error')
        setTimeout(() => setCommandFeedback(null), success ? 2000 : 3000)
        setInputText("")
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && inputText.trim()) handleSendCommand()
    }

    const hasText = inputText.trim().length > 0
    const micUnavailable = !hasText && !voiceSupported

    return (
        <div className={cn('mx-auto w-full max-w-2xl', className)}>
            <div className="flex h-12 items-center rounded-full border border-line bg-surface-2 pl-4 pr-1.5 shadow-soft transition-colors focus-within:border-accent/60">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isStarting ? 'Starting mic…' : isListening ? 'Listening…' : isTranscribing ? 'Transcribing…' : 'Describe an edit, or tap the mic…'}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint outline-none disabled:opacity-50"
              />
              <button
                onClick={hasText ? handleSendCommand : handleMicClick}
                disabled={micUnavailable || (!hasText && (isTranscribing || isStarting))}
                aria-label={hasText ? 'Send command' : isListening ? 'Stop recording' : 'Start voice input'}
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 active:scale-90',
                  isListening
                    ? 'bg-danger text-white'
                    : micUnavailable || (!hasText && (isTranscribing || isStarting))
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
                  {!hasText && (isTranscribing || isStarting) ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
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
              {isStarting ? (
                <span className="text-info">Starting microphone…</span>
              ) : isListening ? (
                <span className="flex items-center gap-1.5 text-danger">
                  <span className="h-2 w-2 animate-ping rounded-full bg-danger" />
                  Listening… tap to stop
                </span>
              ) : isTranscribing ? (
                <span className="text-info">{downloadPct != null ? `Loading voice model… ${downloadPct}%` : 'Transcribing…'}</span>
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
