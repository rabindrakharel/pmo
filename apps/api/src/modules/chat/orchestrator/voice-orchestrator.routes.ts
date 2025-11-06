/**
 * Voice Orchestrator API Routes
 * STT/TTS endpoints integrated with multi-agent orchestrator
 * @module orchestrator/voice-orchestrator-routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processVoiceMessage, speechToText, textToSpeech, getAvailableVoices } from './voice-orchestrator.service.js';
import multipart from '@fastify/multipart';

/**
 * Register voice orchestrator routes
 */
export async function voiceOrchestratorRoutes(fastify: FastifyInstance) {
  // Register multipart support for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB max file size
      files: 1 // Only one file at a time
    }
  });

  /**
   * POST /api/v1/chat/orchestrator/voice
   * Complete voice processing: STT → Orchestrator → TTS
   */
  fastify.post('/orchestrator/voice', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No audio file provided' });
      }

      // Read audio buffer
      const audioBuffer = await data.toBuffer();

      // Get other parameters from fields
      const sessionId = (data.fields as any)?.session_id?.value;
      const chatSessionId = (data.fields as any)?.chat_session_id?.value;
      const userId = (data.fields as any)?.user_id?.value;
      const tenantId = (data.fields as any)?.tenant_id?.value;
      const voice = (data.fields as any)?.voice?.value || 'alloy';

      // Extract auth token from headers
      const authToken = request.headers.authorization?.replace('Bearer ', '');

      // Detect audio format from mimetype or filename
      const audioFormat = data.mimetype || 'audio/webm';

      console.log(`🎤 Received voice message: ${audioBuffer.length} bytes, format: ${audioFormat}`);

      // Process voice message through orchestrator
      const result = await processVoiceMessage({
        sessionId,
        audioBuffer,
        audioFormat,
        authToken,
        chatSessionId,
        userId,
        tenantId,
        voice
      });

      // Return audio as MP3 stream with metadata in headers
      reply
        .code(200)
        .header('Content-Type', 'audio/mpeg')
        .header('X-Session-Id', result.sessionId)
        .header('X-Transcript', encodeURIComponent(result.transcript))
        .header('X-Response-Text', encodeURIComponent(result.response))
        .header('X-Intent', result.intent || '')
        .header('X-Current-Node', result.currentNode || '')
        .header('X-Completed', result.completed ? 'true' : 'false')
        .header('X-Conversation-Ended', result.conversationEnded ? 'true' : 'false')
        .header('X-End-Reason', result.endReason || '')
        .send(result.audioBuffer);

      console.log(`✅ Voice response sent: ${result.audioBuffer.length} bytes`);
    } catch (error) {
      console.error('❌ Voice processing error:', error);
      reply.code(500).send({
        error: 'Voice processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/chat/orchestrator/stt
   * Speech-to-Text only (Whisper)
   */
  fastify.post('/orchestrator/stt', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No audio file provided' });
      }

      // Read audio buffer
      const audioBuffer = await data.toBuffer();

      // Detect audio format
      const audioFormat = data.mimetype || 'audio/webm';

      console.log(`🎤 STT request: ${audioBuffer.length} bytes, format: ${audioFormat}`);

      // Convert speech to text
      const transcript = await speechToText(audioBuffer, audioFormat);

      reply.code(200).send({
        transcript,
        success: true
      });

      console.log(`✅ STT complete: "${transcript}"`);
    } catch (error) {
      console.error('❌ STT error:', error);
      reply.code(500).send({
        error: 'Speech-to-text failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/chat/orchestrator/tts
   * Text-to-Speech only (OpenAI TTS)
   */
  fastify.post<{
    Body: {
      text: string;
      voice?: string;
    };
  }>('/orchestrator/tts', async (request, reply) => {
    try {
      const { text, voice = 'alloy' } = request.body;

      if (!text) {
        return reply.code(400).send({ error: 'text is required' });
      }

      console.log(`🔊 TTS request: "${text.substring(0, 50)}...", voice: ${voice}`);

      // Convert text to speech
      const audioBuffer = await textToSpeech(text, voice);

      reply
        .code(200)
        .header('Content-Type', 'audio/mpeg')
        .send(audioBuffer);

      console.log(`✅ TTS complete: ${audioBuffer.length} bytes`);
    } catch (error) {
      console.error('❌ TTS error:', error);
      reply.code(500).send({
        error: 'Text-to-speech failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/chat/orchestrator/voices
   * Get available TTS voices
   */
  fastify.get('/orchestrator/voices', async (request, reply) => {
    const voices = getAvailableVoices();

    reply.code(200).send({
      count: voices.length,
      voices
    });
  });

  console.log('✅ Voice orchestrator routes registered');
}

export default voiceOrchestratorRoutes;
