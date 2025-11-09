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
const ELEVEN_LABS_VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID;
const ELEVEN_LABS_MODEL_ID = process.env.ELEVEN_LABS_MODEL_ID || 'eleven_flash_v2_5';

// ✅ Voice settings for consistent pitch/volume across all responses
// Higher stability = more consistent pitch/tone (0.8 recommended for customer service)
// Lower style = less variation in delivery (0.0 recommended for consistency)
const ELEVEN_LABS_STABILITY = parseFloat(process.env.ELEVEN_LABS_STABILITY || '0.8');
const ELEVEN_LABS_SIMILARITY = parseFloat(process.env.ELEVEN_LABS_SIMILARITY || '0.8');
const ELEVEN_LABS_STYLE = parseFloat(process.env.ELEVEN_LABS_STYLE || '0.0');

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
    // ✅ REMOVED: Verbose log - happens on every STT call
    // console.log(`🎤 Deepgram STT: Processing ${audioBuffer.length} bytes of ${audioFormat} audio`);

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

    // Use env var voice ID if provided, otherwise use voice name mapping, fallback to nova
    const voiceId = ELEVEN_LABS_VOICE_ID || voiceIds[voice] || voiceIds['nova'];

    // Generate audio using ElevenLabs streaming API
    const audioStream = await elevenLabsClient.textToSpeech.convert(voiceId, {
      text,
      model_id: ELEVEN_LABS_MODEL_ID,    // Use env var model ID (default: eleven_flash_v2_5)
      voice_settings: {
        stability: ELEVEN_LABS_STABILITY,      // Voice consistency (0.8 default) - higher = more consistent pitch/tone
        similarity_boost: ELEVEN_LABS_SIMILARITY, // Voice similarity (0.8 default) - higher = better consistency
        style: ELEVEN_LABS_STYLE,              // Style variation (0.0 default) - lower = less pitch/volume variation
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
    // Use env var voice ID if provided, otherwise use voice name mapping, fallback to nova
    const voiceId = ELEVEN_LABS_VOICE_ID || voiceIds[args.voice || 'nova'] || voiceIds['nova'];

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
            if (!elevenLabsClient) {
              throw new Error('ELEVEN_LABS_API_KEY not configured');
            }

            const audioStream = await elevenLabsClient.textToSpeech.convert(voiceId, {
              text: textBuffer,
              model_id: ELEVEN_LABS_MODEL_ID,
              voice_settings: {
                stability: ELEVEN_LABS_STABILITY,      // Voice consistency - configurable via env
                similarity_boost: ELEVEN_LABS_SIMILARITY, // Voice similarity - configurable via env
                style: ELEVEN_LABS_STYLE,              // Style variation - configurable via env
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
            if (!elevenLabsClient) {
              throw new Error('ELEVEN_LABS_API_KEY not configured');
            }

            const audioStream = await elevenLabsClient.textToSpeech.convert(voiceId, {
              text: textBuffer,
              model_id: ELEVEN_LABS_MODEL_ID,
              voice_settings: {
                stability: ELEVEN_LABS_STABILITY,      // Voice consistency - configurable via env
                similarity_boost: ELEVEN_LABS_SIMILARITY, // Voice similarity - configurable via env
                style: ELEVEN_LABS_STYLE,              // Style variation - configurable via env
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
