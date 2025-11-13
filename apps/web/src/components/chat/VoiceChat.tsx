/**
 * Voice Chat Component - Orchestrator Integration
 * Uses HTTP POST for voice messages with STT → Orchestrator → TTS pipeline
 */

import React, { useState, useRef } from 'react';
import { Mic, MicOff, Volume2, Loader2, X } from 'lucide-react';

interface VoiceChatProps {
  onClose?: () => void;
  authToken?: string;
}

interface VoiceMessage {
  role: 'user' | 'assistant';
  transcript: string;
  timestamp: string;
}

export function VoiceChat({ onClose, authToken }: VoiceChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('nova');
  const [conversationEnded, setConversationEnded] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  const voices = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and friendly' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Energetic and youthful' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle' }
  ];

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startRecording = async () => {
    try {
      console.log('🎤 Starting recording...');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        // Send to backend
        await sendVoiceMessage(audioBlob);

        // Stop stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError('Failed to start recording: ' + error.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('🛑 Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      if (sessionId) {
        formData.append('session_id', sessionId);
      }

      formData.append('voice', selectedVoice);

      const token = authToken || localStorage.getItem('auth_token');

      console.log('📤 Sending voice message to orchestrator...');

      const response = await fetch(`${apiBaseUrl}/api/v1/chat/orchestrator/voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Voice request failed');
      }

      // Get metadata from headers
      const newSessionId = response.headers.get('X-Session-Id');
      const transcript = decodeURIComponent(response.headers.get('X-Transcript') || '');
      const responseText = decodeURIComponent(response.headers.get('X-Response-Text') || '');
      const ended = response.headers.get('X-Conversation-Ended') === 'true';
      const endReason = response.headers.get('X-End-Reason');

      if (newSessionId) {
        setSessionId(newSessionId);
      }

      // Add user message
      const userMessage: VoiceMessage = {
        role: 'user',
        transcript,
        timestamp: new Date().toISOString()
      };

      // Add assistant message
      const assistantMessage: VoiceMessage = {
        role: 'assistant',
        transcript: responseText,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);

      // Play audio response
      const responseAudioBlob = await response.blob();
      await playAudio(responseAudioBlob);

      // Handle conversation end
      if (ended) {
        console.log('Conversation ended:', endReason);
        setConversationEnded(true);

        if (endReason === 'off_topic') {
          setError('Conversation ended: Off-topic messages detected');
        } else if (endReason === 'max_turns') {
          setError('Conversation ended: Maximum turns reached');
        }
      }

      console.log('✅ Voice message processed successfully');
    } catch (error: any) {
      console.error('Error sending voice message:', error);
      setError('Failed to process voice message: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = async (audioBlob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioElementRef.current = audio;

        setIsPlayingResponse(true);

        audio.onended = () => {
          setIsPlayingResponse(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = (error) => {
          setIsPlayingResponse(false);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };

        audio.play();
      } catch (error) {
        setIsPlayingResponse(false);
        reject(error);
      }
    });
  };

  const resetConversation = () => {
    setSessionId(null);
    setMessages([]);
    setConversationEnded(false);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-slate-700 text-white px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div>
          <h2 className="text-xl font-bold">Voice Assistant</h2>
          <p className="text-sm text-slate-200">Orchestrator-powered voice chat</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="text-sm bg-white/20 text-white border border-white/30 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white/50"
            disabled={isRecording || isProcessing}
          >
            {voices.map(voice => (
              <option key={voice.id} value={voice.id} className="text-gray-900">
                {voice.name} - {voice.description}
              </option>
            ))}
          </select>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-sm">
              <Mic className="w-10 h-10 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Press and hold to speak
            </h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Hold the microphone button below and speak your message.
              Release to send and get an AI response.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.transcript}</p>
                <div className="text-xs mt-1 opacity-70">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-center">
            <div className="bg-white rounded-full px-6 py-3 shadow-sm flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
              <span className="text-sm text-gray-700">Processing your message...</span>
            </div>
          </div>
        )}

        {/* Playing response indicator */}
        {isPlayingResponse && (
          <div className="flex justify-center">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full px-6 py-3 shadow-sm flex items-center gap-3">
              <Volume2 className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-medium">AI is speaking...</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border-2 border-red-300 text-red-800 rounded-xl px-4 py-3 shadow-sm">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Conversation ended */}
        {conversationEnded && (
          <div className="bg-yellow-100 border-2 border-yellow-300 text-yellow-800 rounded-xl px-4 py-3 shadow-sm text-center">
            <p className="text-sm font-medium mb-2">Conversation ended</p>
            <button
              onClick={resetConversation}
              className="bg-slate-600 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-md transition-colors shadow-sm"
            >
              Start New Conversation
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Recording Controls */}
      <div className="bg-white border-t border-gray-200 p-6 flex-shrink-0 shadow-sm">
        <div className="flex items-center justify-center gap-4">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isProcessing || isPlayingResponse || conversationEnded}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-sm transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isRecording
                ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600'
            }`}
            title="Hold to record"
          >
            {isRecording ? (
              <>
                <MicOff className="w-8 h-8 text-white" />
                <div className="absolute inset-0 -m-2">
                  <div className="w-24 h-24 border-4 border-red-400 rounded-full animate-ping"></div>
                </div>
              </>
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>

          {conversationEnded && (
            <button
              onClick={resetConversation}
              className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-6 py-3 rounded-md transition-colors shadow-sm"
            >
              New Conversation
            </button>
          )}
        </div>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            {isRecording ? (
              <span className="font-semibold text-red-600">🎤 Recording... Release to send</span>
            ) : isProcessing ? (
              <span className="font-semibold text-purple-600">⚙️ Processing...</span>
            ) : isPlayingResponse ? (
              <span className="font-semibold text-green-600">🔊 AI is responding...</span>
            ) : conversationEnded ? (
              <span className="font-semibold text-yellow-600">Conversation ended</span>
            ) : (
              <span>Press and hold the microphone to speak</span>
            )}
          </p>
        </div>

        <div className="text-xs text-gray-500 text-center mt-2">
          Session: {sessionId ? `${sessionId.substring(0, 8)}...` : 'New'} |
          Voice: {voices.find(v => v.id === selectedVoice)?.name}
        </div>
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
