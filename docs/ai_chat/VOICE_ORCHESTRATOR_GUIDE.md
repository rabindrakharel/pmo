# Voice Orchestrator Guide

**Version:** 1.0.0 | **Date:** 2025-11-06

---

## Overview

The **Voice Orchestrator** integrates voice chat (speech-to-text and text-to-speech) with the multi-agent orchestrator framework. This provides a complete voice interface for your PMO platform while leveraging all the benefits of stateful multi-agent orchestration.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Web/Mobile)                                       │
│  - Captures mic audio (WebRTC/MediaRecorder)                │
│  - Sends audio chunks to backend                             │
│  - Plays back audio response                                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP POST (multipart/form-data)
                         │ Audio buffer (webm/wav/mp3)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND: Voice Orchestrator Service                         │
│                                                              │
│  Step 1: Speech-to-Text (STT)                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ OpenAI Whisper API                                     │ │
│  │ - Model: whisper-1                                     │ │
│  │ - Supports: webm, wav, mp3, ogg                       │ │
│  │ - Returns: Transcript text                            │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  Step 2: Multi-Agent Orchestration                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Orchestrator Framework                                 │ │
│  │ - Authenticator: Validates user                        │ │
│  │ - Orchestrator: Detects intent                         │ │
│  │ - Worker: Executes MCP tools                           │ │
│  │ - Evaluator: Validates outputs                         │ │
│  │ - Critic: Enforces boundaries                          │ │
│  │ - Returns: Response text                               │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  Step 3: Text-to-Speech (TTS)                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ OpenAI TTS API                                         │ │
│  │ - Model: tts-1 (or tts-1-hd)                          │ │
│  │ - Voice: alloy, echo, fable, onyx, nova, shimmer      │ │
│  │ - Returns: Audio buffer (MP3)                          │ │
│  └──────────────────────┬─────────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────────────┘
                          │ HTTP Response
                          │ Audio/MP3 + metadata headers
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND                                                    │
│  - Receives audio response                                   │
│  - Plays audio via AudioContext/HTMLAudioElement            │
│  - Displays transcript and response text                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Benefits

✅ **Full Orchestrator Integration** - Voice benefits from multi-agent coordination
✅ **Stateful Conversations** - Persistent context across voice interactions
✅ **Cost Optimized** - GPT-3.5 Turbo agents (94.7% cheaper than Realtime API)
✅ **Quality Control** - Critic and Evaluator agents ensure quality
✅ **MCP Tools** - Voice can trigger any MCP tool (bookings, tasks, etc.)
✅ **Natural Language** - LLM-based response generation
✅ **Auto-Goodbye** - Handles off-topic gracefully

---

## API Endpoints

### 1. POST /api/v1/chat/orchestrator/voice
**Complete voice processing: STT → Orchestrator → TTS**

**Request:**
```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@audio.webm" \
  -F "session_id=uuid-optional" \
  -F "voice=alloy"
```

**Response:**
- **Body:** Audio/MP3 stream
- **Headers:**
  - `X-Session-Id`: Orchestrator session ID
  - `X-Transcript`: URL-encoded transcript
  - `X-Response-Text`: URL-encoded response text
  - `X-Intent`: Detected intent (e.g., "CalendarBooking")
  - `X-Current-Node`: Current workflow node
  - `X-Completed`: "true" if workflow completed
  - `X-Conversation-Ended`: "true" if conversation ended
  - `X-End-Reason`: Reason for ending (off_topic, max_turns, etc.)

**Example:**
```javascript
const formData = new FormData();
formData.append('file', audioBlob, 'audio.webm');
formData.append('voice', 'nova');

const response = await fetch('/api/v1/chat/orchestrator/voice', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const audioBlob = await response.blob();
const transcript = decodeURIComponent(response.headers.get('X-Transcript'));
const responseText = decodeURIComponent(response.headers.get('X-Response-Text'));

// Play audio
const audio = new Audio(URL.createObjectURL(audioBlob));
audio.play();

// Display text
console.log('User said:', transcript);
console.log('Bot said:', responseText);
```

---

### 2. POST /api/v1/chat/orchestrator/stt
**Speech-to-Text only (no orchestrator processing)**

**Request:**
```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/stt \
  -F "file=@audio.webm"
```

**Response:**
```json
{
  "transcript": "I need landscaping service",
  "success": true
}
```

**Use Cases:**
- Testing Whisper transcription
- Building custom voice flows
- Real-time transcription

---

