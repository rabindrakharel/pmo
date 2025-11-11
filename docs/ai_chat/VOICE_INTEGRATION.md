# Voice Integration Guide

> **Deepgram + ElevenLabs Voice Chat Integration** - Complete guide to implementing voice features

**Version:** 6.1.0
**Status:** 📝 Documentation in Progress
**Last Updated:** 2025-11-11

---

## 📋 Overview

This guide will cover:

- ✅ Deepgram Nova-2 Speech-to-Text integration
- ✅ ElevenLabs Flash v2.5 Text-to-Speech integration
- ✅ WebSocket voice streaming architecture
- ✅ HTTP voice API (push-to-talk)
- ✅ Voice Activity Detection (VAD)
- ✅ Audio queue management
- ✅ Voice settings and optimization

---

## 📚 Quick Links

**For now, please refer to:**

1. **[AI Chat System Documentation](./AI_CHAT_SYSTEM.md)** - Voice architecture
   - [Voice Orchestrator Service](./AI_CHAT_SYSTEM.md#3-voice-orchestrator-service)
   - [ChatWidget Component](./AI_CHAT_SYSTEM.md#1-chatwidget-component)
   - [VoiceChat Component](./AI_CHAT_SYSTEM.md#2-voicechat-component)
   - [Voice Call Flow](./AI_CHAT_SYSTEM.md#voice-call-flow-websocket)

2. **[Quick Start Guide](./QUICK_START.md)** - Enable voice features
   - [Enable Voice Chat](./QUICK_START.md#enable-voice-chat-optional)

3. **[Voice Orchestrator Code](../../apps/api/src/modules/chat/orchestrator/voice-orchestrator.service.ts)** - Implementation reference

---

## 🚧 Coming Soon

This comprehensive guide will include:

### 1. Architecture
- STT → Agent → TTS pipeline
- WebSocket vs HTTP voice APIs
- Sentence buffering strategy
- Audio format conversion

### 2. Deepgram Integration
- API key setup
- Nova-2 model configuration
- Audio format requirements
- Transcription accuracy tuning

### 3. ElevenLabs Integration
- API key setup
- Voice selection (6 voices)
- Flash v2.5 model settings
- Latency optimization

### 4. Frontend Implementation
- Microphone access
- Audio recording (WebM/WAV)
- WebSocket connection
- Audio playback queue
- Voice Activity Detection

### 5. Performance Optimization
- Streaming strategies
- Buffer management
- Latency reduction
- Cost optimization

---

**Questions?** Check the existing [AI Chat System Documentation](./AI_CHAT_SYSTEM.md#3-voice-orchestrator-service) for voice implementation details.

---

**Maintained By:** PMO Platform Team
**Status:** 📝 In Progress
