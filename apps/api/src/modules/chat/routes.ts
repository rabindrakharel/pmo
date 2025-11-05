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

import { voiceRoutes } from './voice.routes.js';

/**
 * Register chat routes
 */
export async function chatRoutes(fastify: FastifyInstance) {
  // Register voice WebSocket routes
  await voiceRoutes(fastify);

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

      // Get AI response with function calling (using MCP tools)
      const token = request.headers.authorization?.replace('Bearer ', '') || '';
      const aiResult = await getAIResponse(conversationHistory, {
        interactionSessionId: session_id,
        useMCP: true,
        authToken: token,
        maxTools: 50
      });

      // Add AI response to conversation
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResult.response,
        timestamp: new Date().toISOString()
      };

      const updatedConversation = [...conversationHistory, assistantMessage];

      // Check if booking was created
      const bookingCreated = aiResult.functionCalls.some(
        fc => fc.function_name === 'create_booking' && fc.success
      );
      const bookingResult = aiResult.functionCalls.find(
        fc => fc.function_name === 'create_booking' && fc.success
      );

      // Calculate cost
      const costCents = calculateCost(aiResult.tokensUsed);

      // Update session in database
      await updateSession(session_id, updatedConversation, {
        total_tokens: (session.total_tokens || 0) + aiResult.tokensUsed,
        total_cost_cents: (session.total_cost_cents || 0) + costCents,
        model_used: aiResult.modelUsed,
        booking_id: bookingResult?.result?.booking_id,
        function_calls: aiResult.functionCalls.map(fc => fc.function_name)
      });

      // Prepare response
      const response: ChatMessageResponse = {
        session_id,
        response: aiResult.response,
        function_calls: aiResult.functionCalls.length > 0 ? aiResult.functionCalls : undefined,
        booking_created: bookingCreated,
        booking_number: bookingResult?.result?.booking_number,
        tokens_used: aiResult.tokensUsed,
        timestamp: new Date().toISOString()
      };

      reply.code(200).send(response);

      console.log(`✅ Message processed for session ${session_id}: ${aiResult.tokensUsed} tokens, ${aiResult.functionCalls.length} function calls`);
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
