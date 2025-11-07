/**
 * AI Chat Widget Component
 * Native React implementation for internal PMO use
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Phone, X, Minimize2, Send, Mic, MicOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ChatWidgetProps {
  onClose?: () => void;
  autoOpen?: boolean;
}

export function ChatWidget({ onClose, autoOpen = false }: ChatWidgetProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('Not connected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceWSRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize session when widget opens
  useEffect(() => {
    if (isOpen && !sessionId) {
      initializeSession();
    }
  }, [isOpen]);

  async function initializeSession() {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      // Send initial message to agent orchestrator to start conversation
      const response = await fetch(`${apiBaseUrl}/api/v1/chat/agent/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Hello'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages([{
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('Failed to initialize session:', err);
      setError('Failed to start chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!inputValue.trim() || !sessionId || isLoading) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${apiBaseUrl}/api/v1/chat/agent/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage.content
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // ============================================================
      // 🔍 DEBUG LOGGING - LLM Call Details
      // ============================================================
      if (data.debugLogs && data.debugLogs.length > 0) {
        console.group(`🤖 AI Chat Debug Logs (${data.debugLogs.length} entries)`);
        console.log(`%c📊 Session: ${sessionId}`, 'color: #3b82f6; font-weight: bold');
        console.log(`%c💬 User Message: "${userMessage.content}"`, 'color: #10b981; font-weight: bold');
        console.log('');

        data.debugLogs.forEach((log: any, index: number) => {
          if (log.type === 'llm_call') {
            console.group(`🎯 [${index + 1}] ${log.node} - ${log.timestamp}`);
            console.log(`%c🤖 Model: ${log.model}`, 'color: #8b5cf6; font-weight: bold');
            console.log(`%c🌡️  Temperature: ${log.temperature}`, 'color: #f59e0b');
            if (log.jsonMode) {
              console.log(`%c📋 Mode: JSON`, 'color: #ec4899');
            }
            console.log('');

            console.group('📝 System Prompt');
            console.log(`%c${log.systemPrompt}`, 'color: #6b7280; font-style: italic');
            console.groupEnd();
            console.log('');

            console.group('👤 User Prompt');
            console.log(`%c${log.userPrompt}`, 'color: #059669; font-style: italic');
            console.groupEnd();
            console.log('');

            if (log.variables) {
              console.group('🔧 Variables/Context');
              console.table(log.variables);
              console.groupEnd();
              console.log('');
            }

            if (log.response) {
              console.group('✅ LLM Response');
              console.log(`%c${log.response}`, 'color: #10b981; font-weight: bold');
              console.groupEnd();
            }

            console.groupEnd();
            console.log('');
          }
        });

        console.log(`%c🤖 Final Response: "${data.response}"`, 'color: #10b981; font-weight: bold; font-size: 14px');
        console.groupEnd();
      }
      // ============================================================

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show booking confirmation if created
      if (data.booking_created && data.booking_number) {
        const confirmationMessage: Message = {
          role: 'system',
          content: `✅ Booking confirmed! Your booking number is: ${data.booking_number}`,
          timestamp: data.timestamp
        };
        setMessages(prev => [...prev, confirmationMessage]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function startVoiceCall() {
    try {
      console.log('🎙️ Starting voice call...');
      setVoiceStatus('Requesting microphone access...');
      setIsVoiceActive(true);
      setError(null);
      setShowVoiceCall(false); // Hide the initial UI immediately

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000
        }
      });
      mediaStreamRef.current = stream;
      setVoiceStatus('Microphone active - Connecting...');

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      // Connect to WebSocket with auth token
      const token = localStorage.getItem('auth_token');
      const wsUrl = apiBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      const wsFullUrl = `${wsUrl}/api/v1/chat/voice/call?name=${encodeURIComponent(user?.name || 'User')}&email=${encodeURIComponent(user?.email || '')}&token=${encodeURIComponent(token || '')}`;

      console.log('🔗 Connecting to WebSocket:', wsUrl + '/api/v1/chat/voice/call');
      console.log('📡 Full WS URL (token hidden):', wsFullUrl.replace(token || '', '***'));

      const ws = new WebSocket(wsFullUrl);
      voiceWSRef.current = ws;

      ws.onopen = async () => {
        setVoiceStatus('Connected - Processing audio...');
        console.log('✅ Voice WebSocket connected');

        // Set up audio processing with Voice Activity Detection (VAD)
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);

        let silenceStart: number | null = null;
        let isSpeaking = false;
        const SILENCE_THRESHOLD = 0.01; // Volume threshold
        const SILENCE_DURATION = 1500; // 1.5 seconds of silence triggers commit

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);

            // Calculate volume (RMS)
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);

            // Detect speech/silence
            if (rms > SILENCE_THRESHOLD) {
              // Speech detected
              if (!isSpeaking) {
                console.log('🎤 Speech detected');
                isSpeaking = true;
              }
              silenceStart = null;

              // Convert float32 to Int16 PCM
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }

              // Convert to base64
              const bytes = new Uint8Array(pcm16.buffer);
              const base64 = btoa(String.fromCharCode(...Array.from(bytes)));

              // Send audio chunk to backend
              ws.send(JSON.stringify({
                type: 'audio.append',
                audio: base64
              }));
            } else if (isSpeaking) {
              // Silence detected after speech
              if (silenceStart === null) {
                silenceStart = Date.now();
              } else if (Date.now() - silenceStart > SILENCE_DURATION) {
                // Silence duration exceeded - commit audio for processing
                console.log('🔇 Silence detected - committing audio');
                ws.send(JSON.stringify({
                  type: 'audio.commit'
                }));
                isSpeaking = false;
                silenceStart = null;
                setVoiceStatus('Processing...');
              }
            }
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      let audioQueue: Int16Array[] = [];
      let isPlaying = false;

      const playAudioChunk = async (pcmData: Int16Array) => {
        if (!audioContextRef.current) return;

        const audioBuffer = audioContextRef.current.createBuffer(
          1,
          pcmData.length,
          24000
        );
        const channelData = audioBuffer.getChannelData(0);

        // Convert Int16 to Float32
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
        }

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start();

        source.onended = () => {
          if (audioQueue.length > 0) {
            playAudioChunk(audioQueue.shift()!);
          } else {
            isPlaying = false;
            setVoiceStatus('🎙️ Voice call active - Speak now!');
          }
        };
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Voice message:', data.type, data);

          if (data.type === 'audio.response') {
            // AI response with audio and transcript
            console.log('🤖 AI response:', data.transcript);
            console.log('👤 User said:', data.user_transcript);

            setVoiceStatus('🔊 AI is speaking...');

            // Decode and play audio response (base64 MP3)
            try {
              const audioData = atob(data.audio);
              const audioArray = new Uint8Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
              }

              // Create audio blob and play
              const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                setVoiceStatus('🎙️ Voice call active - Speak now!');

                // Check if conversation ended
                if (data.conversation_ended) {
                  console.log('🔚 Conversation ended:', data.end_reason);
                  endVoiceCall();
                }
              };

              audio.onerror = (err) => {
                console.error('Audio playback error:', err);
                setVoiceStatus('🎙️ Voice call active - Speak now!');
              };

              await audio.play();
            } catch (err) {
              console.error('Failed to decode audio:', err);
              setVoiceStatus('🎙️ Voice call active - Speak now!');
            }
          } else if (data.type === 'processing.started') {
            setVoiceStatus('⏳ Processing your message...');
          } else if (data.type === 'error') {
            const errorMessage = data.message || data.error || 'Voice error occurred';
            console.error('Voice error:', errorMessage);
            setVoiceStatus(`Error: ${errorMessage}`);
            setError(errorMessage);
          } else if (data.type === 'session.disconnected') {
            console.log('Session disconnected:', data.message);
            endVoiceCall();
          }
        } catch (err) {
          console.error('Failed to parse voice message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('Voice WebSocket error:', error);
        setVoiceStatus('Connection error');
        setError('Voice connection failed');
      };

      ws.onclose = () => {
        setVoiceStatus('Disconnected');
        setIsVoiceActive(false);
        console.log('Voice WebSocket closed');

        // Cleanup
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

    } catch (err: any) {
      console.error('Failed to start voice call:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError('Failed to start voice call: ' + err.message);
      }
      setIsVoiceActive(false);
      setVoiceStatus('Failed to connect');
    }
  }

  function endVoiceCall() {
    // Close WebSocket
    if (voiceWSRef.current) {
      voiceWSRef.current.close();
      voiceWSRef.current = null;
    }

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsVoiceActive(false);
    setVoiceStatus('Not connected');
    setShowVoiceCall(false);
  }

  function handleClose() {
    endVoiceCall();
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${
          isMinimized ? 'h-16 w-96' : 'h-[600px] w-96'
        }`}
      >
        {/* Header */}
        <div className="bg-slate-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5" />
            <div>
              <div className="font-semibold text-sm">AI Assistant</div>
              <div className="text-xs text-purple-100">Online now</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isVoiceActive) {
                  endVoiceCall();
                } else {
                  setShowVoiceCall(true);
                  if (!showVoiceCall) {
                    startVoiceCall();
                  }
                }
              }}
              className={`p-2 hover:bg-white/20 rounded-full transition-colors ${isVoiceActive ? 'bg-red-500/20' : ''}`}
              title={isVoiceActive ? "End Voice Call" : "Start Voice Call"}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
              }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {!isMinimized && (
          <>
            {/* Voice Call Banner */}
            {isVoiceActive && (
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 flex items-center justify-between border-b border-green-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="absolute inset-0 -m-1">
                      <div className="w-10 h-10 border-2 border-white/30 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Voice call ongoing</div>
                    <div className="text-xs text-green-100">{voiceStatus}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    endVoiceCall();
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-all shadow-lg hover:shadow-xl"
                  title="End Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Voice Call Initial Screen - Only when not active */}
            {showVoiceCall && !isVoiceActive && (
              <div className="bg-slate-50 p-6 flex flex-col items-center justify-center border-b border-gray-200">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-300 flex items-center justify-center">
                    <Mic className="w-8 h-8 text-gray-600" />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Start Voice Call</h3>
                    <p className="text-xs text-gray-600 mt-1">Talk to the AI assistant</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startVoiceCall();
                      }}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-full text-sm font-medium shadow-lg transition-all flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Start Call
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowVoiceCall(false);
                      }}
                      className="text-gray-600 hover:text-gray-800 text-sm px-4 py-2 rounded-full hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>

                  {error && (
                    <div className="bg-red-100 border border-red-300 text-red-800 rounded-lg px-3 py-2 text-xs">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                        : message.role === 'system'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 px-1">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-red-100 border border-red-300 text-red-800 rounded-lg px-4 py-2 text-sm">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-gray-100"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-slate-600 hover:bg-slate-700 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
              <div className="text-xs text-gray-500 text-center mt-2">
                Powered by AI
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}
