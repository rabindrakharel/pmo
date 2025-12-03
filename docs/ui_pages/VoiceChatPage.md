# VoiceChatPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/VoiceChatPage.tsx` | **Updated:** 2025-12-03

---

## Overview

VoiceChatPage provides a full-screen voice assistant interface using push-to-talk. It integrates the VoiceChat component with multi-agent orchestration, Whisper STT, and OpenAI TTS.

**Core Principles:**
- Full-screen voice interface (no Layout)
- VoiceChat component integration
- Multi-agent orchestration
- Push-to-talk interface
- Whisper STT + OpenAI TTS

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VOICECHATPAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /voice-chat                                                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Header Bar                                                              ││
│  │  [Phone Icon] Voice Assistant                                            ││
│  │  Talk to our AI assistant with voice - powered by multi-agent orchestrator││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │                         VoiceChat Component                              ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │                                                                 │   ││
│  │  │                      [Waveform Visualizer]                      │   ││
│  │  │                                                                 │   ││
│  │  │                         Ready to listen                         │   ││
│  │  │                                                                 │   ││
│  │  │                     [🎤 Push to Talk]                           │   ││
│  │  │                                                                 │   ││
│  │  │  Transcript:                                                    │   ││
│  │  │  User: "Schedule a meeting with the team for tomorrow"          │   ││
│  │  │  AI: "I'll schedule a team meeting for tomorrow..."             │   ││
│  │  │                                                                 │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Info Banner (slate background)                                          ││
│  │  [⚡ Multi-agent orchestration] [💬 Whisper STT + OpenAI TTS] [📞 PTT]  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Full-Screen Layout (No Layout Wrapper)

```tsx
export function VoiceChatPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">...</div>

      {/* Main Content - VoiceChat fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <VoiceChat />
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-700 text-white py-3 px-6">...</div>
    </div>
  );
}
```

### 2. Technology Stack Display

```tsx
<div className="flex items-center justify-center gap-8 text-sm">
  <div className="flex items-center gap-2">
    <Zap className="w-4 h-4" />
    <span>Multi-agent orchestration</span>
  </div>
  <div className="flex items-center gap-2">
    <MessageSquare className="w-4 h-4" />
    <span>Whisper STT + OpenAI TTS</span>
  </div>
  <div className="flex items-center gap-2">
    <Phone className="w-4 h-4" />
    <span>Push-to-talk interface</span>
  </div>
</div>
```

---

## VoiceChat Component

The VoiceChat component (not shown in this page) handles:
- Audio recording with Web Audio API
- Whisper API for speech-to-text
- Multi-agent orchestration for response
- OpenAI TTS for text-to-speech
- Waveform visualization
- Push-to-talk button

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| Whisper STT | Speech-to-text conversion |
| OpenAI TTS | Text-to-speech output |
| Multi-agent orchestration | AI response generation |
| Web Audio API | Audio capture & visualization |

---

## Page Structure

| Section | Purpose |
|---------|---------|
| Header | Page title and description |
| Main Content | VoiceChat component (full height) |
| Info Banner | Technology stack display |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [ChatPage](./ChatPage.md) | Text chat interface |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Multi-agent orchestration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
