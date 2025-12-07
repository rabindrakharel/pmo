/**
 * Voice Orchestrator Service
 * Integrates voice chat (Deepgram STT + ElevenLabs TTS) with multi-agent orchestrator
 * @module orchestrator/voice-orchestrator
 */

import { getAgentOrchestratorService } from './agents/agent-orchestrator.service.js';
import { createClient, DeepgramClient } from '@deepgram/sdk';
import { ElevenLabsClient, stream } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';
import secrets from '@/config/secrets.js';
import { config } from '@/config/index.js';

// Lazy getters for secrets (loaded at runtime, not module load)
const getDeepgramApiKey = () => secrets.deepgramApiKey;
const getElevenLabsApiKey = () => secrets.elevenLabsApiKey;
const getElevenLabsVoiceId = () => config.elevenLabs.voiceId;
const getElevenLabsModelId = () => config.elevenLabs.modelId;
const getElevenLabsStability = () => config.elevenLabs.stability;
const getElevenLabsSimilarity = () => config.elevenLabs.similarity;
const getElevenLabsStyle = () => config.elevenLabs.style;

// Lazy client initialization
let deepgramClient: DeepgramClient | null = null;
let elevenLabsClient: ElevenLabsClient | null = null;

function getDeepgramClient(): DeepgramClient | null {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) return null;
  if (!deepgramClient) {
    deepgramClient = createClient(apiKey);
  }
  return deepgramClient;
}

function getElevenLabsClient(): ElevenLabsClient | null {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) return null;
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({ apiKey });
  }
  return elevenLabsClient;
}

/**
 * Speech-to-Text using Deepgram Nova-2 model
 * https://developers.deepgram.com/docs/getting-started-with-pre-recorded-audio
 */
