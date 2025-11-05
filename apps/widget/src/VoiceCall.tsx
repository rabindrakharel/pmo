/**
 * Voice Call Component
 * Handles voice calling with AI using WebRTC and WebSocket
 */

import { useState, useRef, useEffect } from 'react';

interface VoiceCallProps {
  apiUrl: string;
  onClose: () => void;
}

enum CallStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SPEAKING = 'speaking',
  LISTENING = 'listening',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

export function VoiceCall({ apiUrl, onClose }: VoiceCallProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [transcript, setTranscript] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  /**
   * Initialize voice call
   */
  const startCall = async () => {
    try {
      setCallStatus(CallStatus.CONNECTING);
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect to WebSocket
      const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      const ws = new WebSocket(`${wsUrl}/api/v1/chat/voice/call`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Voice call connected');
        setCallStatus(CallStatus.CONNECTED);
        startAudioCapture(stream);
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error');
        setCallStatus(CallStatus.ERROR);
      };

      ws.onclose = () => {
        console.log('🔌 Voice call disconnected');
        setCallStatus(CallStatus.DISCONNECTED);
        cleanup();
      };

    } catch (err) {
      console.error('Failed to start call:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
      setCallStatus(CallStatus.ERROR);
    }
  };

  /**
   * Start capturing audio from microphone
   */
  const startAudioCapture = (stream: MediaStream) => {
    if (!audioContextRef.current) return;

    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(2048, 1, 1);

    processorNodeRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (callStatus === CallStatus.DISCONNECTED) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = convertFloat32ToPCM16(inputData);

      // Send audio to server
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: arrayBufferToBase64(pcm16.buffer)
        }));
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    setCallStatus(CallStatus.LISTENING);
  };

  /**
   * Handle WebSocket messages from server
   */
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'session.created':
          console.log('Session created:', message.session_id);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcribed
          setTranscript(message.transcript);
          setCallStatus(CallStatus.SPEAKING);
          break;

        case 'response.audio.delta':
          // AI is speaking - queue audio data
          const audioData = base64ToArrayBuffer(message.delta);
          const pcm16 = new Int16Array(audioData);
          audioQueueRef.current.push(pcm16);

          // Start playback if not already playing
          if (!isPlayingRef.current) {
            playAudioQueue();
          }
          break;

        case 'response.audio_transcript.delta':
          // AI response transcript
          setAiResponse(prev => prev + message.delta);
          break;

        case 'response.audio_transcript.done':
          // AI finished speaking
          setAiResponse(message.transcript);
          setTimeout(() => {
            setCallStatus(CallStatus.LISTENING);
            setAiResponse('');
          }, 1000);
          break;

        case 'response.done':
          // Response completed
          break;

        case 'error':
          console.error('Server error:', message.error);
          setError(message.error || 'Unknown error');
          setCallStatus(CallStatus.ERROR);
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  };

  /**
   * Play audio queue
   */
  const playAudioQueue = async () => {
    if (!audioContextRef.current || isPlayingRef.current) return;

    isPlayingRef.current = true;
    setCallStatus(CallStatus.SPEAKING);

    while (audioQueueRef.current.length > 0) {
      const pcm16 = audioQueueRef.current.shift();
      if (!pcm16) continue;

      const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to Float32
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }

    isPlayingRef.current = false;
  };

  /**
   * End call and cleanup
   */
  const endCall = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    cleanup();
    onClose();
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  /**
   * Auto-start call on mount
   */
  useEffect(() => {
    startCall();
    return () => cleanup();
  }, []);

  return (
    <div className="huron-voice-call">
      <div className="huron-voice-call-header">
        <h3>Voice Call with AI</h3>
        <button onClick={endCall} className="huron-voice-close">
          ✕
        </button>
      </div>

      <div className="huron-voice-call-body">
        {/* Call Status Indicator */}
        <div className={`huron-voice-status huron-voice-status-${callStatus}`}>
          <div className="huron-voice-indicator">
            {callStatus === CallStatus.CONNECTING && <LoadingSpinner />}
            {callStatus === CallStatus.LISTENING && <MicrophoneIcon animate />}
            {callStatus === CallStatus.SPEAKING && <SpeakerIcon animate />}
            {callStatus === CallStatus.ERROR && <ErrorIcon />}
          </div>
          <div className="huron-voice-status-text">
            {getStatusText(callStatus)}
          </div>
        </div>

        {/* Transcripts */}
        {transcript && (
          <div className="huron-voice-transcript huron-voice-transcript-user">
            <div className="huron-voice-transcript-label">You said:</div>
            <div className="huron-voice-transcript-text">{transcript}</div>
          </div>
        )}

        {aiResponse && (
          <div className="huron-voice-transcript huron-voice-transcript-ai">
            <div className="huron-voice-transcript-label">AI:</div>
            <div className="huron-voice-transcript-text">{aiResponse}</div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="huron-voice-error">
            <ErrorIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Instructions */}
        {callStatus === CallStatus.LISTENING && !transcript && (
          <div className="huron-voice-instructions">
            Start speaking... I'm listening!
          </div>
        )}
      </div>

      <div className="huron-voice-call-footer">
        <button onClick={endCall} className="huron-voice-end-call">
          End Call
        </button>
      </div>
    </div>
  );
}

// Helper functions
function convertFloat32ToPCM16(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm16;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function getStatusText(status: CallStatus): string {
  switch (status) {
    case CallStatus.CONNECTING: return 'Connecting...';
    case CallStatus.CONNECTED: return 'Connected';
    case CallStatus.LISTENING: return 'Listening...';
    case CallStatus.SPEAKING: return 'AI is speaking...';
    case CallStatus.DISCONNECTED: return 'Call ended';
    case CallStatus.ERROR: return 'Error';
    default: return '';
  }
}

// Icon Components
function LoadingSpinner() {
  return (
    <svg className="huron-voice-spinner" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="80, 120" />
    </svg>
  );
}

function MicrophoneIcon({ animate }: { animate?: boolean }) {
  return (
    <svg className={animate ? 'huron-voice-pulse' : ''} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpeakerIcon({ animate }: { animate?: boolean }) {
  return (
    <svg className={animate ? 'huron-voice-pulse' : ''} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
