/**
 * Voice Call WebSocket Routes
 * @module chat/voice.routes
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { VoiceSession } from './voice.service.js';
import { createSession } from './conversation.service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Register voice WebSocket routes
 */
export async function voiceRoutes(fastify: FastifyInstance) {
  /**
   * WebSocket: /api/v1/chat/voice/call
   * Establish voice call with AI
   */
  fastify.get('/voice/call', { websocket: true }, async (socket: WebSocket, request) => {
    console.log('🎙️ New voice call connection');

    try {
      // Create interaction session
      const sessionResult = await createSession({
        customer_email: request.query?.email as string,
        customer_name: request.query?.name as string,
        referrer_url: request.headers.referer || request.headers.origin,
        metadata: {
          user_agent: request.headers['user-agent'],
          ip_address: request.ip,
          interaction_type: 'voice'
        }
      });

      const voiceSessionId = uuidv4();

      // Extract auth token from query params or headers
      const authToken = (request.query?.token as string) ||
                       request.headers.authorization?.replace('Bearer ', '');

      // Send session info to client
      socket.send(JSON.stringify({
        type: 'session.created',
        session_id: voiceSessionId,
        interaction_session_id: sessionResult.session_id,
        interaction_number: sessionResult.interaction_number
      }));

      // Create voice session and connect to OpenAI with MCP tools
      const voiceSession = new VoiceSession(socket, {
        sessionId: voiceSessionId,
        interactionSessionId: sessionResult.session_id,
        authToken: authToken
      });

      await voiceSession.connect();

      console.log(`✅ Voice session ${voiceSessionId} established`);
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

  console.log('✅ Voice WebSocket routes registered');
}
