/**
 * Chat Widget API Routes
 * @module chat/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAIResponse, calculateCost, generateGreeting } from './openai.service.js';
import {
  createSession,
  getSession,
  updateSession,
  getConversationHistory,
  closeSession,
  getRecentInteractions
} from './conversation.service.js';
import type {
  ChatMessageRequest,
  ChatMessageResponse,
  NewSessionRequest,
  NewSessionResponse,
  ChatMessage
} from './types.js';

import { voiceLangraphRoutes } from './voice-langraph.routes.js';
import { disconnectVoiceLangraphSession, getActiveVoiceLangraphSessionCount } from './voice-langraph.service.js';

/**
 * Register chat routes
 */
export async function chatRoutes(fastify: FastifyInstance) {
  // Register voice WebSocket routes
  await voiceLangraphRoutes(fastify);

  /**
   * POST /api/v1/chat/session/new
   * Create a new chat session
   */
  fastify.post<{
    Body: NewSessionRequest;
    Reply: NewSessionResponse;
  }>('/session/new', async (request, reply) => {
    try {
      const { customer_id, customer_email, customer_name, referrer_url, metadata } = request.body;

      // Create session in database
      const { session_id, interaction_number } = await createSession({
        customer_id,
        customer_email,
        customer_name,
        referrer_url,
        metadata: {
          ...metadata,
          user_agent: request.headers['user-agent'],
          ip_address: request.ip
        }
      });

      // Generate greeting
      const greeting = generateGreeting();

      // Initialize conversation with greeting
      const initialMessages: ChatMessage[] = [
        {
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString()
        }
      ];

      // Update session with greeting
      await updateSession(session_id, initialMessages, {
        model_used: 'gpt-4-turbo-preview'
      });

      reply.code(201).send({
        session_id,
        greeting,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ New chat session created: ${session_id} (${interaction_number})`);
    } catch (error) {
      console.error('Error creating session:', error);
      reply.code(500).send({
        error: 'Failed to create session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/chat/message
   * Send a message and get AI response
   */
  fastify.post<{
    Body: ChatMessageRequest;
    Reply: ChatMessageResponse | { error: string };
  }>('/message', async (request, reply) => {
    try {
      const { session_id, message, customer_id, customer_email, customer_name } = request.body;

      if (!session_id || !message) {
        return reply.code(400).send({ error: 'session_id and message are required' });
      }

      // Get existing session
      const session = await getSession(session_id);
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      // Add user message to conversation
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };

      const conversationHistory = [...session.conversation_history, userMessage];

      // Use agent orchestrator for text chat (same as voice)
      const token = request.headers.authorization?.replace('Bearer ', '') || '';

      // Log token status for debugging
      if (!token) {
        console.warn(`⚠️ No auth token for session ${session_id} - AI will have limited tool access`);
      } else {
        console.log(`🔐 Chat session ${session_id} using authenticated MCP tools`);
      }

      // Import agent orchestrator
      const { getAgentOrchestratorService } = await import('./orchestrator/agents/agent-orchestrator.service.js');
      const orchestrator = getAgentOrchestratorService();

      // Get or create orchestrator session
      const orchestratorSessionId = session.metadata?.orchestrator_session_id;

      // Process message through agent orchestrator
      const orchestratorResult = await orchestrator.processMessage({
        sessionId: orchestratorSessionId,
        message,
        chatSessionId: session_id,
        userId: customer_id || session.metadata?.customer_id,
        authToken: token
      });

      // Add assistant message to conversation
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: orchestratorResult.response,
        timestamp: new Date().toISOString()
      };

      const updatedConversation = [...conversationHistory, assistantMessage];

      // Check if booking was created (based on node context)
      const bookingCreated = orchestratorResult.currentNode === 'confirm_booking' && orchestratorResult.completed;

      // Update session in database
      await updateSession(session_id, updatedConversation, {
        total_tokens: (session.total_tokens || 0) + 100, // Estimated - will add proper tracking
        total_cost_cents: (session.total_cost_cents || 0) + 2, // ~$0.02 per conversation with GPT-3.5
        model_used: 'gpt-3.5-turbo',
        metadata: {
          ...session.metadata,
          orchestrator_session_id: orchestratorResult.sessionId,
          current_intent: orchestratorResult.intent,
          current_node: orchestratorResult.currentNode
        }
      });

      // Prepare response
      const response: ChatMessageResponse = {
        session_id,
        response: orchestratorResult.response,
        function_calls: undefined, // LangGraph handles this internally
        booking_created: bookingCreated,
        booking_number: undefined, // Will extract from state if needed
        tokens_used: 100, // Estimated - will add proper tracking
        timestamp: new Date().toISOString()
      };

      reply.code(200).send(response);

      console.log(`✅ Message processed for session ${session_id} via Agent Orchestrator (intent: ${orchestratorResult.intent}, node: ${orchestratorResult.currentNode})`);
    } catch (error) {
      console.error('Error processing message:', error);
      reply.code(500).send({
        error: 'Failed to process message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/chat/session/:sessionId/history
   * Get conversation history for a session
   */
  fastify.get<{
    Params: { sessionId: string };
  }>('/session/:sessionId/history', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const session = await getSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      reply.code(200).send({
        session_id: session.session_id,
        messages: session.conversation_history,
        booking_created: session.booking_created_flag,
        total_messages: session.conversation_history.length,
        created_ts: session.created_ts,
        updated_ts: session.updated_ts
      });
    } catch (error) {
      console.error('Error getting history:', error);
      reply.code(500).send({
        error: 'Failed to get history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/chat/session/:sessionId/close
   * Close a chat session
   */
  fastify.post<{
    Params: { sessionId: string };
    Body: { resolution?: 'resolved' | 'abandoned' | 'escalated' };
  }>('/session/:sessionId/close', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const { resolution = 'resolved' } = request.body;

      await closeSession(sessionId, resolution);

      reply.code(200).send({
        success: true,
        message: 'Session closed successfully'
      });

      console.log(`✅ Session closed: ${sessionId} (${resolution})`);
    } catch (error) {
      console.error('Error closing session:', error);
      reply.code(500).send({
        error: 'Failed to close session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/chat/session/:sessionId/disconnect
   * Disconnect a chat session (works for both text and voice)
   * For text chat: marks session as closed in database
   * For voice chat: closes WebSocket connection AND marks session as closed
   */
  fastify.post<{
    Params: { sessionId: string };
    Body: {
      resolution?: 'resolved' | 'abandoned' | 'escalated';
      session_type?: 'text' | 'voice' | 'auto';
    };
  }>('/session/:sessionId/disconnect', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const { resolution = 'resolved', session_type = 'auto' } = request.body;

      let voiceDisconnected = false;
      let textClosed = false;

      // Try to disconnect voice session if it exists
      if (session_type === 'auto' || session_type === 'voice') {
        voiceDisconnected = disconnectVoiceLangraphSession(sessionId);
      }

      // Always close the session in database (works for both text and voice)
      if (session_type === 'auto' || session_type === 'text' || voiceDisconnected) {
        try {
          await closeSession(sessionId, resolution);
          textClosed = true;
        } catch (error) {
          console.warn(`Could not close session ${sessionId} in database:`, error);
        }
      }

      const success = voiceDisconnected || textClosed;

      reply.code(success ? 200 : 404).send({
        success,
        voice_disconnected: voiceDisconnected,
        text_closed: textClosed,
        message: success
          ? 'Session disconnected successfully'
          : 'Session not found',
        active_voice_sessions: getActiveVoiceLangraphSessionCount()
      });

      if (success) {
        console.log(`✅ Session disconnected: ${sessionId} (voice: ${voiceDisconnected}, text: ${textClosed}, resolution: ${resolution})`);
      }
    } catch (error) {
      console.error('Error disconnecting session:', error);
      reply.code(500).send({
        error: 'Failed to disconnect session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/chat/analytics/recent
   * Get recent chat interactions for analytics
   * (Admin/internal use only - should be protected in production)
   */
  fastify.get<{
    Querystring: { limit?: string };
  }>('/analytics/recent', async (request, reply) => {
    try {
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;

      const interactions = await getRecentInteractions(limit);

      reply.code(200).send({
        count: interactions.length,
        interactions
      });
    } catch (error) {
      console.error('Error getting analytics:', error);
      reply.code(500).send({
        error: 'Failed to get analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/chat/voice/transcribe
   * Transcribe voice audio to text (future enhancement)
   * Placeholder for OpenAI Whisper API integration
   */
  fastify.post('/voice/transcribe', async (request, reply) => {
    reply.code(501).send({
      error: 'Not implemented',
      message: 'Voice transcription will be implemented in Phase 2'
    });
  });

  console.log('✅ Chat routes registered');
}

export default chatRoutes;
