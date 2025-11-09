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
