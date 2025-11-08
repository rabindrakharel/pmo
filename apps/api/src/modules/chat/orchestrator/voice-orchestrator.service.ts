/**
 * Voice Orchestrator Service
 * Integrates voice chat (Deepgram STT + ElevenLabs TTS) with multi-agent orchestrator
 * @module orchestrator/voice-orchestrator
 */

import { getAgentOrchestratorService } from './agents/agent-orchestrator.service.js';
import { createClient } from '@deepgram/sdk';
import { ElevenLabsClient, stream } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;

// Initialize Deepgram client
const deepgramClient = DEEPGRAM_API_KEY ? createClient(DEEPGRAM_API_KEY) : null;

// Initialize ElevenLabs client
const elevenLabsClient = ELEVEN_LABS_API_KEY ? new ElevenLabsClient({ apiKey: ELEVEN_LABS_API_KEY }) : null;

/**
 * Speech-to-Text using Deepgram Nova-2 model
 * https://developers.deepgram.com/docs/getting-started-with-pre-recorded-audio
 */
export async function speechToText(audioBuffer: Buffer, audioFormat: string = 'webm'): Promise<string> {
  if (!deepgramClient) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  try {
    console.log(`🎤 Deepgram STT: Processing ${audioBuffer.length} bytes of ${audioFormat} audio`);

    // Determine MIME type based on format
    const mimeType = audioFormat.includes('webm') ? 'audio/webm' :
                     audioFormat.includes('wav') ? 'audio/wav' :
                     audioFormat.includes('mp3') ? 'audio/mp3' :
                     audioFormat.includes('ogg') ? 'audio/ogg' : 'audio/webm';

    // Use Deepgram's prerecorded transcription API
    const { result, error } = await deepgramClient.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',          // Latest Deepgram model
        language: 'en',           // English
        smart_format: true,       // Automatic formatting (punctuation, etc.)
        punctuate: true,
        diarize: false,           // No speaker diarization needed
        utterances: false,
      }
    );

    if (error) {
      console.error('❌ Deepgram STT Error:', error);
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;

    if (!transcript || transcript.trim().length === 0) {
      console.warn('⚠️  Deepgram returned empty transcript');
      return '';
    }

    console.log(`🎤 Deepgram STT Transcript: "${transcript}" (confidence: ${(result.results.channels[0].alternatives[0].confidence * 100).toFixed(1)}%)`);

    return transcript;
  } catch (error: any) {
    console.error('❌ Deepgram STT Error:', error.message || error);
    throw new Error(`Speech-to-text failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Text-to-Speech using ElevenLabs with Nova voice
 * https://elevenlabs.io/docs/api-reference/text-to-speech
 */
export async function textToSpeech(text: string, voice: string = 'nova'): Promise<Buffer> {
  if (!elevenLabsClient) {
    throw new Error('ELEVEN_LABS_API_KEY not configured');
  }

  try {
    console.log(`🔊 ElevenLabs TTS: Generating audio for "${text.substring(0, 50)}..." using ${voice} voice`);

    // Voice ID mapping
    const voiceIds: Record<string, string> = {
      'nova': '7ExgohZ4jKVjuJLwSEWl',        // Nova (female, energetic)
      'alloy': 'pNInz6obpgDQGcFmaJgB',       // Adam (male, neutral)
      'echo': 'VR6AewLTigWG4xSOukaG',        // Arnold (male, crisp)
      'fable': 'TX3LPaxmHKxFdv7VOQHJ',       // Clyde (male, warm)
      'onyx': 'IKne3meq5aSn9XLyUdCD',        // Drew (male, well-rounded)
      'shimmer': 'pqHfZKP75CvOlQylNhV4',     // Glinda (female, warm)
    };

    const voiceId = voiceIds[voice] || voiceIds['nova'];

    // Generate audio using ElevenLabs streaming API
    const audioStream = await elevenLabsClient.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_flash_v2_5',    // Fastest model with lowest latency (~75ms)
      voice_settings: {
        stability: 0.5,                   // Voice consistency (0-1)
        similarity_boost: 0.75,           // Voice similarity to original (0-1)
        style: 0.5,                       // Style exaggeration (0-1, Flash v2.5 only)
        use_speaker_boost: true           // Enhance voice clarity
      },
      output_format: 'mp3_44100_128'     // MP3, 44.1kHz, 128kbps
    });

    // Collect all chunks into a buffer
    const chunks: Buffer[] = [];

    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }

    const audioBuffer = Buffer.concat(chunks);

    console.log(`🔊 ElevenLabs TTS Generated: ${audioBuffer.length} bytes audio (${voice} voice)`);

    return audioBuffer;
  } catch (error: any) {
    console.error('❌ ElevenLabs TTS Error:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body,
      text: text.substring(0, 100)
    });

    throw new Error(`Text-to-speech failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Process voice message through orchestrator
 * STT (Deepgram) → Agent Orchestrator → TTS (ElevenLabs)
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
    // Step 1: Speech-to-Text (Deepgram Nova-2)
    console.log('🎤 Step 1: Converting speech to text (Deepgram Nova-2)...');
    const transcript = await speechToText(args.audioBuffer, args.audioFormat);

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No speech detected in audio');
    }

    // Step 2: Process through agent orchestrator
    console.log('🎯 Step 2: Processing through agent orchestrator...');
    const orchestrator = getAgentOrchestratorService();
    const orchestratorResult = await orchestrator.processMessage({
      sessionId: args.sessionId,
      message: transcript,
      authToken: args.authToken,
      chatSessionId: args.chatSessionId,
      userId: args.userId
    });

    // Step 3: Text-to-Speech (ElevenLabs Flash v2.5)
    console.log('🔊 Step 3: Converting response to speech (ElevenLabs Flash v2.5)...');
    const audioBuffer = await textToSpeech(orchestratorResult.response, args.voice || 'nova');

    const duration = Date.now() - startTime;
    console.log(`✅ Voice message processed in ${duration}ms (STT: Deepgram, TTS: ElevenLabs)`);

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
 * Get available TTS voices (ElevenLabs)
 */
export function getAvailableVoices(): Array<{
  id: string;
  name: string;
  description: string;
  voiceId: string;
}> {
  return [
    { id: 'nova', name: 'Nova', description: 'Female, energetic and youthful', voiceId: '7ExgohZ4jKVjuJLwSEWl' },
    { id: 'alloy', name: 'Alloy (Adam)', description: 'Male, neutral and balanced', voiceId: 'pNInz6obpgDQGcFmaJgB' },
    { id: 'echo', name: 'Echo (Arnold)', description: 'Male, crisp and clear', voiceId: 'VR6AewLTigWG4xSOukaG' },
    { id: 'fable', name: 'Fable (Clyde)', description: 'Male, warm and expressive', voiceId: 'TX3LPaxmHKxFdv7VOQHJ' },
    { id: 'onyx', name: 'Onyx (Drew)', description: 'Male, deep and authoritative', voiceId: 'IKne3meq5aSn9XLyUdCD' },
    { id: 'shimmer', name: 'Shimmer (Glinda)', description: 'Female, soft and gentle', voiceId: 'pqHfZKP75CvOlQylNhV4' }
  ];
}