export async function speechToText(audioBuffer: Buffer, audioFormat: string = 'webm'): Promise<string> {
  const client = getDeepgramClient();
  if (!client) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  try {
    // ✅ REMOVED: Verbose log - happens on every STT call
    // console.log(`🎤 Deepgram STT: Processing ${audioBuffer.length} bytes of ${audioFormat} audio`);

    // Determine MIME type based on format
    const mimeType = audioFormat.includes('webm') ? 'audio/webm' :
                     audioFormat.includes('wav') ? 'audio/wav' :
                     audioFormat.includes('mp3') ? 'audio/mp3' :
                     audioFormat.includes('ogg') ? 'audio/ogg' : 'audio/webm';

    // Use Deepgram's prerecorded transcription API
    const { result, error } = await client.listen.prerecorded.transcribeFile(
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
  const client = getElevenLabsClient();
  if (!client) {
    throw new Error('ELEVEN_LABS_API_KEY not configured');
  }

  try {
    // ✅ REMOVED: Verbose log - happens on every TTS call
    // console.log(`🔊 ElevenLabs TTS: Generating audio for "${text.substring(0, 50)}..." using ${voice} voice`);

    // Voice ID mapping
    const voiceIds: Record<string, string> = {
      'nova': '7ExgohZ4jKVjuJLwSEWl',        // Nova (female, energetic)
      'alloy': 'pNInz6obpgDQGcFmaJgB',       // Adam (male, neutral)
      'echo': 'VR6AewLTigWG4xSOukaG',        // Arnold (male, crisp)
      'fable': 'TX3LPaxmHKxFdv7VOQHJ',       // Clyde (male, warm)
      'onyx': 'IKne3meq5aSn9XLyUdCD',        // Drew (male, well-rounded)
      'shimmer': 'pqHfZKP75CvOlQylNhV4',     // Glinda (female, warm)
    };

    // Use config voice ID if provided, otherwise use voice name mapping, fallback to nova
    const voiceId = getElevenLabsVoiceId() || voiceIds[voice] || voiceIds['nova'];

    // Generate audio using ElevenLabs streaming API
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      model_id: getElevenLabsModelId(),
      voice_settings: {
        stability: getElevenLabsStability(),
        similarity_boost: getElevenLabsSimilarity(),
        style: getElevenLabsStyle(),
        use_speaker_boost: true                // Enhance voice clarity and normalize volume
      },
      output_format: 'mp3_44100_128'     // MP3, 44.1kHz, 128kbps (consistent bitrate ensures consistent volume)
    });

    // Collect all chunks into a buffer
    const chunks: Buffer[] = [];

    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }

    const audioBuffer = Buffer.concat(chunks);

    // ✅ REMOVED: Verbose log - happens on every TTS call
    // console.log(`🔊 ElevenLabs TTS Generated: ${audioBuffer.length} bytes audio (${voice} voice)`);

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
 * Process voice message through orchestrator WITH STREAMING
 * STT (Deepgram) → Agent Orchestrator (STREAMING) → TTS (ElevenLabs STREAMING)
 * Yields audio chunks as they're generated for progressive playback
 */
export async function* processVoiceMessageStream(args: {
  sessionId?: string;
  audioBuffer: Buffer;
  audioFormat: string;
  authToken?: string;
  chatSessionId?: string;
  userId?: string;
  tenantId?: string;
  voice?: string;
}): AsyncGenerator<{
  type: 'audio' | 'transcript' | 'done' | 'error';
  audio?: Buffer;
  transcript?: string;
  userTranscript?: string;
  sessionId?: string;
  response?: string;
  intent?: string;
  currentNode?: string;
  completed?: boolean;
  conversationEnded?: boolean;
  endReason?: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Step 1: Speech-to-Text (Deepgram Nova-2)
    const userTranscript = await speechToText(args.audioBuffer, args.audioFormat);

    if (!userTranscript || userTranscript.trim().length === 0) {
      throw new Error('No speech detected in audio');
    }

    // Yield the user's transcript first
    yield {
      type: 'transcript',
      userTranscript
    };

    // Step 2: Stream response from agent orchestrator
    const orchestrator = getAgentOrchestratorService();

    let fullResponse = '';
    let textBuffer = ''; // Buffer for accumulating text before sending to TTS
    let orchestratorResult: any;

    // Voice ID mapping
    const voiceIds: Record<string, string> = {
      'nova': '7ExgohZ4jKVjuJLwSEWl',
      'alloy': 'pNInz6obpgDQGcFmaJgB',
      'echo': 'VR6AewLTigWG4xSOukaG',
      'fable': 'TX3LPaxmHKxFdv7VOQHJ',
      'onyx': 'IKne3meq5aSn9XLyUdCD',
      'shimmer': 'pqHfZKP75CvOlQylNhV4',
    };
    // Use config voice ID if provided, otherwise use voice name mapping, fallback to nova
    const voiceId = getElevenLabsVoiceId() || voiceIds[args.voice || 'nova'] || voiceIds['nova'];
    const ttsClient = getElevenLabsClient();

    for await (const chunk of orchestrator.processMessageStream({
      sessionId: args.sessionId,
      message: userTranscript,
      authToken: args.authToken,
      chatSessionId: args.chatSessionId,
      userId: args.userId
    })) {
      if (chunk.type === 'token') {
        fullResponse += chunk.token;
        textBuffer += chunk.token;

        // Check if we've hit a sentence boundary (. ! ? or line break)
        // Also send if buffer is getting long (>100 chars)
        const hasSentenceBoundary = /[.!?\n]/.test(textBuffer);
        const isLongBuffer = textBuffer.length > 100;

        if (hasSentenceBoundary || isLongBuffer) {
          // Send accumulated text to TTS and stream audio
          try {
            if (!ttsClient) {
              throw new Error('ELEVEN_LABS_API_KEY not configured');
            }

            const audioStream = await ttsClient.textToSpeech.convert(voiceId, {
              text: textBuffer,
              model_id: getElevenLabsModelId(),
              voice_settings: {
                stability: getElevenLabsStability(),
                similarity_boost: getElevenLabsSimilarity(),
                style: getElevenLabsStyle(),
                use_speaker_boost: true                // Normalize volume
              },
              output_format: 'mp3_44100_128'     // Consistent bitrate
            });

            // Collect audio chunks
            const audioChunks: Buffer[] = [];
            for await (const audioChunk of audioStream) {
              audioChunks.push(Buffer.from(audioChunk));
            }

            const audioBuffer = Buffer.concat(audioChunks);

            // Yield audio chunk
            yield {
              type: 'audio',
              audio: audioBuffer,
              transcript: textBuffer
            };

            // Clear buffer
            textBuffer = '';
          } catch (ttsError: any) {
            console.error('❌ Streaming TTS Error:', ttsError.message);
            // Continue even if one TTS chunk fails
          }
        }
      } else if (chunk.type === 'done') {
        orchestratorResult = chunk;

        // Send any remaining buffered text to TTS
        if (textBuffer.trim().length > 0) {
          try {
            if (!ttsClient) {
              throw new Error('ELEVEN_LABS_API_KEY not configured');
            }

            const audioStream = await ttsClient.textToSpeech.convert(voiceId, {
              text: textBuffer,
              model_id: getElevenLabsModelId(),
              voice_settings: {
                stability: getElevenLabsStability(),
                similarity_boost: getElevenLabsSimilarity(),
                style: getElevenLabsStyle(),
                use_speaker_boost: true                // Normalize volume
              },
              output_format: 'mp3_44100_128'     // Consistent bitrate
            });

            const audioChunks: Buffer[] = [];
            for await (const audioChunk of audioStream) {
              audioChunks.push(Buffer.from(audioChunk));
            }

            const audioBuffer = Buffer.concat(audioChunks);

            yield {
              type: 'audio',
              audio: audioBuffer,
              transcript: textBuffer
            };
          } catch (ttsError: any) {
            console.error('❌ Final TTS Error:', ttsError.message);
          }
        }

        // Yield final metadata
        const duration = Date.now() - startTime;
        console.log(`✅ Voice streaming complete in ${duration}ms: "${userTranscript}" → "${fullResponse}"`);

        yield {
          type: 'done',
          sessionId: orchestratorResult.sessionId,
          response: fullResponse,
          userTranscript,
          intent: orchestratorResult.intent,
          currentNode: orchestratorResult.currentNode,
          completed: orchestratorResult.completed,
          conversationEnded: orchestratorResult.conversationEnded,
          endReason: orchestratorResult.endReason
        };
      } else if (chunk.type === 'error') {
        yield {
          type: 'error',
          error: chunk.error
        };
      }
    }
  } catch (error: any) {
    console.error('❌ Voice streaming error:', error);
    yield {
      type: 'error',
      error: error.message || 'Voice processing failed'
    };
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