### 3. POST /api/v1/chat/orchestrator/tts
**Text-to-Speech only**

**Request:**
```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your booking is confirmed for Thursday at 2 PM.",
    "voice": "nova"
  }'
```

**Response:**
- Audio/MP3 stream

**Use Cases:**
- Testing TTS voices
- Generating audio for notifications
- Custom speech synthesis

---

### 4. GET /api/v1/chat/orchestrator/voices
**Get available TTS voices**

**Request:**
```bash
curl http://localhost:4000/api/v1/chat/orchestrator/voices
```

**Response:**
```json
{
  "count": 6,
  "voices": [
    {
      "id": "alloy",
      "name": "Alloy",
      "description": "Neutral and balanced"
    },
    {
      "id": "echo",
      "name": "Echo",
      "description": "Warm and friendly"
    },
    {
      "id": "fable",
      "name": "Fable",
      "description": "Expressive and dynamic"
    },
    {
      "id": "onyx",
      "name": "Onyx",
      "description": "Deep and authoritative"
    },
    {
      "id": "nova",
      "name": "Nova",
      "description": "Energetic and youthful"
    },
    {
      "id": "shimmer",
      "name": "Shimmer",
      "description": "Soft and gentle"
    }
  ]
}
```

---

## Frontend Integration

### Using Existing Voice Chat Component

The existing voice chat component can be updated to use the new orchestrator endpoints:

**Before (old realtime API):**
```javascript
// WebSocket connection to realtime API
const ws = new WebSocket('ws://localhost:4000/api/v1/chat/voice/call');
```

**After (new orchestrator):**
```javascript
// HTTP POST to orchestrator voice endpoint
async function sendVoiceMessage(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('session_id', sessionId);
  formData.append('voice', selectedVoice);

  const response = await fetch('/api/v1/chat/orchestrator/voice', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });

  // Get metadata from headers
  const transcript = decodeURIComponent(response.headers.get('X-Transcript'));
  const responseText = decodeURIComponent(response.headers.get('X-Response-Text'));
  const conversationEnded = response.headers.get('X-Conversation-Ended') === 'true';

  // Get audio
  const audioBlob = await response.blob();

  return {
    transcript,
    responseText,
    audioBlob,
    conversationEnded
  };
}
```

### Complete Example

```typescript
import { useRef, useState } from 'react';

export function VoiceChat() {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    formData.append('voice', 'nova');

    try {
      const response = await fetch('/api/v1/chat/orchestrator/voice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Voice request failed');
      }

      // Get metadata
      const newSessionId = response.headers.get('X-Session-Id');
      const transcript = decodeURIComponent(response.headers.get('X-Transcript') || '');
      const responseText = decodeURIComponent(response.headers.get('X-Response-Text') || '');
      const conversationEnded = response.headers.get('X-Conversation-Ended') === 'true';

      setSessionId(newSessionId);

      // Display transcript
      console.log('You said:', transcript);
      console.log('Bot said:', responseText);

      // Play audio response
      const responseAudioBlob = await response.blob();
      const audio = new Audio(URL.createObjectURL(responseAudioBlob));
      audio.play();

      // Handle conversation end
      if (conversationEnded) {
        const endReason = response.headers.get('X-End-Reason');
        console.log('Conversation ended:', endReason);
        setSessionId(null);
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
    }
  };

  return (
    <div>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isRecording}
      >
        {isRecording ? '🎤 Recording...' : '🎤 Hold to Talk'}
      </button>
    </div>
  );
}
```

---

## Configuration

### Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...  # Required for Whisper and TTS

# Optional: Override default models
ORCHESTRATOR_MODEL=gpt-3.5-turbo
WORKER_MODEL=gpt-3.5-turbo
```

### Voice Selection

Available voices (from OpenAI TTS):

- **alloy** - Neutral and balanced (default)
- **echo** - Warm and friendly
- **fable** - Expressive and dynamic
- **onyx** - Deep and authoritative
- **nova** - Energetic and youthful
- **shimmer** - Soft and gentle

---

## Audio Format Support

### Supported Input Formats (Whisper)
- WebM (`.webm`) - Recommended for web browsers
- WAV (`.wav`) - Highest quality
- MP3 (`.mp3`) - Good compression
- OGG (`.ogg`) - Alternative web format

### Output Format (TTS)
- MP3 - Universal compatibility

### File Size Limits
- Maximum: 25MB per request
- Recommended: Keep under 10MB for faster processing

---

## Workflow Examples

### Example 1: Complete Booking via Voice

```
User: [Speaks] "I need landscaping service"

