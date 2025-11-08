/**
 * Voice Chat WebSocket Routes
 * WebSocket endpoint for real-time voice conversations using LangGraph orchestrator
 * @module chat/voice-langraph-routes
 */

import type { FastifyInstance } from 'fastify';
import { VoiceLangraphSession } from './voice-langraph.service.js';
import { randomUUID } from 'crypto';

/**
 * Register voice WebSocket routes
 */
export async function voiceLangraphRoutes(fastify: FastifyInstance) {
  /**
   * WebSocket endpoint for voice calls
   * GET /api/v1/chat/voice/call?name=NAME&email=EMAIL&token=JWT
   *
   * This establishes a WebSocket connection for real-time voice chat
   * with STT → LangGraph Orchestrator → TTS pipeline
   */
  fastify.get('/voice/call', {
    websocket: true
  }, async (connection, request) => {
    try {
      // Extract query parameters
      const { name, email, token } = request.query as {
        name?: string;
        email?: string;
        token?: string;
      };

      // Generate session ID
      const sessionId = randomUUID();

      console.log(`🎙️ New voice call WebSocket connection: ${sessionId}`);
      console.log(`   User: ${name || 'Anonymous'} (${email || 'no-email'})`);
      console.log(`   Auth: ${token ? '✓ Token provided' : '✗ No token'}`);

      // Create voice session - connection IS the WebSocket
      const voiceSession = new VoiceLangraphSession(connection as any, {
        sessionId,
        interactionSessionId: sessionId, // Use same ID for interaction tracking
        authToken: token
      });

      // Initialize connection
      await voiceSession.connect();
    } catch (error) {
      console.error(`❌ Failed to initialize voice session:`, error);
      if ((connection as any).readyState === 1) { // OPEN
        (connection as any).close();
      }
    }
  });

  console.log('✅ Voice WebSocket routes registered');
}

export default voiceLangraphRoutes;
