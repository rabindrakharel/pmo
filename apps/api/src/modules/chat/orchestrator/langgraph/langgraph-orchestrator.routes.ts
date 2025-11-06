/**
 * LangGraph Orchestrator Routes
 * API endpoints for LangGraph-based orchestration
 * @module orchestrator/langgraph/routes
 */

import type { FastifyInstance } from 'fastify';
import { getLangGraphOrchestratorService } from './langgraph-orchestrator.service.js';

export async function langGraphOrchestratorRoutes(fastify: FastifyInstance) {
  const orchestrator = getLangGraphOrchestratorService();

  /**
   * POST /api/v1/chat/langgraph/message
   * Process a message through LangGraph orchestrator
   */
  fastify.post('/message', async (request, reply) => {
    try {
      const {
        session_id,
        message,
        chat_session_id,
        user_id,
      } = request.body as {
        session_id?: string;
        message: string;
        chat_session_id?: string;
        user_id?: string;
      };

      if (!message) {
        return reply.code(400).send({
          error: 'Message is required',
        });
      }

      // Get auth token from header
      const authToken = request.headers.authorization?.replace('Bearer ', '');

      // Process message through LangGraph
      const result = await orchestrator.processMessage({
        sessionId: session_id,
        message,
        chatSessionId: chat_session_id,
        userId: user_id,
        authToken,
      });

      return reply.code(200).send(result);
    } catch (error: any) {
      console.error('[LangGraphRoutes] Error processing message:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chat/langgraph/session/:id/status
   * Get session status
   */
  fastify.get('/session/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const status = await orchestrator.getSessionStatus(id);

      if (!status) {
        return reply.code(404).send({
          error: 'Session not found',
        });
      }

      return reply.code(200).send(status);
    } catch (error: any) {
      console.error('[LangGraphRoutes] Error getting session status:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chat/langgraph/intents
   * List all available intents/workflows
   */
  fastify.get('/intents', async (request, reply) => {
    try {
      const intents = orchestrator.listIntents();

      return reply.code(200).send({
        count: intents.length,
        intents,
      });
    } catch (error: any) {
      console.error('[LangGraphRoutes] Error listing intents:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chat/langgraph/health
   * Health check endpoint
   */
  fastify.get('/health', async (request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      service: 'LangGraph Orchestrator',
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Register LangGraph orchestrator routes
 */
export async function registerLangGraphOrchestratorRoutes(fastify: FastifyInstance) {
  await fastify.register(langGraphOrchestratorRoutes, {
    prefix: '/api/v1/chat/langgraph',
  });
}