Backend:
  1. STT → "I need landscaping service"
  2. Orchestrator → Detects intent: CalendarBooking
  3. Orchestrator → "Can I get your name and phone number?"
  4. TTS → Audio response

User: [Speaks] "I'm Sarah, 416-555-1234"

Backend:
  1. STT → "I'm Sarah, 416-555-1234"
  2. Orchestrator → Creates customer, responds
  3. TTS → "Thanks Sarah! What's your service address?"

[... conversation continues ...]

User: [Speaks] "Yes, that works!"

Backend:
  1. STT → "Yes, that works!"
  2. Orchestrator → Creates booking
  3. TTS → "You're all set! Booking confirmed..."
```

### Example 2: Off-Topic Handling

```
User: [Speaks] "What's the weather tomorrow?"

Backend:
  1. STT → "What's the weather tomorrow?"
  2. Critic → Detects off-topic (attempt 1)
  3. TTS → "I'm specifically here for service bookings... (first warning)"

User: [Speaks] "Tell me a joke"

Backend:
  1. STT → "Tell me a joke"
  2. Critic → Detects off-topic (attempt 2)
  3. TTS → "I'm specifically designed to help with our home services..."
  4. Session ended (reason: off_topic)
```

---

## Performance

### Latency Breakdown

| Component | Typical Latency |
|-----------|-----------------|
| STT (Whisper) | 500-1500ms |
| Orchestrator Processing | 500-2000ms |
| MCP Tool Calls | 200-500ms each |
| TTS (OpenAI) | 500-1500ms |
| **Total** | **1.7-5.5 seconds** |

### Optimization Tips

1. **Use streaming** - Stream audio back as it's generated (future enhancement)
2. **Optimize audio** - Compress audio before sending (webm with opus codec)
3. **Batch processing** - Process multiple short utterances together
4. **Cache TTS** - Cache common responses

### Cost Breakdown

**Current Implementation (Cost-Optimized):**
- Whisper STT: $0.006 per minute
- GPT-3.5 Turbo Orchestrator: $0.0015 per 1K tokens (~$0.004 per conversation)
- OpenAI TTS: $0.015 per 1M characters (~$0.006 per conversation)
- **Total: ~$0.016 per conversation**

**Previous Implementation (Removed):**
- OpenAI Realtime API: ~$0.30 per conversation
- **Savings: 94.7%** 🎉

**See:** [`VOICE_COST_OPTIMIZED_ARCHITECTURE.md`](./VOICE_COST_OPTIMIZED_ARCHITECTURE.md) for detailed cost analysis.

---

## Testing

### Test STT

```bash
# Record audio (on macOS/Linux)
sox -d -r 16000 -c 1 test.wav trim 0 5

# Test STT
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/stt \
  -F "file=@test.wav"
```

### Test TTS

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"nova"}' \
  --output test.mp3

# Play audio (on macOS)
afplay test.mp3
```

### Test Complete Flow

```bash
# Record audio
sox -d -r 16000 -c 1 question.wav trim 0 5

# Send to orchestrator
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@question.wav" \
  -F "voice=nova" \
  --output response.mp3

# Play response
afplay response.mp3
```

---

## Troubleshooting

### Issue: "No speech detected"

**Solution:**
- Check audio format is supported
- Ensure audio file has actual speech
- Try increasing recording volume

### Issue: "OPENAI_API_KEY not configured"

**Solution:**
```bash
export OPENAI_API_KEY=sk-your-key-here
```

### Issue: "File too large"

**Solution:**
- Keep audio under 25MB
- Use compressed formats (webm, mp3)
- Record in shorter segments

---

## Future Enhancements

### Planned Features

1. **Streaming TTS** - Stream audio back as it's generated
2. **Voice Activity Detection** - Auto-stop recording when user stops talking
3. **Multi-language Support** - Detect and support multiple languages
4. **Voice Biometrics** - Identify users by voice
5. **Emotion Detection** - Detect sentiment from voice tone
6. **Background Noise Reduction** - Filter out ambient noise

---

## Files

```
apps/api/src/modules/chat/orchestrator/
├── voice-orchestrator.service.ts    ← STT/TTS + orchestrator integration
└── voice-orchestrator.routes.ts     ← API endpoints

docs/orchestrator/
└── VOICE_ORCHESTRATOR_GUIDE.md      ← This document
```

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** 2025-11-06
