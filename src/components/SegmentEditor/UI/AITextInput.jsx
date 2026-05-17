import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Send, Loader2, Sparkles, X, Mic, Volume2 } from 'lucide-react';

export default function AITextInput({ onAIEdit, isProcessing, onClose, editorState, className, execute, Command, selectedObject, asFooterInput = false }) {
  const [textPrompt, setTextPrompt] = useState('');
  const [useBackgroundContext, setUseBackgroundContext] = useState(true);
  
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [useWebSpeech, setUseWebSpeech] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [commandFeedback, setCommandFeedback] = useState(null);
  const [aiModel, setAiModel] = useState(null);
  const [modelStatus, setModelStatus] = useState('not-loaded');
  
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  const examplePrompts = [
    "Change background to a sunset beach",
    "Add dramatic golden hour lighting", 
    "Make it look like a professional studio photo",
    "Transform into anime style",
    "Add warm indoor lighting",
    "Change to a forest environment",
    "Enhance image quality and details",
    "Fix lighting and shadows",
    "Change to winter scene with snow",
    "Add cyberpunk neon lighting"
  ];

  useEffect(() => {
    const loadAIModel = async () => {
      if (modelStatus !== 'not-loaded') return;

      setModelStatus('loading');
      try {
        const localIntentHelper = (text) => {
          const t = text.toLowerCase();
          const increaseHints = ['increase', 'more', 'brighter', 'lighter', 'boost', 'raise', 'higher', 'up', 'add', 'stronger'];
          const decreaseHints = ['decrease', 'less', 'darker', 'dim', 'reduce', 'lower', 'down', 'weaker', 'cut'];
          
          let inc = 0, dec = 0;
          increaseHints.forEach(w => { if (t.includes(w)) inc++ });
          decreaseHints.forEach(w => { if (t.includes(w)) dec++ });

          if (inc > dec && inc > 0) {
            return [{ label: 'INCREASE', score: 0.7 + 0.1 * inc }];
          } else if (dec > inc && dec > 0) {
            return [{ label: 'DECREASE', score: 0.7 + 0.1 * dec }];
          } else {
            return [{ label: 'NEUTRAL', score: 0.5 }];
          }
        };

        setAiModel(() => localIntentHelper);
        setModelStatus('ready');
      } catch (error) {
        console.error('Local AI loading failed:', error);
        setModelStatus('failed');
      }
    };

    const timeoutId = setTimeout(() => {
      loadAIModel().catch(err => {
        console.warn('AI loading failed:', err);
        setModelStatus('failed');
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [modelStatus]);

  useEffect(() => {
    checkSpeechSupport();
    return () => {
      stopRecording();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const checkSpeechSupport = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setUseWebSpeech(true);
      initializeWebSpeech();
    } else {
      setUseWebSpeech(false);
    }
  };

  const initializeWebSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setTextPrompt(finalTranscript.trim());
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setIsVoiceProcessing(false);
        setAudioLevel(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsVoiceProcessing(false);
        setAudioLevel(0);
        
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please enable microphone permissions.');
        } else if (event.error === 'no-speech') {
          alert('No speech detected. Please try again.');
        } else {
          alert('Speech recognition error. Please try again.');
        }
      };
    }
  };

  const analyzeAudioLevel = async () => {
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
        const source = audioCtxRef.current.createMediaStreamSource(streamRef.current);
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = Math.min(average / 50, 1);
      setAudioLevel(normalizedLevel);
      
      if (isListening) {
        animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
      }
    } catch (error) {
      console.warn("Audio level analysis failed:", error);
    }
  };

  const startRecording = async () => {
    if (!useWebSpeech || !recognitionRef.current) {
      alert("Speech recognition is not available in this browser. Please type your command instead.");
      return;
    }

    try {
      setIsListening(true);
      setIsVoiceProcessing(false);
      analyzeAudioLevel();
      recognitionRef.current.start();
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsListening(false);
      
      if (error.name === 'NotAllowedError') {
        alert("Microphone access denied. Please enable microphone permissions and try again.");
      } else {
        alert("Could not start speech recognition. Please try again.");
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    
    setIsListening(false);
    setAudioLevel(0);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (textPrompt.trim() && !isProcessing) {
      if (asFooterInput) {
        const isAIPrompt = textPrompt.toLowerCase().includes('change') || 
                          textPrompt.toLowerCase().includes('add') ||
                          textPrompt.toLowerCase().includes('make') ||
                          textPrompt.toLowerCase().includes('transform') ||
                          textPrompt.toLowerCase().includes('background') ||
                          textPrompt.toLowerCase().includes('lighting') ||
                          textPrompt.toLowerCase().includes('style') ||
                          textPrompt.length > 20; 
        
        if (isAIPrompt && onAIEdit) {
          let enhancedPrompt = textPrompt.trim();
          
          if (useBackgroundContext && editorState?.customBackground) {
            enhancedPrompt = `${textPrompt.trim()}, blend with existing background`;
          } else if (useBackgroundContext && editorState?.backgroundColor) {
            enhancedPrompt = `${textPrompt.trim()}, maintain background harmony`;
          }
          
          onAIEdit(enhancedPrompt);
          setTextPrompt('');
        } else {
          handleSendCommand();
        }
      } else {
        let enhancedPrompt = textPrompt.trim();
        
        if (useBackgroundContext && editorState?.customBackground) {
          enhancedPrompt = `${textPrompt.trim()}, blend with existing background`;
        } else if (useBackgroundContext && editorState?.backgroundColor) {
          enhancedPrompt = `${textPrompt.trim()}, maintain background harmony`;
        }
        
        onAIEdit(enhancedPrompt);
        setTextPrompt('');
      }
    }
  };

  const handleSendCommand = async () => {
    if (textPrompt.trim()) {
      try {
        const { processCommand, processCommandWithAI } = await import('../../MainEditor/Utils/CommandInputUtils');
        
        const options = {};
        const success = aiModel && modelStatus === 'ready' 
          ? await processCommandWithAI(textPrompt, execute, options, Command, editorState, aiModel)
          : processCommand(textPrompt, execute, Command, editorState);
        
        if (success) {
          setCommandFeedback('success');
          setTimeout(() => setCommandFeedback(null), 2000);
        } else {
          setCommandFeedback('error');
          setTimeout(() => setCommandFeedback(null), 3000);
        }            
        setTextPrompt("");
      } catch (error) {
        console.error('Command processing error:', error);
        setCommandFeedback('error');
        setTimeout(() => setCommandFeedback(null), 3000);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && textPrompt.trim()) {
      handleSubmit(e);
    }
  };

  const handleExampleClick = (example) => {
    setTextPrompt(example);
  };

  if (asFooterInput) {
    return (
      <div className={`bg-black/30 backdrop-blur-md rounded-2xl p-4 ${className} w-full`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="AI Editor: 'change background to sunset', 'add dramatic lighting' or commands: 'brightness +20', 'flip horizontal'..."
            disabled={isVoiceProcessing || isProcessing}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 text-white placeholder-gray-400"
          />
          
          {/* Voice Input Button */}
          <div className="relative">
            <button
              onClick={handleMicClick}
              disabled={isVoiceProcessing || !useWebSpeech}
              className={`p-3 rounded-lg transition-all duration-300 transform relative overflow-hidden ${
                isVoiceProcessing 
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
                {isVoiceProcessing ? (
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
          
          {/* Send Button */}
          <div className={`transition-all duration-300 ${textPrompt.trim() ? 'w-10 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
            <button
              onClick={handleSubmit}
              disabled={!textPrompt.trim() || isListening}
              className="p-3 bg-green-500 hover:bg-green-600 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        
        {/* Footer Status */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs">
            {!useWebSpeech && (
              <span className="text-gray-400">• Voice unavailable</span>
            )}
            {isListening && (
              <span className="text-red-400 animate-pulse flex items-center gap-1">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
                Listening...
              </span>
            )}
            {isVoiceProcessing && (
              <span className="text-blue-400">Processing speech...</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            {commandFeedback === 'success' && (
              <span className="text-green-400 animate-pulse">✓ Command executed</span>
            )}
            {commandFeedback === 'error' && (
              <span className="text-red-400">Command not recognized</span>
            )}
          </div>
        </div>
        
        {/* Example Prompts - Always visible */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-sm text-purple-400 mb-3 font-medium flex items-center gap-2">
            <Sparkles size={14} className="shrink-0" />
            Quick AI Prompts:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {examplePrompts.slice(0, 5).map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left px-3 py-2 text-xs bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-all text-gray-300 hover:text-white truncate"
                title={example}
              >
                "{example.substring(0, 20)}..."
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const [showExamples, setShowExamples] = useState(true);
  
  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 size={20} className="text-purple-400" />
          <h3 className="text-lg font-bold">AI Image Editor</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            title="Close AI Editor"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* CommandInput-style interface with voice input */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && textPrompt.trim()) {
                handleSubmit(e);
              }
            }}
            placeholder="Describe your image edits: 'change background to sunset', 'add dramatic lighting'..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 text-white placeholder-gray-400"
            disabled={isProcessing}
          />
          
          {/* Voice Input Button */}
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
                      ? 'bg-purple-500 hover:bg-purple-600 hover:scale-105'
                      : 'bg-gray-500 cursor-not-allowed'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={!useWebSpeech ? "Speech recognition unavailable" : isListening ? "Stop recording" : "Voice input"}
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
          
          {/* Send Button */}
          <div className={`transition-all duration-300 ${textPrompt.trim() ? 'w-12 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
            <button
              onClick={handleSubmit}
              disabled={!textPrompt.trim() || isListening || isProcessing}
              className="p-3 bg-purple-500 hover:bg-purple-600 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {/* Background Context Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="backgroundContext"
            checked={useBackgroundContext}
            onChange={(e) => setUseBackgroundContext(e.target.checked)}
            className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
          />
          <label htmlFor="backgroundContext" className="text-sm text-gray-400">
            Consider current background in editing
          </label>
        </div>

        {/* Voice Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {!useWebSpeech && (
              <span className="text-gray-400">• Voice unavailable</span>
            )}
            {isListening && (
              <span className="text-red-400 animate-pulse flex items-center gap-1">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
                Listening...
              </span>
            )}
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-purple-300">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">AI is processing your request...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompts - CommandInput style */}
      {showExamples && !isProcessing && (
        <div className="mt-6">
          <p className="text-sm text-purple-400 mb-3 font-medium">✨ Suggested Prompts:</p>
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left px-3 py-2 text-sm bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-all text-gray-300 hover:text-white flex items-center gap-2"
              >
                <Sparkles size={14} className="text-purple-400 shrink-0" />
                <span>"{example}"</span>
              </button>
            ))}
          </div>
          
          {/* Quick tip */}
          <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 <strong>Tip:</strong> Use voice input or type natural language descriptions for best results
            </p>
          </div>
        </div>
      )}
    </div>
  );
}