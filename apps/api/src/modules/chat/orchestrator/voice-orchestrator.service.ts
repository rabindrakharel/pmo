/**
 * Voice Orchestrator Service
 * Integrates voice chat (STT/TTS) with multi-agent orchestrator
 * @module orchestrator/voice-orchestrator
 */

import { getLangGraphOrchestratorService } from './langgraph/langgraph-orchestrator.service.js';
import FormData from 'form-data';
import axios from 'axios';
import { PassThrough } from 'stream';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';

/**
 * Speech-to-Text using OpenAI Whisper
 */
export async function speechToText(audioBuffer: Buffer, audioFormat: string = 'webm'): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const formData = new FormData();

    // Determine file extension based on format
    const extension = audioFormat.includes('webm') ? 'webm' :
                     audioFormat.includes('wav') ? 'wav' :
                     audioFormat.includes('mp3') ? 'mp3' :
                     audioFormat.includes('ogg') ? 'ogg' : 'webm';

    formData.append('file', audioBuffer, {
      filename: `audio.${extension}`,
      contentType: `audio/${extension}`
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Can be made configurable

    const response = await axios.post(
      `${OPENAI_API_URL}/audio/transcriptions`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 30000
      }
    );

    const transcript = response.data.text;
    console.log(`🎤 STT Transcript: "${transcript}"`);

    return transcript;
  } catch (error: any) {
    console.error('❌ STT Error:', error.response?.data || error.message);
    throw new Error(`Speech-to-text failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Text-to-Speech using OpenAI TTS
 */
export async function textToSpeech(text: string, voice: string = 'alloy'): Promise<Buffer> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      `${OPENAI_API_URL}/audio/speech`,
      {
        model: 'tts-1',  // Can use 'tts-1-hd' for higher quality
        input: text,
        voice: voice,  // Options: alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',  // Options: mp3, opus, aac, flac
        speed: 1.0  // 0.25 to 4.0
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    console.log(`🔊 TTS Generated: ${text.substring(0, 50)}... (${response.data.byteLength} bytes)`);

    return Buffer.from(response.data);
  } catch (error: any) {
    console.error('❌ TTS Error:', error.response?.data || error.message);
    throw new Error(`Text-to-speech failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Process voice message through orchestrator
 */
export async function processVoiceMessage(args: {
  sessionId?: string;
  audioBuffer: Buffer;
  audioFormat: string;
  authToken?: string;
  chatSessionId?: string;
  userId?: string;
  tenantId?: string;
  voice?: string; // TTS voice preference
}): Promise<{
  sessionId: string;
  transcript: string;
  response: string;
  audioBuffer: Buffer;
  intent?: string;
  currentNode?: string;
  completed?: boolean;
  conversationEnded?: boolean;
  endReason?: string;
}> {
  const startTime = Date.now();

  try {
    // Step 1: Speech-to-Text (Whisper)
    console.log('🎤 Step 1: Converting speech to text...');
    const transcript = await speechToText(args.audioBuffer, args.audioFormat);

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No speech detected in audio');
    }

    // Step 2: Process through LangGraph orchestrator
    console.log('🎯 Step 2: Processing through LangGraph orchestrator...');
    const orchestrator = getLangGraphOrchestratorService();
    const orchestratorResult = await orchestrator.processMessage({
      sessionId: args.sessionId,
      message: transcript,
      authToken: args.authToken,
      chatSessionId: args.chatSessionId,
      userId: args.userId
    });

    // Step 3: Text-to-Speech (OpenAI TTS)
    console.log('🔊 Step 3: Converting response to speech...');
    const audioBuffer = await textToSpeech(orchestratorResult.response, args.voice || 'alloy');

    const duration = Date.now() - startTime;
    console.log(`✅ Voice message processed in ${duration}ms`);

    return {
      sessionId: orchestratorResult.sessionId,
      transcript,
      response: orchestratorResult.response,
      audioBuffer,
      intent: orchestratorResult.intent,
      currentNode: orchestratorResult.currentNode,
      completed: orchestratorResult.completed,
      conversationEnded: orchestratorResult.conversationEnded,
      endReason: orchestratorResult.endReason
    };
  } catch (error: any) {
    console.error('❌ Voice processing error:', error);
    throw error;
  }
}

/**
 * Get available TTS voices
 */
export function getAvailableVoices(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and friendly' },
    { id: 'fable', name: 'Fable', description: 'Expressive and dynamic' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
    { id: 'nova', name: 'Nova', description: 'Energetic and youthful' },
    { id: 'shimmer', name: 'Shimmer', description: 'Soft and gentle' }
  ];
}
