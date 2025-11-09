/**
 * Agent Orchestrator Routes
 * API endpoints for pure agent-based orchestration (no LangGraph)
 * @module orchestrator/agents/routes
 */

import type { FastifyInstance } from 'fastify';
import { getAgentOrchestratorService } from './agent-orchestrator.service.js';

export async function agentOrchestratorRoutes(fastify: FastifyInstance) {
  const orchestrator = getAgentOrchestratorService();

  /**
   * GET /api/v1/chat/agent/session/:id/status
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
      console.error('[AgentRoutes] Error getting session status:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chat/agent/intents
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
      console.error('[AgentRoutes] Error listing intents:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/v1/chat/agent/message
   * Process a message through the agent orchestrator
   */
  fastify.post('/message', async (request, reply) => {
    try {
      const { session_id, message, customer_id } = request.body as any;

      if (!message) {
        return reply.code(400).send({
          error: 'Message is required',
        });
      }

      // Get auth token for MCP tools
      const token = request.headers.authorization?.replace('Bearer ', '') || '';

      // Process message through orchestrator (collect stream into full response)
      let fullResponse = '';
      let result: any = {};

      for await (const chunk of orchestrator.processMessageStream({
        sessionId: session_id,
        message,
        userId: customer_id,
        authToken: token
      })) {
        if (chunk.type === 'token') {
          fullResponse += chunk.token;
        } else if (chunk.type === 'done') {
          result = {
            sessionId: chunk.sessionId,
            response: chunk.response || fullResponse,
            currentNode: chunk.currentNode,
            conversationEnded: chunk.conversationEnded
          };
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error || 'Unknown error during processing');
        }
      }

      return reply.code(200).send({
        session_id: result.sessionId,
        response: result.response,
        current_node: result.currentNode,
        conversation_ended: result.conversationEnded,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[AgentRoutes] Error processing message:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/v1/chat/agent/health
   * Health check endpoint
   */
  fastify.get('/health', async (request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      service: 'Pure Agent Orchestrator (No LangGraph)',
      architecture: 'Multi-Agent System (Worker, Guider, Navigator)',
      configuration: 'DAG.json',
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Register agent orchestrator routes
 */
export async function registerAgentOrchestratorRoutes(fastify: FastifyInstance) {
  await fastify.register(agentOrchestratorRoutes, {
    prefix: '/api/v1/chat/agent',
  });
}
