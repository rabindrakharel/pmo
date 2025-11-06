/**
 * Voice Call WebSocket Routes (Using Whisper STT + Langraph + TTS)
 * @module chat/voice.routes
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { VoiceLangraphSession } from './voice-langraph.service.js';
import { createSession } from './conversation.service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Register voice WebSocket routes
 */
export async function voiceRoutes(fastify: FastifyInstance) {
  /**
   * WebSocket: /api/v1/chat/voice/call
   * Establish voice call with AI using Whisper STT + Langraph + TTS
   *
   * Flow:
   * 1. Browser sends audio chunks
   * 2. Server accumulates and processes via Whisper (STT)
   * 3. Text goes through Langraph orchestrator
   * 4. Response converted to speech via TTS
   * 5. Audio sent back to browser
   */
  fastify.get('/voice/call', { websocket: true }, async (socket: WebSocket, request) => {
    console.log('🎙️ New voice call connection (Whisper + Langraph + TTS)');

    try {
      // Create interaction session with UNIQUE ID for each call
      const sessionResult = await createSession({
        customer_email: request.query?.email as string,
        customer_name: request.query?.name as string,
        referrer_url: request.headers.referer || request.headers.origin,
        metadata: {
          user_agent: request.headers['user-agent'],
          ip_address: request.ip,
          interaction_type: 'voice',
          voice_engine: 'whisper_langraph_tts',
          created_at: new Date().toISOString()
        }
      });

      // Generate UNIQUE voice session ID
      const voiceSessionId = uuidv4();

      // Extract auth token from query params or headers
      const authToken = (request.query?.token as string) ||
                       request.headers.authorization?.replace('Bearer ', '');

      console.log(`🆕 Created voice session: ${voiceSessionId}`);
      console.log(`📝 Interaction session: ${sessionResult.session_id}`);
      console.log(`🔑 Auth token: ${authToken ? '✅ Present' : '❌ Missing'}`);

      // Send session info to client
      socket.send(JSON.stringify({
        type: 'session.created',
        session_id: voiceSessionId,
        interaction_session_id: sessionResult.session_id,
        interaction_number: sessionResult.interaction_number,
        engine: 'whisper_langraph_tts'
      }));

      // Create voice session with Langraph orchestrator
      const voiceSession = new VoiceLangraphSession(socket, {
        sessionId: voiceSessionId,
        interactionSessionId: sessionResult.session_id,
        authToken: authToken
      });

      await voiceSession.connect();

      console.log(`✅ Voice Langraph session ${voiceSessionId} established`);
    } catch (error) {
      console.error('Error establishing voice session:', error);
      socket.send(JSON.stringify({
        type: 'error',
        error: 'Failed to establish voice connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
      socket.close();
    }
  });

  console.log('✅ Voice WebSocket routes registered (Whisper + Langraph + TTS)');
}
