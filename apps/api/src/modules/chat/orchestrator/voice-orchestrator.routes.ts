/**
 * Voice Orchestrator API Routes
 * STT/TTS endpoints integrated with multi-agent orchestrator
 * @module orchestrator/voice-orchestrator-routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { speechToText, textToSpeech, getAvailableVoices } from './voice-orchestrator.service.js';

/**
 * Register voice orchestrator routes
 * Note: Multipart support is already registered globally in server.ts
 */
export async function voiceOrchestratorRoutes(fastify: FastifyInstance) {
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

      // ✅ REMOVED: Verbose log - happens on every STT API call
      // console.log(`🎤 STT request: ${audioBuffer.length} bytes, format: ${audioFormat}`);

      // Convert speech to text
      const transcript = await speechToText(audioBuffer, audioFormat);

      reply.code(200).send({
        transcript,
        success: true
      });

      // ✅ REMOVED: Verbose log - happens on every STT API call
      // console.log(`✅ STT complete: "${transcript}"`);
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

      // ✅ REMOVED: Verbose log - happens on every TTS API call
      // console.log(`🔊 TTS request: "${text.substring(0, 50)}...", voice: ${voice}`);

      // Convert text to speech
      const audioBuffer = await textToSpeech(text, voice);

      reply
        .code(200)
        .header('Content-Type', 'audio/mpeg')
        .send(audioBuffer);

      // ✅ REMOVED: Verbose log - happens on every TTS API call
      // console.log(`✅ TTS complete: ${audioBuffer.length} bytes`);
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
